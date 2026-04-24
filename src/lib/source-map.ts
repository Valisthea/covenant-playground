/**
 * Source-map synthesizer (Sprint 20).
 *
 * The Covenant compiler binding currently runs in stub mode (see
 * `covenant-compiler.ts`) so it does not yet emit per-instruction source
 * spans. This module fills the gap by walking the source text and
 * producing a plausible `SourceMap` — the same shape the real Rust
 * backend will emit once Phase 20.1 of the compiler is done.
 *
 * Heuristics, not parsing:
 *  - Each `field`/`action`/`view`/`emit`/`require`/FHE-op/ZK-op produces
 *    an InstructionMapping with synthetic gas/noise/constraint values
 *    derived from a small lookup table. Numbers are realistic-ish — they
 *    line up with public ERC-8227 and Wesolowski VDF benchmarks — but
 *    they are estimates, never exact.
 *
 * When the real compiler exposes spans, swap `synthesizeSourceMap()` for
 * a thin adapter over the WASM `source_map()` call. The InstructionMapping
 * shape is fixed for that exact reason.
 */

export type Opcode =
  | 'StorageLoad'
  | 'StorageStore'
  | 'EmitEvent'
  | 'Require'
  | 'Call'
  | 'Return'
  | 'FhePackage'
  | 'FheAdd'
  | 'FheSub'
  | 'FheMul'
  | 'FheGt'
  | 'FheLt'
  | 'FheEq'
  | 'FheSelect'
  | 'FheEncrypt'
  | 'FheDecrypt'
  | 'ZkVerify'
  | 'ZkProve'
  | 'PqVerify'
  | 'CeremonyDestroy'
  | 'TokenTransfer'
  | 'TokenMint'
  | 'TokenBurn'
  | 'BallotCast'
  | 'BallotTally'
  | 'TimeLoad'
  | 'AddressLoad'
  | 'Arith'
  | 'Branch'
  | 'Synthetic';

/**
 * Single mapping from an IR instruction back to a source location.
 * Mirrors the `InstructionMapping` produced by `covenant-wasm-bindings`
 * when the real compiler exposes source maps.
 */
export interface InstructionMapping {
  irIndex: number;
  opcode: Opcode;
  opcodeName: string;

  // Source location (1-indexed line/column)
  sourceLine: number;
  sourceColumn: number;
  sourceLength: number;

  // Backend offsets (null when not lowered to that backend)
  evmOffset: number | null;
  wasmOffset: number | null;

  // Cost annotations
  gasEstimateL1: number;     // EVM L1 gas
  gasEstimatePgas: number;   // Precompile gas (FHE / ZK)
  noiseBudget: number | null;     // 0..100, % of FHE noise budget consumed
  constraintCount: number | null; // ZK circuit constraints
}

export interface SourceMapStats {
  totalInstructions: number;
  totalSourceLines: number;
  fheOperations: number;
  zkOperations: number;
  totalGasL1: number;
  totalGasPgas: number;
  totalConstraints: number;
}

