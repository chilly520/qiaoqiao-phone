// Cloudflare Pages Function: 网易云音乐搜索/播放URL/歌词
// 路径: /v2/music/netease?word=xxx  → 搜索
//       /v2/music/netease?id=xxx    → 获取播放URL
//       /v2/music/netease?id=xxx&type=lyric → 获取歌词
// 后端: 代理到 https://music-api.gdstudio.xyz/api.php
// v1.10.96: gdstudio API 格式升级: type= → types=, word= → name=; 必须显式带 source=
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
    return `https://music-api.gdstudio.xyz/api.php?types=pic&source=${source}&id=${encodeURIComponent(picId)}&size=300`;
}

function normalizeSearchItem(item) {
    const singers = Array.isArray(item.artist) ? item.artist : (item.artist ? [item.artist] : []);
    return {
        id: String(item.id || item.url_id || ''),
        song: item.name || item.title || '',
        singer: singers.join(' / '),
        cover: buildCover('netease', item.pic_id),
        source: '网易云',
        _sourceKey: 'netease',
    };
}

function normalizeUrlResponse(raw) {
    // gdstudio 返回 { url, br, size, from } 或 { data: { url, ... } }
    const data = raw?.data || raw || {};
    return {
        id: String(data.id || ''),
        url: data.url || '',
        br: data.br || 0,
        size: data.size || 0
    };
}

function normalizeLyricResponse(raw) {
    // gdstudio 返回 { lyric, tlyric, from }
    const data = raw?.data || raw || {};
    return {
        lyric: data.lyric || '',
        tlyric: data.tlyric || ''
    };
}

export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const word = url.searchParams.get('word');
    const id = url.searchParams.get('id');
    const type = url.searchParams.get('type') || 'search';

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    let apiUrl = '';
    // v1.10.96: 前端 getLyrics 会轮询 ['lyric', 'lrc', '1', '2', '3'],
    // 这些 type 全部走歌词接口(以前老的 v1 API 有 type 区分,新 gdstudio 不分了)
    if (id && (type === 'lyric' || type === 'lrc' || type === '1' || type === '2' || type === '3')) {
        apiUrl = `${UPSTREAM}?types=lyric&source=netease&id=${encodeURIComponent(id)}`;
    } else if (id) {
        apiUrl = `${UPSTREAM}?types=url&source=netease&id=${encodeURIComponent(id)}`;
    } else if (word) {
        apiUrl = `${UPSTREAM}?types=search&source=netease&name=${encodeURIComponent(word)}&count=20`;
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
        if (id && type === 'lyric') {
            data = normalizeLyricResponse(raw);
        } else if (id) {
            // 获取播放URL
            const n = normalizeUrlResponse(raw);
            // 前端 getSongUrl 期望返回 { data: { url, ... } }
            data = n.url ? n : { url: '', br: 0 };
        } else {
            // 搜索
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
