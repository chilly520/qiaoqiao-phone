import { getActivePinia } from 'pinia'
import { useSettingsStore } from '../stores/settingsStore'
import { useLoggerStore } from '../stores/loggerStore'
import { useStickerStore } from '../stores/stickerStore'
import { useWorldBookStore } from '../stores/worldBookStore'
import { useCalendarStore } from '../stores/calendarStore'
import { useChatStore } from '../stores/chatStore'
import { usePhoneInspectionStore } from '../stores/phoneInspectionStore'

import { useWalletStore } from '../stores/walletStore'
import { weatherService } from './weatherService'
import { batteryMonitor } from './batteryMonitor'

import { SYSTEM_PROMPT_TEMPLATE, CALL_SYSTEM_PROMPT_TEMPLATE, GROUP_MEMBER_GENERATOR_PROMPT } from './ai/prompts'
import { recallOriginalMessages, getMemorySummary } from './memoryLog'
import { RequestQueue } from './ai/requestQueue'

const apiQueue = new RequestQueue(10, 60000); // Strict: 10 requests per 60 seconds as requested by the user

/**
 * 从内容中提取 INNER_VOICE 的 JSON 对象
 * 支持多种格式：
 * 1. [INNER_VOICE]{...}
 * 2. [OFFLINE]...[INNER_VOICE]{...}[/OFFLINE]
 * 3. 直接的 JSON 对象 {...}
 * 4. 转义的 JSON 字符串 \"{...}\"
 */
function extractInnerVoiceJson(content) {
    if (!content) return null
    
    // 尝试 1: 直接匹配 [INNER_VOICE] 标签内的 JSON
    const innerVoiceMatch = content.match(/\[INNER_VOICE\]\s*({[\s\S]*?})\s*(?:\[\/INNER_VOICE\]|$)/i)
    if (innerVoiceMatch) {
        return innerVoiceMatch[1]
    }
    
    // 尝试 2: 匹配转义的 JSON（AI 经常生成这种格式）
    const escapedJsonMatch = content.match(/"status"[\s\S]*?"distance"/i)
    if (escapedJsonMatch) {
        // 提取包含 status 到 distance 的 JSON 片段
        const jsonStart = content.lastIndexOf('{', escapedJsonMatch.index - 50)
        const jsonEnd = content.indexOf('}', escapedJsonMatch.index + 50)
        if (jsonStart !== -1 && jsonEnd !== -1) {
            let jsonStr = content.substring(jsonStart, jsonEnd + 1)
            // 移除转义字符
            jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, '\\n').replace(/\\\\/g, '\\')
            return jsonStr
        }
    }
    
    // 尝试 3: 直接匹配 JSON 对象（没有标签）
    const directJsonMatch = content.match(/\{[^{}]*"status"[^{}]*\}/i)
    if (directJsonMatch) {
        return directJsonMatch[0]
    }
    
    return null
}

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
                        { text: `请为名字叫 ${name} 的人物头像提供一段简短的视觉描述，控制在 15 字以内。重点描述发色、发型、穿着和神态。请以 [DESC: 描述内容] 的格式返回。` },
                        { inline_data: { mime_type: mime, data: data } }
                    ]
                }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
            };
            const sep = targetUrl.includes('?') ? '&' : '?';
            targetUrl = `${targetUrl}${sep}key=${apiKey}`;
            if (!targetUrl.includes(':generateContent')) targetUrl = targetUrl.replace(/\/v1beta\/.*/, '') + `/v1beta/models/${model}:generateContent?key=${apiKey}`;
        } else {
            // OpenAI Compatible Format
            // Ensure endpoint has /chat/completions if it's a proxy
            if (targetUrl && !targetUrl.includes('/chat/completions')) {
                if (targetUrl.endsWith('/v1')) {
                    targetUrl = `${targetUrl}/chat/completions`
                } else if (targetUrl.endsWith('/v1/')) {
                    targetUrl = `${targetUrl}chat/completions`
                } else {
                    targetUrl = targetUrl.endsWith('/') ? `${targetUrl}chat/completions` : `${targetUrl}/chat/completions`
                }
            }

            headers['Authorization'] = `Bearer ${apiKey}`;
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
        // Silently fail for transient network/server issues to avoid clogging the console
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            console.warn(`[AI Vision] Avatar description skipped: AI Server (${endpoint}) is unreachable.`);
        } else {
            console.warn('[AI Vision] Avatar description fail:', e.message);
        }
        return null;
    }
    return null;
}

export async function generateReply(messages, char, abortSignal, options = {}) {
    // Wrapper to use Queue
    return apiQueue.enqueue(_generateReplyInternal, [messages, char, abortSignal, options], abortSignal);
}

/**
 * Generates a preview of the full context that WOULD be sent to the AI.
 * Used for the "Token Stats > Context Details" feature.
 * Does NOT generate a reply or call the API.
 */
