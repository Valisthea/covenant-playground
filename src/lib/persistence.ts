/**
 * IndexedDB persistence for Sepolia state (V0.9 Sprint 37).
 *
 * Persists contracts + transaction history + the in-flight pending tx
 * banner across page reloads, browser restarts, and tab closes. Keyed
 * by chain target so MockChain state and Sepolia state are never
 * accidentally cross-loaded.
 *
 * Why raw IndexedDB instead of `idb` or `localforage`:
 *   - Zero new npm dep (we already have ethers + react + zustand)
 *   - The schema we need is trivial: 3 stores, one key each, plain JSON
 *   - Removes a supply-chain attack surface for the playground
 *
 * Schema (DB name `covenant-playground`, version 1):
 *   - `contracts`    — keyed by target string ("mockchain" / "sepolia"),
 *                      stores `DeployedContract[]`
 *   - `transactions` — keyed by target, stores `TxReceipt[]`
 *   - `preferences`  — keyed by string preference name, stores any value
 *
 * What does NOT persist (intentional):
 *   - Editor source / file map — already lives in the URL share pattern
 *     and per-page-load is fine; persistence here would surprise users
 *     who expect a fresh tab = fresh source.
 *   - Compile result / diagnostics — recomputed on demand, cheap.
 *   - MockChain WASM state — lives in WASM memory, not serializable
 *     without a dedicated dump/load API (V1.0).
 *   - Wallet state — MetaMask handles its own session.
 *
 * Persistence happens via a debounced subscriber wired in store.ts
 * (300 ms quiescence). This avoids hammering IDB during a flurry of
 * state updates (e.g. the cross-tab sync dispatching a remote snapshot).
 */

import type { DeployedContract, TxReceipt } from './mockchain';
import type { DeployTarget } from './store';

const DB_NAME = 'covenant-playground';
const DB_VERSION = 1;

const STORE_CONTRACTS = 'contracts';
const STORE_TRANSACTIONS = 'transactions';
const STORE_PREFERENCES = 'preferences';

let _dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Per-target persisted snapshot. Mirrors the cross-tab `SyncedSnapshot`
 * shape but is stored locally per target.
 */
export interface PersistedSnapshot {
  contracts: DeployedContract[];
  transactions: TxReceipt[];
  /** Wall-clock ms timestamp when the snapshot was last written. */
  savedAt: number;
}

/**
 * Lazily open the IDB database. Subsequent calls return the cached
 * promise. Schema upgrade runs once when the DB is first created.
 */
function openDb(): Promise<IDBDatabase> {
  if (_dbPromise !== null) return _dbPromise;

  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable in this environment'));
  }

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CONTRACTS)) {
        db.createObjectStore(STORE_CONTRACTS);
      }
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        db.createObjectStore(STORE_TRANSACTIONS);
      }
      if (!db.objectStoreNames.contains(STORE_PREFERENCES)) {
        db.createObjectStore(STORE_PREFERENCES);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
    req.onblocked = () =>
      reject(new Error('IDB open blocked — close other tabs of this app and retry'));
  });

  return _dbPromise;
}

/** Wrap an IDBRequest in a promise. */
function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}

/**
 * Save the given snapshot for `target`. JSON-serializes contracts and
 * transactions; bigint fields (gasUsed, balance) are pre-converted to
 * strings by the caller pattern (Zustand state never holds bigints
 * directly except inside TxReceipt.gasUsed which we coerce here).
 */
export async function persistSnapshot(
  target: DeployTarget,
  snapshot: { contracts: DeployedContract[]; transactions: TxReceipt[] },
): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    // IDB unavailable (private browsing, blocked, etc.) — fail silently;
    // the in-memory state still works for the current session.
    return;
  }

  const txn = db.transaction([STORE_CONTRACTS, STORE_TRANSACTIONS], 'readwrite');
  const contracts = serializeContracts(snapshot.contracts);
  const transactions = serializeTxs(snapshot.transactions);

  await Promise.all([
    reqPromise(txn.objectStore(STORE_CONTRACTS).put(contracts, target)),
    reqPromise(
      txn.objectStore(STORE_TRANSACTIONS).put(
        { transactions, savedAt: Date.now() },
        target,
      ),
    ),
  ]);
}

/**
 * Load the snapshot for `target`. Returns `null` if nothing was ever
 * persisted for this target, or if the load failed.
 */
export async function loadSnapshot(
  target: DeployTarget,
): Promise<PersistedSnapshot | null> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }

  const txn = db.transaction([STORE_CONTRACTS, STORE_TRANSACTIONS], 'readonly');
  const [contractsRaw, txsRaw] = await Promise.all([
    reqPromise(txn.objectStore(STORE_CONTRACTS).get(target)),
    reqPromise(txn.objectStore(STORE_TRANSACTIONS).get(target)),
  ]);

  if (contractsRaw === undefined && txsRaw === undefined) {
    return null;
  }

  const contracts = deserializeContracts(contractsRaw as unknown[] | undefined);
  const txWrap = txsRaw as { transactions: unknown[]; savedAt: number } | undefined;
  const transactions = deserializeTxs(txWrap?.transactions);

  return {
    contracts,
    transactions,
    savedAt: txWrap?.savedAt ?? 0,
  };
}

/** Clear all persisted data for one target (e.g. user-triggered reset). */
export async function clearSnapshot(target: DeployTarget): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return;
  }

  const txn = db.transaction([STORE_CONTRACTS, STORE_TRANSACTIONS], 'readwrite');
  await Promise.all([
    reqPromise(txn.objectStore(STORE_CONTRACTS).delete(target)),
    reqPromise(txn.objectStore(STORE_TRANSACTIONS).delete(target)),
  ]);
}

// ─── Serialization helpers ──────────────────────────────────────────────
//
// `JSON.stringify` cannot serialize bigint. `TxReceipt.gasUsed` is the
// only bigint in our payload. Convert at the boundary.

interface SerializedTxReceipt extends Omit<TxReceipt, 'gasUsed'> {
  gasUsed: string;
}

function serializeContracts(contracts: DeployedContract[]): unknown[] {
  // DeployedContract is JSON-safe already (no bigints, no Map/Set).
  return contracts.map((c) => ({ ...c }));
}

function serializeTxs(txs: TxReceipt[]): SerializedTxReceipt[] {
  return txs.map((t) => ({ ...t, gasUsed: t.gasUsed.toString() }));
}

function deserializeContracts(raw: unknown[] | undefined): DeployedContract[] {
  if (!Array.isArray(raw)) return [];
  // Trust the shape — IDB only contains what we wrote.
  return raw as DeployedContract[];
}

function deserializeTxs(raw: unknown[] | undefined): TxReceipt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const e = entry as SerializedTxReceipt;
    return { ...e, gasUsed: BigInt(e.gasUsed) } as TxReceipt;
  });
}

// ─── Debounce helper ────────────────────────────────────────────────────

export function debounced<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}
