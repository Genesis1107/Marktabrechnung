// ═══════════════════════════════════════════════════════════════
// Service Worker – Marktfahrer App (Beerenweine)
// Zweck: App-Start ohne Netz ermöglichen.
// Strategie:
//   · App-Datei (HTML): Network-first → neue Versionen deployen
//     sofort, Cache greift nur als Fallback ohne Netz.
//   · CDN (Supabase-JS), Icons, Manifest: Cache-first mit
//     Hintergrund-Aktualisierung (ändern sich selten).
//   · Supabase-API: wird NIE angefasst (kein Cache, kein Intercept).
// ═══════════════════════════════════════════════════════════════
const CACHE = 'marktfahrer-v6.53';
const SHELL = [
  './marktfahrer_v6.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  // Alte Cache-Versionen aufräumen
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Nur GET-Anfragen behandeln; Supabase-API immer direkt durchreichen
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co')) return;

  // App-Datei & PWA-Start: Network-first mit Cache-Fallback
  const istAppDatei = e.request.mode === 'navigate'
    || url.pathname.endsWith('marktfahrer_v6.html');
  if (istAppDatei) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE).then((c) => c.put('./marktfahrer_v6.html', kopie));
          return res;
        })
        .catch(() => caches.match('./marktfahrer_v6.html'))
    );
    return;
  }

  // Rest (CDN, Icons, Manifest): Cache-first, im Hintergrund erneuern
  e.respondWith(
    caches.match(e.request).then((treffer) => {
      const netz = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const kopie = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, kopie));
          }
          return res;
        })
        .catch(() => treffer);
      return treffer || netz;
    })
  );
});
