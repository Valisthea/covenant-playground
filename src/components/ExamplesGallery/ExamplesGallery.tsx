/**
 * Examples Gallery — full-page route at /examples (Sprint 19).
 *
 * Replaces the original modal gallery (src/lib/examples.ts). This version
 * is driven by the richer `src/examples/registry.ts` with 25 curated
 * examples across 5 categories, search + filter + detail panel.
 */
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen } from 'lucide-react';

import {
  ALL_EXAMPLES,
  getGalleryStats,
  searchExamples,
} from '../../examples/registry';
import type {
  Example,
  ExampleCategory,
  DifficultyLevel,
} from '../../examples/types';
import { difficultyLabel } from '../../examples/types';

import { ExampleCard } from './ExampleCard';
import { CategoryTabs, type TabKey } from './CategoryTabs';
import { ExampleDetailPanel } from './ExampleDetailPanel';

import './ExamplesGallery.css';

const DIFFICULTIES: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export function ExamplesGallery() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TabKey>('all');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [selected, setSelected] = useState<Example | null>(null);

  const stats = useMemo(() => getGalleryStats(), []);

  // Derived list: apply search, then category, then difficulty
  const visible = useMemo(() => {
    let list = searchExamples(query);
    if (category !== 'all') {
      list = list.filter((e) => e.category === category);
    }
    if (difficulty !== 'all') {
      list = list.filter((e) => e.difficulty === difficulty);
    }
    // Stable sort: category order, then slot order
    const catOrder: Record<ExampleCategory, number> = {
      basics: 0,
      defi: 1,
      privacy: 2,
      governance: 3,
      advanced: 4,
    };
    return [...list].sort((a, b) => {
      const c = catOrder[a.category] - catOrder[b.category];
      return c !== 0 ? c : a.order - b.order;
    });
  }, [query, category, difficulty]);

  // Counts per tab reflect the current search, so the user sees empty tabs
  // when a search has no matches in that category.
  const tabCounts = useMemo(() => {
    const searched = searchExamples(query);
    const base: Record<TabKey, number> = {
      all: searched.length,
      basics: 0,
      defi: 0,
      privacy: 0,
      governance: 0,
      advanced: 0,
    };
    for (const e of searched) {
      base[e.category]++;
    }
    return base;
  }, [query]);

  // Update the document title to match the page
  useEffect(() => {
    const prev = document.title;
    document.title = 'Examples — Covenant Playground';
    return () => {
      document.title = prev;
    };
  }, []);

  const handleOpen = (ex: Example) => {
    // Route into the playground with a query param that the Playground route
    // picks up to fetch + load the .cov source.
    navigate(`/?example=${ex.id}`);
  };

  return (
    <div className="eg-page">
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="eg-topbar">
        <a href="/" className="eg-topbar-brand">
          <svg width="24" height="24" viewBox="0 0 96 96" aria-hidden="true">
            <path
              d="M 32 20 L 20 20 L 20 76 L 32 76"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="square"
            />
            <path
              d="M 64 20 L 76 20 L 76 76 L 64 76"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="square"
            />
            <rect x="40" y="40" width="16" height="16" fill="var(--accent)" />
          </svg>
          <strong>Covenant</strong>
          <span className="eg-topbar-badge">Examples</span>
        </a>
        <div className="eg-topbar-spacer" />
        <a href="/" className="eg-topbar-link">Playground</a>
        <a href="/tour" className="eg-topbar-link">Tour</a>
        <a
          href="https://docs.covenant-lang.org"
          className="eg-topbar-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs
        </a>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="eg-hero">
        <h1 className="eg-hero-title">
          <BookOpen size={28} style={{ verticalAlign: -4, marginRight: 10, color: 'var(--accent)' }} />
          Examples Gallery
        </h1>
        <p className="eg-hero-subtitle">
          25 annotated contracts across 5 categories — from the minimal
          Hello Covenant to cross-chain shielded bridges. Each example
          ships with background, modifications to try, and a direct launch
          into the playground.
        </p>
        <div className="eg-hero-stats">
          <span className="eg-hero-stat">
            <strong>{stats.total}</strong> examples
          </span>
          <span className="eg-hero-stat">
            <strong>{stats.byCategory.basics}</strong> basics
          </span>
          <span className="eg-hero-stat">
            <strong>{stats.byCategory.defi}</strong> defi
          </span>
          <span className="eg-hero-stat">
            <strong>{stats.byCategory.privacy}</strong> privacy
          </span>
          <span className="eg-hero-stat">
            <strong>{stats.byCategory.governance}</strong> governance
          </span>
          <span className="eg-hero-stat">
            <strong>{stats.byCategory.advanced}</strong> advanced
          </span>
        </div>
      </section>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="eg-toolbar">
        <div className="eg-search">
          <Search size={14} className="eg-search-icon" />
          <input
            className="eg-search-input"
            placeholder="Search examples — title, description, tag, id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search examples"
          />
        </div>

        <div className="eg-filter">
          <span>Difficulty:</span>
          <button
            type="button"
            className={`eg-filter-chip ${difficulty === 'all' ? 'is-active' : ''}`}
            onClick={() => setDifficulty('all')}
          >
            all
          </button>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              className={`eg-filter-chip ${difficulty === d ? 'is-active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {difficultyLabel(d).toLowerCase()} ({stats.byDifficulty[d]})
            </button>
          ))}
        </div>
      </div>

      {/* ── Category Tabs ──────────────────────────────────────────────── */}
      <CategoryTabs active={category} counts={tabCounts} onChange={setCategory} />

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      <div className="eg-grid">
        {visible.length === 0 ? (
          <div className="eg-empty">
            <strong>No examples match your filters.</strong>
            Try a different keyword, relax the difficulty filter,
            or switch to the "All" tab.
          </div>
        ) : (
          visible.map((ex) => (
            <ExampleCard
              key={ex.id}
              example={ex}
              onClick={() => setSelected(ex)}
            />
          ))
        )}
      </div>

      {/* ── Detail Panel ───────────────────────────────────────────────── */}
      {selected && (
        <ExampleDetailPanel
          example={selected}
          onClose={() => setSelected(null)}
          onOpenInPlayground={handleOpen}
          onSelectRelated={(ex) => setSelected(ex)}
        />
      )}
    </div>
  );
}

// Default-export the total count for ad-hoc inspection / debug
export const GALLERY_SIZE = ALL_EXAMPLES.length;
