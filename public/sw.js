// Resolve every cached/served path relative to the service worker's own scope so
// the app works whether it is served from the domain root or a GitHub Pages
// subpath (e.g. https://user.github.io/frontend/). `new URL('./', self.location)`
// yields the directory the SW is registered under ("/frontend/" or "/").
const BASE_PATH = new URL('./', self.location).pathname;

const CACHE_VERSION = 'diagnosis-center-phase9-v3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const INDEX_URL = `${BASE_PATH}index.html`;
const OFFLINE_URL = `${BASE_PATH}offline.html`;
const APP_SHELL_URLS = [
  BASE_PATH,
  INDEX_URL,
  OFFLINE_URL,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}icons/icon.svg`,
  `${BASE_PATH}icons/app-icon-192.png`,
  `${BASE_PATH}icons/app-icon-512.png`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('diagnosis-center-') && !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function canCacheResponse(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default');
}

function networkFirstNavigation(request) {
  return fetch(request)
    .then((response) => {
      if (canCacheResponse(response)) {
        const copy = response.clone();
        caches.open(APP_SHELL_CACHE).then((cache) => cache.put(INDEX_URL, copy));
      }
      return response;
    })
    .catch(() => caches.match(INDEX_URL).then((cached) => cached || caches.match(OFFLINE_URL)));
}

function cacheFirstAsset(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (canCacheResponse(response)) {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${BASE_PATH}api/`)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith(`${BASE_PATH}assets/`) || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico')) {
    event.respondWith(cacheFirstAsset(request));
  }
});
