const CACHE_NAME = 'fitcoach-shell-v10';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/api/client.js',
  './js/screens/onboarding.js',
  './js/screens/home.js',
  './js/screens/weekly.js',
  './js/screens/progress.js',
  './js/screens/food.js',
  './js/screens/profile.js',
  './js/shell/tabShell.js',
  './js/shell/icons.js',
  './js/shell/equipmentPicker.js',
  './js/shell/coachFab.js',
  './js/session/workoutSession.js',
  './js/data/equipmentOptions.js',
  './js/utils/escapeHtml.js',
  './js/utils/imageResize.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never cache API calls — always hit the network so data stays live.
  if (request.method !== 'GET' || request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
