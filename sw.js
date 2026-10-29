/* Spiral Duct Viewer · service worker (mirrors the NWCC Campus Map approach, made self-healing).
   - Page loads (navigations): NETWORK-FIRST with a short timeout, so a new deploy is picked up right away;
     the cached shell is only used when offline / the network is too slow.
   - Hashed build files, sheet images, icons, fonts: precached, cache-first (they never change under the same URL).
   - Downloadable PDFs (docs/): not precached (too big for every install); cached the first time they are fetched.
   - Self-healing: a new version installs, takes over immediately (skipWaiting + clients.claim) and deletes every
     older sdv- cache (never touches other apps on this github.io origin, e.g. the NWCC map). Precaching is best-effort per file, so one slow or failed download (e.g. the big catalogue PDF
     on cellular) never stops the service worker from installing.
   VERSION and PRECACHE are filled in at build time by the sw plugin in vite.config.ts (content hash of the build). */
const VERSION = '1a61754bd9';
const SHELL = 'sdv-shell-' + VERSION;
const RUNTIME = 'sdv-runtime-' + VERSION;
const PRECACHE = [
  "./",
  "assets/barlow-condensed-latin-500-normal-BgYH2mbd.woff2",
  "assets/barlow-condensed-latin-500-normal-HIEiP5Ov.woff",
  "assets/barlow-condensed-latin-600-normal-BFJEwTuo.woff",
  "assets/barlow-condensed-latin-600-normal-DepVgxBB.woff2",
  "assets/barlow-condensed-latin-700-normal-Dmwat-ge.woff",
  "assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2",
  "assets/gored-elbow-3d-Dby4cBtt.js",
  "assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2",
  "assets/ibm-plex-sans-latin-400-normal-CYLoc0-x.woff",
  "assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2",
  "assets/ibm-plex-sans-latin-500-normal-BgVn5rGT.woff",
  "assets/ibm-plex-sans-latin-600-normal-Cu4Hd6ag.woff",
  "assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2",
  "assets/index-Cr1OHXtA.js",
  "assets/index-xZye0MdE.css",
  "assets/oval-elbow-3d-IJ2w_EEH.js",
  "assets/oval-pipe-3d-BXqnwjlu.js",
  "assets/spiral-pipe-3d-BkjNV75e.js",
  "blueprint.png",
  "icons/apple-touch-icon-v2.png",
  "icons/favicon-16-v2.png",
  "icons/favicon-32-v2.png",
  "icons/favicon-48-v2.png",
  "icons/icon-192-v2.png",
  "icons/icon-512-v2.png",
  "icons/icon-maskable-192-v2.png",
  "icons/icon-maskable-512-v2.png",
  "index.html",
  "logo.png",
  "logo.webp",
  "manifest.webmanifest",
  "og.jpg",
  "sheets/single-wall-oval-1.webp",
  "sheets/single-wall-oval-2.webp",
  "sheets/single-wall-oval-3.webp",
  "sheets/single-wall-oval-fittings-1.webp",
  "sheets/single-wall-round-1.webp",
  "sheets/single-wall-round-2.webp",
  "sheets/single-wall-round-3.webp",
  "sheets/single-wall-round-4.webp",
  "sheets/single-wall-round-5.webp",
  "sheets/single-wall-round-6.webp",
  "sheets/single-wall-round-fittings-1.webp",
  "sheets/single-wall-round-fittings-10.webp",
  "sheets/single-wall-round-fittings-11.webp",
  "sheets/single-wall-round-fittings-12.webp",
  "sheets/single-wall-round-fittings-13.webp",
  "sheets/single-wall-round-fittings-14.webp",
  "sheets/single-wall-round-fittings-15.webp",
  "sheets/single-wall-round-fittings-2.webp",
  "sheets/single-wall-round-fittings-3.webp",
  "sheets/single-wall-round-fittings-4.webp",
  "sheets/single-wall-round-fittings-5.webp",
  "sheets/single-wall-round-fittings-6.webp",
  "sheets/single-wall-round-fittings-7.webp",
  "sheets/single-wall-round-fittings-8.webp",
  "sheets/single-wall-round-fittings-9.webp",
  "splash-banner.webp",
  "splash-logo.png",
  "splash-mark.webp",
  "splash-photo.webp"
];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then(cache => {
    // Shell first (needed to open offline), then everything else; individual failures are ignored.
    const put = u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return cache.put(u, r); }).catch(() => {});
    const shell = ['./', 'index.html'];
    return Promise.all(shell.map(put)).then(() => Promise.all(PRECACHE.filter(u => !shell.includes(u)).map(put)));
  }));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sdv-') && k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.registration.navigationPreload ? self.registration.navigationPreload.disable().catch(() => {}) : null)
    .then(() => self.clients.claim()));
});

function networkFirstPage(req) {
  const fresh = fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(SHELL).then(c => c.put('index.html', copy)).catch(() => {}); }
    return r;
  });
  const timeout = new Promise(resolve => setTimeout(resolve, NAV_TIMEOUT_MS));
  const cached = () => caches.match('index.html', { cacheName: SHELL }).then(c => c || caches.match('./', { cacheName: SHELL }));
  return Promise.race([fresh.catch(() => null), timeout]).then(r => r || cached().then(c => c || fresh));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nothing third-party is used; let the browser handle it
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req).catch(() => fetch(req)));
    return;
  }
  if (req.headers.has('range')) return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req).then(r => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)).catch(() => {}); }
    return r;
  })).catch(() => fetch(req)));
});
