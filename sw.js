/* Service worker: التطبيق والمكتبات للعمل بدون إنترنت + تخزين الخرائط المعروضة والمنزَّلة */
const V = 'gotoxy-app-v1', T = 'gotoxy-tiles', MAXT = 8000;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/shpjs@4.0.4/dist/shp.min.js',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap'
];
const TILEH = /(arcgisonline\.com|\.arcgis\.com|openstreetmap\.org|mt\d\.google\.com)/;
const CORSOK = /(arcgisonline\.com|\.arcgis\.com|openstreetmap\.org)/;
const LIBH = /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all([
      ...CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})),
      ...LIBS.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {}))
    ]);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k !== T) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(c) {
  const ks = await c.keys();
  if (ks.length > MAXT) for (const k of ks.slice(0, ks.length - MAXT + 500)) await c.delete(k);
}
async function tile(req) {
  const c = await caches.open(T), hit = await c.match(req.url);
  if (hit) return hit;
  const u = new URL(req.url);
  if (CORSOK.test(u.host)) {
    try {
      const r = await fetch(req.url, { mode: 'cors' });
      if (r.ok) { c.put(req.url, r.clone()); if (Math.random() < 0.02) trim(c); }
      return r;
    } catch (_) {}
  }
  return fetch(req);
}
async function lib(req) {
  const c = await caches.open(V), hit = await c.match(req.url);
  const net = fetch(req.url, { mode: 'cors' }).then(r => { if (r.ok) c.put(req.url, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || fetch(req);
}
async function page(req) {
  const c = await caches.open(V);
  try {
    const r = await fetch(req);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
  }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) { e.respondWith(page(req)); return; }
  if (TILEH.test(u.host)) { e.respondWith(tile(req)); return; }
  if (LIBH.test(u.host)) { e.respondWith(lib(req)); return; }
});
