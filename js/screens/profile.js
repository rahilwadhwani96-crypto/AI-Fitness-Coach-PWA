import { escapeHtml } from '../utils/escapeHtml.js';

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
      ${
        equipment.length
          ? `<ul class="equipment-list">${equipment.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
          : '<p class="hint">No equipment selected yet.</p>'
      }
    </section>
  `;
}
