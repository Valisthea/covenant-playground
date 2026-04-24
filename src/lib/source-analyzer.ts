/**
 * Source analyzer — extract privacy primitives from a .cov source string.
 *
 * Lightweight regex pass; not a real parser. The goal is the Privacy tab:
 * tell the user *what* privacy primitives this contract uses without
 * waiting on the wasm compiler. When the real compiler ships its IR
 * to the browser this gets replaced by an AST visitor over the IR.
 *
 * Categories detected:
 *   - FHE  — fhe_encrypt/decrypt/add/sub/mul/gt/select, encrypted<…>,
 *            ciphertext type, fhe_key fields.
 *   - ZK   — @verified_by(zk), zk_prove/zk_verify, nullifier, commitment,
 *            merkle_root.
 *   - PQ   — @pq_signed, pq_key, pq_verify (post-quantum signature).
 *   - AMN  — @destroy annotation, ceremony block, CeremonyState enum,
 *            destruction_proof field.
 *   - SAFE — only verified_by Safe(...), Gnosis Safe guard.
 *   - HOOK — @uniswap_hook, @aave_hook etc.
 */

export type PrivacyKind = 'fhe' | 'zk' | 'pq' | 'amnesia' | 'safe' | 'hook';

export interface PrivacyHit {
  kind: PrivacyKind;
  /** Human label for the hit, e.g. "fhe_add". */
  label: string;
  /** Byte offset of the start of the match. */
  start: number;
  /** Byte offset of the end. */
  end: number;
  /** 1-indexed line for jump-to-source. */
  line: number;
  /** Short blurb for the tooltip / side panel. */
  blurb: string;
}

export interface PrivacyReport {
  hits: PrivacyHit[];
  byKind: Record<PrivacyKind, PrivacyHit[]>;
  hasFhe: boolean;
  hasZk: boolean;
  hasPq: boolean;
  hasAmnesia: boolean;
  hasSafe: boolean;
  hasHook: boolean;
}

interface Pattern {
  kind: PrivacyKind;
  re: RegExp;
  blurb: string;
  /** Optional: produce a label given the matched substring. */
  label?: (m: string) => string;
}

