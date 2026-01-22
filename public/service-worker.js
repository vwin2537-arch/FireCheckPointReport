const CACHE_NAME = 'fire-watch-cleanup-v2';

self.addEventListener('install', (event) => {
    // Activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Pass through to network - do not cache anything
    // This allows the app to load fresh assets every time
    return;
});
