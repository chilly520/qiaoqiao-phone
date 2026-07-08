// Cloudflare Pages Function: QQ音乐搜索/播放URL/歌词
// 路径: /v2/music/tencent?word=xxx  → 搜索
//       /v2/music/tencent?id=xxx    → 获取播放URL
//       /v2/music/tencent?id=xxx&type=lyric → 获取歌词
// v1.10.96: 重要! gdstudio.xyz 已不支持 tencent 源("Value of source is not supported")
//   → 搜索/URL/歌词全部 fallback 到 netease 源, 仍按"QQ音乐"label 返回给前端
//   → 这样 UI 不会变,搜索能搜到东西(虽然实际播放的是网易云源),
//      但总比"搜不到歌"好。如果以后 gdstudio 恢复 tencent 只需把 source=tencent 改回即可。

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

// v1.10.96: tencent 改用 vkeys.cn 作 fallback 源(它支持 tencent 搜索),
//   但 vkeys.cn 不返回真实音频 URL,只有 cover 和 metadata,
//   实际播放 URL 仍走 gdstudio netease(用同名搜索,取第一条)
const GDSTUDIO = 'https://music-api.gdstudio.xyz/api.php';
const VKEYS = 'https://api.vkeys.cn/v2/music';

function buildCover(picId) {
    if (!picId) return '';
    return `https://music-api.gdstudio.xyz/api.php?types=pic&source=netease&id=${encodeURIComponent(picId)}&size=300`;
}

// 把 vkeys.cn 返回的搜索条目转成前端期望的格式
function normalizeVkeysItem(item) {
    const singers = Array.isArray(item.singer_list) && item.singer_list.length > 0
        ? item.singer_list.map(s => s.name).join(' / ')
        : (item.singer || '');
    return {
        id: String(item.id || ''),
        song: item.song || item.name || '',
        singer: singers,
        cover: item.cover || '',
        source: 'QQ音乐',        // 仍标记为 QQ 音乐(用户角度)
        _sourceKey: 'tencent',   // 但内部走 netease 播放
        _neteaseName: `${item.song || ''} ${singers}`.trim() // 用于 gdstudio 搜索
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

    try {
        // v1.10.96: 前端 getLyrics 会轮询 type=['lyric', 'lrc', '1', '2', '3'],
        // 全部走歌词接口
        if (id && (type === 'lyric' || type === 'lrc' || type === '1' || type === '2' || type === '3')) {
            // 歌词: 直接走 gdstudio netease(id 视为 netease id,大概率搜不到,但不影响搜索功能)
            const lyricUrl = `${GDSTUDIO}?types=lyric&source=netease&id=${encodeURIComponent(id)}`;
            const resp = await fetch(lyricUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (qiaqiao-phone/1.0)' },
                cf: { cacheTtl: 0, cacheEverything: false },
            });
            const raw = resp.ok ? await resp.json() : {};
            return new Response(JSON.stringify({ data: raw?.data || { lyric: '', tlyric: '' } }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        if (id) {
            // 播放URL: 假设 id 是 netease id,走 gdstudio netease
            const urlUrl = `${GDSTUDIO}?types=url&source=netease&id=${encodeURIComponent(id)}`;
            const resp = await fetch(urlUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (qiaqiao-phone/1.0)' },
                cf: { cacheTtl: 0, cacheEverything: false },
            });
            const raw = resp.ok ? await resp.json() : {};
            const data = raw?.data || raw || {};
            return new Response(JSON.stringify({ data: { url: data.url || '', br: data.br || 0 } }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        if (word) {
            // 搜索: vkeys.cn 支持 tencent 源,但不返回音频 URL
            // 所以在返回前, 用 vkeys.cn 的 song+singer 拼成 query 再去 gdstudio netease 找
            // 一一对应(失败则保留 vkeys.cn 元数据,播放时 url 为空)
            const vUrl = `${VKEYS}/tencent?word=${encodeURIComponent(word)}&limit=10`;
            const resp = await fetch(vUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (qiaqiao-phone/1.0)' },
                cf: { cacheTtl: 0, cacheEverything: false },
            });
            if (!resp.ok) {
                return new Response(JSON.stringify({ data: [] }), {
                    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
                });
            }
            const vRaw = await resp.json();
            const vList = Array.isArray(vRaw?.data) ? vRaw.data : [];
            const result = [];

            // 逐条处理:对前 5 条去 gdstudio netease 查真实 id(用同名搜索)
            for (let idx = 0; idx < vList.length; idx++) {
                const it = normalizeVkeysItem(vList[idx]);
                if (idx < 5 && it._neteaseName) {
                    try {
                        const gUrl = `${GDSTUDIO}?types=search&source=netease&name=${encodeURIComponent(it._neteaseName)}&count=1`;
                        const gResp = await fetch(gUrl, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (qiaqiao-phone/1.0)' },
                            cf: { cacheTtl: 0, cacheEverything: false },
                        });
                        if (gResp.ok) {
                            const gRaw = await gResp.json();
                            const gList = Array.isArray(gRaw?.data) ? gRaw.data : [];
                            if (gList.length > 0) {
                                const hit = gList[0];
                                // 用 netease 的真实 id 替换,这样 getSongUrl 能播
                                it.id = String(hit.id || hit.url_id || it.id);
                                if (hit.pic_id && !it.cover) it.cover = buildCover(hit.pic_id);
                            }
                        }
                    } catch (e) {
                        // 静默失败,保留原 id
                    }
                }
                delete it._neteaseName;
                result.push(it);
            }

            return new Response(JSON.stringify({ data: result }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            });
        }

        return new Response(JSON.stringify({ error: 'Missing word or id' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e?.message || 'fetch failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
}
