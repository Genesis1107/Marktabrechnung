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
const CACHE = 'marktfahrer-v6.83';
const SHELL = [
  './marktfahrer_v6.html',
  './anleitung.html',
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

  // App-Dateien (HTML) & PWA-Start: Network-first mit Cache-Fallback.
  // Sowohl die App selbst als auch die Anleitung sollen sich sofort
  // aktualisieren – sonst hängt eine alte Fassung im Cache fest.
  const istAnleitung = url.pathname.endsWith('anleitung.html');
  const istAppDatei = e.request.mode === 'navigate'
    || url.pathname.endsWith('marktfahrer_v6.html')
    || istAnleitung;
  if (istAppDatei) {
    // Fallback-Ziel bestimmen: bei der Anleitung die Anleitung, sonst die App.
    const fallback = istAnleitung ? './anleitung.html' : './marktfahrer_v6.html';
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE).then((c) => c.put(fallback, kopie));
          return res;
        })
        .catch(() => caches.match(fallback))
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
