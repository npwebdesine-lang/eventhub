// Service Worker עם App Shell caching
// v2 — תומך בנווט offline ומגן מפני מסך לבן
const CACHE_NAME = 'eventick-v2';

// נכסי App Shell שנשמרים בהתקנה
const APP_SHELL = [
  '/',
  '/index.html',
];

// התקנה — שמירת App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// הפעלה — ניקוי caches ישנים
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  clients.claim();
});

// Fetch — אסטרטגיה לפי סוג בקשה
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // התעלם מבקשות Supabase ו-API — תמיד network
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('amazonaws') ||
    request.method !== 'GET'
  ) {
    return;
  }

  // ניווט HTML — cache-first עם fallback ל-index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // נכסי סטטיים (JS, CSS, תמונות) — stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => null);
      return cached || network;
    })
  );
});
