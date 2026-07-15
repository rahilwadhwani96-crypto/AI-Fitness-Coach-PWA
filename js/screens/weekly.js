import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderWeekly(container) {
  render(container, { loading: true });
  load(container);
}

/** Used by pull-to-refresh. */
export function refreshWeekly(container) {
  return load(container);
}

async function load(container) {
  try {
    const data = await callApi('getWeeklyStats');
    render(container, { loading: false, data });
  } catch (err) {
    render(container, {
      loading: false,
      error: err instanceof ApiError ? err.message : 'Could not load weekly stats.',
    });
  }
}

function render(container, state) {
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
    container.querySelector('#weekly-retry').addEventListener('click', () => load(container));
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
    dayEl.addEventListener('click', () => handleToggleRestDay(container, dayEl.dataset.date));
  });
}

async function handleToggleRestDay(container, date) {
  const errorEl = container.querySelector('#weekly-rest-error');
  if (errorEl) errorEl.hidden = true;

  try {
    await callApi('toggleRestDate', { date });
    await load(container);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not update that day.';
      errorEl.hidden = false;
    }
  }
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

function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
