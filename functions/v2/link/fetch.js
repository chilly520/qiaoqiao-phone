// Cloudflare Pages Function: 网页链接内容抓取
// 路径: /v2/link/fetch?url=xxx           → 抓取网页标题/描述/图片/评论
//       /v2/link/fetch?url=xxx&comments=1 → 强制抓取评论
// 支持: 通用网页(OG meta)、抖音、小红书
// v1.10.170: 新增评论抓取(从分享页SSR HTML提取)
//
// 返回格式:
// { data: { url, title, description, image, source, favicon, platform, author, comments: [{user, text, likes, time}] } }

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

// v1.10.170: 从抖音 SSR HTML 提取评论
// 抖音分享页 iesdouyin.com/share/video/{id}/ 的 HTML 里嵌入了 RENDER_DATA 或 _ROUTER_DATA
// 里面含有 comments 数组
function extractDouyinComments(html) {
    const comments = [];

    // 方式1: 从 RENDER_DATA (urlencode JSON) 提取
    const renderDataMatch = html.match(/id=["']RENDER_DATA["'][^>]*>([^<]+)</i);
    if (renderDataMatch) {
        try {
            const decoded = decodeURIComponent(renderDataMatch[1]);
            // 在解码后的 JSON 里找 comments 数组
            // 评论结构: {"text":"评论内容","user":{"nickname":"用户名"},"digg_count":10}
            const commentRegex = /\{"text"\s*:\s*"([^"]+)"[^}]*?"user"\s*:\s*\{[^}]*?"nickname"\s*:\s*"([^"]*)"[^}]*\}[^}]*?"digg_count"\s*:\s*(\d+)/g;
            let m;
            while ((m = commentRegex.exec(decoded)) !== null && comments.length < 20) {
                comments.push({
                    user: m[2] || '匿名用户',
                    text: m[1],
                    likes: parseInt(m[3]) || 0,
                });
            }
        } catch (e) {}
    }

    // 方式2: 直接从 HTML 里找 comment 结构(兜底)
    if (comments.length === 0) {
        const commentRegex2 = /"text"\s*:\s*("([^"]{2,200})")[^}]{0,300}?"user"[^}]*?"nickname"\s*:\s*"([^"]*)"/g;
        let m;
        while ((m = commentRegex2.exec(html)) !== null && comments.length < 20) {
            // 过滤掉明显是视频描述而不是评论的(描述通常很长)
            if (m[2].length < 200) {
                comments.push({
                    user: m[3] || '匿名用户',
                    text: m[2],
                    likes: 0,
                });
            }
        }
    }

    return comments;
}

// v1.10.170: 从小红书 SSR HTML 提取评论
// 小红书分享页 HTML 里嵌入了 window.__INITIAL_STATE__ 或 meta 里的评论
function extractXiaohongshuComments(html) {
    const comments = [];

    // 方式1: window.__INITIAL_STATE__ 注入
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
    if (stateMatch) {
        try {
            const jsonStr = stateMatch[1].replace(/undefined/g, 'null');
            const state = JSON.parse(jsonStr);
            // 小红书 state 结构: note.noteDetailMap.{noteId}.comments
            const noteDetailMap = state?.note?.noteDetailMap || {};
            for (const key in noteDetailMap) {
                const noteData = noteDetailMap[key]?.note;
                if (noteData?.comments) {
                    for (const c of noteData.comments) {
                        if (comments.length >= 20) break;
                        comments.push({
                            user: c.user?.nickname || '匿名用户',
                            text: c.content || '',
                            likes: c.likeCount || 0,
                            time: c.createTime || '',
                        });
                    }
                    break;
                }
            }
        } catch (e) {}
    }

    // 方式2: 从 HTML 里找评论结构(兜底)
    if (comments.length === 0) {
        // 小红书评论结构: {"content":"评论","user":{"nickname":"用户"},"likeCount":5}
        const commentRegex = /"content"\s*:\s*"([^"]{2,300})"[^}]{0,200}?"user"[^}]*?"nickname"\s*:\s*"([^"]*)"[^}]{0,100}?"likeCount"\s*:\s*(\d+)/g;
        let m;
        while ((m = commentRegex.exec(html)) !== null && comments.length < 20) {
            comments.push({
                user: m[2] || '匿名用户',
                text: m[1],
                likes: parseInt(m[3]) || 0,
            });
        }
    }

    return comments;
}

// v1.10.170: 通用网页评论提取(从常见评论结构)
function extractGenericComments(html) {
    const comments = [];
    // 尝试常见的评论 JSON 结构
    const patterns = [
        // {"author":"用户","text":"评论","likes":5}
        /"(?:author|user|name|nickname)"\s*:\s*"([^"]{1,50})"[^}]{0,200}?"(?:text|content|comment|body)"\s*:\s*"([^"]{2,300})"/g,
        // {"text":"评论","author":"用户"}
        /"(?:text|content|comment|body)"\s*:\s*"([^"]{2,300})"[^}]{0,200}?"(?:author|user|name|nickname)"\s*:\s*"([^"]{1,50})"/g,
    ];
    for (const re of patterns) {
        let m;
        while ((m = re.exec(html)) !== null && comments.length < 10) {
            // 两种 pattern 顺序不同,统一处理
            const user = re.source.includes('author.*text') ? m[1] : m[2];
            const text = re.source.includes('author.*text') ? m[2] : m[1];
            // 过滤明显非评论的内容
            if (text.length > 5 && !text.includes('\\n') && user.length > 0) {
                comments.push({ user, text, likes: 0 });
            }
        }
        if (comments.length > 0) break;
    }
    return comments;
}

