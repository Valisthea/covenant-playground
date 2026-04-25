/**
 * MockChain — in-tab EVM execution backed by `covenant-evm-runtime`
 * compiled to WASM (Sprint 23).
 *
 * Sprint 23 replaced the semantic stub with a real EVM. Every call here
 * routes through the WASM bundle's `chain_*` exports and produces actual
 * bytecode-level state transitions: real addresses, real storage, real
 * reverts with the contract's own revert reason, real events.
 *
 * The 7 Deploy components (DeployPanel, InteractionPanel, ContractList,
 * TxHistoryPane, AccountSwitcher, ChainControls, WalletPanel) consume
 * this module via the same surface they had pre-Sprint-23. The class
 * methods are preserved; only the internals changed.
 *
 * If the WASM bundle fails to load, the chain falls back to a no-op
 * mode (every operation returns a "WASM unavailable" reverted receipt)
 * so the UI never crashes — it just shows a clear error to the user.
 *
 * Design notes
 * ------------
 * - Chain state lives in WASM memory. The class fields here (`accounts`,
 *   `contracts`, `clock`) are caches refreshed via the chain_get_*
 *   exports after every mutation, so React re-reads behave correctly.
 * - ABI is NOT stored in the WASM chain (which only knows bytes). This
 *   class keeps a parallel `Map<Address, AbiFunction[]>` so action calls
 *   can encode calldata via `ethers.Interface`.
 * - Reload-the-page resets the chain. This is intentional — the
 *   playground is a sandbox, not a database.
 */

import { Interface } from 'ethers';

import type { CompileResult } from './covenant-compiler';
import { ensureCompilerLoaded, getWasmBinding } from './covenant-compiler';

export type Address = `0x${string}`;

export interface MockAccount {
  address: Address;
  label: string;
  balance: bigint;
}

export interface MockEvent {
  name: string;
  args: Record<string, unknown>;
}

export interface TxReceipt {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: Address;
  to: Address | null; // null for failed deploy
  kind: 'deploy' | 'call' | 'view';
  action?: string;
  args?: unknown[];
  returnValue?: unknown;
  gasUsed: bigint;
  status: 'success' | 'reverted';
  revertReason?: string;
  events: MockEvent[];
}

export interface DeployedContract {
  address: Address;
  deployer: Address;
  deployedAt: number;
  abi: AbiFunction[];
  /** Slim view of contract state. The real storage lives in WASM and
   *  is queryable via `wasm.chain_get_storage(addr, slot)`. This map is
   *  retained for backward compatibility with the older stub-era UI. */
  storage: Record<string, unknown>;
  name: string;
  /** Set after successful deploy; the deploy bytecode size in bytes. */
  runtimeBytecodeSize?: number;
}

export interface AbiFunction {
  type: 'function';
  name: string;
  inputs: { name?: string; type?: string }[];
  outputs: { name?: string; type?: string }[];
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
}

// ─── WASM binding shapes (mirrored from covenant_wasm_bindings.d.ts) ───

interface WasmAccount {
  address: string;
  balance: string; // "0x" + minimal hex
  nonce: number;
  label: string;
}

interface WasmContract {
  address: string;
  deployer: string;
  deployed_at_block: number;
  deployed_at_timestamp: number;
  label: string | null;
  code_hash: string;
  runtime_bytecode_size: number;
}

interface WasmTxKindDeploy { type: 'deploy' }
interface WasmTxKindCall { type: 'call'; selector: string; calldata: string }
interface WasmTxKindStaticCall { type: 'static_call'; selector: string; calldata: string }
type WasmTxKind = WasmTxKindDeploy | WasmTxKindCall | WasmTxKindStaticCall;

interface WasmTxStatusSuccess { status: 'success' }
interface WasmTxStatusReverted { status: 'reverted'; reason: string | null }
interface WasmTxStatusAborted { status: 'aborted'; reason: string }
type WasmTxStatus = WasmTxStatusSuccess | WasmTxStatusReverted | WasmTxStatusAborted;

