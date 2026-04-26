// Examples Gallery — data model (Sprint 19)

export type ExampleId = string; // "B1", "D1", "P1", "G1", "A1" …

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type ExampleTag =
  | 'basic' | 'tokens' | 'defi' | 'governance'
  | 'FHE' | 'ZK' | 'PQ' | 'Amnesia'
  | 'bridges' | 'cross-chain' | 'security' | 'identity'
  | 'oracles' | 'upgradeability' | 'integrations'
  | 'auctions' | 'recovery' | 'time' | 'state'
  | 'types' | 'reference' | 'no-privacy' | 'advanced-patterns'
  | 'erc721' | 'erc8231' | 'interface' | 'v09'; // V0.9 additions

export type ExampleCategory = 'basics' | 'defi' | 'privacy' | 'governance' | 'advanced' | 'v09-new';

/**
 * A curated example. Source code is fetched lazily from
 * `public/examples/{sourcePath}` to keep the JS bundle small.
 */
export interface Example {
  id: ExampleId;

  // Classification
  category: ExampleCategory;
  order: number; // 1-5 within category

  // Display metadata
  title: string;
  shortDescription: string;
  longDescription: string;

  // Learning metadata
  difficulty: DifficultyLevel;
  tags: ExampleTag[];
  estimatedReadMinutes: number;
  prerequisites: string[];
  tourLessons: string[]; // e.g. ["M1L1","M1L2"]

  // Source code — served from public/examples/
  sourcePath: string; // e.g. "01-hello.cov"

  // Engagement hooks
  whatToModify: string[];
  relatedExamples: ExampleId[];

  // External references (optional)
  docsLinks: DocLink[];

  // Deployment info (optional)
  deployable: boolean;
  gasEstimate?: string;
  usedInProduction: boolean;
}

export interface DocLink {
  title: string;
  url: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function difficultyColor(level: DifficultyLevel): string {
  const colors: Record<DifficultyLevel, string> = {
    beginner: '#10B981',
    intermediate: '#7C3AED',
    advanced: '#F59E0B',
    expert: '#EF4444',
  };
  return colors[level];
}

export function difficultyLabel(level: DifficultyLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function categoryLabel(cat: ExampleCategory): string {
  const labels: Record<ExampleCategory, string> = {
    basics: 'Basics',
    defi: 'DeFi',
    privacy: 'Privacy',
    governance: 'Governance',
    advanced: 'Advanced',
    'v09-new': 'V0.9 New',
  };
  return labels[cat];
}

/** All valid Tour lesson IDs — used for cross-reference validation. */
export const VALID_TOUR_IDS = [
  'M1L1', 'M1L2', 'M1L3', 'M1L4', 'M1L5',
  'M2L1', 'M2L2', 'M2L3', 'M2L4', 'M2L5',
  'M3L1', 'M3L2', 'M3L3', 'M3L4', 'M3L5',
] as const;
