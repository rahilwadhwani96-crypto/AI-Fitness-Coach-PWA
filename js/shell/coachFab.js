import { ICONS } from './icons.js';
import { callApi, ApiError } from '../api/client.js';

/**
 * Attaches the floating AI Coach button (and its chat panel) to `root`.
 * Used both by the tab shell and by the full-screen workout session, so
 * the Coach stays reachable everywhere per the PRD. Safe to call
 * multiple times on the same root; it won't create duplicates.
 *
 * `screen` can be a string or a function (called lazily each time a
 * message is sent) — the tab shell passes a function so the Coach
 * always knows the currently active tab, even though the FAB itself is
 * only attached once at mount.
 */
export function attachCoachFab(root, { compact = false, screen = 'general' } = {}) {
  if (root.querySelector('.coach-fab')) return;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = compact ? 'coach-fab coach-fab--compact' : 'coach-fab';
  fab.setAttribute('aria-label', 'Open AI Coach');
  fab.innerHTML = ICONS.coach;
  root.appendChild(fab);

  fab.addEventListener('click', () => toggleCoachPanel(root, screen));
}

function toggleCoachPanel(root, screen) {
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
    <div class="coach-messages" id="coach-messages"></div>
    <form class="coach-input-row" id="coach-form">
      <input type="text" id="coach-input" placeholder="Ask your coach…" autocomplete="off" />
      <button type="submit" id="coach-send">Send</button>
    </form>
  `;
  root.appendChild(panel);

  panel.querySelector('.coach-panel-close').addEventListener('click', () => panel.remove());

  const messagesEl = panel.querySelector('#coach-messages');
  const form = panel.querySelector('#coach-form');
  const input = panel.querySelector('#coach-input');
  const sendButton = panel.querySelector('#coach-send');
  const history = [];

  addMessage(messagesEl, 'coach', "Hey! I'm your AI coach — ask me about your workout, nutrition, or progress.");

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage(messagesEl, 'user', text);
    history.push({ role: 'user', text });
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;

    const pendingEl = addMessage(messagesEl, 'coach', '…');

    try {
      const screenValue = typeof screen === 'function' ? screen() : screen;
      const result = await callApi('coachChat', {
        message: text,
        history: history.slice(-10),
        screen: screenValue,
      });
      pendingEl.textContent = result.reply;
      history.push({ role: 'coach', text: result.reply });
    } catch (err) {
      pendingEl.textContent = err instanceof ApiError ? err.message : 'Sorry, I had trouble responding. Try again.';
      pendingEl.classList.add('coach-message--error');
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });
}

/** Uses textContent (not innerHTML) — messages never need HTML-escaping, XSS-safe by construction. */
function addMessage(messagesEl, role, text) {
  const el = document.createElement('div');
  el.className = `coach-message coach-message--${role}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}