export interface SourceMap {
  instructions: InstructionMapping[];
  stats: SourceMapStats;
  /** Indicates this map was synthesized from regex, not emitted by Rust. */
  synthetic: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Cost tables
// ────────────────────────────────────────────────────────────────────────────

/**
 * Static gas / noise / constraint estimates per opcode.
 *
 * Numbers are public-record ballparks:
 *  - SSTORE/SLOAD from EVM yellowpaper
 *  - FHE costs from ERC-8227 + Zama TFHE bench notes
 *  - ZK constraint counts from Aztec's Noir benchmarks
 *  - VDF cost from ERC-8228 reference (Wesolowski 1024-bit)
 */
const COST_TABLE: Record<
  Opcode,
  {
    gasL1: number;
    gasPgas: number;
    noiseDelta: number | null;
    constraints: number | null;
  }
> = {
  StorageLoad: { gasL1: 2_100, gasPgas: 0, noiseDelta: null, constraints: null },
  StorageStore: { gasL1: 22_100, gasPgas: 0, noiseDelta: null, constraints: null },
  EmitEvent: { gasL1: 1_750, gasPgas: 0, noiseDelta: null, constraints: null },
  Require: { gasL1: 30, gasPgas: 0, noiseDelta: null, constraints: null },
  Call: { gasL1: 700, gasPgas: 0, noiseDelta: null, constraints: null },
  Return: { gasL1: 5, gasPgas: 0, noiseDelta: null, constraints: null },

  // FHE — pgas dominates, L1 only covers the precompile call wrapper
  FhePackage: { gasL1: 200, gasPgas: 1_500, noiseDelta: null, constraints: null },
  FheAdd: { gasL1: 200, gasPgas: 18_000, noiseDelta: 1.5, constraints: null },
  FheSub: { gasL1: 200, gasPgas: 18_000, noiseDelta: 1.5, constraints: null },
  FheMul: { gasL1: 200, gasPgas: 240_000, noiseDelta: 12, constraints: null },
  FheGt: { gasL1: 200, gasPgas: 95_000, noiseDelta: 8, constraints: null },
  FheLt: { gasL1: 200, gasPgas: 95_000, noiseDelta: 8, constraints: null },
  FheEq: { gasL1: 200, gasPgas: 90_000, noiseDelta: 7, constraints: null },
  FheSelect: { gasL1: 200, gasPgas: 60_000, noiseDelta: 4, constraints: null },
  FheEncrypt: { gasL1: 200, gasPgas: 4_500, noiseDelta: 0, constraints: null },
  FheDecrypt: { gasL1: 200, gasPgas: 12_000, noiseDelta: null, constraints: null },

  // ZK — pgas covers proof verification; constraint count is per-proof
  ZkVerify: { gasL1: 350, gasPgas: 280_000, noiseDelta: null, constraints: 50_000 },
  ZkProve: { gasL1: 200, gasPgas: 180_000, noiseDelta: null, constraints: 30_000 },

  // PQ
  PqVerify: { gasL1: 350, gasPgas: 95_000, noiseDelta: null, constraints: null },

  // Amnesia / VDF
  CeremonyDestroy: { gasL1: 800, gasPgas: 320_000, noiseDelta: null, constraints: null },

  // Tokens
  TokenTransfer: { gasL1: 51_000, gasPgas: 0, noiseDelta: null, constraints: null },
  TokenMint: { gasL1: 68_000, gasPgas: 0, noiseDelta: null, constraints: null },
  TokenBurn: { gasL1: 32_000, gasPgas: 0, noiseDelta: null, constraints: null },

  // Ballot
  BallotCast: { gasL1: 47_000, gasPgas: 0, noiseDelta: null, constraints: null },
  BallotTally: { gasL1: 110_000, gasPgas: 0, noiseDelta: null, constraints: null },

  // Misc
  TimeLoad: { gasL1: 2, gasPgas: 0, noiseDelta: null, constraints: null },
  AddressLoad: { gasL1: 2, gasPgas: 0, noiseDelta: null, constraints: null },
  Arith: { gasL1: 6, gasPgas: 0, noiseDelta: null, constraints: null },
  Branch: { gasL1: 10, gasPgas: 0, noiseDelta: null, constraints: null },
  Synthetic: { gasL1: 0, gasPgas: 0, noiseDelta: null, constraints: null },
};

// ────────────────────────────────────────────────────────────────────────────
// Synthesizer
// ────────────────────────────────────────────────────────────────────────────

interface Hit {
  opcode: Opcode;
  start: number;
  end: number;
  /** Optional override for the human label (default: opcode). */
  labelOverride?: string;
}

/**
 * Pattern → opcode mappings. Order matters: more-specific patterns first
 * so a `fhe_decrypt` doesn't get caught by a generic `fhe_` matcher.
 */
const PATTERNS: { re: RegExp; opcode: Opcode }[] = [
  // FHE primitives (specific before generic)
  { re: /\bfhe_encrypt\b/g, opcode: 'FheEncrypt' },
  { re: /\bfhe_decrypt\b/g, opcode: 'FheDecrypt' },
  { re: /\bfhe_add\b/g, opcode: 'FheAdd' },
  { re: /\bfhe_sub\b/g, opcode: 'FheSub' },
  { re: /\bfhe_mul\b/g, opcode: 'FheMul' },
  { re: /\bfhe_gt\b/g, opcode: 'FheGt' },
  { re: /\bfhe_lt\b/g, opcode: 'FheLt' },
  { re: /\bfhe_eq\b/g, opcode: 'FheEq' },
  { re: /\bfhe_select\b/g, opcode: 'FheSelect' },

  // ZK
  { re: /\bzk_verify\b/g, opcode: 'ZkVerify' },
  { re: /\bzk_prove\b/g, opcode: 'ZkProve' },
  { re: /@verified_by\(\s*zk\b[^)]*\)/g, opcode: 'ZkVerify' },

