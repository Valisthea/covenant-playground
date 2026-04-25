/**
 * Thin TypeScript wrapper around the `covenant-wasm-bindings` module
 * shipped under `public/covenant-wasm/`.
 *
 * Sprint 22 wired the real compiler in: `compile_to_evm`, `check`,
 * `compile_to_ir_text`. This wrapper translates the binding's wire
 * shape (snake_case JsCompileResult, JsDiagnostic) into the
 * playground's `CompileResult` / `Diagnostic` types so every consumer
 * (Editor, Output, Inspector, Tour, Examples) keeps working without
 * its own per-component patch.
 *
 * The stub heuristics from the pre-Sprint-22 codebase are preserved as
 * a fallback path: if the WASM bundle fails to load (e.g. a serving
 * misconfig in CI, an IPV6-only proxy stripping `.wasm` MIME), the
 * playground degrades to the heuristic compiler instead of going dark.
 * Flip `FORCE_STUB` to `true` to opt into the stub deliberately for
 * local debugging.
 */

export const FORCE_STUB = false;

/**
 * Pre-Sprint-22 name kept as a public re-export so the rest of the
 * codebase doesn't break. `true` ⇔ we're running on the heuristic
 * stub (either by `FORCE_STUB` or because the WASM bundle failed to
 * load). Components can branch on this to hide bytecode-dependent UI.
 */
export let USE_STUB_COMPILER = FORCE_STUB;

import { synthesizeSourceMap, type SourceMap } from './source-map';
export type { SourceMap, InstructionMapping, SourceMapStats } from './source-map';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;           // 1-indexed
  column: number;         // 1-indexed
  endLine?: number;
  endColumn?: number;
  length?: number;
  code?: string;          // e.g. "E0421", "W701"
  spanStart?: number;     // raw byte offset, useful for jump-to-source
  spanEnd?: number;
}

export interface CompileMetadata {
  module_name?: string;
  exports?: string[];
  imports?: string[];
  memory_pages?: number;
  compiler_version?: string;
  [key: string]: unknown;
}

export interface CompileResult {
  ok: boolean;
  wasm: Uint8Array | null;
  metadata: CompileMetadata | null;
  diagnostics: Diagnostic[];

  /** Durations in ms for the UI status line. */
  timing: {
    total: number;
  };

  /**
   * Tier 1 only exposes WASM output. Bytecode/ABI/IR are plumbed through
   * the type here so the Output panes can render them when Tier 2+ wires
   * up the EVM backend bridge. For now they remain null.
   */
  bytecode: string | null;
  abi: unknown[] | null;
  ir: string | null;

  /**
   * Source map binding instructions back to their source location, with
   * gas/noise/constraint annotations. Currently synthesized on the JS side
   * (see `source-map.ts`); will be replaced by the real compiler output
   * once Sprint 20 Phase 20.1 lands in `covenant-wasm-bindings`.
   */
  sourceMap: SourceMap | null;
}

/**
 * Sprint 22 binding shape — see `covenant-wasm-bindings/covenant_wasm_bindings.d.ts`
 * for the source of truth. Mirrored here so the wrapper can be type-checked
 * without the bundle present at TS compile time.
 */
interface WasmDiagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  help: string | null;
  line: number;
  column: number;
  end_line: number;
  end_column: number;
  span_start: number;
  span_end: number;
}

interface WasmCompileResult {
  ok: boolean;
  target: 'evm';
  deploy_bytecode: string | null;
  runtime_bytecode: string | null;
  abi: string | null; // JSON-encoded ABI array
  function_selectors: { name: string; selector: string }[];
  storage_layout: unknown[];
  metadata: {
    covenant_version: string;
    optimizer_config: string;
    evm_version: string;
    erc_versions: Record<string, string>;
    precompile_abi_version: number;
  } | null;
  source_map: { mappings: { pc: number; source_line: number; source_column: number; instr_kind: string }[] } | null;
  diagnostics: WasmDiagnostic[];
  timing: { total: number };
}

interface WasmBinding {
  default(input?: RequestInfo | URL): Promise<unknown>;
  version(): string;
  compile_to_evm(source: string): WasmCompileResult;
  check(source: string): { diagnostics: WasmDiagnostic[]; timing: { total: number } };
  compile_to_ir_text(source: string): { ok: boolean; ir_text: string | null; diagnostics: WasmDiagnostic[]; timing: { total: number } };
}

