import { escapeHtml } from '../utils/escapeHtml.js';
import { callApi, ApiError } from '../api/client.js';
import { renderEquipmentPicker } from '../shell/equipmentPicker.js';
import { THEME_LIST, setTheme, getCurrentTheme } from '../shell/theme.js';

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
    <section class="card">
      <h2>Theme</h2>
      <div class="theme-select" id="theme-select">
        <button type="button" class="theme-select-button" id="theme-select-button">
          <span class="theme-select-current">
            <span class="theme-swatch-dot" id="theme-select-dot"></span>
            <span id="theme-select-label"></span>
          </span>
          <span class="theme-select-chevron">&#9662;</span>
        </button>
        <div class="theme-dropdown" id="theme-dropdown" hidden>
          ${THEME_LIST.map(
            (theme) => `
            <button type="button" class="theme-option" data-theme="${theme.id}">
              <span class="theme-swatch-dot" style="background:${theme.swatch}"></span>
              <span>${theme.label}</span>
            </button>
          `
          ).join('')}
        </div>
      </div>
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

  setupThemeDropdown(container);
}

function setupThemeDropdown(container) {
  const wrapper = container.querySelector('#theme-select');
  const button = container.querySelector('#theme-select-button');
  const dropdown = container.querySelector('#theme-dropdown');
  const dotEl = container.querySelector('#theme-select-dot');
  const labelEl = container.querySelector('#theme-select-label');

  function updateCurrentDisplay() {
    const current = getCurrentTheme();
    const theme = THEME_LIST.find((t) => t.id === current) || THEME_LIST[0];
    dotEl.style.background = theme.swatch;
    labelEl.textContent = theme.label;
    container.querySelectorAll('.theme-option').forEach((opt) => {
      opt.classList.toggle('theme-option--active', opt.dataset.theme === theme.id);
    });
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  container.querySelectorAll('.theme-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      setTheme(opt.dataset.theme);
      updateCurrentDisplay();
      dropdown.hidden = true;
    });
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) {
      dropdown.hidden = true;
    }
  });

  updateCurrentDisplay();
}
