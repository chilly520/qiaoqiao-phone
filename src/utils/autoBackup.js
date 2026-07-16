/**
 * 自动备份服务 v1.10.65
 *
 * 职责:
 *   1. 监听聊天记录变化,debounce 后自动上传 GitHub(如果用户配过 token)
 *   2. 每隔 N 天主动提醒用户下载本地 JSON 备份(浏览器内)
 *   3. 危险操作(重置/清空)前的"上次备份时间"检查,没备份就拦截
 *
 * 设计要点:
 *   - debounce 5 分钟,避免每条消息都请求 GitHub
 *   - 上传失败 3 次后停止本轮,下次 debounce 触发再试
 *   - 上传成功才更新 lastBackupTime
 *   - 永远不阻塞聊天主流程(失败 catch + console)
 */

import GitHubBackup from './githubBackup'

const GITHUB_CONFIG_KEY = 'github_backup_config'
const LAST_BACKUP_TIME_KEY = 'auto_backup_last_time'
const LAST_LOCAL_DOWNLOAD_PROMPT_KEY = 'auto_backup_last_local_prompt'
const BACKUP_DEBOUNCE_MS = 5 * 60 * 1000        // 5 分钟
const LOCAL_PROMPT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000  // 7 天
const MAX_CONSECUTIVE_FAILURES = 3

class AutoBackupService {
    constructor() {
        this.debounceTimer = null
        this.pendingPayload = null
        this.inFlight = false
        this.consecutiveFailures = 0
        // [BUG FIX] localStorage 值可能损坏/非数字, parseInt 返回 NaN 后所有时间比较失效
        const _safeInt = (key) => { const n = parseInt(localStorage.getItem(key) || '0', 10); return isNaN(n) ? 0 : n }
        this.lastBackupTime = _safeInt(LAST_BACKUP_TIME_KEY)
        this.lastLocalPromptTime = _safeInt(LAST_LOCAL_DOWNLOAD_PROMPT_KEY)
    }

    /**
     * 启动:在 App 初始化时调用一次
     */
    init() {
        console.log('[AutoBackup] initialized, last backup:', new Date(this.lastBackupTime).toISOString())
        // 启动时检查是否需要提示下载
        this.maybePromptLocalDownload()
    }

