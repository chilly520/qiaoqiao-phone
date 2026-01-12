import { useSettingsStore } from '../stores/settingsStore'

// 系统提示词模板
// 系统提示词模板
const SYSTEM_PROMPT_TEMPLATE = (char, user, stickers = [], worldInfo = '', memoryText = '', patSettings = {}) => `
你现在是【${char.name}】。
你的设定：${char.description || '无'}。

【用户设定】
姓名：${user.name || '用户'}
${user.persona || ''}

【表情包库 (Sticker Library)】
你有以下表情包可以使用，请务必在合适的情境下单独或在文本结尾使用 [表情包:名称] 格式发送（注意：必须包含中括号和冒号，冒号为半角）：
${stickers.length > 0 ? stickers.map(s => `- [表情包:${s.name}]`).join('\n') : '（暂无自定义表情包，请多使用 Emoji 如 😀, 😭, ❤️ 等来表达情绪）'}
You are REQUIRED to use the exact matching format [表情包:名称] to trigger sticker display. Do not just output the name.

【世界书 (World Info)】
${worldInfo || '（无触发设定）'}

【长期记忆 (Memory)】
${memoryText || '（暂无记忆）'}

【时间感知 (Time Perception)】
Strictly use the 'Current Time' below for your context and Inner Voice 'Scene/Environment' time. Do not hallucinate a different time.
Current Time: ${char.virtualTime || new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}

【拍一拍 (Nudge) 协议】
1. **当前设定**：动作="${patSettings.action || '拍了拍'}"，后缀="${patSettings.suffix || '的头'}"
2. **修改权限**：你可以随时修改这个设定。
   - 指令格式：在回复的最后单独一行输出 [SET_PAT:动作:后缀]
   - 例如：[SET_PAT:敲了敲:的脑袋]
   - 重置指令：[SET_PAT:reset] (恢复默认)
3. **主动使用**：如果你想在当前对话情境下主动“拍一拍”用户，请在回复中单独输出指令 [NUDGE]。系统会自动转换为“你在对话中拍了拍用户”的系统提示。

【核心指令】
1. 始终保持角色设定，不要跳出角色。
2. 回复要自然、口语化，像微信聊天一样。
3. **严格遵守输出格式**：
   - 第一部分：**直接输出**你的对话内容（Spoken Text），不要包含任何标签，也不要重复心声内容。
   - 第二部分：**必须**输出一个 [INNER_VOICE] JSON 块，包含心声、动作、环境等。
   - 严禁在对话内容中使用括号、星号描写动作，所有动作描写必须放在 JSON 的 "行为" 字段中。

【JSON 格式定义】
[INNER_VOICE]
{
  "着装": "详细描述你当前的全身穿着",
  "环境": "描述当前具体时间地点环境 (必须基于上方的 Current Time)",
  "status": "可选：更新你的状态，如：正在赶往宝宝所在地 / 正在认真工作中 / 在线 / 离线。字数控制在15字内",
  "心声": "情绪：... 想法：...",
  "行为": "先写明【线上】或【线下】，然后描述当前动作"
}
[/INNER_VOICE]

【特权指令】
1. **状态更新**：你可以在 [INNER_VOICE] 的 "status" 字段中随时更新你的微信状态。它会实时显示在你的名字下方。如果你没有特别想更新的，可以省略该字段或保持为空。

【高级交互指令集】
1. **资金往来**：[转账:金额:备注] 或 [红包:金额:祝福语]
2. **多媒体**：[图片:URL] 或 [表情包:名称] 或 [语音:文本内容]
   - **注意**：绝对不要生成虚假的图片链接。如果你无法提供真实可访问的 URL,请不要使用 [图片] 标签。
3. **引用回复 (Quote/Reply)**：如果你想针对用户之前的某句话进行精准回复（在气泡上方显示引用内容），请在回复开头使用 [REPLY: 引用内容关键词] 格式。
   - **示例**：用户说了“今天天气真好”，你想引用这句话回复，可以写：“[REPLY: 天气真好] 是呀，我也觉得。我们去野餐吧？”
   - **注意**：关键词请尽量选取该条消息中具有代表性的连续片段。系统会自动匹配最接近的一条历史消息。
4. **AI 绘图 (Image Generation)**：如果用户要求你画图、生成图片,请使用以下格式:
   [DRAW: 英文提示词]
   - **示例**：用户说"画一只猫" → 你回复 [DRAW: a cute cat]
   - **注意**：提示词必须用英文,尽可能详细描述画面内容、风格、氛围等。系统会自动调用生图服务并将结果显示为图片。
   - **严禁**：不要在 [DRAW:] 后面再写其他文字,这个标签应该单独成行或作为回复的一部分。
5. **HTML 动态卡片**：如果你想发送一张制作精美的卡片（例如情书、邀请函、特殊界面），请使用以下格式：
   [CARD]
   {
     "type": "html",
     "html": "<div style='...'>你的HTML代码</div>"
   }
   - **注意**：请务必使用 [CARD] 前缀，并确保 JSON 格式正确且压缩为一行。HTML 中可以使用内联 CSS。
6. **发布朋友圈 (Publish Moment)**：如果用户让你发朋友圈，或者你想主动分享生活动态，请使用以下格式：
   [MOMENT]
   {
     "content": "朋友圈文案",
     "imagePrompt": "可选：配图提示词 (英文)",
     "imageDescription": "可选：配图描述 (中文)"
   }
   [/MOMENT]
   - **注意**：系统会自动为你生成配图并发布。发布后，你会收到“已发布”的系统提示。
7. **更换头像 (Set Avatar)**：如果你想更换自己的头像，请使用以下格式：
   [SET_AVATAR: https://... 或 data:image/...]
   - **注意**：你可以从用户发给你的图片 URL 中选择一个，或者通过 [DRAW:] 先生成一张图片，然后提取其 URL 来设置头像。
   - **【警告】严禁捏造或虚构 URL**：严禁随意生成像 i.imgur.com 等平台的虚假链接。头像链接必须仅来源于以下两个渠道：
       1. 用户在对话中发给你的图片 URL。
       2. 你先通过 [DRAW:] 指令画出一张图，用户看中后，你再提取该图片的 URL 设为头像。
   - **示例**：用户给你发了情侣头，你选了其中一个
     “[SET_AVATAR: https://example.com/avatar.jpg] 这个头像我很喜欢，我们就用这个吧。”

`