// 抖音:从分享链接提取视频 ID,调用分享页 API
// v1.10.173: 抖音改版,SSR 数据从 RENDER_DATA 改到 window._ROUTER_DATA,
//   结构为 loaderData["video_(id)/page"].videoInfoRes.item_list[0]
//   旧的正则提取 desc/cover/nickname 在新结构下取到的是非目标字段,
//   导致返回 image 为空 → 前端卡片没有封面,只显示一条文字。改为 JSON 解析。
async function fetchDouyin(url, wantComments) {
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

        // v1.10.173: 优先解析 window._ROUTER_DATA JSON 结构
        let desc = '';
        let nickname = '';
        let coverUrl = '';
        let videoPlayUrl = '';

        const routerDataMatch = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
        if (routerDataMatch) {
            try {
                const routerData = JSON.parse(routerDataMatch[1]);
                // 路径: loaderData["video_(id)/page"].videoInfoRes.item_list[0]
                const loaderData = routerData?.loaderData || {};
                const videoPage = loaderData['video_(id)/page'] || loaderData['video_(id)\\u002Fpage'] || null;
                const itemList = videoPage?.videoInfoRes?.item_list || [];
                if (itemList.length > 0) {
                    const item = itemList[0];
                    desc = item.desc || '';
                    nickname = item.author?.nickname || '';
                    // cover 优先,origin_cover 兜底
                    coverUrl = item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0] || '';
                    videoPlayUrl = item.video?.play_addr?.url_list?.[0] || '';
                    // URL 里的 \u002f 转成 /
                    coverUrl = coverUrl.replace(/\\u002f/g, '/');
                    videoPlayUrl = videoPlayUrl.replace(/\\u002f/g, '/');
                }
            } catch (e) {}
        }

        // v1.10.173: _ROUTER_DATA 解析失败时,回退到旧正则(可能匹配到非目标字段,
        //   但总比啥都没有强)
        if (!desc) {
            const descMatch = html.match(/"desc"\s*:\s*"([^"]{2,500})"/);
            if (descMatch) desc = descMatch[1];
        }
        if (!nickname) {
            const nicknameMatch = html.match(/"nickname"\s*:\s*"([^"]+)"/);
            if (nicknameMatch) nickname = nicknameMatch[1];
        }
        if (!coverUrl) {
            const coverMatch = html.match(/"cover"\s*:\s*\{[^}]*"url_list"\s*:\s*\["([^"]+)"/);
            if (coverMatch) coverUrl = coverMatch[1].replace(/\\u002f/g, '/');
        }
        if (!videoPlayUrl) {
            const videoUrlMatch = html.match(/"play_addr"\s*:\s*\{[^}]*"url_list"\s*:\s*\["([^"]+)"/);
            if (videoUrlMatch) videoPlayUrl = videoUrlMatch[1].replace(/\\u002f/g, '/');
        }

        // 视频标记(即使没抓到真实直链,只要是抖音视频就标记为视频类型,
        // 让 AI 知道这是视频而非图文)
        const videoUrlForMark = videoPlayUrl || realUrl;

        const result = {
            url: realUrl,
            title: desc || `抖音视频 ${awemeId}`,
            description: desc,
            image: coverUrl,
            author: nickname,
            videoUrl: videoUrlForMark,
            platform: 'douyin',
            source: '抖音',
            favicon: 'https://www.douyin.com/favicon.ico',
            hostname: 'douyin.com',
        };

        // v1.10.170: 提取评论
        if (wantComments) {
            result.comments = extractDouyinComments(html);
        }

        return result;
    } catch (e) {
        return null;
    }
}

// 小红书:从分享链接提取 note ID
async function fetchXiaohongshu(url, wantComments) {
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
        const result = {
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

        // v1.10.170: 提取评论
        if (wantComments) {
            result.comments = extractXiaohongshuComments(html);
        }

        return result;
    } catch (e) {
        return null;
    }
}

// 通用网页抓取
async function fetchGeneric(url, wantComments) {
    const resp = await fetch(url, {
        headers: { 'User-Agent': UA },
        cf: { cacheTtl: 3600 },
    });
    const html = await resp.text();
    const meta = extractMeta(html, url);
    const platform = detectPlatform(url);

    // v1.10.172: 视频平台补 videoUrl 标记(只标记,不抓真实直链,
    // 让前端和AI知道这是视频类型即可)
    let videoUrl = '';
    if (platform === 'bilibili' || platform === 'youtube' || platform === 'douyin') {
        videoUrl = url; // 用原 URL 作为视频标记
    }

    const result = {
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
    if (videoUrl) result.videoUrl = videoUrl;

    // v1.10.170: 提取评论(通用兜底)
    if (wantComments) {
        result.comments = extractGenericComments(html);
    }

    return result;
}

export async function onRequestGet(context) {
    const { request } = context;
    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get('url');
    // v1.10.170: comments=1 时强制抓取评论
    const wantComments = urlObj.searchParams.get('comments') === '1' || true; // 默认抓评论

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
            data = await fetchDouyin(validUrl, wantComments);
            if (!data) data = await fetchGeneric(validUrl, wantComments);
        } else if (platform === 'xiaohongshu') {
            data = await fetchXiaohongshu(validUrl, wantComments);
            if (!data) data = await fetchGeneric(validUrl, wantComments);
        } else {
            data = await fetchGeneric(validUrl, wantComments);
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
