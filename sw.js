/* Spiral Duct Viewer · service worker (mirrors the NWCC Campus Map approach).
   - App shell (HTML, JS chunks incl. the 3D viewer + PDF worker, CSS, PDFs, images, icons): precached, cache-first.
   - Fonts are self-hosted and precached like everything else.
   VERSION and PRECACHE are filled in at build time by the sw plugin in vite.config.ts (content hash of the build). */
const VERSION = '5d8b78a0e0';
const SHELL = 'sdv-shell-' + VERSION;
const RUNTIME = 'sdv-runtime-' + VERSION;
const PRECACHE = [
  "./",
  "accuflange.pdf",
  "accuflange.png",
  "assets/barlow-condensed-latin-500-normal-BgYH2mbd.woff2",
  "assets/barlow-condensed-latin-500-normal-HIEiP5Ov.woff",
  "assets/barlow-condensed-latin-600-normal-BFJEwTuo.woff",
  "assets/barlow-condensed-latin-600-normal-DepVgxBB.woff2",
  "assets/barlow-condensed-latin-700-normal-Dmwat-ge.woff",
  "assets/barlow-condensed-latin-700-normal-v1xN8_Wq.woff2",
  "assets/duct-stage--Rl_ur0H.js",
  "assets/ibm-plex-sans-latin-400-normal-CDDApCn2.woff2",
  "assets/ibm-plex-sans-latin-400-normal-CYLoc0-x.woff",
  "assets/ibm-plex-sans-latin-500-normal-6ng42L7E.woff2",
  "assets/ibm-plex-sans-latin-500-normal-BgVn5rGT.woff",
  "assets/ibm-plex-sans-latin-600-normal-Cu4Hd6ag.woff",
  "assets/ibm-plex-sans-latin-600-normal-CuJfVYMP.woff2",
  "assets/index-d1Cb7aNe.css",
  "assets/index-khnVpSA8.js",
  "assets/pdf-DZw16B5N.js",
  "assets/pdf.worker.min-CjEcRF4W.mjs",
  "blueprint.png",
  "catalogue.pdf",
  "double-wall.jpg",
  "favicon.svg",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "logo.png",
  "manifest.webmanifest",
  "og.jpg",
  "splash-logo.png"
];
const CDN_HOSTS = []; // fonts are self-hosted; no third-party requests

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))));
  // First install activates right away; updates wait until the page asks (the "Reload" toast).
  if (!self.registration.active) self.skipWaiting();
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sdv-') && k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    if (req.mode === 'navigate') {
      // Every page load in scope gets the precached shell, so the installed app opens offline.
      event.respondWith(caches.match('./index.html', { cacheName: SHELL }).then(cached => cached || fetch(req)));
      return;
    }
    if (req.headers.has('range')) return; // let the browser stream partial PDF requests itself
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req).then(r => {
      if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
      return r;
    })));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req).then(c => c || Response.error())));
  }
});
