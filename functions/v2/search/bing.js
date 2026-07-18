// Cloudflare Pages Function: 网页搜索(AI 工具调用)
// 路径: /v2/search?q=关键词&platform=web|douyin|xiaohongshu
// 返回: { data: [{ title, url, snippet, source }] }
//
// v1.10.176: 新增。AI 通过 [SEARCH:关键词] 指令调用,拿到真实存在的链接列表,
// 然后用 [LINK:URL] 分享给用户。
//
// 实现: 直接爬 Bing 移动版搜索结果页(无需 API Key)。Bing 移动版 HTML 结构简单,
//   每个结果是 <li class="b_algo"><h2><a href="...">title</a></h2><p>snippet</p></li>
// 平台过滤:
//   - web: 全部结果
//   - douyin: site:v.douyin.com OR site:douyin.com
//   - xiaohongshu: site:xiaohongshu.com OR site:xhslink.com

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 从 Bing 搜索结果 HTML 提取条目
function parseBingResults(html) {
    const results = [];
    // 主结果块: <li class="b_algo">...</li>
    const liRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(html)) !== null && results.length < 10) {
        const block = liMatch[1];
        // 标题 + URL: <h2><a href="URL">TITLE</a></h2>
        const aMatch = block.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;
        let url = aMatch[1];
        // 跳过 Bing 内部跳转链接
        if (url.includes('bing.com/aclk') || url.includes('go.microsoft.com')) continue;
        // 标题去标签
        const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
        if (!title) continue;
        // snippet: <p>...</p> 或 <div class="b_caption"><p>
        const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        const snippet = pMatch ? pMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // 识别来源平台
        let source = '网页';
        const u = url.toLowerCase();
        if (u.includes('douyin.com') || u.includes('iesdouyin.com')) source = '抖音';
        else if (u.includes('xiaohongshu.com') || u.includes('xhslink.com')) source = '小红书';
        else if (u.includes('bilibili.com') || u.includes('b23.tv')) source = '哔哩哔哩';
        else if (u.includes('weibo.com')) source = '微博';
        else if (u.includes('zhihu.com')) source = '知乎';
        else {
            try { source = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
        }

        results.push({ title, url, snippet, source });
    }
    return results;
}

// 识别平台 host 过滤
function getPlatformSiteFilter(platform) {
    switch (platform) {
        case 'douyin':
            return '(site:v.douyin.com OR site:douyin.com OR site:iesdouyin.com)';
        case 'xiaohongshu':
            return '(site:xiaohongshu.com OR site:xhslink.com)';
        case 'bilibili':
            return '(site:bilibili.com OR site:b23.tv)';
        case 'weibo':
            return '(site:weibo.com OR site:weibo.cn)';
        case 'zhihu':
            return '(site:zhihu.com)';
        default:
            return '';
    }
}

export async function onRequestGet(context) {
    const { request } = context;
    const urlObj = new URL(request.url);
    const query = urlObj.searchParams.get('q') || '';
    const platform = urlObj.searchParams.get('platform') || 'web';

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (!query) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    // 构造 Bing 查询
    const siteFilter = getPlatformSiteFilter(platform);
    const fullQuery = siteFilter ? `${query} ${siteFilter}` : query;
    // 用 cn.bing.com 避免 bing.com 被重定向到 cn.bing.com 时返回 302 短页面
    const bingUrl = `https://cn.bing.com/search?q=${encodeURIComponent(fullQuery)}&setlang=zh-CN&count=15`;

    try {
        const resp = await fetch(bingUrl, {
            headers: {
                'User-Agent': PC_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            redirect: 'follow', // 跟随重定向
            cf: { cacheTtl: 1800 }, // 缓存 30 分钟
        });
        const html = await resp.text();
        const results = parseBingResults(html);

        return new Response(JSON.stringify({
            data: results,
            query,
            platform,
            count: results.length,
        }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Search failed: ' + e.message, data: [] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }
}
