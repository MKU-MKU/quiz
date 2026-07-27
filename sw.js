/* ═══════════════════════════════════════════════════════════════
   SW.JS — HAMRO AFNAI  Service Worker
   Strategy:
   • Admin panel      → NEVER intercepted. Always live network, no
                         cache read/write, no manufactured offline
                         response. A stale/offline admin panel is
                         worse than no admin panel.
   • index.html/shell → network-first, cache-bypass (no-store) so a
                         live connection is never shadowed by a stale
                         copy. Falls back to the last cached copy ONLY
                         when the network genuinely fails — that cached
                         index.html still boots normally and its own
                         resumeUserSession() logic decides whether a
                         permanent/trial user can proceed straight in,
                         or whether to show the login screen.
   • API/getFile      → network-first. Plain API calls (login, checkSession,
                         etc.) get a generic offline JSON fallback and are
                         never cached — most of them aren't safe to serve
                         stale. `action=getFile` responses (the actual
                         question-set JSON) ARE cached in Cache Storage as
                         a second offline layer alongside app.js's own
                         localStorage cache — Cache Storage's quota is far
                         higher than localStorage's ~5-10MB, so this is
                         somewhere for a set to still be found if
                         localStorage filled up before app.js could save
                         it there (except admin — see above).
   • Stale clearance  → whenever we're confirmed online again, purge
                         any cached entries that aren't part of the
                         current SHELL, so a reconnect never leaves old
                         orphaned responses sitting in Cache Storage.
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'ha-shell-v10'; // Bumped: getFile responses are now actually cached (previously dead code targeted drive.google.com, which nothing ever fetches directly — see CODE.GS's handleGetFile comment on why Drive is always proxied through this same script.google.com endpoint instead).
const SHELL = [
  './',
  './index.html',
  './user.html',
  './app.js',
  './chapters-data.js',
  './manifest.json'
  // NOTE: admin.html is deliberately NOT in SHELL — it must never be
  // served from cache, so there's no reason to precache it either.
];

/* Is this request/page the admin panel? Checked two ways:
   1. The request itself is for admin.html (navigating to the page).
   2. The request was issued BY a tab that has admin.html open (an API
      call from admin.html's own script) — found via the client that
      dispatched the fetch, since admin's API calls hit the same GAS_URL
      as everything else and can't be told apart by URL alone. */
async function isAdminOrigin(request, clientId) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('admin.html')) return true;
  if (!clientId) return false;
  try {
    const client = await self.clients.get(clientId);
    return !!(client && client.url && client.url.includes('admin.html'));
  } catch (e) {
    return false;
  }
}

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

// Removes any cached entry not in the current SHELL list, keeping
// getFile question-set responses (those live under the same CACHE_NAME
// but are added dynamically from the API branch below, not part of
// SHELL, and are still wanted offline) — only strips genuinely orphaned
// shell-type entries (e.g. an old admin.html left over from before this
// version, or a removed file).
async function clearStaleShellEntries() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const shellAbs = new Set(SHELL.map(p => new URL(p, self.registration.scope).href));
  await Promise.all(keys.map(req => {
    const url = new URL(req.url);
    const isApi = url.hostname.includes('script.google.com'); // covers cached getFile responses too
    if (isApi) return Promise.resolve(); // leave dynamic/API entries alone
    if (!shellAbs.has(req.url)) {
      return cache.delete(req);
    }
    return Promise.resolve();
  }));
}

// index.html calls this (via postMessage) once checkNet() confirms we've
// come back online, so any stale leftovers get swept immediately on
// reconnect rather than waiting for the next SW version bump.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CLEAR_STALE_IF_ONLINE') {
    e.waitUntil ? e.waitUntil(clearStaleShellEntries()) : clearStaleShellEntries();
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  e.respondWith((async () => {
    const fromAdmin = await isAdminOrigin(e.request, e.clientId);

    /* ── ADMIN: bypass the service worker entirely ──
       No cache read, no cache write, no offline fallback response.
       If the network fails, the browser's normal failure surfaces —
       admin.html's own code (checkAdmin_ / api()/post() error paths)
       is what shows that to the admin, not a fake success:false from
       here pretending things are fine. */
    if (fromAdmin) {
      return fetch(e.request);
    }

    /* ── API calls: network-first ──
       Plain actions (login, checkSession, submitPayment, etc.) get a
       generic offline JSON fallback and are never cached — most aren't
       idempotent or safe to serve stale. `action=getFile` is the
       exception: it's a read-only fetch of question-set JSON, so a
       successful response is also written to Cache Storage, and an
       offline retry is served from there before falling back to the
       generic error. This is a second offline layer alongside app.js's
       own localStorage cache (see app.js's QUIZ._fetch/_save) — Cache
       Storage's quota is much higher than localStorage's, so a set can
       still be found here even if localStorage filled up first. */
    if (url.hostname.includes('script.google.com')) {
      const isGetFile = (url.searchParams.get('action') || '').toLowerCase() === 'getfile';
      try {
        const res = await fetch(e.request.clone());
        if (isGetFile && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        // A successful round-trip means we're online — sweep any stale
        // shell leftovers opportunistically (cheap, non-blocking).
        clearStaleShellEntries();
        return res;
      } catch (err) {
        if (isGetFile) {
          const cached = await caches.match(e.request);
          if (cached) return cached;
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Offline — use cached data' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    /* ── App shell (index.html/user.html/app.js/etc): network-first ──
       `cache: 'no-store'` bypasses the browser's own HTTP cache too, not
       just Cache Storage — so "online" really means online, every time,
       with zero chance of a stale copy shadowing a live connection.
       Falls back to the last cached copy only when the fetch itself
       fails, i.e. genuinely offline. That cached index.html still runs
       its normal boot logic (resumeUserSession) which resolves a
       permanent/trial user straight into the app, or shows login. */
    try {
      const res = await fetch(e.request.clone(), { cache: 'no-store' });
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request);
      return cached || new Response('Offline', { status: 503 });
    }
  })());
});
