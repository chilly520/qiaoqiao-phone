import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLoggerStore = defineStore('logger', () => {
    // Initial load from localStorage
    const savedLogs = localStorage.getItem('system_logs')
    const logs = ref(savedLogs ? JSON.parse(savedLogs) : [])

    const MAX_LOGS = 50 // Reduced from 500 to prevent quota issues
    const autoScroll = ref(true)

    const saveLogs = () => {
        try {
            localStorage.setItem('system_logs', JSON.stringify(logs.value))
        } catch (e) {
            // If quota exceeded, clear old logs and retry
            if (e.name === 'QuotaExceededError') {
                console.warn('[LoggerStore] Quota exceeded, clearing old logs...')
                logs.value = logs.value.slice(-20) // Keep only last 20
                try {
                    localStorage.setItem('system_logs', JSON.stringify(logs.value))
                } catch (retryErr) {
                    console.error('[LoggerStore] Failed to save even after cleanup:', retryErr)
                    // Last resort: disable persistence
                    localStorage.removeItem('system_logs')
                }
            }
        }
    }

    const addLog = (type, title, detail = null) => {
        // Dynamic truncation: Critical AI logs get full content, others get limited
        const isCriticalAI = /网络请求|AI响应|Request|Response/i.test(title)
        const isAIRelated = /AI|生成|Generation/i.test(title)

        let maxDetailLength
        if (isCriticalAI) {
            maxDetailLength = Infinity // No truncation for critical AI logs
        } else if (isAIRelated) {
            maxDetailLength = 10000 // 10k for other AI logs
        } else {
            maxDetailLength = 500 // 500 for general logs
        }

        // Truncate overly large details to prevent storage bloat
        let truncatedDetail = detail
        if (maxDetailLength !== Infinity && detail && typeof detail === 'string' && detail.length > maxDetailLength) {
            truncatedDetail = detail.substring(0, maxDetailLength) + '... (truncated)'
        } else if (maxDetailLength !== Infinity && detail && typeof detail === 'object') {
            try {
                const detailStr = JSON.stringify(detail)
                if (detailStr.length > maxDetailLength) {
                    truncatedDetail = detailStr.substring(0, maxDetailLength) + '... (truncated)'
                } else {
                    truncatedDetail = detail // Keep as object if within limit
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

        // Also mirror to console for dev convenience
        if (type === 'error') console.error(`[LOG] ${title}`, detail)
        else if (type === 'warn') console.warn(`[LOG] ${title}`, detail)
        else console.log(`[LOG] ${title}`, detail)
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
