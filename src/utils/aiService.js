import { useSettingsStore } from '../stores/settingsStore'
import { useLoggerStore } from '../stores/loggerStore'
import { useStickerStore } from '../stores/stickerStore'
import { useWorldBookStore } from '../stores/worldBookStore'
import { useMomentsStore } from '../stores/momentsStore'
import { useWalletStore } from '../stores/walletStore'
import { weatherService } from './weatherService'
import { batteryMonitor } from './batteryMonitor'

import { SYSTEM_PROMPT_TEMPLATE } from './ai/prompts'
import { RequestQueue } from './ai/requestQueue'

const apiQueue = new RequestQueue(3, 60000); // 3 requests per 60 seconds (1 minute)

/* --- Avatar Description Cache Logic --- */
const AVATAR_DESC_CACHE_KEY = 'qiaoqiao_avatar_descriptions';
const simpleHash = (str) => {
    let hash = 0;
    if (!str || str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'h' + hash;
}

const getAvatarDescCache = () => {
    try {
        const saved = localStorage.getItem(AVATAR_DESC_CACHE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
};

const saveAvatarDescCache = (cache) => {
    try {
        localStorage.setItem(AVATAR_DESC_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('[AI Vision] Cache full, clearing old cache to recover space.');
        try {
            localStorage.removeItem(AVATAR_DESC_CACHE_KEY);
            // Try saving again with just the current item if possible, or just skip
        } catch (err) { /* Ignore */ }
    }
};

/**
 * Internal helper to get a text description for an avatar to save context/logs.
 */
async function getOrFetchAvatarDesc(url, b64, name, provider, apiKey, endpoint, model) {
    if (!url || !b64) return null;

    // Hash key if it's too long (base64)
    const cacheKey = url.length > 100 ? simpleHash(url) : url;

    const cache = getAvatarDescCache();
    if (cache[cacheKey]) return cache[cacheKey];

    // Don't flood the console/API if we recently failed or if it's just big
    console.log(`[AI Vision] Fetching description for ${name}...`);

    try {
        let body = {};
        let headers = { 'Content-Type': 'application/json' };
        let targetUrl = endpoint;

        // Check for Native Gemini Endpoint vs OpenAI-Compatible Proxy
        // If the endpoint contains 'goog' it's likely native. If not (e.g. sukaka.top), it's likely an OpenAI adapter.
        const isNativeGemini = provider === 'gemini' && (targetUrl.includes('goog') || targetUrl.includes('vertex'));

        if (isNativeGemini) {
            const parts = b64.split(';base64,');
            const mime = parts[0].replace('data:', '');
            const data = parts[1].replace(/[^A-Za-z0-9+/=]/g, '');

            body = {
                contents: [{
                    role: 'user',
                    parts: [
                        { text: `请为名字叫"${name}"的人物的头像提供一段简短的视觉描述（15字以内）。重点描述发色、发型、衣服和神态。请以 "[DESC: 描述内容]" 的格式返回。` },
                        { inline_data: { mime_type: mime, data: data } }
                    ]
                }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
            };
            const sep = targetUrl.includes('?') ? '&' : '?';
            targetUrl = `${targetUrl}${sep}key=${apiKey}`;
            if (!targetUrl.includes(':generateContent')) targetUrl = targetUrl.replace(/\/v1beta\/.*/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        } else {
            // OpenAI Compatible Format (works for OpenAI, Claude, Grok, and Gemini-Proxies like OneAPI/NewAPI)
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = {
                model: model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: `请为"${name}"的头像提供简短中文描述（15字内）。格式：[DESC: 内容]` },
                        { type: 'image_url', image_url: { url: b64 } } // Use b64 here as we need the image data
                    ]
                }],
                max_tokens: 100
            };
        }

        const resp = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!resp.ok) {
            if (resp.status !== 405 && resp.status !== 404) {
                console.warn(`[AI Vision] API Error: ${resp.status} ${resp.statusText}`);
            }
            // Don't cache transient errors, just return null. 405 means endpoint doesn't support this.
            return null;
        }

        const resData = await resp.json();

        let desc = '';
        if (provider === 'gemini') {
            desc = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
            desc = resData.choices?.[0]?.message?.content || '';
        }

        const match = desc.match(/\[DESC:\s*(.*?)\]/);
        const finalDesc = match ? match[1].trim() : desc.trim().substring(0, 50);

        if (finalDesc && finalDesc.length > 2) {
            cache[cacheKey] = finalDesc;
            saveAvatarDescCache(cache);
            return finalDesc;
        } else {
            // Helper to prevent retry loop on un-describable images
            cache[cacheKey] = "[外貌未描述]";
            saveAvatarDescCache(cache);
        }
    } catch (e) {
        console.error('[AI Vision] Avatar description fail:', e);
        // On network error or quota error, we just return null and don't cache
    }
    return null;
}

export async function generateReply(messages, char, abortSignal) {
    const loggerStore = useLoggerStore()
    const config = useSettingsStore().apiConfig || {}
    const stickerStore = useStickerStore()
    const worldBookStore = useWorldBookStore()
    const momentsStore = useMomentsStore()
    const walletStore = useWalletStore()

    // Wrapper to use Queue
    // Pass abortSignal as 3rd arg to internal function
    return apiQueue.enqueue(_generateReplyInternal, [messages, char, abortSignal], abortSignal);
}

/**
 * Generates a preview of the full context that WOULD be sent to the AI.
 * Used for the "Token Stats > Context Details" feature.
 * Does NOT generate a reply or call the API.
 */
export function generateContextPreview(chatId, char) {
    const stickerStore = useStickerStore()
    const worldBookStore = useWorldBookStore()
    const momentsStore = useMomentsStore()

    // 1. System Prompt (Base) - Reusing Template Logic with placeholders
    // We don't have the exact user object here usually, but we have char.userName/Persona
    const settingsStore = useSettingsStore()
    const realUserProfile = settingsStore.personalization?.userProfile || {};

    const userForSystem = {
        name: char.userName || '用户',
        persona: char.userPersona || '',
        gender: char.userGender || '未知', // Add Gender
        signature: '', // Not stored in char usually
        avatarUrl: realUserProfile.avatar || char.userAvatarUrl || '',
        avatarDescription: realUserProfile.avatarDescription || ''
    }

    // Stickers
    const globalStickers = stickerStore.getStickers('global')
    const charStickers = chatId ? stickerStore.getStickers(chatId) : []
    const stickers = [...globalStickers, ...charStickers].filter(s => s && s.name)

    // World Book (Simulate Trigger)
    // We scan the LAST few messages to trigger world book
    const limit = char.contextLimit || 20
    const recentMsgs = (char.msgs || []).slice(-limit)
    const combinedText = recentMsgs.map(m => m.content).join('\n')

    // Manually trigger world book
    const activeBookIds = char.worldBookLinks || char.tags || []

    // 2. Collect entries
    let activeEntries = []
    if (activeBookIds.length > 0 && worldBookStore && worldBookStore.books) {
        activeBookIds.forEach(bookId => {
            const book = worldBookStore.books.find(b => b.id === bookId)
            if (book && book.entries) {
                book.entries.forEach(entry => {
                    if (entry.keys && entry.keys.length > 0) {
                        const isHit = entry.keys.some(k => combinedText.includes(k))
                        if (isHit) activeEntries.push(entry)
                    }
                })
            }
        })
    }

    const worldInfoText = activeEntries.map(e => `[${e.keys[0]}]: ${e.content}`).join('\n')

    // Memory
    let memoryText = ''
    if (char.memory && Array.isArray(char.memory)) {
        memoryText = char.memory.map(m => (typeof m === 'object' ? m.content : m)).join('\n')
    }

    // Pat Settings
    const patSettings = { action: char.patAction, suffix: char.patSuffix }

    // Location Context
    const locationContext = char.locationSync
        ? weatherService.getLocationContextText()
        : ''

    const userLoc = char.userLocation || char.bio?.location || settingsStore.weather?.userLocation || {}
    const userLocText = `\n【用户位置】${userLoc.name || userLoc || '未知'}` + (userLoc.coords ? ` (坐标: ${userLoc.coords.lat}, ${userLoc.coords.lng})` : '')

    const batteryInfo = batteryMonitor.getBatteryInfo()
    const batteryContext = batteryInfo
        ? `\n【手机电量】${batteryInfo.level}%${batteryInfo.charging ? ' (正在充电)' : ''}${batteryInfo.isLow ? ' (电量告急)' : ''}`
        : ''

    const finalEnvContext = locationContext + userLocText + batteryContext

    // 2. Persona Context
    const personaContext = `
【角色设定】
姓名：${char.name}
性别：${char.gender || '未知'}
描述：${char.prompt || char.description || '无'}

【用户设定】
姓名：${char.userName || '用户'}
性别：${char.userGender || '未知'}
人设：${char.userPersona || '无'}
    `.trim()

    // 3. Moments Context (The complex part)
    let momentsContext = ''
    if (momentsStore && momentsStore.moments) {
        const momentsList = momentsStore.moments
        const topMoments = momentsStore.topMoments || []

        // Helper to format moment
        const formatMoment = (m) => {
            if (!m) return ''
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { hour12: false }) : '未知时间'
            let text = `[时间: ${timeStr}] ${m.authorId === char.id ? char.name : (m.authorName || '用户')}: ${m.content}`
            if (m.imageDescriptions && m.imageDescriptions.length > 0) {
                text += `\n(图片内容: ${m.imageDescriptions.join(', ')})`
            }
            if (m.comments && m.comments.length > 0) {
                const commentsText = m.comments.map(c => `  - ${c.authorName}${c.replyTo ? '回复' + c.replyTo : ''}: ${c.content}`).join('\n')
                text += `\n  (评论互动):\n${commentsText}`
            }
            return text
        }

        // Char Moments
        const charMoments = momentsList.filter(m => m.authorId === char.id)
        const charPinned = charMoments.filter(m => topMoments.includes(m.id)).slice(0, 3)

        // User Moments
        const userMoments = momentsList.filter(m => !m.authorId || m.authorId === 'user')
        const userLatests = userMoments.slice(0, 3)

        // Combine into context string
        const parts = []
        if (charPinned.length > 0) {
            parts.push(`【${char.name}的置顶朋友圈】\n${charPinned.map(formatMoment).join('\n---\n')}`)
        }
        if (userLatests.length > 0) {
            parts.push(`【${char.userName || '用户'}的最新朋友圈】\n${userLatests.map(formatMoment).join('\n---\n')}`)
        }
        momentsContext = parts.join('\n\n')
    }

    // 5. History (Context) with Time Delay Hint
    const now = Date.now()
    const aiMessages = recentMsgs.filter(m => m.role === 'ai')
    const lastAiMsg = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1] : null
    const lastAiTime = lastAiMsg ? lastAiMsg.timestamp : now
    const diffMinutes = Math.floor((now - lastAiTime) / 1000 / 60)

    // Current Virtual Time (Real-time calculation for preview)
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const d = new Date()
    const currentVirtualTime = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} 星期${weekDays[d.getDay()]}`

    const historyText = recentMsgs.map((m, index) => {
        let content = m.content

        // Parse Special Types for AI Context
        if (m.type === 'favorite_card' || (content && content.includes('"source":"通话记录"'))) {
            try {
                const data = JSON.parse(content);
                content = `[系统消息] ${data.title || '通话'} 已结束。时长：${data.preview || ''}`;
            } catch (e) { content = '[通话记录]'; }
        } else if (m.type === 'voice') {
            // Ensure voice content is text (transcript)
            content = `[语音消息] ${content}`;
        }

        // Inject hint if it's the last message and delay > 1min
        if (index === recentMsgs.length - 1 && m.role === 'user' && diffMinutes >= 1) {
            const hours = Math.floor(diffMinutes / 60);
            const mins = diffMinutes % 60;
            const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;
            content += ` \n\n【系统提示：当前时间为 ${currentVirtualTime}，距离双方上一次互动时间为 ${timeStr}。请根据时长和当前时间段，在回复中表现出合理的反应。】`
        }
        return `${m.role === 'user' ? (char.userName || 'User') : char.name}: ${content}`
    }).join('\n')

    // 5. Summary
    const summaryText = char.summary || '（暂无自动总结）'

    // Update system prompt with fresh virtual time for accurate preview
    const charWithTime = { ...char, virtualTime: currentVirtualTime }
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE(charWithTime, userForSystem, stickers, worldInfoText, memoryText, patSettings, finalEnvContext)

    return {
        system: systemPrompt,
        persona: personaContext,
        worldBook: worldInfoText || '（未触发关键词）',
        moments: momentsContext,
        history: historyText,
        summary: summaryText
    }
}

// Renamed original generateReply to _generateReplyInternal
async function _generateReplyInternal(messages, char, signal, options = {}) {
    const settingsStore = useSettingsStore()
    const stickerStore = useStickerStore()

    // 获取所有可用表情包 (全局 + 当前角色)
    const globalStickers = stickerStore.getStickers('global')
    // Attempt to get ID from char object (Chat object)
    const charId = char.id || char.uuid
    const charStickers = charId ? stickerStore.getStickers(charId) : []

    // Merge valid stickers and filter empty names
    const availableStickers = [
        ...(globalStickers || []),
        ...(charStickers || [])
    ].filter(s => s && s.name)

    const config = settingsStore.currentConfig || settingsStore.apiConfig
    // Mismatch fix: Store uses 'baseUrl', Service expected 'apiUrl'
    const { baseUrl, apiKey, model, temperature, maxTokens } = config || {}
    const apiUrl = baseUrl // Map baseUrl to apiUrl

    // Provider Detection (Matches HTML Logic)
    let provider = config.provider || 'openai'
    if (!config.provider && apiUrl) {
        if (apiUrl.includes('googleapis.com') || apiUrl.includes('gemini')) {
            provider = 'gemini'
        }
    }

    if (!config) {
        return { error: '未找到有效的 API 配置', internalError: 'Config is null', request: {} }
    }

    if (!apiKey) {
        return { error: '请先在设置中配置 API Key', request: {} }
    }

    // Use user info passed in 'char' object (per-chat settings) or global user profile
    const realUserProfile = settingsStore.personalization?.userProfile || {};
    const userProfile = {
        name: char.userName || realUserProfile.name || '用户',
        persona: char.userPersona || '',
        gender: char.userGender || realUserProfile.gender || '未知',
        signature: realUserProfile.signature || '',
        avatarUrl: char.userAvatar || char.userAvatarUrl || realUserProfile.avatar || ''
    }

    // World Book Logic
    const worldBookStore = useWorldBookStore()
    const logger = useLoggerStore()
    // Ensure entries are loaded (lightweight check)
    try {
        if (worldBookStore && worldBookStore.books && worldBookStore.books.length === 0) {
            await worldBookStore.loadEntries()
        }
    } catch (e) {
        if (logger) logger.addLog('WARN', 'WorldBook load fail', e.message)
    }

    let worldInfoText = ''
    if (char && char.worldBookLinks && Array.isArray(char.worldBookLinks) && char.worldBookLinks.length > 0) {
        try {
            const activeEntries = []
            const books = worldBookStore.books || []
            const allEntries = books.flatMap(b => (b && b.entries) ? b.entries : [])
            const boundEntries = allEntries.filter(e => e && e.id && char.worldBookLinks.includes(e.id))

            const contextText = (messages || []).map(m => {
                const c = m && m.content ? m.content : ''
                return typeof c === 'string' ? c : JSON.stringify(c)
            }).join('\n')

            const lowerContext = contextText.toLowerCase()
            boundEntries.forEach(entry => {
                if (!entry) return
                if (!entry.keys || (Array.isArray(entry.keys) && entry.keys.length === 0)) {
                    activeEntries.push(`[常驻] ${entry.name || '未命名'}: ${entry.content || ''} `)
                    return
                }
                const isHit = Array.isArray(entry.keys) && entry.keys.some(key => {
                    if (!key) return false
                    return lowerContext.includes(String(key).toLowerCase())
                })
                if (isHit) {
                    activeEntries.push(`[触发] ${entry.name || '未命名'}: ${entry.content || ''} `)
                }
            })

            if (activeEntries.length > 0) {
                worldInfoText = activeEntries.join('\n\n')
            }
        } catch (e) {
            if (logger) logger.addLog('ERROR', 'WorldBook logic error', e.message)
        }
    }

    // 构建 System Message
    // Memory Logic
    let memoryText = ''
    if (char && char.memory && Array.isArray(char.memory) && char.memory.length > 0) {
        // Take top 10 recent memories
        const recentMemories = char.memory.slice(0, 10)
        memoryText = recentMemories.map(m => {
            const content = typeof m === 'object' ? (m.content || JSON.stringify(m)) : m
            return `- ${content} `
        }).join('\n')
    }

    // 构建 System Message
    // 如果传入的消息中已经包含了 System Prompt (例如朋友圈生成)，则跳过默认模板
    let systemMsg = null
    const hasCustomSystem = messages && messages.length > 0 && messages[0].role === 'system'

    if (!hasCustomSystem) {
        const patSettings = { action: char.patAction, suffix: char.patSuffix }

        // Environmental Context (Location & Battery)
        const locationContext = char.locationSync
            ? weatherService.getLocationContextText()
            : ''

        const userLoc = char.userLocation || char.bio?.location || settingsStore.weather?.userLocation || {}
        const userLocText = `\n【用户位置】${userLoc.name || userLoc || '未知'}` + (userLoc.coords ? ` (坐标: ${userLoc.coords.lat}, ${userLoc.coords.lng})` : '')

        // Battery Context
        const batteryInfo = batteryMonitor.getBatteryInfo()
        const batteryContext = batteryInfo
            ? `\n【手机电量】${batteryInfo.level}%${batteryInfo.charging ? ' (正在充电)' : ''}${batteryInfo.isLow ? ' (电量告急)' : ''}`
            : ''

        // Append all to environmental context
        const finalEnvContext = locationContext + userLocText + batteryContext + (char.searchEnabled ? '\n【联网搜索】已开启。你可以访问当前实时信息和网络数据。' : '')

        systemMsg = {
            role: 'system',
            content: SYSTEM_PROMPT_TEMPLATE(char || {}, userProfile, availableStickers, worldInfoText, memoryText, patSettings, finalEnvContext)
        }
    }

    // --- Helper: Resolve Image URL to Base64 (Vision Proxy) ---
    const resolveToBase64 = async (url) => {
        if (!url || typeof url !== 'string') return null
        if (url.startsWith('data:image')) return url
        try {
            const resp = await fetch(url)
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
            const blob = await resp.blob()
            return new Promise((resolve) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.onerror = () => resolve(null)
                reader.readAsDataURL(blob)
            })
        } catch (e) {
            console.warn('[AI Vision] Failed to resolve image to base64:', url, e)
            return null // Fallback will use original URL
        }
    }

    // Process messages for Vision API (Multimodal)
    // Convert [图片:URL] or [表情包:名称] to { type: "image_url", image_url: { url: "..." } }
    // OPTIMIZATION: Only send the LAST 5 images to the AI to prevent massive payloads.

    // 1. First, count total images to determine the cutoff index
    let totalImagesCount = 0
    const visionLimit = 2 // Updated from 5 to 2 to minimize context length
    const imageRegex = /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:表情包|STICKER)[:：]([^\]]+)\]/gi

    messages.forEach(msg => {
        if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return

        // 1. Explicit image property (New standard)
        if (msg.image) {
            totalImagesCount++
            return
        }

        // 2. Look for images/stickers in content (Legacy/Inline)
        const content = msg.content || ''
        if (typeof content === 'string') {
            if (content.startsWith('data:image/')) {
                totalImagesCount++
            } else {
                const matches = [...content.matchAll(imageRegex)]
                totalImagesCount += matches.length
            }
        }
    })

    // The index of the first image that should be sent to Vision (0-based global image index)
    // e.g. if Total=6, Limit=5, Start=1. Image #0 is skipped, Images #1-5 are sent.
    const visionStartIndex = Math.max(0, totalImagesCount - visionLimit)
    let currentImageIndex = 0

    const formattedMessages = []
    for (const msg of (messages || [])) {
        if (!msg) {
            formattedMessages.push({ role: 'user', content: '' })
            continue
        }

        // Only process User/AI messages for AI Vision perception
        if (msg.role === 'user' || msg.role === 'assistant') {
            let content = msg.content || ''

            // 1. Priority: msg.image property (New standard)
            if (msg.image) {
                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    const imageId = msg.id || 'curr';
                    const refText = ` [Image Reference ID: ${imageId}]`;

                    let roleText = msg.role === 'user' ? '（用户发送了一张图片）' : '（我发送了一张图片）'
                    if (msg.type === 'moment_card') roleText = '（用户分享了一条朋友圈动态）'
                    else if (msg.type === 'favorite_card') roleText = '（用户分享了一个收藏网页/内容）'

                    // Resolve to B64 if remote
                    const imgUrl = (msg.image.startsWith('http')) ? (await resolveToBase64(msg.image) || msg.image) : msg.image;

                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: `${roleText}${refText}\n${content}` },
                            { type: 'image_url', image_url: { url: imgUrl } }
                        ]
                    })
                    continue
                } else {
                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: `${content} [图片: (由于上下文过长，旧图片视觉信息已忽略)]`
                    })
                    continue
                }
            }

            // 2. Fallback: Check if the content is a raw base64 image string (untagged)
            if (typeof content === 'string' && content.startsWith('data:image/')) {
                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    const imageId = msg.id || 'curr';
                    const refText = ` [Image Reference ID: ${imageId}]`;

                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: (msg.role === 'user' ? '（用户发送了一张图片）' : '（我发送了一张图片）') + refText },
                            { type: 'image_url', image_url: { url: content } }
                        ]
                    })
                    continue
                } else {
                    // Placeholder for older images
                    formattedMessages.push({
                        role: msg.role,
                        content: `[图片: (历史图片已省略以节省流量)]`
                    })
                    continue
                }
            }

            const allStickers = [...globalStickers, ...charStickers]
            const contentParts = []

            // 2. Check if the message is a raw sticker URL (exact match)
            // Note: Stickers are typically small URLs, but we treat them as images for consistency
            const matchedSticker = allStickers.find(s => s.url === content.trim())
            if (matchedSticker) {
                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    const imgUrl = (matchedSticker.url.startsWith('http')) ? (await resolveToBase64(matchedSticker.url) || matchedSticker.url) : matchedSticker.url;
                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: msg.role === 'user' ? `（用户发送了表情包: ${matchedSticker.name}）` : `[表情包:${matchedSticker.name}]` },
                            { type: 'image_url', image_url: { url: imgUrl } }
                        ]
                    })
                    continue
                } else {
                    formattedMessages.push({
                        role: msg.role,
                        content: `[表情包: ${matchedSticker.name}]` // Just keep text
                    })
                    continue
                }
            }

            // 3. Handle potential [图片:URL] and [表情包:名称] within text
            const combinedRegex = /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:表情包|STICKER)[:：]([^\]]+)\]/gi
            let lastIndex = 0
            let match
            combinedRegex.lastIndex = 0

            while ((match = combinedRegex.exec(content)) !== null) {
                if (match.index > lastIndex) {
                    contentParts.push({ type: 'text', text: content.substring(lastIndex, match.index) })
                }

                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (match[1]) {
                    if (isVisionEnabled) {
                        const imageId = msg.id || 'curr';
                        contentParts.push({ type: 'text', text: ` [Image Reference ID: ${imageId}]` });
                        if (!match[1].startsWith('data:')) {
                            contentParts.push({ type: 'text', text: ` [Image URL: ${match[1]}]` });
                        }
                        const finalImgUrl = (match[1].startsWith('http')) ? (await resolveToBase64(match[1]) || match[1]) : match[1];
                        contentParts.push({ type: 'image_url', image_url: { url: finalImgUrl } })
                    } else {
                        contentParts.push({ type: 'text', text: `[图片: ${match[1].startsWith('data:') ? '(历史图片)' : match[1]}]` })
                    }
                } else if (match[2]) {
                    const stickerName = match[2].trim()
                    const sticker = allStickers.find(s => s.name === stickerName)

                    if (sticker) {
                        if (isVisionEnabled) {
                            const finalStickerUrl = (sticker.url.startsWith('http')) ? (await resolveToBase64(sticker.url) || sticker.url) : sticker.url;
                            contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                            contentParts.push({ type: 'image_url', image_url: { url: finalStickerUrl } })
                        } else {
                            contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                        }
                    } else {
                        currentImageIndex--
                        contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                    }
                }
                lastIndex = combinedRegex.lastIndex
            }

            if (lastIndex < content.length) {
                contentParts.push({ type: 'text', text: content.substring(lastIndex) })
            }

            if (contentParts.length > 0) {
                formattedMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: contentParts })
            } else {
                formattedMessages.push(msg)
            }
        } else {
            formattedMessages.push(msg)
        }
    }

    // --- Visual Context Injection (Avatars) ---
    // Goal: Only upload the actual image Base64 ONCE to get a text description.
    // Once we have a description, we just put it in the System Prompt and stop sending the image metadata.
    const visualContextMessages = []
    const userAvatar = realUserProfile?.avatar
    const charAvatar = char.avatar
    const isImage = (s) => typeof s === 'string' && (s.trim().length > 0)

    let userAvatarDesc = null
    let charAvatarDesc = null

    if (isImage(userAvatar) || isImage(charAvatar)) {
        const [userB64, charB64] = await Promise.all([
            resolveToBase64(userAvatar),
            resolveToBase64(charAvatar)
        ])

        // 1. Get descriptions (cached or fresh)
        const results = await Promise.all([
            getOrFetchAvatarDesc(userAvatar, userB64, userProfile.name, provider, apiKey, apiUrl, model),
            getOrFetchAvatarDesc(charAvatar, charB64, char.name, provider, apiKey, apiUrl, model)
        ])
        userAvatarDesc = results[0]
        charAvatarDesc = results[1]

        // 2. Fallback: If AI hasn't described them yet, send the image ONE TIME as a message
        // 2. Fallback: Removed to prevent 405 errors and large payloads
        // If "getOrFetchAvatarDesc" fails (returns null), we simply skip visual context this time.
        // We do NOT want to send raw Base64 if the API already rejected the improved description request.
        if (false && !options.skipVisualContext) {
            // Logic disabled to fix "405 Method Not Allowed" and privacy concerns
        }
    }

    // Attach descriptions to objects so SYSTEM_PROMPT_TEMPLATE can pick them up
    if (userAvatarDesc) userProfile.avatarDescription = userAvatarDesc
    if (charAvatarDesc) char.avatarDescription = charAvatarDesc

    // 构建完整消息链
    const fullMessages = [systemMsg, ...visualContextMessages, ...formattedMessages].filter(Boolean).filter(msg => {
        // FILTER: Remove empty messages (Gemini throws 400 Invalid Argument for empty content)
        if (!msg.content) return false
        if (typeof msg.content === 'string') return msg.content.trim().length > 0
        if (Array.isArray(msg.content)) return msg.content.length > 0
        return true
    })
    console.log('[AI Debug] Full Messages:', JSON.stringify(fullMessages, null, 2))

    // --- PROVIDER SWITCHING LOGIC ---
    let endpoint = baseUrl || ''
    let reqHeaders = { 'Content-Type': 'application/json' }
    let reqBody = {}

    if (provider === 'gemini') {
        // --- GEMINI NATIVE MODE ---
        // 1. URL Construction
        if (!endpoint.includes(':generateContent')) {
            endpoint = endpoint.replace(/\/$/, '')
            if (!endpoint.includes('/models/')) {
                endpoint = `${endpoint}/v1beta/models/${model}:generateContent`
            } else {
                endpoint = `${endpoint}:generateContent`
            }
        }
        // Native Gemini uses ?key= API_KEY
        if (!endpoint.includes('key=')) {
            const separator = endpoint.includes('?') ? '&' : '?'
            endpoint = `${endpoint}${separator}key=${apiKey}`
        }

        // 2. Payload Construction (Messages -> Contents)
        // Extract System Prompt from first message if exists
        let systemInstruction = undefined
        const contentMessages = [...fullMessages]

        // Check if first message is system
        if (contentMessages.length > 0 && contentMessages[0].role === 'system') {
            systemInstruction = { parts: [{ text: contentMessages[0].content }] }
            contentMessages.shift()
        }

        const geminiContents = contentMessages.map(msg => {
            let role = msg.role
            // Gemini uses 'model' instead of 'assistant'
            if (role === 'system') return null // Should be handled above, but just in case
            if (role === 'assistant') role = 'model'

            let parts = []
            if (typeof msg.content === 'string') {
                parts = [{ text: msg.content }]
            } else if (Array.isArray(msg.content)) {
                parts = msg.content.map(p => {
                    if (p.type === 'image_url') {
                        // Gemini Native expects base64 inline_data
                        const url = p.image_url.url
                        if (url && url.startsWith('data:')) {
                            try {
                                const parts = url.split(';base64,')
                                if (parts.length === 2) {
                                    const mime = parts[0].replace('data:', '')
                                    // Robust Sanitization: Remove any non-base64 chars (e.g. appended text hints)
                                    const data = parts[1].replace(/[^A-Za-z0-9+/=]/g, '')
                                    if (!data) {
                                        console.warn('[Gemini] Dropping empty image data after sanitization')
                                        return null
                                    }
                                    return { inline_data: { mime_type: mime, data: data } }
                                }
                            } catch (e) {
                                console.error('[Gemini] Data URL parse failed', p.image_url.url)
                            }
                        }
                        // Fallback for non-base64 or failed parse
                        return { text: `[图片: ${url}]` }
                    }
                    return { text: p.text || '' }
                })
            }
            return { role, parts }
        }).filter(c => c)

        reqBody = {
            contents: geminiContents,
            system_instruction: systemInstruction,
            generationConfig: {
                temperature: Number(temperature) || 0.7,
                maxOutputTokens: Number(maxTokens) || 4096,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            ...(char.searchEnabled && {
                tools: [{ google_search: {} }]
            })
        }
    } else {
        // --- OPENAI / PROXY MODE ---
        // 1. Headers (Standard Auth)
        reqHeaders['Authorization'] = `Bearer ${apiKey}`

        // 2. URL Construction
        if (!endpoint.includes('/chat/completions')) {
            if (endpoint.endsWith('/v1')) {
                endpoint = `${endpoint}/chat/completions`
            } else if (endpoint.endsWith('/v1/')) {
                endpoint = `${endpoint}chat/completions`
            } else {
                endpoint = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`
            }
        }

        // 3. Payload (Standard Messages)
        // [FIX] Gemini Proxy Compatibility Strategy
        // Many proxies/providers for Gemini (via OpenAI protocol) FAIL with 400 if 'role': 'system' is used.
        // We MUST merge the system prompt into the first User message for these models.
        let finalMessages = [...fullMessages];
        const isGeminiModel = model.toLowerCase().includes('gemini') || model.toLowerCase().includes('goog');

        if (isGeminiModel && finalMessages.length > 0 && finalMessages[0].role === 'system') {
            const systemContent = finalMessages[0].content;

            // STRATEGY: Ensure System Prompt is ALWAYS at the very top (Index 0).
            // Instead of searching for the first user message (which might be deep in history after Assistant greetings),
            // we convert the System message directly into a User message at Index 0.

            finalMessages[0] = { role: 'user', content: `[System Instructions]\n${systemContent} ` };

            // Optimization: If the immediate next message is ALSO User, merge them to avoid "User, User" sequence
            // (Many models perform better with strictly alternating User/Assistant roles)
            if (finalMessages.length > 1 && finalMessages[1].role === 'user') {
                const nextUserMsg = finalMessages[1];
                // Append next user content to our new "System-User" message
                // Handle multimodal arrays if necessary (simple text merge for now)
                const nextContent = typeof nextUserMsg.content === 'string' ? nextUserMsg.content : (Array.isArray(nextUserMsg.content) ? nextUserMsg.content.map(c => c.text || '').join('\n') : '');

                finalMessages[0].content += `\n\n[User Message]\n${nextContent} `;

                // If the next msg had images, we should technically preserve them. 
                // For safety/simplicity in this specific patch, we assume text-heavy merges or risk formatting.
                // Ideally, if next is array, we convert [0] to array and push.
                if (Array.isArray(nextUserMsg.content)) {
                    // Convert our current string to array
                    finalMessages[0].content = [{ type: 'text', text: finalMessages[0].content }];
                    // Append non-text parts (images) from next msg
                    const images = nextUserMsg.content.filter(c => c.type === 'image_url');
                    if (images.length > 0) finalMessages[0].content.push(...images);
                }

                // Remove the merged message
                finalMessages.splice(1, 1);
            }
        }

        if (char.searchEnabled) {
            const searchHint = "\n\n【System Order: Web Search Enabled】You have access to real-time information via web search tools. When asked about current events, specific facts, or data after your cutoff, please prioritize using your search tools to provide accurate, up-to-date answers.";
            if (finalMessages && finalMessages.length > 0) {
                const lastMsg = finalMessages[0]; // Usually the system-user merged message
                if (typeof lastMsg.content === 'string') lastMsg.content += searchHint;
                else if (Array.isArray(lastMsg.content)) lastMsg.content.push({ type: 'text', text: searchHint });
            }
        }

        // **Critical**: Do NOT include safety_settings here to match HTML fix
        // [FIX] Global Safety Cap for Max Tokens
        // User settings might be absurdly high (e.g. 3M), but most models only support 4k/8k/64k.
        // We cap it at 64k to prevent 400 Invalid Argument errors.
        let safeMaxTokens = Number(maxTokens) || 4096
        if (safeMaxTokens > 65536) safeMaxTokens = 65536 // Keep global 64k safety, but revert 8k limit


        reqBody = {
            model: model,
            messages: finalMessages,
            temperature: Number(temperature) || 0.7,
            max_tokens: safeMaxTokens,
            stream: false,
            // [ST Feature] Support SillyTavern-style advanced parameters
            // Only add if they are present in config AND deviate from defaults (to avoid 400 errors)
            // [FIX] Use Number(...) casting to ensure string values from localStorage don't fail the check
            ...(config.top_p !== undefined && Number(config.top_p) !== 1.0 && { top_p: Number(config.top_p) }),
            ...(config.top_k !== undefined && Number(config.top_k) > 0 && { top_k: Number(config.top_k) }),
            ...(config.frequency_penalty !== undefined && Number(config.frequency_penalty) !== 0 && { frequency_penalty: Number(config.frequency_penalty) }),
            ...(config.presence_penalty !== undefined && Number(config.presence_penalty) !== 0 && { presence_penalty: Number(config.presence_penalty) }),
            ...(config.repetition_penalty !== undefined && Number(config.repetition_penalty) !== 1.0 && { repetition_penalty: Number(config.repetition_penalty) }),
            ...(config.min_p !== undefined && Number(config.min_p) > 0 && { min_p: Number(config.min_p) }),
            ...(char.searchEnabled && {
                // [FIX] Use strictly standard 'function' type to avoid 422 errors on most providers.
                // Even for search-capable proxies, they usually prefer functions or internal model flags.
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'web_search',
                            description: 'Search the web for real-time information and facts.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string', description: 'The search query string' }
                                },
                                required: ['query']
                            }
                        }
                    }
                ]
            })
        }

        // Remove thinking_budget if present
        // STRATEGY CHANGE: Aggressive deletion of all known 'thinking' parameters
        // to prevent Proxy injection or API rejection.
        const forbiddenKeys = [
            'thinking_budget', 'thinking_config', 'reasoning_budget', 'budget',
            'thinking_mode', 'thinking_level', 'parallel_tool_calls', 'tool_choice',
            'generationConfig', 'extra_body', 'response_format'
        ]

        forbiddenKeys.forEach(key => {
            if (reqBody[key] !== undefined) delete reqBody[key]
        })

        // Double check: If model has "nothinking", we definitely want to scrub everything.
        if (model.includes('nothinking')) {
            // Maybe the proxy sees "nothinking" and TRIES to set budget=0. 
            // We can't stop the proxy from modifying our request, 
            // but we can try to send a clean one.
        }
    }


    // Log the endpoint for debugging
    useLoggerStore().addLog('DEBUG', 'API Config', { endpoint, model, provider })

    // Log the Full Request Payload (for Context Tab)
    useLoggerStore().addLog('AI', '网络请求 (Request)', {
        provider,
        endpoint,
        payload: reqBody,
        hasCustomSystem: fullMessages.length > 0 && fullMessages[0].role === 'system'
    })

    try {
        if (model.toLowerCase().includes('gemini')) {
            // Gemini (native) json format
            if (fullMessages.length > 0 && fullMessages[0].content.includes('JSON')) {
                reqBody.generationConfig = { response_mime_type: "application/json" };
            }
        } else {
            // OpenAI compatible json object mode
            if (fullMessages.length > 0 && fullMessages[0].content.includes('JSON')) {
                reqBody.response_format = { type: "json_object" };
            }
        }

        console.log(`[AI Request] (${provider})`, { endpoint, model, msgCount: fullMessages.length })

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(reqBody)
        })

        let data;

        if (response.ok) {
            data = await response.json().catch(() => null); // Clone stream safety not needed here as we await json
            // Clone check: If we read json here, we can't read text in !ok block easily if we shared logic.
            // But here structure is separated.
            console.log('[AI Response Raw]', data)
        }

        if (!response.ok) {
            const errText = await response.text()
            let errorMsg = `API Error ${response.status}: ${errText} `

            // Helpful hints for 404
            if (response.status === 404) {
                errorMsg += ' (提示: 请检查 Base URL 是否正确，很多服务商需要以 /v1 结尾)'
            }
            // Hint for 503 Token/Service Error
            if (response.status === 503) {
                if (errText.includes('Token') || errText.includes('refresh')) {
                    errorMsg += ' (提示: 代理服务的 Token 刷新失败。这不是代码问题，而是您的 API Key 或代理服务器内部账号过期，请尝试更换 Key 或模型。)'
                } else {
                    errorMsg += ' (提示: 服务暂时不可用，请稍后重试。)'
                }
            }
            // Hint for Thinking Budget 400
            if (response.status === 400) {
                if (errText.includes('thinking_budget')) {
                    errorMsg += ' (提示: 检测到模型代理注入了不支持的参数 thinking_budget。请尝试更换不带 "nothinking" 后缀的模型名称。)'
                } else {
                    // AUTO-RETRY LOGIC for General 400 (likely image corruption)
                    console.warn('[AI Service] 400 Error detected. Attempting text-only fallback...', errText)

                    // 1. Strip images from payload
                    const textOnlyBody = JSON.parse(JSON.stringify(reqBody))
                    if (textOnlyBody.contents) {
                        // Gemini Format
                        textOnlyBody.contents.forEach(c => {
                            if (c.parts) c.parts = c.parts.filter(p => !p.inline_data && !p.image_url)
                        })
                    } else if (textOnlyBody.messages) {
                        // OpenAI Format
                        textOnlyBody.messages.forEach(m => {
                            if (Array.isArray(m.content)) {
                                m.content = m.content.filter(c => c.type === 'text')
                            }
                        })
                    }

                    // 2. Add System Note
                    useLoggerStore().addLog('AI', '⚠️ 400错误自动重试 (转纯文本模式/SystemOrder)', { originalError: errText })

                    // 3. Retry Request
                    const retryResp = await fetch(endpoint, {
                        method: 'POST',
                        headers: reqHeaders,
                        body: JSON.stringify(textOnlyBody)
                    })

                    if (retryResp.ok) {
                        data = await retryResp.json() // [FIX] Assign to data, don't return raw
                    } else {
                        // If retry also failed, capture that error
                        const retryErrText = await retryResp.text()
                        console.warn('[AI Service] Text-only retry failed:', retryErrText)
                        errorMsg += `\n(自动重试也失败了: ${retryErrText})`
                        throw new Error(errorMsg)
                    }
                }
            } else {
                throw new Error(errorMsg)
            }
        }
        // else data is already set above

        // Log Full Response (Success)
        useLoggerStore().addLog('AI', 'AI响应 (Response)', data)

        // Robust Parsing: Support OpenAI 'choices' and Google 'candidates'
        let rawContent = ''

        if (data.choices && data.choices.length > 0) {
            rawContent = data.choices[0].message?.content || ''
        } else if (data.candidates && data.candidates.length > 0) {
            // Google/Gemini Format
            const parts = data.candidates[0].content?.parts || []
            if (parts.length > 0) {
                rawContent = parts[0].text || ''
            }
        }

        // Deep Debugging for Empty Content
        if (!rawContent) {
            useLoggerStore().addLog('WARN', 'AI返回内容为空', data)
            // Check for safety/finish reason
            const finishReason = data.choices?.[0]?.finish_reason || data.candidates?.[0]?.finishReason
            if (finishReason === 'safety' || finishReason === 'content_filter') {
                return {
                    error: '内容被AI安全策略拦截 (Safety Filter)',
                    request: {
                        provider,
                        endpoint,
                        headers: reqHeaders,
                        body: reqBody
                    }
                }
            }
            return {
                error: 'AI返回了空内容，请检查日志 (Raw Data)',
                request: {
                    provider,
                    endpoint,
                    headers: reqHeaders,
                    body: reqBody
                }
            }
        }

        // Log Token Usage
        if (data.usage) {
            const total = data.usage.total_tokens
            useLoggerStore().addLog(total > 50000 ? 'WARN' : 'INFO', `Token Usage: ${total} `, data.usage)
        }

        // 简单的后处理：分离心声和正文
        let content = rawContent
        let innerVoice = null

        // 提取 [INNER_VOICE] - 增强并发掘能力
        const ivPattern = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/i
        let ivMatch = content.match(ivPattern)
        let ivSegment = ivMatch ? ivMatch[1].trim() : null

        // FALLBACK: 如果没找到标签，但文本里有看起来像心声的 JSON 块
        if (!ivSegment && (content.includes('"status"') || content.includes('"心声"') || content.includes('"情绪"'))) {
            // 尝试寻找最后一个包含关键词的大括号块
            const blocks = [...content.matchAll(/\{[\s\S]*?\}/g)]
            for (let i = blocks.length - 1; i >= 0; i--) {
                const block = blocks[i][0]
                if (block.includes('"status"') || block.includes('"心声"') || block.includes('"着装"') || block.includes('"thought"')) {
                    ivSegment = block
                    console.log('[AI Service] Found untagged Inner Voice block via keyword scan')
                    break
                }
            }
        }

        if (ivSegment) {
            try {
                // Robust Cleanup: Remove Markdown code blocks
                let cleanSegment = ivSegment.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()

                // Try direct parse first
                try {
                    innerVoice = JSON.parse(cleanSegment)
                } catch (e) {
                    // Fallback 1: Find the FIRST JSON-like object '{ ... }' in the segment (if it was a partial match)
                    const jsonObjectMatch = cleanSegment.match(/\{[\s\S]*\}/)
                    if (jsonObjectMatch) {
                        innerVoice = JSON.parse(jsonObjectMatch[0].trim())
                    } else {
                        throw e
                    }
                }
            } catch (e) {
                // FALLBACK 2: Regex Violence (From old version logic)
                // If JSON.parse totally fails, we extract fields one by one
                console.warn('[AI Service] JSON parse failed, triggering Regex Violence fallback', e)

                const extractField = (keys) => {
                    for (let k of keys) {
                        const reg = new RegExp(`(?:"|\\\\")?${k}(?:"|\\\\")?\\s*[:：]\\s*(?:"|\\\\")?((?:[^"\\\\}]|\\\\.)*?)(?:"|\\\\")?(?:,|}|$)`, 'i');
                        const m = ivSegment.match(reg);
                        if (m && m[1]) return m[1].replace(/\\"/g, '"').trim();
                    }
                    return null;
                };

                const status = extractField(['status', '状态', '当前状态', '心情']);
                const outfit = extractField(['着装', 'outfit', 'clothes', 'clothing', '穿着']);
                const scene = extractField(['环境', 'scene', 'environment', '场景']);
                const mind = extractField(['心声', 'thoughts', 'mind', 'inner_voice', 'thought', '情绪', '情感', '想法']);
                const action = extractField(['行为', 'action', 'behavior', 'plan', '动作']);

                if (status || outfit || scene || mind || action) {
                    innerVoice = {
                        status: status || "",
                        着装: outfit || "",
                        环境: scene || "",
                        心声: mind || "",
                        行为: action || ""
                    }
                } else {
                    useLoggerStore().addLog('WARN', '心声解析失败', { error: e.message, segment: ivSegment.substring(0, 150) })
                }
            }
        }

        // Family Card Logic (Auto-Process) -> NOW LEGACY, REMOVED to let Frontend handle it
        // The store (chatStore) will detect [FAMILY_CARD] tags and set msg.type = 'family_card'
        // ChatMessageItem.vue will render the native Vue component.

        // 1. APPROVE & 2. REJECT - Pass through raw tags
        // No modification needed.

        // 移除 <reasoning_content> (如果有)
        content = content.replace(/<reasoning_content>[\s\S]*?<\/reasoning_content>/gi, '').trim()

        return {
            content,
            innerVoice,
            raw: rawContent,
            request: {
                provider,
                endpoint,
                headers: reqHeaders,
                body: reqBody
            }
        }

    } catch (error) {
        console.error('AI Generation Failed:', error)
        // [FIX] Ensure error is logged to System Logs UI
        try {
            useLoggerStore().addLog('ERROR', `API请求失败: ${error.message}`, { error: error.toString(), stack: error.stack })
        } catch (logErr) {
            console.error('Logger failed:', logErr)
        }

        // [AUTO-FIX] Smart Retry for Proxy Injection
        // If error is 400 and related to thinking_budget AND model has 'nothinking', try stripping it.
        if (error.message && error.message.includes('thinking_budget')) {
            // Aggressive Clean: Remove prefix (e.g. "channel/") AND "nothinking"
            // Example: "流式抗截断/gemini-2.5-pro-nothinking" -> "gemini-2.5-pro"
            const baseName = model.split('/').pop()
            const cleanModel = baseName.replace(/[-_.]?nothinking[-_.]?/i, '')

            // Check if we actually changed the model to avoid infinite retry of same thing
            if (cleanModel !== model) {
                useLoggerStore().addLog('WARN', `检测到代理注入异常，尝试『根源净化』(去除前缀+后缀: ${cleanModel}) 并重置Token限制...`, { from: model, to: cleanModel })

                // Deep clone messages or use fullMessages if available in scope?? 
                // We need to re-call _generateReplyInternal but we need arguments.
                // Actually we can just re-fetch here if we update reqBody.

                // Update reqBody
                reqBody.model = cleanModel
                // [FIX] Cap max_tokens to safe limit (8192) because standard Gemini models don't support >65536 output, 
                // and user settings might be huge (e.g. 2999256).
                reqBody.max_tokens = 8192

                try {
                    const retryResponse = await fetch(endpoint, {
                        method: 'POST',
                        headers: reqHeaders,
                        body: JSON.stringify(reqBody)
                    })

                    if (!retryResponse.ok) {
                        const retryErrText = await retryResponse.text()
                        throw new Error(`Retry Failed ${retryResponse.status}: ${retryErrText}`)
                    }

                    const retryData = await retryResponse.json()
                    useLoggerStore().addLog('AI', '自动重试成功 (Retry Success)', retryData)

                    // ... Duplicate parsing logic ...
                    // To avoid code duplication, we return a recursive call? 
                    // No, internal function signature is strictly messages/char/signal.
                    // We can't change 'char' easily here.

                    // Minimal parse for success case
                    let rawRetry = ''
                    if (retryData.choices && retryData.choices.length > 0) {
                        rawRetry = retryData.choices[0].message?.content || ''
                    } else if (retryData.candidates && retryData.candidates.length > 0) {
                        const parts = retryData.candidates[0].content?.parts || []
                        if (parts.length > 0) rawRetry = parts[0].text || ''
                    }

                    // Post-process
                    let content = rawRetry
                    let innerVoice = null
                    const ivMatch = content.match(/\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/i)
                    if (ivMatch) {
                        try {
                            let segment = ivMatch[1].trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
                            try {
                                innerVoice = JSON.parse(segment)
                            } catch (e) {
                                const jsonObjectMatch = segment.match(/\{[\s\S]*\}/)
                                if (jsonObjectMatch) innerVoice = JSON.parse(jsonObjectMatch[0].trim())
                            }
                        } catch (e) { }
                    }
                    content = content.replace(/<reasoning_content>[\s\S]*?<\/reasoning_content>/gi, '').trim()

                    return { content, innerVoice, raw: rawRetry }

                } catch (retryErr) {
                    useLoggerStore().addLog('ERROR', '自动重试失败', retryErr.message)
                    // Fall through to return original error
                }
            }
        }

        return { error: error.message }
    }
}