    /**
     * 标记数据有变化(由 chatStore.saveChats 调用)
     * debounce 后触发云端备份
     */
    notifyChange(payloadCollector) {
        // 只在没有定时器时记录采集器,后续覆盖(只备份最新)
        this.pendingPayload = payloadCollector

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null
            this.flush().catch(err => {
                console.warn('[AutoBackup] flush failed:', err)
            })
        }, BACKUP_DEBOUNCE_MS)
    }

    /**
     * 立即执行一次备份(用户点"立即备份"时调用)
     * payloadCollector 可选,如果不传会用已有的 pendingPayload
     */
    async flushNow(payloadCollector = null) {
        if (payloadCollector) {
            this.pendingPayload = payloadCollector
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }
        return await this.flush()
    }

    /**
     * 实际执行上传
     */
    async flush() {
        if (this.inFlight) {
            console.log('[AutoBackup] already in flight, skip')
            return { skipped: true }
        }
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn('[AutoBackup] too many failures, give up this round')
            return { skipped: true, reason: 'too_many_failures' }
        }

        const config = this.getConfig()
        if (!config || !config.token) {
            console.log('[AutoBackup] no GitHub config, skip')
            return { skipped: true, reason: 'no_config' }
        }
        if (!this.pendingPayload) {
            return { skipped: true, reason: 'no_payload' }
        }

        this.inFlight = true
        try {
            // [BUG FIX] 8.2 + 竞态: 原代码 `const payload = await this.pendingPayload()`
            // 后立即 `this.pendingPayload = null`, 但 await 期间 notifyChange 可能写入
            // 新的 payloadCollector, 这里 null 会把新数据也一起丢掉.
            // 而且 upload 失败时 pendingPayload 已被清空, 数据永久丢失.
            // 改为: 先 capture-then-clear 原子取出 (避免被 notifyChange 覆盖),
            // 上传成功后才提交清空; 失败时把 payloadCollector 退还, 下次重试.
            const payloadCollector = this.pendingPayload
            if (!payloadCollector) {
                return { skipped: true, reason: 'no_payload' }
            }
            const payload = await payloadCollector()

            if (!payload) {
                // 空 payload 视为已消费, 不退还
                this.pendingPayload = null
                return { skipped: true, reason: 'empty_payload' }
            }

            const service = new GitHubBackup(config)
            await service.uploadFull(payload)

            // [BUG FIX] 上传成功后才清空 pendingPayload. 失败时保留, 下次 flush 重试.
            // 注意: 若在 inFlight 期间 notifyChange 写入了新的 payloadCollector,
            // 这里不能覆盖它 (它代表上传之后的新变化). 只在仍是同一个 collector 时清空.
            if (this.pendingPayload === payloadCollector) {
                this.pendingPayload = null
            }

            this.lastBackupTime = Date.now()
            localStorage.setItem(LAST_BACKUP_TIME_KEY, this.lastBackupTime.toString())
            this.consecutiveFailures = 0
            console.log('[AutoBackup] uploaded successfully at', new Date().toISOString())
            return { success: true }
        } catch (err) {
            this.consecutiveFailures++
            console.error(`[AutoBackup] upload failed (${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, err)
            // [BUG FIX] 失败时保留 pendingPayload, 下次 flush 会重试上传.
            // (上面 empty_payload 分支已处理过空 payload 清空; 真正失败时 collector 仍在)
            return { success: false, error: err.message }
        } finally {
            this.inFlight = false
        }
    }

    /**
     * 是否应该提示用户下载本地备份(超过 7 天没下载过)
     */
    shouldPromptLocalDownload() {
        if (!this.lastLocalPromptTime) return true
        return Date.now() - this.lastLocalPromptTime > LOCAL_PROMPT_INTERVAL_MS
    }

    /**
     * 标记用户已经看过/执行了本地下载
     */
    markLocalDownloadPrompted() {
        this.lastLocalPromptTime = Date.now()
        localStorage.setItem(LAST_LOCAL_DOWNLOAD_PROMPT_KEY, this.lastLocalPromptTime.toString())
    }

    /**
     * 检查是否需要提示(并返回原因)
     */
    maybePromptLocalDownload() {
        return this.shouldPromptLocalDownload()
    }

    /**
     * 危险操作前的安全检查:没备份过的话返回 false
     */
    isSafeToDestroyData() {
        // 有 GitHub 配置 且 最近 1 小时内备份过 -> 安全
        const config = this.getConfig()
        if (config && config.token && this.lastBackupTime > 0) {
            const ageMs = Date.now() - this.lastBackupTime
            if (ageMs < 60 * 60 * 1000) return { safe: true, reason: 'recent_github_backup' }
        }
        // 啥都没有 -> 不安全
        return {
            safe: false,
            reason: !config || !config.token
                ? 'no_github_config'
                : 'backup_too_old',
            lastBackupTime: this.lastBackupTime,
            lastBackupAgo: this.lastBackupTime > 0
                ? Math.floor((Date.now() - this.lastBackupTime) / 1000 / 60) + ' 分钟前'
                : '从未备份'
        }
    }

    getConfig() {
        try {
            const raw = localStorage.getItem(GITHUB_CONFIG_KEY)
            if (!raw) return null
            const parsed = JSON.parse(raw)
            if (!parsed || !parsed.token) return null
            return parsed
        } catch (e) {
            return null
        }
    }

    getStatus() {
        const config = this.getConfig()
        return {
            githubConfigured: !!(config && config.token),
            lastBackupTime: this.lastBackupTime,
            lastBackupAgo: this.lastBackupTime > 0
                ? Math.floor((Date.now() - this.lastBackupTime) / 1000 / 60) + ' 分钟前'
                : '从未备份',
            lastLocalPromptTime: this.lastLocalPromptTime,
            pending: !!this.debounceTimer || !!this.pendingPayload,
            inFlight: this.inFlight,
            failures: this.consecutiveFailures
        }
    }
}

// 单例
const autoBackup = new AutoBackupService()

export default autoBackup
export { AutoBackupService, LAST_BACKUP_TIME_KEY, GITHUB_CONFIG_KEY }
