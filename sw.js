/* ═══════════════════════════════════════════════════════════════
   SW.JS — Service Worker for HAMRO AFNAI
   ───────────────────────────────────────────────────────────────
   This MUST be a real file served from the same origin as
   index.html (not a Blob URL). Blob-URL service workers are
   unreliable for installability and don't survive reliably across
   reloads in several browsers — that was a bug in the previous
   version of this app. A real file fixes both PWA installability
   and the "feel like a native app" full-screen experience.

   Strategy:
   - App shell (HTML/CSS/JS) → cache-first, so the UI itself opens
     instantly offline, even on first load after install.
   - Google Apps Script / Drive requests (question data) →
     network-first with cache fallback, so users always get fresh
     content when online but still get *something* offline if
     they've studied that set before (app.js also keeps its own
     localStorage cache of question JSON, which is the primary
     offline data store — this SW cache is a second safety net).
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'ha-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './chapters-data.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Question-data / auth API calls: network-first, cache fallback.
  if (url.includes('script.google.com') || url.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then(
            (r) => r || new Response(JSON.stringify({ success: false, error: 'Offline and not cached' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          )
        )
    );
    return;
  }

  // App shell: cache-first, network fallback, then update cache in background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || fetchPromise;
    })
  );
});