export async function generateSummary(messages, customPrompt = '', abortSignal) {
    return apiQueue.enqueue(_generateSummaryInternal, [messages, customPrompt, abortSignal], abortSignal);
}

async function _generateSummaryInternal(messages, customPrompt = '', signal) {
    const settingsStore = useSettingsStore()
    const config = settingsStore.currentConfig || settingsStore.apiConfig
    const { baseUrl, apiKey, model } = config || {}
    const apiUrl = baseUrl // Map match

    // Provider Detection (Matches HTML Logic)
    let provider = config.provider || 'openai'
    if (!config.provider && apiUrl) {
        if (apiUrl.includes('googleapis.com') || apiUrl.includes('gemini')) {
            provider = 'gemini'
        }
    }

    if (!config || !apiKey || !model) return 'API未配置 (检查Key/模型/基础URL)'

    // System Prompt (The instruction to summarize)
    const systemContent = customPrompt || '请简要总结上述对话的主要内容和关键信息，作为长期记忆归档。请保持客观，不要使用第一人称。'

    // --- PROVIDER SWITCHING LOGIC ---
    let endpoint = apiUrl || ''
    let reqHeaders = { 'Content-Type': 'application/json' }
    let reqBody = {}

    if (provider === 'gemini') {
        // --- GEMINI NATIVE MODE ---
        // 1. URL
        if (!endpoint.includes(':generateContent')) {
            endpoint = endpoint.replace(/\/$/, '')
            if (!endpoint.includes('/models/')) {
                endpoint = `${endpoint}/v1beta/models/${model}:generateContent`
            } else {
                endpoint = `${endpoint}:generateContent`
            }
        }
        if (!endpoint.includes('key=')) {
            const separator = endpoint.includes('?') ? '&' : '?'
            endpoint = `${endpoint}${separator}key=${apiKey}`
        }

        // 2. Body
        // System Instruction for the Task
        const systemInstruction = { parts: [{ text: systemContent }] }

        // Convert History to Contents
        // Convert History to Contents (Robust for Gemini: alternate user/model + start with user)
        const geminiContents = []
        messages.forEach(msg => {
            let role = msg.role
            if (role === 'system') return // Skip system msgs in history for Gemini
            if (role === 'assistant' || role === 'ai') role = 'model'
            if (role !== 'user' && role !== 'model') role = 'user' // Fallback

            let text = ''
            if (typeof msg.content === 'string') text = msg.content
            else if (Array.isArray(msg.content)) text = msg.content.map(p => p.text || '').join('\n')
            else text = JSON.stringify(msg.content)

            if (!text.trim()) return

            if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
                // Combine consecutive same-role messages for Gemini
                geminiContents[geminiContents.length - 1].parts[0].text += '\n' + text
            } else {
                geminiContents.push({
                    role: role,
                    parts: [{ text: text }]
                })
            }
        })

        // Ensure history starts with user (Gemini requirement)
        if (geminiContents.length > 0 && geminiContents[0].role === 'model') {
            geminiContents.unshift({ role: 'user', parts: [{ text: '...' }] })
        }

        reqBody = {
            contents: geminiContents,
            system_instruction: systemInstruction,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1000,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        }

    } else {
        // --- OPENAI MODE ---
        // 1. Full Messages Chain
        const systemMsg = { role: 'system', content: systemContent }
        const fullMessages = [systemMsg, ...messages]

        // 2. URL
        if (!endpoint.includes('/chat/completions')) {
            if (endpoint.endsWith('/v1')) {
                endpoint = `${endpoint}/chat/completions`
            } else if (endpoint.endsWith('/v1/')) {
                endpoint = `${endpoint}chat/completions`
            } else {
                endpoint = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`
            }
        }

        // 3. Headers & Body
        reqHeaders['Authorization'] = `Bearer ${apiKey}`
        reqBody = {
            model: model,
            messages: fullMessages,
            temperature: 0.3,
            max_tokens: 1000,
            stream: false
        }
    }

    // [MOVED & ENHANCED LOG]
    useLoggerStore().addLog('AI', '生成总结 (Request)', {
        messagesCount: messages.length,
        provider,
        model,
        endpoint,
        // Clone to avoid mutation issues if any
        requestBody: JSON.parse(JSON.stringify(reqBody))
    })

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(reqBody)
        })

        if (!response.ok) throw new Error(`API Error: ${response.status} ${await response.text()}`)

        const data = await response.json()

        // Parse Response (Robust)
        let content = ''
        if (data.choices && data.choices.length > 0) {
            content = data.choices[0].message?.content || ''
        } else if (data.candidates && data.candidates.length > 0) {
            content = data.candidates[0].content?.parts?.[0]?.text || ''
        }

        if (!content) {
            useLoggerStore().addLog('WARN', '总结结果为空 (Raw Response)', data)
            throw new Error('Empty Content (Check Raw Response)')
        }

        useLoggerStore().addLog('AI', '总结结果 (Response)', { content })
        return content

    } catch (e) {
        console.error('Summary API Error:', e)
        useLoggerStore().addLog('ERROR', '总结失败', e.message)
        return `总结生成失败: ${e.message}`
    }
}

/**
 * 将中文提示词翻译/扩充为英文生图提示词
 * @param {String} text 中文描述
 */
export async function translateToEnglish(text) {
    if (!text || !/[^\x00-\xff]/.test(text)) return text // No chinese, return as is

    const systemPrompt = `You are a professional image generation prompt engineer. 
Your task is to translate the user's Chinese description into a highly detailed, descriptive English prompt.
IMPORTANT: Do NOT add any style-related keywords (e.g., 'photorealistic', 'realistic', '3D', 'oil painting', 'cinematic'). 
Focus ONLY on describing the subject, action, clothing, pose, lighting, and composition. 
Keep the style neutral so it can be defined by the model configuration.
Strictly output ONLY the English prompt text without any explanations.`

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate and expand this to a drawing prompt: ${text}` }
    ]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: 'Translator' }, null])
        if (result.error) return text

        let translated = result.content || text;
        // Aggressively strip unwanted style keywords causing "oiliness"
        translated = translated.replace(/\b(photorealistic|realistic|3d|cinematic|oil paiting|hyperrealistic|studio lighting|8k)\b/gi, "");
        return translated;
    } catch (e) {
        console.error('Translation failed:', e)
        return text
    }
}

