const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `nasa-space-explorer-shell-${CACHE_VERSION}`;
const API_CACHE = `nasa-space-explorer-api-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './js/dateRange.js',
  './js/script.js',
  './manifest.json',
  './img/nasa-worm-logo.png',
  './img/NASA-Logo-Large.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => ![APP_SHELL_CACHE, API_CACHE].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isApodRequest = requestUrl.origin === 'https://science.nasa.gov'
    && requestUrl.pathname === '/wp-json/wp/v2/apod-basic';

  if (isApodRequest) {
    // NASA data prefers fresh results, with the last successful response as a fallback.
    event.respondWith(networkFirstApiRequest(event.request));
    return;
  }

  // Local app files are served from the cache first for fast and offline launches.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});

async function networkFirstApiRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}
