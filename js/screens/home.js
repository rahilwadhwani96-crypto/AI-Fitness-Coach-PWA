import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { startWorkoutSession } from '../session/workoutSession.js';

const PHASE_LABELS = { warmup: 'Warm-up', main: 'Main workout', cooldown: 'Cool-down' };

export function renderHome(container, context) {
  render(container, context, { loading: true });
  load(container, context);
}

/** Used by pull-to-refresh — re-fetches today's workout. */
export function refreshHome(container, context) {
  return load(container, context);
}

async function load(container, context) {
  try {
    const data = await callApi('getTodayWorkout');
    render(container, context, { loading: false, data });
  } catch (err) {
    render(container, context, {
      loading: false,
      error: err instanceof ApiError ? err.message : "Couldn't load today's workout.",
    });
  }
}

function render(container, context, state) {
  const { profile } = context;

  if (state.loading) {
    container.innerHTML = `
      <h1 class="screen-title">Hey, ${escapeHtml(profile.Name)}</h1>
      <section class="card">
        <p class="status status--pending">Preparing today's workout…</p>
      </section>
    `;
    return;
  }

  if (state.error) {
    container.innerHTML = `
      <h1 class="screen-title">Hey, ${escapeHtml(profile.Name)}</h1>
      <section class="card">
        <p class="status status--error">${escapeHtml(state.error)}</p>
        <button type="button" id="home-retry">Retry</button>
      </section>
    `;
    container.querySelector('#home-retry').addEventListener('click', () => load(container, context));
    return;
  }

  const { status, workout, streak } = state.data;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  container.innerHTML = `
    <h1 class="screen-title">Hey, ${escapeHtml(profile.Name)}</h1>
    <section class="card">
      <h2>${escapeHtml(today)}</h2>
      <dl class="details">
        <dt>Workout type</dt><dd>${escapeHtml(workout.workoutType)}</dd>
        <dt>Estimated duration</dt><dd>${escapeHtml(workout.estimatedDurationMinutes)} min</dd>
      </dl>
      ${renderPhaseSummary(workout.exercises)}
      ${renderActionButton(status)}
    </section>
    <section class="card">
      <h2>Streak</h2>
      <p class="status status--ok">${streak} day${streak === 1 ? '' : 's'} in a row</p>
    </section>
  `;

  const actionButton = container.querySelector('#session-action-button');
  if (actionButton) {
    actionButton.addEventListener('click', () => {
      startWorkoutSession(context.appRoot, {
        workout,
        profile,
        onEnd: () => context.restartApp(),
      });
    });
  }
}

/** Groups today's exercises into warm-up / main / cool-down for a quick preview before starting. */
function renderPhaseSummary(exercises) {
  const phases = ['warmup', 'main', 'cooldown'];
  const grouped = phases.map((phase) => ({
    phase,
    items: exercises.filter((e) => (e.phase || 'main') === phase),
  }));

  return `
    <div class="phase-summary">
      ${grouped
        .map(
          ({ phase, items }) => `
        <div class="phase-summary-row">
          <span class="phase-summary-label">${PHASE_LABELS[phase]}</span>
          <span class="phase-summary-count">${items.length ? items.length + ' exercise' + (items.length === 1 ? '' : 's') : '–'}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderActionButton(status) {
  if (status === 'completed') {
    return `<p class="status status--ok" style="margin-top:16px;">Workout complete for today ✓</p>`;
  }
  const label = status === 'in_progress' ? 'Resume session' : 'Start session';
  return `<button type="button" id="session-action-button">${label}</button>`;
}
