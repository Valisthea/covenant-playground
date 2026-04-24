import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

/**
 * URL-encode a Covenant source snippet for sharing.
 *
 * We use lz-string's URI-safe variant so the output can be pasted into
 * Twitter or a markdown link without additional escaping. For typical
 * Covenant examples (<4 KB source) the compressed+encoded payload fits
 * comfortably under the 2,000-char practical URL limit.
 */
export function generateShareUrl(source: string): string {
  const compressed = compressToEncodedURIComponent(source);
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://playground.covenant-lang.org/';
  return `${base}?code=${compressed}`;
}

export function parseShareUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const encoded = parsed.searchParams.get('code');
    if (!encoded) return null;
    const decoded = decompressFromEncodedURIComponent(encoded);
    return decoded || null;
  } catch {
    return null;
  }
}

/** Best-effort length budget check — useful for UX warnings. */
export function estimateShareUrlBytes(source: string): number {
  return compressToEncodedURIComponent(source).length + 64; // +origin/path
}
