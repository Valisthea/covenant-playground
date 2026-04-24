/**
 * MockChain — in-memory Covenant execution simulator for the playground.
 *
 * This is NOT a real EVM. Covenant compiles to WASM, so when the real
 * `covenant-wasm-bindings` module lands this file grows an executor that
 * instantiates each deployed contract's wasm and routes action calls
 * through it. Until then, MockChain is a *semantic simulator*: it takes
 * the ABI + metadata produced by the stub compiler and synthesises
 * plausible state transitions so the whole Deploy / Interact / History
 * pipeline can be UI-tested end-to-end.
 *
 * Design notes
 * ------------
 * - Deterministic: every action produces the same result given the
 *   same inputs + state. No Math.random(), no Date.now() in the execution
 *   path — use `chain.clock` instead.
 * - Time-travel: `advanceTime(seconds)` and `mineBlocks(n)` advance the
 *   shared clock, so examples that gate on `block.timestamp` (auctions,
 *   locks, ceremonies) can be demoed.
 * - Events: each action writes a structured event to the tx receipt,
 *   derived from the action name + its arguments.
 * - Accounts: 5 pre-funded `0xAAAA…0001` through `0xAAAA…0005` accounts.
 *   The "active" account is the `msg.sender` for subsequent calls.
 */

import type { CompileResult } from './covenant-compiler';

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
  to: Address | null; // null for deploy
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
  /** ABI copied from the CompileResult at deploy time. */
  abi: AbiFunction[];
  /** Contract-local state: map<slot, value>. Arbitrary — MockChain
   *  interprets actions without understanding storage layout. */
  storage: Record<string, unknown>;
  /** Label to show in the UI. */
  name: string;
}

export interface AbiFunction {
  type: 'function';
  name: string;
  inputs: { name?: string; type?: string }[];
  outputs: { name?: string; type?: string }[];
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
}

// ---------------------------------------------------------------------------
// Public MockChain API
// ---------------------------------------------------------------------------

export class MockChain {
  public accounts: MockAccount[];
  public activeAccount: Address;
  public contracts: Map<Address, DeployedContract> = new Map();
  public txs: TxReceipt[] = [];
  public clock = { blockNumber: 1, timestamp: Math.floor(Date.now() / 1000) };

  private nextContractNonce = 0;
  private nextTxNonce = 0;

  constructor() {
    this.accounts = [
      mkAccount('0xAAAA000000000000000000000000000000000001', 'Alice'),
      mkAccount('0xAAAA000000000000000000000000000000000002', 'Bob'),
      mkAccount('0xAAAA000000000000000000000000000000000003', 'Carol'),
      mkAccount('0xAAAA000000000000000000000000000000000004', 'Dave'),
      mkAccount('0xAAAA000000000000000000000000000000000005', 'Eve'),
    ];
    this.activeAccount = this.accounts[0].address;
  }

  setActiveAccount(address: Address): void {
    if (!this.accounts.some((a) => a.address === address)) {
      throw new Error(`Unknown account ${address}`);
    }
    this.activeAccount = address;
  }

  mineBlocks(n: number): void {
    if (n < 1) return;
    this.clock.blockNumber += Math.floor(n);
    this.clock.timestamp += Math.floor(n) * 12; // nominal 12s block
  }

  advanceTime(seconds: number): void {
    if (seconds < 1) return;
    this.clock.timestamp += Math.floor(seconds);
    this.clock.blockNumber += 1;
  }

  reset(): void {
    this.contracts.clear();
    this.txs = [];
    this.nextContractNonce = 0;
    this.nextTxNonce = 0;
    this.clock = { blockNumber: 1, timestamp: Math.floor(Date.now() / 1000) };
    this.accounts = this.accounts.map((a) => ({ ...a, balance: 10_000n ** 1n * 10n ** 18n }));
    this.activeAccount = this.accounts[0].address;
  }

  deploy(result: CompileResult, name: string): TxReceipt {
    if (!result.ok) {
      return this.revertedTx({
        from: this.activeAccount,
        to: null,
        kind: 'deploy',
        revertReason: 'Compile errors present — cannot deploy',
      });
    }
    if (!result.abi) {
      return this.revertedTx({
        from: this.activeAccount,
        to: null,
        kind: 'deploy',
        revertReason: 'Compile result has no ABI',
      });
    }

    const address = this.mintContractAddress();
    const abi = result.abi as AbiFunction[];

    this.contracts.set(address, {
      address,
      deployer: this.activeAccount,
      deployedAt: this.clock.timestamp,
      abi,
      storage: {},
      name,
    });

    this.mineBlocks(1);
    return this.recordTx({
      from: this.activeAccount,
      to: address,
      kind: 'deploy',
      gasUsed: 450_000n + BigInt(abi.length * 8_000),
      events: [{ name: 'ContractDeployed', args: { name, address } }],
    });
  }