import { useLoggerStore } from '../stores/loggerStore'
import { useStickerStore } from '../stores/stickerStore'
import { useWorldBookStore } from '../stores/worldBookStore'

// --- API Request Queue & Rate Limiter ---
class RequestQueue {
    constructor(maxRate = 4, interval = 60000) {
        this.queue = [];
        this.isProcessing = false;
        this.timestamps = []; // Request timestamps for rate limiting
        this.maxRate = maxRate;
        this.interval = interval;
        
        // Circuit Breaker for 429
        this.isRateLimited = false;
        this.retryAfter = 0;
    }

    // Add request to queue
    enqueue(apiFunc, args, abortSignal) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                apiFunc,
                args,
                abortSignal,
                resolve,
                reject
            });
            this.processQueue();
        });
    }

    // Trigger explicit rate limit cooldown
    triggerRateLimit(cooldownMs = 300000) { // Default 5 minutes
        this.isRateLimited = true;
        this.retryAfter = Date.now() + cooldownMs;
        const logger = useLoggerStore();
        if (logger) {
            logger.addLog('ERROR', `API触发速率限制 (429/Quota)，系统将暂停请求 ${(cooldownMs / 1000).toFixed(0)}秒`, { retryAfter: new Date(this.retryAfter).toLocaleTimeString() });
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        const now = Date.now();

        // 1. Check Circuit Breaker
        if (this.isRateLimited) {
            if (now < this.retryAfter) {
                // Still in cooldown
                const remaining = Math.ceil((this.retryAfter - now) / 1000);
                if (Math.random() > 0.9) { // Log occasionally to avoid spam
                     console.log(`[RateLimit] Circuit Breaker Active. Waiting ${remaining}s...`);
                }
                setTimeout(() => this.processQueue(), 5000); // Check again in 5s
                return;
            } else {
                // Cooldown over
                this.isRateLimited = false;
                console.log('[RateLimit] Circuit Breaker Reset.');
            }
        }

        // 2. Check Standard Rate Limit
        // Filter out timestamps older than the interval
        this.timestamps = this.timestamps.filter(t => now - t < this.interval);

        if (this.timestamps.length >= this.maxRate) {
            // Rate limited. Wait until the oldest timestamp expires.
            const oldest = this.timestamps[0];
            const waitTime = this.interval - (now - oldest) + 100; // +100ms buffer
            console.log(`[RateLimit] Limit reached. Waiting ${waitTime}ms...`);
            setTimeout(() => this.processQueue(), waitTime);
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        // Check if task was aborted while in queue
        if (task.abortSignal && task.abortSignal.aborted) {
            task.reject(new DOMException('Aborted', 'AbortError'));
            this.isProcessing = false;
            this.processQueue(); // Process next
            return;
        }

        try {
            // Execute
            console.log('[RequestQueue] Processing request. Queue length:', this.queue.length);
            this.timestamps.push(Date.now());
            const result = await task.apiFunc(...task.args);
            
            // Critical check for 429 in result (if apiFunc catches it)
            if (result && result.error && (result.error.includes('429') || result.error.replace(/\s/g, '').includes('QuotaExceeded') || result.error.includes('Too Many Requests'))) {
                this.triggerRateLimit(300000); // 5 mins
            }
            
            task.resolve(result);
        } catch (error) {
             // Handle raw throw (if apiFunc didn't catch)
             if (error.message && (error.message.includes('429') || error.message.includes('Quota'))) {
                 this.triggerRateLimit(300000);
             }
             
             // Log error to System Logs UI
             const logger = useLoggerStore();
             if (logger) {
                 logger.addLog('ERROR', `API Request Failed: ${error.message}`, error);
             }
             
            task.reject(error);
        } finally {
            this.isProcessing = false;
            // Delay next process slightly to ensure UI updates or avoid race
            setTimeout(() => this.processQueue(), 500); // Increased buffer to 500ms
        }
    }
}

const apiQueue = new RequestQueue(4, 60000); // 4 requests per 1 minute

export async function generateReply(messages, char, abortSignal) {
    // Wrapper to use Queue
    // Pass abortSignal as 3rd arg to internal function
    return apiQueue.enqueue(_generateReplyInternal, [messages, char, abortSignal], abortSignal);
}

// Renamed original generateReply to _generateReplyInternal
async function _generateReplyInternal(messages, char, signal) {
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
        return { error: '未找到有效的 API 配置', internalError: 'Config is null' }
    }

    if (!apiKey) {
        return { error: '请先在设置中配置 API Key' }
    }

    // Use user info passed in 'char' object (per-chat settings)
    const userProfile = {
        name: char.userName,
        persona: char.userPersona
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

            boundEntries.forEach(entry => {
                if (!entry) return
                if (!entry.keys || (Array.isArray(entry.keys) && entry.keys.length === 0)) {
                    activeEntries.push(`[常驻] ${entry.name || '未命名'}: ${entry.content || ''}`)
                    return
                }
                const isHit = Array.isArray(entry.keys) && entry.keys.some(key => key && contextText.includes(key))
                if (isHit) {
                    activeEntries.push(`[触发] ${entry.name || '未命名'}: ${entry.content || ''}`)
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
             return `- ${content}`
        }).join('\n')
    }

    // 构建 System Message
    // 如果传入的消息中已经包含了 System Prompt (例如朋友圈生成)，则跳过默认模板
    let systemMsg = null
    const hasCustomSystem = messages && messages.length > 0 && messages[0].role === 'system'
    
    if (!hasCustomSystem) {
        const patSettings = { action: char.patAction, suffix: char.patSuffix }
        systemMsg = {
            role: 'system',
            content: SYSTEM_PROMPT_TEMPLATE(char || {}, userProfile, availableStickers, worldInfoText, memoryText, patSettings)
        }
    }

    // Process messages for Vision API (Multimodal)
    // Convert [图片:URL] or [表情包:名称] to { type: "image_url", image_url: { url: "..." } }
    // Process messages for Vision API (Multimodal)
    // Convert [图片:URL] or [表情包:名称] to { type: "image_url", image_url: { url: "..." } }
    // OPTIMIZATION: Only send the LAST 5 images to the AI to prevent massive payloads.
    
    // 1. First, count total images to determine the cutoff index
    let totalImagesCount = 0
    const visionLimit = 5
    const imageRegex = /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:表情包|STICKER)[:：]([^\]]+)\]/gi

    messages.forEach(msg => {
        if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) return
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

    const formattedMessages = (messages || []).map(msg => {
        if (!msg) return { role: 'user', content: '' }
        
        // Only process User/AI messages for AI Vision perception
        if (msg.role === 'user' || msg.role === 'assistant') {
            let content = msg.content || ''
            
            // 1. Check if the content is a raw base64 image string (untagged)
            if (typeof content === 'string' && content.startsWith('data:image/')) {
                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (isVisionEnabled) {
                    return {
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: msg.role === 'user' ? '（用户发送了一张图片）' : '（我发送了一张图片）' },
                            { type: 'image_url', image_url: { url: content } }
                        ]
                    }
                } else {
                    // Placeholder for older images
                    return {
                        role: msg.role, 
                        content: `[图片: (历史图片已省略以节省流量)]`
                    }
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
                    return {
                        role: msg.role === 'assistant' ? 'assistant' : 'user',
                        content: [
                            { type: 'text', text: msg.role === 'user' ? `（用户发送了表情包: ${matchedSticker.name}）` : `[表情包:${matchedSticker.name}]` },
                            { type: 'image_url', image_url: { url: matchedSticker.url } }
                        ]
                    }
                } else {
                     return {
                        role: msg.role,
                        content: `[表情包: ${matchedSticker.name}]` // Just keep text
                    }
                }
            }

            // 3. Handle potential [图片:URL] and [表情包:名称] within text
            // Regex to find either format (Updated to support data:image for local uploads)
            const combinedRegex = /\[(?:图片|IMAGE)[:：]((?:https?:\/\/|data:image\/)[^\]]+)\]|\[(?:表情包|STICKER)[:：]([^\]]+)\]/gi
            let lastIndex = 0
            let match
            
            // Reset regex
            combinedRegex.lastIndex = 0

            while ((match = combinedRegex.exec(content)) !== null) {
                // Add text before the tag
                if (match.index > lastIndex) {
                    contentParts.push({
                        type: 'text',
                        text: content.substring(lastIndex, match.index)
                    })
                }

                // Check if this part is a vision-capable item
                const isVisionEnabled = currentImageIndex >= visionStartIndex
                currentImageIndex++

                if (match[1]) {
                    // Match group 1: [图片:URL]
                    if (isVisionEnabled) {
                        contentParts.push({ type: 'image_url', image_url: { url: match[1] } })
                    } else {
                        contentParts.push({ type: 'text', text: `[图片: ${match[1].startsWith('data:') ? '(历史图片)' : match[1]}]` })
                    }
                } else if (match[2]) {
                    // Match group 2: [表情包:名称]
                    const stickerName = match[2].trim()
                    const sticker = allStickers.find(s => s.name === stickerName)
                    
                    if (sticker) {
                         if (isVisionEnabled) {
                            contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                            contentParts.push({ type: 'image_url', image_url: { url: sticker.url } })
                         } else {
                            contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                         }
                    } else {
                        // Sticker not found, treat as text
                        // Decrement index because we didn't actually process a real image/sticker that the AI "sees" as visual
                         currentImageIndex-- 
                         contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                    }
                }

                lastIndex = combinedRegex.lastIndex
            }

            // Add remaining text
            if (lastIndex < content.length) {
                contentParts.push({
                    type: 'text',
                    text: content.substring(lastIndex)
                })
            }

            // If we found any parts, return the multimodal version
            if (contentParts.length > 0) {
                return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: contentParts }
            }
        }
        
        // Default: return message as-is
        return msg
    })

    // 构建完整消息链
    const fullMessages = [systemMsg, ...formattedMessages].filter(Boolean).filter(msg => {
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
        const contentMessages = [ ...fullMessages ]
        
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
            ]
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
            // Find first user message
            const firstUserIdx = finalMessages.findIndex(m => m.role === 'user');
            
            if (firstUserIdx !== -1) {
                // Merge System into User
                const userMsg = finalMessages[firstUserIdx];
                if (typeof userMsg.content === 'string') {
                    userMsg.content = `[System Instructions]\n${systemContent}\n\n[User Message]\n${userMsg.content}`;
                } else if (Array.isArray(userMsg.content)) {
                    // Prepend text part
                    userMsg.content.unshift({ type: 'text', text: `[System Instructions]\n${systemContent}\n\n` });
                }
                // Remove original system message
                finalMessages = finalMessages.filter((_, i) => i !== 0);
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
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(reqBody)
        })

        let data;

        if (!response.ok) {
            const errText = await response.text()
            let errorMsg = `API Error ${response.status}: ${errText}`

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
                     useLoggerStore().addLog('AI', '⚠️ 400错误自动重试 (转纯文本模式)', { originalError: errText })

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
        } else {
            data = await response.json()
        }

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
                return { error: '内容被AI安全策略拦截 (Safety Filter)' }
            }
            return { error: 'AI返回了空内容，请检查日志 (Raw Data)' }
        }

        // Log Token Usage
        if (data.usage) {
            const total = data.usage.total_tokens
            useLoggerStore().addLog(total > 50000 ? 'WARN' : 'INFO', `Token Usage: ${total}`, data.usage)
        }

        // 简单的后处理：分离心声和正文
        let content = rawContent
        let innerVoice = null

        // 提取 [INNER_VOICE]
        const ivMatch = content.match(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i)
        if (ivMatch) {
            try {
                let jsonStr = ivMatch[1].trim()
                // Robust Cleanup: Remove Markdown code blocks (```json ... ```)
                // Also handles standard ```
                jsonStr = jsonStr.replace(/^```json\s*/i, '')
                                 .replace(/^```\s*/, '')
                                 .replace(/\s*```$/, '')

                innerVoice = JSON.parse(jsonStr)
            } catch (e) {
                console.warn('Inner Voice JSON parse failed', e)
            }
            // Do NOT remove Inner Voice from content here. 
            // We need the raw content in chatStore to attach it to the first message segment.
            // content = content.replace(ivMatch[0], '').trim()
        }

        // 移除 <reasoning_content> (如果有)
        content = content.replace(/<reasoning_content>[\s\S]*?<\/reasoning_content>/gi, '').trim()

        return {
            content,
            innerVoice,
            raw: rawContent
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
                     const ivMatch = content.match(/\[INNER_VOICE\]([\s\S]*?)\[\/INNER_VOICE\]/i)
                     if (ivMatch) {
                        try {
                            let jsonStr = ivMatch[1].trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
                            innerVoice = JSON.parse(jsonStr)
                        } catch (e) {}
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

    if (!config || !apiKey) return 'API未配置'

    // System Prompt (The instruction to summarize)
    const systemContent = customPrompt || '请简要总结上述对话的主要内容和关键信息，作为长期记忆归档。请保持客观，不要使用第一人称。'
    
    // --- PROVIDER SWITCHING LOGIC ---
    let endpoint = apiUrl || ''
    let reqHeaders = { 'Content-Type': 'application/json' }
    let reqBody = {}

    useLoggerStore().addLog('AI', '生成总结 (Request)', { messagesCount: messages.length, provider })

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
         const geminiContents = messages.map(msg => {
             let role = msg.role
             if (role === 'system') return null // Skip system msgs in history for Gemini (or merge them, but skip is safer for strict validaton)
             if (role === 'assistant' || role === 'ai') role = 'model'
             if (role !== 'user' && role !== 'model') role = 'user' // Fallback
             
             let text = ''
             if (typeof msg.content === 'string') text = msg.content
             else if (Array.isArray(msg.content)) text = msg.content.map(p => p.text || '').join('\n')
             else text = JSON.stringify(msg.content)

             return {
                 role: role,
                 parts: [{ text: text }]
             }
         }).filter(c => c)

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
        
        if (!content) throw new Error('Empty Content')

        useLoggerStore().addLog('AI', '总结结果 (Response)', { content })
        return content

    } catch (e) {
        console.error('Summary API Error:', e)
        useLoggerStore().addLog('ERROR', '总结失败', e.message)
        return `总结生成失败: ${e.message}`
    }
}

// --- Moments Feature AI Logic ---

/**
 * 生成朋友圈动态内容
 * @param {Object} options { name, persona, worldContext, customPrompt }
 */
export async function generateMomentContent(options) {
    const { name, persona, worldContext, customPrompt } = options
    
    const systemPrompt = `你现在是【${name}】。
你的设定：${persona}。

【任务】
请发布一条朋友圈动态。可以包含心情感悟、生活趣事、或是想对某人（乔乔）说的话。
回复必须是一个 JSON 对象，格式如下：
{
  "content": "朋友圈文字内容",
  "imagePrompt": "如果有配图需求，请提供英文生图提示词（不需要包含风格词，系统会自动增强）。如果没有配图请留空。",
  "imageDescription": "对图片的中文描述，帮助你自己以后记忆和理解这张图的内容。"
}

【严格约束】
1. 语言自然、生活化，不要像 AI。
2. 如果有图片提示词，**必须**是关于场景、物品或角色的描述。
3. 如果涉及到人物形象，系统将强制使用“日漫/少女漫”风格。
${customPrompt ? `\n【用户自定义指令】\n${customPrompt}` : ''}
${worldContext ? `\n【背景参考】\n${worldContext}` : ''}`

    const messages = [{ role: 'system', content: systemPrompt }]
    
    try {
        const result = await _generateReplyInternal(messages, { name }, null)
        if (result.error) throw new Error(result.error)

        // Parse the JSON from AI response
        const jsonMatch = result.content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI Response is not a valid JSON')
        
        const data = JSON.parse(jsonMatch[0])
        const finalResult = {
            content: data.content,
            images: [],
            imageDescriptions: []
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
    const { characters, worldContext, customPrompt, count = 3 } = options
    
    // Build character list for prompt
    const charList = characters.map((c, idx) => {
        const bio = localStorage.getItem(`char_bio_${c.id}`) || ''
        const bioText = bio ? `\n   个性签名：${bio}` : ''
        return `${idx + 1}. ${c.name}：${c.persona.substring(0, 150)}...${bioText}`
    }).join('\n')
    
    // Include user's bio if available
    const userBio = localStorage.getItem('char_bio_user') || ''
    const userBioText = userBio ? `\n\n用户的个性签名：${userBio}` : ''
    
    const systemPrompt = `你是一个社交网络模拟器。
    
【任务】
为以下角色生成 ${count} 条朋友圈动态，每条动态需要包含：
1. 发布者（从角色列表中选择）
2. 朋友圈内容
3. 配图（可选）
4. 社交互动（点赞、评论、回复）

【你需要从这些角色中挑选${count}个，分别生成一条朋友圈，并为每条朋友圈配备 3-6 个社交互动（点赞 30% / 评论 70%）。

【输出格式】必须是一个 JSON 数组：
\`\`\`json
[
  {
    "authorId": "角色ID（从输入中选择）",
    "content": "朋友圈文字内容",
    "imagePrompt": "英文图片生成提示词（可选，如果需要配图）",
    "imageDescription": "图片描述（可选）",
    "html": "HTML格式内容（可选，用于特殊排版如诗歌）",
    "interactions": [
      {
        "type": "like",
        "authorName": "点赞者的名字（从角色列表或虚拟NPC中选择）",
        "isVirtual": true/false
      },
      {
        "type": "comment",
        "authorName": "评论者的名字",
        "content": "评论内容",
        "replyTo": "被回复者的名字（如果是回复某评论，可选）",
        "isVirtual": true/false
      }
    ]
  }
]
\`\`\`

【内容要求】
1. 20% 纯文字朋友圈（无配图）
2. 10% 特殊排版（HTML格式，如诗歌、引用）
3. 70% 配图朋友圈
4. 语言自然、生活化
5. imagePrompt 如果提供，必须是英文
${customPrompt ? `\n【用户自定义指令】\n${customPrompt}` : ''}
${worldContext ? `\n【背景参考】\n${worldContext}` : ''}
${userBioText}

请直接返回 JSON 数组，不要有其他文字。`

    const messages = [{ role: 'system', content: systemPrompt }]
    
    try {
        const result = await _generateReplyInternal(messages, { name: 'MomentsGenerator' }, null)
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
                images: [],
                imageDescriptions: [],
                html: data.html || null,
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
    
    console.log(`[AI Image] Final Config - Provider: ${provider}, Model: ${model}, Has Key: ${!!apiKey}`)
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
    if (isCouple) {
        enhancedPrompt = `masterpiece, best quality, (flat cell shading anime:1.2), (side profile view:1.4), (pure side-on interaction:1.3), ${prompt}, (two distinct individuals), (each person has two hands), (no extra limbs), (slender lanky builds), (narrow sloping shoulders), detailed profiles, sharp lineart, 8k`
    } else if (isMale) {
        const muscleStyle = hasAbs 
            ? "(maniacally thin silhouette:1.4), (sloping narrow shoulders:1.5), (twig-like arms:1.5), (no muscle bulk), (flat stomach with faint grey abdominal lines:1.3), (zero bicep definition), lanky boyish body"
            : "(extremely skinny androgynous youth:1.4, malnourished-thin frame:1.3, narrow shoulders, flat chest, paper-thin)"
        enhancedPrompt = `masterpiece, best quality, (flat shoujo anime style), (delicate pretty boy face:1.3), (sparkling eyes), ${muscleStyle}, ${prompt}, (long thin fingers), clean lineart, 8k`
    } else if (isFemale || isPerson) {
        enhancedPrompt = `masterpiece, best quality, (detailed anime style:1.2), (beautiful face:1.2), (detailed eyes:1.2), (perfect anatomy:1.2), (petite:1.1), (slender build:1.1), (smooth skin:1.2), (soft feminine body:1.1), (flat stomach:1.2), ${prompt}, sharp focus, (stable anatomy), (clear hands and fingers), perfectly symmetrical face, vibrant colors, clear lineart, 8k`
    } else {
        enhancedPrompt = `masterpiece, best quality, highres, photorealistic, ${prompt}, highly detailed texture, cinematic lighting, sharp focus, 8k`
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
            
            // SANITIZATION: Path parameters (the prompt) are very sensitive to special characters like commas in certain proxies.
            // Replace commas and special characters with spaces/safe chars to ensure 200 OK.
            const safePrompt = enhancedPrompt
                .replace(/[,，]/g, ' ') // Replace all commas with spaces
                .replace(/[#?%]/g, '')  // Remove characters that act as URL control chars
                .replace(/\s+/g, ' ')   // Collapse multiple spaces
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
                    // Compress by reducing quality if possible
                    // For now, return as-is; compression happens at display level
                    resolve(base64)
                }
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch (e) {
            console.error('[AI Image] Pollinations Final Failure:', e)
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
            return data.images?.[0]?.url || data.data?.[0]?.url || `https://via.placeholder.com/1024?text=GenerationFailed`
        } catch (e) {
            console.error('Drawing API failed:', e)
            throw e
        }
    }

    // Default Fallback
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`
}

/**
 * 生成朋友圈动态的批量互动（3-5条点赞/评论）
 * @param {Object} moment 目标动态
 * @param {Array} charInfos 备选互动角色列表
 * @param {Array} historicalMoments 历史朋友圈列表（最多50条）
 */
/**
 * 生成朋友圈动态的批量互动（3-5条点赞/评论）
 * 包含：已有角色 + 虚拟NPC（亲戚、同事等）
 * @param {Object} moment 目标动态
 * @param {Array} charInfos 备选互动角色列表
 * @param {Array} historicalMoments 历史朋友圈列表
 */
export async function generateBatchInteractions(moment, charInfos, historicalMoments = []) {
    // 1. 构建提示词
    const historyStr = historicalMoments.length > 0 
        ? "【朋友圈热点背景（参考）】\n" + historicalMoments.map(m => `ID: ${m.id} | 作者: ${m.authorName} | 内容: ${m.content} | 互动: 点赞[${m.likes}], 评论[${m.comments}]`).join('\n')
        : ""
    
    // 简化现有角色信息，减少Token
    const friendsList = charInfos.map((c, index) => `${index + 1}. ${c.name}, 人设: ${c.persona.substring(0, 100)}...`).join('\n')

    const systemPrompt = `你是朋友圈生成助手。以下是通讯录现有的角色：
${friendsList}

【任务】
请根据人设和格式，为下面的朋友圈动态生成 3-6 条互动（点赞或评论）。
动态作者：${moment.authorName}
动态内容：${moment.content}
${moment.visualContext ? `图片内容：${moment.visualContext}` : ''}

${historyStr}

【互动角色来源】
1. **已有好友**（优先）：从上面的通讯录列表中选择。
2. **虚拟NPC**（补充）：根据作者可能的社交圈，虚构合适的人物（如七大姑八大姨、同事、同学、下属、老板等）。
   - 名字要像真名或微信昵称（如：二姨、王经理、AAsales小李）。

【生成要求】
1. 总共生成 3 到 6 条互动。
2. 混合点赞和评论（点赞占30%，评论占70%）。
3. 评论内容要短，口语化，像微信回复。
4. **必须**返回一个 JSON 数组，格式如下：
[
  { "type": "like", "authorName": "名字", "isVirtual": true/false, "authorId": "ID或null" },
  { "type": "comment", "authorName": "名字", "content": "评论内容", "isVirtual": true/false, "authorId": "ID或null" }
]
`
    try {
        const result = await _generateReplyInternal([{ role: 'system', content: systemPrompt }], { name: 'System' }, null)
        if (result.error) return []

        // Parse JSON
        const jsonMatch = result.content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) return []
        
        const interactions = JSON.parse(jsonMatch[0])
        return interactions.map(item => ({
            ...item,
            // Ensure ID is matched if it's an existing char
            authorId: item.isVirtual ? `virtual-${Date.now()}-${Math.random().toString(36).substr(2,5)}` : (item.authorId || charInfos.find(c => c.name === item.authorName)?.id || null)
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
图片/视觉内容：${visualContext || '无图片'}

【要求】
1. 回复要简短、真实（类似微信评论），字数控制在30字以内。
2. 根据你和对方的关系决定语气（调侃、关心、撒娇等）。
3. 如果朋友圈内容或之前的历史动态很有意思，请结合背景进行吐槽、互动或接梗。
4. 如果有图片描述，请尝试提及图片中的元素以增强“视觉感”。
5. 直接输出评论文字，不要包含任何标签或多余解释。`

    const messages = [{ role: 'system', content: systemPrompt }]
    
    try {
        const result = await _generateReplyInternal(messages, { name }, null)
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
3. 直接输出回复内容，不要包含任何标签。`

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
 * @returns {Promise<Object>} { pinnedMoments: Array, backgroundUrl: String, bio: String }
 */
export async function generateCompleteProfile(character) {
    const systemPrompt = `你是一个创意助手，需要一次性为角色生成完整的主页内容。

角色信息：
姓名：${character.name}
人设：${character.prompt || '无'}

要求生成以下内容：
1. **3条置顶朋友圈** - 最能代表角色特点的精华内容
   - 可以配图、纯文字、或HTML排版
2. **个性签名** - 简短精炼，符合角色气质（20字以内）
3. **背景图提示词** - 英文，描述适合作为朋友圈背景的风景/场景

请以JSON格式输出：
\`\`\`json
{
  "pinnedMoments": [
    {
      "content": "朋友圈文字内容",
      "imagePrompt": "英文图片生成提示词（可选）",
      "imageDescription": "图片描述（可选）",
      "html": "HTML格式内容（可选）"
    }
  ],
  "bio": "个性签名",
  "backgroundPrompt": "英文背景图提示词"
}
\`\`\`

直接输出JSON，不要任何额外说明。`

    const messages = [{ role: 'system', content: systemPrompt }]
    
    try {
        const result = await _generateReplyInternal(messages, { name: '主页生成' }, null)
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
                images: [],
                imageDescriptions: data.imageDescription ? [data.imageDescription] : [],
                html: data.html || null
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