export function generateContextPreview(chatId, char) {
    const stickerStore = useStickerStore()
    const settingsStore = useSettingsStore()
    // Use Pinia instance retrieval to completely avoid circular import of momentsStore.js
    let momentsStore = null
    try {
        const pinia = getActivePinia()
        if (pinia) {
            momentsStore = pinia._s.get('moments')
        }
    } catch (e) {
        console.warn('[AI Service] MomentsStore retrieval failed:', e)
    }
    let worldBookStore = null
    try {
        worldBookStore = useWorldBookStore()
    } catch (e) {
        console.warn('[AI Service] WorldBookStore init failed:', e)
    }

    let chatStore = null
    try {
        const pinia = getActivePinia()
        if (pinia) {
            chatStore = pinia._s.get('chat')
        }
    } catch (e) {
        console.warn('[AI Service] ChatStore retrieval failed:', e)
    }

    // --- Core Memory Interoperability Logic ---
    let linkedGroupMemory = ''
    if (chatStore) {
        const memoryParts = []
        if (char.groupMemoryIntero && char.linkedGroups) {
            char.linkedGroups.forEach(gid => {
                const gChat = chatStore.chats[gid]
                if (gChat && gChat.isGroup) {
                    const limit = (char.groupMemoryLimits && char.groupMemoryLimits[gid]) || 20
                    const gMemArray = gChat.memory || []
                    const relevantMems = gMemArray.slice(0, limit)
                    if (relevantMems.length > 0) {
                        const groupTitle = `【群聊: ${gChat.name} 的记忆碎片】`
                        const groupText = relevantMems.map(m => {
                            const content = typeof m === 'object' ? (m.content || JSON.stringify(m)) : m
                            return `- ${content}`
                        }).join('\n')
                        memoryParts.push(`${groupTitle}\n${groupText}`)
                    }
                }
            })
        }

        if (char.isGroup && Array.isArray(char.participants)) {
            char.participants.forEach(p => {
                if (p.id !== 'user' && p.privateMemoryIntero) {
                    const pChat = chatStore.chats[p.id]
                    if (pChat && Array.isArray(pChat.msgs)) {
                        const limit = p.privateMemoryLimit || 20
                        const pMsgs = pChat.msgs.filter(m => m.type !== 'system' && m.type !== 'favorite_card').slice(-limit)
                        if (pMsgs.length > 0) {
                            const title = `【成员: ${p.name} 与你的近期私聊记录】`
                            const text = pMsgs.map(m => {
                                const sender = m.role === 'user' ? (char.groupSettings?.myNickname || char.userName || '我') : p.name
                                const content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content
                                const cleanContent = String(content).replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim()
                                return `${sender}: ${cleanContent}`
                            }).join('\n')
                            memoryParts.push(`${title}\n${text}`)
                        }
                    }
                }
            })
        }
        linkedGroupMemory = memoryParts.join('\n\n')
    }
    // 1. System Prompt (Base) - Reusing Template Logic with placeholders
    // We don't have the exact user object here usually, but we have char.userName/Persona
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
    // World Book: 常驻 + 关键词触发扫描（与 _generateReplyInternal 逻辑一致）
    const limit = char.contextLimit || 20
    const recentMsgs = (char.msgs || []).slice(-limit)
    const combinedText = recentMsgs.map(m => {
        let c = m && m.content ? m.content : ''
        return typeof c === 'string' ? c : JSON.stringify(c)
    }).join('\n')
    const lowerCombinedText = combinedText.toLowerCase()
    const activeBookIds = char.worldBookLinks || char.tags || []
    let activeEntries = []
    if (activeBookIds.length > 0 && worldBookStore && worldBookStore.books) {
        const allEntries = worldBookStore.books.flatMap(b => (b && b.entries) ? b.entries : [])
        const boundEntries = allEntries.filter(e => e && e.id && activeBookIds.includes(e.id))
        boundEntries.forEach(entry => {
            if (!entry) return
            const normalizedKeys = Array.isArray(entry.keys)
                ? entry.keys
                : (typeof entry.keys === 'string' ? entry.keys.split(/[\s,，]+/).filter(k => k && k.trim()) : [])
            if (!normalizedKeys || normalizedKeys.length === 0) {
                activeEntries.push({ entry, type: '常驻' })
                return
            }
            const isHit = normalizedKeys.some(key => {
                if (!key) return false
                return lowerCombinedText.includes(String(key).toLowerCase())
            })
            if (isHit) {
                activeEntries.push({ entry, type: '触发' })
            }
        })
    }
    // ... 现有代码保留 ...
    if (activeEntries.length === 0 && worldBookStore && typeof worldBookStore.loadEntries === 'function') {
        worldBookStore.loadEntries().then(() => {
            console.log('[AI Service] World book entries loaded in background')
        })
    }
    const worldInfoText = activeEntries.length > 0
        ? activeEntries.map(({ entry, type }) => `[${type}] ${entry.name || '未命名'}: ${entry.content || ''}`).join('\n')
        : '（未触发关键词）'
    // Memory
    let memoryText = ''
    if (char.memory && Array.isArray(char.memory)) {
        memoryText = char.memory.map(m => (typeof m === 'object' ? m.content : m)).join('\n')
    }
    // Pat Settings
    const patSettings = { action: char.patAction, suffix: char.patSuffix }
    // Location Context — 优先使用角色独立城市映射，回退到全局配置
    const charLocation = char.locationSync ? (char.charLocation || null) : null
    const locationContext = char.locationSync
        ? weatherService.getLocationContextText(charLocation)
        : ''
        
    // 读取用户位置：优先读取角色独立位置，其次读取全局用户位置，最后读取虚拟地点
    const userLoc = char.userLocation || char.bio?.location || settingsStore.weather?.userLocation || settingsStore.weather?.virtualLocation || {}
    console.log('[AI Service] 用户位置数据源检查:', {
        'char.userLocation': char.userLocation,
        'char.bio?.location': char.bio?.location,
        'settingsStore.weather?.userLocation': settingsStore.weather?.userLocation,
        'settingsStore.weather?.virtualLocation': settingsStore.weather?.virtualLocation,
        '最终 userLoc': userLoc
    })
        
    let locationName = '未知';
    // 兼容字符串格式的位置和对象格式的位置
    if (typeof userLoc === 'string' && userLoc.trim()) {
        locationName = userLoc.trim();
    } else if (typeof userLoc === 'object' && userLoc !== null) {
        locationName = userLoc?.name?.trim() || '未知';
    }
        
    console.log('[AI Service] 解析后的位置名称:', locationName)
        
    // 严谨校验坐标有效性
    const hasValidCoords = typeof userLoc === 'object' && userLoc !== null && userLoc?.coords?.lat != null && userLoc?.coords?.lng != null;
    const coordsText = hasValidCoords ? ` (坐标：${userLoc.coords.lat}, ${userLoc.coords.lng})` : '';
    // 最终文本
    const userLocText = `\n【用户位置】${locationName}${coordsText}`;
    const batteryInfo = batteryMonitor.getBatteryInfo()
    const batteryContext = batteryInfo
        ? `\n【手机电量】${batteryInfo.level}%${batteryInfo.charging ? ' (正在充电)' : ''}${batteryInfo.isLow ? ' (电量告急)' : ''}`
        : ''
    const finalEnvContext = locationContext + userLocText + batteryContext
    // 2. Persona Context
    const personaContext = `
【角色设定】
姓名：${char.name}
性别：
描述：
【用户设定】
姓名：
性别：
人设：
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
            content += `\n\n【系统提示：当前时间为 ${currentVirtualTime}，距离双方上一次互动时间为 ${timeStr}。请根据时长和当前时间段，在回复中表现出合理的反应。】`;
        }
        // 修复角色名称显示：添加多重后备值
        const speakerName = m.role === 'user' 
            ? (char.userName || settingsStore?.personalization?.userProfile?.name || '用户')
            : (char.name || char.remark || '对方')
        return `${speakerName}: ${content}`
    }).join('\n')
    // 5. Summary
    let summaryText = ''
    if (char.memory && Array.isArray(char.memory) && char.memory.length > 0) {
        summaryText = char.memory.map(m => (typeof m === 'object' ? m.content : m)).join('\n')
    } else {
        summaryText = char.summary || '（暂无自动总结）'
    }
    // Update system prompt with fresh virtual time for accurate preview
    const charWithTime = { ...char, virtualTime: currentVirtualTime }

    // ========== 核心修改：复用prompts.js统一模板，彻底解决代码重复 ==========
    // 严格按照模板参数顺序传参，和实际AI调用逻辑100%一致
    const groupCtxPreview = char.isGroup ? {
        isGroup: true,
        settings: char.groupSettings || {},
        participants: char.participants || []
    } : null;

    const contactListStr = chatStore ? chatStore.contactList.filter(c => !c.isGroup).slice(0, 30).map(c => `- ${c.name} (ID: ${c.id})`).join('\n') : ''

    const simplifiedSystemPrompt = SYSTEM_PROMPT_TEMPLATE(
        charWithTime,
        userForSystem,
        stickers,
        worldInfoText,
        memoryText,
        patSettings,
        finalEnvContext,
        momentsContext,
        char.bio,
        groupCtxPreview,
        linkedGroupMemory,
        contactListStr
    );

    return {
        system: simplifiedSystemPrompt,
        persona: personaContext,
        worldBook: worldInfoText || '（未触发关键词）',
        moments: momentsContext,
        history: historyText,
        summary: summaryText
    }
}

// Renamed original generateReply to _generateReplyInternal
async function _generateReplyInternal(messages, char, signal, options = {}) {
    const { isCommandTask, isSimpleTask, isCall } = options
    // Debug: Print message IDs
    console.log('[aiService] Incoming messages:');
    (messages || []).forEach((m, idx) => {
        console.log(`  [${idx}] role=${m.role}, hasImage=${!!m.image}, id=${m.id}`);
    });

    const settingsStore = useSettingsStore()
    const stickerStore = useStickerStore()

    // 获取所有可用表情包 (全局 + 当前角色)
    const globalStickers = stickerStore.getStickers('global')
    // Attempt to get ID from char object (Chat object)
    const charId = char.id || char.uuid || char.charId
    const charStickers = charId ? stickerStore.getStickers(charId, char.emojis || []) : []
    let memoryText = ''

    if (charId && !isSimpleTask && !isCommandTask) {
        const lastUserMsg = [...(messages || [])].reverse().find(m => m.role === 'user')
        if (lastUserMsg?.content) {
            const recallResult = await recallOriginalMessages(charId, String(lastUserMsg.content))
            if (recallResult) {
                lastUserMsg.content += recallResult
            }
        }
        const memorySummary = getMemorySummary(charId)
        if (memorySummary) {
            memoryText = memorySummary
        }
    }

    // Merge valid stickers and filter empty names
    const availableStickers = [
        ...(globalStickers || []),
        ...(charStickers || [])
    ].filter(s => s && s.name)
    
    console.log('[aiService] 表情包库:', {
        globalCount: globalStickers?.length || 0,
        charCount: charStickers?.length || 0,
        totalCount: availableStickers.length,
        stickers: availableStickers.map(s => s.name)
    })

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
    // Ensure entries are loaded properly
    try {
        if (worldBookStore && !worldBookStore.isLoaded) {
            await worldBookStore.ensureLoaded()
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

            const rawContextText = (messages || []).map(m => {
                let c = m && m.content ? m.content : ''
                if (m && m.type === 'gift' && m.giftId) {
                    c = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
                }
                return typeof c === 'string' ? c : JSON.stringify(c)
            }).join('\n')
            const contextText = rawContextText.replace(/\[(?:ONLINE|OFFLINE)\][\s\S]*?\[\/(?:ONLINE|OFFLINE)\]/g, '')
            const lowerContext = contextText.toLowerCase()

            console.log('[WorldBook] 扫描开始:', {
                boundCount: boundEntries.length,
                contextLen: contextText.length,
                contextPreview: contextText.slice(0, 200),
                links: char.worldBookLinks
            })

            boundEntries.forEach(entry => {
                if (!entry) return
                const normalizedKeys = Array.isArray(entry.keys)
                    ? entry.keys
                    : (typeof entry.keys === 'string' ? entry.keys.split(/[\s,，]+/).filter(k => k && k.trim()) : [])
                if (!normalizedKeys || normalizedKeys.length === 0) {
                    activeEntries.push(`[常驻] ${entry.name || '未命名'}: ${entry.content || ''} `)
                    console.log('[WorldBook] 常驻:', entry.name)
                    return
                }
                const isHit = normalizedKeys.some(key => {
                    if (!key) return false
                    return lowerContext.includes(String(key).toLowerCase())
                })
                console.log('[WorldBook] 关键词检测:', entry.name, { keys: normalizedKeys, isHit })
                if (isHit) {
                    activeEntries.push(`[触发] ${entry.name || '未命名'}: ${entry.content || ''} `)
                }
            })

            console.log('[WorldBook] 扫描结果:', { constant: activeEntries.filter(e => e.includes('[常驻]')).length, triggered: activeEntries.filter(e => e.includes('[触发]')).length })

            if (activeEntries.length > 0) {
                worldInfoText = activeEntries.join('\n\n')
            }
        } catch (e) {
            if (logger) logger.addLog('ERROR', 'WorldBook logic error', e.message)
        }
    }

    // --- System Prompt Construction ---
    // Dynamic import to avoid circular dependency
    let momentsStore = null
    try {
        const { useMomentsStore } = await import('../stores/momentsStore.js')
        momentsStore = useMomentsStore()
    } catch (e) {
        console.warn('[AI Service] MomentsStore dynamic load failed:', e)
    }

    let momentsContext = ''
    if (momentsStore && momentsStore.moments) {
        const formatMoment = (m) => {
            if (!m) return ''
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { hour12: false }) : '未知时间'
            let text = `[时间: ${timeStr}] ${m.authorId === char.id ? char.name : (m.authorName || '用户')}: ${m.content}`
            if (m.imageDescriptions && m.imageDescriptions.length > 0) text += `\n(图片内容: ${m.imageDescriptions.join(', ')})`
            return text
        }
        const charMoments = (momentsStore.moments || []).filter(m => m.authorId === char.id).slice(0, 2)
        const userMoments = (momentsStore.moments || []).filter(m => !m.authorId || m.authorId === 'user').slice(0, 2)
        momentsContext = [...charMoments, ...userMoments].map(formatMoment).join('\n---\n')
    }


    // 构建 System Message
    // Memory Logic
    if (!memoryText && char && char.memory && Array.isArray(char.memory) && char.memory.length > 0) {
        // Take top 10 recent memories
        const recentMemories = char.memory.slice(0, 10)
        memoryText = recentMemories.map(m => {
            const content = typeof m === 'object' ? (m.content || JSON.stringify(m)) : m
            return `- ${content} `
        }).join('\n')
    }

    // 构建 System Message
    // 如果传入的消息中已经包含了 System Prompt (例如朋友圈生成)，则跳过默认模板
    const hasCustomSystem = (messages && messages.length > 0 && messages[0].role === 'system')
    const isProactiveCall = options.isProactiveCall

    let systemMsg = null
    if (isSimpleTask === true) {
        // [FIX] 简单任务模式：只使用 char.prompt，彻底跳过通用角色扮演模板
        // 同时支持 hasCustomSystem 兜底，确保 prompt 不会丢失
        systemMsg = {
            role: 'system',
            content: char.prompt || (hasCustomSystem ? messages[0].content : '你是一个直接完成任务的 AI 助手。不要进行多余的对话或自我介绍，严格按照指令输出结果。')
        }
    } else if (!hasCustomSystem) {
        const patSettings = { action: char.patAction, suffix: char.patSuffix }

        // Environmental Context (Location & Battery)
        const charLocation2 = char.locationSync ? (char.charLocation || null) : null
        const locationContext = char.locationSync
            ? weatherService.getLocationContextText(charLocation2)
            : ''

        // --- Linked Group Memory Retrieval (Memory Interoperability) ---
        let linkedGroupMemory = ''
        try {
            const pinia = getActivePinia()
            const chatStore = pinia ? pinia._s.get('chat') : null
            if (chatStore) {
                const memoryParts = []
                if (char.groupMemoryIntero && char.linkedGroups && Array.isArray(char.linkedGroups)) {
                    char.linkedGroups.forEach(gid => {
                        const gChat = chatStore.chats[gid]
                        if (gChat && gChat.isGroup) {
                            const limit = (char.groupMemoryLimits && char.groupMemoryLimits[gid]) || 20
                            let currentGroupInfo = ''

                            const gMemArray = gChat.memory || []
                            const relevantMems = [...gMemArray].slice(-limit)
                            if (relevantMems.length > 0) {
                                const groupTitle = `【群聊: ${gChat.name} 的记忆碎片】`
                                const groupText = relevantMems.map(m => {
                                    const content = typeof m === 'object' ? (m.content || JSON.stringify(m)) : m
                                    return `- ${content}`
                                }).join('\n')
                                currentGroupInfo += `${groupTitle}\n${groupText}\n`
                            }

                            const msgsArray = gChat.msgs || []
                            const recentMsgs = msgsArray.filter(m => m.type !== 'system' && m.type !== 'favorite_card').slice(-15) // Recent context limit
                            if (recentMsgs.length > 0) {
                                const msgsTitle = `【群聊: ${gChat.name} 近期实际对话】`
                                const msgsText = recentMsgs.map(m => {
                                    let sender = m.groupSpeakerMeta?.name || m.senderName
                                    if (!sender) sender = m.role === 'user' ? (gChat.groupSettings?.myNickname || '我') : '群成员'
                                    let content = typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content)
                                    // Include giftId in context for gift messages
                                    if (m.type === 'gift' && m.giftId) {
                                        content = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
                                    }
                                    // 群聊不需要心声，移除 INNER_VOICE 标签
                                    content = content.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim()
                                    return `${sender}: ${content}`
                                }).join('\n')
                                currentGroupInfo += `\n${msgsTitle}\n${msgsText}\n`
                            }

                            if (currentGroupInfo.trim()) {
                                memoryParts.push(currentGroupInfo.trim())
                            }
                        }
                    })
                }

                if (char.isGroup && Array.isArray(char.participants)) {
                    char.participants.forEach(p => {
                        if (p.id !== 'user' && p.privateMemoryIntero) {
                            const pChat = chatStore.chats[p.id]
                            if (pChat && Array.isArray(pChat.msgs)) {
                                const limit = p.privateMemoryLimit || 20
                                const pMsgs = pChat.msgs.filter(m => m.type !== 'system' && m.type !== 'favorite_card').slice(-limit)
                                if (pMsgs.length > 0) {
                                    const title = `【成员: ${p.name} 与你的近期私聊记录】`
                                    const text = pMsgs.map(m => {
                                        const sender = m.role === 'user' ? (char.groupSettings?.myNickname || '我') : p.name
                                        let content = typeof m.content === 'object' ? JSON.stringify(m.content) : m.content
                                        // Include giftId in context for gift messages
                                        if (m.type === 'gift' && m.giftId) {
                                            content = `[GIFT:${m.giftName || '礼物'}:${m.giftQuantity || 1}:${m.giftNote || ''}](ID:${m.giftId})`
                                        }
                                        // 【关键修改】保留心声内容作为上下文参考，让 AI 知道角色的衣着和所在地
                                        // 直接从内容中提取 JSON 对象，不管外部是否有 [INNER_VOICE] 或 [OFFLINE] 标签
                                        const voiceJson = extractInnerVoiceJson(String(content))
                                        if (voiceJson) {
                                            try {
                                                const voiceObj = typeof voiceJson === 'string' ? JSON.parse(voiceJson) : voiceJson
                                                const statusText = voiceObj.status || voiceObj.state || ''
                                                const outfitText = voiceObj.outfit || voiceObj.着装 || voiceObj.dress || ''
                                                const locationText = voiceObj.location || voiceObj.地点 || ''
                                                
                                                const statusSummary = []
                                                if (statusText) statusSummary.push(`状态：${statusText}`)
                                                if (outfitText) statusSummary.push(`着装：${outfitText}`)
                                                if (locationText) statusSummary.push(`位置：${locationText}`)
                                                
                                                if (statusSummary.length > 0) {
                                                    content = `${content} [角色状态参考：${statusSummary.join('，')}]`
                                                }
                                            } catch (e) {
                                                console.warn('[AI Service] Failed to parse inner voice for context:', e)
                                            }
                                        }
                                        return `${sender}: ${content}`
                                    }).join('\n')
                                    memoryParts.push(`${title}\n${text}`)
                                }
                            }
                        }
                    })
                }
                linkedGroupMemory = memoryParts.join('\n\n')
            }
        } catch (e) {
            console.warn('[AI Service] Failed to link memories:', e)
        }

        const userLoc = char.userLocation || char.bio?.location || settingsStore.weather?.userLocation || settingsStore.weather?.virtualLocation || {}
        console.log('[AI Service - 通话模式] 用户位置数据源检查:', {
            'char.userLocation': char.userLocation,
            'char.bio?.location': char.bio?.location,
            'settingsStore.weather?.userLocation': settingsStore.weather?.userLocation,
            'settingsStore.weather?.virtualLocation': settingsStore.weather?.virtualLocation,
            '最终 userLoc': userLoc
        })
                
        let locName = '未知'
        if (typeof userLoc === 'string' && userLoc.trim()) locName = userLoc.trim()
        else if (userLoc && typeof userLoc === 'object') locName = userLoc.name?.trim() || '未知'
                
        console.log('[AI Service - 通话模式] 解析后的位置名称:', locName)
        
        const userLocText = `\n【用户位置】${locName}` + (userLoc.coords ? ` (坐标：${userLoc.coords.lat}, ${userLoc.coords.lng})` : '')

        // Battery Context
        const batteryInfo = batteryMonitor.getBatteryInfo()
        const batteryContext = batteryInfo
            ? `\n【手机电量】${batteryInfo.level}%${batteryInfo.charging ? ' (正在充电)' : ''}${batteryInfo.isLow ? ' (电量告急)' : ''}`
            : ''

        // Append all to environmental context
        const finalEnvContext = locationContext + userLocText + batteryContext + (char.searchEnabled ? '\n【联网搜索】已开启。' : '')

        // Remove pruning for proactive call to keep identity intact
        const prunedChar = { ...char }

        const chatStore = useChatStore()
        const phoneStore = usePhoneInspectionStore()
        const phoneContext = (phoneStore && char.id) ? phoneStore.getAIPhoneContext(char.id) : ''

        const runtimeGroupCtx = char.isGroup ? {
            isGroup: true,
            settings: char.groupSettings || {},
            participants: (char.participants || []).map(p => {
                // Fetch the specific 'User Persona' configured for this NPC in their private chat
                const privateChat = chatStore?.chats?.[p.id];
                return {
                    ...p,
                    individualUserPersona: privateChat?.userPersona || ''
                };
            })
        } : null;

        const calendarStore = useCalendarStore()
        const calendarContext = char.id ? calendarStore.getAIContextPrompt(char.id) : ''

        const contactListStr = chatStore ? chatStore.contactList.filter(c => !c.isGroup).slice(0, 30).map(c => `- ${c.name} (ID: ${c.id})`).join('\n') : ''

        // 妫€鏌ユ槸鍚﹀浜庣嚎涓嬫ā寮?
        const isOfflineMode = settingsStore.isOfflineMode
        
        let promptContent = options.isCall
            ? CALL_SYSTEM_PROMPT_TEMPLATE(prunedChar, userProfile, worldInfoText, memoryText, finalEnvContext, momentsContext, char.bio)
            : SYSTEM_PROMPT_TEMPLATE(prunedChar, userProfile, availableStickers, worldInfoText, memoryText, patSettings, finalEnvContext, momentsContext, char.bio, runtimeGroupCtx, linkedGroupMemory, contactListStr, calendarContext)
        
        // 线上/线下模式追加提示词
        const forceOffline = options.mode === 'offline' || isOfflineMode
        if (!options.isCall) {
            if (forceOffline) {
                promptContent += '\n\n【重要提示】当前处于线下文游模式，请严格按照【场景 B：线下文游模式】输出。必须使用长段式、小说式、沉浸式描写，重点写环境、动作、氛围和剧情推进；不要模仿线上微信聊天，不要一句一句拆成很多短气泡。'
                if (settingsStore.offlineMode?.enableAIBackground) {
                    promptContent += '\n\n【背景图更新】你可以使用【场景：英文场景描写】指令来更新聊天背景图。例如：【场景：a cozy coffee shop with warm lighting】。当场景发生变化时，使用此指令生成匹配的背景图。'
                }
            } else {
                promptContent += '\n\n【重要提示】当前处于线上微信聊天模式，请严格按照【场景 A：微信聊天】输出。使用短句、口语化表达，保持自然的微信聊天节奏。'
            }
        }

        systemMsg = {
            role: 'system',
            content: promptContent
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
    //
    // SMART VISION STRATEGY:
    // - Find where the LAST assistant (AI) reply is in the conversation
    // - ALL user images AFTER that point = "unseen" → ALWAYS sent to Vision (user just sent them!)
    // - Images BEFORE that point = "already seen by AI" → subject to visionLimit for context saving
    // This way, if you send 5 photos at once, AI sees all 5. After AI replies, they become "old".

    let totalImagesCount = 0
    const visionLimit = 5 // Max historical (already-replied) images to include for context
    const imageRegex = /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:表情包|STICKER)[:：]([^\]]+)\]/gi

    // Find the index of the LAST assistant message — everything after is "new/unseen"
    let lastAssistantIndex = -1
    messages.forEach((msg, idx) => {
        if (msg && msg.role === 'assistant') lastAssistantIndex = idx
    })

    // Collect IDs of all "unseen" user images (images sent AFTER the last AI reply)
    const unseenUserImageIds = new Set()
    messages.forEach((msg, idx) => {
        if (!msg || msg.role !== 'user' || idx <= lastAssistantIndex) return
        // This is a user message after the last AI reply → it's "unseen"
        if (msg.image || (typeof msg.content === 'string' && msg.content.startsWith('data:image/'))) {
            unseenUserImageIds.add(msg.id)
        } else if (typeof msg.content === 'string' && imageRegex.test(msg.content)) {
            unseenUserImageIds.add(msg.id)
            // Reset regex lastIndex since we used test()
            imageRegex.lastIndex = 0
        }
    })

    // Count total images & track which ones are user's
    messages.forEach(msg => {
        if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return

        if (msg.image) {
            totalImagesCount++
            return
        }

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

    console.log(`[aiService Vision] Total images: ${totalImagesCount}, limit: ${visionLimit}, lastAssistantIdx: ${lastAssistantIndex}, unseenImageIds: [...${unseenUserImageIds.size} items]`)

    // The index of the first historical (already-replied) image that should be sent to Vision
    // Unseen images (after last AI reply) bypass this limit entirely
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

            // Include giftId in context for gift messages
            if (msg.type === 'gift' && msg.giftId) {
                content = `[GIFT:${msg.giftName || '礼物'}:${msg.giftQuantity || 1}:${msg.giftNote || ''}](ID:${msg.giftId})`
            }

            // 1. Priority: msg.image property (New standard)
            if (msg.image) {
                // Unseen user images (sent after last AI reply) are ALWAYS sent to Vision
                const isUnseenUserImage = unseenUserImageIds.has(msg.id)
                const isVisionEnabled = isUnseenUserImage || currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    const imageId = msg.id || 'curr';
                    console.log(`[aiService Vision] msg.id=${msg.id}, using imageId=${imageId}`);
                    // Make Image Reference ID more prominent for avatar operations
                    const refText = `【图片ID: ${imageId}】如需更换头像，请使用: [更换头像:${imageId}]`;

                    // Resolve to B64 if remote
                    const imgUrl = (msg.image.startsWith('http')) ? (await resolveToBase64(msg.image) || msg.image) : msg.image;

                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: `${refText}${content ? '\n' + content : ''}` },
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
                // Unseen user images are ALWAYS sent to Vision
                const isUnseenUserImage = unseenUserImageIds.has(msg.id)
                const isVisionEnabled = isUnseenUserImage || currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    const imageId = msg.id || 'curr';
                    const refText = `【图片ID: ${imageId}】如需更换头像，请使用: [更换头像:${imageId}]`;

                    formattedMessages.push({
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: refText },
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
                            { type: 'text', text: msg.role === 'user' ? `（用户发送了表情包 ${matchedSticker.name}）` : `[表情包:${matchedSticker.name}]` },
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
                        contentParts.push({ type: 'text', text: ` 【图片ID: ${imageId}】如需更换头像，请使用: [更换头像:${imageId}]` });
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
                formattedMessages.push({ role: msg.role, content: contentParts })
            } else {
                formattedMessages.push(msg)
            }
        } else if (msg.role === 'system') {
            // [FIX] 濡傛灉宸茬粡鏈変簡 systemMsg (鐗瑰埆鏄?SimpleTask 妯″紡)锛屽垯蹇界暐娑堟伅鏁扮粍涓殑 system 娑堟伅锛岄槻姝㈤噸澶?
            if (!systemMsg) {
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

    if ((isImage(userAvatar) || isImage(charAvatar)) && !options.isSimpleTask) {
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
                temperature: Number(temperature) || 0.45,
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

        // Handle all system messages for any model
        finalMessages = finalMessages.map(msg => {
            if (msg.role === 'system') {
                // [FIX] 避免 [System Instructions] 倍增：先检查是否已经存在
                const content = msg.content.startsWith('[System Instructions]') ? msg.content : `[System Instructions]\n${msg.content}`;
                return { ...msg, role: 'user', content: content };
            }
            return msg;
        });

        if (isGeminiModel) {
            // [FIX] Ensure first message has correct prefix after map
            if (finalMessages.length > 0 && !finalMessages[0].content.startsWith('[System Instructions]')) {
                finalMessages[0].content = `[System Instructions]\n${finalMessages[0].content}`;
            }

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


        // Ensure all messages have valid roles before sending to API
        finalMessages = finalMessages.map(msg => {
            // Only use roles that the API accepts
            if (msg.role !== 'user' && msg.role !== 'assistant') {
                return { ...msg, role: 'user' };
            }
            return msg;
        });

        reqBody = {
            model: model,
            messages: finalMessages,
            temperature: Number(temperature) || 0.7,
            max_tokens: safeMaxTokens,
            stream: !!options.onChunk,
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
        hasCustomSystem: fullMessages && fullMessages.length > 0 && fullMessages[0].role === 'system'
    })

    try {
        if (model.toLowerCase().includes('gemini')) {
            // Gemini (native) json format
            // [FIX] If the prompt uses [LS_JSON: tags, we must NOT enable strict JSON mode as it conflicts
            if (fullMessages && fullMessages.length > 0 && fullMessages[0].content.includes('JSON') && !fullMessages[0].content.includes('[LS_JSON')) {
                reqBody.generationConfig = { response_mime_type: "application/json" };
            }
        } else {
            // OpenAI compatible json object mode
            if (fullMessages && fullMessages.length > 0 && fullMessages[0].content.includes('JSON') && !fullMessages[0].content.includes('[LS_JSON')) {
                reqBody.response_format = { type: "json_object" };
            }
        }

        console.log(`[AI Request] (${provider})`, { endpoint, model, msgCount: fullMessages ? fullMessages.length : 0 })

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(reqBody)
        })

        let data;

        if (reqBody.stream && response.ok) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullContent = "";
            let done = false;

            try {
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) {
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const dataStr = line.replace(/^data: /, "").trim();
                                if (dataStr === "[DONE]") break;
                                try {
                                    const json = JSON.parse(dataStr);
                                    const delta = json.choices?.[0]?.delta?.content || "";
                                    if (delta) {
                                        fullContent += delta;
                                        if (options.onChunk) options.onChunk(delta, fullContent);
                                    }
                                } catch (e) { /* ignore partial json */ }
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.warn('[Stream Error] Connection interrupted, using partial content:', fullContent);
                // Continue with whatever we got
            }
            
            // Create a mock data object for the rest of the parsing pipeline
            data = {
                choices: [{
                    message: { content: fullContent },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 0 }
            };
        } else if (response.ok) {
            data = await response.json().catch(() => null);
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
        if (!data) throw new Error('API 响应数据为空或解析失败')

        // Log Full Response (Success)
        useLoggerStore().addLog('AI', 'AI响应 (Response)', data)

        // Robust Parsing: Support OpenAI 'choices' and Google 'candidates'
        let rawContent = ''

        if (data.choices && data.choices.length > 0) {
            const message = data.choices[0].message;
            rawContent = message?.content || '';

            // Fallback: If content is empty but tool_calls exist (likely thinking/search)
            if (!rawContent && message?.tool_calls && message.tool_calls.length > 0) {
                const thoughtCall = message.tool_calls.find(tc =>
                    tc.function?.name === 'thought' ||
                    tc.function?.name === 'search' ||
                    tc.type === 'thought'
                );
                if (thoughtCall) {
                    try {
                        const args = JSON.parse(thoughtCall.function.arguments);
                        rawContent = args.thought || args.query || args.thinking || '';
                    } catch (e) {
                        rawContent = thoughtCall.function?.arguments || '';
                    }
                }
            }
        } else if (data.candidates && data.candidates.length > 0) {
            // Google/Gemini Format
            const contents = data.candidates[0].content || {};
            const parts = contents.parts || [];

            // Check for text parts
            const textPart = parts.find(p => p.text);
            if (textPart) {
                rawContent = textPart.text;
            } else {
                // Check for reasoning/thought parts (Gemini 2.0 Thinking)
                const thoughtPart = parts.find(p => p.thought || p.reasoning_content);
                if (thoughtPart) {
                    rawContent = thoughtPart.thought || thoughtPart.reasoning_content;
                }
            }
        }

        // Deep Debugging for Empty Content
        if (!rawContent) {
            useLoggerStore().addLog('WARN', 'AI 返回内容为空', data)
            // Check for safety/finish reason
            const finishReason = data.choices?.[0]?.finish_reason || data.candidates?.[0]?.finishReason
            if (finishReason === 'safety' || finishReason === 'content_filter') {
                return {
                    error: '内容被 AI 安全策略拦截 (Safety Filter)',
                    request: {
                        provider,
                        endpoint,
                        headers: reqHeaders,
                        body: reqBody
                    }
                }
            }
            // If it's a tool call we couldn't parse, just say it's processing
            if (data.choices?.[0]?.message?.tool_calls) {
                return { content: '正在思考中...', innerVoice: null, raw: JSON.stringify(data.choices[0].message.tool_calls) }
            }
                    
            // AUTO-RETRY: If empty content, retry once with shorter context
            if (!options.retryAttempt) {
                useLoggerStore().addLog('AI', '⚠️ 空内容自动重试...', { originalData: data })
                        
                // Create a shorter version by reducing character count
                const retryOptions = { ...options, retryAttempt: true }
                if (options.characters && options.characters.length > 3) {
                    // Only use first 3 characters for retry
                    retryOptions.characters = options.characters.slice(0, 3)
                }
                        
                // Recursive retry
                return await _generateReplyInternal(messages, char, signal, retryOptions)
            }
                    
            return {
                error: 'AI 返回了空内容（已重试仍失败）',
                request: {
                    provider,
                    endpoint,
                    headers: reqHeaders,
                    body: reqBody
                }
            }
        }

        // --- Call Protocol Enforcement (Aggressive Extraction) ---
        if (options.isCall && rawContent) {
            // Find the deepest/last JSON block that contains 'speech'
            const jsonBlocks = [...rawContent.matchAll(/\{[\s\S]*?\}/g)];
            for (let i = jsonBlocks.length - 1; i >= 0; i--) {
                const block = jsonBlocks[i][0];
                if (block.includes('"speech"') || block.includes('"status"') || block.includes('"action"')) {
                    rawContent = `[CALL_START]\n${block}\n[CALL_END]`;
                    console.log('[AI Service] Call Protocol: Extracted and wrapped JSON block');
                    break;
                }
            }
        }

        // Log Token Usage
        if (data.usage) {
            const total = data.usage.total_tokens
            useLoggerStore().addLog(total > 50000 ? 'WARN' : 'INFO', `Token Usage: ${total} `, data.usage)
        }

        // ========== 【长记忆检索 RAG-lite】==========
        const searchPattern = /\[\s*SEARCH\s*\]([\s\S]*?)\[\s*\/\s*SEARCH\s*\]/i
        const searchMatch = rawContent.match(searchPattern)

        if (searchMatch && !options._isSearchRetry) { // Prevent infinite loops
            console.log('[AI Service] AI Requested History Search!')
            try {
                const searchArgs = JSON.parse(searchMatch[1].trim())
                useLoggerStore().addLog('INFO', 'AI触发了记忆检索', searchArgs)

                // 1. Perform local search
                const store = useChatStore()
                const searchResults = store.searchHistory(char.id, searchArgs) 

                // 2. Build injection block
                let searchInjection = `\n\n【系统提示：您刚才发起了记忆检索，以下是本地数据库中找到的关联聊天记录，请结合以下记忆重新回答用户。】\n`
                if (searchResults && searchResults.length > 0) {
                    searchInjection += searchResults.join('\n\n---\n\n')
                } else {
                    searchInjection += `(未找到关于 ${searchArgs.keyword || searchArgs.date} 的记录)`
                }

                // 3. Inject and Retry (Self-Correction Loop)
                useLoggerStore().addLog('INFO', 'AI触发了记忆检索', searchArgs)
                const newMessages = [...messages]
                newMessages.push({ role: 'assistant', content: searchMatch[0] }) // Pushed its search invocation
                newMessages.push({ role: 'system', content: searchInjection }) // Pushed the system's reply to the invocation

                // Recursive call (must set a flag to prevent loops)
                return await _generateReplyInternal(newMessages, char, signal, { ...options, _isSearchRetry: true })

            } catch (searchErr) {
                console.error('[AI Service] Search parsing failed:', searchErr)
                useLoggerStore().addLog('WARN', 'AI记忆检索指令解析失败', searchErr.message)
                // Fallthrough and strip the broken search tag so it doesn't show in UI
                rawContent = rawContent.replace(searchPattern, '').trim()
            }
        } else if (searchMatch && options._isSearchRetry) {
            // Second retry also contained a search, strip it to prevent loop
            rawContent = rawContent.replace(searchPattern, '').trim()
        }


        // ========== 【终极修复版】心声提取逻辑（完美支持嵌套JSON，不认标签只认内容） ==========
        let content = rawContent
        let innerVoice = null

        // [SKIP PROCESSING] Special flag for data-only requests (like generating members/summaries)
        if (options.skipProcessing) {
            console.log('[AI Service] skipProcessing enabled - returning raw content');
            content = content.replace(/<reasoning_content>[\s\S]*?<\/reasoning_content>/gi, '').trim()
            return {
                content,
                innerVoice: null,
                raw: rawContent,
                request: { provider, endpoint, headers: reqHeaders, body: reqBody }
            }
        }

        const isCallProtocol = content.includes('[CALL_START]') && content.includes('[CALL_END]')

        /**
         * 心声提取 v3
         * 策略 A: JSON.parse  — AI 通常输出标准 JSON，直接解析最可靠
         * 策略 B: 字段级正则  — JSON 格式不合法时的兜底
         */
        function tryExtractInnerVoice(text) {
            const result = {};
            let foundCount = 0;

            // ====== 预处理：还原转义字符 ======
            if (text.includes('\\"') || text.includes('\\n')) {
                text = text
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, '\n')
                    .replace(/\\t/g, '  ')
            }

            // ====== 策略 A：整体 JSON.parse（最高优先级）======
            // 用平衡括号法找到最外层 {} 块
            const firstBrace = text.indexOf('{');
            if (firstBrace !== -1) {
                let depth = 0;
                let endIdx = -1;
                for (let i = firstBrace; i < text.length; i++) {
                    if (text[i] === '{') depth++;
                    else if (text[i] === '}') {
                        depth--;
                        if (depth === 0) { endIdx = i + 1; break; }
                    }
                }
                if (endIdx > firstBrace + 1) {
                    try {
                        const parsed = JSON.parse(text.substring(firstBrace, endIdx));
                        // 确认是心声 JSON（含已知中文字段或 stats/status）
                        const knownKeys = ['status', '心声', '着装', '环境', '行为', 'stats'];
                        if (knownKeys.some(k => parsed[k] !== undefined)) {
                            console.log('[AI Service] 心声 JSON.parse 成功', Object.keys(parsed));
                            return parsed; // ✅ 直接返回，无需正则
                        }
                    } catch (e) {
                        console.log('[AI Service] JSON.parse 失败，回落到字段正则', e.message?.substring(0, 80));
                    }
                }
            }

            // ====== 策略 B：字段级正则（兜底）======

            // 裸露英文 stats 子字段检测
            const nakedStatsPattern = /(?:^|\n)\s*["']?(spirit|mood|heartRate|distance|location|energy|stress|intimacy|trust|temperature)["']?\s*[:：][ \t]*[\s\S]*?(?=\n\s*["']?(?:spirit|mood|heartRate|distance|location|energy|stress|intimacy|trust|temperature|status|stats|emotion|speech|action|behavior|outfit|environment|mind|thought)["']?\s*[:：]|\n\s*[\/\[{"']|$)/gi;
            const nakedStatsMatches = [...text.matchAll(nakedStatsPattern)];
            if (nakedStatsMatches.length >= 2) {
                let statsObj = {};
                let hasNakedStats = false;
                for (const nm of nakedStatsMatches) {
                    try {
                        const fieldName = nm[1];
                        let fieldValue = nm[0].trim().replace(new RegExp(`^\\s*["']?${fieldName}["']?\\s*[:：]\\s*`), '');
                        fieldValue = fieldValue.trim().replace(/[,\}]?\s*$/, '');
                        if ((fieldValue.startsWith('"') && fieldValue.endsWith('"')) ||
                            (fieldValue.startsWith("'") && fieldValue.endsWith("'"))) {
                            fieldValue = fieldValue.slice(1, -1);
                        } else if (/^-?\d+(\.\d+)?$/.test(fieldValue)) {
                            fieldValue = parseFloat(fieldValue);
                        } else if (fieldValue.startsWith('{')) {
                            try { fieldValue = JSON.parse(fieldValue.replace(/,\s*$/, '')); } catch(e) {}
                        }
                        statsObj[fieldName] = fieldValue;
                        hasNakedStats = true;
                    } catch(e) {}
                }
                if (hasNakedStats && Object.keys(statsObj).length >= 2) {
                    result.stats = { ...result.stats, ...statsObj };
                    foundCount++;
                    text = text.replace(nakedStatsPattern, '\n').replace(/\n{2,}/g, '\n').trim();
                }
            }

            // 通用字段提取器：匹配到下一个已知字段名为止，完美兼容多行和内嵌引号
            function extractField(keyRegexStr, sourceText) {
                // 停止词前瞻：匹配到下一个 key，或花括号/字符串结束
                const nextKeyLookahead = `(?:["']?,?\\s*\\n\\s*["']?(?:status|state|心声|心心声|着装|环境|行为|stats|spirit|mood|heartRate|distance|location|energy|stress|intimacy|trust|temperature)["']?\\s*[:：]|["']?\\s*[\\}]+?\\s*$|$)`;
                const regex = new RegExp(`["']?(?:${keyRegexStr})["']?\\s*[:：]\\s*["「]?([\\s\\S]*?)${nextKeyLookahead}`, 'i');
                const match = sourceText.match(regex);
                if (match) {
                    // 清理头尾的多余引号、逗号和换行
                    let val = match[1].trim();
                    val = val.replace(/^["「]/, '').replace(/["」]$/, '');
                    // 再次清理可能的尾部逗号和引号
                    val = val.replace(/[,"\\]+$/, '').trim(); 
                    return val;
                }
                return null;
            }

            const m_status = extractField('status|state', text);
            if (m_status) { result.status = m_status; foundCount++; }

            const m_voice = extractField('心心声|心声', text);
            if (m_voice) { result['心声'] = m_voice; foundCount++; }

            const m_outfit = extractField('着装', text);
            if (m_outfit) { result['着装'] = m_outfit; foundCount++; }

            const m_env = extractField('环境', text);
            if (m_env) { result['环境'] = m_env; foundCount++; }

            const m_action = extractField('行为', text);
            if (m_action) { result['行为'] = m_action; foundCount++; }
            // stats: 支持嵌套JSON的平衡花括号提取（AI返回的 emotion/spirit/mood 都是对象）
            const m6 = text.match(/["']?stats["']?\s*[:：]\s*(\{)/);
            if (m6) {
                const startIdx = text.indexOf('{', m6.index);
                if (startIdx !== -1) {
                    let depth = 0;
                    let endIdx = startIdx;
                    for (let i = startIdx; i < text.length; i++) {
                        if (text[i] === '{') depth++;
                        else if (text[i] === '}') {
                            depth--;
                            if (depth === 0) { endIdx = i + 1; break; }
                        }
                    }
                    if (endIdx > startIdx + 1) {
                        try { result.stats = JSON.parse(text.substring(startIdx, endIdx)); foundCount++; } catch (e) {}
                    }
                }
            }
            return foundCount > 0 ? result : null;
        }

        // ======== 核心提取与无情剥离流程 ========
        if (!isCallProtocol && !isCommandTask && !isSimpleTask) {
            
            // 模式 1: 规范情况，含 [INNER_VOICE] 标签
            const ivPattern = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|ONLINE|OFFLINE|IMAGE|VIDEO|AUDIO|FILE|MOMENT|红包|转账|表情包|图片))|$)/i;
            const ivMatch = content.match(ivPattern);
            if (ivMatch) {
                innerVoice = tryExtractInnerVoice(ivMatch[1]);
                // ⚠️ 无条件剔除标签块，防止由于解析失败导致的原样代码外漏
                content = content.replace(ivMatch[0], '').trim();
                if (innerVoice) {
                    console.log('[AI Service] 心声提取成功（标签模式）', Object.keys(innerVoice));
                } else {
                    console.warn('[AI Service] 心声块存在但解析失败，已将乱码块从聊天内容中移除');
                }
            } else {
                // 模式 2: AI 忘记标签，直接输出裸露的 JSON 对象 `{ "status": ... }`
                const firstBrace = content.indexOf('{');
                if (firstBrace !== -1) {
                    let depth = 0;
                    let endIdx = -1;
                    for (let i = firstBrace; i < content.length; i++) {
                        if (content[i] === '{') depth++;
                        else if (content[i] === '}') {
                            depth--;
                            if (depth === 0) { endIdx = i + 1; break; }
                        }
                    }
                    if (endIdx > firstBrace + 1) {
                        const jsonStr = content.substring(firstBrace, endIdx);
                        const strippedJsonObj = tryExtractInnerVoice(jsonStr);
                        if (strippedJsonObj) {
                            innerVoice = strippedJsonObj;
                            console.log('[AI Service] 心声提取成功（裸露 JSON 对象模式）', Object.keys(innerVoice));
                            // 🎉 既然提取出有效心声，就把这个 JSON 大块从聊天框彻底抹去！
                            content = content.substring(0, firstBrace) + content.substring(endIdx);
                            content = content.trim();
                        }
                    }
                }
            }

            // 模式 3: 漏网之鱼字段扫描（AI 把 stats 或其他字段扔在结构外）
            const supplement = tryExtractInnerVoice(content);
            if (supplement) {
                if (!innerVoice) innerVoice = {};
                for (const [key, val] of Object.entries(supplement)) {
                    if (innerVoice[key] === undefined || innerVoice[key] === null) {
                        innerVoice[key] = val;
                    }
                }
                console.log('[AI Service] 心声补充提取（残兵败将扫描合并）', Object.keys(supplement), '→ 合并后', Object.keys(innerVoice));
            }
            
            // 🗑️ 统一清洁工：拔除哪怕一点点外泄可能存在的残留结构
            // 清理裸露的 stats 块和散落的英文属性行
            content = content.replace(/[\r\n\s]*["']?stats["']?\s*[:：]\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|[^,\n]+)/g, '');
            content = content.replace(/[\r\n\s]*["']?(spirit|mood|heartRate|distance|location|energy|stress|intimacy|trust|temperature)["']?\s*[:：][^\n]*/gi, '');
            
            // 对散落的中文特征属性，进行安全、保守行清理（仅当以"key": "value"开头单独占行时清理）
            const chineseKeys = ['status', 'state', '心声', '心心声', '着装', '环境', '行为'];
            chineseKeys.forEach(key => {
                const garbageReg = new RegExp(`^[\\r\\n\\s]*["']?${key}["']?\\s*[:：]\\s*["「].*?["」]`, 'gm');
                content = content.replace(garbageReg, '');
            });
            content = content.trim();
        }

        // Clean up residual tags from display text
        content = content
            .replace(/\[(\s*)INNER(\s*)_VOICE(\s*)\]/gi, '')
            .replace(/\[(\s*)\/(\s*)INNER(\s*)_VOICE(\s*)\]/gi, '')
            .replace(/^\s*[\r\n]/gm, '')
            .trim();
        if (!content || content.length === 0) content = '\u5598';

        // Fill defaults only for missing extracted fields (preserve real AI output!)
        if (innerVoice && !isCallProtocol && !isCommandTask && !isSimpleTask) {
            const now = new Date();
            innerVoice = {
                status: innerVoice.status || '\u6b63\u5e38\u5bf9\u8bdd',
                '\u7740\u88c5': innerVoice['\u7740\u88c5'] || '\u4e0a\u88c5\uff1a\u65e5\u5e38\u7a7f\u642d \u4e0b\u88c5\uff1a\u4f11\u95f2\u88e4 \u978b\u5b50\uff1a\u5c0f\u767d\u978b \u88c5\u9970\uff1a\u65e0',
                '\u73af\u5883': innerVoice['\u73af\u5883'] || now.toLocaleDateString('zh-CN') + ' \u5ba4\u5185 \u5e38\u6e29 \u5b89\u9759\u73af\u5883',
                '\u5fc3\u58f0': innerVoice['\u5fc3\u58f0'] || '',
                '\u884c\u4e3a': innerVoice['\u884c\u4e3a'] || '\u3010\u7ebf\u4e0a\u3011\u6b63\u62ff\u7740\u624b\u673a\u56de\u590d\u7528\u6237\u7684\u6d88\u606f',
                stats: innerVoice.stats || {
                    date: now.toLocaleDateString('zh-CN'),
                    time: now.toLocaleTimeString('zh-CN', { hour12: false }),
                    emotion: { label: "\u5e73\u9759", value: 60 },
                    spirit: { label: "\u6b63\u5e38", value: 70 },
                    mood: { label: "\u5e73\u7a33", value: 65 },
                    location: "\u672a\u77e5\u5730\u70b9",
                    distance: "\u672a\u77e5\u8ddd\u79bb"
                }
            };
        }
        // ========== 【心声提取v2结束】 ==========


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
            // Example: "娴佸紡鎶楁埅鏂?gemini-2.5-pro-nothinking" -> "gemini-2.5-pro"
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
                    const ivMatch = content.match(/\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|ONLINE|OFFLINE|IMAGE|VIDEO|AUDIO|FILE|MOMENT|红包|转账|表情包|图片))|$)/i)
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

${recentChats ? `銆愭渶杩戣亰澶╄褰?(浣滀负鑳屾櫙鍙傝€冿紝涓嶈鐩存帴澶嶈)銆慭n${recentChats}\n` : ''}

【任务】
1. 发布一条朋友圈动态。可以包含心情感悟、生活趣事、或是想对某人（Chilly）说的话。
2. 强制要求：为新生成的这条动态必定生成 3-8 条评论回复等互动信息和 3-8 个点赞信息，互动者应该包括：
   - 通讯录中的好友
   - 虚构合理的NPC（如同事、同学、邻居、亲戚等）
   - 确保互动多样性，既有现实好友也有虚拟NPC

鍥炲蹇呴』鏄竴涓?JSON 瀵硅薄锛屾牸寮忓涓嬶細
{
  "content": "朋友圈文字内容",
  "location": "地理位置（可选，如：'上海·某某咖啡厅'）",
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
3. 如果涉及到人物形象，系统将强制使用"日漫/少女漫"风格。
4. **🚫 严禁扮演用户**：**绝对禁止**生成任何以用户身份（${options.userProfile?.name || '用户'}）发布的点赞或评论。用户的行为只能由真实用户自己操作，AI 只能生成 NPC 角色的互动。
5. **重要强调**：必须包含虚拟 NPC 的互动，且数量不少于总互动的 30%。
${customPrompt ? `\n【用户自定义指令】\n${customPrompt}` : ''}
${worldContext ? `\n【背景参考】\n${worldContext}` : ''}`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name }, null, { skipVisualContext: true }])
        if (result.error) throw new Error(result.error)

        // Parse the JSON from AI response with robust cleaning
        let jsonStr = result.content.trim()

        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

        // Extract JSON object
        const objectStartIndex = jsonStr.indexOf('{')
        const objectEndIndex = jsonStr.lastIndexOf('}')

        if (objectStartIndex === -1 || objectEndIndex === -1 || objectEndIndex <= objectStartIndex) {
            console.error('[Moment] Cannot find JSON object in response:', jsonStr.substring(0, 500))
            throw new Error('AI Response does not contain a valid JSON object')
        }

        jsonStr = jsonStr.substring(objectStartIndex, objectEndIndex + 1)

        let data
        try {
            data = JSON.parse(jsonStr)
        } catch (parseError) {
            console.error('[Moment] JSON Parse Error:', parseError.message)
            console.error('[Moment] Attempted to parse:', jsonStr.substring(0, 500))
            throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`)
        }

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
    // 全局统一声明表情列表（节省 token）
    const allEmojis = new Set()
       
    const charList = characters.map((c, idx) => {
        const bio = localStorage.getItem(`char_bio_${c.id}`) || ''
        const bioText = bio ? `\n   个人简介/详细背景：${bio}` : ''
   
        // 获取该角色对应的用户设定（如果有）
        const userSpecificName = c.userName || userProfile?.name || '用户'
        const userSpecificPersona = c.userPersona ? `\n   【用户（${userSpecificName}）在此角色剧本中的身份/设定】：${c.userPersona}` : ''
   
        const chatText = c.recentChats ? `\n   最近 15 条聊天碎片：${c.recentChats.substring(0, 1000)}` : ''
        const personalHistoryText = c.personalHistory ? `\n   TA 最近发过：${c.personalHistory}` : ''
   
        // 收集所有表情包（去重），不在每个角色后重复
        if (c.emojis && c.emojis.length > 0) {
            c.emojis.forEach(e => allEmojis.add(e.name))
        }
   
        return `${idx + 1}. 【${c.name}】(ID: ${c.id})
   核心人设：{c.persona.substring(0, 1000)}${bioText}${userSpecificPersona}
   --- 
   当前与用户关系：${c.name} 称呼用户为"${userSpecificName}"${chatText}${personalHistoryText}`
    }).join('\n\n')
       
    // 全局统一声明表情列表（节省 token）
    const globalEmojiList = allEmojis.size > 0
        ? `\n\n【通用表情包池】（所有角色都可使用，格式：[表情包：名字]）\n${Array.from(allEmojis).map(name => `  - "${name}"`).join('\n')}`
        : ''

    const now = new Date()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const currentVirtualTime = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} 星期${weekDays[now.getDay()]}`

    // 2. Build explicit recent history to allow "Ecosystem Interactions"
    const historyText = historicalMoments.length > 0
        ? "\n【最近20条朋友圈现状（请分析后决定是否进行互动，如回复评论、补赞、用户点赞等）】\n" + historicalMoments.map(m => {
            const commentsStr = (m.comments || []).map(c => `   - [评论] ${c.authorName}: ${c.content}`).join('\n')
            const likesStr = (m.likes || []).join(', ')
            return `动态ID: ${m.id}
