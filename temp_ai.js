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
const getAvatarDescCache = () => {
    try {
        const saved = localStorage.getItem(AVATAR_DESC_CACHE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
};
const saveAvatarDescCache = (cache) => {
    localStorage.setItem(AVATAR_DESC_CACHE_KEY, JSON.stringify(cache));
};

/**
 * Internal helper to get a text description for an avatar to save context/logs.
 */
async function getOrFetchAvatarDesc(url, b64, name, provider, apiKey, endpoint, model) {
    if (!url || !b64) return null;
    const cache = getAvatarDescCache();
    if (cache[url]) return cache[url];

    console.log(`[AI Vision] Fetching new description for avatar: ${url.substring(0, 30)}...`);

    try {
        let body = {};
        let headers = { 'Content-Type': 'application/json' };
        let targetUrl = endpoint;

        if (provider === 'gemini') {
            const parts = b64.split(';base64,');
            const mime = parts[0].replace('data:', '');
            const data = parts[1].replace(/[^A-Za-z0-9+/=]/g, '');

            body = {
                contents: [{
                    role: 'user',
                    parts: [
                        { text: `璇蜂负鍚嶅瓧鍙?${name}"鐨勪汉鐗╃殑澶村儚鎻愪緵涓€娈电畝鐭殑瑙嗚鎻忚堪锛?5瀛椾互鍐咃級銆傞噸鐐规弿杩板彂鑹层€佸彂鍨嬨€佽。鏈嶅拰绁炴€併€傝浠?"[DESC: 鎻忚堪鍐呭]" 鐨勬牸寮忚繑鍥炪€俙 },
                        { inline_data: { mime_type: mime, data: data } }
                    ]
                }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
            };
            const sep = targetUrl.includes('?') ? '&' : '?';
            targetUrl = `${targetUrl}${sep}key=${apiKey}`;
            if (!targetUrl.includes(':generateContent')) targetUrl = targetUrl.replace(/\/v1beta\/.*/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        } else {
            headers['Authorization'] = `Bearer ${apiKey}`;
            body = {
                model: model,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: `璇蜂负"${name}"鐨勫ご鍍忔彁渚涚畝鐭腑鏂囨弿杩帮紙15瀛楀唴锛夈€傛牸寮忥細[DESC: 鍐呭]` },
                        { type: 'image_url', image_url: { url: b64 } }
                    ]
                }],
                max_tokens: 100
            };
        }

        const resp = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
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
            cache[url] = finalDesc;
            saveAvatarDescCache(cache);
            return finalDesc;
        }
    } catch (e) {
        console.error('[AI Vision] Avatar description fail:', e);
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
        name: char.userName || '鐢ㄦ埛',
        persona: char.userPersona || '',
        gender: char.userGender || '鏈煡', // Add Gender
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

    // 2. Persona Context
    const personaContext = `
銆愯鑹茶瀹氥€?濮撳悕锛?{char.name}
鎬у埆锛?{char.gender || '鏈煡'}
鎻忚堪锛?{char.prompt || char.description || '鏃?}

銆愮敤鎴疯瀹氥€?濮撳悕锛?{char.userName || '鐢ㄦ埛'}
鎬у埆锛?{char.userGender || '鏈煡'}
浜鸿锛?{char.userPersona || '鏃?}
    `.trim()

    // 3. Moments Context (The complex part)
    let momentsContext = ''
    if (momentsStore && momentsStore.moments) {
        const momentsList = momentsStore.moments
        const topMoments = momentsStore.topMoments || []

        // Helper to format moment
        const formatMoment = (m) => {
            if (!m) return ''
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { hour12: false }) : '鏈煡鏃堕棿'
            let text = `[鏃堕棿: ${timeStr}] ${m.authorId === char.id ? char.name : (m.authorName || '鐢ㄦ埛')}: ${m.content}`
            if (m.imageDescriptions && m.imageDescriptions.length > 0) {
                text += `\n(鍥剧墖鍐呭: ${m.imageDescriptions.join(', ')})`
            }
            if (m.comments && m.comments.length > 0) {
                const commentsText = m.comments.map(c => `  - ${c.authorName}${c.replyTo ? '鍥炲' + c.replyTo : ''}: ${c.content}`).join('\n')
                text += `\n  (璇勮浜掑姩):\n${commentsText}`
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
            parts.push(`銆?{char.name}鐨勭疆椤舵湅鍙嬪湀銆慭n${charPinned.map(formatMoment).join('\n---\n')}`)
        }
        if (userLatests.length > 0) {
            parts.push(`銆?{char.userName || '鐢ㄦ埛'}鐨勬渶鏂版湅鍙嬪湀銆慭n${userLatests.map(formatMoment).join('\n---\n')}`)
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
    const weekDays = ['鏃?, '涓€', '浜?, '涓?, '鍥?, '浜?, '鍏?]
    const d = new Date()
    const currentVirtualTime = `${d.getFullYear()}骞?{d.getMonth() + 1}鏈?{d.getDate()}鏃?${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')} 鏄熸湡${weekDays[d.getDay()]}`

    const historyText = recentMsgs.map((m, index) => {
        let content = m.content

        // Parse Special Types for AI Context
        if (m.type === 'favorite_card' || (content && content.includes('"source":"閫氳瘽璁板綍"'))) {
            try {
                const data = JSON.parse(content);
                content = `[绯荤粺娑堟伅] ${data.title || '閫氳瘽'} 宸茬粨鏉熴€傛椂闀匡細${data.preview || ''}`;
            } catch (e) { content = '[閫氳瘽璁板綍]'; }
        } else if (m.type === 'voice') {
            // Ensure voice content is text (transcript)
            content = `[璇煶娑堟伅] ${content}`;
        }

        // Inject hint if it's the last message and delay > 1min
        if (index === recentMsgs.length - 1 && m.role === 'user' && diffMinutes >= 1) {
            const hours = Math.floor(diffMinutes / 60);
            const mins = diffMinutes % 60;
            const timeStr = hours > 0 ? `${hours}灏忔椂${mins}鍒嗛挓` : `${mins}鍒嗛挓`;
            content += ` \n\n銆愮郴缁熸彁绀猴細褰撳墠鏃堕棿涓?${currentVirtualTime}锛岃窛绂诲弻鏂逛笂涓€娆′簰鍔ㄦ椂闂翠负 ${timeStr}銆傝鏍规嵁鏃堕暱鍜屽綋鍓嶆椂闂存锛屽湪鍥炲涓〃鐜板嚭鍚堢悊鐨勫弽搴斻€傘€慲
        }
        return `${m.role === 'user' ? (char.userName || 'User') : char.name}: ${content}`
    }).join('\n')

    // 5. Summary
    const summaryText = char.summary || '锛堟殏鏃犺嚜鍔ㄦ€荤粨锛?

    // Update system prompt with fresh virtual time for accurate preview
    const charWithTime = { ...char, virtualTime: currentVirtualTime }
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE(charWithTime, userForSystem, stickers, worldInfoText, memoryText, patSettings, locationContext)

    return {
        system: systemPrompt,
        persona: personaContext,
        worldBook: worldInfoText || '锛堟湭瑙﹀彂鍏抽敭璇嶏級',
        moments: momentsContext,
        history: historyText,
        summary: summaryText
    }
}

// Renamed original generateReply to _generateReplyInternal
async function _generateReplyInternal(messages, char, signal, options = {}) {
    const settingsStore = useSettingsStore()
    const stickerStore = useStickerStore()

    // 鑾峰彇鎵€鏈夊彲鐢ㄨ〃鎯呭寘 (鍏ㄥ眬 + 褰撳墠瑙掕壊)
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
        return { error: '鏈壘鍒版湁鏁堢殑 API 閰嶇疆', internalError: 'Config is null', request: {} }
    }

    if (!apiKey) {
        return { error: '璇峰厛鍦ㄨ缃腑閰嶇疆 API Key', request: {} }
    }

    // Use user info passed in 'char' object (per-chat settings) or global user profile
    const realUserProfile = settingsStore.personalization?.userProfile || {};
    const userProfile = {
        name: char.userName || realUserProfile.name || '鐢ㄦ埛',
        persona: char.userPersona || '',
        gender: char.userGender || realUserProfile.gender || '鏈煡',
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
                    activeEntries.push(`[甯搁┗] ${entry.name || '鏈懡鍚?}: ${entry.content || ''} `)
                    return
                }
                const isHit = Array.isArray(entry.keys) && entry.keys.some(key => {
                    if (!key) return false
                    return lowerContext.includes(String(key).toLowerCase())
                })
                if (isHit) {
                    activeEntries.push(`[瑙﹀彂] ${entry.name || '鏈懡鍚?}: ${entry.content || ''} `)
                }
            })

            if (activeEntries.length > 0) {
                worldInfoText = activeEntries.join('\n\n')
            }
        } catch (e) {
            if (logger) logger.addLog('ERROR', 'WorldBook logic error', e.message)
        }
    }

    // 鏋勫缓 System Message
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

    // 鏋勫缓 System Message
    // 濡傛灉浼犲叆鐨勬秷鎭腑宸茬粡鍖呭惈浜?System Prompt (渚嬪鏈嬪弸鍦堢敓鎴?锛屽垯璺宠繃榛樿妯℃澘
    let systemMsg = null
    const hasCustomSystem = messages && messages.length > 0 && messages[0].role === 'system'

    if (!hasCustomSystem) {
        const patSettings = { action: char.patAction, suffix: char.patSuffix }

        const locationContext = char.locationSync
            ? weatherService.getLocationContextText()
            : ''

        // Battery Context
        const batteryInfo = batteryMonitor.getBatteryInfo()
        const batteryContext = batteryInfo
            ? `\n銆愭墜鏈虹數閲忋€?{batteryInfo.level}%${batteryInfo.charging ? ' (姝ｅ湪鍏呯數)' : ''}${batteryInfo.isLow ? ' (鐢甸噺鍛婃€?' : ''}`
            : ''

        // Append battery info to location context (Environmental Context)
        const finalEnvContext = locationContext + batteryContext

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
    // Convert [鍥剧墖:URL] or [琛ㄦ儏鍖?鍚嶇О] to { type: "image_url", image_url: { url: "..." } }
    // OPTIMIZATION: Only send the LAST 5 images to the AI to prevent massive payloads.

    // 1. First, count total images to determine the cutoff index
    let totalImagesCount = 0
    const visionLimit = 2 // Updated from 5 to 2 to minimize context length
    const imageRegex = /\[(?:鍥剧墖|IMAGE)[:锛歖((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:琛ㄦ儏鍖厊STICKER)[:锛歖([^\]]+)\]/gi

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

                    let roleText = msg.role === 'user' ? '锛堢敤鎴峰彂閫佷簡涓€寮犲浘鐗囷級' : '锛堟垜鍙戦€佷簡涓€寮犲浘鐗囷級'
                    if (msg.type === 'moment_card') roleText = '锛堢敤鎴峰垎浜簡涓€鏉℃湅鍙嬪湀鍔ㄦ€侊級'
                    else if (msg.type === 'favorite_card') roleText = '锛堢敤鎴峰垎浜簡涓€涓敹钘忕綉椤?鍐呭锛?

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
                        content: `${content} [鍥剧墖: (鐢变簬涓婁笅鏂囪繃闀匡紝鏃у浘鐗囪瑙変俊鎭凡蹇界暐)]`
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
                            { type: 'text', text: (msg.role === 'user' ? '锛堢敤鎴峰彂閫佷簡涓€寮犲浘鐗囷級' : '锛堟垜鍙戦€佷簡涓€寮犲浘鐗囷級') + refText },
                            { type: 'image_url', image_url: { url: content } }
                        ]
                    })
                    continue
                } else {
                    // Placeholder for older images
                    formattedMessages.push({
                        role: msg.role,
                        content: `[鍥剧墖: (鍘嗗彶鍥剧墖宸茬渷鐣ヤ互鑺傜渷娴侀噺)]`
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
                            { type: 'text', text: msg.role === 'user' ? `锛堢敤鎴峰彂閫佷簡琛ㄦ儏鍖? ${matchedSticker.name}锛塦 : `[琛ㄦ儏鍖?${matchedSticker.name}]` },
                            { type: 'image_url', image_url: { url: imgUrl } }
                        ]
                    })
                    continue
                } else {
                    formattedMessages.push({
                        role: msg.role,
                        content: `[琛ㄦ儏鍖? ${matchedSticker.name}]` // Just keep text
                    })
                    continue
                }
            }

            // 3. Handle potential [鍥剧墖:URL] and [琛ㄦ儏鍖?鍚嶇О] within text
            const combinedRegex = /\[(?:鍥剧墖|IMAGE)[:锛歖((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:琛ㄦ儏鍖厊STICKER)[:锛歖([^\]]+)\]/gi
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
                        contentParts.push({ type: 'text', text: `[鍥剧墖: ${match[1].startsWith('data:') ? '(鍘嗗彶鍥剧墖)' : match[1]}]` })
                    }
                } else if (match[2]) {
                    const stickerName = match[2].trim()
                    const sticker = allStickers.find(s => s.name === stickerName)

                    if (sticker) {
                        if (isVisionEnabled) {
                            const finalStickerUrl = (sticker.url.startsWith('http')) ? (await resolveToBase64(sticker.url) || sticker.url) : sticker.url;
                            contentParts.push({ type: 'text', text: `[琛ㄦ儏鍖?${stickerName}]` })
                            contentParts.push({ type: 'image_url', image_url: { url: finalStickerUrl } })
                        } else {
                            contentParts.push({ type: 'text', text: `[琛ㄦ儏鍖?${stickerName}]` })
                        }
                    } else {
                        currentImageIndex--
                        contentParts.push({ type: 'text', text: `[琛ㄦ儏鍖?${stickerName}]` })
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
    const visualContextMessages = []
    const userAvatar = realUserProfile?.avatar
    const charAvatar = char.avatar
    const isImage = (s) => typeof s === 'string' && (s.trim().length > 0)

    if ((isImage(userAvatar) || isImage(charAvatar)) && !options.skipVisualContext) {
        const [userB64, charB64] = await Promise.all([
            resolveToBase64(userAvatar),
            resolveToBase64(charAvatar)
        ])

        // Use cached descriptions if available to save log space and token count
        const [userDesc, charDesc] = await Promise.all([
            getOrFetchAvatarDesc(userAvatar, userB64, userProfile.name, provider, apiKey, apiUrl, model),
            getOrFetchAvatarDesc(charAvatar, charB64, char.name, provider, apiKey, apiUrl, model)
        ])

        const contentParts = [{ type: 'text', text: '銆愯瑙夋儏鎶ワ細浜虹墿澶栬矊銆戜互涓嬫槸褰撳墠瀵硅瘽鍙備笌鑰呯殑澶栬矊鐗瑰緛鍙傝€冿細' }]

        if (userDesc) {
            contentParts.push({ type: 'text', text: `鐢ㄦ埛 (${userProfile.name}) 鐨勫ご鍍忔弿杩帮細${userDesc}` })
        } else if (userB64) {
            contentParts.push({ type: 'text', text: `杩欐槸鐢ㄦ埛 (${userProfile.name}) 鐨勫綋鍓嶅ご鍍忥細` })
            contentParts.push({ type: 'image_url', image_url: { url: userB64 } })
        }

        if (charDesc) {
            contentParts.push({ type: 'text', text: `鎴?(${char.name}) 鐨勫綋鍓嶅ご鍍忔弿杩帮細${charDesc}` })
        } else if (charB64) {
            contentParts.push({ type: 'text', text: `杩欐槸鎴?(${char.name}) 鐨勫綋鍓嶅ご鍍忥細` })
            contentParts.push({ type: 'image_url', image_url: { url: charB64 } })
        }

        if (contentParts.length > 1) {
            visualContextMessages.push({
                role: 'user',
                content: contentParts
            })
        }
    }

    // 鏋勫缓瀹屾暣娑堟伅閾?    const fullMessages = [systemMsg, ...visualContextMessages, ...formattedMessages].filter(Boolean).filter(msg => {
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
                        return { text: `[鍥剧墖: ${url}]` }
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
            const searchHint = "\n\n銆怱ystem Order: Web Search Enabled銆慪ou have access to real-time information via web search tools. When asked about current events, specific facts, or data after your cutoff, please prioritize using your search tools to provide accurate, up-to-date answers.";
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
    useLoggerStore().addLog('AI', '缃戠粶璇锋眰 (Request)', {
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
                errorMsg += ' (鎻愮ず: 璇锋鏌?Base URL 鏄惁姝ｇ‘锛屽緢澶氭湇鍔″晢闇€瑕佷互 /v1 缁撳熬)'
            }
            // Hint for 503 Token/Service Error
            if (response.status === 503) {
                if (errText.includes('Token') || errText.includes('refresh')) {
                    errorMsg += ' (鎻愮ず: 浠ｇ悊鏈嶅姟鐨?Token 鍒锋柊澶辫触銆傝繖涓嶆槸浠ｇ爜闂锛岃€屾槸鎮ㄧ殑 API Key 鎴栦唬鐞嗘湇鍔″櫒鍐呴儴璐﹀彿杩囨湡锛岃灏濊瘯鏇存崲 Key 鎴栨ā鍨嬨€?'
                } else {
                    errorMsg += ' (鎻愮ず: 鏈嶅姟鏆傛椂涓嶅彲鐢紝璇风◢鍚庨噸璇曘€?'
                }
            }
            // Hint for Thinking Budget 400
            if (response.status === 400) {
                if (errText.includes('thinking_budget')) {
                    errorMsg += ' (鎻愮ず: 妫€娴嬪埌妯″瀷浠ｇ悊娉ㄥ叆浜嗕笉鏀寔鐨勫弬鏁?thinking_budget銆傝灏濊瘯鏇存崲涓嶅甫 "nothinking" 鍚庣紑鐨勬ā鍨嬪悕绉般€?'
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
                    useLoggerStore().addLog('AI', '鈿狅笍 400閿欒鑷姩閲嶈瘯 (杞函鏂囨湰妯″紡/SystemOrder)', { originalError: errText })

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
                        errorMsg += `\n(鑷姩閲嶈瘯涔熷け璐ヤ簡: ${retryErrText})`
                        throw new Error(errorMsg)
                    }
                }
            } else {
                throw new Error(errorMsg)
            }
        }
        // else data is already set above

        // Log Full Response (Success)
        useLoggerStore().addLog('AI', 'AI鍝嶅簲 (Response)', data)

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
            useLoggerStore().addLog('WARN', 'AI杩斿洖鍐呭涓虹┖', data)
            // Check for safety/finish reason
            const finishReason = data.choices?.[0]?.finish_reason || data.candidates?.[0]?.finishReason
            if (finishReason === 'safety' || finishReason === 'content_filter') {
                return {
                    error: '鍐呭琚獳I瀹夊叏绛栫暐鎷︽埅 (Safety Filter)',
                    request: {
                        provider,
                        endpoint,
                        headers: reqHeaders,
                        body: reqBody
                    }
                }
            }
            return {
                error: 'AI杩斿洖浜嗙┖鍐呭锛岃妫€鏌ユ棩蹇?(Raw Data)',
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

        // 绠€鍗曠殑鍚庡鐞嗭細鍒嗙蹇冨０鍜屾鏂?        let content = rawContent
        let innerVoice = null

        // 鎻愬彇 [INNER_VOICE] - 澧炲己骞跺彂鎺樿兘鍔?        const ivPattern = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|绾㈠寘|杞处|琛ㄦ儏鍖厊鍥剧墖|SET_|NUDGE))|$)/i
        let ivMatch = content.match(ivPattern)
        let ivSegment = ivMatch ? ivMatch[1].trim() : null

        // FALLBACK: 濡傛灉娌℃壘鍒版爣绛撅紝浣嗘枃鏈噷鏈夌湅璧锋潵鍍忓績澹扮殑 JSON 鍧?        if (!ivSegment && (content.includes('"status"') || content.includes('"蹇冨０"') || content.includes('"鎯呯华"'))) {
            // 灏濊瘯瀵绘壘鏈€鍚庝竴涓寘鍚叧閿瘝鐨勫ぇ鎷彿鍧?            const blocks = [...content.matchAll(/\{[\s\S]*?\}/g)]
            for (let i = blocks.length - 1; i >= 0; i--) {
                const block = blocks[i][0]
                if (block.includes('"status"') || block.includes('"蹇冨０"') || block.includes('"鐫€瑁?') || block.includes('"thought"')) {
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
                        const reg = new RegExp(`(?:"|\\\\")?${k}(?:"|\\\\")?\\s*[:锛歖\\s*(?:"|\\\\")?((?:[^"\\\\}]|\\\\.)*?)(?:"|\\\\")?(?:,|}|$)`, 'i');
                        const m = ivSegment.match(reg);
                        if (m && m[1]) return m[1].replace(/\\"/g, '"').trim();
                    }
                    return null;
                };

                const status = extractField(['status', '鐘舵€?, '褰撳墠鐘舵€?, '蹇冩儏']);
                const outfit = extractField(['鐫€瑁?, 'outfit', 'clothes', 'clothing', '绌跨潃']);
                const scene = extractField(['鐜', 'scene', 'environment', '鍦烘櫙']);
                const mind = extractField(['蹇冨０', 'thoughts', 'mind', 'inner_voice', 'thought', '鎯呯华', '鎯呮劅', '鎯虫硶']);
                const action = extractField(['琛屼负', 'action', 'behavior', 'plan', '鍔ㄤ綔']);

                if (status || outfit || scene || mind || action) {
                    innerVoice = {
                        status: status || "",
                        鐫€瑁? outfit || "",
                        鐜: scene || "",
                        蹇冨０: mind || "",
                        琛屼负: action || ""
                    }
                } else {
                    useLoggerStore().addLog('WARN', '蹇冨０瑙ｆ瀽澶辫触', { error: e.message, segment: ivSegment.substring(0, 150) })
                }
            }
        }

        // Family Card Logic (Auto-Process) -> NOW LEGACY, REMOVED to let Frontend handle it
        // The store (chatStore) will detect [FAMILY_CARD] tags and set msg.type = 'family_card'
        // ChatMessageItem.vue will render the native Vue component.

        // 1. APPROVE & 2. REJECT - Pass through raw tags
        // No modification needed.

        // 绉婚櫎 <reasoning_content> (濡傛灉鏈?
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
            useLoggerStore().addLog('ERROR', `API璇锋眰澶辫触: ${error.message}`, { error: error.toString(), stack: error.stack })
        } catch (logErr) {
            console.error('Logger failed:', logErr)
        }

        // [AUTO-FIX] Smart Retry for Proxy Injection
        // If error is 400 and related to thinking_budget AND model has 'nothinking', try stripping it.
        if (error.message && error.message.includes('thinking_budget')) {
            // Aggressive Clean: Remove prefix (e.g. "channel/") AND "nothinking"
            // Example: "娴佸紡鎶楁埅鏂?gemini-2.5-pro-nothinking" -> "gemini-2.5-pro"
            const baseName = model.split('/').pop()
            const cleanModel = baseName.replace(/[-_.]?nothinking[-_.]?/i, '')

            // Check if we actually changed the model to avoid infinite retry of same thing
            if (cleanModel !== model) {
                useLoggerStore().addLog('WARN', `妫€娴嬪埌浠ｇ悊娉ㄥ叆寮傚父锛屽皾璇曘€庢牴婧愬噣鍖栥€?鍘婚櫎鍓嶇紑+鍚庣紑: ${cleanModel}) 骞堕噸缃甌oken闄愬埗...`, { from: model, to: cleanModel })

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
                    useLoggerStore().addLog('AI', '鑷姩閲嶈瘯鎴愬姛 (Retry Success)', retryData)

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
                    const ivMatch = content.match(/\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[-_ ]?)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|绾㈠寘|杞处|琛ㄦ儏鍖厊鍥剧墖|SET_|NUDGE))|$)/i)
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
                    useLoggerStore().addLog('ERROR', '鑷姩閲嶈瘯澶辫触', retryErr.message)
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

    if (!config || !apiKey || !model) return 'API鏈厤缃?(妫€鏌ey/妯″瀷/鍩虹URL)'

    // System Prompt (The instruction to summarize)
    const systemContent = customPrompt || '璇风畝瑕佹€荤粨涓婅堪瀵硅瘽鐨勪富瑕佸唴瀹瑰拰鍏抽敭淇℃伅锛屼綔涓洪暱鏈熻蹇嗗綊妗ｃ€傝淇濇寔瀹㈣锛屼笉瑕佷娇鐢ㄧ涓€浜虹О銆?

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
    useLoggerStore().addLog('AI', '鐢熸垚鎬荤粨 (Request)', {
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
            useLoggerStore().addLog('WARN', '鎬荤粨缁撴灉涓虹┖ (Raw Response)', data)
            throw new Error('Empty Content (Check Raw Response)')
        }

        useLoggerStore().addLog('AI', '鎬荤粨缁撴灉 (Response)', { content })
        return content

    } catch (e) {
        console.error('Summary API Error:', e)
        useLoggerStore().addLog('ERROR', '鎬荤粨澶辫触', e.message)
        return `鎬荤粨鐢熸垚澶辫触: ${e.message}`
    }
}

/**
 * 灏嗕腑鏂囨彁绀鸿瘝缈昏瘧/鎵╁厖涓鸿嫳鏂囩敓鍥炬彁绀鸿瘝
 * @param {String} text 涓枃鎻忚堪
 */
export async function translateToEnglish(text) {
    if (!text || !/[^\x00-\xff]/.test(text)) return text // No chinese, return as is

    const systemPrompt = `You are a professional image generation prompt engineer. 
Your task is to translate the user's Chinese description into a highly detailed, descriptive English prompt for drawing models like DALL-E 3 or Flux.
Maintain the original meaning, but add relevant visual keywords (lighting, texture, style) to make it look artistic.
Strictly output ONLY the English prompt text without any explanations.`

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Translate and expand this to a drawing prompt: ${text}` }
    ]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: 'Translator' }, null])
        if (result.error) return text
        return result.content || text
    } catch (e) {
        console.error('Translation failed:', e)
        return text
    }
}

// --- Moments Feature AI Logic ---

/**
 * 鐢熸垚鏈嬪弸鍦堝姩鎬佸唴瀹? * @param {Object} options { name, persona, worldContext, customPrompt }
 */
export async function generateMomentContent(options) {
    const { name, persona, worldContext, recentChats, customPrompt } = options

    const systemPrompt = `浣犵幇鍦ㄦ槸銆?{name}銆戙€?浣犵殑璁惧畾锛?{persona}銆?
${recentChats ? `銆愭渶杩戣亰澶╄褰?(浣滀负鑳屾櫙鍙傝€冿紝涓嶈鐩存帴澶嶈)銆慭n${recentChats}\n` : ''}

銆愪换鍔°€?1. 鍙戝竷涓€鏉℃湅鍙嬪湀鍔ㄦ€併€傚彲浠ュ寘鍚績鎯呮劅鎮熴€佺敓娲昏叮浜嬨€佹垨鏄兂瀵规煇浜猴紙涔斾箶锛夎鐨勮瘽銆?2. 涓鸿繖鏉″姩鎬佺敓鎴?3-5 鏉＄ぞ浜や簰鍔紙鐐硅禐鎴栬瘎璁猴級锛屼簰鍔ㄨ€呭簲璇ユ槸閫氳褰曚腑鐨勫ソ鍙嬫垨铏氭瀯鍚堢悊鐨凬PC銆?
鍥炲蹇呴』鏄竴涓?JSON 瀵硅薄锛屾牸寮忓涓嬶細
{
  "content": "鏈嬪弸鍦堟枃瀛楀唴瀹?,
  "location": "鍦扮悊浣嶇疆锛堝彲閫夛紝濡傦細鈥樹笂娴仿锋煇鏌愬挅鍟″巺鈥欙級",
  "imagePrompt": "鑻辨枃鐢熷浘鎻愮ず璇嶏紙鍙€夛級",
  "imageDescription": "鍥剧墖鎻忚堪锛堝彲閫夛級",
  "interactions": [
    { "type": "like", "authorName": "鍚嶅瓧", "isVirtual": true/false },
    { "type": "comment", "authorName": "鍚嶅瓧", "content": "鍐呭", "replyTo": "璋?, "isVirtual": true/false }
  ]
}

銆愪弗鏍肩害鏉熴€?1. 璇█鑷劧銆佺敓娲诲寲锛屼笉瑕佸儚 AI銆?2. 濡傛灉鏈夊浘鐗囨彁绀鸿瘝锛?*蹇呴』**鏄叧浜庡満鏅€佺墿鍝佹垨瑙掕壊鐨勬弿杩般€?3. 濡傛灉娑夊強鍒颁汉鐗╁舰璞★紝绯荤粺灏嗗己鍒朵娇鐢ㄢ€滄棩婕?灏戝コ婕€濋鏍笺€?4. 銆愪弗绂併€戜笉瑕佺敓鎴愪换浣曚唬琛ㄧ敤鎴风殑浜掑姩鍐呭锛堢偣璧炴垨璇勮锛夈€?${customPrompt ? `\n銆愮敤鎴疯嚜瀹氫箟鎸囦护銆慭n${customPrompt}` : ''}
${worldContext ? `\n銆愯儗鏅弬鑰冦€慭n${worldContext}` : ''}`

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
 * 鎵归噺鐢熸垚鏈嬪弸鍦堝姩鎬?浜掑姩鍐呭锛堜竴娆℃€х敓鎴愶級
 * @param {Object} options { characters: [{id, name, persona}], worldContext, customPrompt, count }
 */
export async function generateBatchMomentsWithInteractions(options) {
    const { characters, worldContext, customPrompt, userProfile, count = 3 } = options

    // Build character list for prompt with detailed persona and chat history
    const charList = characters.map((c, idx) => {
        const bio = localStorage.getItem(`char_bio_${c.id}`) || ''
        const bioText = bio ? `\n   涓€х鍚嶏細${bio}` : ''
        const chatText = c.recentChats ? `\n   鏈€杩戣亰澶╄褰?鍙傝€?: ${c.recentChats.substring(0, 800).replace(/\n/g, ' ')}...` : ''
        return `${idx + 1}. 銆?{c.name}銆?ID: ${c.id})\n   浜鸿锛?{c.persona.substring(0, 1000)}${bioText}${chatText}`
    }).join('\n\n')

    const now = new Date()
    const weekDays = ['鏃?, '涓€', '浜?, '涓?, '鍥?, '浜?, '鍏?]
    const currentVirtualTime = `${now.getFullYear()}骞?{now.getMonth() + 1}鏈?{now.getDate()}鏃?${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} 鏄熸湡${weekDays[now.getDay()]}`

    // Include user's bio and pinned moments if available
    let userContextText = userProfile?.name ? `\n\n銆愬綋鍓嶇敤鎴?(${userProfile.name}) 璧勬枡銆慲 : ""
    if (userProfile?.signature) userContextText += `\n涓€х鍚嶏細${userProfile.signature}`
    if (userProfile?.pinnedMoments?.length > 0) {
        userContextText += `\n缃《鍔ㄦ€侊細\n` + userProfile.pinnedMoments.map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    }
    if (userProfile?.persona) userContextText += `\n鑳屾櫙璁惧畾锛?{userProfile.persona}`

    const systemPrompt = `浣犳槸涓€涓ぞ浜ょ綉缁滄ā鎷熷櫒銆傚綋鍓嶇郴缁熸椂闂存槸锛?{currentVirtualTime}銆備互涓嬫槸鍙緵閫夋嫨鐨勫彂甯栬鑹插強浜掑姩濂藉弸鍒楄〃锛?${charList}
${userContextText}
    
銆愪换鍔°€?璇蜂粠涓婅堪鍒楄〃涓寫閫夎鑹诧紝鏍规嵁褰撳墠鏃堕棿锛?{currentVirtualTime}锛夛紝妯℃嫙浠栦滑鍦ㄦ湅鍙嬪湀鐨勫姩鎬併€傜敓鎴?${count} 鏉℃湅鍙嬪湀鍔ㄦ€併€傛瘡鏉″姩鎬侀渶瑕佸寘鍚細
1. 鍙戝竷鑰咃紙蹇呴』浠庝笂杩?ID 鍒楄〃涓€夋嫨姝ｇ‘鐨?authorId锛?2. 鏈嬪弸鍦堝唴瀹?3. 閰嶅浘锛堝彲閫夛級
4. 绀句氦浜掑姩锛堢偣璧炪€佽瘎璁恒€佸洖澶嶏級

銆愯姹傘€?1. 浣犻渶瑕佷粠杩欎簺瑙掕壊涓寫閫?${count} 涓紝鍒嗗埆鐢熸垚涓€鏉℃湅鍙嬪湀锛屽苟涓烘瘡鏉℃湅鍙嬪湀閰嶅 3-6 涓ぞ浜や簰鍔紙鐐硅禐 30% / 璇勮 70%锛夈€?2. 鐐硅禐鍜岃瘎璁鸿€呭繀椤绘槸瑙掕壊鍒楄〃涓殑浜烘垨铏氭嫙NPC銆傜粷涓嶅厑璁稿嚭鐜?"User"銆?鐢ㄦ埛" 鎴?"鎴? 浣滀负浜掑姩鑰呫€?3. 濡傛灉璇勮鏄洖澶嶇粰褰撳墠鐢ㄦ埛鐨勶紝蹇呴』绉板懠鐢ㄦ埛涓?"${userProfile?.name || '涔斾箶'}"锛岃€屼笉鏄?"浣? 鎴?"涓讳汉"锛堥櫎闈炶鑹蹭汉璁惧姝わ級銆?4. 銆愪簰鍔ㄨ€呭鏍峰寲锛氭牳蹇冭姹傘€?   - 涓ョ鍚屼竴涓鑹诧紙濡傛灄娣憋級鍑虹幇鍦ㄤ竴鏉″姩鎬佺殑澶氭浜掑姩涓紙闄ら潪鏄洖澶嶏級銆?   - 姣忔潯鍔ㄦ€佺殑 3-6 鏉′簰鍔ㄤ腑锛?*蹇呴』鍖呭惈鑷冲皯 2 涓?* 铏氭瀯鐨?NPC锛堣櫄鎷熺綉鍙嬨€佽矾浜恒€侀偦灞呯瓑锛夛紝浠ヨ惀閫犵湡瀹炵殑绀句氦姘涘洿銆?   - 铏氭瀯 NPC 鐨勫悕瀛楄鎺ュ湴姘旓紙濡傦細闅斿鐜嬪ぇ濡堛€佷竴鍙皬閫忔槑銆佽€冪爺鍔犳补銆佸揩涔愭槦鐞冿級銆?   - 涓ョ鍒嗛厤涓嶇鍚堣鑹蹭汉璁剧殑鍙拌瘝銆傚鏋滀綘鍙湁 1-2 涓€氳褰曞ソ鍙嬶紝璇峰姟蹇呭ぇ閲忓垱閫犺櫄鎷烴PC鏉ュ垎閰嶈瘎璁轰换鍔°€?
銆愯緭鍑烘牸寮忋€戝繀椤绘槸涓€涓?JSON 鏁扮粍锛?\`\`\`json
[
  {
    "authorId": "瑙掕壊ID锛堜粠杈撳叆涓€夋嫨锛?,
    "content": "鏈嬪弸鍦堟枃瀛楀唴瀹广€備綘鍙互閫氳繃 @鍚嶅瓧 鎻愰啋鏌愪汉锛屽苟鍦ㄤ笅鏂?mentions 鏁扮粍涓櫥璁般€?,
    "mentions": [ { "id": "user", "name": "${userProfile.name}" }, { "id": null, "name": "鏌愪汉" } ],
    "location": "鍦扮悊浣嶇疆锛堝彲閫夛級",
    "imagePrompt": "鑻辨枃鍥剧墖鐢熸垚鎻愮ず璇嶏紙鍙€夛紝濡傛灉闇€瑕侀厤鍥撅級",
    "imageDescription": "鍥剧墖鎻忚堪锛堝彲閫夛級",
    "html": "HTML鏍煎紡鍐呭锛堝彲閫夛紝鐢ㄤ簬鐗规畩鎺掔増濡傝瘲姝岋級",
    "interactions": [
      {
        "type": "like",
        "authorName": "鐐硅禐鑰呯殑鍚嶅瓧锛堜粠瑙掕壊鍒楄〃鎴栬櫄鎷烴PC涓€夋嫨锛?,
        "isVirtual": true/false
      },
      {
        "type": "comment",
        "authorName": "璇勮鑰呯殑鍚嶅瓧",
        "content": "璇勮鍐呭銆備篃鍙互鐢?@鍚嶅瓧銆?,
        "replyTo": "琚洖澶嶈€呯殑鍚嶅瓧锛堝鏋滄槸鍥炲鏌愯瘎璁猴紝鍙€夛級",
        "mentions": [],
        "isVirtual": true/false
      }
    ]
  }
]
\`\`\`

銆愬唴瀹硅姹傘€?1. 20% 绾枃瀛楁湅鍙嬪湀锛堟棤閰嶅浘锛?2. 10% 鐗规畩鎺掔増锛圚TML鏍煎紡锛屽璇楁瓕銆佸紩鐢級
3. 70% 閰嶅浘鏈嬪弸鍦?4. 璇█鑷劧銆佺敓娲诲寲
5. imagePrompt 濡傛灉鎻愪緵锛屽繀椤绘槸鑻辨枃
6. 銆愪弗绂併€戠粷瀵逛笉瑕佺敓鎴愪换浣曚唬琛ㄧ敤鎴凤紙User/鎴戯級鐨勭偣璧炪€佽瘎璁烘垨鍥炲銆傜偣璧炲拰璇勮鑰呭繀椤绘槸瑙掕壊鍒楄〃涓殑浜烘垨铏氭嫙NPC銆?7. 銆愭牸寮忓己鍒躲€戜簰鍔ㄨ€呯殑 'authorName' 蹇呴』鏄甯哥殑涓枃鏄电О锛堝 "鏋楁繁"銆?闅斿鑰佺帇"锛夛紝**涓ョ**浣跨敤 'char_linshen'銆?user_123' 绛夋妧鏈疘D锛屼篃**涓ョ**浣跨敤绾暟瀛椼€?
${customPrompt ? `\n銆愮敤鎴疯嚜瀹氫箟鎸囦护銆慭n${customPrompt}` : ''}
${worldContext ? `\n銆愯儗鏅弬鑰冦€慭n${worldContext}` : ''}
${userContextText}

璇风洿鎺ヨ繑鍥?JSON 鏁扮粍锛屼笉瑕佹湁鍏朵粬鏂囧瓧銆俙

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: 'MomentsGenerator' }, null, { skipVisualContext: true }])
        if (result.error) throw new Error(result.error)

        // Parse JSON array from AI response
        const jsonMatch = result.content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('AI Response is not a valid JSON array')

        const momentsData = JSON.parse(jsonMatch[0])

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
                    const userName = userProfile?.name || '涔斾箶'
                    if (interaction.replyTo === 'User' || interaction.replyTo === '鐢ㄦ埛' || interaction.replyTo === '鎴?) {
                        interaction.replyTo = userName
                    }
                    if (interaction.content && interaction.content.includes('User')) {
                        interaction.content = interaction.content.replace(/User/g, userName)
                    }

                    // Fix: Sanitize numeric/ID-like authorNames from AI hallucination
                    if (interaction.authorName) {
                        if (/^\d+$/.test(interaction.authorName)) {
                            interaction.authorName = '鐑績缇ゅ弸'
                        } else if (interaction.authorName.startsWith('char_') || interaction.authorName.startsWith('user_')) {
                            // Attempt to strip prefix if AI leaks variables like char_linshen
                            interaction.authorName = interaction.authorName.replace(/^(char|user)_/i, '')
                        }
                    }

                    // Fix: Sanitize numeric/ID-like replyTo
                    if (interaction.replyTo) {
                        if (/^\d+$/.test(interaction.replyTo)) {
                            interaction.replyTo = '鏈嬪弸'
                        } else if (interaction.replyTo.startsWith('char_') || interaction.replyTo.startsWith('user_')) {
                            interaction.replyTo = interaction.replyTo.replace(/^(char|user)_/i, '')
                        }
                    }

                    // Mentions in interactions
                    if (!interaction.mentions) interaction.mentions = []

                    // ID Patch
                    if (interaction.isVirtual && !interaction.authorId) {
                        interaction.authorId = `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
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
 * 缁熶竴鐢熷浘鎺ュ彛 (Supports Pollinations standard, SiliconFlow, and API Key)
 * @param {String} prompt 鎻愮ず璇? */
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

    console.log(`[AI Image] Final Config - Provider: ${provider}, Model: ${model}, Has Key: ${!!apiKey}`)

    // Log image generation request
    useLoggerStore().addLog('AI', '鍥剧墖鐢熸垚璇锋眰', {
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

    // Extreme negative boosters
    const negativeBoost = "(muscular:1.7), (bulky:1.6), (abs:1.7), (defined muscle:1.6), (six-pack:1.7), (bodybuilder:1.6), (fitness:1.4), huge shoulders, thick arms, muscular chest, (eight-pack:1.4), thick neck, (extra hands:2.0), (merged characters:1.8), (clipping), (messy fingers:1.5), (over-muscular:1.5), brutal, front-facing kiss, (merged faces:1.8), masculine girl, (athletic build:1.2)"

    let enhancedPrompt = ""
    // Universal Anime Style Base
    const animeStyleBase = "(anime style:1.5), (flat color:1.2), (cel shading:1.2), (2D:1.5), (clean lines), (illustration:1.2), (no 3D), (no photorealistic), (no realism)"

    if (isCouple) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${prompt}, (two distinct individuals), detailed profiles, sharp lineart`
    } else if (isMale) {
        const muscleStyle = hasAbs
            ? "(lean muscular build)"
            : "(slender build)"
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, (beautiful bishounen face:1.2), ${muscleStyle}, ${prompt}, clean lineart`
    } else if (isFemale || isPerson) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, (beautiful anime face:1.2), (detailed eyes:1.2), (petite:1.1), ${prompt}, sharp focus, vibrant colors, clear lineart`
    } else {
        // Fallback also anime
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${prompt}, highly detailed, sharp focus, vibrant colors`
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
            throw new Error('妫€娴嬪埌 Secret Key (sk_)銆傛绫诲瘑閽ヤ笉閫傜敤浜庢祻瑙堝櫒鐩存帴璋冪敤锛屼細琚畼鏂规嫤鎴€傝浣跨敤 pk_ 寮€澶寸殑 Publishable Key銆?)
        }

        try {
            const host = 'gen.pollinations.ai'
            const path = 'image'

            // SANITIZATION: Heavily sanitize the prompt for URL safety.
            // URL params are extremely fragile for prompt text.
            const safePrompt = enhancedPrompt
                .replace(/[,锛?锛歕n\r]/g, ' ') // CRITICAL: Stop commas/colons breaking URL structure
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
                    throw new Error('瀵嗛挜鏍￠獙澶辫触 (401)銆傝繖閫氬父鎰忓懗鐫€鎮ㄧ殑 pk_ 瀵嗛挜棰濆害宸茶€楀敖 (瀹樻柟鍏嶈垂鐗堜粎 1寮?灏忔椂) 鎴栫敱浜庢彁绀鸿瘝杩濊琚嫤鎴€?)
                }

                if (response.status === 403 || errText.includes('Turnstile') || errText.includes('token')) {
                    throw new Error('琚畼鏂逛汉鏈洪獙璇佹嫤鎴?(Turnstile 403)銆傚嵆浣垮甫浜?Key 涔熷彲鑳界敱浜?IP 琚鎺с€傚缓璁敼鐢?SiliconFlow銆?)
                }
                throw new Error(`API 鍝嶅簲寮傚父 ${response.status}: ${errText.substring(0, 100)}`)
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
                    useLoggerStore().addLog('AI', '鍥剧墖鐢熸垚鎴愬姛 (Pollinations)', {
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
            useLoggerStore().addLog('ERROR', '鍥剧墖鐢熸垚澶辫触 (Pollinations)', e.message)
            // CRITICAL: Stop falling back to anonymous image.pollinations.ai because it returns the "WE HAVE MOVED" placeholder.
            // We want the user to see the AUTH error so they can fix their key.
            throw new Error(`缁樺埗澶辫触: ${e.message}`)
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
            useLoggerStore().addLog('AI', `鍥剧墖鐢熸垚鎴愬姛 (${provider})`, {
                provider,
                hasUrl: !!imageUrl
            })
            return imageUrl
        } catch (e) {
            console.error('Drawing API failed:', e)
            useLoggerStore().addLog('ERROR', `鍥剧墖鐢熸垚澶辫触 (${provider})`, e.message)
            throw e
        }
    }

    // Default Fallback
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`
}

/**
 * 鐢熸垚鏈嬪弸鍦堝姩鎬佺殑鎵归噺浜掑姩锛?-5鏉＄偣璧?璇勮锛? * 鍖呭惈锛氬凡鏈夎鑹?+ 铏氭嫙NPC锛堜翰鎴氥€佸悓浜嬬瓑锛? * @param {Object} moment 鐩爣鍔ㄦ€? * @param {Array} charInfos 澶囬€変簰鍔ㄨ鑹插垪琛? * @param {Array} historicalMoments 鍘嗗彶鏈嬪弸鍦堝垪琛? * @param {Object} userProfile 鐢ㄦ埛涓汉璧勬枡
 */
export async function generateBatchInteractions(moment, charInfos, historicalMoments = [], userProfile = {}) {
    // 1. 鏋勫缓鎻愮ず璇?    const historyStr = historicalMoments.length > 0
        ? "銆愭湅鍙嬪湀鐑偣鑳屾櫙锛堝弬鑰冿級銆慭n" + historicalMoments.map(m => `ID: ${m.id} | 浣滆€? ${m.authorName} | 鍐呭: ${m.content} | 浜掑姩: 鐐硅禐[${m.likes}], 璇勮[${m.comments}]`).join('\n')
        : ""

    // 绠€鍖栫幇鏈夎鑹蹭俊鎭紝鍑忓皯Token
    const friendsList = charInfos.map((c, index) => {
        const chatSnippet = c.recentChats ? ` | 鏈€杩戣亰澶? ${c.recentChats.substring(0, 300).replace(/\n/g, ' ')}` : ''
        return `${index + 1}. ${c.name}, 浜鸿: ${c.persona.substring(0, 100)}...${chatSnippet}`
    }).join('\n')

    let userInformation = ""
    if (userProfile.name) {
        userInformation = `\n銆愬綋鍓嶇敤鎴凤紙浣犱簰鍔ㄧ殑瀵硅薄锛夎祫鏂欍€慭n鍚嶅瓧: ${userProfile.name}\n`
        if (userProfile.signature) userInformation += `涓€х鍚? ${userProfile.signature}\n`
        if (userProfile.pinnedMoments?.length > 0) {
            userInformation += `缃《鍔ㄦ€? \n` + userProfile.pinnedMoments.map((m, i) => `- ${m.content}`).join('\n') + "\n"
        }
        userInformation += `鑳屾櫙璁惧畾: ${userProfile.persona || '涓€浣嶆櫘閫氱敤鎴?}\n`
    }

    const systemPrompt = `浣犳槸鏈嬪弸鍦堢敓鎴愬姪鎵嬨€備互涓嬫槸閫氳褰曠幇鏈夌殑瑙掕壊锛?${friendsList}
${userInformation}

銆愪换鍔°€?浣犵幇鍦ㄦ槸鈥滄湅鍙嬪湀鐢熷懡鍔涙ā鎷熷櫒鈥濄€備綘鐨勭洰鏍囨槸涓轰笅闈㈢殑鍔ㄦ€佹ā鎷熷嚭鐪熷疄鐨勭ぞ浜や簰鍔紙鍖呭惈鐐硅禐銆佽瘎璁哄拰澶氱骇鍥炲锛夈€?鍔ㄦ€佷綔鑰咃細${moment.authorName}
鍔ㄦ€佸唴瀹癸細${moment.content}
${moment.location ? `鍙戝竷浣嶇疆锛?{moment.location}` : ''}
${moment.visualContext ? `鍥剧墖鍐呭锛?{moment.visualContext}` : ''}
${moment.existingComments && moment.existingComments.length > 0 ? `\n銆愬凡鏈夎瘎璁猴細浣犲彲浠ラ拡瀵硅繖浜涜繘琛屽洖澶嶃€慭n${moment.existingComments.map((c, i) => `@${c.authorName}: ${c.content}`).join('\n')}` : ''}

${historyStr}

銆愪簰鍔ㄨ鑹叉潵婧愩€?1. **宸叉湁濂藉弸**锛堜紭鍏堬級锛氫粠涓婇潰鐨勯€氳褰曞垪琛ㄤ腑閫夋嫨銆?2. **铏氭嫙NPC**锛堣ˉ鍏咃級锛氭牴鎹綔鑰呭彲鑳界殑绀句氦鍦堬紝铏氭瀯鍚堥€傜殑浜虹墿锛堝涓冨ぇ濮戝叓澶уЖ銆佸悓浜嬨€佸悓瀛︺€佷笅灞炪€佽€佹澘绛夛級銆?   - 鍚嶅瓧瑕佸儚鐪熷悕鎴栧井淇℃樀绉帮紙濡傦細浜屽Ж銆佺帇缁忕悊銆丄Asales灏忔潕锛夈€?
銆愮敓鎴愯姹傘€?1. **浜掑姩绫诲瀷鍒嗚В**锛?   - **like**锛氱偣璧炪€傝鐢熸垚 5-15 涓紝钀ラ€犱汉姘斻€?   - **comment**锛氶拡瀵瑰姩鎬佸唴瀹圭殑鐩存帴璇勮銆?   - **reply**锛氥€愬叧閿€戦拡瀵瑰凡鏈夎瘎璁虹殑鍥炲銆傚鏋溾€滃凡鏈夎瘎璁衡€濅笉涓虹┖锛岃鍔″繀鐢熸垚 1-2 鏉″洖澶嶆潵褰㈡垚瀵硅瘽绾跨▼銆?2. **鎬绘暟瑕佹眰**锛氳瘎璁?(comment) + 鍥炲 (reply) 鎬昏蹇呴』杈惧埌 3-6 鏉°€?3. **鍐呭椋庢牸**锛氱煭灏忋€佸彛璇寲銆佸儚鐪熶汉寰俊銆備笉瑕佸濂楄瘽銆?4. 銆愮粷瀵逛弗绂併€戠粷瀵逛笉瑕佺敓鎴愪换浣曚唬琛ㄧ敤鎴凤紙鍗筹細${userProfile.name}锛夌殑鐐硅禐銆佽瘎璁烘垨鍥炲銆傜敤鎴锋槸瑙備紬锛屼笉鏄綘妯℃嫙鐨勫璞°€?   - **绂佹**鍦?authorName 涓娇鐢?"${userProfile.name}"銆?鎴?銆?User" 鎴?"鐢ㄦ埛"銆?   - 鎵€鏈夌殑鐐硅禐鍜岃瘎璁鸿€呭繀椤绘槸鍏朵粬濂藉弸瑙掕壊鎴栬櫄鎷烴PC銆?5. 銆愰噸瑕侊細鍘婚噸涓庡垎閰嶃€?   - 涓ョ鎵€鏈夎瘎璁洪兘鏉ヨ嚜鍚屼竴涓汉銆?   - 鍚屼竴涓鑹?*鍙互**鏃㈢偣璧炲張璇勮銆?   - **涓ョ**鎶婃墍鏈変笉鍚岃姘旂殑璇勮閮藉畨鍦ㄥ悓涓€涓幇鏈夊ソ鍙嬶紙濡傗€滄灄娣扁€濓級澶翠笂銆傚鏋滀綘鍙湁 1 涓ソ鍙嬶紝璇峰姟蹇呭ぇ閲忓垱閫犺櫄鎷烴PC鏉ュ垎閰嶉偅浜涗笉绗﹀悎璇ュソ鍙嬩汉璁剧殑鍙拌瘝銆?6. 銆愬叧閿細浜鸿涓€鑷存€?(Binding Check)銆?   - 濡傛灉璇勮璇皵鍍忊€滃コ浠?涓嬪睘鈥濓紝鍚嶅瓧蹇呴』瀵瑰簲锛堝娌℃湁鐜版垚瑙掕壊锛屽氨鏂板缓涓€涓櫄鎷烴PC鍙€滃コ浠嗗皬鐖扁€濓級銆?7. 銆愬己鍔涘幓閲嶏細涓ョ鍗曚汉闇稿睆銆?   - 涓€鏉″姩鎬佷笅鐨勬墍鏈夎瘎璁哄拰鐐硅禐锛?*涓ョ鏉ヨ嚜鍚屼竴涓汉**銆?   - 濡傛灉閫氳褰曚腑鍙湁 1-2 涓ソ鍙嬶紝浣?*蹇呴』**铏氭瀯鑷冲皯 3 涓悇鍏风壒鑹茬殑铏氭嫙 NPC锛堝锛氬鍗栧皬鍝ャ€佸皬瀛﹀悓瀛︺€佹繁澶滄綔姘村憳锛夋潵鍙戣〃璇勮锛岀‘淇濅簰鍔ㄨ€呭悕鍗曚笉灏戜簬 4 涓汉銆?   - 涓ョ璁╅€氳褰曞ソ鍙嬶紙濡傗€滄灄娣扁€濓級鍙戣〃澶氭潯鐩镐簰鐙珛鐨勮瘎璁恒€?   8. **蹇呴』**杩斿洖涓€涓?JSON 鏁扮粍锛屾牸寮忓涓嬶細
[
  { "type": "like", "authorName": "鍚嶅瓧", "isVirtual": true/false, "authorId": "ID鎴杗ull" },
  { "type": "comment", "authorName": "鍚嶅瓧", "content": "璇勮鍐呭", "mentions": [{ "id": "user", "name": "${userProfile.name}" }], "isVirtual": true/false, "authorId": "ID鎴杗ull" },
  { "type": "reply", "authorName": "鍚嶅瓧", "content": "鍥炲鍐呭", "replyTo": "琚洖澶嶈€呯殑鍚嶅瓧", "mentions": [], "isVirtual": true/false, "authorId": "ID鎴杗ull" }
]
`
    try {
        const result = await _generateReplyInternal([{ role: 'system', content: systemPrompt }], { name: 'System' }, null, { skipVisualContext: true })
        if (result.error) return []

        // Parse JSON
        const jsonMatch = result.content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return []

        const interactions = JSON.parse(jsonMatch[0])
        const userName = userProfile.name || '鎴?

        return interactions
            .filter(item => {
                // Pre-filter: Absolutely forbid any interaction where the author is the user
                const authorId = String(item.authorId || '').toLowerCase()
                const authorName = String(item.authorName || '')
                if (authorId === 'user' || authorName === userName || authorName === 'User' || authorName === '鐢ㄦ埛') {
                    console.warn(`[aiService] Filtered out AI-generated interaction from forbidden author (user): ${authorName}`);
                    return false
                }
                return true
            })
            .map(item => ({
                ...item,
                // Ensure ID is matched if it's an existing char
                authorId: item.isVirtual ? `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : (item.authorId || charInfos.find(c => c.name === item.authorName)?.id || null)
            }))

    } catch (e) {
        console.error('[aiService] Batch interactions failed', e)
        return []
    }
}

/**
 * 鐢熸垚鏈嬪弸鍦堣瘎璁? * @param {Object} charInfo { name, persona, worldContext }
 * @param {Object} moment { authorName, content, visualContext }
 * @param {String} historicalContext 鍙€夌殑鍘嗗彶鑳屾櫙瀛楃涓? */
export async function generateMomentComment(charInfo, moment, historicalContext = "") {
    const { name, persona, worldContext } = charInfo
    const { authorName, content, visualContext } = moment

    const systemPrompt = `浣犵幇鍦ㄦ槸銆?{name}銆戙€?浣犵殑璁惧畾锛?{persona}銆?${worldContext ? `褰撳墠涓栫晫鑳屾櫙锛?{worldContext}` : ''}
${historicalContext ? `\n${historicalContext}` : ''}

銆愪换鍔°€?璇峰銆?{authorName}銆戝彂甯冪殑涓€鏉℃湅鍙嬪湀杩涜璇勮銆?鏈嬪弸鍦堝唴瀹癸細${content}
鍥剧墖/瑙嗚鍐呭锛?{visualContext || '鏃犲浘鐗?}

銆愯姹傘€?1. 鍥炲瑕佺畝鐭€佺湡瀹烇紙绫讳技寰俊璇勮锛夛紝瀛楁暟鎺у埗鍦?0瀛椾互鍐呫€?2. 鏍规嵁浣犲拰瀵规柟鐨勫叧绯诲喅瀹氳姘旓紙璋冧緝銆佸叧蹇冦€佹拻濞囩瓑锛夈€?3. 濡傛灉鏈嬪弸鍦堝唴瀹规垨涔嬪墠鐨勫巻鍙插姩鎬佸緢鏈夋剰鎬濓紝璇风粨鍚堣儗鏅繘琛屽悙妲姐€佷簰鍔ㄦ垨鎺ユ銆?4. 濡傛灉鏈夊浘鐗囨弿杩帮紝璇峰皾璇曟彁鍙婂浘鐗囦腑鐨勫厓绱犱互澧炲己鈥滆瑙夋劅鈥濄€?5. **@鍔熻兘鏀寔**锛氫綘鍙互閫氳繃 '@鍚嶅瓧' 鎻愰啋鐗瑰畾鐨勪汉闃呰璇勮銆?6. 鐩存帴杈撳嚭璇勮鏂囧瓧锛屼笉瑕佸寘鍚换浣曟爣绛炬垨澶氫綑瑙ｉ噴銆俙

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        // Skip visual context to prevent AI from getting distracted by analyzing avatars instead of generating comments
        const result = await _generateReplyInternal(messages, { name }, null, { skipVisualContext: true })
        if (result.error) return null

        // Cleanup response (sometimes AI adds quotes or prefixes)
        let comment = result.content.replace(/^["'](.*)["']$/, '$1').replace(/^璇勮[锛?]\s*/, '').trim()
        return comment
    } catch (e) {
        console.error('[aiService] generateMomentComment failed', e)
        return null
    }
}

/**
 * 鐢熸垚瀵硅瘎璁虹殑鍥炲
 * @param {Object} charInfo { name, persona, worldContext }
 * @param {Object} moment { authorName, content, visualContext }
 * @param {Object} targetComment { authorName, content }
 */
export async function generateReplyToComment(charInfo, moment, targetComment) {
    const { name, persona, worldContext } = charInfo
    const { authorName, content, visualContext } = moment

    const systemPrompt = `浣犵幇鍦ㄦ槸銆?{name}銆戙€?浣犵殑璁惧畾锛?{persona}銆?${worldContext ? `褰撳墠涓栫晫鑳屾櫙锛?{worldContext}` : ''}

銆愪换鍔°€?浣犲湪鏈嬪弸鍦堢湅鍒颁簡銆?{targetComment.authorName}銆戠殑璇勮锛岃閽堝杩欐潯璇勮杩涜鍥炲銆?鏈嬪弸鍦堝師鏂囷紙浣滆€咃細${authorName}锛夛細${content}
瀵规柟鐨勮瘎璁猴細${targetComment.content}

銆愯姹傘€?1. 鍥炲瑕佺畝鐭€佸彛璇寲锛堢被浼煎井淇″洖澶嶏級锛屽瓧鏁版帶鍒跺湪20瀛椾互鍐呫€?2. 鍗充娇鏄洖澶嶏紝涔熸槸鍏紑灞曠ず鍦ㄦ湅鍙嬪湀涓嬫柟鐨勶紝璇蜂繚鎸佸緱浣撴垨鏈夎叮鐨勪簰鍔ㄩ鏍笺€?3. **@鍔熻兘鏀寔**锛氫綘鍙互閫氳繃 '@鍚嶅瓧' 鎻愰啋闃呰銆?4. 鐩存帴杈撳嚭鍥炲鍐呭锛屼笉瑕佸寘鍚换浣曟爣绛俱€俙

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await _generateReplyInternal(messages, { name }, null)
        if (result.error) return null

        // Cleanup
        let reply = result.content.replace(/^["'](.*)["']$/, '$1').replace(/^鍥炲[锛?]\s*/, '').trim()
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
export async function generateCompleteProfile(character, userProfile = {}) {
    const userName = userProfile.name || '鎴?
    const systemPrompt = `浣犳槸涓€涓垱鎰忓姪鎵嬶紝闇€瑕佷竴娆℃€т负瑙掕壊鐢熸垚瀹屾暣鐨勪富椤靛唴瀹广€?
瑙掕壊淇℃伅锛?濮撳悕锛?{character.name}
浜鸿锛?{character.prompt || '鏃?}

褰撳墠鐢ㄦ埛锛?{userName}

瑕佹眰鐢熸垚浠ヤ笅鍐呭锛?1. **3鏉＄疆椤舵湅鍙嬪湀** - 鏈€鑳戒唬琛ㄨ鑹茬壒鐐圭殑绮惧崕鍐呭
   - 鍙互閰嶅浘銆佺函鏂囧瓧銆佹垨HTML鎺掔増
   - **鏀寔 @鎻愰啋**锛氬唴瀹逛腑鍙互浣跨敤 @${userName} 鎻愰啋鐢ㄦ埛銆?2. **涓€х鍚?* - 绠€鐭簿鐐硷紝绗﹀悎瑙掕壊姘旇川锛?0瀛椾互鍐咃級
3. **鑳屾櫙鍥炬彁绀鸿瘝** - 鑻辨枃锛屾弿杩伴€傚悎浣滀负鏈嬪弸鍦堣儗鏅殑椋庢櫙/鍦烘櫙

璇蜂互JSON鏍煎紡杈撳嚭锛?\`\`\`json
{
  "pinnedMoments": [
    {
      "content": "鏈嬪弸鍦堟枃瀛楀唴瀹癸紙鏀寔 @${userName} 鎻愰啋锛?,
      "mentions": [ { "id": "user", "name": "${userName}" } ],
      "imagePrompt": "鑻辨枃鍥剧墖鐢熸垚鎻愮ず璇嶏紙鍙€夛級",
      "imageDescription": "鍥剧墖鎻忚堪锛堝彲閫夛級",
      "html": "HTML鏍煎紡鍐呭锛堝彲閫夛級"
    }
  ],
  "bio": "涓€х鍚?,
  "backgroundPrompt": "鑻辨枃鑳屾櫙鍥炬彁绀鸿瘝"
}
\`\`\`

鐩存帴杈撳嚭JSON锛屼笉瑕佷换浣曢澶栬鏄庛€俙

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await _generateReplyInternal(messages, { name: '涓婚〉鐢熸垚' }, null, { skipVisualContext: true })
        if (result.error) throw new Error(result.content)

        // Parse JSON
        let jsonText = result.content.trim()
        const jsonMatch = jsonText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || jsonText.match(/({[\s\S]*?})/)
        if (jsonMatch) {
            jsonText = jsonMatch[1]
        }

        const profileData = JSON.parse(jsonText)

        // Generate background image
        let backgroundUrl = null
        if (profileData.backgroundPrompt) {
            try {
                backgroundUrl = await generateImage(profileData.backgroundPrompt)
            } catch (e) {
                console.warn('[Profile] Background generation failed:', e)
            }
        }

        // Generate images for pinned moments
        const processedMoments = []
        for (const data of (profileData.pinnedMoments || []).slice(0, 3)) {
            const processed = {
                content: data.content,
                mentions: data.mentions || [],
                images: [],
                imageDescriptions: data.imageDescription ? [data.imageDescription] : [],
                html: data.html || null,
            }

            if (data.imagePrompt) {
                try {
                    const imageUrl = await generateImage(data.imagePrompt)
                    processed.images = [imageUrl]
                } catch (e) {
                    console.warn('[Profile] Moment image generation failed:', e)
                }
            }

            processedMoments.push(processed)
        }

        return {
            pinnedMoments: processedMoments,
            backgroundUrl: backgroundUrl,
            bio: profileData.bio || ''
        }

    } catch (e) {
        console.error('[aiService] generateCompleteProfile failed', e)
        throw e
    }
}
/**
 * Generates a full profile set for a character:
 * 1. Background Image (via prompt generation + image gen)
 * 2. Signature (Status Text)
 * 3. 3 "Pinned" Moments representing their core personality or backstory
 */
export async function generateCharacterProfile(char, userProfile, options = {}) {
    const { customPrompt = '', worldContext = '' } = options
    const settingsStore = useSettingsStore()
    const { apiKey, baseUrl, model } = settingsStore.currentConfig

    const now = new Date()
    const weekDays = ['鏃?, '涓€', '浜?, '涓?, '鍥?, '浜?, '鍏?]
    const currentVirtualTime = `${now.getFullYear()}骞?{now.getMonth() + 1}鏈?{now.getDate()}鏃?${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} 鏄熸湡${weekDays[now.getDay()]}`

    if (!apiKey) throw new Error('璇峰厛閰嶇疆 API Key')

    // 1. Generate Content (Signature + 3 Moments + Background Description)
    const systemPrompt = `You are an expert character profiler. Current system time: ${currentVirtualTime}.
You need to generate a "WeChat Moments Profile" for a specific character based on their persona.
The profile consists of:
1. A short, poetic, or character-typical "Signature" (涓€х鍚?.
2. A prompt for generating a background cover image that fits their vibe.
3. 3 distinct "Moments" (social media posts) that highlight their personality, daily life, or hidden thoughts. These should be worthy of being "Pinned" (缃《).

Character Name: ${char.name}
Character Persona: ${char.prompt || 'Unknown'}
Character Tags/World: ${(char.tags || []).join(', ')}

User (Viewer) Name: ${userProfile.name}

${customPrompt ? `銆怌ustom Generation Rule銆? ${customPrompt}` : ''}
${worldContext ? `銆怶orld Context Reference銆? ${worldContext}` : ''}

Output format must be JSON:
{
  "signature": "string (max 30 chars)",
  "background_prompt": "string (english description for image generator)",
  "moments": [
    {
      "content": "string (main text)",
      "image_description": "string (visual description for image generator)"
    },
    ... (total 3)
  ]
}`

    const response = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Generate the profile for ${char.name}.` }
            ],
            response_format: { type: "json_object" }
        })
    })

    if (!response.ok) {
        throw new Error(`AI API Logic Error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    let parsed
    try {
        parsed = JSON.parse(content)
    } catch (e) {
        // Simple fallback parsing if markdown code blocks exist
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
        else throw new Error('Failed to parse AI response')
    }

    // 2. Generate Images (Parallel)
    // Background
    const bgPrommise = generateImage(parsed.background_prompt || `${char.name} atmospheric background`)

    // Moment Images
    const momentPromises = parsed.moments.map(m => generateImage(m.image_description))

    const [bgUrl, ...momentImages] = await Promise.all([bgPrommise, ...momentPromises])

    // Assemble Result
    return {
        signature: parsed.signature,
        backgroundUrl: bgUrl,
        moments: parsed.moments.map((m, i) => ({
            content: m.content,
            images: [momentImages[i]]
        }))
    }
}
