import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'

export const useLoggerStore = defineStore('logger', () => {
    const logs = ref([])
    const isLoaded = ref(false)
    // [BUG FIX] 2000 条 × 200KB = 400MB 最坏情况会 OOM. 收紧到 1000 条.
    const MAX_LOGS = 1000
    const autoScroll = ref(true)

    // [BUG FIX] 敏感信息脱敏: 防止 apiKey/token/Authorization/cookie 等被持久化到 IndexedDB
    // (用户导出日志或 IndexedDB 被读取时会泄漏). 在 addLog 入口处统一脱敏.
    const _SENSITIVE_JSON_RE = /(["'])(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|passwd|pwd|secret|token|cookie)\1\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,}\s]+)/gi
    const _SENSITIVE_URL_PARAM_RE = /([?&](?:api[_-]?key|key|token|access[_-]?token|signature|sig)=)[^&\s"']+/gi

    const _redactString = (s) => {
        if (typeof s !== 'string') return s
        return s
            .replace(_SENSITIVE_URL_PARAM_RE, '$1***REDACTED***')
            .replace(_SENSITIVE_JSON_RE, '$1$2$1:"***REDACTED***"')
    }

    const _redactDetail = (detail) => {
        if (detail == null) return detail
        if (typeof detail === 'string') return _redactString(detail)
        if (typeof detail === 'object') {
            try {
                const s = JSON.stringify(detail)
                const sanitized = _redactString(s)
                try { return JSON.parse(sanitized) } catch (_) { return sanitized }
            } catch (e) {
                return '[Un-serializable Object]'
            }
        }
        return detail
    }

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

    // [BUG FIX] 串行化保存 + 合并: 原实现在调用时捕获快照, 高频调用时 N 个旧快照在 _saveChain
    // 队列里堆积, 每个最大 50KB-200KB, 1000 次调用 = 50-200MB 内存爆炸.
    // 改为: 调用时只标记 pending, 写入时才读取最新 logs.value 取快照, 多次调用合并为一次写入.
    let _saveChain = Promise.resolve()
    let _savePending = false
    const saveLogs = () => {
        if (!isLoaded.value) return
        // 已有写入排队? 跳过 - 写入执行时会读最新 logs.value, 自然包含本次变更
        if (_savePending) return
        _savePending = true
        _saveChain = _saveChain.then(async () => {
            _savePending = false
            try {
                const snapshot = JSON.parse(JSON.stringify(logs.value))
                await logStorage.setItem('system_logs_v2', snapshot)
            } catch (e) {
                console.error('[LoggerStore] IndexedDB storage failed:', e)
            }
        }).catch(() => {})
        return _saveChain
    }

    const addLog = (type, title, detail = null) => {
        // [BUG FIX] 先脱敏, 再截断 - 否则截断会破坏 JSON 结构使脱敏 regex 失效
        const sanitizedDetail = _redactDetail(detail)

        // Dynamic truncation for individual log entries
        const isCriticalAI = /网络请求|AI响应|Request|Response/i.test(title)
        const isAIRelated = /AI|生成|Generation/i.test(title)

        // [BUG FIX] 收紧截断上限: 200000×2000=400MB 会 OOM. 改为 50000/20000/2000.
        let maxDetailLength
        if (isCriticalAI) {
            maxDetailLength = 50000
        } else if (isAIRelated) {
            maxDetailLength = 20000
        } else {
            maxDetailLength = 2000
        }

        // Truncate overly large details
        let truncatedDetail = sanitizedDetail
        if (sanitizedDetail && typeof sanitizedDetail === 'string' && sanitizedDetail.length > maxDetailLength) {
            truncatedDetail = sanitizedDetail.substring(0, maxDetailLength) + '... (truncated)'
        } else if (sanitizedDetail && typeof sanitizedDetail === 'object') {
            try {
                const detailStr = JSON.stringify(sanitizedDetail)
                if (detailStr.length > maxDetailLength) {
                    // If too big, store as truncated string instead of trying to parse back
                    truncatedDetail = detailStr.substring(0, maxDetailLength) + '... (truncated object string)'
                } else {
                    truncatedDetail = sanitizedDetail // Store as object (reactive proxy will be cleaned in saveLogs)
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
