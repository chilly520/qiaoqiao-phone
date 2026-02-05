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
    // [定时: 2026-02-06 10:00 叫宝宝起床]
    // [定时: 10:00 叫宝宝起床]
    const taskRegex = /\[定时:\s*([^\]\s]+)\s+([^\]]+)\]/g
    const taskRegexWithTime = /\[定时:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+([^\]]+)\]/g
    const taskRegexSimple = /\[定时:\s*(\d{1,2}[:点]\d{0,2}[分]?)\s+([^\]]+)\]/g

    let cleanedText = text
    let match

    // Check for full datetime format first
    while ((match = taskRegexWithTime.exec(text)) !== null) {
        const timeStr = match[1].trim()
        const content = match[2].trim()
        if (schedulerStore.addTask(chatId, timeStr, content)) {
            cleanedText = cleanedText.replace(match[0], '')
            console.log('[Task Scheduled Full]', timeStr, content)
        }
    }

    // Check for HH:mm format
    while ((match = taskRegexSimple.exec(text)) !== null) {
        const timeStr = match[1].trim()
        const content = match[2].trim()
        if (schedulerStore.addTask(chatId, timeStr, content)) {
            cleanedText = cleanedText.replace(match[0], '')
            console.log('[Task Scheduled Simple]', timeStr, content)
        }
    }

    return cleanedText.trim()
}
