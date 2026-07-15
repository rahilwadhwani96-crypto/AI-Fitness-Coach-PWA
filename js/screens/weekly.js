import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderWeekly(container, context) {
  render(container, context, { loading: true });
  load(container, context);
}

/** Used by pull-to-refresh. */
export function refreshWeekly(container, context) {
  return load(container, context);
}

async function load(container, context) {
  try {
    const data = await callApi('getWeeklyStats');
    render(container, context, { loading: false, data });
  } catch (err) {
    render(container, context, {
      loading: false,
      error: err instanceof ApiError ? err.message : 'Could not load weekly stats.',
    });
  }
}

function render(container, context, state) {
  if (state.loading) {
    container.innerHTML = `
      <h1 class="screen-title">Weekly</h1>
      <section class="card">
        <p class="status status--pending">Loading weekly stats…</p>
      </section>
    `;
    return;
  }

  if (state.error) {
    container.innerHTML = `
      <h1 class="screen-title">Weekly</h1>
      <section class="card">
        <p class="status status--error">${escapeHtml(state.error)}</p>
        <button type="button" id="weekly-retry">Retry</button>
      </section>
    `;
    container.querySelector('#weekly-retry').addEventListener('click', () => load(container, context));
    return;
  }

  const d = state.data;
  const rangeLabel = formatRange(d.weekStart, d.weekEnd);
  const today = todayDateString();

  container.innerHTML = `
    <h1 class="screen-title">Weekly</h1>
    <section class="card">
      <h2>${escapeHtml(rangeLabel)}</h2>
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width:${Math.min(100, d.completionPercent)}%"></div>
      </div>
      <p class="hint" style="margin-top:8px;">
        ${d.completedCount} of ${d.targetDays} workouts completed (${d.completionPercent}%)
      </p>
    </section>
    <section class="card">
      <dl class="details">
        <dt>Total duration</dt><dd>${d.totalDurationMinutes} min</dd>
        <dt>Estimated calories</dt><dd>${d.estimatedCalories} kcal</dd>
        <dt>Streak</dt><dd>${d.streak} day${d.streak === 1 ? '' : 's'}</dd>
      </dl>
    </section>
    <section class="card">
      <h2>This week</h2>
      <p class="hint">
        Tap a day to mark it as rest — up to ${d.restCapPerWeek} per week based on your ${d.targetDays} workout
        days. Days beyond that count as missed.
      </p>
      <div class="week-calendar">
        ${d.days.map((day, i) => dayChip(day, DAY_LABELS[i], day.date === today)).join('')}
      </div>
      <p class="form-error" id="weekly-rest-error" hidden></p>
    </section>
  `;

  container.querySelectorAll('.week-day[data-clickable="true"]').forEach((dayEl) => {
    dayEl.addEventListener('click', () => {
      const date = dayEl.dataset.date;
      const isCurrentlyRest = dayEl.classList.contains('week-day--rest');
      const dateLabel = formatDayLabel(date);
      const promptText = isCurrentlyRest
        ? `Remove rest day from ${dateLabel}?`
        : `Mark ${dateLabel} as a rest day? No workout will be generated for it.`;

      showConfirmSheet(promptText, () => handleToggleRestDay(container, context, date));
    });
  });
}

async function handleToggleRestDay(container, context, date) {
  const errorEl = container.querySelector('#weekly-rest-error');
  if (errorEl) errorEl.hidden = true;

  try {
    await callApi('toggleRestDate', { date });
    await load(container, context);

    // If today specifically changed, Home needs to know — it was already
    // rendered before this happened and won't pick it up on its own.
    if (date === todayDateString() && context && typeof context.refreshTab === 'function') {
      context.refreshTab('home');
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not update that day.';
      errorEl.hidden = false;
    }
  }
}

/**
 * Rendered attached to document.body — NOT nested inside the tab
 * shell's swipeable panel, which uses a CSS transform for the swipe
 * animation. A transformed ancestor creates a new containing block,
 * which silently breaks fixed-position children (same issue solved for
 * the theme picker). Attaching to body sidesteps that entirely.
 */
function showConfirmSheet(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet';
  sheet.innerHTML = `
    <p class="confirm-sheet-title">${escapeHtml(message)}</p>
    <div class="confirm-sheet-actions">
      <button type="button" class="confirm-sheet-cancel">Cancel</button>
      <button type="button" class="confirm-sheet-confirm">Confirm</button>
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  sheet.querySelector('.confirm-sheet-cancel').addEventListener('click', close);
  sheet.querySelector('.confirm-sheet-confirm').addEventListener('click', () => {
    close();
    onConfirm();
  });
}

function dayChip(day, label, isToday) {
  const statusClass =
    day.status === 'completed'
      ? 'week-day--completed'
      : day.status === 'in_progress'
        ? 'week-day--progress'
        : day.status === 'planned'
          ? 'week-day--planned'
          : day.status === 'rest'
            ? 'week-day--rest'
            : '';
  const todayClass = isToday ? 'week-day--today' : '';
  // Only days with no workout yet (or already marked rest) can be toggled —
  // a day that already has a planned/in-progress/completed workout can't be
  // retroactively turned into a rest day.
  const clickable = day.status === 'none' || day.status === 'rest';
  const clickableClass = clickable ? 'week-day--clickable' : '';

  return `
    <div class="week-day ${statusClass} ${todayClass} ${clickableClass}" data-date="${day.date}" data-clickable="${clickable}">
      <span class="week-day-label">${label}</span>
      <span class="week-day-dot"></span>
    </div>
  `;
}

function formatRange(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatDayLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
