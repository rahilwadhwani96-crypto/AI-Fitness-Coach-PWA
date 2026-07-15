import { callApi, ApiError } from '../api/client.js';
import { renderEquipmentPicker } from '../shell/equipmentPicker.js';
import { resizeImageToBase64 } from '../utils/imageResize.js';

const GOAL_OPTIONS = ['Fat Loss', 'Muscle Gain', 'Maintenance', 'Strength', 'General Fitness'];
const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

/**
 * Renders the two-step onboarding flow into `root` and calls
 * onComplete() once both the profile and equipment have been saved.
 * All option lists above are hardcoded constants (not user input), so
 * the template-string rendering below doesn't need HTML-escaping.
 */
export function renderOnboarding(root, { onComplete }) {
  const state = {
    selectedGoals: new Set(),
  };

  function renderProfileStep() {
    root.innerHTML = `
      <div class="centered-view">
        <p class="app-brand">AI Fitness Coach</p>
        <section class="card">
          <h2>Tell me about yourself</h2>
          <p class="step-indicator">Step 1 of 2</p>
          <form id="profile-form" novalidate>
            ${textField('name', 'Name', 'text')}
            ${textField('age', 'Age', 'number')}
            ${selectField('gender', 'Gender', GENDER_OPTIONS)}
            ${textField('height', 'Height (cm)', 'number')}
            ${textField('weight', 'Current weight (kg)', 'number')}
            <label class="field">
              <span>Fitness goal (choose one or more)</span>
              <div class="goal-grid" id="goal-grid">
                ${GOAL_OPTIONS.map((name) => goalChip(name)).join('')}
              </div>
            </label>
            ${textField('workoutDays', 'Workout days per week', 'number')}
            ${textField('workoutDuration', 'Preferred workout duration (min)', 'number')}
            ${selectField('experience', 'Experience level', EXPERIENCE_OPTIONS)}
            <p class="form-error" id="form-error" hidden></p>
            <button type="submit">Continue</button>
          </form>
        </section>
      </div>
    `;

    const form = root.querySelector('#profile-form');

    root.querySelectorAll('#goal-grid .goal-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.name;
        if (state.selectedGoals.has(name)) {
          state.selectedGoals.delete(name);
          chip.classList.remove('goal-chip--selected');
        } else {
          state.selectedGoals.add(name);
          chip.classList.add('goal-chip--selected');
        }
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorEl = root.querySelector('#form-error');
      errorEl.hidden = true;

      if (state.selectedGoals.size === 0) {
        errorEl.textContent = 'Pick at least one fitness goal.';
        errorEl.hidden = false;
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.goal = [...state.selectedGoals].join(', ');

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Saving…';

      try {
        await callApi('saveProfile', data);
        renderEquipmentStep();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
        errorEl.hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = 'Continue';
      }
    });
  }

  function renderEquipmentStep() {
    root.innerHTML = `
      <div class="centered-view">
        <p class="app-brand">AI Fitness Coach</p>
        <section class="card">
          <h2>What equipment do you have?</h2>
          <p class="step-indicator">Step 2 of 2</p>

          <div class="scan-section">
            <input type="file" accept="image/*" capture="environment" id="equipment-photo-input" hidden />
            <button type="button" id="scan-equipment-button">Scan a photo of your equipment</button>
            <p class="hint" id="scan-status" hidden></p>
          </div>

          <div id="equipment-picker"></div>
          <p class="form-error" id="equipment-error" hidden></p>
          <button type="button" id="equipment-continue">Finish setup</button>
        </section>
      </div>
    `;

    const picker = renderEquipmentPicker(root.querySelector('#equipment-picker'), []);

    const photoInput = root.querySelector('#equipment-photo-input');
    const scanButton = root.querySelector('#scan-equipment-button');
    const scanStatus = root.querySelector('#scan-status');

    scanButton.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;

      scanButton.disabled = true;
      scanButton.textContent = 'Analyzing photo…';
      scanStatus.hidden = true;

      try {
        const { base64, mimeType } = await resizeImageToBase64(file);
        const result = await callApi('detectEquipment', { imageBase64: base64, mimeType });
        const detected = result.detected || [];

        if (detected.length === 0) {
          scanStatus.textContent =
            "Didn't recognize any equipment in that photo — try another angle, or add it manually below.";
        } else {
          picker.addDetected(detected);
          scanStatus.textContent = `Found: ${detected.join(', ')}. Review the selection below and adjust if needed.`;
        }
        scanStatus.hidden = false;
      } catch (err) {
        scanStatus.textContent =
          err instanceof ApiError ? err.message : 'Could not analyze that photo. Try again or select manually.';
        scanStatus.hidden = false;
      } finally {
        scanButton.disabled = false;
        scanButton.textContent = 'Scan a photo of your equipment';
        photoInput.value = '';
      }
    });

    const continueButton = root.querySelector('#equipment-continue');
    continueButton.addEventListener('click', async () => {
      const errorEl = root.querySelector('#equipment-error');
      errorEl.hidden = true;
      continueButton.disabled = true;
      continueButton.textContent = 'Saving…';

      try {
        await callApi('saveEquipment', { selected: picker.getSelected() });
        onComplete();
      } catch (err) {
        errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
        errorEl.hidden = false;
        continueButton.disabled = false;
        continueButton.textContent = 'Finish setup';
      }
    });
  }

  renderProfileStep();
}

function textField(name, label, type) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" required ${type === 'number' ? 'inputmode="numeric"' : ''} />
    </label>
  `;
}

function selectField(name, label, options) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}" required>
        <option value="" disabled selected>Select…</option>
        ${options.map((opt) => `<option value="${opt}">${opt}</option>`).join('')}
      </select>
    </label>
  `;
}

function goalChip(name) {
  return `
    <button type="button" class="goal-chip" data-name="${name}">
      <span>${name}</span>
    </button>
  `;
}
