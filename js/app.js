import { callApi, ApiError } from './api/client.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderTabShell } from './shell/tabShell.js';
import { escapeHtml } from './utils/escapeHtml.js';

const root = document.getElementById('app-root');

async function bootstrap() {
  renderLoading();
  try {
    const status = await callApi('getOnboardingStatus');
   if (status.completed) {
      renderTabShell(root, {
        profile: status.profile,
        equipment: status.equipment,
        appRoot: root,
        restartApp: bootstrap,
      });
    } else {
     
      renderOnboarding(root, { onComplete: bootstrap });
    }
  } catch (err) {
    renderError(err);
  }
}

function renderLoading() {
  root.innerHTML = `
    <div class="centered-view">
      <section class="card">
        <p class="status status--pending">Loading…</p>
      </section>
    </div>
  `;
}

function renderError(err) {
  const message = err instanceof ApiError ? err.message : 'Something went wrong.';
  root.innerHTML = `
    <div class="centered-view">
      <section class="card">
        <p class="status status--error">${escapeHtml(message)}</p>
        <button type="button" id="retry">Retry</button>
      </section>
    </div>
  `;
  root.querySelector('#retry').addEventListener('click', bootstrap);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.error('Service worker registration failed', err);
    });
  });
}

registerServiceWorker();
bootstrap();
