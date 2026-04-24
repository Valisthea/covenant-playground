import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import {
  LAYER_METADATA,
  type LayerId,
  type LayerUsage,
} from '../../lib/layer-analysis';
import { LayerIcon } from './LayerIcon';

interface Props {
  layerId: LayerId;
  usage: LayerUsage;
  expanded: boolean;
  onToggle: () => void;
  onNavigateToLine: (line: number) => void;
}

export function LayerCard({
  layerId,
  usage,
  expanded,
  onToggle,
  onNavigateToLine,
}: Props) {
  const meta = LAYER_METADATA[layerId];
  const isUsed = usage.used;

  return (
    <div
      className={`le-card ${isUsed ? 'is-used' : 'is-unused'} ${
        expanded ? 'is-expanded' : ''
      }`}
      style={{ ['--layer-color' as string]: meta.color }}
    >
      <button
        type="button"
        className="le-card-header"
        onClick={() => isUsed && onToggle()}
        disabled={!isUsed}
        aria-expanded={expanded}
        aria-controls={`le-card-body-${layerId}`}
      >
        <div className="le-card-title">
          <LayerIcon
            layer={layerId}
            size={18}
            color={isUsed ? meta.color : 'var(--ink-faint)'}
          />
          <div className="le-card-titles">
            <h4>{meta.title}</h4>
            <span className="le-card-subtitle">{meta.subtitle}</span>
          </div>
        </div>

        <div className="le-card-status">
          {isUsed ? (
            <>
              <span className="le-usage-count">{usage.usageCount}</span>
              <span className="le-usage-label">
                {usage.usageCount === 1 ? 'occurrence' : 'occurrences'}
              </span>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </>
          ) : (
            <span className="le-not-used">Not used</span>
          )}
        </div>
      </button>

      {isUsed && (
        <div className="le-complexity-bar" title={`Complexity ${usage.complexityScore}/100`}>
          <div
            className="le-complexity-fill"
            style={{
              width: `${usage.complexityScore}%`,
              background: meta.color,
            }}
          />
          <span className="le-complexity-label">
            Complexity {usage.complexityScore}/100
          </span>
        </div>
      )}

      {expanded && (
        <div
          className="le-card-body"
          id={`le-card-body-${layerId}`}
          role="region"
        >
          <p className="le-layer-description">{meta.description}</p>

          <h5 className="le-occurrences-title">
            Occurrences in your contract
          </h5>
          <ul className="le-occurrence-list">
            {usage.occurrences.map((occ, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="le-occurrence"
                  onClick={() => onNavigateToLine(occ.span.startLine)}
                  title={`Jump to line ${occ.span.startLine}`}
                >
                  <div className="le-occurrence-row">
                    <span className="le-kind-badge">{formatKind(occ.kind)}</span>
                    <span className="le-line-ref">
                      L{occ.span.startLine}
                    </span>
                    <ArrowRight
                      size={11}
                      className="le-occurrence-arrow"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="le-occurrence-desc">{occ.description}</div>
                  <code className="le-occurrence-context">{occ.context}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatKind(kind: string): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
