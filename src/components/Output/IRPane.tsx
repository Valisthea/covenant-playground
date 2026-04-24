import { useStore } from '../../lib/store';

export function IRPane() {
  const result = useStore((s) => s.compileResult);

  if (!result?.ir) {
    return (
      <div className="output-empty">
        No IR captured. The wasm-bindgen facade currently emits WASM only —
        IR dump will light up when the compiler is rebuilt with
        <code> --emit-ir</code> plumbed through.
      </div>
    );
  }

  return <div className="code-display">{result.ir}</div>;
}
