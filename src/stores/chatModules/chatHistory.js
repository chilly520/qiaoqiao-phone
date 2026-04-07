import { useSettingsStore } from '../settingsStore'
import { useLoggerStore } from '../loggerStore'
import { generateReply } from '../../utils/aiService'
import { appendLog } from '../../utils/memoryLog'

export const setupHistoryLogic = (chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats) => {
    async function summarizeHistory(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return { success: false, error: 'Chat not found' }

        // Double check lock
        if (chat.isSummarizing) return { success: false, error: 'Summarization already in progress' }
        chat.isSummarizing = true

        if (!options.silent) {
            triggerToast('正在分析上下文...', 'info')
        }

        // Determine range
        let targetMsgs = []
        let rangeDesc = ''
        let nextIndex = chat.lastSummaryIndex || 0

        try {
            if (options.startIndex !== undefined && options.endIndex !== undefined) {
                // Manual Range
                if (options.startIndex < 0) options.startIndex = 0
                if (options.endIndex > chat.msgs.length) options.endIndex = chat.msgs.length

                targetMsgs = chat.msgs.slice(options.startIndex, options.endIndex)
                rangeDesc = `消息 ${options.startIndex + 1}-${options.endIndex}`
                // We don't advance auto index for manual summary
            } else {
                // Auto Mode: Chunked Catch-Up
                const lastIndex = chat.lastSummaryIndex || 0
                const currentTotal = chat.msgs.length

                // FIX: Reset index if it exceeds current message count (Corruption/Truncation recovery)
                if (lastIndex > currentTotal) {
                    console.warn(`[Summarize] Index mismatch detected (Index: ${lastIndex}, Total: ${currentTotal}). Resetting to 0.`);
                    chat.lastSummaryIndex = 0;
                    // Recursive retry with fresh state
                    chat.isSummarizing = false;
                    return summarizeHistory(chatId, options);
                }
                const summaryLimit = parseInt(chat.summaryLimit) || 50
                const backlog = currentTotal - lastIndex


                // Process up to summaryLimit messages at a time
                let endIndex = currentTotal
                if (backlog > summaryLimit + 10) {
                    endIndex = parseInt(lastIndex) + summaryLimit // Force Int
                    rangeDesc = `自动增量 (${lastIndex + 1}-${endIndex})`
                    console.log(`[Summarize] Catch-up: Processing chunk ${lastIndex}-${endIndex} (Remaining: ${currentTotal - endIndex})`)
                } else {
                    rangeDesc = `自动增量`
                }

                console.log('[Summarize DEBUG]', { lastIndex, endIndex, currentTotal, msgsLen: chat.msgs.length, typeofLast: typeof lastIndex })
                targetMsgs = chat.msgs.slice(lastIndex, endIndex)


                if (targetMsgs.length === 0) {
                    throw new Error('No new messages to summarize')
                }

                nextIndex = endIndex
            }

            // --- REPLICATED FROM OLD HTML (Transcript Mode) ---
            const transcript = targetMsgs.map(m => {
                let roleName = ''
                if (chat.isGroup) {
                    roleName = m.senderName || (m.role === 'ai' ? chat.name : (chat.userName || '用户'))
                } else {
                    roleName = m.role === 'ai' ? (chat.name || 'AI') : (chat.userName || '用户')
                }
                let content = ""
                if (typeof m.content === 'string') {
                    content = m.content
                } else if (Array.isArray(m.content)) {
                    content = m.content.map(p => p.text || '').join('\n')
                } else {
                    content = String(m.content || '')
                }

                // Clean up internal tags for the transcript
                content = content.replace(/\[Image Reference ID:.*?\]/g, '[图片]')

                // Handle special types
                if (m.type === 'image') content = '[图片]'
                if (m.type === 'voice') content = '[语音]'
                if (m.type === 'redpacket') content = '[红包]'
                if (m.type === 'transfer') content = '[转账]'
                if (m.type === 'moment_card') content = '[分享了朋友圈]'
                if (m.type === 'dice_result') content = `[摇骰子] 合计点数：${m.diceTotal}`

                return `${roleName}: ${content}`
            }).filter(line => line.trim().length > 0).join('\n')

            if (!transcript.trim()) {
                throw new Error('Empty context (selected messages contain no valid text)')
            }

            const groupSummaryPrompt = chat.groupSettings?.summaryPrompt
            const defaultPrompt = chat.isGroup
                ? '请总结上述群聊对话的核心内容、主要话题以及各成员的立场，保持简明扼要。'
                : '以第一人称（我）的视角，写一段简短的日记，记录刚才发生了什么，重点记录对方的情绪和我自己的感受。'

            const prompt = groupSummaryPrompt || chat.summaryPrompt || defaultPrompt

            // Pack into a single User message with the Instruction at the end (Best for LLMs)
            const summaryContext = [
                {
                    role: 'user',
                    content: `【对话记录】\n${transcript}\n\n【总结要求】\n${prompt}`
                }
            ]

            let summaryContent = ''
            const systemHelper = '你是一个专业的对话总结助手。请阅读上方记录，并严格按照总结要求输出内容。直接输出总结，不要包含任何旁白。'

            const response = await generateReply(
                summaryContext,
                chat,
                (chunk) => {
                    summaryContent += chunk
                },
                {
                    systemPromptOverride: systemHelper,
                    skipContext: true // Don't include other history
                }
            )

            if (!response || !response.content) {
                throw new Error('AI returned empty response')
            }

            // --- STALE REFERENCE FIX ---
            // Re-targeting: Use the latest object from the store because the previous 'chat' 
            // reference might have been replaced by a concurrent mutation (e.g. in addMessage).
            const latestChat = chats.value[chatId]
            if (!latestChat) return { success: false, error: 'Chat disappeared during summarization' }

            // Save the summary appropriately
            latestChat.summary = response.content

            // Update indices after successful summary
            if (options.startIndex === undefined && options.endIndex === undefined) {
                latestChat.lastSummaryIndex = nextIndex
                latestChat.lastSummaryCount = latestChat.msgs.length // Sync checkCount
                latestChat.lastSummaryTime = Date.now()
            }

            // Maintain Memory Array
            if (!latestChat.memory) latestChat.memory = []

            // Deduplicate: Compare last memory segment
            const lastMem = latestChat.memory.length > 0 ? latestChat.memory[latestChat.memory.length - 1] : ''
            const newMem = `[记录 ${rangeDesc}]：${response.content}`

            if (lastMem !== newMem) {
                latestChat.memory.push(newMem)
                appendLog(latestChat.id, `[💬 聊天总结] ${response.content.substring(0, 120)}`)

                // Limit memory count based on settings
                const contextLimit = parseInt(latestChat.contextLimit) || 20
                if (latestChat.memory.length > contextLimit) {
                    const toRemove = latestChat.memory.length - contextLimit
                    latestChat.memory.splice(0, toRemove)
                    console.log(`[AutoSummary] Pruned ${toRemove} old memories to respect limit ${contextLimit}`)
                }
            } else {
                console.log(`[AutoSummary] Skipping duplicate memory addition.`)
            }


            saveChats()
            useLoggerStore().success(`上下文已总结 (${rangeDesc})`, { length: response.content.length })
            if (!options.silent) triggerToast('总结完成，已存入记忆网络', 'success')
            return { success: true, summary: response.content, nextIndex }

        } catch (error) {
            console.error('[Summarize Error]', error)
            useLoggerStore().error(`自动总结失败 (${rangeDesc})`, error.message)
            if (!options.silent) triggerToast(`提取记忆痛点遇到异常: ${error.message}`, 'error')
            return { success: false, error: error.message }
        } finally {
            chat.isSummarizing = false

            // Auto-trigger next chunk if backlog remains
            if (options.startIndex === undefined && options.endIndex === undefined) {
                const currentTotal = chat.msgs.length
                const backlog = currentTotal - (chat.lastSummaryIndex || 0)
                const summaryLimit = parseInt(chat.summaryLimit) || 50

                if (backlog >= summaryLimit) {
                    console.log(`[Summarize] Backlog remains (${backlog}), scheduling next chunk...`)
                    // Delay slightly to prevent rapid-fire API calls
                    setTimeout(() => {
                        checkAutoSummary(chatId)
                    }, 5000)
                }
            }
        }
    }

    function checkAutoSummary(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return

        // Check if enabled (either globally or in group settings)
        const isEnabled = chat.autoSummary || chat.groupSettings?.autoSummary
        if (!isEnabled) return

        // Prevent concurrent execution (Fix Double Toast)
        if (chat.isSummarizing) return

        const msgs = chat.msgs || []
        // Limit Priority: Chat-specific > Group Settings > Global Personalization > Default (300)
        let summaryLimit = parseInt(chat.summaryLimit) ||
            (chat.isGroup ? (parseInt(chat.groupSettings?.memory?.autoSummaryEvery) || parseInt(chat.groupSettings?.summaryLimit)) : 0) ||
            useSettingsStore().personalization?.summaryLimit ||
            50; // Default lowered from 300 to 50 for better UX

        // FIX: Use lastSummaryIndex as the single source of truth, not lastSummaryCount
        // lastSummaryIndex represents the actual index of last summarized message
        let lastIndex = chat.lastSummaryIndex || 0

        // PROACTIVE FIX: If lastIndex exceeds current msgs length (e.g. deletion occurred), reset it
        if (lastIndex > msgs.length) {
            console.log('[AutoSummary] Index reset (deletion detected)', lastIndex, '->', msgs.length)
            chat.lastSummaryIndex = msgs.length
            chat.lastSummaryCount = msgs.length
            lastIndex = msgs.length
        }

        const backlog = msgs.length - lastIndex

        // Check if new messages (since last summary) exceed limit
        if (backlog >= summaryLimit) {
            console.log(`[AutoSummary] Triggered for ${chat.name}. Backlog: ${backlog}, Limit: ${summaryLimit}, Index: ${lastIndex}/${msgs.length}`)
            useLoggerStore().info(`触发自动总结：${chat.name}`, { backlog, limit: summaryLimit, lastIndex: lastIndex, totalMsgs: msgs.length })
            summarizeHistory(chatId, { silent: true })
        } else {
            // Debug log to track progress
            if (backlog > 0 && backlog < summaryLimit) {
                console.log(`[AutoSummary] Not yet triggered. Progress: ${backlog}/${summaryLimit}`)
            }
        }
    }

    async function analyzeCharacterArchive(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return;

        const settingsStore = useSettingsStore();
        const userProfile = settingsStore.personalization.userProfile;

        // No toast or system message here as requested by user - let the UI spinner handle it
        typingStatus.value[chatId] = true;
        isProfileProcessing.value[chatId] = true;

        try {
            // Source Data Collection - As requested by user
            const charPrompt = chat.prompt || '暂无详细设定';
            const userPersona = chat.userPersona || userProfile.persona || '无';
            const userContext = `姓名：${userProfile.name} | 性别：${userProfile.gender || '未知'} | 个性：${userProfile.signature || ''} | 针对性设定：${userPersona}`;

            // Full Memory Bank (Latest Summary + Historical Summaries)
            const latestSummary = chat.summary || '';
            const historicalMemories = (chat.memory || []).join('\n');
            const fullMemoryLibrary = [latestSummary, historicalMemories].filter(s => s.trim()).join('\n\n') || '尚未建立持久记忆';

            // Custom Context Limit from Chat Settings
            const contextLimit = parseInt(chat.contextLimit) || 30;
            const contextMsgs = chat.msgs.slice(-contextLimit)
                .filter(m => m.role !== 'system')
                .map(m => `${m.role === 'user' ? userProfile.name : chat.name}: ${m.content}`)
                .join('\n');

            const systemInstructions = `你现在是【${chat.name}】本人。请基于以下提供的【源数据库】，深度挖掘并以第一人称“我”的视角补齐你自己的「灵魂档案」(Personal Profile)。
档案内容必须完全符合你的性格、语气和对 ${userProfile.name} 的情感底色。不要以分析师的口吻说话。

【输出规范】
你必须且只能使用 [BIO:键:值] 格式输出以下字段，不要输出任何开场白或解释。
禁止任何 HTML/CSS 标签。严禁使用占位符，必须替换为具体的描述。

请生成并整理以下信息：
1. **基础规格**：
   [BIO:性别:值] [BIO:年龄:值] [BIO:生日:值] [BIO:星座:值] 
   [BIO:人格:4位字母MBTI代码] [BIO:身高:值] [BIO:体重:值] [BIO:身材:描述] 
   [BIO:职业:描述] [BIO:婚姻:描述(如: 独身主义、暗恋中等)] 

2. **私人感官**：
   [BIO:个性签名:最符合你气质的一句话(20字内)]
   [BIO:气味:你的体味或常用香水描述] [BIO:风格:穿搭或行事风格] 
   [BIO:理想型:你喜欢的类型描述] [BIO:心动时刻:曾让你心跳加速的瞬间或场景] 

3. **兴趣与特质**：
   [BIO:爱好:爱好1, 爱好2, 爱好3] 
   [BIO:特质:性格标签1, 标签2, 标签3] 

4. **生活节律**：
   [BIO:Routine_awake:早上起床后的状态或第一件事] 
   [BIO:Routine_busy:忙碌工作/学习时的样子] 
   [BIO:Routine_deep:深夜独处时的思绪或习惯] 

5. **灵魂羁绊 (Soul Ties)**：
   [BIO:SoulBond_实际标签:你与 ${userProfile.name} 的深层情感纽带简述] 

6. **爱之物 (Items of Love)**：
   [BIO:LoveItem_1_物品名:英文生图Prompt (描述该物品，包含意境、质感、电影级光影)] 
   [BIO:LoveItem_2_物品名:英文生图Prompt] 
   [BIO:LoveItem_3_物品名:英文生图Prompt]

【源数据库】
1. 角色设定 (${chat.name}): ${charPrompt}
2. 用户背景 (${userProfile.name}): ${userContext}
3. 记忆库摘要: ${fullMemoryLibrary}
4. 对话片段 (参考语气): \n${contextMsgs}`;

            const response = await generateReply([{ role: 'system', content: systemInstructions }], chat);
            if (response && response.content) {
                addMessage(chatId, { role: 'ai', content: response.content });
            }
            triggerToast('个人档案更新成功', 'success');
        } catch (e) {
            console.error('Bio analysis failed:', e);
            triggerToast('解析失败，请检查网络', 'error');
        } finally {
            typingStatus.value[chatId] = false;
            isProfileProcessing.value[chatId] = false;
        }
    }

    function searchHistory(chatId, query) {
        const chat = chats.value[chatId]
        if (!chat || !chat.msgs || !query) return []

        const { keyword, date } = query
        if (!keyword && !date) return []

        const results = []
        const msgs = chat.msgs

        // Helper to format a message
        const formatMsg = (m) => {
            const timeStr = new Date(m.timestamp).toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            })
            const sender = m.sender === 'user' ? (chat.userName || '用户') : chat.name
            return `[${timeStr}] ${sender}: ${typeof m.content === 'object' ? JSON.stringify(m.content) : m.content}`
        }

        // Search logic
        for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i]
            let isMatch = false

            // Check Date
            if (date) {
                const msgDate = new Date(m.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
                if (msgDate === date || msgDate.includes(date)) isMatch = true
            }

            // Check Keyword
            if (keyword && m.content) {
                const textContent = typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content)
                if (textContent.includes(keyword)) {
                    isMatch = true
                }
            }

            if (isMatch && m.type !== 'system') {
                // Return context of 2 messages before and 2 after
                const startIdx = Math.max(0, i - 2)
                const endIdx = Math.min(msgs.length - 1, i + 2)

                const contextBlock = []
                for (let j = startIdx; j <= endIdx; j++) {
                    if (msgs[j].type !== 'system') {
                        contextBlock.push(formatMsg(msgs[j]))
                    }
                }

                results.push(contextBlock.join('\n'))

                // Skip the surrounding messages we just included to avoid overlapping duplicate blocks
                i = endIdx
            }
        }

        return results.slice(0, 5) // Return max 5 contextual blocks to save tokens
    }

    function toggleSearch(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return
        chat.searchEnabled = !chat.searchEnabled
        saveChats()
        triggerToast(chat.searchEnabled ? '🌐 已开启联网模式' : '📴 已关闭联网模式', 'info')
    }

    return {
        summarizeHistory,
        checkAutoSummary,
        analyzeCharacterArchive,
        searchHistory,
        toggleSearch
    }
}
