import { useSettingsStore } from '../settingsStore'
import { useLoggerStore } from '../loggerStore'
import { generateReply } from '../../utils/aiService'
import { appendLog } from '../../utils/memoryLog'
import { getLastNTurns, countTurnsBetween, turnRangeToMsgIndices, dateRangeToMsgIndices } from '../../utils/common'

export const setupHistoryLogic = (chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats) => {
    async function summarizeHistory(chatId, options = {}) {
        const chat = chats.value[chatId]
        if (!chat) return { success: false, error: 'Chat not found' }

        console.log('[SummarizeHistory] Called with options:', JSON.stringify(options))

        if (chat.isSummarizing) return { success: false, error: 'Summarization already in progress' }

        if (!options.silent) {
            triggerToast('正在分析上下文...', 'info')
        }

        let targetMsgs = []
        let rangeDesc = ''
        let nextIndex = chat.lastSummaryIndex || 0

        try {
            chat.isSummarizing = true

            const hasDateRange = options.startDate !== undefined && options.endDate !== undefined && options.startDate && options.endDate
            console.log('[SummarizeHistory] Branch check - hasDateRange:', hasDateRange, 'startDate:', options.startDate, 'endDate:', options.endDate)

            if (hasDateRange) {
                console.log('[SummarizeHistory] Entering DATE RANGE mode')
                const idxRange = dateRangeToMsgIndices(chat.msgs, options.startDate, options.endDate)
                console.log('[SummarizeHistory] dateRangeToMsgIndices result:', idxRange)
                if (!idxRange) {
                    throw new Error(`日期 ${options.startDate}~${options.endDate} 范围内没有消息`)
                }
                const turnCount = countTurnsBetween(chat.msgs, idxRange.startIndex, idxRange.endIndex)
                targetMsgs = chat.msgs.slice(idxRange.startIndex, idxRange.endIndex)
                rangeDesc = `日期 ${options.startDate}~${options.endDate} (${turnCount}轮, 消息 ${idxRange.startIndex + 1}-${idxRange.endIndex})`
                console.log('[SummarizeHistory] Date range targetMsgs count:', targetMsgs.length, 'rangeDesc:', rangeDesc)
            } else if (options.startIndex !== undefined && options.endIndex !== undefined) {
                if (options.startTurn !== undefined && options.endTurn !== undefined) {
                    const idxRange = turnRangeToMsgIndices(chat.msgs, options.startTurn, options.endTurn)
                    if (!idxRange) {
                        throw new Error(`轮次 ${options.startTurn}-${options.endTurn} 超出已完成轮次范围`)
                    }
                    targetMsgs = chat.msgs.slice(idxRange.startIndex, idxRange.endIndex)
                    rangeDesc = `轮次 ${options.startTurn}-${options.endTurn} (消息 ${idxRange.startIndex + 1}-${idxRange.endIndex})`
                } else {
                    if (options.startIndex < 0) options.startIndex = 0
                    if (options.endIndex > chat.msgs.length) options.endIndex = chat.msgs.length
                    targetMsgs = chat.msgs.slice(options.startIndex, options.endIndex)
                    rangeDesc = `消息 ${options.startIndex + 1}-${options.endIndex}`
                }
            } else {
                const lastIndex = chat.lastSummaryIndex || 0
                const currentTotal = chat.msgs.length

                if (lastIndex > currentTotal) {
                    console.warn(`[Summarize] Index exceeds total (Index: ${lastIndex}, Total: ${currentTotal}). Clamping to current total.`)
                    chat.lastSummaryIndex = currentTotal
                    chat.lastSummaryCount = currentTotal
                    chat.isSummarizing = false
                    return { success: false, error: 'No new messages to summarize' }
                }
                const summaryLimit = parseInt(chat.summaryLimit) || 50
                const backlog = countTurnsBetween(chat.msgs, lastIndex, currentTotal)

                let endIndex = currentTotal
                if (backlog > summaryLimit + 5) {
                    let turnCount = 0
                    endIndex = lastIndex
                    let awaitingAi = false
                    for (let i = lastIndex; i < currentTotal; i++) {
                        const mm = chat.msgs[i]
                        if (!mm) continue
                        if (mm.role === 'user') {
                            awaitingAi = true
                        } else if ((mm.role === 'ai' || mm.role === 'assistant') && awaitingAi) {
                            turnCount++
                            awaitingAi = false
                        }
                        endIndex = i + 1
                        if (turnCount >= summaryLimit) break
                    }
                    rangeDesc = `自动增量 (${lastIndex + 1}-${endIndex})`
                    console.log(`[Summarize] Catch-up: Processing chunk ${lastIndex}-${endIndex} (${turnCount} turns, Remaining: ${currentTotal - endIndex})`)
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

                content = content.replace(/\[Image Reference ID:.*?\]/g, '[图片]')

                if (m.type === 'image') content = '[图片]'
                if (m.type === 'voice') content = '[语音]'
                if (m.type === 'redpacket') content = '[红包]'
                if (m.type === 'transfer') content = '[转账]'
                if (m.type === 'moment_card') content = '[分享了朋友圈]'
                if (m.type === 'dice_result') content = `[摇骰子] 合计点数：${m.diceTotal}`

                let timeStr = ''
                if (m.timestamp) {
                    const d = new Date(m.timestamp)
                    timeStr = ` [${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}]`
                }

                return `${roleName}${timeStr}: ${content}`
            }).filter(line => line.trim().length > 0).join('\n')

            if (!transcript.trim()) {
                throw new Error('Empty context (selected messages contain no valid text)')
            }

            const MAX_TRANSCRIPT_CHARS = 20000
            const finalTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
                ? transcript.substring(transcript.length - MAX_TRANSCRIPT_CHARS)
                : transcript

            const groupSummaryPrompt = chat.groupSettings?.summaryPrompt
            const defaultPrompt = chat.isGroup
                ? '请总结上述群聊对话的核心内容、主要话题以及各成员的立场，保持简明扼要。'
                : '以第一人称（我）的视角，写一段简短的日记，记录刚才发生了什么，重点记录对方的情绪和我自己的感受。'

            const prompt = groupSummaryPrompt || chat.summaryPrompt || defaultPrompt

            const systemHelper = '你是一个专业的对话总结助手。请阅读上方记录，并严格按照总结要求输出内容。直接输出总结，不要包含任何旁白。'

            const summaryContext = [
                {
                    role: 'system',
                    content: systemHelper
                },
                {
                    role: 'user',
                    content: `【对话记录】\n${finalTranscript}\n\n【总结要求】\n${prompt}`
                }
            ]

            const response = await generateReply(
                summaryContext,
                chat,
                null,
                {
                    skipContext: true,
                    disableTools: true
                }
            )

            if (!response || !response.content) {
                const diagInfo = {
                    response: response ? Object.keys(response) : 'null',
                    hasError: !!response?.error,
                    errorMsg: response?.error,
                    transcriptLen: transcript.length,
                    targetMsgsCount: targetMsgs.length,
                    rangeDesc
                }
                console.error('[AutoSummary] Empty response diagnostics:', diagInfo)
                useLoggerStore().addLog('WARN', `总结AI返回空 (transcript=${transcript.length}字, msgs=${targetMsgs.length}条)`, diagInfo)
                throw new Error(`AI returned empty response (transcript=${transcript.length}chars, msgs=${targetMsgs.length})`)
            }

            const latestChat = chats.value[chatId]
            if (!latestChat) return { success: false, error: 'Chat disappeared during summarization' }

            latestChat.summary = response.content

            const isAutoSummaryMode = options.startIndex === undefined
                && options.endIndex === undefined
                && !options.startDate
                && !options.endDate
            if (isAutoSummaryMode) {
                latestChat.lastSummaryIndex = nextIndex
                latestChat.lastSummaryCount = latestChat.msgs.length
                latestChat.lastSummaryTime = Date.now()
            }

            if (!latestChat.memory) latestChat.memory = []

            const lastMem = latestChat.memory.length > 0 ? latestChat.memory[latestChat.memory.length - 1] : ''
            const newMem = `[记录 ${rangeDesc}]：${response.content}`

            if (lastMem !== newMem) {
                latestChat.memory.push(newMem)
                appendLog(latestChat.id, `[💬 聊天总结] ${response.content.substring(0, 120)}`)

                const MAX_MEMORY_ENTRIES = 30
                if (latestChat.memory.length > MAX_MEMORY_ENTRIES) {
                    const overflow = latestChat.memory.length - MAX_MEMORY_ENTRIES
                    const oldEntries = latestChat.memory.splice(0, overflow + 5)
                    const mergedOld = `[早期记忆·汇总]：${oldEntries.map(e => e.replace(/^\[记录[^\]]*\]：/, '')).join(' / ').substring(0, 3000)}`
                    latestChat.memory.unshift(mergedOld)
                    console.log(`[Summarize] Memory pruned: merged ${oldEntries.length} old entries, now ${latestChat.memory.length} entries`)
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
            const isManualMode = options.startDate || options.endDate || options.startIndex !== undefined || options.endIndex !== undefined
            useLoggerStore().error(`${isManualMode ? '总结失败' : '自动总结失败'} (${rangeDesc})`, error.message)
            if (!options.silent) triggerToast(`总结失败: ${error.message}`, 'error')
            return { success: false, error: error.message }
        } finally {
            const finalChat = chats.value[chatId]
            if (finalChat) {
                finalChat.isSummarizing = false

                const isAutoSummaryModeFinally = options.startIndex === undefined
                    && options.endIndex === undefined
                    && !options.startDate
                    && !options.endDate
                if (isAutoSummaryModeFinally) {
                    const msgs = finalChat.msgs || []
                    const lastIndex = finalChat.lastSummaryIndex || 0
                    const backlog = countTurnsBetween(msgs, lastIndex, msgs.length)
                    const summaryLimit = parseInt(finalChat.summaryLimit) || 50

                    if (backlog >= summaryLimit) {
                        console.log(`[Summarize] Backlog remains (${backlog} turns), scheduling next chunk...`)
                        setTimeout(() => {
                            checkAutoSummary(chatId)
                        }, 5000)
                    }
                }
            }
        }
    }

    function checkAutoSummary(chatId) {
        try {
            const chat = chats.value[chatId]
            if (!chat) return

            const isEnabled = chat.autoSummary || chat.groupSettings?.autoSummary
            if (!isEnabled) return

            if (chat.isSummarizing) return

            const msgs = chat.msgs || []
            let summaryLimit = parseInt(chat.summaryLimit) ||
                (chat.isGroup ? (parseInt(chat.groupSettings?.memory?.autoSummaryEvery) || parseInt(chat.groupSettings?.summaryLimit)) : 0) ||
                useSettingsStore().personalization?.summaryLimit ||
                50

            let lastIndex = chat.lastSummaryIndex || 0

            if (lastIndex > msgs.length) {
                console.log('[AutoSummary] Index reset (deletion detected)', lastIndex, '->', msgs.length)
                chat.lastSummaryIndex = msgs.length
                chat.lastSummaryCount = msgs.length
                lastIndex = msgs.length
            }

            const backlog = countTurnsBetween(msgs, lastIndex, msgs.length)

            if (backlog >= summaryLimit) {
                console.log(`[AutoSummary] Triggered for ${chat.name}. Backlog: ${backlog} turns, Limit: ${summaryLimit}, Index: ${lastIndex}/${msgs.length}`)
                useLoggerStore().info(`触发自动总结：${chat.name}`, { backlog, limit: summaryLimit, lastIndex: lastIndex, totalMsgs: msgs.length })
                summarizeHistory(chatId, { silent: true })
            } else {
                if (backlog > 0 && backlog < summaryLimit) {
                    console.log(`[AutoSummary] Not yet triggered. Progress: ${backlog}/${summaryLimit} turns`)
                }
            }
        } catch (err) {
            console.error('[AutoSummary] checkAutoSummary error:', err)
        }
    }

    async function analyzeCharacterArchive(chatId) {
        const chat = chats.value[chatId]
        if (!chat) return;

        const settingsStore = useSettingsStore();
        const userProfile = settingsStore.personalization.userProfile;

        typingStatus.value[chatId] = true;
        isProfileProcessing.value[chatId] = true;

        try {
            const charPrompt = chat.prompt || '暂无详细设定';
            const userPersona = chat.userPersona || userProfile.persona || '无';
            const userContext = `姓名：${userProfile.name} | 性别：${userProfile.gender || '未知'} | 个性：${userProfile.signature || ''} | 针对性设定：${userPersona}`;

            const latestSummary = chat.summary || '';
            const historicalMemories = (chat.memory || []).join('\n');
            const fullMemoryLibrary = [latestSummary, historicalMemories].filter(s => s.trim()).join('\n\n') || '尚未建立持久记忆';

            const contextLimit = parseInt(chat.contextLimit) || 30;
            const contextMsgs = getLastNTurns(chat.msgs, contextLimit)
                .filter(m => m.role !== 'system')
                .map(m => `${m.role === 'user' ? userProfile.name : chat.name}: ${m.content}`)
                .join('\n');

            const systemInstructions = `你现在是【${chat.name}】本人。请基于以下提供的【源数据库】，深度挖掘并以第一人称"我"的视角补齐你自己的「灵魂档案」(Personal Profile)。
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
                triggerToast('个人档案更新成功', 'success');
            } else {
                throw new Error('AI返回空响应')
            }
        } catch (e) {
            console.error('Bio analysis failed:', e);
            const errorMsg = e.message || '未知错误'
            if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
                triggerToast('网络连接失败，请检查网络', 'error');
            } else if (errorMsg.includes('API') || errorMsg.includes('token') || errorMsg.includes('401') || errorMsg.includes('403')) {
                triggerToast('API配置错误或Token无效', 'error');
            } else if (errorMsg.includes('空响应') || errorMsg.includes('empty')) {
                triggerToast('AI服务暂时无响应，请稍后重试', 'error');
            } else {
                triggerToast(`档案生成失败: ${errorMsg.substring(0, 30)}`, 'error');
            }
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

        const formatMsg = (m) => {
            const timeStr = new Date(m.timestamp).toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            })
            const sender = m.role === 'user' ? (chat.userName || '用户') : chat.name
            return `[${timeStr}] ${sender}: ${typeof m.content === 'object' ? JSON.stringify(m.content) : m.content}`
        }

        for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i]
            let isMatch = false

            if (date) {
                const msgDate = new Date(m.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
                if (msgDate === date || msgDate.includes(date)) isMatch = true
            }

            if (keyword && m.content) {
                const textContent = typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content)
                if (textContent.includes(keyword)) {
                    isMatch = true
                }
            }

            if (isMatch && m.type !== 'system') {
                const startIdx = Math.max(0, i - 2)
                const endIdx = Math.min(msgs.length - 1, i + 2)

                const contextBlock = []
                for (let j = startIdx; j <= endIdx; j++) {
                    if (msgs[j].type !== 'system') {
                        contextBlock.push(formatMsg(msgs[j]))
                    }
                }

                results.push(contextBlock.join('\n'))

                i = endIdx
            }
        }

        return results.slice(0, 5)
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
