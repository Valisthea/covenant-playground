import { useMemo } from 'react';
import { useStore } from '../../lib/store';

export function BytecodePane() {
  const result = useStore((s) => s.compileResult);

  const wasmHex = useMemo(() => {
    if (!result?.wasm) return null;
    return (
      '0x' +
      Array.from(result.wasm)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }, [result?.wasm]);

  if (!result) {
    return <div className="output-empty">Nothing to display yet.</div>;
  }

  const wasmSize = result.wasm?.byteLength ?? 0;

  return (
    <div>
      <div className="code-meta">
        {result.metadata?.module_name && (
          <span className="code-meta-item">
            <span className="code-meta-label">module</span>
            <span className="code-meta-value">{result.metadata.module_name}</span>
          </span>
        )}
        <span className="code-meta-item">
          <span className="code-meta-label">wasm size</span>
          <span className="code-meta-value">
            {wasmSize > 0 ? `${wasmSize} bytes` : '—'}
          </span>
        </span>
        {result.metadata?.memory_pages !== undefined && (
          <span className="code-meta-item">
            <span className="code-meta-label">memory pages</span>
            <span className="code-meta-value">{result.metadata.memory_pages}</span>
          </span>
        )}
        {result.metadata?.compiler_version && (
          <span className="code-meta-item">
            <span className="code-meta-label">compiler</span>
            <span className="code-meta-value">{result.metadata.compiler_version}</span>
          </span>
        )}
      </div>

      {result.metadata?.exports && result.metadata.exports.length > 0 && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '7.5pt',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              margin: '6px 0',
            }}
          >
            Exports
          </div>
          <div className="code-display">
            {result.metadata.exports.join('\n')}
          </div>
        </>
      )}

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '7.5pt',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          margin: '14px 0 6px',
        }}
      >
        WASM hex
      </div>
      <div className="code-display code-display-hex">
        {wasmHex ?? '—'}
      </div>

      {result.bytecode && result.bytecode !== wasmHex && (
        <>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '7.5pt',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              margin: '14px 0 6px',
            }}
          >
            EVM bytecode
          </div>
          <div className="code-display code-display-hex">{result.bytecode}</div>
        </>
      )}
    </div>
  );
}
