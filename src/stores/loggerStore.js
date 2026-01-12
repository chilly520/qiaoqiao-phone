import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLoggerStore = defineStore('logger', () => {
    // Initial load from localStorage
    const savedLogs = localStorage.getItem('system_logs')
    const logs = ref(savedLogs ? JSON.parse(savedLogs) : [])
    
    const MAX_LOGS = 500
    const autoScroll = ref(true)

    const saveLogs = () => {
        localStorage.setItem('system_logs', JSON.stringify(logs.value))
    }

    const addLog = (type, title, detail = null) => {
        const entry = {
            id: Date.now() + Math.random(),
            time: new Date().toLocaleTimeString(),
            type: type.toUpperCase(),
            title,
            detail
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
