// Examples Gallery — aggregator + lookup helpers (Sprint 19)

import type {
  Example,
  ExampleId,
  ExampleCategory,
  ExampleTag,
  DifficultyLevel,
} from './types';

import { basicsExamples } from './basics';
import { defiExamples } from './defi';
import { privacyExamples } from './privacy';
import { governanceExamples } from './governance';
import { advancedExamples } from './advanced';

// ─── Master registry ────────────────────────────────────────────────────────

export const ALL_EXAMPLES: Example[] = [
  ...basicsExamples,
  ...defiExamples,
  ...privacyExamples,
  ...governanceExamples,
  ...advancedExamples,
];

// Pre-indexed map for O(1) ID lookup.
const BY_ID: Map<ExampleId, Example> = new Map(
  ALL_EXAMPLES.map((e) => [e.id, e]),
);

// ─── Lookup helpers ─────────────────────────────────────────────────────────

export function getExampleById(id: ExampleId): Example | null {
  return BY_ID.get(id) ?? null;
}

export function getExamplesByCategory(category: ExampleCategory): Example[] {
  return ALL_EXAMPLES
    .filter((e) => e.category === category)
    .sort((a, b) => a.order - b.order);
}

export function getExamplesByTag(tag: ExampleTag): Example[] {
  return ALL_EXAMPLES.filter((e) => e.tags.includes(tag));
}

export function getExamplesByDifficulty(level: DifficultyLevel): Example[] {
  return ALL_EXAMPLES.filter((e) => e.difficulty === level);
}

/**
 * Full-text search over title, shortDescription, longDescription, and tags.
 * Case-insensitive. Empty query returns all examples.
 */
export function searchExamples(query: string): Example[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_EXAMPLES;

  return ALL_EXAMPLES.filter((e) => {
    const haystack = [
      e.id,
      e.title,
      e.shortDescription,
      e.longDescription,
      e.tags.join(' '),
      e.category,
      e.difficulty,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface GalleryStats {
  total: number;
  byCategory: Record<ExampleCategory, number>;
  byDifficulty: Record<DifficultyLevel, number>;
}

export function getGalleryStats(): GalleryStats {
  const byCategory: Record<ExampleCategory, number> = {
    basics: 0,
    defi: 0,
    privacy: 0,
    governance: 0,
    advanced: 0,
  };
  const byDifficulty: Record<DifficultyLevel, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    expert: 0,
  };

  for (const e of ALL_EXAMPLES) {
    byCategory[e.category]++;
    byDifficulty[e.difficulty]++;
  }

  return {
    total: ALL_EXAMPLES.length,
    byCategory,
    byDifficulty,
  };
}

// ─── Related-example resolution ─────────────────────────────────────────────

/**
 * Resolves an Example's `relatedExamples` ID references into full Example objects.
 * Missing IDs are silently dropped (useful during authoring / typos).
 */
export function resolveRelated(example: Example): Example[] {
  return example.relatedExamples
    .map((id) => BY_ID.get(id))
    .filter((e): e is Example => e !== undefined);
}
