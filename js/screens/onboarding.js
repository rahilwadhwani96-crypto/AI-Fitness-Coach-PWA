import { callApi, ApiError } from '../api/client.js';
import { EQUIPMENT_OPTIONS } from '../data/equipmentOptions.js';

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
    selectedEquipment: new Set(),
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
            ${selectField('goal', 'Fitness goal', GOAL_OPTIONS)}
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
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorEl = root.querySelector('#form-error');
      errorEl.hidden = true;

      const data = Object.fromEntries(new FormData(form).entries());
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
          <div class="equipment-grid" id="equipment-grid">
            ${EQUIPMENT_OPTIONS.map((name) => equipmentCard(name)).join('')}
          </div>
          <p class="form-error" id="equipment-error" hidden></p>
          <button type="button" id="equipment-continue">Finish setup</button>
        </section>
      </div>
    `;

    root.querySelectorAll('.equipment-card').forEach((card) => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        if (state.selectedEquipment.has(name)) {
          state.selectedEquipment.delete(name);
          card.classList.remove('equipment-card--selected');
        } else {
          state.selectedEquipment.add(name);
          card.classList.add('equipment-card--selected');
        }
      });
    });

    const continueButton = root.querySelector('#equipment-continue');
    continueButton.addEventListener('click', async () => {
      const errorEl = root.querySelector('#equipment-error');
      errorEl.hidden = true;
      continueButton.disabled = true;
      continueButton.textContent = 'Saving…';

      try {
        await callApi('saveEquipment', { selected: [...state.selectedEquipment] });
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

function equipmentCard(name) {
  return `
    <button type="button" class="equipment-card" data-name="${name}">
      <span>${name}</span>
    </button>
  `;
}
