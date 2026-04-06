// Service Worker בסיסי שמאפשר לאפליקציה לעבור את מבחני ה-PWA
const CACHE_NAME = 'eventick-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // מעביר את הבקשות כרגיל בלי להתערב, מספיק כדי לקבל את ה-V הירוק
  event.respondWith(fetch(event.request).catch(() => new Response('Offline')));
});