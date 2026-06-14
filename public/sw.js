// Minimal Service Worker to satisfy PWA requirements and handle basic notifications
//
// 注意：不要在 activate 中调 clients.claim()！
// v1.10.1 加了 SW 后安卓后台保活失效，根因是 clients.claim() 强制接管当前页面，
// 导致 Chrome 重新评估页面生命周期，音频循环和 setInterval 被更激进地冻结。
// 去掉 claim() 后 SW 在下次刷新时自然接管，不会中断正在运行的保活链路。

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[ServiceWorker] Installed');
});

self.addEventListener('activate', (event) => {
    // 关键修复：不调 clients.claim()
    // 让 SW 在下次页面加载时自然接管，避免中断后台保活
    console.log('[ServiceWorker] Activated');
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
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