// --- Moments Feature AI Logic ---

/**
 * 生成朋友圈动态内容
 * @param {Object} options { name, persona, worldContext, customPrompt }
 */
export async function generateMomentContent(options) {
    const { name, persona, worldContext, recentChats, customPrompt } = options

    const systemPrompt = `你现在是【${name}】。
你的设定：${persona}。

${recentChats ? `【最近聊天记录 (作为背景参考，不要直接复读)】\n${recentChats}\n` : ''}

【任务】
1. 发布一条朋友圈动态。可以包含心情感悟、生活趣事、或是想对某人（Chilly）说的话。
2. 为这条动态生成 3-5 条社交互动（点赞或评论），互动者应该是通讯录中的好友或虚构合理的NPC。

回复必须是一个 JSON 对象，格式如下：
{
  "content": "朋友圈文字内容",
  "location": "地理位置（可选，如：‘上海·某某咖啡厅’）",
  "imagePrompt": "英文生图提示词（可选）",
  "imageDescription": "图片描述（可选）",
  "interactions": [
    { "type": "like", "authorName": "名字", "isVirtual": true/false },
    { "type": "comment", "authorName": "名字", "content": "内容", "replyTo": "谁", "isVirtual": true/false }
  ]
}

【严格约束】
1. 语言自然、生活化，不要像 AI。
2. 如果有图片提示词，**必须**是关于场景、物品或角色的描述。
3. 如果涉及到人物形象，系统将强制使用“日漫/少女漫”风格。
4. 【严禁】不要生成任何代表用户的互动内容（点赞或评论）。
${customPrompt ? `\n【用户自定义指令】\n${customPrompt}` : ''}
${worldContext ? `\n【背景参考】\n${worldContext}` : ''}`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name }, null])
        if (result.error) throw new Error(result.error)

        // Parse the JSON from AI response
        const jsonMatch = result.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI Response is not a valid JSON')

        const data = JSON.parse(jsonMatch[0])
        const finalResult = {
            content: data.content,
            location: data.location || '',
            images: [],
            imageDescriptions: [],
            interactions: data.interactions || []
        }

        if (data.imagePrompt) {
            // Use unified generateImage internal helper
            const imageUrl = await generateImage(data.imagePrompt)
            finalResult.images.push(imageUrl)
            finalResult.imageDescriptions.push(data.imageDescription || data.imagePrompt)
        }

        return finalResult

    } catch (e) {
        console.error('[aiService] generateMomentContent failed', e)
        throw e
    }
}