interface WasmLogEvent {
  address: string;
  topics: string[];
  data: string;
}

interface WasmTxReceipt {
  hash: string;
  block_number: number;
  timestamp: number;
  from: string;
  to: string | null;
  kind: WasmTxKind;
  gas_used: number;
  status: WasmTxStatus;
  return_data: string;
  logs: WasmLogEvent[];
}

interface WasmChainState {
  block_number: number;
  timestamp: number;
  contracts_count: number;
  accounts_count: number;
  tx_count: number;
  chain_id: number;
}

interface ChainBinding {
  chain_init(): void;
  chain_reset(): void;
  chain_deploy(args_json: string): WasmTxReceipt;
  chain_call(args_json: string): WasmTxReceipt;
  chain_static_call(args_json: string): WasmTxReceipt;
  chain_advance_time(seconds: number | bigint): void;
  chain_mine_blocks(count: number | bigint): void;
  chain_get_state(): WasmChainState;
  chain_get_accounts(): WasmAccount[];
  chain_get_contracts(): WasmContract[];
  chain_get_tx_log(): WasmTxReceipt[];
  chain_get_storage(address_hex: string, slot_hex: string): string;
}

// ─── Public MockChain API ─────────────────────────────────────────────

export class MockChain {
  public accounts: MockAccount[] = [];
  public activeAccount: Address;
  public contracts: Map<Address, DeployedContract> = new Map();
  public txs: TxReceipt[] = [];
  public clock = { blockNumber: 1, timestamp: 0 };

  /** Cache of ABI per deployed contract address (the WASM chain only
   *  stores bytes, not ABI). Populated at deploy time. */
  private abiByAddress: Map<Address, AbiFunction[]> = new Map();
  /** Ethers `Interface` cache so we don't rebuild it on every call. */
  private ifaceByAddress: Map<Address, Interface> = new Map();
  /** Friendly name per address (used by ContractList header). */
  private nameByAddress: Map<Address, string> = new Map();