  /**
   * Execute a contract action or view. The simulator doesn't parse the
   * arguments; they're stored verbatim and echoed in the receipt. When
   * real WASM execution lands this routes to the instantiated module.
   */
  call(
    contractAddress: Address,
    actionName: string,
    args: unknown[],
  ): TxReceipt {
    const contract = this.contracts.get(contractAddress);
    if (!contract) {
      return this.revertedTx({
        from: this.activeAccount,
        to: contractAddress,
        kind: 'call',
        action: actionName,
        args,
        revertReason: `No contract at ${contractAddress}`,
      });
    }
    const fn = contract.abi.find((f) => f.name === actionName);
    if (!fn) {
      return this.revertedTx({
        from: this.activeAccount,
        to: contractAddress,
        kind: 'call',
        action: actionName,
        args,
        revertReason: `Action "${actionName}" not in ABI`,
      });
    }

    const isView = fn.stateMutability === 'view' || fn.stateMutability === 'pure';

    if (isView) {
      // Views never mine a block or mutate state.
      return this.recordTx({
        from: this.activeAccount,
        to: contractAddress,
        kind: 'view',
        action: actionName,
        args,
        returnValue: this.synthesizeReturn(contract, fn, args),
        gasUsed: 0n,
        events: [],
      });
    }

    // Mutating call: mutate simulator storage in a plausible way so
    // subsequent views show different data.
    this.applyMutation(contract, fn, args);
    this.mineBlocks(1);

    return this.recordTx({
      from: this.activeAccount,
      to: contractAddress,
      kind: 'call',
      action: actionName,
      args,
      gasUsed: 45_000n + BigInt(JSON.stringify(args).length * 16),
      events: [
        {
          name: actionName.replace(/^./, (c) => c.toUpperCase()) + 'Called',
          args: { caller: this.activeAccount, count: this.txs.length + 1 },
        },
      ],
    });
  }

  accountByAddress(address: Address): MockAccount | undefined {
    return this.accounts.find((a) => a.address === address);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private mintContractAddress(): Address {
    const n = ++this.nextContractNonce;
    // Deterministic-looking 20-byte hex address derived from nonce so the
    // UI shows consistent addresses across re-deploys in a session.
    const suffix = n.toString(16).padStart(8, '0');
    return `0xC0FFEE${'00'.repeat(9)}${suffix}` as Address;
  }

  private mintTxHash(): string {
    const n = ++this.nextTxNonce;
    // Fake keccak-shaped hash.
    return `0x${'tx'.padStart(6, '0')}${n
      .toString(16)
      .padStart(58, '0')}`.slice(0, 66);
  }

  private recordTx(
    partial: Omit<TxReceipt, 'hash' | 'blockNumber' | 'timestamp' | 'status'>,
  ): TxReceipt {
    const rec: TxReceipt = {
      ...partial,
      hash: this.mintTxHash(),
      blockNumber: this.clock.blockNumber,
      timestamp: this.clock.timestamp,
      status: 'success',
    };
    this.txs = [rec, ...this.txs];
    return rec;
  }

  private revertedTx(
    partial: Omit<
      TxReceipt,
      'hash' | 'blockNumber' | 'timestamp' | 'status' | 'gasUsed' | 'events'
    > & { gasUsed?: bigint; events?: MockEvent[] },
  ): TxReceipt {
    const rec: TxReceipt = {
      ...partial,
      gasUsed: partial.gasUsed ?? 21_000n,
      events: partial.events ?? [],
      hash: this.mintTxHash(),
      blockNumber: this.clock.blockNumber,
      timestamp: this.clock.timestamp,
      status: 'reverted',
    };
    this.txs = [rec, ...this.txs];
    return rec;
  }

  private applyMutation(
    contract: DeployedContract,
    fn: AbiFunction,
    args: unknown[],
  ): void {
    // Use a predictable slot key per action so re-calling the same
    // action replaces rather than appends. This is deliberately naive —
    // real execution will come from the wasm module.
    const slot = `action:${fn.name}:lastArgs`;
    contract.storage[slot] = args;
    contract.storage[`action:${fn.name}:callCount`] =
      ((contract.storage[`action:${fn.name}:callCount`] as number) ?? 0) + 1;
    contract.storage[`action:${fn.name}:lastCaller`] = this.activeAccount;
    contract.storage[`action:${fn.name}:lastBlock`] = this.clock.blockNumber;
  }

  private synthesizeReturn(
    contract: DeployedContract,
    fn: AbiFunction,
    args: unknown[],
  ): unknown {
    // If we've seen a prior mutation with the same name (minus a `view_`
    // or `read_` prefix), echo what was stored. Otherwise return a
    // plausible zero-value based on the action name.
    const candidateSlot =
      Object.keys(contract.storage).find((k) =>
        k.startsWith(`action:${stripPrefix(fn.name)}:lastArgs`),
      ) ??
      Object.keys(contract.storage).find((k) => k.startsWith('action:'));

    if (candidateSlot) {
      const val = contract.storage[candidateSlot];
      if (val !== undefined) return val;
    }

    // Heuristic defaults per common action names.
    const n = fn.name.toLowerCase();
    if (n.includes('balance')) return '0';
    if (n.includes('supply') || n.includes('total')) return '0';
    if (n.includes('owner') || n.includes('admin'))
      return contract.deployer;
    if (n.includes('read') || n.includes('get')) return '';
    if (n.includes('is') || n.includes('has')) return false;

    // Fall back to echoing args so views that were just written return
    // something meaningful in the UI.
    return args.length === 1 ? args[0] : args;
  }
}

// ---------------------------------------------------------------------------
// Module-local singleton + helpers
// ---------------------------------------------------------------------------

let _instance: MockChain | null = null;
export function getMockChain(): MockChain {
  if (!_instance) _instance = new MockChain();
  return _instance;
}

function mkAccount(address: string, label: string): MockAccount {
  return {
    address: address as Address,
    label,
    balance: 10_000n * 10n ** 18n, // 10,000 MOCK
  };
}

function stripPrefix(name: string): string {
  return name.replace(/^(view_|read_|get_)/, '');
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
