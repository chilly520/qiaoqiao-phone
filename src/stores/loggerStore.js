import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useLoggerStore = defineStore('logger', () => {
    const logs = ref([])
    const MAX_LOGS = 500
    const autoScroll = ref(true)

    // Log Entry Structure: { id, time, type, title, detail }

    const addLog = (type, title, detail = null) => {
        const entry = {
            id: Date.now() + Math.random(),
            time: new Date().toLocaleTimeString(),
            type,
            title,
            detail
        }
        logs.value.push(entry)

        if (logs.value.length > MAX_LOGS) {
            logs.value.shift()
        }
    }

    const clearLogs = () => {
        logs.value = []
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

    // Context Analysis
    const lastContext = computed(() => {
        // Find last log of type 'AI' (or usually 'DEBUG'/'INFO' from AI service) that contains '网络请求' or 'Request Params'
        // In legacy code: type === 'AI' && title.includes('网络请求')
        // In this Vue app, we need to ensure we log it this way.
        const reversed = [...logs.value].reverse()
        return reversed.find(l => (l.type === 'AI' || l.type === 'DEBUG') && (l.title.includes('网络请求') || l.title.includes('Request')))
    })

    return {
        logs,
        autoScroll,
        addLog,
        clearLogs,
        exportLogs,
        lastContext
    }
})
