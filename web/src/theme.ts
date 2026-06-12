const THEME_KEY = 'theme';

export type Theme = 'light' | 'dark';

export function getStoredTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

// Apply stored theme immediately to prevent flash
setTheme(getStoredTheme());
