// Cloudflare Pages Function: 网易云音乐搜索/播放URL
// 路径: /v2/music/netease?word=xxx  → 搜索
//       /v2/music/netease?id=xxx    → 获取播放URL
// 后端: 代理到 https://music-api.gdstudio.xyz/api.php (开源 Meting-API)
// 返回格式统一为 { data: ... } 以兼容前端 musicStore.searchMusic / getSongUrl

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const UPSTREAM = 'https://music-api.gdstudio.xyz/api.php';

// 网易云歌曲封面需要 pic_id 拼成完整 URL
function buildCover(source, picId) {
    if (!picId) return '';
    if (source === 'netease') {
        return `https://music-api.gdstudio.xyz/api.php?source=netease&type=pic&id=${encodeURIComponent(picId)}&size=300`;
    }
    if (source === 'tencent') {
        return `https://music-api.gdstudio.xyz/api.php?source=tencent&type=pic&id=${encodeURIComponent(picId)}&size=300`;
    }
    return '';
}

// 把 gdstudio 返回的搜索条目转成前端期望的格式
function normalizeSearchItem(item) {
    const singers = Array.isArray(item.artist) ? item.artist : (item.artist ? [item.artist] : []);
    return {
        id: String(item.id || item.url_id || ''),
        song: item.name || item.title || '',
        singer: singers.join(' / '),
        cover: buildCover(item.source, item.pic_id),
        source: item.source === 'tencent' ? 'QQ音乐' : (item.source === 'kugou' ? '酷狗' : '网易云'),
        _sourceKey: item.source || 'netease',
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
        apiUrl = `${UPSTREAM}?source=netease&type=url&id=${encodeURIComponent(id)}`;
    } else if (word) {
        apiUrl = `${UPSTREAM}?source=netease&type=search&word=${encodeURIComponent(word)}`;
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

        // 转换数据格式
        let data;
        if (id) {
            // 获取播放URL: gdstudio 返回 { data: { url, br, ... } }
            // 前端期望 { data: { url, ... } }
            data = raw?.data || {};
        } else {
            // 搜索: gdstudio 返回 { data: [...] }
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
