// Service Worker a Szómondó 1 alkalmazáshoz
// Verzió: v39 - E-könyv olvasó (epub, szó/mondat mentés, könyvjelző)

const CACHE = 'szomondo-1-v50';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// Telepítés: a fontos fájlok cache-elése
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Aktiválás: régi cache-ek törlése
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Hálózati kérések kezelése: network-first stratégia
self.addEventListener('fetch', (e) => {
  // Csak GET kéréseket kezelünk
  if (e.request.method !== 'GET') return;

  // API kérések és adatmentések ne legyenek cache-elve
  const url = new URL(e.request.url);
  if (url.pathname.includes('/api/') || 
      url.pathname.includes('translate') ||
      url.hostname.includes('translate.googleapis.com') ||
      url.hostname.includes('api.mymemory.translated.net') ||
      url.hostname.includes('lingva.ml')) {
    // API kérések: mindig friss adat
    e.respondWith(fetch(e.request).catch(() => {
      return new Response('Hálózati hiba', { status: 503 });
    }));
    return;
  }

  // Normál fájlok: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Csak sikeres válaszokat cache-elünk
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE)
            .then(cache => cache.put(e.request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        // Offline: cache-ből próbáljuk betölteni
        return caches.match(e.request)
          .then(cached => {
            if (cached) return cached;
            // Ha a kért fájl nincs cache-ben, a főoldalt adjuk
            return caches.match('./index.html');
          });
      })
  );
});

// Üzenetkezelés: ha az alkalmazás jelzi, hogy profil váltott
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PROFILE_CHANGED') {
    // Profilváltáskor frissítsük a cache-t (az új index.html-t töltsük be)
    caches.open(CACHE)
      .then(cache => {
        return fetch('./index.html')
          .then(response => {
            if (response && response.status === 200) {
              cache.put('./index.html', response);
            }
          })
          .catch(() => {});
      });
  }
});
