import { useStore } from '../../lib/store';
import { Columns2, Columns3 } from 'lucide-react';

interface Props {
  /** Whether the inspector is even available (we hide the toggle entirely
   *  on mobile, but parents may also disable it). */
  disabled?: boolean;
}

/**
 * Sprint 20 — Simple ⇄ Inspect layout toggle.
 *
 * Simple  = editor + output (2-pane, default).
 * Inspect = editor + artifact inspector + output (3-pane).
 */
export function LayoutToggle({ disabled }: Props) {
  const layoutMode = useStore((s) => s.layoutMode);
  const setLayoutMode = useStore((s) => s.setLayoutMode);

  return (
    <div className="pg-layout-toggle" role="tablist" aria-label="Layout mode">
      <button
        type="button"
        role="tab"
        aria-selected={layoutMode === 'simple'}
        className={`pg-layout-btn ${layoutMode === 'simple' ? 'is-active' : ''}`}
        onClick={() => setLayoutMode('simple')}
        title="Simple — editor + output"
        disabled={disabled}
      >
        <Columns2 size={13} />
        <span>Simple</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={layoutMode === 'inspect'}
        className={`pg-layout-btn ${layoutMode === 'inspect' ? 'is-active' : ''}`}
        onClick={() => setLayoutMode('inspect')}
        title="Inspect — editor + artifact inspector + output"
        disabled={disabled}
      >
        <Columns3 size={13} />
        <span>Inspect</span>
      </button>
    </div>
  );
}
