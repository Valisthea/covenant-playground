/**
 * Lazy loader for example source code. The `.cov` files live in
 * `public/examples/` and are fetched on demand — this keeps the bundle
 * small (~25 × 3KB would be ~75KB of pure Covenant source otherwise).
 */
import type { Example } from './types';

const sourceCache = new Map<string, string>();

export async function loadExampleSource(example: Example): Promise<string> {
  const key = example.sourcePath;
  const cached = sourceCache.get(key);
  if (cached !== undefined) return cached;

  const response = await fetch(`/examples/${key}`);
  if (!response.ok) {
    throw new Error(`Failed to load example "${example.id}" (${response.status})`);
  }
  const text = await response.text();
  sourceCache.set(key, text);
  return text;
}
