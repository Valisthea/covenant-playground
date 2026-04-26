/**
 * Layout wrapper for /showcases/* routes.
 *
 * Visually distinct from the playground header (no compile/run buttons,
 * no editor) — this is the production showcase surface, not the
 * sandbox. Branding stays "Covenant" but the badge says "Showcase"
 * with the milestone identifier underneath.
 */

import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  /** Milestone identifier shown in the breadcrumb (e.g. "M2"). Optional. */
  milestone?: string;
  /** Page title shown next to the milestone (e.g. "Audit NFT"). Optional. */
  title?: string;
  /** Page network indicator (e.g. "Sepolia"). Optional. */
  network?: string;
  children: ReactNode;
}

export function ShowcaseLayout({ milestone, title, network, children }: Props) {
  return (
    <div className="showcase-root">
      <header className="showcase-header">
        <a
          href="https://covenant-lang.org"
          className="showcase-brand"
          aria-label="Covenant home"
        >
          <svg width="28" height="28" viewBox="0 0 96 96" aria-hidden="true">
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
            <rect x="40" y="40" width="16" height="16" fill="#7C3AED" />
          </svg>
          <span className="showcase-name">Covenant</span>
          <span className="showcase-badge">Showcase</span>
        </a>

        {milestone && (
          <nav className="showcase-breadcrumb" aria-label="breadcrumb">
            <Link to="/showcases">All showcases</Link>
            <span aria-hidden="true">›</span>
            <span className="showcase-current">
              <strong>{milestone}</strong>
              {title && <> — {title}</>}
              {network && <span className="showcase-network"> · {network}</span>}
            </span>
          </nav>
        )}

        <div className="showcase-header-spacer" />

        <Link to="/" className="showcase-link-playground">
          ← Back to Playground
        </Link>
      </header>

      <main className="showcase-main">{children}</main>

      <footer className="showcase-footer">
        <span>Powered by Covenant V0.9.0</span>
        <span aria-hidden="true">·</span>
        <span>Built by Kairos Lab</span>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/Valisthea/covenant" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://covenant-lang.org" target="_blank" rel="noopener noreferrer">
          Docs
        </a>
      </footer>
    </div>
  );
}
