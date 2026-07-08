import { EQUIPMENT_OPTIONS } from '../data/equipmentOptions.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Renders an editable equipment picker into `container`: the fixed
 * option chips, any previously-saved custom entries (so they stay
 * visible/removable), and a free-text field for adding new custom
 * equipment. Returns a controller for reading/updating the selection.
 */
export function renderEquipmentPicker(container, initialSelected = []) {
  const selected = new Set(initialSelected);
  // Anything already selected that isn't one of the fixed options must
  // have been added as a custom entry previously — keep it as a chip.
  const customOptions = new Set(initialSelected.filter((name) => !EQUIPMENT_OPTIONS.includes(name)));

  function allOptions() {
    return [...EQUIPMENT_OPTIONS, ...customOptions];
  }

  function render() {
    container.innerHTML = `
      <div class="equipment-grid">
        ${allOptions()
          .map(
            (name) => `
          <button type="button" class="equipment-card${selected.has(name) ? ' equipment-card--selected' : ''}" data-name="${escapeHtml(name)}">
            <span>${escapeHtml(name)}</span>
          </button>
        `
          )
          .join('')}
      </div>
      <div class="custom-equipment-row">
        <input type="text" class="custom-equipment-input" placeholder="Add your own (e.g. Skipping rope)" maxlength="40" />
        <button type="button" class="custom-equipment-add">Add</button>
      </div>
    `;

    container.querySelectorAll('.equipment-card').forEach((card) => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        if (selected.has(name)) {
          selected.delete(name);
        } else {
          selected.add(name);
        }
        card.classList.toggle('equipment-card--selected');
      });
    });

    const input = container.querySelector('.custom-equipment-input');
    const addButton = container.querySelector('.custom-equipment-add');

    function addCustom() {
      const name = input.value.trim();
      if (!name) return;
      customOptions.add(name);
      selected.add(name);
      input.value = '';
      render();
    }

    addButton.addEventListener('click', addCustom);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addCustom();
      }
    });
  }

  render();

  return {
    getSelected: () => [...selected],
    /** Marks additional items as selected (used by AI photo detection) without discarding existing picks. */
    addDetected: (names) => {
      names.forEach((name) => selected.add(name));
      render();
    },
  };
}
