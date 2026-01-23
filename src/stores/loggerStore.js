import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLoggerStore = defineStore('logger', () => {
    // Initial load from localStorage
    const savedLogs = localStorage.getItem('system_logs')
    const logs = ref([])
    try {
        if (savedLogs) logs.value = JSON.parse(savedLogs)
    } catch (e) {
        console.warn('Failed to parse logs', e)
        localStorage.removeItem('system_logs')
    }

    const MAX_LOGS = 150 // Increased to keep more logs
    const autoScroll = ref(true)

    const saveLogs = () => {
        try {
            const data = JSON.stringify(logs.value)
            localStorage.setItem('system_logs', data)
        } catch (e) {
            console.warn('[LoggerStore] Storage failed, clearing logs...', e)
            logs.value = logs.value.slice(-1) // Absolute minimum
            try {
                localStorage.setItem('system_logs', JSON.stringify(logs.value))
            } catch (err) {
                localStorage.removeItem('system_logs')
                logs.value = []
            }
        }
    }

    const addLog = (type, title, detail = null) => {
        // Dynamic truncation
        const isCriticalAI = /网络请求|AI响应|Request|Response/i.test(title)
        const isAIRelated = /AI|生成|Generation/i.test(title)

        let maxDetailLength
        if (isCriticalAI) {
            maxDetailLength = 200000 // Increased to 200k chars for complete network request context
        } else if (isAIRelated) {
            maxDetailLength = 50000 // Increased to 50k for other AI logs
        } else {
            maxDetailLength = 1000 // 1k for general logs
        }

        // Truncate overly large details to prevent storage bloat
        let truncatedDetail = detail
        if (maxDetailLength !== Infinity && detail && typeof detail === 'string' && detail.length > maxDetailLength) {
            truncatedDetail = detail.substring(0, maxDetailLength) + '... (truncated due to storage limits)'
        } else if (maxDetailLength !== Infinity && detail && typeof detail === 'object') {
            try {
                const detailStr = JSON.stringify(detail)
                if (detailStr.length > maxDetailLength) {
                    truncatedDetail = detailStr.substring(0, maxDetailLength) + '... (truncated due to storage limits)'
                } else {
                    truncatedDetail = detail // Keep as is
                }
            } catch (e) {
                truncatedDetail = '[Circular or non-serializable object]'
            }
        }

        const entry = {
            id: Date.now() + Math.random(),
            time: new Date().toLocaleTimeString(),
            type: type.toUpperCase(),
            title,
            detail: truncatedDetail
        }
        logs.value.push(entry)

        if (logs.value.length > MAX_LOGS) {
            logs.value.shift()
        }
        saveLogs()

        // Also mirror to console for dev convenience, stripping reactivity
        try {
            const cleanDetail = detail ? JSON.parse(JSON.stringify(detail)) : detail
            if (type === 'error') console.error(`[LOG] ${title}`, cleanDetail)
            else if (type === 'warn') console.warn(`[LOG] ${title}`, cleanDetail)
            else console.log(`[LOG] ${title}`, cleanDetail)
        } catch (e) {
            console.log(`[LOG] ${title}`, '[Complex Object]')
        }
    }

    // Helper methods for semantic logging
    const info = (title, detail) => addLog('info', title, detail)
    const error = (title, detail) => addLog('error', title, detail)
    const warn = (title, detail) => addLog('warn', title, detail)
    const sys = (title, detail) => addLog('sys', title, detail)
    const ai = (title, detail) => addLog('ai', title, detail)
    const debug = (title, detail) => addLog('debug', title, detail)

    const clearLogs = () => {
        logs.value = []
        localStorage.removeItem('system_logs')
    }

    const exportLogs = () => {
        const blob = new Blob([JSON.stringify(logs.value, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `system_logs_${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const lastContext = computed(() => {
        const reversed = [...logs.value].reverse()
        return reversed.find(l => (l.type === 'AI' || l.type === 'DEBUG') && (l.title.includes('网络请求') || l.title.includes('Request')))
    })

    return {
        logs,
        autoScroll,
        addLog,
        info,
        error,
        warn,
        sys,
        ai,
        debug,
        clearLogs,
        exportLogs,
        lastContext
    }
})