  private wasm: ChainBinding | null = null;
  private initStarted = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Defaults so React's first render doesn't crash before init.
    // The five canonical playground addresses match the chain.rs
    // PREFUNDED_ADDRESSES constant — we hard-code them here so the
    // UI can pick a default `activeAccount` before WASM finishes loading.
    this.activeAccount = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001' as Address;
    this.accounts = PREFUNDED_LABELS.map((label, i) => ({
      address: `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000${i + 1}` as Address,
      label,
      balance: 1_000n * 10n ** 18n, // 1000 ETH placeholder
    }));
    this.clock.timestamp = DEFAULT_GENESIS_TS;
  }

  /**
   * Idempotent: loads the WASM bundle (if not already loaded) and
   * resets the chain to genesis. Called from App.tsx on mount.
   */
  async init(): Promise<void> {
    if (this.initStarted && this.initPromise) {
      return this.initPromise;
    }
    this.initStarted = true;
    this.initPromise = (async () => {
      await ensureCompilerLoaded();
      const binding = (await getWasmBinding()) as unknown as ChainBinding | null;
      if (!binding) {
        // Stub mode — keep the placeholder accounts and bail.
        console.warn('[mockchain] WASM unavailable, chain operations will revert');
        return;
      }
      this.wasm = binding;
      this.wasm.chain_init();
      this.refresh();
    })();
    return this.initPromise;
  }

  setActiveAccount(address: Address): void {
    if (!this.accounts.some((a) => a.address.toLowerCase() === address.toLowerCase())) {
      throw new Error(`Unknown account ${address}`);
    }
    this.activeAccount = address;
  }

  mineBlocks(n: number): void {
    if (!this.wasm) {
      this.clock.blockNumber += Math.floor(n);
      this.clock.timestamp += Math.floor(n) * 12;
      return;
    }
    this.wasm.chain_mine_blocks(BigInt(Math.max(1, Math.floor(n))));
    this.refresh();
  }

  advanceTime(seconds: number): void {
    if (!this.wasm) {
      this.clock.timestamp += Math.floor(seconds);
      this.clock.blockNumber += 1;
      return;
    }
    this.wasm.chain_advance_time(BigInt(Math.max(1, Math.floor(seconds))));
    // mining a block isn't implied by advance_time, but the legacy stub
    // bumped block_number on advance — preserve that for UI continuity.
    this.wasm.chain_mine_blocks(1n);
    this.refresh();
  }

  reset(): void {
    if (!this.wasm) return;
    this.wasm.chain_reset();
    this.abiByAddress.clear();
    this.ifaceByAddress.clear();
    this.nameByAddress.clear();
    this.contracts.clear();
    this.txs = [];
    this.refresh();
    this.activeAccount = this.accounts[0]?.address ?? this.activeAccount;
  }

  deploy(result: CompileResult, name: string): TxReceipt {
    if (!this.wasm) {
      return this.errorReceipt('deploy', null, 'WASM compiler not loaded yet');
    }
    if (!result.ok) {
      return this.errorReceipt('deploy', null, 'Compile errors present — cannot deploy');
    }
    if (!result.bytecode) {
      return this.errorReceipt('deploy', null, 'Compile result has no bytecode');
    }
    const abiArr = (result.abi as AbiFunction[] | null) ?? [];
    if (abiArr.length === 0) {
      // Some contracts have no public functions (constructor-only).
      // We still allow deploy; the InteractionPanel will show "no actions".
    }

    const args = JSON.stringify({
      deployer: this.activeAccount,
      bytecode_hex: result.bytecode,
      constructor_args_hex: '0x',
    });

    let raw: WasmTxReceipt;
    try {
      raw = this.wasm.chain_deploy(args);
    } catch (e) {
      return this.errorReceipt('deploy', null, `Chain panicked: ${(e as Error).message}`);
    }

    const receipt = this.adaptReceipt(raw, abiArr);

    if (receipt.status === 'success' && receipt.to) {
      // Cache ABI + interface + name under the new contract address.
      const addr = receipt.to;
      this.abiByAddress.set(addr, abiArr);
      this.nameByAddress.set(addr, name);
      try {
        this.ifaceByAddress.set(addr, new Interface(abiArr as readonly unknown[] as []));
      } catch (e) {
        console.warn('[mockchain] ABI failed to parse for', addr, e);
      }
    }

    this.refresh();
    return receipt;
  }

  call(
    contractAddress: Address,
    actionName: string,
    args: unknown[],
  ): TxReceipt {
    if (!this.wasm) {
      return this.errorReceipt('call', contractAddress, 'WASM compiler not loaded yet', actionName, args);
    }
    const contract = this.contracts.get(contractAddress);
    if (!contract) {
      return this.errorReceipt('call', contractAddress, `No contract at ${contractAddress}`, actionName, args);
    }
    const fn = contract.abi.find((f) => f.name === actionName);
    if (!fn) {
      return this.errorReceipt('call', contractAddress, `Action "${actionName}" not in ABI`, actionName, args);
    }

    const iface = this.ifaceByAddress.get(contractAddress);
    if (!iface) {
      return this.errorReceipt('call', contractAddress, 'No interface cached for contract', actionName, args);
    }

    let calldata: string;
    try {
      calldata = iface.encodeFunctionData(actionName, args);
    } catch (e) {
      return this.errorReceipt('call', contractAddress, `ABI encode failed: ${(e as Error).message}`, actionName, args);
    }

    const isView = fn.stateMutability === 'view' || fn.stateMutability === 'pure';

    const argsJson = JSON.stringify({
      from: this.activeAccount,
      to: contractAddress,
      calldata_hex: calldata,
    });

    let raw: WasmTxReceipt;
    try {
      raw = isView ? this.wasm.chain_static_call(argsJson) : this.wasm.chain_call(argsJson);
    } catch (e) {
      return this.errorReceipt(isView ? 'view' : 'call', contractAddress, `Chain panicked: ${(e as Error).message}`, actionName, args);
    }

    const receipt = this.adaptReceipt(raw, contract.abi);
    receipt.kind = isView ? 'view' : 'call';
    receipt.action = actionName;
    receipt.args = args;

    // Decode return value if successful and we have output declarations.
    if (receipt.status === 'success' && raw.return_data && raw.return_data !== '0x' && fn.outputs && fn.outputs.length > 0) {
      try {
        const decoded = iface.decodeFunctionResult(actionName, raw.return_data);
        receipt.returnValue = decoded.length === 1 ? jsifyDecoded(decoded[0]) : decoded.map(jsifyDecoded);
      } catch (e) {
        // Decoding failed — keep raw bytes on the receipt for debugging.
        receipt.returnValue = raw.return_data;
        console.debug('[mockchain] return decode failed:', e);
      }
    }

    this.refresh();
    return receipt;
  }

  accountByAddress(address: Address): MockAccount | undefined {
    return this.accounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
  }

  // ─── Internals ──────────────────────────────────────────────────────

  /** Pull current chain state from WASM into the React-visible fields. */
  private refresh(): void {
    if (!this.wasm) return;

    const state = this.wasm.chain_get_state();
    this.clock = { blockNumber: state.block_number, timestamp: state.timestamp };

    const wasmAccounts = this.wasm.chain_get_accounts();
    this.accounts = wasmAccounts.map((a) => ({
      address: a.address as Address,
      label: a.label,
      balance: BigInt(a.balance),
    }));

    const wasmContracts = this.wasm.chain_get_contracts();
    const newContracts = new Map<Address, DeployedContract>();
    for (const c of wasmContracts) {
      const addr = c.address as Address;
      const abi = this.abiByAddress.get(addr) ?? [];
      newContracts.set(addr, {
        address: addr,
        deployer: c.deployer as Address,
        deployedAt: c.deployed_at_timestamp,
        abi,
        storage: {}, // queryable via wasm.chain_get_storage if needed
        name: this.nameByAddress.get(addr) ?? c.label ?? `contract@${shortAddress(addr)}`,
        runtimeBytecodeSize: c.runtime_bytecode_size,
      });
    }
    this.contracts = newContracts;

    // Tx log: most recent first, to match the legacy UI ordering.
    const wasmLog = this.wasm.chain_get_tx_log();
    this.txs = wasmLog
      .map((r) => {
        const abi = r.to ? this.abiByAddress.get(r.to as Address) ?? [] : [];
        return this.adaptReceipt(r, abi);
      })
      .reverse();
  }

  private adaptReceipt(raw: WasmTxReceipt, abi: AbiFunction[]): TxReceipt {
    const status: 'success' | 'reverted' = raw.status.status === 'success' ? 'success' : 'reverted';
    const revertReason =
      raw.status.status === 'reverted'
        ? raw.status.reason ?? undefined
        : raw.status.status === 'aborted'
          ? raw.status.reason
          : undefined;

    let kind: 'deploy' | 'call' | 'view';
    let action: string | undefined;
    if (raw.kind.type === 'deploy') {
      kind = 'deploy';
    } else if (raw.kind.type === 'call') {
      kind = 'call';
      action = lookupAction(abi, raw.kind.selector);
    } else {
      kind = 'view';
      action = lookupAction(abi, raw.kind.selector);
    }

    const events: MockEvent[] = raw.logs.map((l) => decodeEvent(l, abi));

    return {
      hash: raw.hash,
      blockNumber: raw.block_number,
      timestamp: raw.timestamp,
      from: raw.from as Address,
      to: (raw.to ?? null) as Address | null,
      kind,
      action,
      args: undefined,
      returnValue: undefined,
      gasUsed: BigInt(raw.gas_used),
      status,
      revertReason,
      events,
    };
  }

  private errorReceipt(
    kind: 'deploy' | 'call' | 'view',
    to: Address | null,
    reason: string,
    action?: string,
    args?: unknown[],
  ): TxReceipt {
    const r: TxReceipt = {
      hash: '0x' + '0'.repeat(64),
      blockNumber: this.clock.blockNumber,
      timestamp: this.clock.timestamp,
      from: this.activeAccount,
      to,
      kind,
      action,
      args,
      gasUsed: 0n,
      status: 'reverted',
      revertReason: reason,
      events: [],
    };
    this.txs = [r, ...this.txs];
    return r;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

const PREFUNDED_LABELS = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];
/** Matches `clock.rs::DEFAULT_GENESIS` (2026-01-01 00:00:00 UTC). */
const DEFAULT_GENESIS_TS = 1_767_225_600;

