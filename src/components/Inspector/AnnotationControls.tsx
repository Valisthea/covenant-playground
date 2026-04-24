import { useStore } from '../../lib/store';

export function AnnotationControls() {
  const showGas = useStore((s) => s.showGasAnnotations);
  const showNoise = useStore((s) => s.showNoiseAnnotations);
  const showConstraints = useStore((s) => s.showConstraintAnnotations);
  const setShowGas = useStore((s) => s.setShowGasAnnotations);
  const setShowNoise = useStore((s) => s.setShowNoiseAnnotations);
  const setShowConstraints = useStore((s) => s.setShowConstraintAnnotations);

  return (
    <div className="ai-anno-controls">
      <label className="ai-anno-label">
        <input
          type="checkbox"
          checked={showGas}
          onChange={(e) => setShowGas(e.target.checked)}
        />
        <span>Gas / line</span>
      </label>
      <label className="ai-anno-label">
        <input
          type="checkbox"
          checked={showNoise}
          onChange={(e) => setShowNoise(e.target.checked)}
        />
        <span>FHE noise</span>
      </label>
      <label className="ai-anno-label">
        <input
          type="checkbox"
          checked={showConstraints}
          onChange={(e) => setShowConstraints(e.target.checked)}
        />
        <span>ZK constraints</span>
      </label>
    </div>
  );
}
