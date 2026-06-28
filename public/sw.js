// Minimal Service Worker to satisfy PWA requirements and handle basic notifications
//
// 注意：不要在 activate 中调 clients.claim()！
// v1.10.1 加了 SW 后安卓后台保活失效，根因是 clients.claim() 强制接管当前页面，
// 导致 Chrome 重新评估页面生命周期，音频循环和 setInterval 被更激进地冻结。
// 去掉 claim() 后 SW 在下次刷新时自然接管，不会中断正在运行的保活链路。
//
// v1.10.37: 加 push 事件处理 — 接收来自 Cloudflare Worker 的 Web Push 并弹系统通知。
// 这是后台通知从"完全无法触达"升级到"真系统级弹窗"的关键。

const APP_ICON = '/pwa-192x192.png?v=4';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[ServiceWorker] Installed');
});

self.addEventListener('activate', (event) => {
    // 关键修复：不调 clients.claim()
    // 让 SW 在下次页面加载时自然接管，避免中断后台保活
    console.log('[ServiceWorker] Activated');
});

// --- Web Push 接收 ---
// 后端 Cloudflare Worker 通过 web-push 库发送 push,浏览器触发本事件。
// 即使 Chilly Phone PWA 处于关闭/后台状态,只要 SW 注册过就会收到。
self.addEventListener('push', (event) => {
    let payload = {
        title: 'Chilly Phone',
        body: '你有一条新消息',
        tag: 'proactive',
        icon: APP_ICON,
        badge: APP_ICON,
        url: '/',
        data: {},
    };

    // 后端发的是 JSON 字符串
    if (event.data) {
        try {
            const text = event.data.text();
            if (text) {
                const parsed = JSON.parse(text);
                payload = { ...payload, ...parsed };
            }
        } catch (e) {
            // 不是 JSON,直接当 body
            payload.body = event.data.text();
        }
    }

    const notifOptions = {
        body: payload.body,
        icon: payload.icon || APP_ICON,
        badge: payload.badge || APP_ICON,
        tag: payload.tag || 'proactive',
        renotify: true,
        requireInteraction: false,
        data: {
            ...(payload.data || {}),
            url: payload.url || '/',
            chatId: payload.data?.chatId || null,
            title: payload.title,
        },
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, notifOptions)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // 通知里携带的目标 chatId,如果有则跳过去
    const targetChatId = event.notification && event.notification.data && event.notification.data.chatId;
    const targetUrl = event.notification.data?.url || '/';

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
                        } else if (targetUrl && targetUrl !== '/') {
                            client.postMessage({
                                type: 'NAVIGATE',
                                url: targetUrl
                            });
                        }
                    });
                }
            }
            // 没有现成窗口,新开一个并附带 chatId hash
            if (clients.openWindow) {
                let url = targetUrl;
                if (targetChatId) {
                    url = `/?openChat=${encodeURIComponent(targetChatId)}`;
                }
                return clients.openWindow(url);
            }
        })
    );
});

// 监听页面消息,集中处理来自 notificationclick 的跳转请求
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // 转发 NAVIGATE 消息 - 已在上面处理
});

// 处理 pushsubscriptionchange (订阅失效时浏览器自动重新订阅)
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[ServiceWorker] Push subscription changed/expired');
    event.waitUntil(
        self.registration.pushManager.subscribe(event.oldSubscription.options)
            .then((newSub) => {
                // 通知页面去更新后端订阅
                return self.clients.matchAll().then((clientList) => {
                    clientList.forEach((client) => {
                        client.postMessage({
                            type: 'PUSH_SUBSCRIPTION_CHANGED',
                            subscription: newSub.toJSON(),
                        });
                    });
                });
            })
            .catch((err) => {
                console.error('[ServiceWorker] Failed to re-subscribe:', err);
            })
    );
});
