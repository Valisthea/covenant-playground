import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { DiagnosticsPane } from './DiagnosticsPane';
import { BytecodePane } from './BytecodePane';
import { AbiPane } from './AbiPane';
import { IRPane } from './IRPane';

type Tab = 'diagnostics' | 'bytecode' | 'abi' | 'ir';

export function Output() {
  const [tab, setTab] = useState<Tab>('diagnostics');
  const result = useStore((s) => s.compileResult);
  const diagnostics = useStore((s) => s.diagnostics);
  const isCompiling = useStore((s) => s.isCompiling);
  const lastCompileAt = useStore((s) => s.lastCompileAt);

  const { errorCount, warnCount } = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    for (const d of diagnostics) {
      if (d.severity === 'error') errorCount++;
      else if (d.severity === 'warning') warnCount++;
    }
    return { errorCount, warnCount };
  }, [diagnostics]);

  const hasBytecode = !!result?.wasm || !!result?.bytecode;
  const hasAbi = !!result?.abi && result.abi.length > 0;
  const hasIr = !!result?.ir;

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

        <div style={{ flex: 1 }} />
        <StatusBadge isCompiling={isCompiling} timing={result?.timing.total} lastAt={lastCompileAt} />
      </div>

      <div className="output-content">
        {tab === 'diagnostics' && <DiagnosticsPane />}
        {tab === 'bytecode' && <BytecodePane />}
        {tab === 'abi' && <AbiPane />}
        {tab === 'ir' && <IRPane />}
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
