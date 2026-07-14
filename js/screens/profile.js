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
      <div class="theme-select">
        <button type="button" class="theme-select-button" id="theme-select-button">
          <span class="theme-select-current">
            <span class="theme-swatch-dot" id="theme-select-dot"></span>
            <span id="theme-select-label"></span>
          </span>
          <span class="theme-select-chevron">&#9662;</span>
        </button>
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

  setupThemePicker(container);
}

function setupThemePicker(container) {
  const dotEl = container.querySelector('#theme-select-dot');
  const labelEl = container.querySelector('#theme-select-label');

  function updateCurrentDisplay() {
    const current = getCurrentTheme();
    const theme = THEME_LIST.find((t) => t.id === current) || THEME_LIST[0];
    dotEl.style.background = theme.swatch;
    labelEl.textContent = theme.label;
  }

  container.querySelector('#theme-select-button').addEventListener('click', () => {
    openThemeSheet(updateCurrentDisplay);
  });

  updateCurrentDisplay();
}

/**
 * Renders as a bottom sheet attached directly to document.body — NOT
 * nested inside the tab shell's swipeable panel. That panel is moved
 * via a CSS transform (for the swipe animation), and a transformed
 * ancestor creates a new containing block, which silently breaks any
 * fixed-position child inside it (it stops measuring against the real
 * screen). Attaching to body sidesteps that entirely, so every theme
 * option — including ones near the end of the list — is always fully
 * reachable regardless of where the underlying page is scrolled.
 */
function openThemeSheet(onChange) {
  const overlay = document.createElement('div');
  overlay.className = 'theme-sheet-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'theme-sheet';
  sheet.innerHTML = `
    <div class="theme-sheet-header">
      <span>Choose a theme</span>
      <button type="button" class="theme-sheet-close" aria-label="Close">&times;</button>
    </div>
    <div class="theme-sheet-list">
      ${THEME_LIST.map(
        (theme) => `
        <button type="button" class="theme-option" data-theme="${theme.id}">
          <span class="theme-swatch-dot" style="background:${theme.swatch}"></span>
          <span>${theme.label}</span>
        </button>
      `
      ).join('')}
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  sheet.querySelector('.theme-sheet-close').addEventListener('click', close);

  const currentTheme = getCurrentTheme();
  sheet.querySelectorAll('.theme-option').forEach((opt) => {
    opt.classList.toggle('theme-option--active', opt.dataset.theme === currentTheme);
    opt.addEventListener('click', () => {
      setTheme(opt.dataset.theme);
      onChange();
      close();
    });
  });
}
