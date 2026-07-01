/* ================================================================
   Service Worker — Offline-Cache für die statischen App-Dateien.

   Strategie: Cache-First für alle hier gelisteten Dateien.
   Das bedeutet: beim ersten Laden werden die Dateien gespeichert.
   Bei jedem weiteren Aufruf kommt die Antwort sofort aus dem Cache —
   also auch ohne Internet. Nur wenn die Datei nicht im Cache ist,
   wird das Netz befragt.

   Dropbox-API-Aufrufe werden NICHT gecacht — sie brauchen immer
   eine frische Verbindung.
   ================================================================ */

const CACHE_NAME = 'aufschreibung-v0.4';

/* Liste der Dateien, die offline verfügbar sein sollen */
const CACHE_DATEIEN = [
  '/aufschreibung/',
  '/aufschreibung/index.html',
  '/aufschreibung/style.css',
  '/aufschreibung/app.js',
  '/aufschreibung/manifest.json',
  '/aufschreibung/icon-192.png',
  '/aufschreibung/icon-512.png',
];

/* ----------------------------------------------------------------
   Installations-Ereignis: alle statischen Dateien in den Cache laden
   ---------------------------------------------------------------- */
self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_DATEIEN);
    })
  );
  /* Sofort aktivieren, ohne auf bestehende Tabs zu warten */
  self.skipWaiting();
});

/* ----------------------------------------------------------------
   Aktivierungs-Ereignis: alte Cache-Versionen aufräumen
   ---------------------------------------------------------------- */
self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys().then((cacheNamen) => {
      return Promise.all(
        cacheNamen
          .filter((name) => name !== CACHE_NAME)
          .map((alter_name) => caches.delete(alter_name))
      );
    })
  );
  /* Sofort die Kontrolle über alle offenen Tabs übernehmen */
  self.clients.claim();
});

/* ----------------------------------------------------------------
   Fetch-Ereignis: Cache-First-Strategie anwenden.
   Dropbox-API-URLs werden übersprungen und direkt ums Netz gebeten.
   ---------------------------------------------------------------- */
self.addEventListener('fetch', (ereignis) => {
  const anfrageUrl = new URL(ereignis.request.url);

  /* Dropbox-API-Aufrufe nie cachen — immer frisch holen */
  if (
    anfrageUrl.hostname === 'api.dropboxapi.com' ||
    anfrageUrl.hostname === 'content.dropboxapi.com' ||
    anfrageUrl.hostname === 'www.dropbox.com' ||
    anfrageUrl.hostname === 'cdn.jsdelivr.net'
  ) {
    return; /* Standardverhalten = normaler Netzwerk-Request */
  }

  /* Nur GET-Anfragen cachen */
  if (ereignis.request.method !== 'GET') {
    return;
  }

  ereignis.respondWith(
    caches.match(ereignis.request).then((gecachteAntwort) => {
      if (gecachteAntwort) {
        /* Datei ist im Cache — sofort zurückgeben */
        return gecachteAntwort;
      }
      /* Nicht im Cache — vom Netz holen und dabei cachen */
      return fetch(ereignis.request).then((netzAntwort) => {
        if (!netzAntwort || netzAntwort.status !== 200) {
          return netzAntwort;
        }
        const antwortKopie = netzAntwort.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(ereignis.request, antwortKopie);
        });
        return netzAntwort;
      });
    })
  );
});
