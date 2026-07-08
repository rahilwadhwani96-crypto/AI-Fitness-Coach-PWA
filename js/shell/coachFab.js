import { ICONS } from './icons.js';

/**
 * Attaches the floating AI Coach button (and its toggleable panel) to
 * `root`. Used both by the tab shell and by the full-screen workout
 * session, since the PRD requires the Coach to be visible everywhere —
 * not just within the tabbed view. Safe to call multiple times on the
 * same root (e.g. after re-rendering session screens); it won't create
 * duplicates.
 */
export function attachCoachFab(root) {
  if (root.querySelector('.coach-fab')) return;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'coach-fab';
  fab.setAttribute('aria-label', 'Open AI Coach');
  fab.innerHTML = ICONS.coach;
  root.appendChild(fab);

  fab.addEventListener('click', () => toggleCoachPanel(root));
}

function toggleCoachPanel(root) {
  const existing = root.querySelector('.coach-panel');
  if (existing) {
    existing.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'coach-panel';
  panel.innerHTML = `
    <div class="coach-panel-header">
      <span>AI Coach</span>
      <button type="button" class="coach-panel-close" aria-label="Close">&times;</button>
    </div>
    <div class="coach-panel-body">
      <p class="hint">Chat with your coach arrives in a later milestone.</p>
    </div>
  `;
  root.appendChild(panel);
  panel.querySelector('.coach-panel-close').addEventListener('click', () => panel.remove());
}
