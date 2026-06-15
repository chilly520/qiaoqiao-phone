/**
 * 头像描述缓存
 * 用 localStorage 缓存 AI 生成的头像文本描述，避免重复调用视觉 API
 */

const AVATAR_DESC_CACHE_KEY = 'qiaoqiao_avatar_descriptions'

/**
 * 简单字符串哈希（用于超长 base64 URL 的缓存键）
 */
export function simpleHash(str) {
    let hash = 0
    if (!str || str.length === 0) return hash
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
    }
    return 'h' + hash
}

/**
 * 读取完整缓存
 */
export function getAvatarDescCache() {
    try {
        const saved = localStorage.getItem(AVATAR_DESC_CACHE_KEY)
        return saved ? JSON.parse(saved) : {}
    } catch (e) {
        return {}
    }
}

/**
 * 保存完整缓存（失败时清空并提示）
 */
export function saveAvatarDescCache(cache) {
    try {
        localStorage.setItem(AVATAR_DESC_CACHE_KEY, JSON.stringify(cache))
    } catch (e) {
        console.warn('[AI Vision] Cache full, clearing old cache to recover space.')
        try {
            localStorage.removeItem(AVATAR_DESC_CACHE_KEY)
        } catch (err) { /* Ignore */ }
    }
}

/**
 * 获取或拉取头像文本描述
 * 命中缓存时直接返回，否则调用视觉 API
 *
 * @param {string} url    - 头像 URL（用于缓存键）
 * @param {string} b64    - base64 dataURL（用于传给视觉 API）
 * @param {string} name   - 角色名
 * @param {string} provider - AI provider (gemini/openai...)
 * @param {string} apiKey
 * @param {string} endpoint
 * @param {string} model
 * @returns {Promise<string|null>}
 */
export async function getOrFetchAvatarDesc(url, b64, name, provider, apiKey, endpoint, model) {
    if (!url || !b64) return null

    // 缓存键：长 base64 取哈希
    const cacheKey = url.length > 100 ? simpleHash(url) : url

    const cache = getAvatarDescCache()
    if (cache[cacheKey]) return cache[cacheKey]

    console.log(`[AI Vision] Fetching description for ${name}...`)

    try {
        let body = {}
        let headers = { 'Content-Type': 'application/json' }
        let targetUrl = endpoint

        const isNativeGemini = provider === 'gemini' && (targetUrl.includes('goog') || targetUrl.includes('vertex'))

        if (isNativeGemini) {
            const parts = b64.split(';base64,')
            const mime = parts[0].replace('data:', '')
            const data = parts[1].replace(/[^A-Za-z0-9+/=]/g, '')

            body = {
                contents: [{
                    role: 'user',
                    parts: [
                        { text: `请为名字叫 ${name} 的人物头像提供一段简短的视觉描述，控制在 15 字以内。重点描述发色、发型、穿着和神态。请以 [DESC: 描述内容] 的格式返回。` },
                        { inline_data: { mime_type: mime, data: data } }
                    ]
                }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
            }
            const sep = targetUrl.includes('?') ? '&' : '?'
            targetUrl = `${targetUrl}${sep}key=${apiKey}`
            if (!targetUrl.includes(':generateContent')) targetUrl = targetUrl.replace(/\/v1beta\/.*/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`
        } else {
            if (targetUrl && !targetUrl.includes('/chat/completions')) {
                if (targetUrl.endsWith('/v1')) {
                    targetUrl = `${targetUrl}/chat/completions`
                } else if (targetUrl.endsWith('/v1/')) {
                    targetUrl = `${targetUrl}chat/completions`
                } else {
                    targetUrl = targetUrl.endsWith('/') ? `${targetUrl}chat/completions` : `${targetUrl}/chat/completions`
                }
            }

            headers['Authorization'] = `Bearer ${apiKey}`
            body = {
                model: model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: `请为"${name}"的头像提供简短中文描述（15字内）。格式：[DESC: 内容]` },
                        { type: 'image_url', image_url: { url: b64 } }
                    ]
                }],
                max_tokens: 100
            }
        }

        const resp = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) })
        if (!resp.ok) {
            if (resp.status !== 405 && resp.status !== 404) {
                console.warn(`[AI Vision] API Error: ${resp.status} ${resp.statusText}`)
            }
            return null
        }

        const resData = await resp.json()

        let desc = ''
        if (provider === 'gemini') {
            desc = resData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        } else {
            desc = resData.choices?.[0]?.message?.content || ''
        }

        const match = desc.match(/\[DESC:\s*(.*?)\]/)
        const finalDesc = match ? match[1].trim() : desc.trim().substring(0, 50)

        if (finalDesc && finalDesc.length > 2) {
            cache[cacheKey] = finalDesc
            saveAvatarDescCache(cache)
            return finalDesc
        } else {
            cache[cacheKey] = '[外貌未描述]'
            saveAvatarDescCache(cache)
        }
    } catch (e) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            console.warn(`[AI Vision] Avatar description skipped: AI Server (${endpoint}) is unreachable.`)
        } else {
            console.warn('[AI Vision] Avatar description fail:', e.message)
        }
        return null
    }
    return null
}
