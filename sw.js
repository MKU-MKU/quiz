/* ═══════════════════════════════════════════════════════════════
   SW.JS — HAMRO AFNAI  Service Worker  v2
   Strategy:
   • App shell  → cache-first, instant offline open
   • API/Drive  → network-first, localStorage fallback (app.js handles this)
   • Cache bust → increment CACHE_NAME when deploying new shell files
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'ha-shell-v2';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './chapters-data.js',
  './manifest.json',
  './sw.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .catch(() => {}) // don't fail install if a resource 404s
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API calls: network-only (app.js caches question JSON in localStorage)
  if (url.includes('script.google.com') || url.includes('googleapis.com')) {
    e.respondWith(
      fetch(e.request.clone())
        .catch(() => new Response(
          JSON.stringify({success:false, error:'Offline — use cached data'}),
          {status:200, headers:{'Content-Type':'application/json'}}
        ))
    );
    return;
  }

  // App shell: cache-first, background update
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached || new Response('Offline', {status:503}));
      return cached || net;
    })
  );
});