作者：${m.authorName}
内容: ${m.content}
评论区:
${commentsStr || '   (暂无评论)'}`
        }).join('\n\n')
        : ""

    // Include user's bio and pinned moments if available
    let userContextText = userProfile?.name ? `\n\n【当前用户 (${userProfile.name}) 资料】` : ""
    if (userProfile?.signature) userContextText += `\n个性签名：${userProfile.signature}`
    if (userProfile?.pinnedMoments?.length > 0) {
        userContextText += `\n置顶动态：\n` + userProfile.pinnedMoments.map((m, i) => `${i + 1}. ${m.content}`).join('\n')
    }
    if (userProfile?.persona) userContextText += `\n背景设定：${userProfile.persona}`

    // 3. World Context & Custom Prompt
    const worldBookText = worldContext ? `\n\n【世界观设定 (参考以下信息生成符合设定的内容)】\n${worldContext}` : ""
    const userCustomPrompt = customPrompt ? `\n\n【用户的特别生成要求 (必须严格执行)】\n${customPrompt}` : ""

    const systemPrompt = `你现在是"朋友圈拟真生态引擎"。当前虚拟时间：${currentVirtualTime}。

【⚠️ 核心规则一：多身份用户隔离（最高优先级）】
每个角色都是独立的个体，有自己的社交圈和人际关系。
- 角色A不知道角色B的存在（除非他们在同一个群聊里明确认识）
- 角色A的"用户"和角色B的"用户"是**完全不同的平行世界个体**，即使同名也不认识
- **严禁制造"大杂烩"式社交场景**：不要让所有备选角色在一条动态下互相评论、点赞、@提及
- 每个角色只关注自己的生活和自己的"用户"，其他角色的动态对TA来说是不可见的

