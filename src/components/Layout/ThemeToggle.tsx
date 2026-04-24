import { useSyncExternalStore } from 'react';
import { getTheme, setTheme, type Theme } from '../../lib/theme';

/**
 * Three-state theme toggle: Light → Dark → System → … (cycle).
 * Shown as a compact icon button in the header; tooltip exposes the
 * current mode and the next click target.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);

  const next: Theme =
    theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  const icon =
    theme === 'light' ? (
      // Sun
      <svg viewBox="0 0 20 20" aria-hidden="true" className="theme-icon">
        <circle cx="10" cy="10" r="3.5" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M10 1v2" />
          <path d="M10 17v2" />
          <path d="M1 10h2" />
          <path d="M17 10h2" />
          <path d="M3.5 3.5l1.4 1.4" />
          <path d="M15.1 15.1l1.4 1.4" />
          <path d="M3.5 16.5l1.4-1.4" />
          <path d="M15.1 4.9l1.4-1.4" />
        </g>
      </svg>
    ) : theme === 'dark' ? (
      // Moon
      <svg viewBox="0 0 20 20" aria-hidden="true" className="theme-icon">
        <path
          d="M14.5 12.5A6 6 0 0 1 7.5 5.5c0-1 .2-1.9.6-2.8A7 7 0 1 0 17.3 12a6 6 0 0 1-2.8.5z"
          fill="currentColor"
        />
      </svg>
    ) : (
      // Auto (split circle)
      <svg viewBox="0 0 20 20" aria-hidden="true" className="theme-icon">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor" />
      </svg>
    );

  return (
    <button
      type="button"
      className="pg-btn pg-btn--icon"
      onClick={() => setTheme(next)}
      title={`Theme: ${theme} · click for ${next}`}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
    >
      {icon}
    </button>
  );
}

function getThemeSnap(): Theme {
  return getTheme();
}

function subscribeTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === 'cov-theme') onChange();
  };
  window.addEventListener('storage', handler);
  // Also observe <html data-theme> so the icon reflects setTheme() calls
  // in the same tab (storage event only fires cross-tab).
  const obs =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => onChange())
      : null;
  obs?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => {
    window.removeEventListener('storage', handler);
    obs?.disconnect();
  };
}

// Keep tree-shaking honest — unused export stubs removed.
void getThemeSnap;