function lookupAction(abi: AbiFunction[], selectorHex: string): string | undefined {
  // Compute selectors lazily — most calls hit the cached interface.
  for (const entry of abi) {
    if (entry.type !== 'function') continue;
    const inputTypes = (entry.inputs ?? []).map((i) => i.type ?? 'uint256').join(',');
    const sig = `${entry.name}(${inputTypes})`;
    if (selectorMatches(sig, selectorHex)) {
      return entry.name;
    }
  }
  return undefined;
}

function selectorMatches(signature: string, hex: string): boolean {
  try {
    const iface = new Interface([`function ${signature}`]);
    const expected = iface.getFunction(signature.split('(')[0])?.selector;
    return expected !== undefined && expected.toLowerCase() === hex.toLowerCase();
  } catch {
    return false;
  }
}

function decodeEvent(log: WasmLogEvent, abi: AbiFunction[]): MockEvent {
  // Try each event entry in the ABI and see which topic0 matches.
  for (const entry of abi) {
    if ((entry as { type: string }).type !== 'event') continue;
    try {
      const iface = new Interface([entry as unknown as string]);
      // Best-effort match on topic0; if it works, decode the args.
      const fragment = iface.getEvent((entry as unknown as { name: string }).name);
      if (!fragment) continue;
      if (fragment.topicHash.toLowerCase() === log.topics[0]?.toLowerCase()) {
        const decoded = iface.decodeEventLog(fragment, log.data, log.topics);
        const args: Record<string, unknown> = {};
        decoded.forEach((v, i) => {
          args[String(i)] = jsifyDecoded(v);
        });
        return { name: fragment.name, args };
      }
    } catch {
      // Try the next event.
    }
  }
  // Unmatched: surface the raw topics + data so the UI shows something.
  return {
    name: 'UnknownEvent',
    args: { topics: log.topics, data: log.data },
  };
}

/**
 * Convert ethers' Result types into plain JS so consumers don't have
 * to depend on ethers internals. bigint stays bigint (the UI knows how
 * to render it via formatMockToken etc.).
 */
function jsifyDecoded(v: unknown): unknown {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map(jsifyDecoded);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) {
      if (!/^\d+$/.test(k)) out[k] = jsifyDecoded(val);
    }
    return out;
  }
  return v;
}

// ─── Module-local singleton + UI helpers ─────────────────────────────

let _instance: MockChain | null = null;
export function getMockChain(): MockChain {
  if (!_instance) {
    _instance = new MockChain();
    // Fire-and-forget init on first touch. Any subsequent operation
    // either runs against the loaded WASM (post-init) or returns a
    // clean "WASM unavailable" receipt (pre-init / load failure).
    void _instance.init();
  }
  return _instance;
}

export function shortAddress(a: Address | string | null | undefined): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function formatMockToken(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${frac}`;
}
