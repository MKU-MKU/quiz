/* ═══════════════════════════════════════════════════════════════
   SW.JS — HAMRO AFNAI  Service Worker  
   Strategy:
   • App shell  → network-first, cache only as an offline fallback
   • API/Drive  → network-first, offline JSON fallback
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'ha-shell-v8'; // Bumped — v7's stale-while-revalidate strategy below was serving old index.html/admin.html/app.js indefinitely; this forces every existing installed copy to drop its stale cache on next activate.
const SHELL = [
  './',
  './index.html',        // ← ADD: login gateway
  './user.html',        // ← ADD: your main app page
  './admin.html',       // ← ADD: admin page
  './app.js',
  './chapters-data.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL))
      .catch(err => console.warn('SW install: some shell files could not be cached', err))
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
  const url = new URL(e.request.url);

  /* ── API calls: network-first ── */
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(
      fetch(e.request.clone())
        .catch(() => new Response(
          JSON.stringify({success: false, error: 'Offline — use cached data'}),
          {status: 200, headers: {'Content-Type': 'application/json'}}
        ))
    );
    return;
  }

  /* ── Google Drive file fetch (your question JSONs) ── */
  if (url.hostname.includes('drive.google.com') || url.hostname.includes('googleusercontent.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return fetch(e.request.clone())
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached || new Response(
            JSON.stringify({success: false, error: 'File not cached'}),
            {status: 200, headers: {'Content-Type': 'application/json'}}
          ));
      })
    );
    return;
  }

  /* ── App shell: network-first ──
     Previously this was stale-while-revalidate — it returned whatever was
     already in Cache Storage immediately, every single time, and only
     updated the cache in the background for the *next* load. That's a
     separate cache from the browser's normal HTTP cache, so a hard
     refresh doesn't touch it — every deploy of index.html/admin.html/
     app.js was silently losing that race indefinitely for anyone who'd
     already loaded the app once. Network-first means you always get the
     live file when online, and only fall back to the cached copy when
     the network request actually fails (offline use). */
  e.respondWith(
    fetch(e.request.clone())
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || new Response('Offline', {status: 503})))
  );
});
