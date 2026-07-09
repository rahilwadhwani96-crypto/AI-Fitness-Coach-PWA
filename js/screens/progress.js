import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';

export function renderProgress(container) {
  render(container, { loading: true });
  load(container);
}

/** Used by pull-to-refresh. */
export function refreshProgress(container) {
  return load(container);
}

async function load(container) {
  try {
    const data = await callApi('getProgress');
    render(container, { loading: false, data });
  } catch (err) {
    render(container, {
      loading: false,
      error: err instanceof ApiError ? err.message : 'Could not load progress data.',
    });
  }
}

function render(container, state) {
  if (state.loading) {
    container.innerHTML = `
      <h1 class="screen-title">Progress</h1>
      <section class="card">
        <p class="status status--pending">Loading progress…</p>
      </section>
    `;
    return;
  }

  if (state.error) {
    container.innerHTML = `
      <h1 class="screen-title">Progress</h1>
      <section class="card">
        <p class="status status--error">${escapeHtml(state.error)}</p>
        <button type="button" id="progress-retry">Retry</button>
      </section>
    `;
    container.querySelector('#progress-retry').addEventListener('click', () => load(container));
    return;
  }

  const d = state.data;
  const diffLabel =
    d.weightDifference === null ? '–' : `${d.weightDifference > 0 ? '+' : ''}${d.weightDifference} kg`;

  container.innerHTML = `
    <h1 class="screen-title">Progress</h1>
    <section class="card">
      <dl class="details">
        <dt>Current weight</dt><dd>${d.currentWeight !== null ? d.currentWeight + ' kg' : '–'}</dd>
        <dt>Starting weight</dt><dd>${d.startingWeight !== null ? d.startingWeight + ' kg' : '–'}</dd>
        <dt>Change</dt><dd>${escapeHtml(diffLabel)}</dd>
        <dt>Goal weight</dt><dd>${d.goalWeight !== null ? d.goalWeight + ' kg' : 'Not set'}</dd>
      </dl>
    </section>

    <section class="card">
      <h2>Trend</h2>
      ${renderWeightChart(d.entries)}
    </section>

    <section class="card">
      <h2>Log today's weight</h2>
      <form id="weight-form" novalidate>
        <label class="field">
          <span>Weight (kg)</span>
          <input name="weight" type="number" step="0.1" inputmode="decimal" required />
        </label>
        <p class="form-error" id="weight-error" hidden></p>
        <button type="submit">Save</button>
      </form>
    </section>

    <section class="card">
      <h2>Goal weight</h2>
      <form id="goal-form" novalidate>
        <label class="field">
          <span>Target weight (kg)</span>
          <input name="goalWeight" type="number" step="0.1" inputmode="decimal" value="${d.goalWeight !== null ? d.goalWeight : ''}" />
        </label>
        <p class="form-error" id="goal-error" hidden></p>
        <button type="submit">Save goal</button>
      </form>
    </section>
  `;

  wireWeightForm(container);
  wireGoalForm(container);
}

function wireWeightForm(container) {
  const form = container.querySelector('#weight-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = container.querySelector('#weight-error');
    errorEl.hidden = true;

    const weight = Number(new FormData(form).get('weight'));
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';

    try {
      const data = await callApi('logWeight', { weight });
      render(container, { loading: false, data });
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not save that weight. Try again.';
      errorEl.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Save';
    }
  });
}

function wireGoalForm(container) {
  const form = container.querySelector('#goal-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorEl = container.querySelector('#goal-error');
    errorEl.hidden = true;

    const goalWeight = Number(new FormData(form).get('goalWeight'));
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving…';

    try {
      const data = await callApi('setGoalWeight', { goalWeight });
      render(container, { loading: false, data });
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not save that goal. Try again.';
      errorEl.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Save goal';
    }
  });
}

function renderWeightChart(entries) {
  if (!entries || entries.length < 2) {
    return `<p class="hint">Log at least two weight entries to see your trend.</p>`;
  }

  const weights = entries.map((e) => e.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const width = 300;
  const height = 120;
  const padding = 10;

  const points = entries
    .map((entry, i) => {
      const x = padding + (i / (entries.length - 1)) * (width - padding * 2);
      const y = height - padding - ((entry.weight - min) / range) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="weight-chart" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
    <div class="weight-chart-range">
      <span>${min} kg</span>
      <span>${max} kg</span>
    </div>
  `;
}
