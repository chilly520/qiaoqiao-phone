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
                // [BUG FIX] loadLogs 是 async 且启动时未 await, 在它 resolve 前 addLog 可能已 push 新日志.
                // 直接 logs.value = saved 会丢弃这些新日志, 且此时 isLoaded=false 导致它们也从未 saveLogs,
                // 造成静默数据丢失. 改为合并: 已加载的旧日志在前, 启动后新增的日志在后.
                logs.value = [...saved, ...logs.value]
            }
            isLoaded.value = true
            // [BUG FIX] 合并后立即保存一次, 把启动期间新增的日志持久化
            saveLogs()
        } catch (e) {
            console.warn('[LoggerStore] Failed to load logs', e)
            isLoaded.value = true
        }
    }

    // [BUG FIX] 串行化保存: 多次 addLog 快速触发时, 各 saveLogs 捕获快照后异步写入 IndexedDB,
    // 写入顺序不保证, 后写的旧快照可能覆盖先写的新快照, 丢失日志. 改用单飞链式队列.
    let _saveChain = Promise.resolve()
    const saveLogs = async () => {
        if (!isLoaded.value) return
        // 捕获当前快照, 链到上一个保存之后执行, 保证写入顺序
        const snapshot = JSON.parse(JSON.stringify(logs.value))
        _saveChain = _saveChain.then(async () => {
            try {
                await logStorage.setItem('system_logs_v2', snapshot)
            } catch (e) {
                console.error('[LoggerStore] IndexedDB storage failed:', e)
            }
        }).catch(() => {})
        return _saveChain
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
