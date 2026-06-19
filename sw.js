// Whose Next? Service Worker — aggressive offline-first caching
const CACHE = 'whosnext-v2';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sw.js'
];

// INSTALL — cache everything immediately, don't wait
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(CORE);
    }).then(() => self.skipWaiting()) // activate immediately, don't wait for old SW to die
  );
});

// ACTIVATE — take control of all tabs immediately, clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      // Delete any old cache versions
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      // Take over all open tabs/windows immediately
      self.clients.claim()
    ])
  );
});

// FETCH — cache-first for everything (offline game, no need for network)
self.addEventListener('fetch', e => {
  // Only handle same-origin requests
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached; // serve from cache instantly

      // If not cached yet (first load before SW was ready), fetch and cache it
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => {
        // Total offline fallback - return index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Listen for skip-waiting message (from the HTML)
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