let binding: WasmBinding | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Idempotent: the WASM module is loaded exactly once per page lifetime.
 * Multiple callers share the in-flight Promise. Subsequent awaits resolve
 * immediately.
 *
 * `Sprint 22` name. `initCompiler` kept as alias so the pre-Sprint-22
 * call sites keep compiling.
 */
export async function ensureCompilerLoaded(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (FORCE_STUB) {
      USE_STUB_COMPILER = true;
      initialized = true;
      return;
    }

    try {
      // Dynamic import so the stub path doesn't bundle the real module.
      // The wasm-pack output places `covenant_wasm_bindings.js` as an ES
      // module whose default export is the init() function. We point it
      // at the absolute URL of the .wasm so service-worker caching and
      // Vercel rewrites both behave correctly.
      const modulePath = '/covenant-wasm/covenant_wasm_bindings.js';
      const wasmUrl = new URL('/covenant-wasm/covenant_wasm_bindings_bg.wasm', window.location.origin);
      const module = (await import(/* @vite-ignore */ modulePath)) as WasmBinding;
      await module.default(wasmUrl);
      binding = module;
      initialized = true;
      USE_STUB_COMPILER = false;
      // eslint-disable-next-line no-console
      console.info('[covenant] compiler initialized:', binding.version());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[covenant] real WASM bindings unavailable, falling back to stub',
        err,
      );
      USE_STUB_COMPILER = true;
      initialized = true; // prevent infinite retries
    }
  })();

  return initPromise;
}

/** Pre-Sprint-22 name kept as alias. */
export const initCompiler = ensureCompilerLoaded;

export async function compile(source: string): Promise<CompileResult> {
  const started = performance.now();
  await ensureCompilerLoaded();

  if (binding && !USE_STUB_COMPILER) {
    return runRealCompile(source, started);
  }
  return runStubCompile(source, started);
}

/**
 * Frontend-only check. Returns just diagnostics + timing — no artifact.
 * Cheap enough to call on every Monaco keystroke if you want; use
 * `compile()` when you need bytecode.
 */
export async function checkOnly(source: string): Promise<{ diagnostics: Diagnostic[]; timing: { total: number } }> {
  await ensureCompilerLoaded();
  if (!binding || USE_STUB_COMPILER) {
    return {
      diagnostics: heuristicDiagnose(source),
      timing: { total: 0 },
    };
  }
  const r = binding.check(source);
  return {
    diagnostics: r.diagnostics.map((d) => adaptDiagnostic(d)),
    timing: r.timing,
  };
}

/**
 * Compile up to IR construction and return the IR as printable text.
 * Used by the Inspector's IR pane and (in Sprint 24+) the Layer
 * Explorer's "Show IR for this layer" button.
 */
export async function compileToIr(source: string): Promise<{ ok: boolean; ir: string | null; diagnostics: Diagnostic[]; timing: { total: number } }> {
  await ensureCompilerLoaded();
  if (!binding || USE_STUB_COMPILER) {
    const fallback = synthesizeIr(detectTopLevelKind(source), detectTopLevelName(source) ?? 'Contract', source);
    return { ok: true, ir: fallback, diagnostics: [], timing: { total: 0 } };
  }
  const r = binding.compile_to_ir_text(source);
  return {
    ok: r.ok,
    ir: r.ir_text,
    diagnostics: r.diagnostics.map((d) => adaptDiagnostic(d)),
    timing: r.timing,
  };
}

/**
 * Direct access to the underlying binding for the chain runtime
 * (mockchain.ts) — avoids each module having to dynamically import
 * the same .wasm twice. Returns `null` if init failed and we're in
 * stub mode; callers should treat that as "chain ops unavailable".
 */
export async function getWasmBinding(): Promise<WasmBinding | null> {
  await ensureCompilerLoaded();
  return USE_STUB_COMPILER ? null : binding;
}

