/**
 * Chilly Phone Web Push Worker
 * ---------------------------------------------------------------
 * Endpoints:
 *   GET  /vapid-public-key       → 返回公钥(前端订阅用)
 *   POST /subscribe              → 存储 push 订阅
 *   POST /unsubscribe            → 移除 push 订阅
 *   POST /schedule               → 添加一条定时推送 (test/debug)
 *   POST /trigger                → 立即推送一条 (test/debug)
 *   GET  /health                 → 健康检查
 *
 * Cron trigger (每分钟):
 *   - 扫描 SCHEDULED KV 里 fireTime <= now 的条目
 *   - 对每条执行推送,然后从 KV 删除
 *
 * 部署步骤:
 *   1. cd worker && npm install
 *   2. npx wrangler kv:namespace create SUBSCRIPTIONS
 *   3. npx wrangler kv:namespace create SCHEDULED
 *      (把返回的 id 填到 wrangler.toml)
 *   4. npx web-push generate-vapid-keys
 *      (把 public/private 填到下面 generateVapidKeys() 或用 wrangler secret)
 *   5. npx wrangler secret put VAPID_PUBLIC_KEY
 *      npx wrangler secret put VAPID_PRIVATE_KEY
 *      npx wrangler secret put VAPID_SUBJECT
 *   6. npx wrangler deploy
 */

import { sendWebPush } from './web-push-cf.js';

// CORS 头
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
}

function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

// VAPID 配置 - 在 Cloudflare Workers 里通过环境变量/secret 注入
function getVapidConfig(env) {
    return {
        publicKey: env.VAPID_PUBLIC_KEY || '',
        privateKey: env.VAPID_PRIVATE_KEY || '',
        subject: env.VAPID_SUBJECT || 'mailto:admin@example.com',
    };
}

// 推送给单个订阅
async function sendPushToSubscription(subscription, payload, env) {
    try {
        return await sendWebPush(subscription, payload, env);
    } catch (e) {
        return { ok: false, reason: e.message || 'send_failed' };
    }
}

// 给所有订阅广播
async function broadcastPush(payload, env) {
    const list = await env.SUBSCRIPTIONS.list();
    const results = { total: list.keys.length, sent: 0, failed: 0, cleaned: 0, errors: [] };

    for (const key of list.keys) {
        const subJson = await env.SUBSCRIPTIONS.get(key.name);
        if (!subJson) continue;

        let sub;
        try { sub = JSON.parse(subJson); } catch (e) { continue; }

        const res = await sendPushToSubscription(sub.subscription || sub, payload, env);
        if (res.ok) {
            results.sent++;
        } else {
            results.failed++;
            results.errors.push({ key: key.name, reason: res.reason });
            if (res.shouldCleanup) {
                await env.SUBSCRIPTIONS.delete(key.name);
                results.cleaned++;
            }
        }
    }
    return results;
}

// --- 路由处理 ---
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS 预检
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        try {
            // GET /vapid-public-key → 返回公钥
            if (path === '/vapid-public-key' && request.method === 'GET') {
                const vapid = getVapidConfig(env);
                if (!vapid.publicKey) {
                    return errorResponse('VAPID public key not configured', 503);
                }
                return jsonResponse({ publicKey: vapid.publicKey });
            }

            // GET /health
            if (path === '/health' && request.method === 'GET') {
                const subCount = (await env.SUBSCRIPTIONS.list()).keys.length;
                const scheduledCount = (await env.SCHEDULED.list()).keys.length;
                return jsonResponse({
                    ok: true,
                    subscriptions: subCount,
                    scheduled: scheduledCount,
                    timestamp: Date.now(),
                });
            }

            // POST /subscribe → 存储订阅
            if (path === '/subscribe' && request.method === 'POST') {
                const body = await request.json();
                const { subscription, userId, deviceName } = body;

                if (!subscription || !subscription.endpoint) {
                    return errorResponse('Invalid subscription');
                }

                // 用 endpoint 哈希作为 key (endpoint 很长且含敏感信息)
                const key = `sub:${await sha256(subscription.endpoint)}`;
                await env.SUBSCRIPTIONS.put(key, JSON.stringify({
                    subscription,
                    userId: userId || 'anonymous',
                    deviceName: deviceName || 'unknown',
                    subscribedAt: Date.now(),
                }));

                return jsonResponse({ ok: true, key });
            }

            // POST /unsubscribe
            if (path === '/unsubscribe' && request.method === 'POST') {
                const body = await request.json();
                const { endpoint } = body;
                if (!endpoint) return errorResponse('Missing endpoint');
                const key = `sub:${await sha256(endpoint)}`;
                await env.SUBSCRIPTIONS.delete(key);
                return jsonResponse({ ok: true });
            }

            // POST /schedule → 添加定时推送
            if (path === '/schedule' && request.method === 'POST') {
                const body = await request.json();
                const { fireTime, title, body: msgBody, tag, data, url } = body;

                if (!fireTime || !title) {
                    return errorResponse('fireTime and title are required');
                }

                const id = `sch:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
                const payload = {
                    fireTime,
                    title,
                    body: msgBody || '',
                    tag: tag || 'proactive',
                    data: data || {},
                    url: url || env.SITE_URL || '/',
                    createdAt: Date.now(),
                };
                await env.SCHEDULED.put(id, JSON.stringify(payload));
                return jsonResponse({ ok: true, id, fireTime });
            }

            // POST /trigger → 立即推送
            if (path === '/trigger' && request.method === 'POST') {
                const body = await request.json();
                const { title, body: msgBody, tag, data, url } = body;
                if (!title) return errorResponse('title is required');

                const payload = JSON.stringify({
                    title,
                    body: msgBody || '',
                    tag: tag || 'proactive',
                    data: data || {},
                    url: url || env.SITE_URL || '/',
                });

                const results = await broadcastPush(payload, env);
                return jsonResponse({ ok: true, results });
            }

            // GET / → 简单首页
            if (path === '/' && request.method === 'GET') {
                return new Response(
                    'Chilly Phone Push Server\n\n' +
                    'POST /subscribe     - Register push subscription\n' +
                    'POST /unsubscribe   - Remove subscription\n' +
                    'POST /schedule      - Add scheduled push\n' +
                    'POST /trigger       - Send push now\n' +
                    'GET  /vapid-public-key\n' +
                    'GET  /health\n',
                    { status: 200, headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS } }
                );
            }

            return errorResponse('Not found', 404);
        } catch (e) {
            return errorResponse(e.message || 'Internal error', 500);
        }
    },

    // --- 定时任务:每分钟跑一次 ---
    async scheduled(event, env, ctx) {
        ctx.waitUntil((async () => {
            const now = Date.now();
            const list = await env.SCHEDULED.list();

            for (const key of list.keys) {
                const item = await env.SCHEDULED.get(key.name);
                if (!item) continue;

                let payload;
                try { payload = JSON.parse(item); } catch (e) { continue; }

                if (payload.fireTime <= now) {
                    // 时间到了,推送
                    const pushPayload = JSON.stringify({
                        title: payload.title,
                        body: payload.body,
                        tag: payload.tag,
                        data: { ...payload.data, scheduledId: key.name },
                        url: payload.url,
                    });

                    const results = await broadcastPush(pushPayload, env);
                    console.log(`[Cron] Sent scheduled push ${key.name}:`, JSON.stringify(results));

                    // 删掉已处理的
                    await env.SCHEDULED.delete(key.name);
                }
            }
        })());
    },
};

// SHA-256 工具函数
async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