【⚠️ 核心规则二：基于真实聊天记录生成内容】
- 你必须仔细阅读每个角色的「最近聊天碎片」，从中提取：
  - TA最近在做什么、聊什么话题、情绪状态如何
  - TA和用户的最新进展（刚认识/热恋中/冷战/日常）
  - 最近发生的具体事件（可以引用！）
- 朋友圈内容必须**反映最近聊天中的真实事件和状态**，不要凭空编造无关内容
- 如果聊天记录显示TA心情不好，就不要发开心的旅游照；如果刚和用户吵架，就不要发秀恩爱的内容

【备选发帖角色】
${charList}
${globalEmojiList}

${worldBookText}

${userCustomPrompt}

${historyText}

${userContextText}

【输出格式要求】必须是一个 JSON 对象，禁止包含任何 ID 作为展示名称。
${"```"}json
{
    "newMoments": [
        {
            "authorId": "选中的角色 ID（如：char_123）",
            "content": "发帖正文内容（自然生活化，可包含 [表情包:名字] 和 @提及）",
            "html": "可选：自定义 HTML 卡片内容（完整 HTML 字符串，包含内联样式）",
            "mentions": ["提及的角色姓名"],
            "location": "地点",
            "imagePrompts": ["英文生图提示词 1", "英文生图提示词 2"],
            "imageDescriptions": ["中文图片描述 1", "中文图片描述 2"],
            "interactions": [
                { "type": "comment", "authorId": "互动者角色 ID", "authorName": "角色姓名", "content": "评论内容", "isVirtual": false },
                { "type": "like", "authorId": "虚拟 NPC 角色 ID", "authorName": "虚拟 NPC 名字", "isVirtual": true }
            ]
        }
    ],
    "ecosystemUpdates": [
        {
            "momentId": "旧动态的ID",
            "newInteractions": [
                { "type": "comment", "authorId": "角色 ID", "authorName": "姓名", "content": "内容", "replyTo": "被回复者姓名", "isVirtual": false },
                { "type": "like", "authorId": "角色ID", "authorName": "姓名", "isVirtual": false }
            ]
        }
    ]
}
${"```"}

