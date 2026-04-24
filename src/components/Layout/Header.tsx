import { useStore } from '../../lib/store';
import { ThemeToggle } from './ThemeToggle';
import { LayoutToggle } from './LayoutToggle';

interface Props {
  onOpenGallery: () => void;
  onOpenShare: () => void;
}

export function Header({ onOpenGallery, onOpenShare }: Props) {
  const isCompiling = useStore((s) => s.isCompiling);
  const compile = useStore((s) => s.compile);

  return (
    <header className="pg-header">
      <a
        href="https://covenant-lang.org"
        className="pg-header-brand"
        aria-label="Covenant home"
      >
        <svg width="28" height="28" viewBox="0 0 96 96" aria-hidden="true">
          <path
            d="M 32 20 L 20 20 L 20 76 L 32 76"
            stroke="#1a1a1a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="square"
          />
          <path
            d="M 64 20 L 76 20 L 76 76 L 64 76"
            stroke="#1a1a1a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="square"
          />
          <rect x="40" y="40" width="16" height="16" fill="#7C3AED" />
        </svg>
        <span className="pg-header-name">Covenant</span>
        <span className="pg-header-badge">Playground</span>
      </a>

      <div className="pg-header-spacer" />

      <div className="pg-header-actions">
        <LayoutToggle />
        <button className="pg-btn" onClick={onOpenGallery} type="button">
          Examples (25)
        </button>
        <button className="pg-btn" onClick={onOpenShare} type="button">
          Share
        </button>
        <a
          className="pg-btn"
          href="https://docs.covenant-lang.org"
          target="_blank"
          rel="noopener"
        >
          Docs
        </a>
        <ThemeToggle />
        <button
          className="pg-btn pg-btn--primary"
          onClick={() => void compile()}
          disabled={isCompiling}
          type="button"
        >
          {isCompiling ? 'Compiling…' : 'Compile'}
          <span className="pg-btn-kbd">Ctrl+S</span>
        </button>
      </div>
    </header>
  );
}