const PATTERNS: Pattern[] = [
  // ---------------- FHE ----------------
  {
    kind: 'fhe',
    re: /\bfhe_(encrypt|decrypt|add|sub|mul|gt|lt|eq|select)\b/g,
    blurb:
      'Homomorphic operation. Runs over ciphertexts without decrypting; result is itself a ciphertext (decrypt only at the end).',
  },
  {
    kind: 'fhe',
    re: /\bencrypted<[^>]+>/g,
    blurb:
      'Encrypted type wrapper. Values cannot be inspected on-chain — only homomorphic ops apply.',
  },
  {
    kind: 'fhe',
    re: /\bciphertext\b/g,
    blurb: 'Opaque ciphertext bytes. Carries an FHE-encrypted value.',
  },
  {
    kind: 'fhe',
    re: /\bfhe_key\b/g,
    blurb: 'Public encryption key for the FHE scheme.',
  },

  // ---------------- ZK ----------------
  {
    kind: 'zk',
    re: /@verified_by\(zk\)/g,
    blurb:
      'Action body must produce a SNARK that proves the require(...) clauses hold without revealing private inputs.',
  },
  {
    kind: 'zk',
    re: /\bzk_(prove|verify|commitment|nullifier)\b/g,
    blurb: 'Zero-knowledge primitive — generates or checks a SNARK proof.',
  },
  {
    kind: 'zk',
    re: /\bnullifier(s|_set)?\b/g,
    blurb:
      'Nullifier set — prevents double-spend / double-vote without linking to identity.',
  },
  {
    kind: 'zk',
    re: /\bmerkle_(root|proof|verify)\b/g,
    blurb: 'Merkle commitment — proves set membership in zero-knowledge.',
  },
  {
    kind: 'zk',
    re: /\bcommitment(s)?\b/g,
    blurb: 'Pedersen / Poseidon commitment — hiding + binding.',
  },

  // ---------------- PQ ----------------
  {
    kind: 'pq',
    re: /@pq_signed(\([^)]*\))?/g,
    blurb:
      'Post-quantum signature gate. Caller must produce a Dilithium / SPHINCS+ signature checked at precompile 0x12B.',
  },
  {
    kind: 'pq',
    re: /\bpq_(key|verify|sign)\b/g,
    blurb: 'Post-quantum primitive — quantum-resistant signature scheme.',
  },

  // ---------------- Amnesia ----------------
  {
    kind: 'amnesia',
    re: /@destroy/g,
    blurb:
      'One-way state transition. Compiler synthesizes a Wesolowski VDF + keccak destruction proof at precompiles 0x124..0x127. After this runs the state machine cannot return to any earlier variant.',
  },
  {
    kind: 'amnesia',
    re: /\bceremony\s+\w+/g,
    blurb:
      'Ceremony block — top-level kind for one-way MPC + cryptographic amnesia flows.',
  },
  {
    kind: 'amnesia',
    re: /\bdestruction_proof\b/g,
    blurb: 'Stored proof that private material was provably destroyed.',
  },
  {
    kind: 'amnesia',
    re: /\bvdf_(output|verify)\b/g,
    blurb: 'Verifiable delay function — used to bind the destruction proof.',
  },

  // ---------------- Safe ----------------
  {
    kind: 'safe',
    re: /\bonly\s+verified_by\s+Safe\(/g,
    blurb:
      'Gnosis Safe guard — compiler emits a STATICCALL to Safe.checkTransaction(...) before the action body runs.',
  },

  // ---------------- Hook ----------------
  {
    kind: 'hook',
    re: /@(uniswap|aave|euler|morpho|compound)_hook(\([^)]*\))?/g,
    blurb:
      'Protocol lifecycle hook. Compiler emits the integration\'s flag bitmap so the protocol router knows which callbacks to invoke.',
  },
];

export function analyzeSource(source: string): PrivacyReport {
  const hits: PrivacyHit[] = [];
  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0; // global regex — reset between runs
    let m: RegExpExecArray | null;
    while ((m = pat.re.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      hits.push({
        kind: pat.kind,
        label: pat.label ? pat.label(m[0]) : m[0],
        start,
        end,
        line: lineOfOffset(source, start),
        blurb: pat.blurb,
      });
    }
  }

  // Stable order: by start offset.
  hits.sort((a, b) => a.start - b.start);

  const byKind: Record<PrivacyKind, PrivacyHit[]> = {
    fhe: [],
    zk: [],
    pq: [],
    amnesia: [],
    safe: [],
    hook: [],
  };
  for (const h of hits) byKind[h.kind].push(h);

  return {
    hits,
    byKind,
    hasFhe: byKind.fhe.length > 0,
    hasZk: byKind.zk.length > 0,
    hasPq: byKind.pq.length > 0,
    hasAmnesia: byKind.amnesia.length > 0,
    hasSafe: byKind.safe.length > 0,
    hasHook: byKind.hook.length > 0,
  };
}

function lineOfOffset(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

export const KIND_META: Record<
  PrivacyKind,
  { label: string; color: string; sublabel: string }
> = {
  fhe: {
    label: 'FHE',
    color: '#7C3AED',
    sublabel: 'Homomorphic encryption',
  },
  zk: {
    label: 'ZK',
    color: '#1A5F3F',
    sublabel: 'Zero-knowledge proofs',
  },
  pq: {
    label: 'PQ',
    color: '#B45309',
    sublabel: 'Post-quantum signatures',
  },
  amnesia: {
    label: 'AMN',
    color: '#B91C1C',
    sublabel: 'Cryptographic amnesia',
  },
  safe: {
    label: 'SAFE',
    color: '#1F2937',
    sublabel: 'Gnosis Safe guard',
  },
  hook: {
    label: 'HOOK',
    color: '#0F766E',
    sublabel: 'Protocol lifecycle hooks',
  },
};
