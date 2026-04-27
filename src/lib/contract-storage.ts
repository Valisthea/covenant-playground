/**
 * localStorage persistence for the /contract dApp.
 *
 * When a user pastes their contract address + ABI on the landing
 * form, we save the (chain, address) → ABI mapping so they don't
 * have to paste again on revisit. Also saves the ".cov source"
 * if they used the compile-from-source path, for re-display.
 */

import type { InterfaceAbi } from 'ethers';

const STORAGE_KEY = 'covenant-playground-contracts-v1';

export interface SavedContract {
  chain: string;
  address: string;
  abi: InterfaceAbi;
  /** Optional .cov source if user pasted source instead of raw ABI. */
  source?: string;
  /** When the user last viewed/saved this contract. */
  savedAt: number;
}

interface Store {
  contracts: SavedContract[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { contracts: [] };
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || !Array.isArray(parsed.contracts)) return { contracts: [] };
    return parsed;
  } catch {
    return { contracts: [] };
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors etc.
  }
}

function key(chain: string, address: string): string {
  return `${chain.toLowerCase()}:${address.toLowerCase()}`;
}

export function saveContract(c: SavedContract): void {
  const store = load();
  const k = key(c.chain, c.address);
  const filtered = store.contracts.filter(
    (x) => key(x.chain, x.address) !== k
  );
  filtered.unshift({ ...c, savedAt: Date.now() });
  // Cap to 50 to avoid unbounded growth.
  store.contracts = filtered.slice(0, 50);
  save(store);
}

export function loadContract(chain: string, address: string): SavedContract | null {
  const store = load();
  const k = key(chain, address);
  return store.contracts.find((c) => key(c.chain, c.address) === k) ?? null;
}

export function recentContracts(limit = 10): SavedContract[] {
  return load().contracts.slice(0, limit);
}

export function forgetContract(chain: string, address: string): void {
  const store = load();
  const k = key(chain, address);
  store.contracts = store.contracts.filter(
    (c) => key(c.chain, c.address) !== k
  );
  save(store);
}
