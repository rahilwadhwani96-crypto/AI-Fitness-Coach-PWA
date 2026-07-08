import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { startWorkoutSession } from '../session/workoutSession.js';

export function renderHome(container, context) {
  render(container, context, { loading: true });
  load(container, context);
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
        <dt>Exercises</dt><dd>${workout.exercises.length}</dd>
      </dl>
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

function renderActionButton(status) {
  if (status === 'completed') {
    return `<p class="status status--ok" style="margin-top:16px;">Workout complete for today ✓</p>`;
  }
  const label = status === 'in_progress' ? 'Resume session' : 'Start session';
  return `<button type="button" id="session-action-button">${label}</button>`;
}
