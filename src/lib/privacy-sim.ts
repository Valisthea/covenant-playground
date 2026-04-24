/**
 * Privacy primitive simulators — fake FHE, ZK, and Amnesia ops.
 *
 * NONE OF THIS IS CRYPTOGRAPHICALLY SOUND. The goal is pedagogy: show
 * the user what the *shape* of a privacy-preserving Covenant call looks
 * like (inputs, ciphertext bytes, proofs, nullifiers, ceremony state)
 * so the surrounding contract code makes sense. Real implementations
 * land at the relevant precompiles (FHE: 0x12A, ZK SNARK verify: 0x125,
 * PQ verify: 0x12B, VDF + amnesia: 0x124..0x127).
 *
 * Determinism: all functions take an explicit seed where needed and
 * use a small splitmix64-style PRNG so demos are reproducible.
 */

// ---------------------------------------------------------------------------
// Shared PRNG (splitmix64) — deterministic given a seed.
// ---------------------------------------------------------------------------

class Prng {
  private s: bigint;
  constructor(seed: bigint) {
    this.s = seed === 0n ? 0x9e3779b97f4a7c15n : seed;
  }
  next(): bigint {
    let z = (this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn);
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  }
  bytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 8) {
      const v = this.next();
      for (let j = 0; j < 8 && i + j < n; j++) {
        out[i + j] = Number((v >> BigInt(j * 8)) & 0xffn);
      }
    }
    return out;
  }
}

