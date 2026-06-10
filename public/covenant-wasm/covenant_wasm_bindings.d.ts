/* tslint:disable */
/* eslint-disable */

/**
 * Move the chain clock forward by `seconds`.
 */
export function chain_advance_time(seconds: bigint): void;

/**
 * State-mutating call.
 */
export function chain_call(args_json: string): any;

/**
 * Deploy a contract. Returns a `TxReceipt` JSON object.
 */
export function chain_deploy(args_json: string): any;

export function chain_get_accounts(): any;

export function chain_get_contracts(): any;

/**
 * Block number, timestamp, contract count, account count, tx count.
 * Sized for the playground's status bar — refresh on every UI tick.
 */
export function chain_get_state(): any;

/**
 * Read a storage slot directly. Useful for the Inspector's "Storage
 * inspector" sub-pane.
 */
export function chain_get_storage(address_hex: string, slot_hex: string): any;

export function chain_get_tx_log(): any;

/**
 * Reset the chain to genesis: 5 prefunded accounts, no deployments,
 * block 1, clock at `DEFAULT_GENESIS`.
 */
export function chain_init(): void;

/**
 * Mine `count` blocks. Each block also bumps the clock by 12s.
 */
export function chain_mine_blocks(count: bigint): void;

/**
 * Alias for `chain_init`. The playground's UI uses "Reset", the
 * underlying op is identical — having both names lets the JS side
 * pick whichever reads better at the call site.
 */
export function chain_reset(): void;

/**
 * Read-only call. Storage changes are dropped, no receipt is appended
 * to the chain's tx_log. The returned `TxReceipt` carries the raw
 * return data hex for the playground's view-action UI to decode.
 */
export function chain_static_call(args_json: string): any;

/**
 * Run only frontend stages (lex → parse → resolve → typecheck →
 * privacy). Cheap enough for keystroke-rate calls; used by Monaco's
 * live diagnostics.
 */
export function check(source: string): any;

/**
 * Compile a Covenant source string targeting EVM bytecode.
 *
 * Backward-compatible V0.8 entry point: defaults to `mockchain` target.
 * New code should call [`compile_to_evm_for_target`] explicitly.
 *
 * Returns a JS object matching the `JsCompileResult` schema.
 * Panics are caught by `console_error_panic_hook` and surface as
 * JS exceptions; the playground catches those and shows a generic
 * "internal compiler error" diagnostic.
 */
export function compile_to_evm(source: string): any;

/**
 * Compile a Covenant source string targeting EVM bytecode with an
 * explicit chain target (V0.9, Sprint 31).
 *
 * `target` accepts:
 *   - `"mockchain"` / `"mock"` / `"evm"` → V0.8 in-tab MockChain
 *   - `"sepolia"`                        → V0.9 helpers on Sepolia
 *   - `"aster_testnet"`                  → V0.9 helpers on Aster Testnet
 *   - `"mainnet"`                        → REJECTED (single E601 diag)
 *
 * The playground's Chain Target dropdown should call this for any
 * non-MockChain target; MockChain can use the parameterless
 * [`compile_to_evm`] for backward compat.
 */
export function compile_to_evm_for_target(source: string, target: string): any;

/**
 * Compile up to IR construction and return the IR as printable text.
 * Used by the Inspector and Layer Explorer panes.
 */
export function compile_to_ir_text(source: string): any;

/**
 * Diagnostic-code → prose-explanation table. Reserved surface;
 * returns `[]` until the compiler's diagnostic registry exposes
 * long-form explanations (filed in DEBT.md as "diagnostic prose
 * registry").
 */
export function diagnostic_explanations(): any;

/**
 * Initialize the WASM module. Wires up the panic hook (when the
 * `panic-hook` feature is enabled) so that Rust panics surface as
 * readable JS exceptions in the browser console.
 */
export function init(): void;

/**
 * Compiler version, e.g. `"0.8.2"`.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly chain_call: (a: number, b: number) => any;
    readonly chain_deploy: (a: number, b: number) => any;
    readonly chain_get_storage: (a: number, b: number, c: number, d: number) => any;
    readonly chain_static_call: (a: number, b: number) => any;
    readonly chain_mine_blocks: (a: bigint) => void;
    readonly chain_get_state: () => any;
    readonly chain_get_tx_log: () => any;
    readonly chain_advance_time: (a: bigint) => void;
    readonly chain_get_accounts: () => any;
    readonly chain_get_contracts: () => any;
    readonly chain_init: () => void;
    readonly chain_reset: () => void;
    readonly check: (a: number, b: number) => any;
    readonly compile_to_evm: (a: number, b: number) => any;
    readonly compile_to_evm_for_target: (a: number, b: number, c: number, d: number) => any;
    readonly compile_to_ir_text: (a: number, b: number) => any;
    readonly diagnostic_explanations: () => any;
    readonly init: () => void;
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
