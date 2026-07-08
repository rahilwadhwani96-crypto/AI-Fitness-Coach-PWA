import { escapeHtml } from '../utils/escapeHtml.js';

export function renderHome(container, { profile }) {
  container.innerHTML = `
    <h1 class="screen-title">Hey, ${escapeHtml(profile.Name)}</h1>
    <section class="card">
      <h2>Today's session</h2>
      <p class="hint">Your AI-generated workout will appear here once workout generation is built.</p>
      <button type="button" disabled>Start session (coming soon)</button>
    </section>
    <section class="card">
      <h2>Streak</h2>
      <p class="hint">Workout history and streak tracking arrive with the session flow.</p>
    </section>
  `;
}