function runRealCompile(source: string, started: number): CompileResult {
  if (!binding) {
    throw new Error('compiler not initialized');
  }
  try {
    const raw = binding.compile_to_evm(source);
    const diagnostics = raw.diagnostics.map((d) => adaptDiagnostic(d));

    // ABI is shipped as a JSON-encoded string by the EVM backend.
    // Parse it once here so consumers see a real array.
    let abi: unknown[] | null = null;
    if (raw.abi) {
      try {
        const parsed = JSON.parse(raw.abi);
        abi = Array.isArray(parsed) ? parsed : null;
      } catch {
        abi = null;
      }
    }

    // Build a CompileMetadata-shaped view from the real metadata so
    // existing UI code (Output > Metadata pane) keeps working.
    const metadata: CompileMetadata | null = raw.metadata
      ? {
          module_name: detectTopLevelName(source) ?? undefined,
          exports: raw.function_selectors.map((s) => s.name),
          imports: undefined,
          memory_pages: undefined,
          compiler_version: raw.metadata.covenant_version,
          evm_version: raw.metadata.evm_version,
          optimizer_config: raw.metadata.optimizer_config,
          erc_versions: raw.metadata.erc_versions,
          precompile_abi_version: raw.metadata.precompile_abi_version,
          function_selectors: raw.function_selectors,
        }
      : null;

    // Convert the WASM source map (which carries pc + instr_kind) into
    // the playground's existing `SourceMap` shape (line/col + opcode +
    // gas/noise placeholders) by reusing `synthesizeSourceMap` for the
    // gas/noise heuristics. The compiler doesn't yet emit those, so the
    // synthesized values stay until they do.
    const sourceMap = raw.ok ? synthesizeSourceMap(source) : null;

    return {
      ok: raw.ok,
      // EVM target doesn't produce a wasm bytecode blob; the field
      // stays null. The "Bytecode" pane reads `bytecode` (string hex)
      // not `wasm` (Uint8Array).
      wasm: null,
      metadata,
      diagnostics,
      timing: { total: raw.timing.total },
      bytecode: raw.deploy_bytecode,
      abi,
      ir: null,
      sourceMap,
    };
  } catch (e) {
    return {
      ok: false,
      wasm: null,
      metadata: null,
      diagnostics: [
        {
          severity: 'error',
          message: `Compiler panicked: ${(e as Error).message}`,
          line: 1,
          column: 1,
          code: 'ICE',
        },
      ],
      timing: { total: performance.now() - started },
      bytecode: null,
      abi: null,
      ir: null,
      sourceMap: null,
    };
  }
}

/** Convert a WASM `JsDiagnostic` into the playground's `Diagnostic`. */
function adaptDiagnostic(d: WasmDiagnostic): Diagnostic {
  const length = Math.max(1, d.span_end - d.span_start);
  return {
    severity: d.level,
    message: d.message + (d.help ? ` — ${d.help}` : ''),
    line: d.line,
    column: d.column,
    endLine: d.end_line,
    endColumn: d.end_column,
    length,
    code: d.code,
    spanStart: d.span_start,
    spanEnd: d.span_end,
  };
}

// ---------------------------------------------------------------------------
// Stub compiler
// ---------------------------------------------------------------------------
//
// Returns realistic-looking results so that every downstream UI path — tabs,
// markers, timing, success/failure styling — can be exercised with zero
// external dependencies. It's heuristic-based: we look for obvious shapes
// (`token`, `record`, missing braces) and synthesize diagnostics + a fake
// metadata blob. The bytes we report as "wasm" are a valid-ish WASM module
// header so the Bytecode pane has something to display.

function runStubCompile(source: string, started: number): CompileResult {
  const diagnostics = heuristicDiagnose(source);

  const hasError = diagnostics.some((d) => d.severity === 'error');
  if (hasError) {
    return {
      ok: false,
      wasm: null,
      metadata: null,
      diagnostics,
      timing: { total: performance.now() - started },
      bytecode: null,
      abi: null,
      ir: null,
      sourceMap: null,
    };
  }

  // Minimal valid WASM module (magic + version + empty sections).
  const wasm = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // \0asm
    0x01, 0x00, 0x00, 0x00, //  v1
  ]);

  const kind = detectTopLevelKind(source);
  const name = detectTopLevelName(source) ?? 'Contract';

  const metadata: CompileMetadata = {
    module_name: name,
    exports: synthesizeExports(kind, source),
    imports: ['env.storage_read', 'env.storage_write', 'env.emit_event'],
    memory_pages: 1,
    compiler_version: '0.8.0-stub',
  };

  // Pretty fake hex dump so the Bytecode pane renders something.
  const bytecode =
    '0x' +
    Array.from(wasm)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    ok: true,
    wasm,
    metadata,
    diagnostics,
    timing: { total: performance.now() - started },
    bytecode,
    abi: synthesizeAbi(kind, source),
    ir: synthesizeIr(kind, name, source),
    sourceMap: synthesizeSourceMap(source),
  };
}

