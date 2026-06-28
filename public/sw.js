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
    // 通知里携带的目标 chatId,如果有则跳过去
    const targetChatId = event.notification && event.notification.data && event.notification.data.chatId;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 尝试复用已打开的同源窗口
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    // 切到前台 + 通知页面跳到对应 chat
                    return client.focus().then(() => {
                        if (targetChatId) {
                            client.postMessage({
                                type: 'OPEN_CHAT',
                                chatId: targetChatId
                            });
                        }
                    });
                }
            }
            // 没有现成窗口,新开一个并附带 chatId hash
            if (clients.openWindow) {
                const url = targetChatId ? `/?openChat=${encodeURIComponent(targetChatId)}` : '/';
                return clients.openWindow(url);
            }
        })
    );
});

// 监听页面消息,集中处理来自 notificationclick 的跳转请求
self.addEventListener('message', (event) => {
    // 当前 SW 不做复杂工作,只透传
    // 实际跳转由 App.vue 监听 OPEN_CHAT 后用 router.push 处理
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
