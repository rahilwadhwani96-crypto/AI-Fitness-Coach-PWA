import { ICONS } from './icons.js';
import { callApi, ApiError } from '../api/client.js';
import { resizeImageToBase64 } from '../utils/imageResize.js';

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
 * specific exercise is being viewed — the only case skip/swap actions
 * are allowed. `onAction(action, replacementExercise)` fires for any
 * action the Coach takes (skip/swap exercise, or an equipment update,
 * which is available from any screen).
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
    <div class="coach-pending-image" id="coach-pending-image" hidden>
      <img id="coach-pending-image-preview" alt="Attached photo" />
      <button type="button" id="coach-remove-image">Remove</button>
    </div>
    <form class="coach-input-row" id="coach-form">
      <input type="file" accept="image/*" id="coach-photo-input" hidden />
      <button type="button" class="coach-attach-button" id="coach-attach-button" aria-label="Attach photo">${ICONS.camera}</button>
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
  const photoInput = panel.querySelector('#coach-photo-input');
  const attachButton = panel.querySelector('#coach-attach-button');
  const pendingImageEl = panel.querySelector('#coach-pending-image');
  const pendingImagePreview = panel.querySelector('#coach-pending-image-preview');
  const removeImageButton = panel.querySelector('#coach-remove-image');
  const history = [];
  let pendingImage = null; // { base64, mimeType, previewUrl }

  addMessage(messagesEl, 'coach', "Hey! I'm your AI coach — ask me about your workout, nutrition, or progress.");

  attachButton.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    try {
      const { base64, mimeType } = await resizeImageToBase64(file);
      pendingImage = { base64, mimeType, previewUrl: `data:${mimeType};base64,${base64}` };
      pendingImagePreview.src = pendingImage.previewUrl;
      pendingImageEl.hidden = false;
    } catch (err) {
      // Attaching a photo is optional — a failed read just means no photo, not a hard error.
    } finally {
      photoInput.value = '';
    }
  });

  removeImageButton.addEventListener('click', () => {
    pendingImage = null;
    pendingImageEl.hidden = true;
  });

  /** Does the actual API call for a given message (+ optional image). Reused by both the initial send and the retry button, so a retry never needs the user to redo anything. */
  async function requestReply(text, image) {
    const pendingEl = addMessage(messagesEl, 'coach', '…');
    input.disabled = true;
    sendButton.disabled = true;

    try {
      const screenValue = typeof screen === 'function' ? screen() : screen;
      const requestPayload = { message: text, history: history.slice(-10), screen: screenValue };
      if (sessionContext && sessionContext.currentExercise) {
        requestPayload.currentExercise = sessionContext.currentExercise;
      }
      if (image) {
        requestPayload.imageBase64 = image.base64;
        requestPayload.mimeType = image.mimeType;
      }

      const result = await callApi('coachChat', requestPayload);
      pendingEl.textContent = result.reply;
      history.push({ role: 'coach', text: result.reply });

      if (result.action && result.action !== 'none' && typeof onAction === 'function') {
        const exercisePayload =
          result.action === 'swap_exercise'
            ? result.replacementExercise
            : result.action === 'add_exercise'
              ? result.newExercise
              : null;
        onAction(result.action, exercisePayload);
        return; // the screen may re-render as a result, which removes this panel
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sorry, I had trouble responding.';
      renderErrorWithRetry(pendingEl, message, () => requestReply(text, image));
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
    const image = pendingImage;
    if (!text && !image) return;

    addMessage(messagesEl, 'user', text, image ? image.previewUrl : null);
    history.push({ role: 'user', text: text || '(sent a photo)' });
    input.value = '';
    pendingImage = null;
    pendingImageEl.hidden = true;

    requestReply(text, image);
  });
}

/**
 * Uses textContent (not innerHTML) for plain messages — XSS-safe by
 * construction. Only user messages can carry an image (the Coach never
 * sends one back), rendered as a thumbnail above the text.
 */
function addMessage(messagesEl, role, text, imageDataUrl) {
  const el = document.createElement('div');
  el.className = `coach-message coach-message--${role}`;

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.className = 'coach-message-image';
    img.alt = 'Attached photo';
    el.appendChild(img);
    if (text) {
      const textEl = document.createElement('div');
      textEl.textContent = text;
      el.appendChild(textEl);
    }
  } else {
    el.textContent = text;
  }

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

/** Turns a pending bubble into an error + Retry button, so a failed reply never requires redoing anything. */
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
