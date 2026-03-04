import { useCallStore } from '../callStore'
import { useLoggerStore } from '../loggerStore'
import { useSchedulerStore } from '../schedulerStore'

export const setupProactiveLogic = (chats, currentChatId, typingStatus, sendMessageToAI) => {
    let proactiveWorker = null

    function startProactiveLoop() {
        // 1. Cleanup old worker
        if (proactiveWorker) {
            proactiveWorker.terminate()
            proactiveWorker = null
        }

        // 2. Create Web Worker for background-resilient timing
        const workerScript = `
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    setInterval(() => {
                        self.postMessage('tick');
                    }, 60000); // Check every minute
                }
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        proactiveWorker = new Worker(URL.createObjectURL(blob));

        proactiveWorker.onmessage = (e) => {
            if (e.data === 'tick') {
                const logger = useLoggerStore()
                // Only log one tick every 30 mins to avoid noise in the log
                const now = new Date()
                if (now.getMinutes() % 30 === 0) {
                    logger.sys('[Proactive] Worker heartbeat: scanning all chats...')
                }

                Object.keys(chats.value).forEach(chatId => {
                    checkProactive(chatId)
                })
            }
        }

        // Start the worker
        proactiveWorker.postMessage('start');

        // 3. Visibility API Compensation (Check immediately when user returns)
        if (typeof document !== 'undefined') {
            let lastForegroundTime = Date.now()
            document.addEventListener('visibilitychange', () => {
                const logger = useLoggerStore()
                if (document.visibilityState === 'visible') {
                    // Avoid double triggers within 2 seconds
                    if (Date.now() - lastForegroundTime < 2000) return
                    lastForegroundTime = Date.now()

                    logger.sys('[Proactive] App in foreground, checking missed triggers...')
                    Object.keys(chats.value).forEach(chatId => {
                        checkProactive(chatId)
                    })
                }
            });
        }
    }

    async function checkProactive(chatId) {
        const callStore = useCallStore()
        const logger = useLoggerStore()
        const chat = chats.value[chatId]
        if (!chat) return

        const now = Date.now()
        const lastMsg = (chat.msgs || []).slice(-1)[0]
        const lastMsgTime = lastMsg ? lastMsg.timestamp : now
        const diffMinutes = (now - lastMsgTime) / 1000 / 60

        if (typingStatus.value[chatId] || callStore.status !== 'none') return

        // 1. Proactive Chat / Call (Trigger when idle, applies globally now)
        if (chat.proactiveChat) {
            const pInterval = parseInt(chat.proactiveInterval) || 30
            if (diffMinutes >= pInterval) {
                if (!chat._lastProactiveTriggeredTime || (now - chat._lastProactiveTriggeredTime >= pInterval * 60000)) {
                    chat._lastProactiveTriggeredTime = now
                    const rand = Math.random()
                    logger.sys(`[Proactive] Triggering idle response for ${chat.name}`)
                    if (!chat.isGroup && rand < 0.2) {
                        const callType = Math.random() > 0.5 ? 'video' : 'voice'
                        sendMessageToAI(chatId, {
                            hiddenHint: `（系统：距离上次对话已过 ${Math.floor(diffMinutes)} 分钟。请主动找些话题或描写自己的动态行为，也可以主动发起一个${callType === 'video' ? '视频' : '语音'}通话给用户。只需回复：[${callType === 'video' ? '视频通话' : '语音通话'}]）`,
                            isProactiveCall: true
                        })
                    } else {
                        // Group chats: no call triggers, only messages
                        sendMessageToAI(chatId, { hiddenHint: `（距离上次发言已过 ${Math.floor(diffMinutes)} 分钟，给${chat.isGroup ? '群里' : '用户'}主动发条简短的消息开启新话题或分享动态。可带上表情包。）` })
                    }
                }
            }
        }

        // 2. Active Chat (Check-in while user is elsewhere or app in background)
        if (chat.activeChat && currentChatId.value !== chatId) {
            const aInterval = parseInt(chat.activeInterval) || 120
            if (diffMinutes >= aInterval) {
                if (!chat._lastActiveTriggeredTime || (now - chat._lastActiveTriggeredTime > aInterval * 60000)) {
                    chat._lastActiveTriggeredTime = now
                    logger.sys(`[Proactive] Triggering check -in message for ${chat.name}`)
                    const timeStr = new Date().getHours() + ":" + new Date().getMinutes().toString().padStart(2, '0')
                    const callChance = !chat.isGroup && Math.random() < 0.15
                    const hint = callChance
                        ? `（现在是${timeStr}，你很想念用户，请立即通过 [语音通话] 联系对方。）`
                        : `（现在是${timeStr}，你发现用户已经很久没理你了，发条关怀消息（或分享朋友圈）。）`
                    sendMessageToAI(chatId, { hiddenHint: hint })
                }
            }
        }

        // 3. Scheduler Task
        const schedulerStore = useSchedulerStore()
        const dueTasks = schedulerStore.tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp <= now)
        if (dueTasks.length > 0) {
            dueTasks.forEach(task => {
                logger.sys(`[Proactive] Executing scheduler task: ${task.content} `)
                schedulerStore.removeTask(task.id)
                sendMessageToAI(chatId, { hiddenHint: `（系统：执行定时任务：${task.content}。请根据当前人设发送消息通知用户。）` })
            })
        }

        // 4. Random Proactive
        try {
            const randomConfig = schedulerStore.randomConfigs?.[chatId]
            if (randomConfig && randomConfig.enabled && randomConfig.nextTrigger > 0 && now >= randomConfig.nextTrigger) {
                logger.sys(`[Proactive] Triggering random proactive message for ${chat.name}`)
                schedulerStore.updateNextRandomTrigger(chatId)
                sendMessageToAI(chatId, { hiddenHint: `（随机触发。现在是 ${new Date().getHours()}:${new Date().getMinutes()}，根据当前上下文，主动和用户说点什么吧。）` })
            }
        } catch (error) {
            logger.error(`[Proactive] Error checking random proactive: ${error.message} `)
        }
    }

    return {
        startProactiveLoop,
        checkProactive
    }
}
