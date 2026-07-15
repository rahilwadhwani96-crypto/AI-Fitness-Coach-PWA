const STORAGE_KEY = 'fitcoach-theme';

export const THEME_LIST = [
  { id: 'dark', label: 'Default', swatch: '#ff7a29' },
  { id: 'icecream', label: 'Ice Cream', swatch: '#ff7aa8' },
  { id: 'frost', label: 'Frost', swatch: '#38bdf8' },
  { id: 'lava', label: 'Lava', swatch: '#ff5722' },
  { id: 'kobrakai', label: 'Kobra Kai', swatch: '#e0201e' },
  { id: 'naruto', label: 'Naruto', swatch: '#ff7a1a' },
];

const VALID_THEME_IDS = THEME_LIST.map((t) => t.id);

/** Call once at app startup, before anything renders, so the correct theme is already active. */
export function applyStoredTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // Storage can be unavailable (private browsing, etc.) — default theme still applies.
  }
  setTheme(VALID_THEME_IDS.includes(stored) ? stored : 'dark', { persist: false });
}

export function setTheme(themeId, { persist = true } = {}) {
  const value = VALID_THEME_IDS.includes(themeId) ? themeId : 'dark';
  if (value === 'dark') {
    document.documentElement.removeAttribute('data-theme'); // dark is the :root default, no attribute needed
  } else {
    document.documentElement.setAttribute('data-theme', value);
  }
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      // Non-fatal — the theme still applies for this session even if it can't be remembered.
    }
  }
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
