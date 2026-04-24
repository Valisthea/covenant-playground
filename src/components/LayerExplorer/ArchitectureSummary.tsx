import {
  LAYER_METADATA,
  type ArchitectureSummary as SummaryData,
} from '../../lib/layer-analysis';

interface Props {
  summary: SummaryData;
}

const PROFILE_LABELS: Record<SummaryData['privacyProfile'], string> = {
  plain: 'Plain',
  encrypted: 'Encrypted',
  'zk-gated': 'ZK-gated',
  'amnesia-protected': 'Amnesia',
  'post-quantum': 'Post-quantum',
  hybrid: 'Hybrid',
};

export function ArchitectureSummary({ summary }: Props) {
  const primaryColor = summary.primaryLayer
    ? LAYER_METADATA[summary.primaryLayer].color
    : 'var(--ink-mute)';
  const primaryLabel = summary.primaryLayer
    ? LAYER_METADATA[summary.primaryLayer].title
    : '—';

  return (
    <section className="le-summary" aria-label="Architecture summary">
      <div className="le-summary-grid">
        <SummaryCell value={`${summary.layersUsed}/4`} label="Layers used" />
        <SummaryCell
          value={summary.totalCryptoOperations.toString()}
          label="Crypto ops"
        />
        <SummaryCell
          value={PROFILE_LABELS[summary.privacyProfile]}
          label="Profile"
        />
        <SummaryCell
          value={primaryLabel}
          label="Primary layer"
          color={primaryColor}
        />
      </div>
    </section>
  );
}

function SummaryCell({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="le-summary-cell">
      <span className="le-summary-value" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="le-summary-label">{label}</span>
    </div>
  );
}
