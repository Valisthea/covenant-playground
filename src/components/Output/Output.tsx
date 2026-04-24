import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { DiagnosticsPane } from './DiagnosticsPane';
import { BytecodePane } from './BytecodePane';
import { AbiPane } from './AbiPane';
import { IRPane } from './IRPane';
import { DeployPanel } from '../Deploy/DeployPanel';
import { TxHistoryPane } from '../Deploy/TxHistoryPane';
import { PrivacyTab } from '../Privacy/PrivacyTab';
import { getMockChain } from '../../lib/mockchain';
import { analyzeSource } from '../../lib/source-analyzer';

type Tab = 'diagnostics' | 'bytecode' | 'abi' | 'ir' | 'deploy' | 'txs' | 'privacy';

export function Output() {
  const [tab, setTab] = useState<Tab>('diagnostics');
  const result = useStore((s) => s.compileResult);
  const diagnostics = useStore((s) => s.diagnostics);
  const isCompiling = useStore((s) => s.isCompiling);
  const lastCompileAt = useStore((s) => s.lastCompileAt);
  // Subscribe to chainRev so the tx-count badge updates live.
  useStore((s) => s.chainRev);

  const { errorCount, warnCount } = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    for (const d of diagnostics) {
      if (d.severity === 'error') errorCount++;
      else if (d.severity === 'warning') warnCount++;
    }
    return { errorCount, warnCount };
  }, [diagnostics]);

  const source = useStore((s) => s.source);
  const hasBytecode = !!result?.wasm || !!result?.bytecode;
  const hasAbi = !!result?.abi && result.abi.length > 0;
  const hasIr = !!result?.ir;
  const canDeploy = !!result?.ok;
  const txCount = getMockChain().txs.length;
  const privacyHits = useMemo(() => analyzeSource(source).hits.length, [source]);

  return (
    <>
      <div className="output-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'diagnostics'}
          className={tab === 'diagnostics' ? 'active' : ''}
          onClick={() => setTab('diagnostics')}
          type="button"
        >
          Diagnostics
          {errorCount > 0 && <span className="badge">{errorCount}</span>}
          {errorCount === 0 && warnCount > 0 && (
            <span className="badge badge--warn">{warnCount}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'bytecode'}
          className={tab === 'bytecode' ? 'active' : ''}
          onClick={() => setTab('bytecode')}
          disabled={!hasBytecode}
          type="button"
        >
          Output
        </button>
        <button
          role="tab"
          aria-selected={tab === 'abi'}
          className={tab === 'abi' ? 'active' : ''}
          onClick={() => setTab('abi')}
          disabled={!hasAbi}
          type="button"
        >
          ABI
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ir'}
          className={tab === 'ir' ? 'active' : ''}
          onClick={() => setTab('ir')}
          disabled={!hasIr}
          type="button"
        >
          IR
        </button>
        <button
          role="tab"
          aria-selected={tab === 'deploy'}
          className={tab === 'deploy' ? 'active' : ''}
          onClick={() => setTab('deploy')}
          disabled={!canDeploy}
          type="button"
          title={canDeploy ? 'Deploy & interact' : 'Compile cleanly to enable deploy'}
        >
          Deploy
        </button>
        <button
          role="tab"
          aria-selected={tab === 'txs'}
          className={tab === 'txs' ? 'active' : ''}
          onClick={() => setTab('txs')}
          type="button"
        >
          Txs
          {txCount > 0 && <span className="badge badge--neutral">{txCount}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'privacy'}
          className={tab === 'privacy' ? 'active' : ''}
          onClick={() => setTab('privacy')}
          type="button"
          title="Privacy flow + FHE/ZK/Amnesia sandboxes"
        >
          Privacy
          {privacyHits > 0 && (
            <span className="badge badge--neutral">{privacyHits}</span>
          )}
        </button>

        <div style={{ flex: 1 }} />
        <StatusBadge isCompiling={isCompiling} timing={result?.timing.total} lastAt={lastCompileAt} />
      </div>

      <div className="output-content">
        {tab === 'diagnostics' && <DiagnosticsPane />}
        {tab === 'bytecode' && <BytecodePane />}
        {tab === 'abi' && <AbiPane />}
        {tab === 'ir' && <IRPane />}
        {tab === 'deploy' && <DeployPanel />}
        {tab === 'txs' && <TxHistoryPane />}
        {tab === 'privacy' && <PrivacyTab />}
      </div>
    </>
  );
}

function StatusBadge({
  isCompiling,
  timing,
  lastAt,
}: {
  isCompiling: boolean;
  timing: number | undefined;
  lastAt: number | null;
}) {
  if (isCompiling) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '7.5pt',
          color: 'var(--accent)',
          padding: '8px 12px',
          letterSpacing: '0.08em',
        }}
      >
        compiling…
      </span>
    );
  }
  if (!lastAt || timing === undefined) return null;
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '7.5pt',
        color: 'var(--ink-faint)',
        padding: '8px 12px',
        letterSpacing: '0.08em',
      }}
      title={`Compiled ${new Date(lastAt).toLocaleTimeString()}`}
    >
      {timing.toFixed(0)}ms
    </span>
  );
}
