import browser from 'webextension-polyfill';

// Cache names
const STATIC_CACHE = 'carbonkarma-static-v1';
const DYNAMIC_CACHE = 'carbonkarma-dynamic-v1';
const API_CACHE = 'carbonkarma-api-v1';

// Resources to cache
const STATIC_RESOURCES = [
    '/popup/popup.html',
    '/popup/popup.js',
    '/popup/style.css',
    '/assets/icons/icon-48.png',
    '/assets/icons/icon-96.png'
];

// Install event - cache static resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_RESOURCES))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => {
                    return key !== STATIC_CACHE && 
                           key !== DYNAMIC_CACHE && 
                           key !== API_CACHE;
                }).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // API requests
    if (url.pathname.includes('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Static resources
    if (STATIC_RESOURCES.includes(url.pathname)) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetchAndCache(request, STATIC_CACHE))
        );
        return;
    }

    // Dynamic resources
    event.respondWith(
        caches.match(request)
            .then(response => response || fetchAndCache(request, DYNAMIC_CACHE))
    );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
    try {
        // Try network first
        const response = await fetch(request);
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Fetch and cache helper
async function fetchAndCache(request, cacheName) {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
}

// Handle messages from the extension
self.addEventListener('message', event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-analytics') {
        event.waitUntil(syncAnalytics());
    }
});

// Sync analytics data
async function syncAnalytics() {
    try {
        const { analytics_queue: queue = [] } = await browser.storage.local.get('analytics_queue');
        if (queue.length === 0) return;

        // Process each event in the queue
        for (const event of queue) {
            try {
                await fetch('/api/analytics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(event)
                });
            } catch (error) {
                console.error('Failed to sync event:', error);
                throw error; // Retry sync later
            }
        }

        // Clear queue after successful sync
        await browser.storage.local.set({ analytics_queue: [] });
    } catch (error) {
        console.error('Failed to sync analytics:', error);
        throw error; // Retry sync later
    }
}

// Periodic sync for updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-data') {
        event.waitUntil(updateData());
    }
});

// Update cached data
async function updateData() {
    try {
        // Update carbon intensity data
        const intensityResponse = await fetch('/api/carbon-intensity');
        const cache = await caches.open(API_CACHE);
        await cache.put('/api/carbon-intensity', intensityResponse);

        // Update suggestions
        const suggestionsResponse = await fetch('/api/suggestions');
        await cache.put('/api/suggestions', suggestionsResponse);
    } catch (error) {
        console.error('Failed to update data:', error);
    }
}
