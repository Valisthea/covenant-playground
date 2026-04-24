import type { SourceMapStats } from '../../lib/source-map';
import { formatGas } from '../../lib/source-map';

interface Props {
  stats: SourceMapStats | null;
}

export function ArtifactStats({ stats }: Props) {
  if (!stats) {
    return (
      <div className="ai-stats">
        <div className="ai-stat ai-stat-muted">No artifacts — compile first.</div>
      </div>
    );
  }
  return (
    <div className="ai-stats">
      <Stat label="Instructions" value={stats.totalInstructions.toString()} />
      <Stat label="Source lines" value={stats.totalSourceLines.toString()} />
      <Stat label="L1 gas" value={`~${formatGas(stats.totalGasL1)}`} />
      {stats.totalGasPgas > 0 && (
        <Stat label="pGas" value={`~${formatGas(stats.totalGasPgas)}`} accent />
      )}
      {stats.fheOperations > 0 && (
        <Stat label="FHE ops" value={stats.fheOperations.toString()} accent="fhe" />
      )}
      {stats.zkOperations > 0 && (
        <Stat label="ZK ops" value={stats.zkOperations.toString()} accent="zk" />
      )}
      {stats.totalConstraints > 0 && (
        <Stat label="Constraints" value={`~${formatGas(stats.totalConstraints)}`} accent="zk" />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean | 'fhe' | 'zk';
}) {
  const cls =
    accent === 'fhe'
      ? 'ai-stat ai-stat-fhe'
      : accent === 'zk'
        ? 'ai-stat ai-stat-zk'
        : accent
          ? 'ai-stat ai-stat-accent'
          : 'ai-stat';
  return (
    <div className={cls}>
      <span className="ai-stat-label">{label}</span>
      <span className="ai-stat-value">{value}</span>
    </div>
  );
}
