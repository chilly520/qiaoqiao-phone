/**
 * Chilly Phone Web Push 前端服务
 *
 * 流程:
 *  1. 用户授权通知权限
 *  2. serviceWorker.ready → pushManager.subscribe() → 获取 PushSubscription
 *  3. 把 subscription POST 到 Cloudflare Worker 存储
 *  4. 后端定时任务触发推送 → 浏览器 SW 收到 push 事件 → 弹系统通知
 *
 * 配置:
 *  在 .env / .env.production 设置 VITE_PUSH_SERVER_URL (Worker 部署后的 URL)
 *  未配置时所有 API 都是 no-op,不影响其他功能
 */

const SERVER_URL = (import.meta?.env?.VITE_PUSH_SERVER_URL) || 'https://chilly-phone-push.by811520.workers.dev';

// 状态机
let _state = {
    supported: false,
    permission: 'default',
    subscribed: false,
    subscription: null,
    serverReachable: false,
    lastError: null,
};

const listeners = new Set();

function emit() {
    listeners.forEach(fn => {
        try { fn(_state); } catch (e) { /* ignore */ }
    });
}

function updateState(patch) {
    _state = { ..._state, ...patch };
    emit();
}

function urlBase64ToUint8Array(base64String) {
    // 移除可能的 padding
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function getServerPublicKey() {
    if (!SERVER_URL) return null;
    try {
        const res = await fetch(`${SERVER_URL}/vapid-public-key`, { method: 'GET' });
        if (!res.ok) return null;
        const data = await res.json();
        return data.publicKey;
    } catch (e) {
        console.warn('[PushService] Failed to fetch VAPID public key:', e.message);
        return null;
    }
}

/**
 * 初始化 push 服务
 * - 检查浏览器/环境支持
 * - 检查已有订阅
 * - 不主动请求权限
 */
export async function initPushService() {
    // 1. 基础能力检查
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        updateState({ supported: false, lastError: 'Push API not supported' });
        return false;
    }
    if (!SERVER_URL) {
        updateState({ supported: false, lastError: 'VITE_PUSH_SERVER_URL not configured' });
        return false;
    }

    updateState({ supported: true });

    // 2. 拉公钥,确认后端可达
    const publicKey = await getServerPublicKey();
    if (!publicKey) {
        updateState({ serverReachable: false, lastError: 'Push server unreachable' });
        return false;
    }
    updateState({ serverReachable: true });

    // 3. 等待 SW ready,检查已有订阅
    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            updateState({
                subscribed: true,
                subscription: existing.toJSON(),
                permission: Notification.permission,
            });
            return true;
        }
    } catch (e) {
        console.warn('[PushService] SW ready check failed:', e.message);
    }

    updateState({ permission: Notification.permission });
    return true;
}

/**
 * 请求权限 + 订阅 push
 * 必须在用户手势中调用(比如点击"开启通知"按钮)
 */
export async function subscribePush(options = {}) {
    if (!_state.supported) {
        return { ok: false, reason: 'not_supported', error: _state.lastError };
    }
    if (!_state.serverReachable) {
        // 再尝试一次拉公钥
        const publicKey = await getServerPublicKey();
        if (!publicKey) {
            return { ok: false, reason: 'server_unreachable' };
        }
        updateState({ serverReachable: true });
    }

    // 1. 请求通知权限
    let permission = Notification.permission;
    console.log('[PushService] Current permission:', permission);
    if (permission === 'default') {
        try {
            const p = await Promise.race([
                Notification.requestPermission(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Permission request timeout')), 10000)),
            ]);
            permission = p;
        } catch (e) {
            console.error('[PushService] requestPermission failed:', e.message);
            return { ok: false, reason: 'permission_denied', error: e.message };
        }
    }
    if (permission !== 'granted') {
        updateState({ permission, subscribed: false });
        return { ok: false, reason: 'permission_denied', permission };
    }
    updateState({ permission });

    // 2. 订阅 push
    const publicKey = await getServerPublicKey();
    if (!publicKey) {
        return { ok: false, reason: 'no_public_key' };
    }
    console.log('[PushService] Got public key, waiting for SW ready...');

    let reg;
    try {
        reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 10000)),
        ]);
    } catch (e) {
        console.error('[PushService] SW ready failed:', e.message);
        return { ok: false, reason: 'subscribe_failed', error: e.message };
    }
    console.log('[PushService] SW ready, subscribing...');

    let subscription;
    try {
        subscription = await Promise.race([
            reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Push subscribe timeout')), 15000)),
        ]);
    } catch (e) {
        console.error('[PushService] subscribe failed:', e.message);
        updateState({ lastError: e.message });
        return { ok: false, reason: 'subscribe_failed', error: e.message };
    }
    console.log('[PushService] Push subscribed, saving to server...');

    // 3. 发送到后端
    const subJson = subscription.toJSON();
    try {
        const res = await fetch(`${SERVER_URL}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscription: subJson,
                userId: options.userId || 'default',
                deviceName: options.deviceName || (navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'unknown'),
            }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Server returned ${res.status}: ${txt}`);
        }
    } catch (e) {
        // 后端存不上时回滚订阅
        try { await subscription.unsubscribe(); } catch (err) { /* ignore */ }
        updateState({ lastError: e.message });
        return { ok: false, reason: 'server_save_failed', error: e.message };
    }

    updateState({
        subscribed: true,
        subscription: subJson,
        lastError: null,
    });

    return { ok: true, subscription: subJson };
}

/**
 * 取消订阅
 */
export async function unsubscribePush() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            await sub.unsubscribe();
            // 通知后端删除
            if (SERVER_URL) {
                fetch(`${SERVER_URL}/unsubscribe`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint }),
                }).catch(() => {});
            }
        }
        updateState({ subscribed: false, subscription: null });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * 立即推送一条(测试用)
 */
export async function sendTestPush(payload = {}) {
    if (!SERVER_URL) return { ok: false, reason: 'no_server' };
    try {
        const res = await fetch(`${SERVER_URL}/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: payload.title || 'Chilly Phone 测试',
                body: payload.body || '这是一条来自你的小手机 💕',
                tag: 'test',
                url: payload.url || '/wechat',
                data: payload.data || {},
            }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * 调度未来某时刻的推送
 * @param {number} fireTime - timestamp ms
 * @param {object} payload - { title, body, tag, data, url }
 */
export async function schedulePush(fireTime, payload) {
    if (!SERVER_URL) return { ok: false, reason: 'no_server' };
    try {
        const res = await fetch(`${SERVER_URL}/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fireTime,
                title: payload.title,
                body: payload.body,
                tag: payload.tag || 'proactive',
                data: payload.data || {},
                url: payload.url || '/wechat',
            }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * 监听状态变化
 */
export function onPushStateChange(callback) {
    listeners.add(callback);
    // 立即推一次当前状态
    try { callback(_state); } catch (e) { /* ignore */ }
    return () => listeners.delete(callback);
}

/**
 * 获取当前状态
 */
export function getPushState() {
    return { ..._state };
}

export const pushService = {
    init: initPushService,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    test: sendTestPush,
    schedule: schedulePush,
    onStateChange: onPushStateChange,
    getState: getPushState,
};

export default pushService;
