// Minimal line icons, inline as SVG strings so the app has no external
// icon-font dependency. All use currentColor so they pick up the active/
// inactive tab color automatically.

const wrap = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const ICONS = {
  home: wrap(
    '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V15a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4.5a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V10"/>'
  ),
  weekly: wrap(
    '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'
  ),
  progress: wrap('<path d="M4 19V10M10 19V5M16 19v-7M21 19H3"/>'),
  food: wrap(
    '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 3c-1.7 0-3 2-3 5s1.3 5 3 5v8"/>'
  ),
  profile: wrap('<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.5-4 4.5-6 7.5-6s6 2 7.5 6"/>'),
  coach: wrap(
    '<path d="M4 12a8 8 0 1 1 3.2 6.4L4 20l1.2-3.6A7.96 7.96 0 0 1 4 12Z"/>' +
      '<circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>' +
      '<circle cx="15" cy="12" r=".8" fill="currentColor" stroke="none"/>'
  ),
};