/**
 * 批量生成朋友圈动态+互动内容（一次性生成）
 * @param {Object} options { characters: [{id, name, persona}], worldContext, customPrompt, count }
 */
export async function generateBatchMomentsWithInteractions(options) {
    const { characters, worldContext, customPrompt, userProfile, historicalMoments = [], count = 3 } = options

    // 1. Build character list with recent chat snippets for context
    const charList = characters.map((c, idx) => {
        const bio = localStorage.getItem(`char_bio_${c.id}`) || ''
        const bioText = bio ? `\n   个人简介：${bio}` : ''
        const chatText = c.recentChats ? `\n   最近聊天碎片: ${c.recentChats.substring(0, 600)}` : ''
        const personalHistoryText = c.personalHistory ? `\n   TA最近发过：${c.personalHistory}` : ''
        return `${idx + 1}. 【${c.name}】(ID: ${c.id})\n   核心人设：${c.persona.substring(0, 600)}${bioText}${chatText}${personalHistoryText}`
    }).join('\n\n')

    const now = new Date()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const currentVirtualTime = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} 星期${weekDays[now.getDay()]}`

    // 2. Build explicit recent history to avoid repetition
    const historyText = historicalMoments.length > 0
        ? "\n【最近朋友圈已发布内容（请勿重复这些内容或风格）】\n" + historicalMoments.map(m => `- ${m.authorName}: ${m.content}`).join('\n')
        : ""

    // Include user's bio and pinned moments if available
    let userContextText = userProfile?.name ? `\n\n【当前用户 (${userProfile.name}) 资料】` : ""
    if (userProfile?.signature) userContextText += `\n个性签名：${userProfile.signature}`
    if (userProfile?.pinnedMoments?.length > 0) {
        userContextText += `\n置顶动态：\n` + userProfile.pinnedMoments.map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    }
    if (userProfile?.persona) userContextText += `\n背景设定：${userProfile.persona}`

    const systemPrompt = `你现在是“朋友圈拟真生态引擎”。当前虚拟时间：${currentVirtualTime}。

