import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { renderEquipmentPicker } from '../shell/equipmentPicker.js';

export function renderProfile(container, { profile, equipment }) {
  const rows = [
    ['Age', profile.Age],
    ['Gender', profile.Gender],
    ['Height', `${profile.Height} cm`],
    ['Weight', `${profile.Weight} kg`],
    ['Goal', profile.Goal],
    ['Workout days', `${profile.WorkoutDays} / week`],
    ['Duration', `${profile.WorkoutDuration} min`],
    ['Experience', profile.Experience],
    ['Split', profile.PreferredSplit],
  ];

  container.innerHTML = `
    <h1 class="screen-title">${escapeHtml(profile.Name)}</h1>
    <section class="card">
      <h2>Profile</h2>
      <dl class="details">
        ${rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}
      </dl>
    </section>
    <section class="card">
      <h2>Equipment</h2>
      <div id="equipment-picker"></div>
      <p class="form-error" id="equipment-save-error" hidden></p>
      <button type="button" id="save-equipment-button">Save changes</button>
    </section>
  `;

  const picker = renderEquipmentPicker(container.querySelector('#equipment-picker'), equipment);

  const saveButton = container.querySelector('#save-equipment-button');
  saveButton.addEventListener('click', async () => {
    const errorEl = container.querySelector('#equipment-save-error');
    errorEl.hidden = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      await callApi('saveEquipment', { selected: picker.getSelected() });
      saveButton.textContent = 'Saved';
      setTimeout(() => {
        saveButton.textContent = 'Save changes';
        saveButton.disabled = false;
      }, 1500);
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Could not save changes.';
      errorEl.hidden = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
    }
  });
}