function heuristicDiagnose(source: string): Diagnostic[] {
  const diags: Diagnostic[] = [];

  // Bracket balance — a common early error, cheap to detect.
  let depth = 0;
  let lastOpen = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '{') {
      depth++;
      lastOpen = i;
    } else if (c === '}') depth--;
  }
  if (depth > 0) {
    const { line, column } = offsetToLineCol(source, lastOpen);
    diags.push({
      severity: 'error',
      message: 'Unmatched `{` — expected a closing `}` at end of declaration.',
      line,
      column,
      length: 1,
      code: 'E0101',
      spanStart: lastOpen,
      spanEnd: lastOpen + 1,
    });
  }
  if (depth < 0) {
    diags.push({
      severity: 'error',
      message: 'Stray `}` — no matching opening brace.',
      line: 1,
      column: 1,
      length: 1,
      code: 'E0102',
    });
  }

  // Empty source
  if (source.trim().length === 0) {
    diags.push({
      severity: 'info',
      message: 'Empty source — nothing to compile.',
      line: 1,
      column: 1,
      code: 'I0001',
    });
  }

  // "Coming soon" warning for any @precompute use — reflects W701 in real compiler.
  const preIdx = source.indexOf('@precompute');
  if (preIdx >= 0) {
    const { line, column } = offsetToLineCol(source, preIdx);
    diags.push({
      severity: 'warning',
      message:
        '@precompute: no pure-expression body detected. The optimizer will skip this annotation.',
      line,
      column,
      length: '@precompute'.length,
      code: 'W701',
      spanStart: preIdx,
      spanEnd: preIdx + '@precompute'.length,
    });
  }

  return diags;
}

function detectTopLevelKind(source: string): string {
  const kinds = [
    'record',
    'token',
    'ballot',
    'vault',
    'registry',
    'board',
    'market',
    'bridge',
    'ceremony',
    'contract',
  ];
  for (const k of kinds) {
    const re = new RegExp(`\\b${k}\\s+[A-Z]`, 'm');
    if (re.test(source)) return k;
  }
  return 'record';
}

function detectTopLevelName(source: string): string | null {
  const m = source.match(
    /\b(?:record|token|ballot|vault|registry|board|market|bridge|ceremony|contract)\s+([A-Z][\w]*)/m,
  );
  return m?.[1] ?? null;
}

function synthesizeExports(kind: string, source: string): string[] {
  const base = ['__init', 'main'];
  if (kind === 'token') {
    return [
      ...base,
      'transfer',
      'approve',
      'transfer_from',
      'balance_of',
      'allowance',
      'total_supply',
    ];
  }
  if (kind === 'ballot') return [...base, 'open', 'cast', 'tally', 'close'];
  if (kind === 'vault') return [...base, 'deposit', 'withdraw', 'balance'];
  if (kind === 'ceremony')
    return [...base, 'setup', 'contribute', 'finalize', 'destroy'];
  // Record — scan for action/view declarations
  const actions = Array.from(
    source.matchAll(/\b(?:action|view|reveal)\s+([a-z_][\w]*)/g),
  ).map((m) => m[1]);
  return [...base, ...actions];
}

function synthesizeAbi(kind: string, source: string): unknown[] {
  const fns = synthesizeExports(kind, source).filter(
    (n) => n !== '__init' && n !== 'main',
  );
  return fns.map((name) => ({
    type: 'function',
    name,
    inputs: [],
    outputs: [],
    stateMutability: name.startsWith('view_') || name === 'balance_of' ? 'view' : 'nonpayable',
  }));
}

function synthesizeIr(kind: string, name: string, source: string): string {
  const actions = Array.from(
    source.matchAll(/\b(?:action|view|reveal)\s+([a-z_][\w]*)/g),
  ).map((m) => m[1]);
  const lines = [
    `// Covenant IR — synthesized stub output`,
    `// kind: ${kind}`,
    `// module: ${name}`,
    ``,
    `module ${name} {`,
    `  field _storage: map<hash, bytes>`,
    ...actions.map((a) => `  action ${a}() { /* ... */ }`),
    `}`,
    ``,
    `// Real IR will be emitted once covenant-wasm-bindings is wired up.`,
    `// See docs.covenant-lang.org/reference/compiler/02-ir`,
  ];
  return lines.join('\n');
}

// Sprint 22 deprecated `mapDiagnostic` and `formatDiagCode`: the WASM
// bindings now ship line/column + a pre-formatted `code` string in the
// JsDiagnostic shape. The `adaptDiagnostic` helper above does the
// translation in one step. The byte-offset-to-line-col helper below
// stays — `synthesizeSourceMap` and the heuristic stub still use it.

/**
 * Utility: byte offset -> { line, column } (both 1-indexed).
 * Works in constant time per call for the UI's realistic input sizes
 * (a few KB of Covenant source).
 */
export function offsetToLineCol(
  source: string,
  offset: number,
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}
