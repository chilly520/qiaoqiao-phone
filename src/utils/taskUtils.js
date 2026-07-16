import { useSchedulerStore } from '../stores/schedulerStore'

/**
 * Detect and process [定时: ...] commands in AI responses
 * @param {string} text - AI response text
 * @param {string} chatId - Chat ID
 * @returns {string} - Cleaned text without task command
 */
export function processTaskCommands(text, chatId) {
    const schedulerStore = useSchedulerStore()
    // Support formats:
    // [定时：2026-02-06 10:00 叫宝宝起床]
    // [定时：10:00 叫宝宝起床]
    const taskRegex = /\[定时 [:：]\s*([^\]]+)\]/g
    const taskRegexWithTime = /\[定时 [:：]\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+([^\]]+)\]/g
    const taskRegexSimple = /\[定时 [:：]\s*(\d{1,2}[:点]\d{0,2}[分]?)\s+([^\]]+)\]/g

    let cleanedText = text
    let match

    console.log('[TaskUtils] Processing text:', text)

    // Check for full datetime format first
    while ((match = taskRegexWithTime.exec(text)) !== null) {
        const timeStr = match[1].trim()
        const content = match[2].trim()
        console.log('[TaskUtils] Matched datetime format:', { timeStr, content, fullMatch: match[0] })
        if (schedulerStore.addTask(chatId, timeStr, content)) {
            // [BUG FIX] 原代码 `cleanedText.replace(match[0], '')` 用字符串作为第一参数,
            // String.replace 只会替换第一处匹配. 如果 AI 回复里同一条任务命令出现多次
            // (例如 "[定时：10:00 叫宝宝起床]" 写了两遍), 第一次循环只清掉第一处,
            // 第二次循环 addTask 返回 true 但 replace 找不到 (第一处已删) 又删错地方,
            // 表现为任务被注册但 UI 上还残留命令文本. 用 replaceAll 替换所有匹配项.
            cleanedText = cleanedText.replaceAll(match[0], '')
            console.log('[TaskUtils] Task scheduled (datetime):', timeStr, content)
        }
    }

    // Check for HH:mm format
    while ((match = taskRegexSimple.exec(text)) !== null) {
        const timeStr = match[1].trim()
        const content = match[2].trim()
        console.log('[TaskUtils] Matched simple format:', { timeStr, content, fullMatch: match[0] })
        if (schedulerStore.addTask(chatId, timeStr, content)) {
            // [BUG FIX] 同上, replace → replaceAll
            cleanedText = cleanedText.replaceAll(match[0], '')
            console.log('[TaskUtils] Task scheduled (simple):', timeStr, content)
        }
    }

    console.log('[TaskUtils] Cleaned text:', cleanedText)
    return cleanedText.trim()
}