  // PQ
  { re: /@pq_signed\b/g, opcode: 'PqVerify' },
  { re: /\bpq_verify\b/g, opcode: 'PqVerify' },

  // Amnesia / ceremony
  { re: /\bdestroy\s*\(/g, opcode: 'CeremonyDestroy' },

  // Tokens
  { re: /\btransfer\s*\(/g, opcode: 'TokenTransfer' },
  { re: /\bmint\s*\(/g, opcode: 'TokenMint' },
  { re: /\bburn\s*\(/g, opcode: 'TokenBurn' },

  // Ballot
  { re: /\bcast\s*\(/g, opcode: 'BallotCast' },
  { re: /\btally\s*\(/g, opcode: 'BallotTally' },

  // Source-language constructs
  { re: /\brequire\s*\(/g, opcode: 'Require' },
  { re: /\bemit\s+\w+/g, opcode: 'EmitEvent' },
  { re: /\bblock\.timestamp\b/g, opcode: 'TimeLoad' },
  { re: /\bcaller\b/g, opcode: 'AddressLoad' },
  { re: /\bdeployer\b/g, opcode: 'AddressLoad' },
];

/**
 * Build a SourceMap from the source string.
 *
 * Each "hit" produces one InstructionMapping. We also synthesize a
 * StorageStore/StorageLoad pair for any field assignment / read inside
 * an action body so the gas total has body to it.
 */
export function synthesizeSourceMap(source: string): SourceMap {
  const hits: Hit[] = [];

  for (const { re, opcode } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      hits.push({
        opcode,
        start: m.index,
        end: m.index + m[0].length,
        labelOverride: m[0],
      });
    }
  }

  // Detect field declarations → emit a StorageStore for the constructor
  // and one StorageLoad for each subsequent reference. Cheap heuristic:
  // any line starting with `field <name>` or `<name>: <type>` inside a
  // `record/token/...` block is a field.
  for (const fm of source.matchAll(/^\s*(?:field\s+)?([a-z_]\w*)\s*:\s*\w/gm)) {
    if (!fm.index) continue;
    hits.push({
      opcode: 'StorageStore',
      start: fm.index,
      end: fm.index + fm[0].length,
      labelOverride: `field ${fm[1]}`,
    });
  }

  // Sort by source position so IR index = visual order
  hits.sort((a, b) => a.start - b.start);

  // De-duplicate exact-overlap hits (rare, e.g. nested matchers)
  const seen = new Set<string>();
  const uniqueHits = hits.filter((h) => {
    const key = `${h.start}:${h.opcode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build mappings
  const lineCol = buildLineColIndex(source);
  let evmCursor = 0; // pretend each opcode pushes ~3 bytes of EVM bytecode
  let wasmCursor = 16; // skip header

  const instructions: InstructionMapping[] = uniqueHits.map((hit, idx) => {
    const cost = COST_TABLE[hit.opcode];
    const { line, column } = offsetToLineCol(lineCol, hit.start);
    const evmSize = Math.max(2, Math.floor(cost.gasL1 / 350));
    const wasmSize = Math.max(2, Math.floor(cost.gasL1 / 600));
    const evmOffset = isEvmEmittable(hit.opcode) ? evmCursor : null;
    const wasmOffset = isWasmEmittable(hit.opcode) ? wasmCursor : null;
    if (evmOffset !== null) evmCursor += evmSize;
    if (wasmOffset !== null) wasmCursor += wasmSize;

    return {
      irIndex: idx,
      opcode: hit.opcode,
      opcodeName: hit.labelOverride ?? hit.opcode,
      sourceLine: line,
      sourceColumn: column,
      sourceLength: hit.end - hit.start,
      evmOffset,
      wasmOffset,
      gasEstimateL1: cost.gasL1,
      gasEstimatePgas: cost.gasPgas,
      noiseBudget: noiseFor(hit.opcode, idx, uniqueHits),
      constraintCount: cost.constraints,
    };
  });

  // Stats
  const stats: SourceMapStats = {
    totalInstructions: instructions.length,
    totalSourceLines: source.split('\n').length,
    fheOperations: instructions.filter((i) => i.opcode.startsWith('Fhe')).length,
    zkOperations: instructions.filter((i) => i.opcode.startsWith('Zk')).length,
    totalGasL1: instructions.reduce((s, i) => s + i.gasEstimateL1, 0),
    totalGasPgas: instructions.reduce((s, i) => s + i.gasEstimatePgas, 0),
    totalConstraints: instructions
      .filter((i) => i.constraintCount !== null)
      .reduce((s, i) => s + (i.constraintCount ?? 0), 0),
  };

  return {
    instructions,
    stats,
    synthetic: true,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Cumulative noise budget — each FHE op consumes a bit of the 100% pool. */
function noiseFor(op: Opcode, idx: number, all: Hit[]): number | null {
  const cost = COST_TABLE[op];
  if (cost.noiseDelta === null) return null;
  // Sum noiseDelta of all FHE ops that occur at-or-before this one.
  let used = 0;
  for (let i = 0; i <= idx; i++) {
    const c = COST_TABLE[all[i].opcode];
    if (c.noiseDelta !== null) used += c.noiseDelta;
  }
  return Math.min(100, used);
}

function isEvmEmittable(op: Opcode): boolean {
  // FHE / ZK / PQ live in precompiles, not emitted as raw EVM
  return !(
    op.startsWith('Fhe') ||
    op.startsWith('Zk') ||
    op.startsWith('Pq') ||
    op === 'CeremonyDestroy' ||
    op === 'Synthetic'
  );
}

function isWasmEmittable(op: Opcode): boolean {
  // Aster backend (WASM) covers everything except pure precompiles
  return op !== 'Synthetic';
}

/**
 * Pre-build a line-start byte-offset table so per-mapping `offsetToLineCol`
 * is O(log N) (binary search). Critical for contracts > a few KB.
 */
function buildLineColIndex(source: string): Uint32Array {
  const starts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return Uint32Array.from(starts);
}

function offsetToLineCol(
  starts: Uint32Array,
  offset: number,
): { line: number; column: number } {
  // Binary search for the largest start <= offset
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 };
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting helpers used by the Inspector UI
// ────────────────────────────────────────────────────────────────────────────

export function formatGas(gas: number): string {
  if (gas >= 1_000_000) return `${(gas / 1_000_000).toFixed(2)}M`;
  if (gas >= 1_000) return `${(gas / 1_000).toFixed(1)}k`;
  return gas.toString();
}

export function formatIR(instructions: InstructionMapping[]): string {
  if (instructions.length === 0) {
    return '// No instructions — compile a contract with at least one action.';
  }
  const lines = instructions.map((inst) => {
    const idx = inst.irIndex.toString().padStart(4, ' ');
    const name = inst.opcodeName.padEnd(28, ' ');
    const meta: string[] = [];
    if (inst.gasEstimateL1 > 0) meta.push(`gas:${formatGas(inst.gasEstimateL1)}`);
    if (inst.gasEstimatePgas > 0) meta.push(`pgas:${formatGas(inst.gasEstimatePgas)}`);
    if (inst.noiseBudget !== null) meta.push(`noise:${inst.noiseBudget.toFixed(1)}`);
    if (inst.constraintCount !== null)
      meta.push(`constr:${formatGas(inst.constraintCount)}`);
    const metaStr = meta.length > 0 ? `  // ${meta.join(' ')}` : '';
    return `${idx}: ${name} @ ${inst.sourceLine}:${inst.sourceColumn}${metaStr}`;
  });
  return [
    '// Covenant IR — synthesized source map (Sprint 20 stub).',
    '// Format: <ir-index>: <opcode> @ <line>:<col>  // <annotations>',
    '',
    ...lines,
  ].join('\n');
}

export function formatHexDump(bytes: Uint8Array | string): string {
  // Accept either Uint8Array or hex string
  let hex: string;
  if (typeof bytes === 'string') {
    hex = bytes.startsWith('0x') ? bytes.slice(2) : bytes;
  } else {
    hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  if (hex.length === 0) {
    return '// (empty bytecode — compile a non-trivial contract)';
  }
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += 32) {
    const chunk = hex.substring(i, i + 32);
    out.push(`${(i / 2).toString(16).padStart(6, '0')}:  ${chunk.match(/.{1,2}/g)!.join(' ')}`);
  }
  return out.join('\n');
}
