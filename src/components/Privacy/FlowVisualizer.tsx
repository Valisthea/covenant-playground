import { useState } from 'react';
import {
  KIND_META,
  type PrivacyHit,
  type PrivacyReport,
} from '../../lib/source-analyzer';

/**
 * Render the source with privacy primitives highlighted in-line. Clicking
 * a hit opens the side panel with its blurb. No Monaco here — just a
 * read-only decorated <pre> so this pane is cheap to render next to the
 * main editor.
 */
export function FlowVisualizer({
  source,
  report,
}: {
  source: string;
  report: PrivacyReport;
}) {
  const [selected, setSelected] = useState<PrivacyHit | null>(null);

  if (report.hits.length === 0) {
    return (
      <div className="pane-empty">
        <p>
          This contract doesn't use FHE, ZK, PQ signatures, or cryptographic
          amnesia primitives.
        </p>
        <p className="pane-empty__sub">
          Try the <code>03-encrypted-token</code>, <code>08-private-voting</code>,
          or <code>15-amnesia-ceremony</code> example to see the flow
          visualizer light up.
        </p>
      </div>
    );
  }

  return (
    <div className="flow-grid">
      <pre className="flow-source">{renderDecoratedSource(source, report, selected, setSelected)}</pre>

      <aside className="flow-aside">
        {selected ? (
          <>
            <h4 className="flow-aside__label" style={{ color: KIND_META[selected.kind].color }}>
              {KIND_META[selected.kind].label} · {selected.label}
            </h4>
            <p className="flow-aside__line">
              line {selected.line} · {KIND_META[selected.kind].sublabel}
            </p>
            <p className="flow-aside__blurb">{selected.blurb}</p>
          </>
        ) : (
          <p className="flow-aside__hint">
            Click a highlighted token in the source to see what it does.
          </p>
        )}

        <div className="flow-legend">
          {Object.entries(KIND_META).map(([k, m]) => (
            <div key={k} className="flow-legend-row">
              <span
                className="flow-legend-sw"
                style={{ background: m.color }}
                aria-hidden="true"
              />
              <strong>{m.label}</strong>
              <span>{m.sublabel}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/**
 * Walk the source and produce a sequence of React nodes: plain text
 * spans interleaved with highlighted <mark> spans for each privacy hit.
 */
function renderDecoratedSource(
  source: string,
  report: PrivacyReport,
  selected: PrivacyHit | null,
  setSelected: (h: PrivacyHit | null) => void,
): React.ReactNode {
  const hits = report.hits;
  if (hits.length === 0) return source;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  hits.forEach((hit, i) => {
    if (hit.start > cursor) {
      nodes.push(source.slice(cursor, hit.start));
    }
    const meta = KIND_META[hit.kind];
    const isSelected =
      selected !== null && selected.start === hit.start && selected.end === hit.end;
    nodes.push(
      <button
        key={i}
        type="button"
        className={`flow-mark ${isSelected ? 'flow-mark--selected' : ''}`}
        style={{
          borderBottomColor: meta.color,
          color: meta.color,
          backgroundColor: isSelected ? `${meta.color}22` : 'transparent',
        }}
        onClick={() => setSelected(isSelected ? null : hit)}
        aria-label={`${meta.label} primitive: ${hit.label}`}
        title={`${meta.label} · click for details`}
      >
        {source.slice(hit.start, hit.end)}
      </button>,
    );
    cursor = hit.end;
  });

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }
  return nodes;
}
