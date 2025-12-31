// This is a basic service worker that enables offline capabilities.

const CACHE_NAME = 'pdf-cache-v1';
const PDF_HOST = 'ezogujldmpxycodwboos.supabase.co'; // The hostname for your PDF storage

// On install, pre-cache some resources
self.addEventListener('install', (event) => {
  // The service worker is installed.
  // You could pre-cache app shell assets here if needed.
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated');
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});


// On fetch, intercept requests and serve from cache if available
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy for PDF files from Supabase: Cache First, then Network
  if (url.hostname === PDF_HOST && url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // console.log('SW: Serving PDF from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, go to network
        try {
          const networkResponse = await fetch(event.request);
          // console.log('SW: Fetching PDF from network and caching:', event.request.url);
          // A response must be consumed only once. We need to clone it to store it in the cache.
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          console.error('SW: Failed to fetch PDF from network:', error);
          // Optionally, return a fallback response
          return new Response('Network error trying to fetch PDF.', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })
    );
    return; // End execution for this request
  }

  // Strategy for other requests: Network First, then Cache (for app assets)
  event.respondWith(
    fetch(event.request).catch(async () => {
      // If the network fetch fails (e.g., offline), try to find it in the cache
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        // console.log('SW: Serving from cache (network failed):', event.request.url);
        return cachedResponse;
      }
      // If not in cache either, well, we're offline and it's not cached.
      // This will result in the browser's default offline error page.
    })
  );
});
