export const THEME_STORAGE_KEY = 'curatamed-theme';

export function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Use the system preference when storage is unavailable.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
}

export function setThemePreference(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The current page can still use the chosen theme for this session.
  }
  applyTheme(next);
  return next;
}