【角色互动准则】
1. **角色独立性**：每个角色的朋友圈是TA自己的私人空间。其他备选角色**不应该**出现在TA的动态评论区（除非他们在同一个群聊且明确认识）。
2. **真实好友互动**：凡是备选角色列表中的人，必须使用其对应的 authorId 和 authorName。严禁在展示用的 authorName 中填入 char_xxx 这种内部 ID。
3. **回复逻辑**：如果旧动态下有用户的评论，对应的动态作者角色必须进行回复。
4. **互动来源**：评论和点赞应主要来自该动态作者的**虚拟NPC朋友**（isVirtual: true）。不要让其他备选角色跨圈互动。
5. **强制数量准则**：每生成一条新的动态，【必须】为其生成 3-8 条评论回复等互动信息以及 3-8 个点赞信息，两者缺一不可。
6. **🚫 严禁扮演用户**：**绝对禁止**生成任何以用户身份发布的动态、评论或点赞。用户的行为只能由真实用户自己操作，AI 只能生成 NPC 角色的互动。
7. **🔒 隔离原则（再次强调）**：角色A的动态只能被角色A的虚拟NPC朋友互动。其他备选角色不应参与。

【生成细节指南】
1. **内容源于聊天**：每条动态的文字内容必须与该角色的最近聊天记录相关（引用最近事件、反映当前情绪、延续最近话题）。
2. **多图配比**：根据动态内容决定图片数量（常见配图数为 0, 1, 3, 4, 6, 9）。生活感强的动态建议 3-6 张。
3. **图文契合**：每一张图片的 imagePrompts 都要与 content 紧密相关且风格统一。
4. **表情包融入**：优先使用角色资料中提供的"可用表情包"，格式为 [表情包：名称]。**必须确保名称与提供的列表完全一致**。
5. **@-提及**：仅在评论虚拟NPC朋友时使用@，**禁止@其他备选角色**。
6. **用户身份禁令**：再次强调，严禁在 newMoments 或 ecosystemUpdates 中生成任何 authorName 为全局用户名的互动。所有互动必须来自虚构第三方人物（虚拟NPC）。`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: 'MomentsGenerator' }, null, { skipVisualContext: true }])
        if (!result || result.error) throw new Error(result?.error || 'AI 返回内容为空')

        // Robust content checking
        const rawContent = result.content || ''
        let jsonStr = rawContent.trim()
        if (!jsonStr) throw new Error('AI 返回内容为空串')

        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

        // Try to extract the JSON object or array
        const startBrace = jsonStr.indexOf('{')
        const startBracket = jsonStr.indexOf('[')

        // Find the earlier start marker
        let startIndex = -1
        let endIndex = -1

        if (startBrace !== -1 && (startBracket === -1 || startBrace < startBracket)) {
            startIndex = startBrace
            endIndex = jsonStr.lastIndexOf('}')
        } else if (startBracket !== -1) {
            startIndex = startBracket
            endIndex = jsonStr.lastIndexOf(']')
        }

        if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
            console.error('[Batch Moments] Cannot find JSON container in response:', jsonStr.substring(0, 500))
            throw new Error('AI Response does not contain a valid JSON container')
        }

        jsonStr = jsonStr.substring(startIndex, endIndex + 1)

        let parsedData
        try {
            parsedData = JSON.parse(jsonStr)
        } catch (parseError) {
            console.error('[Batch Moments] JSON Parse Error:', parseError.message)
            console.error('[Batch Moments] Attempted to parse:', jsonStr.substring(0, 1000))
            throw new Error(`Failed to parse AI response as JSON: ${parseError.message} `)
        }

        // Support both old array format and new object format
        let momentsData = []
        let ecosystemUpdates = []

        if (Array.isArray(parsedData)) {
            momentsData = parsedData
        } else if (parsedData.newMoments) {
            momentsData = parsedData.newMoments
            ecosystemUpdates = parsedData.ecosystemUpdates || []
        } else if (parsedData.moments) {
            momentsData = parsedData.moments
            ecosystemUpdates = parsedData.ecosystemUpdates || []
        } else {
            // Safe Fallback: Find the first array property in the object, 
            // or assume it's just the moment data if AI completely ignored the requested structure
            momentsData = Object.values(parsedData).find(v => Array.isArray(v)) || (Array.isArray(parsedData) ? parsedData : [])
            ecosystemUpdates = []
        }

        const processedMoments = []
        for (const moment of momentsData) {
            const authorId = moment.authorId
            if (!authorId) continue


            const processed = {
                authorId: authorId,
                content: moment.content,
                html: moment.html || null,  // ✅ 修复：支持 HTML 卡片内容
                location: moment.location || '',
                images: [],
                imageDescriptions: [],
                mentions: moment.mentions || [],
                interactions: Array.isArray(moment.interactions) ? moment.interactions : []
            }

            // Generate images
            const prompts = moment.imagePrompts || (moment.imagePrompt ? [moment.imagePrompt] : [])
            const descriptions = moment.imageDescriptions || (moment.imageDescription ? [moment.imageDescription] : [])

            console.log('[BatchMoments] 图片描述:', descriptions)
            console.log('[BatchMoments] 图片描述:', descriptions)

            if (prompts.length > 0) {
                const finalPrompts = prompts.slice(0, 9)
                console.log('[BatchMoments] 准备生成', finalPrompts.length, '张图片')
                const results = await Promise.all(finalPrompts.map(p => generateImage(p).catch((e) => {
                    console.error('[BatchMoments] 单张图片生成失败:', p, e)
                    return null
                })))
                processed.images = results.filter(Boolean)
                processed.imageDescriptions = descriptions.slice(0, processed.images.length)
                console.log('[BatchMoments] 实际生成图片数:', processed.images.length)
            } else {
                console.log('[BatchMoments] AI 未返回图片提示词，跳过图片生成')
            }

            // Sanitization
            if (processed.interactions.length > 0) {
                processed.interactions.forEach(interaction => {
                    const userName = userProfile?.name || '用户'
                    if (interaction.replyTo === 'User' || interaction.replyTo === '用户' || interaction.replyTo === '我') {
                        interaction.replyTo = userName
                    }
                    if (interaction.content && interaction.content.includes('User')) {
                        interaction.content = interaction.content.replace(/User/g, userName)
                    }

                    if (interaction.authorId && /^\d+$/.test(interaction.authorId)) {
                        interaction.authorId = null
                    }


                    if (interaction.replyTo) {
                        if (/^\d+$/.test(interaction.replyTo)) {
                            interaction.replyTo = '朋友'
                        }
                    }


                    if (interaction.isVirtual && !interaction.authorId) {
                        interaction.authorId = `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                    }
                })
            }

            processedMoments.push(processed)
        }

        // Sanitize ecosystemUpdates
        if (Array.isArray(ecosystemUpdates)) {
            ecosystemUpdates.forEach(update => {
                if (update.newInteractions) {
                    update.newInteractions.forEach(inter => {
                        const userName = userProfile?.name || '用户'
                        if (inter.replyTo === 'User' || inter.replyTo === '用户' || inter.replyTo === '我') {
                            inter.replyTo = userName
                        }
                        if (inter.replyTo) {
                            if (/^\d+$/.test(inter.replyTo)) {
                                inter.replyTo = '朋友'
                            }
                        }

                        if (inter.isVirtual && !inter.authorId) {
                            inter.authorId = `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                        }
                    })
                }
            })
        }

        return {
            newMoments: processedMoments,
            ecosystemUpdates: ecosystemUpdates
        }

    } catch (e) {
        console.error('[aiService] generateBatchMomentsWithInteractions failed', e)
        throw e
    }
}

async function _persistImageUrl(url) {
    if (!url || url.startsWith('data:')) return url
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(30000) })
        if (!resp.ok) { console.warn('[AI Image] Persist fetch failed, returning raw URL'); return url }
        const blob = await resp.blob()
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
                const base64 = reader.result
                if (base64.length > 500 * 1024) {
                    const img = new Image()
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        const maxDim = 800
                        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
                        canvas.width = Math.round(img.width * scale)
                        canvas.height = Math.round(img.height * scale)
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                        resolve(canvas.toDataURL('image/jpeg', 0.7))
                    }
                    img.onerror = () => resolve(base64)
                    img.src = base64
                } else {
                    resolve(base64)
                }
            }
            reader.onerror = () => { console.warn('[AI Image] FileReader failed, returning raw URL'); resolve(url) }
            reader.readAsDataURL(blob)
        })
    } catch(e) {
        console.warn('[AI Image] Persist conversion failed, using raw URL:', e.message)
        return url
    }
}

/**
 * 统一生图接口 (Supports Pollinations standard, SiliconFlow, and API Key) - QUEUED
 * @param {String} prompt 提示词
 * @param {Object} options 可选参数 { width, height, ... }
 */
export async function generateImage(prompt, options = {}) {
    return await apiQueue.enqueue(_generateImageInternal, [prompt, options]);
}

/**
 * Internal logic for image generation, handled by apiQueue.
 */
async function _generateImageInternal(prompt, options = {}) {
    const { width = 1024, height = 1024 } = options;
    const settingsStore = useSettingsStore()
    // In some contexts (like plain JS files), Pinia might return the raw ref object.
    // We check for .value to be safe, ensuring we get the actual configuration object.
    const drawingVal = settingsStore.drawing?.value || settingsStore.drawing || {}
    let provider = drawingVal.provider || 'pollinations'
    let apiKey = (drawingVal.apiKey || '').trim()
    let model = drawingVal.model || 'flux'

    // REDUNDANT FALLBACK: If store seems empty, try reading directly from localStorage
    if (!apiKey && provider !== 'pollinations') {
        try {
            const raw = localStorage.getItem('qiaoqiao_settings')
            if (raw) {
                const data = JSON.parse(raw)
                if (data.drawing && data.drawing.apiKey) {
                    console.log('[AI Image] Recovered API key/config from raw localStorage')
                    apiKey = data.drawing.apiKey.trim()
                    provider = data.drawing.provider || provider
                    model = data.drawing.model || model
                }
            }
        } catch (e) {
            console.error('[AI Image] LocalStorage fallback failed')
        }
    }

    console.log(`[AI Image] Drawing Triggered - Provider: ${provider}, Model: ${model}, Has Key: ${!!apiKey}`)

    if (provider !== 'pollinations') {
        console.log(`[AI Image] Using Custom Generator API (${provider})...`)
    }

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

    // Extreme negative boosters - EXPLICITLY ban muscles, exposed chest, bad anatomy, wrong age, and unwanted backgrounds
    let negativeBoost = "(beard:1.5), (mustache:1.5), (facial hair:1.5), (stubble:1.4), (old:1.4), (wrinkles:1.3), (muscular:1.8), (bulky:1.8), (thick neck:1.5), (abs:1.8), (exposed chest:1.8), (open shirt:1.5), (pecs:1.8), (bodybuilder:2.0), (buff:1.8), (ugly:1.3), (bad anatomy:1.5), (bad proportions:1.5), (malformed limbs:1.5), (extra limbs:1.5), (missing limbs:1.5), (extra digits:1.5), (fused fingers:1.5), (too many fingers:1.5), (poorly drawn hands:1.5), (poorly drawn face:1.5), (mutation:1.5), (deformed:1.5), (child:1.8), (little girl:1.8), (little boy:1.8), (kid:1.8), (loli:1.8), (shota:1.8), (teenager:1.3), (adolescent:1.3), (flowers background:1.5), (floral background:1.5), (garden background:1.5), (nature background:1.5), (outdoor flowers:1.5), (field of flowers:1.5), (blossom background:1.5), (cherry blossom background:1.5), (rose background:1.5), (worst quality), (low quality), (monochrome), (3d:1.5), (realistic:1.5), (photorealistic:1.5), (thick painting:1.6), (semirealism:1.5), (oil painting:1.5), (sketch), (korean manhwa:1.5)"

    let enhancedPrompt = ""
    // Universal Anime Style Base - Strictly 2D Japanese Anime, counter Kolors' thick-paint default
    const animeStyleBase = "(anime style:1.6), (Japanese anime style:1.5), (light novel illustration:1.4), (clean lineart:1.4), (flat shading:1.3), (2D:1.6), (illustration:1.4), (cel shading:1.3), (pastel colors), (soft lighting), (no thick painting), (no korean manhwa), (no realistic), (no 3D)"
    // Default modern urban/indoor background to avoid flowers
    const defaultBackground = "(modern city background: 1.3), (urban setting: 1.2), (indoor environment: 1.2), (clean simple background: 1.2), (no flowers: 1.5)"

    if (options.isProduct) {
        // Strict E-commerce Product Strategy
        negativeBoost = "(human:1.8), (person:1.8), (people:1.8), (face:1.8), (hands:1.8), (body:1.8), (fingers:1.8), (model:1.8), (ugly:1.3), (worst quality), (low quality), (blurry), (watermark)"
        enhancedPrompt = `masterpiece, highly detailed, professional product photography, (photorealistic:1.5), (realistic:1.5), studio lighting, 8k resolution, crisp focus, (product only:1.5), (no humans:1.8), ${prompt}`
    } else if (isCouple) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${defaultBackground}, ${prompt}, (two distinct individuals), (young adult couple: 1.5), (perfect anatomy: 1.3), (correct proportions: 1.3), (well drawn hands: 1.3), (detailed fingers: 1.2), romantic atmosphere, highly detailed, 18-25 years old`
    } else if (isMale) {
        // STRICT Bishounen aesthetic: slender, elegant, NO muscles, CLOTHED, YOUNG ADULT
        // Force clothing and ban exposed skin unless explicitly requested
        const clothingEnforcement = hasAbs ? "" : "(fully clothed:1.4), (wearing shirt:1.3), (covered chest:1.3), "
        const bodyType = hasAbs ? "(lean athletic build:1.2)" : "(slender elegant build:1.5), (thin:1.3), (no muscles:1.5), (delicate frame:1.3)"
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${defaultBackground}, (beautiful bishounen: 1.6), (pretty boy: 1.4), (young adult man: 1.5), (otome game cg: 1.5), (delicate features: 1.4), (clean shaven: 1.3), (no facial hair: 1.3), ${clothingEnforcement}${bodyType}, (soft expression), (perfect anatomy: 1.3), (correct proportions: 1.3), (well drawn hands: 1.3), (detailed fingers: 1.2), ${prompt}, sharp focus, detailed sparkling eyes, handsome, elegant, 20-25 years old`
    } else if (isFemale || isPerson) {
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${defaultBackground}, (beautiful anime girl: 1.3), (young adult woman: 1.5), (detailed huge eyes), (soft skin), (perfect anatomy: 1.3), (correct proportions: 1.3), (well drawn hands: 1.3), (detailed fingers: 1.2), ${prompt}, sharp focus, vibrant pastel colors, cute, 18-22 years old`
    } else {
        // Fallback also anime
        enhancedPrompt = `masterpiece, best quality, ${animeStyleBase}, ${defaultBackground}, ${prompt}, highly detailed, sharp focus, vibrant colors, clear background`
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
            throw new Error('检测到 Secret Key (sk_)。这类密钥不适合在浏览器直接调用，会被官方拦截。请使用 pk_ 开头的 Publishable Key。')
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

            const url = `https://${host}/${path}/${encodeURIComponent(safePrompt)}?model=${model || 'flux'}&seed=${seed}&width=${width}&height=${height}&nologo=true&key=${apiKey}`

            console.log('[AI Image] Requesting (Sanitized):', url.replace(apiKey, 'REDACTED'))

            // DOUBLE LAYER AUTH: Some Pollinations gateways prefer query param, others prefer header. 
            // We use both for pk_ keys to maximize success.
            // Timeout controller to prevent queue hang
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 45000) 

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            })
            clearTimeout(timeoutId)

            if (!response.ok) {
                const errText = await response.text()

                if (response.status === 401) {
                    throw new Error('密钥校验失败 (401)。这通常意味着你的 pk_ 密钥额度已耗尽，或提示词被拦截。')
                }

                if (response.status === 403 || errText.includes('Turnstile') || errText.includes('token')) {
                    throw new Error('被官方人机验证拦截 (Turnstile 403)。即使带 Key 也可能因 IP 风控失败，建议改用 SiliconFlow。')
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
                    
            // Special handling for AbortError (timeout/network issues)
            if (e.name === 'AbortError' || e.message.includes('aborted')) {
                throw new Error('请求超时，可能是网络不稳定或 API 服务响应过慢。请检查网络后重试。')
            }
                    
            // CRITICAL: Stop falling back to anonymous image.pollinations.ai because it returns the "WE HAVE MOVED" placeholder.
            // We want the user to see the AUTH error so they can fix their key.
            throw new Error(`绘制失败：${e.message}`)
        }
    }

    if (provider === 'siliconflow' || provider === 'flux-api') {
        // SiliconFlow / Flux-API (requires API Key)
        try {
            const baseUrl = provider === 'siliconflow' ? 'https://api.siliconflow.cn/v1' : 'https://api.flux-api.example/v1'
            // Timeout controller: 免费模型响应较慢，延长至 90 秒
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 90000) // 90 秒超时

            console.log('[AI Image] Requesting SiliconFlow:', {
                provider,
                model: model || 'flux-v1',
                prompt: enhancedPrompt.substring(0, 50) + '...',
                timeout: '90s'
            })

            const response = await fetch(`${baseUrl}/images/generations`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model || 'flux-v1',
                    prompt: enhancedPrompt,
                    negative_prompt: negativeBoost,
                    width: width,
                    height: height
                })
            })
            clearTimeout(timeoutId)

            if (!response.ok) {
                const err = await response.text()
                console.error('[AI Image] SiliconFlow API error:', {
                    status: response.status,
                    error: err
                })
                
                // 更友好的错误提示
                if (response.status === 401) {
                    throw new Error('API 密钥无效或已过期，请检查设置中的密钥配置')
                } else if (response.status === 402) {
                    throw new Error('账户余额不足，请充值或更换模型')
                } else if (response.status === 429) {
                    throw new Error('请求过于频繁，请稍后再试')
                } else if (err.includes('quota') || err.includes('balance')) {
                    throw new Error('账户余额不足，请检查 SiliconFlow 账户额度')
                }
                throw new Error(err)
            }

            const data = await response.json()
            console.log('[AI Image] SiliconFlow response:', data)
            const imageUrl = data.images?.[0]?.url || data.data?.[0]?.url || `https://via.placeholder.com/1024?text=GenerationFailed`
            useLoggerStore().addLog('AI', `图片生成成功 (${provider})`, {
                provider,
                hasUrl: !!imageUrl
            })
            return await _persistImageUrl(imageUrl)
        } catch (e) {
            console.error('Drawing API failed:', e)
            useLoggerStore().addLog('ERROR', `图片生成失败 (${provider})`, e.message)
            
            // Special handling for AbortError
            if (e.name === 'AbortError' || e.message.includes('aborted')) {
                throw new Error('请求超时（90 秒），免费模型响应较慢，请检查网络或稍后重试')
            }
            
            throw e
        }
    }

    const result = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`

    return await _persistImageUrl(result)
}

/**
 * 生成朋友圈动态的批量互动（3-5条点赞/评论）
 * 鍖呭惈锛氬凡鏈夎鑹?+ 铏氭嫙NPC锛堜翰鎴氥€佸悓浜嬬瓑锛?
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
        const uName = c.userName || userProfile?.name || '用户'
        const uPersona = c.userPersona ? ` | 用户身份建议: ${c.userPersona}` : ''
        const chatSnippet = c.recentChats ? ` | 最近聊天: ${c.recentChats.substring(0, 300).replace(/\n/g, ' ')}` : ''
        const emojiHint = c.emojis && c.emojis.length > 0 ? ` | 可用表情包(插入格式 [表情包:名字]): ${c.emojis.map(e => e.name).join(', ')}` : ''
        return `${index + 1}. ${c.name}, 人设: ${c.persona.substring(0, 100)}...${uPersona}${emojiHint}${chatSnippet}`
    }).join('\n')

    let userInformation = ""
    if (userProfile.name) {
        userInformation = `\n【当前通用用户（你互动的对象）资料】\n名字: ${userProfile.name}\n`
        if (userProfile.signature) userInformation += `个性签名: ${userProfile.signature}\n`
        userInformation += `背景设定: ${userProfile.persona || '一位普通用户'}\n`
    }

    // 收集所有角色的 customPrompt（如果有）
    const allCustomPrompts = charInfos.map(c => c.customPrompt).filter(Boolean)
    const uniqueCustomPrompt = allCustomPrompts.length > 0 ? allCustomPrompts[0] : ''

    const systemPrompt = `你现在是"朋友圈拟真生态引擎"。
