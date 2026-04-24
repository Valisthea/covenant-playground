/**
 * Thin TypeScript wrapper around the `covenant-wasm-bindings` npm module.
 *
 * The real module is produced by running:
 *
 *   wasm-pack build --target web \
 *     --out-dir ../../../covenant-playground/public/covenant-wasm \
 *     covenant-src/crates/covenant-wasm-bindings
 *
 * Until that output exists the wrapper operates in STUB MODE and
 * synthesizes CompileResult objects so the IDE's UI pipeline (Monaco
 * markers, output panes, compile-on-save) is fully exercisable without
 * a working WASM toolchain. Flip `USE_STUB_COMPILER` to `false` once
 * the real module is in place.
 *
 * The live binding surface (from `covenant-wasm-bindings/src/lib.rs`):
 *
 *   export function compile_source(source: string): {
 *     ok: boolean;
 *     wasm: Uint8Array | null;
 *     metadata: string | null;           // JSON string, parsed client-side
 *     diagnostics: {
 *       level: 'error' | 'warning' | 'note';
 *       code: number;
 *       message: string;
 *       span_start: number;
 *       span_end: number;
 *     }[];
 *   }
 */

export const USE_STUB_COMPILER = true;

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

interface WasmBinding {
  compile_source(source: string): {
    ok: boolean;
    wasm: Uint8Array | null;
    metadata: string | null;
    diagnostics: {
      level: 'error' | 'warning' | 'note';
      code: number;
      message: string;
      span_start: number;
      span_end: number;
    }[];
  };
  version(): string;
}

let binding: WasmBinding | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initCompiler(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (USE_STUB_COMPILER) {
      initialized = true;
      return;
    }

    try {
      // Dynamic import so the stub path doesn't bundle the real module.
      // The wasm-pack output places `covenant_wasm_bindings.js` as an ES
      // module that accepts an optional wasm URL override.
      //
      // `/* @vite-ignore */` tells Rollup's static analyzer to skip this
      // import at build time — the file only exists at runtime after
      // `wasm-pack build` has populated public/covenant-wasm/.
      const modulePath = '/covenant-wasm/covenant_wasm_bindings.js';
      const module = await import(/* @vite-ignore */ modulePath);
      await module.default(); // default export = init()
      binding = module as unknown as WasmBinding;
      initialized = true;
      // eslint-disable-next-line no-console
      console.info('[covenant] compiler initialized:', binding.version());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[covenant] real WASM bindings unavailable, falling back to stub',
        err,
      );
      initialized = true; // prevent infinite retries
    }
  })();

  return initPromise;
}

export async function compile(source: string): Promise<CompileResult> {
  const started = performance.now();
  await initCompiler();

  if (binding && !USE_STUB_COMPILER) {
    return runRealCompile(source, started);
  }
  return runStubCompile(source, started);
}

function runRealCompile(source: string, started: number): CompileResult {
  if (!binding) {
    throw new Error('compiler not initialized');
  }
  try {
    const raw = binding.compile_source(source);
    const diagnostics = raw.diagnostics.map((d) =>
      mapDiagnostic(source, d.level, d.message, d.span_start, d.span_end, d.code),
    );
    let metadata: CompileMetadata | null = null;
    if (raw.metadata) {
      try {
        metadata = JSON.parse(raw.metadata) as CompileMetadata;
      } catch {
        metadata = null;
      }
    }
    return {
      ok: raw.ok,
      wasm: raw.wasm,
      metadata,
      diagnostics,
      timing: { total: performance.now() - started },
      bytecode: null,
      abi: null,
      ir: null,
      // Until the real binding emits source maps we synthesize from source
      sourceMap: raw.ok ? synthesizeSourceMap(source) : null,
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

/**
 * Map a raw diagnostic from the WASM binding (byte-offset spans) into
 * the playground's Diagnostic shape (line/column + severity + code).
 */
function mapDiagnostic(
  source: string,
  level: 'error' | 'warning' | 'note',
  message: string,
  spanStart: number,
  spanEnd: number,
  code: number,
): Diagnostic {
  const { line, column } = offsetToLineCol(source, spanStart);
  const end = offsetToLineCol(source, spanEnd);
  return {
    severity: level === 'note' ? 'info' : level,
    message,
    line,
    column,
    endLine: end.line,
    endColumn: end.column,
    length: Math.max(1, spanEnd - spanStart),
    code: formatDiagCode(level, code),
    spanStart,
    spanEnd,
  };
}

function formatDiagCode(
  level: 'error' | 'warning' | 'note',
  code: number,
): string {
  const prefix = level === 'error' ? 'E' : level === 'warning' ? 'W' : 'I';
  return `${prefix}${String(code).padStart(4, '0')}`;
}

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
