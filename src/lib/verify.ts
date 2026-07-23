/**
 * Covenant source verification.
 *
 * The whole idea in one sentence: recompile the submitted `.cov` source with a
 * pinned compiler version and check that the runtime bytecode it produces is
 * byte-identical to the code living at `address` on chain.
 *
 * That only works because the Covenant compiler is deterministic — two
 * independent builds of the same source produce the same bytes. Verified
 * empirically (2026-07-23) against the M6 deployment on Robinhood Chain:
 * local build and on-chain code both hashed to
 * 12ee49706b8c10d1ed5363c9e13712c2f6113e8067a33bb4406683c99672c5e5.
 *
 * No explorer supports Covenant (Blockscout offers 8 verification methods,
 * all Solidity/Vyper), so this module is the substitute — and the reference
 * implementation for the standalone verifier that explorers can integrate.
 *
 * We compare RUNTIME bytecode, not deploy bytecode: deploy bytecode contains
 * the constructor plus any appended constructor arguments, which legitimately
 * differ between a local build and a deployment. Runtime code is what actually
 * lives at the address, and it is what users are trusting.
 */

import { JsonRpcProvider } from 'ethers';
import { ensureCompilerLoaded, getWasmBinding } from './covenant-compiler';
import { getNetwork } from './networks';

export type VerifyStatus = 'match' | 'mismatch' | 'not-a-contract' | 'compile-failed' | 'error';

export interface BytecodeFacts {
  hex: string;
  sha256: string;
  bytes: number;
}

export interface VerifyDiagnostic {
  severity: string;
  code: string;
  message: string;
  line?: number;
}

export interface VerifyResult {
  status: VerifyStatus;
  /** Human-readable one-liner for the headline. */
  summary: string;
  compilerVersion: string | null;
  local: BytecodeFacts | null;
  onchain: BytecodeFacts | null;
  /** First differing nibble index, when status === 'mismatch'. */
  firstDiffAt: number | null;
  abi: unknown[] | null;
  selectors: { name: string; selector: string }[];
  storageLayout: unknown[];
  diagnostics: VerifyDiagnostic[];
}

/** Strip 0x, lowercase, drop whitespace — the canonical comparison form. */
export function normalizeBytecode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, '').replace(/^0x/i, '').toLowerCase();
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function facts(hex: string, sha: string): BytecodeFacts {
  return { hex, sha256: sha, bytes: Math.floor(hex.length / 2) };
}

/** Index of the first differing character, or null when equal. */
export function firstDifference(a: string, b: string): number | null {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? null : n;
}

export interface VerifyInput {
  source: string;
  networkId: string;
  address: string;
}

export async function verifyContract({ source, networkId, address }: VerifyInput): Promise<VerifyResult> {
  const empty: VerifyResult = {
    status: 'error',
    summary: '',
    compilerVersion: null,
    local: null,
    onchain: null,
    firstDiffAt: null,
    abi: null,
    selectors: [],
    storageLayout: [],
    diagnostics: [],
  };

  const net = getNetwork(networkId);
  if (!net) return { ...empty, summary: `Unknown network "${networkId}".` };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
    return { ...empty, summary: 'That is not a valid 20-byte contract address.' };
  }

  // --- 1. Recompile locally, in-browser -----------------------------------
  await ensureCompilerLoaded();
  const binding = await getWasmBinding();
  if (!binding) {
    return {
      ...empty,
      summary: 'The Covenant compiler failed to load, so nothing can be verified. Reload and retry.',
    };
  }

  const compilerVersion = binding.version();
  let compiled;
  try {
    compiled = binding.compile_to_evm(source);
  } catch (e) {
    return { ...empty, compilerVersion, summary: `Compiler threw: ${String(e)}` };
  }

  const diagnostics: VerifyDiagnostic[] = (compiled.diagnostics ?? []).map((d) => ({
    severity: String((d as { severity?: unknown }).severity ?? 'error'),
    code: String((d as { code?: unknown }).code ?? ''),
    message: String((d as { message?: unknown }).message ?? ''),
    line: (d as { line?: number }).line,
  }));

  if (!compiled.ok || !compiled.runtime_bytecode) {
    return {
      ...empty,
      compilerVersion,
      diagnostics,
      status: 'compile-failed',
      summary: 'The source does not compile, so it cannot match anything on chain.',
    };
  }

  const localHex = normalizeBytecode(compiled.runtime_bytecode);
  const localSha = await sha256Hex(localHex);

  // --- 2. Read what is actually deployed -----------------------------------
  let onchainRaw: string;
  try {
    const provider = new JsonRpcProvider(net.publicRpc);
    onchainRaw = await provider.getCode(address.trim());
  } catch (e) {
    return {
      ...empty,
      compilerVersion,
      diagnostics,
      local: facts(localHex, localSha),
      summary: `Could not reach ${net.label} to read the deployed code: ${String(e)}`,
    };
  }

  const onchainHex = normalizeBytecode(onchainRaw);
  if (onchainHex === '' || onchainHex === '0') {
    return {
      ...empty,
      compilerVersion,
      diagnostics,
      local: facts(localHex, localSha),
      status: 'not-a-contract',
      summary: `No contract code at that address on ${net.label} — it is an EOA, or the wrong network is selected.`,
    };
  }

  const onchainSha = await sha256Hex(onchainHex);

  // --- 3. Compare -----------------------------------------------------------
  const abi = compiled.abi ? (JSON.parse(compiled.abi) as unknown[]) : null;
  const base = {
    compilerVersion,
    local: facts(localHex, localSha),
    onchain: facts(onchainHex, onchainSha),
    abi,
    selectors: compiled.function_selectors ?? [],
    storageLayout: compiled.storage_layout ?? [],
    diagnostics,
  };

  if (localHex === onchainHex) {
    return {
      ...base,
      status: 'match',
      firstDiffAt: null,
      summary: `Byte-for-byte match. This source, compiled with Covenant ${compilerVersion}, produces exactly the code deployed at this address.`,
    };
  }

  return {
    ...base,
    status: 'mismatch',
    firstDiffAt: firstDifference(localHex, onchainHex),
    summary:
      localHex.length === onchainHex.length
        ? 'Same length, different bytes — this is not the source that produced the deployed contract, or it was built with a different compiler version.'
        : `Different length (${Math.floor(localHex.length / 2)} vs ${Math.floor(onchainHex.length / 2)} bytes) — almost certainly a different source or compiler version.`,
  };
}
