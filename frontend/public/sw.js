const CACHE_NAME = 'aurafit-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event - cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - cache assets dynamically with stale-while-revalidate
self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests and local/http/https schemes
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip caching backend API paths or media files served by Django
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
    return;
  }

  // Skip Chrome extensions and external schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to keep cache up to date
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignore background fetch errors (e.g. if offline)
          });
        
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache for next time
      return fetch(event.request)
        .then((response) => {
          // Cache successful frontend asset responses (including development module imports from our origin)
          if (response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline and request is for navigating HTML pages (SPA routing), return cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // Return a native network error response which avoids uncaught promise rejections in console
          return Response.error();
        });
    })
  );
});
