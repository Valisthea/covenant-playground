/**
 * Revert payload decoder.
 *
 * Solidity reverts come in three concrete shapes plus an "empty" and
 * "unknown" tail. Sprint 25 surfaces all of them in `RevertDisplay`
 * so the user no longer has to leave the playground to find out
 * *why* a tx failed.
 *
 *   Flavor A — `Error(string)`           selector 0x08c379a0
 *                                         emitted by `require(_, "msg")` and
 *                                         `revert("msg")`.
 *   Flavor B — `Panic(uint256)`          selector 0x4e487b71
 *                                         emitted by Solidity's built-in
 *                                         arithmetic / array bounds checks.
 *                                         The uint code is documented in
 *                                         the Solidity manual; we map the
 *                                         common ones to readable strings.
 *   Flavor C — Custom errors             selector = first 4 bytes of
 *                                         keccak256("Name(types,…)").
 *                                         Decoded against the contract's
 *                                         ABI when the entry has
 *                                         `type: "error"`.
 *
 * The output is a discriminated union ready for direct rendering.
 */

import { AbiCoder, Interface } from 'ethers';

export type DecodedRevert =
  | { type: 'string'; message: string }
  | { type: 'panic'; code: number; description: string }
  | {
      type: 'custom';
      errorName: string;
      args: Array<{ name: string; type: string; value: unknown }>;
    }
  | { type: 'unknown'; raw: string; selectorHex?: string }
  | { type: 'empty' };

/**
 * Solidity panic codes — see https://docs.soliditylang.org/en/latest/control-structures.html#panic-via-assert-and-error-via-require
 */
const PANIC_MESSAGES: Record<number, string> = {
  0x00: 'Generic panic',
  0x01: 'Assertion failed (assert(false))',
  0x11: 'Arithmetic overflow or underflow',
  0x12: 'Division or modulo by zero',
  0x21: 'Conversion to non-existent enum value',
  0x22: 'Invalid storage byte array access',
  0x31: 'Pop on empty array',
  0x32: 'Array index out of bounds',
  0x41: 'Memory overflow (allocation too large)',
  0x51: 'Function pointer to invalid code',
};

const ERROR_STRING_SELECTOR = '0x08c379a0';
const PANIC_SELECTOR = '0x4e487b71';

/**
 * Decode a hex revert payload. The optional `abi` is consulted only
 * for Flavor C (custom errors) — the standard Error/Panic flavours
 * decode against fixed signatures.
 *
 * Never throws. Anything we can't decode falls into `{ type: 'unknown' }`
 * with the raw hex preserved so the UI can show the user something
 * actionable (the 4-byte selector at minimum, full hex on demand).
 */
export function decodeRevert(rawHex: string | null | undefined, abi: unknown[] = []): DecodedRevert {
  if (!rawHex || rawHex === '0x' || rawHex === '0x0') {
    return { type: 'empty' };
  }

  const normalised = rawHex.startsWith('0x') || rawHex.startsWith('0X') ? rawHex : `0x${rawHex}`;
  const body = normalised.slice(2);
  if (body.length < 8) {
    return { type: 'unknown', raw: normalised };
  }

  const selector = `0x${body.slice(0, 8).toLowerCase()}`;
  const dataHex = `0x${body.slice(8)}`;

  // Flavor A — Error(string)
  if (selector === ERROR_STRING_SELECTOR) {
    try {
      const decoded = AbiCoder.defaultAbiCoder().decode(['string'], dataHex);
      return { type: 'string', message: String(decoded[0]) };
    } catch {
      return { type: 'unknown', raw: normalised, selectorHex: selector };
    }
  }

  // Flavor B — Panic(uint256)
  if (selector === PANIC_SELECTOR) {
    try {
      const decoded = AbiCoder.defaultAbiCoder().decode(['uint256'], dataHex);
      const codeNum = Number(decoded[0]);
      return {
        type: 'panic',
        code: codeNum,
        description: PANIC_MESSAGES[codeNum] ?? `Panic 0x${codeNum.toString(16)}`,
      };
    } catch {
      return { type: 'unknown', raw: normalised, selectorHex: selector };
    }
  }

  // Flavor C — Custom error from the contract's ABI.
  if (abi.length > 0) {
    try {
      const iface = new Interface(abi as readonly unknown[] as []);
      const parsed = iface.parseError(normalised);
      if (parsed) {
        const args = parsed.fragment.inputs.map((input, i) => ({
          name: input.name || `_${i}`,
          type: input.type,
          value: jsifyAbiValue(parsed.args[i]),
        }));
        return { type: 'custom', errorName: parsed.name, args };
      }
    } catch {
      // ABI didn't include this selector; fall through to "unknown".
    }
  }

  return { type: 'unknown', raw: normalised, selectorHex: selector };
}

/**
 * ethers v6 returns its own typed value wrappers (Result, BigNumberish).
 * Coerce them to plain JS so consumers don't have to import ethers.
 */
function jsifyAbiValue(v: unknown): unknown {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map(jsifyAbiValue);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) {
      // Skip the numeric-key shadow Result emits alongside named keys.
      if (!/^\d+$/.test(k)) out[k] = jsifyAbiValue(val);
    }
    return out;
  }
  return v;
}

/**
 * Lightweight JSON envelope used by the chain targets to round-trip the
 * decoded result through Zustand without re-running the decoder on
 * every render. Stored in `TxReceipt.revertReason` as a JSON string.
 *
 *   { "raw": "0x08c379a0…", "decoded": { "type": "string", "message": "…" } }
 *
 * `parseRevertReason` reverses the envelope and tolerates the older
 * plain-text shape from pre-Sprint-25 receipts.
 */
export interface RevertEnvelope {
  raw: string;
  decoded: DecodedRevert;
}

export function buildRevertEnvelope(rawHex: string, abi: unknown[]): string {
  const decoded = decodeRevert(rawHex, abi);
  const env: RevertEnvelope = { raw: rawHex, decoded };
  return JSON.stringify(env);
}

export function parseRevertReason(reason: string | undefined): RevertEnvelope | { fallback: string } {
  if (!reason) return { fallback: 'Reverted (no reason given)' };
  // New-style envelope.
  if (reason.startsWith('{')) {
    try {
      const parsed = JSON.parse(reason) as RevertEnvelope;
      if (parsed && parsed.decoded) return parsed;
    } catch {
      // fall through
    }
  }
  // Legacy plain-text reason from pre-Sprint-25 receipts.
  return { fallback: reason };
}
