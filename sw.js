// Service worker pentru dashboardul CM 2026 (PWA, functioneaza si offline).
// Bump versiunea la fiecare modificare a HTML-ului ca sa se reimprospateze cache-ul.
const CACHE = 'cm2026-v16';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Navigare (HTML): network-first, fallback la cache (ca sa primesti versiuni noi cand esti online).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Date dinamice (scoruri de la Worker-ul Cloudflare + elo.json): NETWORK-FIRST.
  // NU cache-first, altfel ramai blocat pe scoruri vechi (ex. meci neterminat la
  // momentul cache-uirii nu se mai actualizeaza niciodata). Cache doar fallback offline.
  const url = new URL(req.url);
  if (url.hostname.endsWith('workers.dev') || url.pathname.endsWith('elo.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Restul (fonturi, steaguri, iconite): cache-first, completat din retea.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
