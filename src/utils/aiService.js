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
你有以下表情包可以使用，请务必在合适的情境下使用 [表情包:名称] 发送，不仅限于文本：
${stickers.length > 0 ? stickers.map(s => `- ${s.name}`).join('\n') : '（暂无可用表情包）'}

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
   - **注意**：绝对不要生成虚假的图片链接。如果你无法提供真实可访问的 URL，请不要使用 [图片] 标签。
3. **HTML 动态卡片**：如果你想发送一张制作精美的卡片（例如情书、邀请函、特殊界面），请使用以下格式：
   [CARD]
   {
     "type": "html",
     "html": "<div style='...'>你的HTML代码</div>"
   }
   - **注意**：请务必使用 [CARD] 前缀，并确保 JSON 格式正确且压缩为一行。HTML 中可以使用内联 CSS。

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

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        // Check Rate Limit
        const now = Date.now();
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
            task.resolve(result);
        } catch (error) {
            task.reject(error);
        } finally {
            this.isProcessing = false;
            // Delay next process slightly to ensure UI updates or avoid race
            setTimeout(() => this.processQueue(), 50); 
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
    const patSettings = { action: char.patAction, suffix: char.patSuffix }
    const systemMsg = {
        role: 'system',
        content: SYSTEM_PROMPT_TEMPLATE(char || {}, userProfile, availableStickers, worldInfoText, memoryText, patSettings)
    }

    // Process messages for Vision API (Multimodal)
    // Convert [图片:URL] or [表情包:名称] to { type: "image_url", image_url: { url: "..." } }
    const formattedMessages = (messages || []).map(msg => {
        if (!msg) return { role: 'user', content: '' }
        
        // Only process User messages for AI Vision perception
        if (msg.role === 'user') {
            let content = msg.content || ''
            const allStickers = [...globalStickers, ...charStickers]
            const contentParts = []
            
            // 1. Check if the message is a raw sticker URL (exact match)
            const matchedSticker = allStickers.find(s => s.url === content.trim())
            if (matchedSticker) {
                // Return multimodal immediately for sticker
                return {
                    role: 'user',
                    content: [
                        { type: 'text', text: `（发送了表情包: ${matchedSticker.name}）` },
                        { type: 'image_url', image_url: { url: matchedSticker.url } }
                    ]
                }
            }

            // 2. Handle potential [图片:URL] and [表情包:名称] within text
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

                if (match[1]) {
                    // Match group 1: [图片:URL]
                    contentParts.push({ type: 'image_url', image_url: { url: match[1] } })
                } else if (match[2]) {
                    // Match group 2: [表情包:名称]
                    const stickerName = match[2].trim()
                    const sticker = allStickers.find(s => s.name === stickerName)
                    if (sticker) {
                        contentParts.push({ type: 'text', text: `[表情包:${stickerName}]` })
                        contentParts.push({ type: 'image_url', image_url: { url: sticker.url } })
                    } else {
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
                // If it's ONLY an image, add a hint
                if (contentParts.length === 1 && contentParts[0].type === 'image_url') {
                    contentParts.unshift({ type: 'text', text: '（发送了一张图片）' })
                }
                return { role: 'user', content: contentParts }
            }
        }
        
        // Default: return message as-is
        return msg
    })

    // 构建完整消息链
    const fullMessages = [systemMsg, ...formattedMessages]

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
                         if (url.startsWith('data:')) {
                            const [mime, data] = url.split(';base64,')
                            return { inline_data: { mime_type: mime.replace('data:', ''), data: data } }
                         }
                         // Fallback for non-base64 (remote URLs might not work in generic Native mode without upload, 
                         // but we leave as text link for safety)
                         return { text: `[Image: ${url}]` }
                    }
                    return { text: p.text }
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
        // **Critical**: Do NOT include safety_settings here to match HTML fix
        reqBody = {
            model: model,
            messages: fullMessages,
            temperature: Number(temperature) || 0.7,
            max_tokens: Number(maxTokens) || 4096,
            stream: false
        }
    }


    // Log the endpoint for debugging
    useLoggerStore().addLog('DEBUG', 'API Config', { endpoint, model, provider })

    // Log the Full Request Payload (for Context Tab)
    useLoggerStore().addLog('AI', '网络请求 (Request)', {
        provider,
        endpoint,
        payload: reqBody
    })

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(reqBody)
        })

        if (!response.ok) {
            const errText = await response.text()
            let errorMsg = `API Error ${response.status}: ${errText}`

            // Helpful hints for 404
            if (response.status === 404) {
                errorMsg += ' (提示: 请检查 Base URL 是否正确，很多服务商需要以 /v1 结尾)'
            }

            throw new Error(errorMsg)
        }

        const data = await response.json()

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
