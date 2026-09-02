const CACHE = 'paris-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './tps-data.js', './classifier.js', './referto.js', './app.js',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isDoc = e.request.mode === 'navigate' || /\.html$/.test(new URL(e.request.url).pathname);
  if (isDoc) {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
    );
  } else {
    // Stale-while-revalidate per gli asset (js/css/png): serve subito la copia in
    // cache ma scarica sempre l'aggiornamento in background, così una nuova versione
    // arriva al ricaricamento successivo senza dover bumpare CACHE ogni volta.
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(r => {
          if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
          return r;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});
