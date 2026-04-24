import { useStore } from '../../lib/store';

export function AbiPane() {
  const result = useStore((s) => s.compileResult);

  if (!result?.abi || result.abi.length === 0) {
    return (
      <div className="output-empty">
        No ABI available. Ship the EVM backend bridge in Tier 2 to populate this.
      </div>
    );
  }

  return (
    <div className="code-display">{JSON.stringify(result.abi, null, 2)}</div>
  );
}
