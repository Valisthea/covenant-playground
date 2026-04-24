import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { analyzeSource, KIND_META, type PrivacyKind } from '../../lib/source-analyzer';
import { FlowVisualizer } from './FlowVisualizer';
import { FheSandbox } from './FheSandbox';
import { ZkSandbox } from './ZkSandbox';
import { AmnesiaSandbox } from './AmnesiaSandbox';

type SubTab = 'flow' | 'fhe' | 'zk' | 'amnesia';

export function PrivacyTab() {
  const source = useStore((s) => s.source);
  const report = useMemo(() => analyzeSource(source), [source]);
  const [sub, setSub] = useState<SubTab>('flow');

  return (
    <div className="privacy-tab">
      {/* Primitive summary chips */}
      <div className="priv-summary">
        {(Object.keys(report.byKind) as PrivacyKind[]).map((k) => {
          const count = report.byKind[k].length;
          if (count === 0) return null;
          const meta = KIND_META[k];
          return (
            <span
              key={k}
              className="priv-chip"
              style={{ borderColor: meta.color, color: meta.color }}
              title={meta.sublabel}
            >
              {meta.label} · {count}
            </span>
          );
        })}
        {report.hits.length === 0 && (
          <span className="priv-empty-chip">
            No privacy primitives detected in this contract.
          </span>
        )}
      </div>

      {/* Sub-tab bar */}
      <nav className="priv-subtabs" role="tablist">
        <SubTabBtn
          active={sub === 'flow'}
          onClick={() => setSub('flow')}
          label="Flow"
          badge={report.hits.length}
        />
        <SubTabBtn
          active={sub === 'fhe'}
          onClick={() => setSub('fhe')}
          label="FHE"
          disabled={false}
          hint={report.hasFhe ? undefined : 'No FHE primitives in source — sandbox still usable.'}
        />
        <SubTabBtn
          active={sub === 'zk'}
          onClick={() => setSub('zk')}
          label="ZK"
          disabled={false}
          hint={report.hasZk ? undefined : 'No ZK primitives in source — sandbox still usable.'}
        />
        <SubTabBtn
          active={sub === 'amnesia'}
          onClick={() => setSub('amnesia')}
          label="Amnesia"
          disabled={false}
          hint={
            report.hasAmnesia ? undefined : 'No @destroy in source — sandbox still usable.'
          }
        />
      </nav>

      <div className="priv-panel">
        {sub === 'flow' && <FlowVisualizer source={source} report={report} />}
        {sub === 'fhe' && <FheSandbox />}
        {sub === 'zk' && <ZkSandbox />}
        {sub === 'amnesia' && <AmnesiaSandbox />}
      </div>
    </div>
  );
}

function SubTabBtn({
  active,
  onClick,
  label,
  badge,
  disabled,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`priv-subtab ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={hint}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="priv-subtab-badge">{badge}</span>
      )}
    </button>
  );
}
