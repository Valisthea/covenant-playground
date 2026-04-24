import { useStore } from '../../lib/store';

export function DiagnosticsPane() {
  const diagnostics = useStore((s) => s.diagnostics);
  const result = useStore((s) => s.compileResult);
  const isCompiling = useStore((s) => s.isCompiling);

  if (diagnostics.length === 0) {
    if (isCompiling) {
      return (
        <div className="output-empty">First compile running…</div>
      );
    }
    if (result?.ok) {
      const ms = result.timing.total.toFixed(0);
      return (
        <div className="diag-success">
          <span className="diag-success-icon" aria-hidden="true">✓</span>
          <span>
            Compiled successfully in {ms}ms. No diagnostics.
          </span>
        </div>
      );
    }
    return (
      <div className="output-empty">
        Press <kbd>Ctrl+S</kbd> or click Compile to build.
      </div>
    );
  }

  return (
    <div>
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={`diag-item diag-item--${d.severity}`}
          role="button"
          tabIndex={0}
        >
          <div>
            <span className={`diag-level diag-level--${d.severity}`}>
              {d.severity}
            </span>
            {d.code && <span className="diag-code">[{d.code}]</span>}
          </div>
          <div className="diag-message">{d.message}</div>
          <div className="diag-location">
            main.cov:{d.line}:{d.column}
          </div>
        </div>
      ))}
    </div>
  );
}
