/**
 * Theme bootstrap — applies the persisted or system-preferred theme to
 * the <html> element BEFORE React paints. Run via a side-effect import
 * from main.tsx so there's no flash of light content for users who
 * previously chose dark.
 *
 * Storage key: `cov-theme` → 'light' | 'dark' | 'system'.
 * Default for first-time visitors: 'dark' (cyberpunk-y, matches the rest
 * of the Covenant brand). Users can switch to light or follow the OS.
 * The toggle in Header.tsx calls setTheme() below.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cov-theme';

export function getTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'dark';
}

export function setTheme(t: Theme): void {
  localStorage.setItem(STORAGE_KEY, t);
  applyTheme(t);
}

export function getEffective(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const effective = getEffective(theme);
  root.dataset.theme = effective;
  // Sync `color-scheme` so form controls and scrollbars adopt the theme.
  root.style.colorScheme = effective;
}

// ---- Bootstrap ----

applyTheme(getTheme());

// Follow system preference changes while the user has 'system' picked.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system');
  });
}
