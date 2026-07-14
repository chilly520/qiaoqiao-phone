// Service Worker for Chilly Phone PWA.
//
// v1.10.64: navigation 改 network-first + cache 兜底
// 原 cache-first 会让 index.html 锁死在 cache 里,新版本 Vite chunk
// hash 变了,旧 index.html 引用的 chunk 404,导致 PWA 卡在老版本。
// 现在 online 时永远拿最新 HTML,offline 时退化到 cache。
//
// v1.10.49: 补齐 fetch 拦截 + navigation cache-first
// v1.10.60: runtime 改 network-first + cache 兜底
//
// 缓存策略:
//   - navigation 请求(打开 PWA): network-first + cache 兜底
//   - 同源 GET 资源(JS/CSS/图片): network-first + cache 兜底
//   - 跨域: 不拦截,直接走网络
//   - API/POST: 不拦截
//
// 启动入口(navigation) 永远 cache 住一份,这样:
//   - 重启手机后无网络能直接走 cache
//   - 网络断了也不白屏
//   - 联网时永远拿到最新 HTML

const APP_ICON = '/pwa-192x192.png?v=4';
// v1.10.116: bump 到 v28 + 强制清理 v3-v27 旧 cache
const SHELL_CACHE = 'chilly-shell-v28';
const RUNTIME_CACHE = 'chilly-runtime-v24';

// 关键 shell 资源,install 时主动 precache
const SHELL_URLS = [
    '/',
    '/index.html',
    '/wechat',
    '/wechat/moments',
    '/manifest.json',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    // v1.10.89: silent.wav 6秒 8-bit 8000Hz mono,内容 15Hz 超低频 sine wave
    // (v1.10.88 用 2kHz 用户反馈能听到"滴"声,2kHz 在人耳最敏感区)
    // (v1.10.87 16-bit 44.1kHz 18kHz 媒体卡片消失)
    // 15Hz < 20Hz 人耳阈值 + 手机喇叭重放差,绝对听不到
    '/silent.wav',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(SHELL_CACHE);
            // addAll 失败会 reject,但 install 不能因此失败,所以单独 cache
            await Promise.allSettled(SHELL_URLS.map(u => cache.add(u).catch(() => {})));
            console.log('[SW] shell precached');
        } catch (e) {
            console.warn('[SW] precache failed', e);
        }
    })());
});

self.addEventListener('activate', (event) => {
    // 注意:不调 clients.claim(),避免影响后台保活
    // 只清理过期 cache
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
                .map(k => caches.delete(k).catch(() => {}))
        );
        console.log('[SW] activated, cleaned old caches');
    })());
});

// --- fetch 拦截:同源 GET 用 cache-first + 后台刷新 ---
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // 只处理同源
    if (url.origin !== self.location.origin) return;

    // navigation 请求(PWA 启动 / 刷新 / 路由跳转)用专用 cache
    if (req.mode === 'navigate') {
        event.respondWith(handleNavigation(req));
        return;
    }

    // 其他同源 GET(JS/CSS/图片/字体)用 runtime cache
    event.respondWith(handleRuntime(req));
});

async function handleNavigation(req) {
    const cache = await caches.open(SHELL_CACHE);
    // v1.10.64: network-first + cache 兜底
    // 在线时永远拿最新 HTML,避免老 index.html 引用失效的 Vite chunk
    try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
            // 异步更新 cache,offline 时还能用
            cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (e) {
        // 网络失败 -> 用 cache 兜底(支持 PWA 离线启动)
        const cached = await cache.match(req, { ignoreSearch: false }).catch(() => null);
        if (cached) return cached;
        // 兜底都没 -> 退化到 shell 根
        const shell = await cache.match('/').catch(() => null);
        if (shell) return shell;
        return new Response(
            '<!doctype html><meta charset="utf-8"><title>Chilly Phone</title>' +
            '<body style="font-family:sans-serif;text-align:center;padding:40px">' +
            '<h2>桥桥暂时离线</h2><p>请检查网络后重试</p></body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

async function handleRuntime(req) {
    const cache = await caches.open(RUNTIME_CACHE);
    // v1.10.60: 改用 network-first + cache 兜底
    // 原来 cache-first 在 Vite 部署新版本后会拿到旧 chunk hash 报 Module Load Failed。
    // 静态资源总是尝试网络,失败才退化到 cache,确保新 chunk 能加载到。
    try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
            // 异步更新 cache,不阻塞响应
            cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
    } catch (e) {
        // 网络失败 -> 用 cache 兜底
        const cached = await cache.match(req).catch(() => null);
        if (cached) return cached;
        // 没有 cache 也失败 -> 抛错(浏览器会处理)
        throw e;
    }
}

function refreshInBackground(cache, req) {
    // 后台拉新版本,不影响当前响应
    fetch(req).then(fresh => {
        if (fresh && fresh.ok) {
            cache.put(req, fresh.clone()).catch(() => {});
        }
    }).catch(() => {});
}

// --- Web Push 接收 ---
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

    if (event.data) {
        try {
            const text = event.data.text();
            if (text) {
                const parsed = JSON.parse(text);
                payload = { ...payload, ...parsed };
            }
        } catch (e) {
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
    const targetChatId = event.notification && event.notification.data && event.notification.data.chatId;
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
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

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // [FIX] v1.10.66: 收到 CLIENTS_RELOAD 时通知所有客户端强制刷新
    // 这样新 SW 接管后会强制页面 reload,加载最新 index.html
    if (event.data && event.data.type === 'CLIENTS_RELOAD') {
        event.waitUntil((async () => {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            for (const client of clients) {
                client.postMessage({ type: 'FORCE_RELOAD' });
            }
        })());
    }
    // 兼容主线程 ping
    if (event.data === 'ping') {
        // 接收到消息本身会重置 SW 休眠倒计时
    }
});

self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[ServiceWorker] Push subscription changed/expired');
    event.waitUntil(
        self.registration.pushManager.subscribe(event.oldSubscription.options)
            .then((newSub) => {
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
