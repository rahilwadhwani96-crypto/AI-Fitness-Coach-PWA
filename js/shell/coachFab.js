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
 * always knows the currently active tab.
 *
 * `sessionContext.currentExercise`, if provided, tells the backend a
 * specific exercise is being viewed, which is the only situation the
 * Coach is allowed to propose an action in. `onAction(action,
 * replacementExercise)` is called when the Coach's reply includes one.
 */
export function attachCoachFab(root, { compact = false, screen = 'general', sessionContext = null, onAction = null } = {}) {
  if (root.querySelector('.coach-fab')) return;

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = compact ? 'coach-fab coach-fab--compact' : 'coach-fab';
  fab.setAttribute('aria-label', 'Open AI Coach');
  fab.innerHTML = ICONS.coach;
  root.appendChild(fab);

  fab.addEventListener('click', () => toggleCoachPanel(root, screen, sessionContext, onAction));
}

function toggleCoachPanel(root, screen, sessionContext, onAction) {
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

  /** Does the actual API call for a given message. Reused by both the initial send and the retry button, so a retry never needs the user to retype anything. */
  async function requestReply(text) {
    const pendingEl = addMessage(messagesEl, 'coach', '…');
    input.disabled = true;
    sendButton.disabled = true;

    try {
      const screenValue = typeof screen === 'function' ? screen() : screen;
      const requestPayload = { message: text, history: history.slice(-10), screen: screenValue };
      if (sessionContext && sessionContext.currentExercise) {
        requestPayload.currentExercise = sessionContext.currentExercise;
      }

      const result = await callApi('coachChat', requestPayload);
      pendingEl.textContent = result.reply;
      history.push({ role: 'coach', text: result.reply });

      if (result.action && result.action !== 'none' && typeof onAction === 'function') {
        onAction(result.action, result.replacementExercise);
        return; // the screen is about to re-render, which removes this panel
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sorry, I had trouble responding.';
      renderErrorWithRetry(pendingEl, message, () => requestReply(text));
    } finally {
      if (root.contains(panel)) {
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage(messagesEl, 'user', text);
    history.push({ role: 'user', text });
    input.value = '';

    requestReply(text);
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

/** Turns a pending bubble into an error + Retry button, so a failed reply never requires retyping the message. */
function renderErrorWithRetry(el, message, onRetry) {
  el.classList.add('coach-message--error');
  el.textContent = '';

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'coach-retry-button';
  retryButton.textContent = 'Retry';
  retryButton.addEventListener('click', () => {
    el.remove();
    onRetry();
  });

  el.appendChild(textSpan);
  el.appendChild(document.createElement('br'));
  el.appendChild(retryButton);
}
