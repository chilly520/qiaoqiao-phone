// Cloudflare Pages Function: 热门榜(AI 上下文注入用)
// 路径: /v2/hot?platform=douyin|xiaohongshu|bilibili|weibo
// 返回: { data: [{ title, url, source, hot_score }] }
//
// v1.10.176: 新增。用于注入 AI 上下文,让 AI 知道当前热门内容,
// 在合适时机主动用 [LINK:URL] 分享给用户。
//
// 实现策略:
//   直接抓抖音/小红书热门榜页面会被风控(需要登录/反爬),
//   改为用 Bing 搜索 "热门/daily hot" + site:过滤 间接拿到近期热门内容。
//   虽然不是实时榜单,但足够 AI 上下文用。

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 不同平台的热门关键词(用于 Bing 搜索)
const PLATFORM_HOT_QUERIES = {
    douyin: ['抖音热门', '抖音今日热门', '抖音爆款视频'],
    xiaohongshu: ['小红书热门笔记', '小红书今日爆款', '小红书热门话题'],
    bilibili: ['B站热门视频', '哔哩哔哩排行榜', 'B站今日热门'],
    weibo: ['微博热搜', '微博热门话题', '微博今日热搜'],
};

const PLATFORM_SITE_FILTER = {
    douyin: '(site:v.douyin.com OR site:douyin.com)',
    xiaohongshu: '(site:xiaohongshu.com OR site:xhslink.com)',
    bilibili: '(site:bilibili.com OR site:b23.tv)',
    weibo: '(site:weibo.com OR site:weibo.cn)',
};

function parseBingResults(html, source) {
    const results = [];
    const liRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(html)) !== null && results.length < 10) {
        const block = liMatch[1];
        const aMatch = block.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        let url = aMatch[1];
        if (url.includes('bing.com/aclk') || url.includes('go.microsoft.com')) continue;
        const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
        if (!title) continue;
        const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const snippet = pMatch ? pMatch[1].replace(/<[^>]+>/g, '').trim() : '';
        results.push({ title, url, snippet, source });
    }
    return results;
}

async function searchBing(query, siteFilter) {
    const fullQuery = siteFilter ? `${query} ${siteFilter}` : query;
    const bingUrl = `https://cn.bing.com/search?q=${encodeURIComponent(fullQuery)}&setlang=zh-CN&count=10`;
    const resp = await fetch(bingUrl, {
        headers: {
            'User-Agent': PC_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        cf: { cacheTtl: 1800 },
    });
    return await resp.text();
}

export async function onRequestGet(context) {
    const { request } = context;
    const urlObj = new URL(request.url);
    const platform = urlObj.searchParams.get('platform') || 'douyin';

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const queries = PLATFORM_HOT_QUERIES[platform];
    const siteFilter = PLATFORM_SITE_FILTER[platform];
    if (!queries) {
        return new Response(JSON.stringify({ error: 'Unsupported platform' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    try {
        // 并行查多个关键词,合并去重
        const sources = { douyin: '抖音', xiaohongshu: '小红书', bilibili: '哔哩哔哩', weibo: '微博' };
        const source = sources[platform];
        const htmls = await Promise.all(queries.map(q => searchBing(q, siteFilter).catch(() => '')));

        const seen = new Set();
        const all = [];
        for (const html of htmls) {
            if (!html) continue;
            const results = parseBingResults(html, source);
            for (const r of results) {
                if (seen.has(r.url)) continue;
                seen.add(r.url);
                all.push(r);
                if (all.length >= 15) break;
            }
            if (all.length >= 15) break;
        }

        return new Response(JSON.stringify({
            data: all,
            platform,
            count: all.length,
            cachedAt: new Date().toISOString(),
        }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Hot fetch failed: ' + e.message, data: [] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
}
