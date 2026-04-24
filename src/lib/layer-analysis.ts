/**
 * Architecture Layer Analyzer (Sprint 21).
 *
 * Walks Covenant source text and detects which Styx layers
 * (FORTRESS / VEIL / PRISM / OBLIVION) are used, where, and how often.
 *
 * Same rationale as Sprint 20's source-map synthesizer: the real Rust
 * `architecture_analyzer` is not yet shipped through the WASM binding,
 * so this module fills the gap. The output type mirrors what the Rust
 * crate will eventually emit — when it ships, swap the body of
 * `analyzeLayers()` for a thin call into the binding without changing
 * any consumer.
 */

import type { Opcode } from './source-map';

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export interface SourceSpan {
  fileId: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export type OccurrenceKind =
  | 'field_declaration'
  | 'guard'
  | 'fhe_operation'
  | 'proof_verification'
  | 'destruction'
  | 'freeze'
  | 'ceremony_declaration'
  | 'phase_transition'
  | 'pq_operation';

export interface LayerOccurrence {
  kind: OccurrenceKind;
  description: string;       // human-readable
  span: SourceSpan;
  context: string;           // short code snippet
  opcode?: Opcode | null;    // optional link back to the IR
}

export interface LayerUsage {
  used: boolean;
  usageCount: number;
  occurrences: LayerOccurrence[];
  /** 0..100 — heuristic combining occurrence count and occurrence-kind variety. */
  complexityScore: number;
}

export type LayerId = 'fortress' | 'veil' | 'prism' | 'oblivion';

export interface ArchitectureSummary {
  layersUsed: number;            // 0..4
  totalCryptoOperations: number;
  primaryLayer: LayerId | null;
  privacyProfile:
    | 'plain'
    | 'encrypted'
    | 'zk-gated'
    | 'amnesia-protected'
    | 'post-quantum'
    | 'hybrid';
}

export interface LayerAnalysis {
  fortress: LayerUsage;
  veil: LayerUsage;
  prism: LayerUsage;
  oblivion: LayerUsage;
  summary: ArchitectureSummary;
  /** True until the real Rust analyzer ships. */
  synthetic: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer metadata (consumed by UI for color/title/icon)
// ────────────────────────────────────────────────────────────────────────────

export const LAYER_METADATA: Record<
  LayerId,
  {
    title: string;
    subtitle: string;
    description: string;
    color: string;        // strategic — must stay in sync with main site
    iconKey: 'shield' | 'eye' | 'sparkles' | 'archive';
  }
> = {
  fortress: {
    title: 'FORTRESS',
    subtitle: 'Post-Quantum Cryptography',
    description:
      'Future-proof signatures and key infrastructure (CRYSTALS-Dilithium, Kyber).',
    color: '#4C1D95',
    iconKey: 'shield',
  },
  veil: {
    title: 'VEIL',
    subtitle: 'Fully Homomorphic Encryption',
    description:
      'Confidential computation on encrypted data — addition, multiplication, and comparisons under encryption.',
    color: '#7C3AED',
    iconKey: 'eye',
  },
  prism: {
    title: 'PRISM',
    subtitle: 'Zero-Knowledge Proofs',
    description:
      'Verify claims without revealing the underlying data. Nova IVC / Halo2 backends.',
    color: '#A78BFA',
    iconKey: 'sparkles',
  },
  oblivion: {
    title: 'OBLIVION',
    subtitle: 'Cryptographic Amnesia',
    description:
      'Provably destroy secrets. Ceremonies, amnesia phase state machines, Shamir secret shares.',
    color: '#991B1B',
    iconKey: 'archive',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Pattern table — regex → which layer + how to describe it
// ────────────────────────────────────────────────────────────────────────────

interface Pattern {
  layer: LayerId;
  regex: RegExp;            // global, multiline
  kind: OccurrenceKind;
  describe: (match: RegExpExecArray) => string;
  contextOf: (match: RegExpExecArray) => string;
  opcode?: Opcode;
}

// Order matters: more specific patterns first so generic ones don't shadow.
const PATTERNS: Pattern[] = [
  // ── FORTRESS ────────────────────────────────────────────────────────────
  {
    layer: 'fortress',
    regex: /\b(\w+)\s*:\s*pq_key\b/g,
    kind: 'field_declaration',
    describe: (m) =>
      `Field '${m[1]}' is a post-quantum key (Dilithium / Kyber).`,
    contextOf: (m) => `field ${m[1]}: pq_key`,
  },
  {
    layer: 'fortress',
    regex: /@pq_signed\s*\(\s*([^)]*)\s*\)/g,
    kind: 'guard',
    describe: (m) =>
      `pq_signed(${m[1].trim() || '…'}) — post-quantum signature gate.`,
    contextOf: (m) => `@pq_signed(${m[1].trim()})`,
  },
  {
    layer: 'fortress',
    regex: /\b(dilithium|kyber|crystals[_-]?(?:dilithium|kyber))\b/gi,
    kind: 'pq_operation',
    describe: (m) => `Direct ${m[1]} primitive call.`,
    contextOf: (m) => m[0],
  },

  // ── VEIL (FHE) ──────────────────────────────────────────────────────────
  {
    layer: 'veil',
    regex: /\b(\w+)\s*:\s*encrypted\b/g,
    kind: 'field_declaration',
    describe: (m) =>
      `Field '${m[1]}' is encrypted — stored ciphertext, computed under FHE.`,
    contextOf: (m) => `field ${m[1]}: encrypted ...`,
  },
  {
    layer: 'veil',
    regex: /\b(\w+)\s*:\s*sealed\b/g,
    kind: 'field_declaration',
    describe: (m) =>
      `Field '${m[1]}' is sealed — strict FHE confidentiality, no decrypt.`,
    contextOf: (m) => `field ${m[1]}: sealed ...`,
  },
  {
    layer: 'veil',
    regex: /\bfhe_encrypt\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () => 'fhe_encrypt — wrap a plaintext as ciphertext.',
    contextOf: () => 'fhe_encrypt(...)',
    opcode: 'FheEncrypt',
  },
  {
    layer: 'veil',
    regex: /\bfhe_decrypt\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () => 'fhe_decrypt — recover plaintext under owner key.',
    contextOf: () => 'fhe_decrypt(...)',
    opcode: 'FheDecrypt',
  },
  {
    layer: 'veil',
    regex: /\bfhe_add\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () => 'Homomorphic addition under encryption.',
    contextOf: () => 'fhe_add(...)',
    opcode: 'FheAdd',
  },
  {
    layer: 'veil',
    regex: /\bfhe_sub\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () => 'Homomorphic subtraction under encryption.',
    contextOf: () => 'fhe_sub(...)',
    opcode: 'FheSub',
  },
  {
    layer: 'veil',
    regex: /\bfhe_mul\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () =>
      'Homomorphic multiplication — ~5× costlier than addition, drains noise budget.',
    contextOf: () => 'fhe_mul(...)',
    opcode: 'FheMul',
  },
  {
    layer: 'veil',
    regex: /\bfhe_(gt|lt|eq)\b\s*\(/g,
    kind: 'fhe_operation',
    describe: (m) => `Homomorphic ${m[1]} comparison under encryption.`,
    contextOf: (m) => `fhe_${m[1]}(...)`,
  },
  {
    layer: 'veil',
    regex: /\bfhe_select\b\s*\(/g,
    kind: 'fhe_operation',
    describe: () => 'Branchless homomorphic select (oblivious branching).',
    contextOf: () => 'fhe_select(...)',
    opcode: 'FheSelect',
  },

  // ── PRISM (ZK) ──────────────────────────────────────────────────────────
  {
    layer: 'prism',
    regex: /@verified_by\s*\(\s*([^)]*)\s*\)/g,
    kind: 'guard',
    describe: (m) =>
      `verified_by(${m[1].trim() || '…'}) — ZK proof gate.`,
    contextOf: (m) => `@verified_by(${m[1].trim()})`,
  },
  {
    layer: 'prism',
    regex: /\bzk_verify\b\s*\(/g,
    kind: 'proof_verification',
    describe: () => 'zk_verify — direct proof check (Nova / Halo2).',
    contextOf: () => 'zk_verify(...)',
    opcode: 'ZkVerify',
  },
  {
    layer: 'prism',
    regex: /\bzk_prove\b\s*\(/g,
    kind: 'proof_verification',
    describe: () => 'zk_prove — generate a ZK proof.',
    contextOf: () => 'zk_prove(...)',
    opcode: 'ZkProve',
  },
  {
    layer: 'prism',
    regex: /\b(nova|halo2)\b/gi,
    kind: 'proof_verification',
    describe: (m) => `Direct ${m[1]} backend reference.`,
    contextOf: (m) => m[0],
  },

  // ── OBLIVION (amnesia) ──────────────────────────────────────────────────
  {
    layer: 'oblivion',
    regex: /\bceremony\s+(\w+)\b/g,
    kind: 'ceremony_declaration',
    describe: (m) =>
      `Ceremony '${m[1]}' with amnesia phase state machine.`,
    contextOf: (m) => `ceremony ${m[1]} { ... }`,
  },
  {
    layer: 'oblivion',
    regex: /\b(\w+)\s*:\s*amnesia_phase\b/g,
    kind: 'field_declaration',
    describe: (m) => `Field '${m[1]}' tracks amnesia ceremony phase.`,
    contextOf: (m) => `field ${m[1]}: amnesia_phase`,
  },
  {
    layer: 'oblivion',
    regex: /\b(\w+)\s*:\s*shares\s*\(/g,
    kind: 'field_declaration',
    describe: (m) =>
      `Field '${m[1]}' uses Shamir Secret Sharing (N of M).`,
    contextOf: (m) => `field ${m[1]}: shares(...)`,
  },
  {
    layer: 'oblivion',
    regex: /\bdestroy\b\s*\(/g,
    kind: 'destruction',
    describe: () => 'destroy() — permanent erasure of secret material.',
    contextOf: () => 'destroy(...)',
    opcode: 'CeremonyDestroy',
  },
  {
    layer: 'oblivion',
    regex: /\bfreeze\b\s*\(/g,
    kind: 'freeze',
    describe: () => 'freeze() — mark state as read-only forever.',
    contextOf: () => 'freeze(...)',
  },
  {
    layer: 'oblivion',
    regex: /\bphase\s*->\s*(\w+)\b/g,
    kind: 'phase_transition',
    describe: (m) => `Phase transition → ${m[1]}.`,
    contextOf: (m) => `phase -> ${m[1]}`,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Line/column index — O(log N) offset → (line, col)
// ────────────────────────────────────────────────────────────────────────────

function buildLineIndex(source: string): Uint32Array {
  const starts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return Uint32Array.from(starts);
}

function offsetToLineCol(
  index: Uint32Array,
  offset: number,
): { line: number; col: number } {
  // Binary search for the largest start <= offset
  let lo = 0;
  let hi = index.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (index[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - index[lo] + 1 };
}

// ────────────────────────────────────────────────────────────────────────────
// Public entry point
// ────────────────────────────────────────────────────────────────────────────

export function analyzeLayers(source: string): LayerAnalysis {
  const empty = (): LayerUsage => ({
    used: false,
    usageCount: 0,
    occurrences: [],
    complexityScore: 0,
  });

  const out: Record<LayerId, LayerUsage> = {
    fortress: empty(),
    veil: empty(),
    prism: empty(),
    oblivion: empty(),
  };

  const lineIndex = buildLineIndex(source);
  // Track byte ranges already claimed by a more-specific pattern so we
  // don't double-count (e.g. `pq_key` inside a `pq_signed` group).
  const claimed: Array<[number, number]> = [];
  const overlaps = (start: number, end: number) =>
    claimed.some(([s, e]) => start < e && end > s);

  for (const pat of PATTERNS) {
    pat.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.regex.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      claimed.push([start, end]);

      const startPos = offsetToLineCol(lineIndex, start);
      const endPos = offsetToLineCol(lineIndex, end);

      out[pat.layer].occurrences.push({
        kind: pat.kind,
        description: pat.describe(m),
        context: pat.contextOf(m),
        span: {
          fileId: 0,
          startLine: startPos.line,
          startCol: startPos.col,
          endLine: endPos.line,
          endCol: endPos.col,
        },
        opcode: pat.opcode ?? null,
      });
      out[pat.layer].usageCount += 1;
    }
  }

  // Finalize
  for (const id of ['fortress', 'veil', 'prism', 'oblivion'] as LayerId[]) {
    const u = out[id];
    u.used = u.usageCount > 0;
    u.complexityScore = computeComplexity(u);
    // Stable order — by line, then column
    u.occurrences.sort(
      (a, b) =>
        a.span.startLine - b.span.startLine ||
        a.span.startCol - b.span.startCol,
    );
  }

  return {
    ...out,
    summary: computeSummary(out),
    synthetic: true,
  };
}

function computeComplexity(u: LayerUsage): number {
  if (u.usageCount === 0) return 0;
  const base = u.usageCount * 8;
  const variety = new Set(u.occurrences.map((o) => o.kind)).size;
  const score = base + variety * 18;
  return Math.min(100, score);
}

function computeSummary(
  layers: Record<LayerId, LayerUsage>,
): ArchitectureSummary {
  const used = (['fortress', 'veil', 'prism', 'oblivion'] as LayerId[]).filter(
    (id) => layers[id].used,
  );
  const totalCryptoOperations =
    layers.fortress.usageCount +
    layers.veil.usageCount +
    layers.prism.usageCount +
    layers.oblivion.usageCount;

  let primary: LayerId | null = null;
  let bestCount = 0;
  for (const id of used) {
    if (layers[id].usageCount > bestCount) {
      bestCount = layers[id].usageCount;
      primary = id;
    }
  }

  let profile: ArchitectureSummary['privacyProfile'] = 'plain';
  if (used.length === 0) profile = 'plain';
  else if (
    layers.veil.used &&
    layers.prism.used &&
    layers.oblivion.used
  )
    profile = 'hybrid';
  else if (layers.veil.used) profile = 'encrypted';
  else if (layers.prism.used) profile = 'zk-gated';
  else if (layers.oblivion.used) profile = 'amnesia-protected';
  else if (layers.fortress.used) profile = 'post-quantum';

  return {
    layersUsed: used.length,
    totalCryptoOperations,
    primaryLayer: primary,
    privacyProfile: profile,
  };
}
