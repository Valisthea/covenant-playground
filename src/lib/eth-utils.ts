/**
 * Ethereum-flavoured address utilities used by the AbiFormBuilder.
 *
 * Wraps ethers v6 helpers behind a small surface so the form components
 * don't have to import all of ethers — keeps the per-field bundle
 * small and the dependency graph tidy.
 */

import { getAddress, isAddress } from 'ethers';

/**
 * `true` if the input is a syntactically valid 20-byte hex address.
 * Accepts mixed-case (no checksum check), all-lowercase, all-uppercase,
 * with or without `0x` prefix. EIP-55 checksum validation is delegated
 * to `toChecksumAddress` — call that to detect a bad-checksum input.
 */
export function isValidAddress(s: string): boolean {
  if (!s) return false;
  return isAddress(s);
}

/**
 * Returns the EIP-55 checksum form of an address. Throws if the input
 * isn't a syntactically valid address — callers should `isValidAddress`
 * first if they want soft validation.
 *
 * Useful for the form's "Fix checksum" inline button: if the user
 * pasted a mixed-case address that doesn't match its checksum, the UI
 * offers a one-click rewrite to the canonical form.
 */
export function toChecksumAddress(s: string): string {
  return getAddress(s);
}

/** True if `value` is a non-prefixed or `0x`-prefixed even-length hex string. */
export function isValidHex(s: string): boolean {
  if (!s) return false;
  const body = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
  if (body.length === 0 || body.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(body);
}

/** True if `value` is `0x` + exactly `2 * byteLen` hex chars. */
export function isValidFixedBytes(s: string, byteLen: number): boolean {
  if (!s.startsWith('0x') && !s.startsWith('0X')) return false;
  const body = s.slice(2);
  if (body.length !== byteLen * 2) return false;
  return /^[0-9a-fA-F]+$/.test(body);
}
