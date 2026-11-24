const THEME_KEY = 'bk_theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function applyTheme(theme) {
  const valid = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem(THEME_KEY, valid);
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.textContent = valid === 'dark' ? '☀️' : '🌙';
  });
  return valid;
}

export function toggleTheme() {
  return applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

applyTheme(getTheme());
