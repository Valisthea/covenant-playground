/**
 * Architecture Layer Explorer (Sprint 21).
 *
 * Side panel that surfaces which Styx layers (FORTRESS / VEIL / PRISM /
 * OBLIVION) the contract uses, where, and how often. Click an
 * occurrence to jump the source editor to that line.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';

import { useStore } from '../../lib/store';
import {
  analyzeLayers,
  type LayerAnalysis,
  type LayerId,
} from '../../lib/layer-analysis';

import { LayerCard } from './LayerCard';
import { ArchitectureSummary } from './ArchitectureSummary';
import './LayerExplorer.css';

const LAYER_ORDER: LayerId[] = ['fortress', 'veil', 'prism', 'oblivion'];

interface Props {
  /** Initial expanded layer (e.g. from `?layer=veil`). */
  initialExpanded?: LayerId | null;
  onNavigateToLine: (line: number) => void;
  onClose?: () => void;
}

export function LayerExplorer({
  initialExpanded = null,
  onNavigateToLine,
  onClose,
}: Props) {
  const source = useStore((s) => s.source);
  const [analysis, setAnalysis] = useState<LayerAnalysis | null>(null);
  const [expanded, setExpanded] = useState<LayerId | null>(initialExpanded);
  const [debouncing, setDebouncing] = useState(false);

  // Debounced analysis — 400ms after the user stops typing.
  useEffect(() => {
    setDebouncing(true);
    const t = window.setTimeout(() => {
      setAnalysis(analyzeLayers(source));
      setDebouncing(false);
    }, 400);
    return () => {
      clearTimeout(t);
    };
  }, [source]);

  // First-paint: don't make the user wait the full debounce window.
  useEffect(() => {
    if (analysis === null) {
      setAnalysis(analyzeLayers(source));
      setDebouncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the URL pre-expanded a layer that isn't actually used, collapse.
  useEffect(() => {
    if (!analysis || !expanded) return;
    if (!analysis[expanded].used) setExpanded(null);
  }, [analysis, expanded]);

  const handleShareLink = useMemo(
    () => () => {
      const url = new URL(window.location.href);
      url.searchParams.set('layout', 'inspect');
      if (expanded) url.searchParams.set('layer', expanded);
      else url.searchParams.delete('layer');
      void navigator.clipboard?.writeText(url.toString());
    },
    [expanded],
  );

  if (!analysis) {
    return (
      <aside className="le-pane">
        <header className="le-header">
          <h3 className="le-title">Styx Architecture</h3>
        </header>
        <div className="le-loading">Analyzing…</div>
      </aside>
    );
  }

  const { summary } = analysis;

  return (
    <aside className="le-pane" aria-label="Styx architecture explorer">
      <header className="le-header">
        <div className="le-title-row">
          <h3 className="le-title">Styx Architecture</h3>
          <div className="le-header-actions">
            <button
              type="button"
              className="le-icon-btn"
              onClick={handleShareLink}
              title="Copy a link to this view"
            >
              <Link2 size={13} />
            </button>
            {onClose && (
              <button
                type="button"
                className="le-icon-btn"
                onClick={onClose}
                title="Hide architecture panel"
                aria-label="Hide architecture panel"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <p className="le-subtitle">
          Which cryptographic layers your contract uses{' '}
          {debouncing && <span className="le-stale">· refreshing…</span>}
        </p>
      </header>

      <ArchitectureSummary summary={summary} />

      <div className="le-cards">
        {LAYER_ORDER.map((id) => (
          <LayerCard
            key={id}
            layerId={id}
            usage={analysis[id]}
            expanded={expanded === id}
            onToggle={() => setExpanded(expanded === id ? null : id)}
            onNavigateToLine={onNavigateToLine}
          />
        ))}
      </div>

      {summary.layersUsed === 0 && (
        <div className="le-empty">
          <strong>Plain storage only.</strong>
          <p>
            This contract uses no Styx primitives yet. Add{' '}
            <code>encrypted</code>, <code>@verified_by(...)</code>,{' '}
            <code>@pq_signed(...)</code>, or a <code>ceremony</code> to unlock
            Covenant's unique layers.
          </p>
          <a href="/tour" className="le-empty-cta">
            Start the privacy tour →
          </a>
        </div>
      )}

      {analysis.synthetic && (
        <div className="le-synthetic" title="Heuristic regex pass — will be replaced by Rust analyzer output">
          synthesized
        </div>
      )}
    </aside>
  );
}
