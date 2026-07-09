import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { resizeImageToBase64 } from '../utils/imageResize.js';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function renderFood(container) {
  const state = { analysis: null, selectedMealType: null };
  renderIdle(container, state);
}

function renderIdle(container, state, errorMessage) {
  container.innerHTML = `
    <h1 class="screen-title">Food</h1>
    <section class="card">
      <h2>Analyze a meal</h2>
      <p class="hint">Take or upload a photo — only the analysis text is ever saved, never the photo.</p>
      <input type="file" accept="image/*" capture="environment" id="food-camera-input" hidden />
      <input type="file" accept="image/*" id="food-upload-input" hidden />
      <button type="button" id="food-take-photo">Take photo</button>
      <button type="button" id="food-upload-photo">Upload photo</button>
      <p class="form-error" id="food-error" ${errorMessage ? '' : 'hidden'}>${errorMessage ? escapeHtml(errorMessage) : ''}</p>
    </section>
  `;

  const cameraInput = container.querySelector('#food-camera-input');
  const uploadInput = container.querySelector('#food-upload-input');

  container.querySelector('#food-take-photo').addEventListener('click', () => cameraInput.click());
  container.querySelector('#food-upload-photo').addEventListener('click', () => uploadInput.click());

  cameraInput.addEventListener('change', () => handleFile(container, state, cameraInput.files[0]));
  uploadInput.addEventListener('change', () => handleFile(container, state, uploadInput.files[0]));
}

async function handleFile(container, state, file) {
  if (!file) return;
  renderAnalyzing(container);

  try {
    const { base64, mimeType } = await resizeImageToBase64(file);
    const analysis = await callApi('analyzeMeal', { imageBase64: base64, mimeType });
    state.analysis = analysis;
    state.selectedMealType = null;
    renderResult(container, state);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Could not analyze that photo. Try again.';
    renderIdle(container, state, message);
  }
}

function renderAnalyzing(container) {
  container.innerHTML = `
    <h1 class="screen-title">Food</h1>
    <section class="card">
      <p class="status status--pending">Analyzing your meal…</p>
    </section>
  `;
}

function renderResult(container, state) {
  const a = state.analysis;

  container.innerHTML = `
    <h1 class="screen-title">Food</h1>
    <section class="card">
      <h2>Meal analysis</h2>
      <p class="hint">${escapeHtml(a.summary)}</p>
      <dl class="details" style="margin-top:12px;">
        <dt>Estimated calories</dt><dd>${escapeHtml(a.estimatedCalories)} kcal</dd>
        <dt>Estimated protein</dt><dd>${escapeHtml(a.estimatedProtein)} g</dd>
        <dt>Rating</dt><dd>${escapeHtml(a.rating)} / 10</dd>
      </dl>
      <p class="hint" style="margin-top:12px;">${escapeHtml(a.feedback)}</p>
    </section>
    <section class="card">
      <h2>Save this meal? (optional)</h2>
      <div class="goal-grid" id="meal-type-grid">
        ${MEAL_TYPES.map(
          (t) => `
          <button type="button" class="goal-chip" data-meal-type="${t}">
            <span>${t}</span>
          </button>
        `
        ).join('')}
      </div>
      <p class="form-error" id="save-error" hidden></p>
      <button type="button" id="save-meal-button" disabled>Save meal</button>
      <button type="button" id="analyze-another-button">Analyze another</button>
    </section>
  `;

  const saveButton = container.querySelector('#save-meal-button');

  container.querySelectorAll('.goal-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.selectedMealType = chip.dataset.mealType;
      container.querySelectorAll('.goal-chip').forEach((c) => c.classList.remove('goal-chip--selected'));
      chip.classList.add('goal-chip--selected');
      saveButton.disabled = false;
    });
  });

  saveButton.addEventListener('click', async () => {
    const errorEl = container.querySelector('#save-error');
    errorEl.hidden = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      await callApi('saveMeal', {
        mealType: state.selectedMealType,
        summary: a.summary,
        estimatedCalories: a.estimatedCalories,
        estimatedProtein: a.estimatedProtein,
        rating: a.rating,
        feedback: a.feedback,
      });
      saveButton.textContent = 'Saved ✓';
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not save this meal. Try again.';
      errorEl.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save meal';
    }
  });

  container.querySelector('#analyze-another-button').addEventListener('click', () => {
    state.analysis = null;
    renderIdle(container, state);
  });
}