function strToSeed(s: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ BigInt(s.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

export function bytesToHex(b: Uint8Array): string {
  let s = '0x';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

// ---------------------------------------------------------------------------
// FHE
// ---------------------------------------------------------------------------

export interface FheCiphertext {
  /** Pretty-printable bytes for the UI. */
  bytes: Uint8Array;
  /** The plaintext we're hiding — kept in the simulator only so we can
   *  decrypt later. A real ciphertext doesn't carry this. */
  plaintext: bigint;
  /** Shape tag for display. */
  scheme: 'CKKS-mock' | 'TFHE-mock' | 'BFV-mock';
}

export function fheEncrypt(plaintext: bigint, label = 'plaintext'): FheCiphertext {
  const seed = strToSeed(`${label}:${plaintext.toString()}`);
  const prng = new Prng(seed);
  return {
    bytes: prng.bytes(96),
    plaintext,
    scheme: 'BFV-mock',
  };
}

export function fheAdd(a: FheCiphertext, b: FheCiphertext): FheCiphertext {
  const sum = a.plaintext + b.plaintext;
  return fheEncrypt(sum, `sum:${a.plaintext}+${b.plaintext}`);
}

export function fheSub(a: FheCiphertext, b: FheCiphertext): FheCiphertext {
  const diff = a.plaintext - b.plaintext;
  return fheEncrypt(diff, `diff:${a.plaintext}-${b.plaintext}`);
}

export function fheMul(a: FheCiphertext, b: FheCiphertext): FheCiphertext {
  const prod = a.plaintext * b.plaintext;
  return fheEncrypt(prod, `prod:${a.plaintext}*${b.plaintext}`);
}

export function fheGt(a: FheCiphertext, b: FheCiphertext): FheCiphertext {
  return fheEncrypt(a.plaintext > b.plaintext ? 1n : 0n, `gt:${a.plaintext}>${b.plaintext}`);
}

export function fheDecrypt(c: FheCiphertext): bigint {
  return c.plaintext;
}

// ---------------------------------------------------------------------------
// ZK
// ---------------------------------------------------------------------------

export interface ZkProof {
  /** Public commitment hash (Pedersen-shaped, mocked). */
  commitment: Uint8Array;
  /** Nullifier — links the proof to a one-time use without revealing identity. */
  nullifier: Uint8Array;
  /** Opaque SNARK proof bytes. */
  proof: Uint8Array;
  /** Public inputs revealed alongside the proof. */
  publicInputs: bigint[];
}

export interface ZkWitness {
  /** Private inputs the prover knows. */
  privateInputs: bigint[];
  /** Public inputs the verifier checks. */
  publicInputs: bigint[];
  /** Per-prover nullifier secret. */
  nullifierSecret: bigint;
}

export function zkProve(witness: ZkWitness): ZkProof {
  const seed = strToSeed(
    `proof:${witness.privateInputs.join(',')}|${witness.publicInputs.join(',')}|${witness.nullifierSecret}`,
  );
  const prng = new Prng(seed);
  return {
    commitment: prng.bytes(32),
    nullifier: prng.bytes(32),
    proof: prng.bytes(192), // Groth16-shaped
    publicInputs: [...witness.publicInputs],
  };
}

export function zkVerify(
  proof: ZkProof,
  expectedPublicInputs: bigint[],
): { ok: boolean; reason?: string } {
  if (proof.publicInputs.length !== expectedPublicInputs.length) {
    return { ok: false, reason: 'public input length mismatch' };
  }
  for (let i = 0; i < proof.publicInputs.length; i++) {
    if (proof.publicInputs[i] !== expectedPublicInputs[i]) {
      return {
        ok: false,
        reason: `public input #${i} mismatch (got ${proof.publicInputs[i]}, expected ${expectedPublicInputs[i]})`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Amnesia ceremony
// ---------------------------------------------------------------------------

export type CeremonyState = 'idle' | 'gathering' | 'finalized' | 'destroyed';

export interface CeremonyContribution {
  contributor: string;
  entropyBytes: Uint8Array;
  transcriptAfter: Uint8Array;
}

export interface AmnesiaCeremony {
  state: CeremonyState;
  contributions: CeremonyContribution[];
  transcript: Uint8Array;
  vdfOutput: Uint8Array | null;
  destructionProof: Uint8Array | null;
  /** Set when state === 'destroyed'; cannot be reset. */
  destroyedAt: number | null;
}

export function newCeremony(): AmnesiaCeremony {
  return {
    state: 'idle',
    contributions: [],
    transcript: new Uint8Array(32),
    vdfOutput: null,
    destructionProof: null,
    destroyedAt: null,
  };
}

export function ceremonySetup(c: AmnesiaCeremony): AmnesiaCeremony {
  if (c.state !== 'idle') throw new Error('ceremony already setup');
  return { ...c, state: 'gathering' };
}

export function ceremonyContribute(
  c: AmnesiaCeremony,
  contributor: string,
  entropyHex: string,
): AmnesiaCeremony {
  if (c.state !== 'gathering')
    throw new Error('ceremony not in gathering state');
  if (c.contributions.some((x) => x.contributor === contributor)) {
    throw new Error(`${contributor} already contributed`);
  }
  const entropyBytes = hexToBytes(entropyHex || '0x' + '00'.repeat(32));
  const transcriptAfter = mockKeccak(c.transcript, entropyBytes, contributor);
  return {
    ...c,
    contributions: [
      ...c.contributions,
      { contributor, entropyBytes, transcriptAfter },
    ],
    transcript: transcriptAfter,
  };
}

export function ceremonyFinalize(c: AmnesiaCeremony): AmnesiaCeremony {
  if (c.state !== 'gathering') throw new Error('not gathering');
  if (c.contributions.length < 1)
    throw new Error('at least one contribution required');
  return { ...c, state: 'finalized' };
}

export function ceremonyDestroy(c: AmnesiaCeremony): AmnesiaCeremony {
  if (c.state !== 'finalized') throw new Error('not finalized');
  const seed = strToSeed(bytesToHex(c.transcript));
  const prng = new Prng(seed);
  const vdfOutput = prng.bytes(64); // Wesolowski-shaped
  const destructionProof = mockKeccak(c.transcript, vdfOutput);
  return {
    ...c,
    state: 'destroyed',
    vdfOutput,
    destructionProof,
    destroyedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockKeccak(...parts: (Uint8Array | string)[]): Uint8Array {
  // NOT real keccak — a deterministic 32-byte mixer for the demo.
  const allBytes: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) allBytes.push(p.charCodeAt(i));
    } else {
      for (let i = 0; i < p.length; i++) allBytes.push(p[i]);
    }
  }
  const seed = strToSeed(allBytes.map((b) => b.toString(16)).join(''));
  return new Prng(seed).bytes(32);
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const padded = h.length % 2 === 0 ? h : '0' + h;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export function shortBytes(b: Uint8Array | null, head = 6, tail = 4): string {
  if (!b) return '—';
  if (b.length <= head + tail) return bytesToHex(b);
  const hex = bytesToHex(b).slice(2); // drop 0x
  return `0x${hex.slice(0, head * 2)}…${hex.slice(-tail * 2)}`;
}