你的任务是为以下动态生成真实的社交互动，包括点赞、评论和回复。

【现有角色及对应用户身份】
${friendsList}
${userInformation}

【当前动态】
作者：${moment.authorName}
内容：${moment.content}
${moment.location ? `地点：${moment.location}` : ''}
${moment.images && moment.images.length > 0 ? `\n【图片信息】共${moment.images.length}张图片。${moment.imageDescriptions ? `图片内容描述：${moment.imageDescriptions}` : '（图片内容需要通过视觉识别，请基于上下文推测）'}` : ''}
${moment.existingComments && moment.existingComments.length > 0 ? `\n【已有评论】\n${moment.existingComments.map((c) => `@${c.authorName}: ${c.content}`).join('\n')}` : ''}

${uniqueCustomPrompt ? `【自定义生成要求】\n${uniqueCustomPrompt}\n` : ''}
【生成规则】
1. 生成 5-15 个点赞，3-8 条评论或回复。
2. 互动语气要符合角色设定和与用户的关系。
3. 内容要简短、自然、口语化，像真实朋友圈互动。
4. 必须包含一部分虚构 NPC 互动，但不要冒充用户本人。
5. 严禁生成 authorName 为 ${userProfile.name} 的互动。

【输出格式】
直接返回 JSON 数组：
[
  { "type": "like", "authorId": "角色ID", "authorName": "显示名称", "isVirtual": false },
  { "type": "comment", "authorId": "角色ID", "authorName": "显示名称", "content": "内容", "isVirtual": false },
  { "type": "reply", "authorId": "角色ID", "authorName": "显示名称", "content": "内容", "replyTo": "被回复者姓名", "isVirtual": false }
]

