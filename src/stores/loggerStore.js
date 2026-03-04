import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'

export const useLoggerStore = defineStore('logger', () => {
    const logs = ref([])
    const isLoaded = ref(false)
    const MAX_LOGS = 2000 // Increased significantly for permanent history
    const autoScroll = ref(true)

    // Configuration for localforage
    const logStorage = localforage.createInstance({
        name: "qiaoqiao_logs"
    });

    // Initial load from IndexedDB
    const loadLogs = async () => {
        try {
            // Check new storage first
            let saved = await logStorage.getItem('system_logs_v2')

            // Migration from old localStorage if needed
            if (!saved) {
                const oldData = localStorage.getItem('system_logs')
                if (oldData) {
                    try {
                        saved = JSON.parse(oldData)
                        localStorage.removeItem('system_logs')
                        await logStorage.setItem('system_logs_v2', saved)
                    } catch (e) { }
                }
            }

            if (saved && Array.isArray(saved)) {
                logs.value = saved
            }
            isLoaded.value = true
        } catch (e) {
            console.warn('[LoggerStore] Failed to load logs', e)
            isLoaded.value = true
        }
    }

    const saveLogs = async () => {
        if (!isLoaded.value) return
        try {
            // Use JSON.parse(JSON.stringify()) to ensure we're saving plain objects, not Vue proxies
            await logStorage.setItem('system_logs_v2', JSON.parse(JSON.stringify(logs.value)))
        } catch (e) {
            console.error('[LoggerStore] IndexedDB storage failed:', e)
        }
    }

    const addLog = (type, title, detail = null) => {
        // Dynamic truncation for individual log entries
        const isCriticalAI = /网络请求|AI响应|Request|Response/i.test(title)
        const isAIRelated = /AI|生成|Generation/i.test(title)

        let maxDetailLength
        if (isCriticalAI) {
            maxDetailLength = 200000
        } else if (isAIRelated) {
            maxDetailLength = 50000
        } else {
            maxDetailLength = 5000 // Increased from 1k for better detail
        }

        // Truncate overly large details
        let truncatedDetail = detail
        if (detail && typeof detail === 'string' && detail.length > maxDetailLength) {
            truncatedDetail = detail.substring(0, maxDetailLength) + '... (truncated)'
        } else if (detail && typeof detail === 'object') {
            try {
                const detailStr = JSON.stringify(detail)
                if (detailStr.length > maxDetailLength) {
                    // If too big, store as truncated string instead of trying to parse back
                    truncatedDetail = detailStr.substring(0, maxDetailLength) + '... (truncated object string)'
                } else {
                    truncatedDetail = detail // Store as object (reactive proxy will be cleaned in saveLogs)
                }
            } catch (e) {
                truncatedDetail = '[Un-serializable Object]'
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

        // Trim logs if they exceeding limit
        if (logs.value.length > MAX_LOGS) {
            logs.value = logs.value.slice(-MAX_LOGS)
        }

        saveLogs()

        // Mirror to console
        try {
            if (type === 'error') console.error(`[LOG] ${title}`, detail)
            else if (type === 'warn') console.warn(`[LOG] ${title}`, detail)
            else console.log(`[LOG] ${title}`, detail)
        } catch (e) { }
    }

    // Helper methods
    const info = (title, detail) => addLog('info', title, detail)
    const error = (title, detail) => addLog('error', title, detail)
    const warn = (title, detail) => addLog('warn', title, detail)
    const sys = (title, detail) => addLog('sys', title, detail)
    const ai = (title, detail) => addLog('ai', title, detail)
    const debug = (title, detail) => addLog('debug', title, detail)
    const success = (title, detail) => addLog('sys', `✅ ${title}`, detail)

    const clearLogs = async () => {
        logs.value = []
        await logStorage.removeItem('system_logs_v2')
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

    // Initialization
    loadLogs()

    return {
        logs,
        isLoaded,
        autoScroll,
        addLog,
        info,
        error,
        warn,
        sys,
        ai,
        debug,
        success,
        clearLogs,
        exportLogs,
        lastContext
    }
})
