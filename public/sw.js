// Minimal Service Worker to satisfy PWA requirements and handle basic notifications

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[ServiceWorker] Installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log('[ServiceWorker] Activated');
});

// Basic fetch event handler required for PWA installability
self.addEventListener('fetch', (event) => {
    // We can leave this empty or perform basic caching
    // Chrome requires at least a defined handler to satisfy the logic
    // event.respondWith(fetch(event.request));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Focus the window if open
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