不要输出 Markdown，不要补充解释。`









    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [[{ role: 'system', content: systemPrompt }], { name: 'System' }, null, { skipVisualContext: true }])
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
                authorId: item.isVirtual ? `virtual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : (item.authorId || charInfos.find(c => c.name === item.authorName)?.id || null)
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
    const uName = charInfo.userName || '用户'
    const uPersona = charInfo.userPersona ? `\n用户在此角色剧本中的设定：${charInfo.userPersona}` : ''

    const systemPrompt = `你现在是【${charInfo.name}】。
你的设定：${charInfo.persona}。${uPersona}
${charInfo.worldContext ? `当前世界背景：${charInfo.worldContext}` : ''}
${historicalContext ? `\n${historicalContext}` : ''}
${charInfo.emojis && charInfo.emojis.length > 0 ? `\n可用表情包（格式 [表情包:名字]）：${charInfo.emojis.map(e => e.name).join(', ')}` : ''}

【任务】
请对【${moment.authorName}】发布的一条朋友圈进行评论。
朋友圈内容：${moment.content}
图片 / 视觉内容：${moment.visualContext || '无图片'}

【要求】
1. 评论要简短、真实、口语化，控制在 20 字以内。
2. 根据你和对方的关系决定语气。
3. 如有历史上下文，可适度承接。
4. 如有图片描述，可以提及画面元素。
5. 可以使用 @名字 提醒特定的人阅读评论。
6. 直接输出评论文字，不要带标签或解释。`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        // Skip visual context to prevent AI from getting distracted by analyzing avatars instead of generating comments
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: charInfo.name }, null, { skipVisualContext: true }])
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
    const uName = charInfo.userName || '用户'
    const uPersona = charInfo.userPersona ? `\n用户在此角色剧本中的身份设定：${charInfo.userPersona}` : ''

    const systemPrompt = `你现在是【${charInfo.name}】。
你的设定：${charInfo.persona}。${uPersona}
${charInfo.worldContext ? `当前世界背景：${charInfo.worldContext}` : ''}
${charInfo.emojis && charInfo.emojis.length > 0 ? `\n可用表情包（格式 [表情包:名字]）：${charInfo.emojis.map(e => e.name).join(', ')}` : ''}

【任务】
你在朋友圈看到了【${targetComment.authorName}】的评论，请针对这条评论进行回复。
朋友圈原文（作者：${moment.authorName}）：${moment.content}
对方的评论：${targetComment.content}

【要求】
1. 回复要简短、口语化，控制在 20 字以内。
2. 回复内容必须符合你与对方的关系和人设。
3. 严禁出现违背背景设定的回应。
4. 可以使用 @名字 提醒阅读。
5. 直接输出回复内容，不要带标签或解释。`

    const messages = [{ role: 'system', content: systemPrompt }]

    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [messages, { name: charInfo.name }, null, { skipVisualContext: true }])
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
    const uPersona = character.userPersona ? `\n我在玩家剧本中的身份设定：${character.userPersona}` : ''
    const { includeMoments, includeSocial, includeArchive } = options;

    const tasks = [];
    if (includeSocial) tasks.push("社交门户 (签名与背景)");
    if (includeArchive) tasks.push("灵魂档案 (底层规格与性格)");
    if (includeMoments) tasks.push("置顶动态 (3条朋友圈)");

    const systemPrompt = `你现在是"角色主页架构师"。
任务：为角色生成以下内容：${tasks.join('、')}。

角色姓名：${character.name}
基础人设：${character.prompt || '无'}${uPersona}

【用户身份说明】
- 微信"我"页面显示的昵称是：${userName}
- 角色设定中的用户称呼也是：${userName}
- 如果生成朋友圈内容，允许在 mentions 中提到用户，但禁止生成用户本人发布的互动

【输出格式】
请严格返回以下 JSON 结构：
{
  ${includeSocial ? `"signature": "个性签名（20 字内）",
  "backgroundPrompt": "英文背景图提示词",` : ''}
  ${includeArchive ? `"bioFields": {
    "occupation": "职业", "gender": "性别", "mbti": "人格代码", "birthday": "生日", "zodiac": "星座",
    "height": "身高", "weight": "体重", "body": "身材描述", "status": "情感/生活状态", "scent": "气味",
    "style": "穿着风格", "hobbies": ["爱好1", "爱好2"], "idealType": "理想型描述", "heartbeatMoment": "心动瞬间描述"
  },` : ''}
  ${includeMoments ? `"pinnedMoments": [
    {
      "comment": "展示角色生活和人设的不同侧面",
      "content": "动态文字内容",
      "mentions": [ { "id": "user", "name": "${userName}" } ],
      "imagePrompt": "英文图片提示词",
      "interactions": [
        { "type": "like", "authorName": "符合背景的路人名" },
        { "type": "comment", "authorName": "符合背景的路人名", "content": "..." }
      ]
    }
  ]` : ''}
}

【重要规则】
1. 如果人设注明孤儿、单亲、父母不在等信息，严禁虚构对应亲属互动。
2. interactions 中的点赞和评论只能来自虚构路人或 NPC，严禁生成用户 ${userName} 本人的互动。
3. 只输出 JSON，不要补充解释。`



    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [[{ role: 'system', content: systemPrompt }], { name: 'System' }, null, { skipVisualContext: true }])
        
        // 增强的 JSON 提取逻辑
        let jsonText = result.content || ''
        
        // 1. 清理 Markdown 代码块
        jsonText = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim()
        
        // 2. 定位最外层的 JSON 对象
        const start = jsonText.indexOf('{')
        const end = jsonText.lastIndexOf('}')
        
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('Invalid JSON: no valid object found')
        }
        
        jsonText = jsonText.substring(start, end + 1)
        
        // 3. 预处理：修复常见的 AI 输出错误
        let data = null
        try {
            data = JSON.parse(jsonText)
        } catch (parseError) {
            // 尝试修复常见问题
            try {
                // 修复末尾逗号
                const fixed = jsonText.replace(/,(\s*[}\]])/g, '$1')
                data = JSON.parse(fixed)
            } catch (e2) {
                // 修复未转义的换行符
                try {
                    const fixed2 = jsonText.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
                    data = JSON.parse(fixed2)
                } catch (e3) {
                    console.error('[aiService] JSON parse failed, raw content:', jsonText.substring(0, 200))
                    throw new Error('Invalid JSON: ' + parseError.message)
                }
            }
        }

        let backgroundUrl = null
        if (includeSocial && data.backgroundPrompt) {
            try { 
                console.log('[Profile Gen] Generating background image...')
                backgroundUrl = await generateImage(data.backgroundPrompt) 
            } catch (e) { 
                console.warn('[Profile Gen] Background image generation failed:', e.message)
                // 不中断整个流程，只是没有背景图
            }
        }

        const processedMoments = []
        if (includeMoments && data.pinnedMoments) {
            for (const mData of data.pinnedMoments.slice(0, 3)) {
                let imgUrl = null
                if (mData.imagePrompt) {
                    try { 
                        console.log('[Profile Gen] Generating moment image...')
                        imgUrl = await generateImage(mData.imagePrompt) 
                    } catch (e) { 
                        console.warn('[Profile Gen] Moment image generation failed:', e.message)
                        // 不中断整个流程，只是没有配图
                    }
                }
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
    const systemPrompt = `你是一名顶级剧本作家和人设设计师。
任务：根据用户提供的主题，为"世界圈"多人 RPG 系统生成一个有灵魂的 NPC 角色。

【当前世界背景】
${loopContext || '通用现代社交场'}

【主题】
${theme}

请生成以下信息，并以 JSON 格式输出：
1. name: 角色姓名
2. gender: 性别
3. age: 表象年龄
4. identity: 核心身份
5. personality: 性格与偏好
6. prompt: 核心 AI 提示词，用于驱动后续对话
7. appearance: 英文外观描述，用于头像生成

JSON 示例：
{

  "name": "...",
  "gender": "...",
  "age": "...",
  "identity": "...",
  "personality": "...",
  "prompt": "...",
  "appearance": "english visual prompt for image generation..."
}
直接输出 JSON，不要补充解释。`


    try {
        const result = await apiQueue.enqueue(_generateReplyInternal, [[{ role: 'system', content: systemPrompt }], { name: 'PersonaManager' }, null, { skipVisualContext: true }])
        if (result.error) throw new Error(result.error)

        const jsonMatch = result.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI Response is not valid JSON')

        return JSON.parse(jsonMatch[0])
    } catch (e) {
        console.error('[aiService] generateCharacterPersona failed', e)
        throw e
    }
}