【备选发帖角色】
${charList}

${historyText}
${userContextText}
    
【核心任务】
请从列表中挑选角色，生成 ${count} 条全新的、富有生活感的朋友圈动态。

【生成准则：消除雷同，增加深度】
1. **参考历史，拒绝重复**：仔细阅读“最近已发布内容”和各角色的“TA最近发过”。严禁内容相似。
2. **个人话题多样性**：同一个角色严禁连续发相同主题的内容。如果TA最近发过“努力工作”，这次请发“生活碎片”、“深夜emo”、“运动健康”或“对某事的看法”。
3. **结合聊天上下文**：如果角色有“最近聊天碎片”，动态内容应与聊天话题产生关联（如：刚聊完出差，朋友圈发个行李箱）。
4. **角色差异化**：每个角色的风格必须严格区分。
5. **社交互动**：每条动态生成 3-6 个自然的点赞/评论。点赞和评论者必须是列表角色或各种有趣的虚拟NPC。
6. **绝对禁止**：严禁代表“User”或“${userProfile?.name || '我'}”生成任何评论。

【输出格式】必须是一个 JSON 数组：
\`\`\`json
[
  {
    "authorId": "角色ID",
    "content": "内容...",
    "mentions": [],
    "location": "地点",
    "imagePrompt": "英文生图提示词",
    "imageDescription": "图片描述",
    "interactions": [
      { "type": "comment", "authorName": "名字", "content": "内容", "isVirtual": true/false }
    ]
  }
]
\`\`\`
直接输出协议 JSON 代码块，不要废话。`


    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: 'MomentsGenerator' }, null, { skipVisualContext: true }])
        if (result.error) throw new Error(result.error)

        // Parse JSON array from AI response
        // Parse JSON array from AI response with cleaner cleaning
        let jsonStr = result.content
        const jsonMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/)
        if (!jsonMatch) {
            // Fallback for cases where it might just return the array not the codeblock
            const arrayMatch = jsonStr.substring(jsonStr.indexOf('['), jsonStr.lastIndexOf(']') + 1)
            if (!arrayMatch || arrayMatch.length < 2) throw new Error('AI Response is not a valid JSON array')
            jsonStr = arrayMatch
        } else {
            jsonStr = jsonMatch[0]
        }

        const momentsData = JSON.parse(jsonStr)

        // Process each moment: generate images if needed
        const processedMoments = []
        for (const data of momentsData) {
            const processed = {
                authorId: data.authorId,
                content: data.content,
                location: data.location || '',
                images: [],
                imageDescriptions: [],
                html: data.html || null,
                mentions: data.mentions || [], // Extract mentions
                interactions: data.interactions || []
            }

            // Generate image only if imagePrompt is provided
            if (data.imagePrompt && data.imagePrompt.trim()) {
                try {
                    const imageUrl = await generateImage(data.imagePrompt)
                    processed.images.push(imageUrl)
                    if (data.imageDescription) {
                        processed.imageDescriptions.push(data.imageDescription)
                    }
                } catch (e) {
                    console.warn('[Batch Moments] Image generation failed for:', data.imagePrompt, e)
                }
            }

            if (processed.interactions) {
                processed.interactions.forEach(interaction => {
                    const userName = userProfile?.name || 'Chilly'
                    if (interaction.replyTo === 'User' || interaction.replyTo === '用户' || interaction.replyTo === '我') {
                        interaction.replyTo = userName
                    }
                    if (interaction.content && interaction.content.includes('User')) {
                        interaction.content = interaction.content.replace(/User/g, userName)
                    }

                    // Fix: Sanitize numeric/ID-like authorNames from AI hallucination
                    if (interaction.authorName) {
                        if (/^\d+$/.test(interaction.authorName)) {
                            interaction.authorName = '热心群友'
                        } else if (interaction.authorName.startsWith('char_') || interaction.authorName.startsWith('user_')) {
                            // Attempt to strip prefix if AI leaks variables like char_linshen
                            interaction.authorName = interaction.authorName.replace(/^(char|user)_/i, '')
                        }
                    }

                    // Fix: Sanitize numeric/ID-like replyTo
                    if (interaction.replyTo) {
                        if (/^\d+$/.test(interaction.replyTo)) {
                            interaction.replyTo = '朋友'
                        } else if (interaction.replyTo.startsWith('char_') || interaction.replyTo.startsWith('user_')) {
                            interaction.replyTo = interaction.replyTo.replace(/^(char|user)_/i, '')
                        }
                    }

                    // Mentions in interactions
                    if (!interaction.mentions) interaction.mentions = []

                    // ID Patch
                    if (interaction.isVirtual && !interaction.authorId) {
                        interaction.authorId = `virtual - ${Date.now()} -${Math.random().toString(36).substr(2, 5)} `
                    }
                })
            }

            processedMoments.push(processed)
        }

        return processedMoments

    } catch (e) {
        console.error('[aiService] generateBatchMomentsWithInteractions failed', e)
        throw e
    }
}

