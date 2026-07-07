// Cloudflare Pages Function: QQ音乐搜索/播放URL
// 路径: /v2/music/tencent?word=xxx  → 搜索
//       /v2/music/tencent?id=xxx    → 获取播放URL
// 后端: 代理到 https://music-api.gdstudio.xyz/api.php (开源 Meting-API)
// 返回格式统一为 { data: ... } 以兼容前端 musicStore.searchMusic / getSongUrl

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const UPSTREAM = 'https://music-api.gdstudio.xyz/api.php';

function buildCover(source, picId) {
    if (!picId) return '';
    return `https://music-api.gdstudio.xyz/api.php?source=${source}&type=pic&id=${encodeURIComponent(picId)}&size=300`;
}

function normalizeSearchItem(item) {
    const singers = Array.isArray(item.artist) ? item.artist : (item.artist ? [item.artist] : []);
    return {
        id: String(item.id || item.url_id || ''),
        song: item.name || item.title || '',
        singer: singers.join(' / '),
        cover: buildCover(item.source, item.pic_id),
        source: item.source === 'tencent' ? 'QQ音乐' : (item.source === 'kugou' ? '酷狗' : '网易云'),
        _sourceKey: item.source || 'tencent',
    };
}

export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const word = url.searchParams.get('word');
    const id = url.searchParams.get('id');

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    let apiUrl = '';
    if (id) {
        apiUrl = `${UPSTREAM}?source=tencent&type=url&id=${encodeURIComponent(id)}`;
    } else if (word) {
        apiUrl = `${UPSTREAM}?source=tencent&type=search&word=${encodeURIComponent(word)}`;
    } else {
        return new Response(JSON.stringify({ error: 'Missing word or id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    try {
        const resp = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (qiaqiao-phone/1.0)' },
            cf: { cacheTtl: 0, cacheEverything: false },
        });

        if (!resp.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${resp.status}` }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        const raw = await resp.json();

        let data;
        if (id) {
            data = raw?.data || {};
        } else {
            const list = Array.isArray(raw?.data) ? raw.data : [];
            data = list.map(normalizeSearchItem);
        }

        return new Response(JSON.stringify({ data }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e?.message || 'fetch failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
}
