import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { resizeImageToBase64 } from '../utils/imageResize.js';

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

    <section class="card">
      <h2>Compare progress photos</h2>
      <p class="hint">Upload an old and a new photo — nothing is saved, they're only compared right now.</p>
      <div class="photo-compare-row">
        <div class="photo-compare-slot">
          <label class="hint">Old photo</label>
          <div class="photo-compare-image" id="photo-old-preview"><p class="hint">No photo selected</p></div>
          <input type="file" accept="image/*" id="photo-old-input" hidden />
          <button type="button" id="photo-old-button">Choose photo</button>
        </div>
        <div class="photo-compare-slot">
          <label class="hint">New photo</label>
          <div class="photo-compare-image" id="photo-new-preview"><p class="hint">No photo selected</p></div>
          <input type="file" accept="image/*" capture="environment" id="photo-new-input" hidden />
          <button type="button" id="photo-new-button">Take / choose photo</button>
        </div>
      </div>
      <p class="form-error" id="photo-compare-error" hidden></p>
      <button type="button" id="compare-photos-button" disabled>Compare photos</button>
      <div id="photo-comparison-result"></div>
    </section>
  `;

  wireWeightForm(container);
  wireGoalForm(container);
  wirePhotoCompareSection(container);
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

function wirePhotoCompareSection(container) {
  const state = { oldPhoto: null, newPhoto: null };

  const oldInput = container.querySelector('#photo-old-input');
  const newInput = container.querySelector('#photo-new-input');
  const compareButton = container.querySelector('#compare-photos-button');

  container.querySelector('#photo-old-button').addEventListener('click', () => oldInput.click());
  container.querySelector('#photo-new-button').addEventListener('click', () => newInput.click());

  oldInput.addEventListener('change', () =>
    handlePhotoSelect(container, state, 'oldPhoto', 'photo-old-preview', oldInput.files[0], compareButton)
  );
  newInput.addEventListener('change', () =>
    handlePhotoSelect(container, state, 'newPhoto', 'photo-new-preview', newInput.files[0], compareButton)
  );

  compareButton.addEventListener('click', () => runComparison(container, state, compareButton));
}

async function handlePhotoSelect(container, state, key, previewId, file, compareButton) {
  if (!file) return;
  try {
    const { base64, mimeType } = await resizeImageToBase64(file);
    state[key] = { base64, mimeType, previewUrl: `data:${mimeType};base64,${base64}` };
    container.querySelector(`#${previewId}`).innerHTML = `<img src="${state[key].previewUrl}" alt="" />`;
    compareButton.disabled = !(state.oldPhoto && state.newPhoto);
  } catch (err) {
    // Selecting a photo failing just leaves that slot empty — not worth a hard error state.
  }
}

async function runComparison(container, state, compareButton) {
  const errorEl = container.querySelector('#photo-compare-error');
  const resultEl = container.querySelector('#photo-comparison-result');
  errorEl.hidden = true;
  compareButton.disabled = true;
  compareButton.textContent = 'Comparing…';
  resultEl.innerHTML = '';

  try {
    const result = await callApi('compareProgressPhotos', {
      beforeImageBase64: state.oldPhoto.base64,
      beforeMimeType: state.oldPhoto.mimeType,
      afterImageBase64: state.newPhoto.base64,
      afterMimeType: state.newPhoto.mimeType,
    });

    const observationsHtml =
      result.observations && result.observations.length
        ? `<ul class="equipment-list" style="margin-top:10px;">${result.observations
            .map((o) => `<li>${escapeHtml(o)}</li>`)
            .join('')}</ul>`
        : '';

    resultEl.innerHTML = `
      <p class="hint" style="margin-top:14px;">${escapeHtml(result.comparison)}</p>
      ${observationsHtml}
    `;
  } catch (err) {
    errorEl.textContent = err instanceof ApiError ? err.message : 'Could not compare those photos. Try again.';
    errorEl.hidden = false;
  } finally {
    compareButton.disabled = false;
    compareButton.textContent = 'Compare photos';
  }
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