/**
 * 统一生图接口 (Supports Pollinations standard, SiliconFlow, and API Key)
 * @param {String} prompt 提示词
 */
export async function generateImage(prompt) {
    const settingsStore = useSettingsStore()
    // In some contexts (like plain JS files), Pinia might return the raw ref object.
    // We check for .value to be safe, ensuring we get the actual configuration object.
    const drawingVal = settingsStore.drawing?.value || settingsStore.drawing || {}
    let provider = drawingVal.provider || 'pollinations'
    let apiKey = (drawingVal.apiKey || '').trim()
    let model = drawingVal.model || 'flux'

    // REDUNDANT FALLBACK: If store seems empty, try reading directly from localStorage
    if (!apiKey) {
        try {
            const raw = localStorage.getItem('qiaoqiao_settings')
            if (raw) {
                const data = JSON.parse(raw)
                if (data.drawing && data.drawing.apiKey) {
                    console.log('[AI Image] Recovered API key from raw localStorage')
                    apiKey = data.drawing.apiKey.trim()
                    provider = data.drawing.provider || provider
                    model = data.drawing.model || model
                }
            }
        } catch (e) {
            console.error('[AI Image] LocalStorage fallback failed')
        }
    }

    console.log(`[AI Image] Final Config - Provider: ${provider}, Model: ${model}, Has Key: ${!!apiKey} `)

    // Log image generation request
    useLoggerStore().addLog('AI', '图片生成请求', {
        provider,
        model,
        hasApiKey: !!apiKey,
        promptLength: prompt.length,
        originalPrompt: prompt
    })

    if (!apiKey && provider === 'pollinations') {
        console.warn('[AI Image] API Key is missing for Pollinations. Using anonymous endpoint (Limited).')
    }

    // ... existing prompt logic ...
    const p = prompt.toLowerCase()
    const isCouple = /\b(couple|kiss|hug|together|holding hands|intimate|romantic|with each other|kissing|hugging|cuddling)\b/.test(p)
    const isMale = /\b(boy|man|guy|he|his|king|husband|ikemen|bishounen)\b/.test(p)
    const isFemale = /\b(girl|woman|lady|she|her|queen|waifu|wife)\b/.test(p)
    const isPerson = isMale || isFemale || isCouple || /\b(person|human|people|face|selfie|character)\b/.test(p)
    const hasAbs = /\b(abs|muscle|muscular|six pack)\b/.test(p)

    // Extreme negative boosters - EXPLICITLY ban muscles and exposed chest
    const negativeBoost = "(beard:1.5), (mustache:1.5), (facial hair:1.5), (stubble:1.4), (old:1.4), (wrinkles:1.3), (muscular:1.8), (bulky:1.8), (thick neck:1.5), (abs:1.8), (exposed chest:1.8), (open shirt:1.5), (pecs:1.8), (bodybuilder:2.0), (buff:1.8), (ugly:1.3), (bad anatomy), (extra digits), (worst quality), (low quality), (monochrome), (3d:1.5), (realistic:1.5), (photorealistic:1.5), (thick painting:1.6), (semirealism:1.5), (oil painting:1.5), (sketch), (korean manhwa:1.5)"

    let enhancedPrompt = ""
    // Universal Anime Style Base - Strictly 2D Japanese Anime, counter Kolors' thick-paint default
    const animeStyleBase = "(anime style:1.6), (Japanese anime style:1.5), (light novel illustration:1.4), (clean lineart:1.4), (flat shading:1.3), (2D:1.6), (illustration:1.4), (cel shading:1.3), (pastel colors), (soft lighting), (no thick painting), (no korean manhwa), (no realistic), (no 3D)"

    if (isCouple) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${prompt}, (two distinct individuals), romantic atmosphere, highly detailed`
    } else if (isMale) {
        // STRICT Bishounen aesthetic: slender, elegant, NO muscles, CLOTHED
        // Force clothing and ban exposed skin unless explicitly requested
        const clothingEnforcement = hasAbs ? "" : "(fully clothed:1.4), (wearing shirt:1.3), (covered chest:1.3), "
        const bodyType = hasAbs ? "(lean athletic build:1.2)" : "(slender elegant build:1.5), (thin:1.3), (no muscles:1.5), (delicate frame:1.3)"
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, (beautiful bishounen:1.6), (pretty boy:1.4), (otome game cg:1.5), (delicate features:1.4), (clean shaven:1.3), (no facial hair:1.3), ${clothingEnforcement}${bodyType}, (soft expression), ${prompt}, sharp focus, detailed sparkling eyes, handsome, elegant`
    } else if (isFemale || isPerson) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, (beautiful anime girl: 1.3), (detailed huge eyes), (soft skin), ${prompt}, sharp focus, vibrant pastel colors, cute`
    } else {
        // Fallback also anime
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${prompt}, highly detailed, sharp focus, vibrant colors, clear background`
    }

    const seed = Math.floor(Math.random() * 1000000)

    if (provider === 'pollinations') {
        // Mode 1: Pollinations Anonymous URL (DEPRECATED - now shows placeholder)
        if (!apiKey) {
            console.warn('[AI Image] Using Anonymous Pollinations (May show placeholder!)')
            return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}&negative=${encodeURIComponent(negativeBoost)}`
        }

        // Mode 2: Pollinations with Auth Key
        console.log('[AI Image] Attempting Authenticated Pollinations Generation...')

        // SECURITY / ARCHITECTURE CHECK:
        if (apiKey.startsWith('sk_')) {
            console.error('[AI Image] DETECTED SECRET KEY (sk_). These keys are meant for SERVERS only and will be BLOCKED by Pollinations anti-bot (Turnstile) in a browser.')
            throw new Error('检测到 Secret Key (sk_)。此类密钥不适用于浏览器直接调用，会被官方拦截。请使用 pk_ 开头的 Publishable Key。')
        }

        try {
            const host = 'gen.pollinations.ai'
            const path = 'image'

            // SANITIZATION: Heavily sanitize the prompt for URL safety.
            // URL params are extremely fragile for prompt text.
            const safePrompt = enhancedPrompt
                .replace(/[,，:：\n\r]/g, ' ') // CRITICAL: Stop commas/colons breaking URL structure
                .replace(/[#?%&]/g, '')        // Remove strict URL control chars
                .replace(/\s+/g, ' ')          // Collapse spaces
                .trim()

            const url = `https://${host}/${path}/${encodeURIComponent(safePrompt)}?model=${model || 'flux'}&seed=${seed}&width=1024&height=1024&nologo=true&key=${apiKey}`

            console.log('[AI Image] Requesting (Sanitized):', url.replace(apiKey, 'REDACTED'))

            // DOUBLE LAYER AUTH: Some Pollinations gateways prefer query param, others prefer header. 
            // We use both for pk_ keys to maximize success.
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            })

            if (!response.ok) {
                const errText = await response.text()

                if (response.status === 401) {
                    throw new Error('密钥校验失败 (401)。这通常意味着您的 pk_ 密钥额度已耗尽 (官方免费版仅 1张/小时) 或由于提示词违规被拦截。')
                }

                if (response.status === 403 || errText.includes('Turnstile') || errText.includes('token')) {
                    throw new Error('被官方人机验证拦截 (Turnstile 403)。即使带了 Key 也可能由于 IP 被风控。建议改用 SiliconFlow。')
                }
                throw new Error(`API 响应异常 ${response.status}: ${errText.substring(0, 100)}`)
            }

            const contentType = response.headers.get('content-type') || ''
            if (!contentType.includes('image')) {
                const text = await response.text();
                // Custom handling for Turnstile errors or credits
                if (text.includes('Turnstile') || text.includes('Captcha')) {
                    throw new Error('API blocked by Anti-bot. Recommend trying SiliconFlow provider.')
                }
                throw new Error('Response is not an image.')
            }

            const blob = await response.blob()

            // Convert to Base64 with aggressive compression for persistence
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => {
                    const base64 = reader.result
                    useLoggerStore().addLog('AI', '图片生成成功 (Pollinations)', {
                        size: base64.length,
                        provider: 'pollinations'
                    })
                    // Compress by reducing quality if possible
                    // For now, return as-is; compression happens at display level
                    resolve(base64)
                }
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch (e) {
            console.error('[AI Image] Pollinations Final Failure:', e)
            useLoggerStore().addLog('ERROR', '图片生成失败 (Pollinations)', e.message)
            // CRITICAL: Stop falling back to anonymous image.pollinations.ai because it returns the "WE HAVE MOVED" placeholder.
            // We want the user to see the AUTH error so they can fix their key.
            throw new Error(`绘制失败: ${e.message}`)
        }
    }

    if (provider === 'siliconflow' || provider === 'flux-api') {
        // SiliconFlow / Flux-API (requires API Key)
        try {
            const baseUrl = provider === 'siliconflow' ? 'https://api.siliconflow.cn/v1' : 'https://api.flux-api.example/v1'
            const response = await fetch(`${baseUrl}/images/generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model || 'flux-v1',
                    prompt: enhancedPrompt,
                    negative_prompt: negativeBoost,
                    width: 1024,
                    height: 1024
                })
            })

            if (!response.ok) {
                const err = await response.text()
                throw new Error(err)
            }

            const data = await response.json()
            const imageUrl = data.images?.[0]?.url || data.data?.[0]?.url || `https://via.placeholder.com/1024?text=GenerationFailed`
            useLoggerStore().addLog('AI', `图片生成成功 (${provider})`, {
                provider,
                hasUrl: !!imageUrl
            })
            return imageUrl
        } catch (e) {
            console.error('Drawing API failed:', e)
            useLoggerStore().addLog('ERROR', `图片生成失败 (${provider})`, e.message)
            throw e
        }
    }

    // Default Fallback
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`
}

/**
 * 生成朋友圈动态的批量互动（3-5条点赞/评论）
 * 包含：已有角色 + 虚拟NPC（亲戚、同事等）
 * @param {Object} moment 目标动态
 * @param {Array} charInfos 备选互动角色列表
 * @param {Array} historicalMoments 历史朋友圈列表
 * @param {Object} userProfile 用户个人资料
 */
export async function generateBatchInteractions(moment, charInfos, historicalMoments = [], userProfile = {}) {
    // 1. 构建提示词
    const historyStr = historicalMoments.length > 0
        ? "【朋友圈热点背景（参考）】\n" + historicalMoments.map(m => `ID: ${m.id} | 作者: ${m.authorName} | 内容: ${m.content} | 互动: 点赞[${m.likes}], 评论[${m.comments}]`).join('\n')
        : ""

    // 简化现有角色信息，减少Token
    const friendsList = charInfos.map((c, index) => {
        const chatSnippet = c.recentChats ? ` | 最近聊天: ${c.recentChats.substring(0, 300).replace(/\n/g, ' ')}` : ''
        return `${index + 1}. ${c.name}, 人设: ${c.persona.substring(0, 100)}...${chatSnippet}`
    }).join('\n')

    let userInformation = ""
    if (userProfile.name) {
        userInformation = `\n【当前用户（你互动的对象）资料】\n名字: ${userProfile.name}\n`
        if (userProfile.signature) userInformation += `个性签名: ${userProfile.signature}\n`
        if (userProfile.pinnedMoments?.length > 0) {
            userInformation += `置顶动态: \n` + userProfile.pinnedMoments.map((m, i) => `- ${m.content}`).join('\n') + "\n"
        }
        userInformation += `背景设定: ${userProfile.persona || '一位普通用户'}\n`
    }

    const systemPrompt = `你现在是“朋友圈拟真生态引擎”。
你的任务是为以下动态模拟出真实的社交互动（包含点赞、评论和多级回复）。

【现有角色】
${friendsList}
${userInformation}

【当前动态】
作者：${moment.authorName}
内容：${moment.content}
${moment.location ? `地点：${moment.location}` : ''}
${moment.visualContext ? `图片：${moment.visualContext}` : ''}
${moment.existingComments && moment.existingComments.length > 0 ? `\n【已有评论】：\n${moment.existingComments.map((c, i) => `@${c.authorName}: ${c.content}`).join('\n')}` : ''}

【生成规则】
1. **互动组合**：
   - 生成 5-15 个 **like** (点赞)。
   - 生成 3-6 条 **comment** (直接评论) 或 **reply** (针对已有评论的回复)。
2. **多样性要求**：
   - 优先选择现有好友。
   - 如果好友不足，**请必须**虚构 2-4 个各具特色的虚拟 NPC（如：隔壁同事、老同学、楼下保安等）。
   - 禁止让同一个角色发表多条独立评论。
3. **内容风格**：简短、真实、口语化。像真人微信对话，不要使用 AI 辅助感强烈的客套话。
4. **绝对禁止**：严禁代表“用户”或“${userProfile.name}”生成任何内容。

【输出格式】直接返回 JSON 数组：
[
  { "type": "like", "authorName": "名字", "isVirtual": true/false, "authorId": "ID或null" },
  { "type": "comment", "authorName": "名字", "content": "内容", "isVirtual": true/false },
  { "type": "reply", "authorName": "名字", "content": "内容", "replyTo": "被回复者的名字", "isVirtual": true/false }
]
不要输出任何 Markdown 标签或额外解释。`

    try {
        const result = await _generateReplyInternal([{ role: 'system', content: systemPrompt }], { name: 'System' }, null, { skipVisualContext: true })
        if (result.error) {
            console.error('[AiService] Batch interaction failed:', result.error)
            throw new Error(result.error)
        }

        // Parse JSON
        const jsonMatch = result.content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return []

        const interactions = JSON.parse(jsonMatch[0])
        const userName = userProfile.name || '我'

        return interactions
            .filter(item => {
                // Pre-filter: Absolutely forbid any interaction where the author is the user
                const authorId = String(item.authorId || '').toLowerCase()
                const authorName = String(item.authorName || '')
                if (authorId === 'user' || authorName === userName || authorName === 'User' || authorName === '用户') {
                    console.warn(`[aiService] Filtered out AI-generated interaction from forbidden author(user): ${authorName} `);
                    return false
                }
                return true
            })
            .map(item => ({
                ...item,
                // Ensure ID is matched if it's an existing char
                authorId: item.isVirtual ? `virtual - ${Date.now()} -${Math.random().toString(36).substr(2, 5)} ` : (item.authorId || charInfos.find(c => c.name === item.authorName)?.id || null)
            }))

    } catch (e) {
        console.error('[aiService] Batch interactions failed', e)
        return []
    }
}

/**
 * 生成朋友圈评论
 * @param {Object} charInfo { name, persona, worldContext }
 * @param {Object} moment { authorName, content, visualContext }
 * @param {String} historicalContext 可选的历史背景字符串
 */
export async function generateMomentComment(charInfo, moment, historicalContext = "") {
    const { name, persona, worldContext } = charInfo
    const { authorName, content, visualContext } = moment

    const systemPrompt = `你现在是【${name}】。
    你的设定：${persona}。
${worldContext ? `当前世界背景：${worldContext}` : ''}
${historicalContext ? `\n${historicalContext}` : ''}

【任务】
    请对【${authorName}】发布的一条朋友圈进行评论。
    朋友圈内容：${content}
    图片 / 视觉内容：${visualContext || '无图片'}

【要求】
    1. 回复要简短、真实（类似微信评论），字数控制在30字以内。
    2. 根据你和对方的关系决定语气（调侃、关心、撒娇等）。
    3. 如果朋友圈内容或之前的历史动态很有意思，请结合背景进行吐槽、互动或接梗。
    4. 如果有图片描述，请尝试提及图片中的元素以增强“视觉感”。
    5. ** @功能支持 **：你可以通过 '@名字' 提醒特定的人阅读评论。
    6. 直接输出评论文字，不要包含任何标签或多余解释。`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        // Skip visual context to prevent AI from getting distracted by analyzing avatars instead of generating comments
        const result = await _generateReplyInternal(messages, { name }, null, { skipVisualContext: true })
        if (result.error) return null

        // Cleanup response (sometimes AI adds quotes or prefixes)
        let comment = result.content.replace(/^["'](.*)["']$/, '$1').replace(/^评论[：:]\s*/, '').trim()
        return comment
    } catch (e) {
        console.error('[aiService] generateMomentComment failed', e)
        return null
    }
}

/**
 * 生成对评论的回复
 * @param {Object} charInfo { name, persona, worldContext }
 * @param {Object} moment { authorName, content, visualContext }
 * @param {Object} targetComment { authorName, content }
 */
export async function generateReplyToComment(charInfo, moment, targetComment) {
    const { name, persona, worldContext } = charInfo
    const { authorName, content, visualContext } = moment

    const systemPrompt = `你现在是【${name}】。
    你的设定：${persona}。
${worldContext ? `当前世界背景：${worldContext}` : ''}

【任务】
    你在朋友圈看到了【${targetComment.authorName}】的评论，请针对这条评论进行回复。
    朋友圈原文（作者：${authorName}）：${content}
    对方的评论：${targetComment.content}

【要求】
    1. 回复要简短、口语化（类似微信回复），字数控制在20字以内。
    2. 即使是回复，也是公开展示在朋友圈下方的，请保持得体或有趣的互动风格。
    3. ** @功能支持 **：你可以通过 '@名字' 提醒阅读。
    4. 直接输出回复内容，不要包含任何标签。`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await _generateReplyInternal(messages, { name }, null)
        if (result.error) return null

        // Cleanup
        let reply = result.content.replace(/^["'](.*)["']$/, '$1').replace(/^回复[：:]\s*/, '').trim()
        return reply
    } catch (e) {
        console.error('[aiService] generateReplyToComment failed', e)
        return null
    }
}

/**
 * Generate complete character profile (background + pinned moments + bio) in ONE API call
 * @param {Object} character - Character object with name and prompt
 * @param {Object} userProfile - User profile with name
 * @returns {Promise<Object>} { pinnedMoments: Array, backgroundUrl: String, bio: String }
 */
export async function generateCompleteProfile(character, userProfile = {}, options = { includeMoments: true, includeSocial: true, includeArchive: true }) {
    const userName = userProfile.name || '我'
    const { includeMoments, includeSocial, includeArchive } = options;

    const tasks = [];
    if (includeSocial) tasks.push("社交门户 (签名与背景)");
    if (includeArchive) tasks.push("灵魂档案 (底层规格与性格)");
    if (includeMoments) tasks.push("置顶动态 (3条朋友圈)");

    const systemPrompt = `你现在是“角色主页架构师”。
任务：为角色生成以下内容：${tasks.join('、')}。

角色姓名：${character.name}
基础人设：${character.prompt || '无'}
当前用户：${userName}

【输出格式】请严格返回以下结构的 JSON：
{
  ${includeSocial ? `
  "signature": "个性签名 (20字内)",
  "backgroundPrompt": "英文背景图提示词",` : ''}
  ${includeArchive ? `
  "bioFields": {
    "occupation": "职业", "gender": "性别", "mbti": "人格代码", "birthday": "生日", "zodiac": "星座",
    "height": "身高", "weight": "体重", "body": "身材描述", "status": "情感/生活状态", "scent": "气味",
    "style": "穿着风格", "hobbies": ["爱好1", "爱好2"], "idealType": "理想型描述", "heartbeatMoment": "心动瞬间描述"
  },` : ''}
  ${includeMoments ? `
  "pinnedMoments": [
    {
      "comment": "必须展示角色生活/人设的三个完全不同的侧面（如：侧面1-专业领域、侧面2-私人爱好、侧面3-性格缺陷或反差萌）",
      "content": "动态文字内容...",
      "mentions": [ { "id": "user", "name": "${userName}" } ],
      "imagePrompt": "英文图片提示词",
      "interactions": [
         { "type": "like", "authorName": "角色名" },
         { "type": "comment", "authorName": "角色名", "content": "..." }
      ]
    }
  ]` : ''}
}
禁止解释，直接输出 JSON。`

    try {
        const result = await _generateReplyInternal([{ role: 'system', content: systemPrompt }], { name: 'System' }, null, { skipVisualContext: true })
        const jsonMatch = result.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Invalid JSON')
        const data = JSON.parse(jsonMatch[0])

        let backgroundUrl = null
        if (includeSocial && data.backgroundPrompt) {
            try { backgroundUrl = await generateImage(data.backgroundPrompt) } catch (e) { }
        }

        const processedMoments = []
        if (includeMoments && data.pinnedMoments) {
            for (const mData of data.pinnedMoments.slice(0, 3)) {
                let imgUrl = null
                if (mData.imagePrompt) try { imgUrl = await generateImage(mData.imagePrompt) } catch (e) { }
                processedMoments.push({
                    content: mData.content,
                    mentions: mData.mentions || [],
                    images: imgUrl ? [imgUrl] : [],
                    interactions: mData.interactions || []
                })
            }
        }

        return {
            signature: data.signature || null,
            backgroundUrl: backgroundUrl,
            bioFields: data.bioFields || null,
            pinnedMoments: processedMoments.length > 0 ? processedMoments : null
        }
    } catch (e) {
        console.error('[aiService] Profile gen failed', e)
        throw e
    }
}
/**
 * Generates a full profile set for a character:
 * 1. Background Image (via prompt generation + image gen)
 * 2. Signature (Status Text)
 * 3. 3 "Pinned" Moments representing their core personality or backstory
 */
export async function generateCharacterProfile(char, userProfile, config = {}, options = { includeMoments: true, includeSocial: true, includeArchive: true }) {
    // Re-use the enhanced logic to maintain consistency
    return generateCompleteProfile(char, userProfile, options);
}

/**
 * AI 角色人设生成系统 (NPC Persona Generator)
 * 根据主题生成完整的角色背景、提示词与基础信息
 * @param {String} theme - 角色主题 (例如: 一个神秘的商人、傲娇的青梅竹马)
 * @param {String} loopContext - 世界圈背景 (辅助生成)
 */
export async function generateCharacterPersona(theme, loopContext = '') {
    const systemPrompt = `你是一个顶级剧本家和人设设计师。
任务：根据用户提供的主题，为一个名为「世界圈」的多人RPG系统生成一个具有灵魂的 NPC 角色。

【当前世界背景】
${loopContext || '通用现代社交圈'}

【召唤主题】
${theme}

请生成以下信息，并以 JSON 格式输出：
1. **name**: 角色姓名 (具有特色，符合背景)
2. **gender**: 性别 (男/女/非人类等)
3. **age**: 表象年龄
4. **identity**: 核心身份 (一句话描述)
5. **personality**: 性质偏好与性格特征 (丰富且有记忆点)
6. **prompt**: 核心 AI 提示词 (用于驱动后续对话，语气控制的关键，包含口癖、思考模式、对用户的初始态度)
7. **appearance**: 视觉外观描述 (英文，用于后续头像生成)

JSON 格式要求：
\`\`\`json
{
  "name": "...",
  "gender": "...",
  "age": "...",
  "identity": "...",
  "personality": "...",
  "prompt": "...",
  "appearance": "english visual prompt for image generation..."
}
\`\`\`
直接输出 JSON，不要任何回复语。`

    try {
        const result = await _generateReplyInternal([{ role: 'system', content: systemPrompt }], { name: 'PersonaManager' }, null, { skipVisualContext: true })
        if (result.error) throw new Error(result.error)

        const jsonMatch = result.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI Response is not valid JSON')

        return JSON.parse(jsonMatch[0])
    } catch (e) {
        console.error('[aiService] generateCharacterPersona failed', e)
        throw e
    }
}
