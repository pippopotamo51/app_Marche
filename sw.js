const CACHE_NAME = 'cicerone-cache-v2'; // Incrementata la versione per aggiornare la cache sui dispositivi

// Mettiamo in cache iniziale i file testuali indispensabili, incluso il CSV
const ASSETS_TO_CACHE = [
  './Cicerone_Marche.html',
  './manifest.json',
  './Leaflet/leaflet.css',
  './Leaflet/leaflet.js',
  './MARCHE_2026.csv'
];

// 1. Installazione
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching file di sistema...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Gestione intelligente delle richieste (Fetch)
self.addEventListener('fetch', (event) => {
  // Sicurezza: Ignora richieste non HTTP (es. estensioni del browser)
  if (!event.request.url.startsWith('http')) return;

  // Se la richiesta va verso siti esterni, lasciala passare direttamente su internet
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // A. Gestione specifica per i file CSV (dà priorità alla freschezza o fallback su cache)
  if (event.request.url.endsWith('.csv')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse); // Se la rete fallisce, usa la cache

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // B. Gestione standard per tutte le altre risorse (Mappe, Foto, GeoJSON, HTML)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('Risorsa non trovata o offline:', event.request.url);
        
        // Se cerca un file .geojson ed è offline, restituisce un JSON vuoto valido
        if (event.request.url.endsWith('.geojson')) {
          return new Response('{}', {
            status: 404,
            statusText: 'Not Found',
            headers: new Headers({ 'Content-Type': 'application/json' })
          });
        }

        return new Response('Risorsa non disponibile offline', {
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});