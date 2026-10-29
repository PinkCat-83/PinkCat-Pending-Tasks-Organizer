// Service worker: guarda los archivos de la app para poder abrirla sin conexión.
// No toca los datos del usuario (viven en IndexedDB).
//
// IMPORTANTE: cada vez que publiques cambios, sube CACHE_VERSION
// (por ejemplo, v1.0.1). Así los dispositivos detectan la versión nueva.

const CACHE_VERSION = 'pinkcat-v1.0.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/i18n.js',
  './js/db.js',
  './js/store.js',
  './js/backup.js',
  './js/ui.js',
  './js/persistence.js',
  './js/sw-status.js',
  './js/views/today.js',
  './js/views/choose.js',
  './js/views/session.js',
  './js/views/projects.js',
  './js/views/project-form.js',
  './js/views/priority.js',
  './js/views/ideas.js',
  './js/views/history.js',
  './js/views/data.js',
  './locales/es.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
