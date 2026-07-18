// Cloudflare Pages Function: 网页链接内容抓取
// 路径: /v2/link/fetch?url=xxx  → 抓取网页标题/描述/图片/评论
// 支持: 通用网页(OG meta)、抖音、小红书
// v1.10.169: 新增,为"分享链接"功能提供后端
//
// 返回格式:
// { data: { url, title, description, image, source, favicon, platform, author, comments: [...] } }

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

// 从 HTML 提取 meta 信息(og:title, og:description, og:image 等)
function extractMeta(html, url) {
    const get = (re) => {
        const m = html.match(re);
        return m ? (m[1] || m[2] || '').trim() : '';
    };
    const getAll = (patterns) => {
        for (const re of patterns) {
            const v = get(re);
            if (v) return v;
        }
        return '';
    };

    const title = getAll([
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const description = getAll([
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);
    const image = getAll([
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);
    const author = getAll([
        /<meta[^>]+property=["']og:author["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
    ]);

    let hostname = '';
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}

    // favicon
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    let favicon = faviconMatch ? faviconMatch[1] : '';
    if (favicon && !favicon.startsWith('http')) {
        try { favicon = new URL(favicon, url).href; } catch (e) { favicon = ''; }
    }
    if (!favicon && hostname) {
        favicon = `https://${hostname}/favicon.ico`;
    }

    return {
        title: title || hostname || url,
        description: description || '',
        image: image ? (image.startsWith('http') ? image : (() => { try { return new URL(image, url).href } catch (e) { return '' } })()) : '',
        author: author || '',
        favicon,
        hostname,
    };
}

// 识别平台
function detectPlatform(url) {
    const u = url.toLowerCase();
    if (u.includes('douyin.com') || u.includes('iesdouyin.com')) return 'douyin';
    if (u.includes('xiaohongshu.com') || u.includes('xhslink.com')) return 'xiaohongshu';
    if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
    if (u.includes('weibo.com') || u.includes('weibo.cn')) return 'weibo';
    if (u.includes('zhihu.com')) return 'zhihu';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('instagram.com')) return 'instagram';
    return 'web';
}

const PLATFORM_LABELS = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    bilibili: '哔哩哔哩',
    weibo: '微博',
    zhihu: '知乎',
    youtube: 'YouTube',
    twitter: 'X',
    instagram: 'Instagram',
    web: '网页',
};

// 抖音:从分享链接提取视频 ID,调用分享页 API
async function fetchDouyin(url) {
    // 抖音分享链接通常是 https://v.douyin.com/xxxxx/ 或 https://www.douyin.com/video/xxxxx
    // 先跟随重定向拿到真实 URL
    let realUrl = url;
    try {
        const resp = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA } });
        realUrl = resp.url || url;
    } catch (e) {}

    // 提取 aweme_id
    const idMatch = realUrl.match(/\/video\/(\d+)/) || realUrl.match(/\/note\/(\d+)/) || realUrl.match(/aweme_id=(\d+)/);
    if (!idMatch) return null;

    const awemeId = idMatch[1];
    const apiUrl = `https://www.iesdouyin.com/share/video/${awemeId}/`;
    try {
        const resp = await fetch(apiUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': 'https://www.douyin.com/',
            },
            cf: { cacheTtl: 3600 },
        });
        const html = await resp.text();

        // 从 SSR 渲染的 JSON 里提取数据
        const descMatch = html.match(/"desc"\s*:\s*"([^"]*)"/);
        const nicknameMatch = html.match(/"nickname"\s*:\s*"([^"]*)"/);
        const coverMatch = html.match(/"cover"\s*:\s*\{[^}]*"url_list"\s*:\s*\["([^"]+)"/);
        const videoUrlMatch = html.match(/"play_addr"\s*:\s*\{[^}]*"url_list"\s*:\s*\["([^"]+)"/);

        return {
            url: realUrl,
            title: descMatch ? descMatch[1] : '',
            description: descMatch ? descMatch[1] : '',
            image: coverMatch ? coverMatch[1].replace(/\\u002f/g, '/') : '',
            author: nicknameMatch ? nicknameMatch[1] : '',
            videoUrl: videoUrlMatch ? videoUrlMatch[1].replace(/\\u002f/g, '/') : '',
            platform: 'douyin',
            source: '抖音',
            favicon: 'https://www.douyin.com/favicon.ico',
            hostname: 'douyin.com',
        };
    } catch (e) {
        return null;
    }
}

// 小红书:从分享链接提取 note ID
async function fetchXiaohongshu(url) {
    let realUrl = url;
    try {
        const resp = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA } });
        realUrl = resp.url || url;
    } catch (e) {}

    const idMatch = realUrl.match(/\/explore\/([a-zA-Z0-9]+)/) || realUrl.match(/\/discovery\/item\/([a-zA-Z0-9]+)/) || realUrl.match(/xhslink\.com\/([a-zA-Z0-9]+)/);
    if (!idMatch) return null;

    try {
        const resp = await fetch(realUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': 'https://www.xiaohongshu.com/',
            },
            cf: { cacheTtl: 3600 },
        });
        const html = await resp.text();
        const meta = extractMeta(html, realUrl);
        return {
            url: realUrl,
            title: meta.title,
            description: meta.description,
            image: meta.image,
            author: meta.author,
            platform: 'xiaohongshu',
            source: '小红书',
            favicon: 'https://www.xiaohongshu.com/favicon.ico',
            hostname: 'xiaohongshu.com',
        };
    } catch (e) {
        return null;
    }
}

// 通用网页抓取
async function fetchGeneric(url) {
    const resp = await fetch(url, {
        headers: { 'User-Agent': UA },
        cf: { cacheTtl: 3600 },
    });
    const html = await resp.text();
    const meta = extractMeta(html, url);
    const platform = detectPlatform(url);
    return {
        url,
        title: meta.title,
        description: meta.description,
        image: meta.image,
        author: meta.author,
        platform,
        source: PLATFORM_LABELS[platform] || meta.hostname,
        favicon: meta.favicon,
        hostname: meta.hostname,
    };
}

export async function onRequestGet(context) {
    const { request } = context;
    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get('url');

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    // 校验 URL
    let validUrl;
    try {
        validUrl = new URL(targetUrl).href;
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
    }

    try {
        const platform = detectPlatform(validUrl);
        let data = null;

        // 按平台分发
        if (platform === 'douyin') {
            data = await fetchDouyin(validUrl);
            if (!data) data = await fetchGeneric(validUrl);
        } else if (platform === 'xiaohongshu') {
            data = await fetchXiaohongshu(validUrl);
            if (!data) data = await fetchGeneric(validUrl);
        } else {
            data = await fetchGeneric(validUrl);
        }

        // 补充平台标签
        if (data && !data.source) {
            data.source = PLATFORM_LABELS[platform] || data.hostname;
        }
        data.platform = data.platform || platform;

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
