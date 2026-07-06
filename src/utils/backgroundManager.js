// Background utility for PWA.
//
// 真保活机制(可选,需用户主动点击开启):
//   - 创建一个真实播放的 <audio> 元素 (volume≈0.02,人耳几乎听不到,浏览器认为有音频输出)
//   - 设置 MediaSession metadata 让手机通知栏出现媒体卡片
//   - 监听 pause / ended / visibilitychange 自动续播
//   - 失败时降级为 wake lock + visibility 监听
//
// 注意:现代移动浏览器 (iOS Safari / Chrome Android) 对 autoplay 限制很严,
// 必须由用户点击 / touchstart 事件触发 audio.play(),否则会被静默拒绝。
// 所以这里只提供 enableRealKeepAlive() 方法,由 UI 开关按钮调用。
//
// 真正能穿透 App 完全关闭的方案是 Web Push (pushService.schedule),
// 由 chatStore 的 proactive / scheduler / 定时任务模块调用。

import { useLoggerStore } from '../stores/loggerStore';

const KEEP_ALIVE_AUDIO_URL = '/silent.wav';

class BackgroundManager {
    constructor() {
        this.wakeLock = null;
        this.initialized = false;
        this.logger = null;

        // 真保活状态
        this.keepAliveActive = false;
        this.keepAliveAudio = null;
        this.keepAliveMonitorTimer = null;
        this.keepAliveVisibilityHandler = null;
    }

    init() {
        if (!this.logger) {
            try { this.logger = useLoggerStore(); } catch (e) { /* Early init */ }
        }
        if (this.initialized) return;
        this.setupVisibilityHandler();
        this.initialized = true;
    }

    log(message, level = 'sys') {
        if (this.logger && level !== 'debug') {
            if (level === 'info' || level === 'sys') this.logger.sys(message);
            else if (level === 'error') this.logger.error(message);
        }
    }

    /**
     * Screen Wake Lock:前台时阻止屏幕熄灭(仅 Android Chrome 有效,iOS Safari 不支持)。
     * 失败/不支持都静默,不刷日志。
     */
    async requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        if (this.wakeLock) return;
        if (document.visibilityState !== 'visible') return;

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
                this.wakeLock = null;
                if (document.visibilityState === 'visible') {
                    setTimeout(() => this.requestWakeLock(), 1000);
                }
            });
        } catch (err) { /* 静默 */ }
    }

    setupVisibilityHandler() {
        if (this._visibilityHandlerInstalled) return;
        this._visibilityHandlerInstalled = true;

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.requestWakeLock();
                // 切回前台时立即兜底 catch-up
                this.catchUpProactive().catch(() => {});
                // 真保活激活时,切回前台若 audio 暂停了立即恢复
                if (this.keepAliveActive) {
                    this.resumeKeepAliveAudio();
                }
            }
        });
    }

    /**
     * 切回前台时立即扫描所有 overdue 的 proactive 任务并立刻触发,
     * 弥补后台期间无法触发的心跳。
     */
    async catchUpProactive() {
        try {
            const { useChatStore } = await import('../stores/chatStore.js');
            const chatStore = useChatStore();
            const chats = chatStore.chats;
            if (!chats) return;
            Object.keys(chats).forEach(chatId => {
                chatStore.checkProactive(chatId);
            });
        } catch (e) { /* 静默 */ }
    }

    /**
     * 兼容老调用:开启"基础保活"(wake lock + visibility),不需要用户手势,
     * 适合 PWA 启动时自动调用。
     */
    enable() {
        this.init();
        this.requestWakeLock();
    }

    /**
     * 真保活:用户手势触发。创建一个真实播放的 audio 元素 + MediaSession,
     * 让手机通知栏显示媒体卡片。
     *
     * @param {object} [meta] - 媒体卡片元数据
     * @param {string} [meta.title] - 标题
     * @param {string} [meta.artist] - 艺术家
     * @param {string} [meta.album] - 专辑
     * @param {string} [meta.icon] - 封面图 URL
     * @returns {Promise<{ok: boolean, reason?: string}>}
     */
    async enableRealKeepAlive(meta = {}) {
        // 避免重复开启
        if (this.keepAliveActive) {
            return { ok: true, reason: 'already_active' };
        }

        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return { ok: false, reason: 'no_window' };
        }

        // 1. 创建 audio 元素
        const audio = new Audio(KEEP_ALIVE_AUDIO_URL);
        audio.loop = true;
        audio.volume = 0.02;            // 关键:不是 0,浏览器才会认为是真实播放
        audio.preload = 'auto';
        audio.playsInline = true;
        audio.setAttribute('playsinline', '');
        audio.muted = false;            // 必须是 false
        // 一些浏览器需要这个属性
        audio.crossOrigin = 'anonymous';

        // 2. 监听加载错误
        audio.addEventListener('error', (e) => {
            this.log('[KeepAlive] audio load error', 'error');
        });

        // 3. 真实播放(必须在用户手势栈中调用)
        try {
            await audio.play();
        } catch (err) {
            // NotAllowedError = 缺少用户手势 / autoplay 拒绝
            this.log(`[KeepAlive] play failed: ${err && err.name || err}`, 'error');
            return {
                ok: false,
                reason: err && err.name === 'NotAllowedError' ? 'need_user_gesture' : 'play_failed'
            };
        }

        // 4. 设置 MediaSession metadata,通知栏出现媒体卡片
        if ('mediaSession' in navigator) {
            try {
                const iconUrl = meta.icon || '/pwa-192x192.png';
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: meta.title || 'qiaoqiao-phone',
                    artist: meta.artist || '后台保活中',
                    album: meta.album || 'qiaoqiao',
                    artwork: [
                        { src: iconUrl, sizes: '192x192', type: 'image/png' }
                    ]
                });

                // 媒体卡片 action handler
                const playHandler = () => { audio.play().catch(() => {}); };
                const pauseHandler = () => { /* 不要真的暂停,会失去保活 */ };
                try { navigator.mediaSession.setActionHandler('play', playHandler); } catch (e) {}
                try { navigator.mediaSession.setActionHandler('pause', pauseHandler); } catch (e) {}
                // 接到播放状态变化
                const updateState = () => {
                    try { navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'; } catch (e) {}
                };
                audio.addEventListener('play', updateState);
                audio.addEventListener('pause', updateState);
                updateState();
            } catch (e) {
                this.log(`[KeepAlive] mediaSession error: ${e && e.message || e}`, 'error');
            }
        }

        // 5. 自动续播:浏览器可能因为后台 / 内存压力 / 解码错误等原因 pause,这里强制续
        const resume = () => {
            if (!this.keepAliveActive) return;
            if (audio.paused || audio.ended) {
                audio.play().catch(() => { /* 静默 */ });
            }
        };
        audio.addEventListener('pause', resume);
        audio.addEventListener('ended', resume);
        // 兜底轮询(每 3 秒检查一次,部分 Android 浏览器后台暂停后不会触发事件)
        this.keepAliveMonitorTimer = setInterval(resume, 3000);

        // 6. 切到后台后立刻尝试恢复(部分浏览器在 visibilitychange=hidden 时会暂停 audio)
        this.keepAliveVisibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                // 立即尝试续播
                resume();
                // 同时把 playbackRate 轻微扰动,绕过部分浏览器的"无音频"检测
                try {
                    audio.playbackRate = 0.99;
                    setTimeout(() => { audio.playbackRate = 1.0; }, 200);
                } catch (e) {}
            } else if (document.visibilityState === 'visible') {
                resume();
            }
        };
        document.addEventListener('visibilitychange', this.keepAliveVisibilityHandler);

        // 7. 防止页面卸载时被回收
        try {
            document.body.appendChild(audio);
        } catch (e) { /* 静默 */ }

        this.keepAliveAudio = audio;
        this.keepAliveActive = true;

        // 8. 同时申请 wake lock,前台时屏幕不熄
        this.requestWakeLock();

        this.log('[KeepAlive] enabled', 'info');
        return { ok: true };
    }

    /**
     * 关闭真保活
     */
    disableRealKeepAlive() {
        if (!this.keepAliveActive) return;

        this.keepAliveActive = false;

        if (this.keepAliveMonitorTimer) {
            clearInterval(this.keepAliveMonitorTimer);
            this.keepAliveMonitorTimer = null;
        }

        if (this.keepAliveVisibilityHandler) {
            document.removeEventListener('visibilitychange', this.keepAliveVisibilityHandler);
            this.keepAliveVisibilityHandler = null;
        }

        if (this.keepAliveAudio) {
            try {
                this.keepAliveAudio.pause();
                this.keepAliveAudio.removeAttribute('src');
                this.keepAliveAudio.load();
            } catch (e) { /* 静默 */ }
            try {
                if (this.keepAliveAudio.parentNode) {
                    this.keepAliveAudio.parentNode.removeChild(this.keepAliveAudio);
                }
            } catch (e) { /* 静默 */ }
            this.keepAliveAudio = null;
        }

        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.playbackState = 'none';
            } catch (e) { /* 静默 */ }
        }

        this.log('[KeepAlive] disabled', 'info');
    }

    /**
     * 真保活是否激活
     */
    isKeepAliveActive() {
        return this.keepAliveActive;
    }

    /**
     * 强制续播真保活 audio(被 visibilitychange 调用)
     */
    resumeKeepAliveAudio() {
        if (!this.keepAliveActive || !this.keepAliveAudio) return;
        if (this.keepAliveAudio.paused) {
            this.keepAliveAudio.play().catch(() => { /* 静默 */ });
        }
    }

    /**
     * 调度未来某时刻的后台通知 (v1.10.34: Notification Triggers API 已被 Chrome
     * 移除,改用 Web Push,具体实现在 pushService.schedule,本方法仅为兼容保留 no-op)。
     */
    async scheduleNativeNotification() {
        return false;
    }

    /**
     * 扫描所有聊天,预测"下一次"通知应该何时弹 -> 走 Web Push。
     * 真正能穿透 App 完全关闭,跟 backgroundManager 本身的保活无关。
     */
    async computeAndScheduleNextNotification() {
        try {
            const { useChatStore } = await import('../stores/chatStore.js');
            const { useSchedulerStore } = await import('../stores/schedulerStore.js');
            const chatStore = useChatStore();
            const schedulerStore = useSchedulerStore();
            const chats = chatStore.chats;
            if (!chats) return false;

            const now = Date.now();
            const candidates = [];

            Object.keys(chats).forEach(chatId => {
                const chat = chats[chatId];
                if (!chat || chat.hidden) return;
                const chatName = chat.name || 'TA';

                if (Array.isArray(chat.countdowns)) {
                    chat.countdowns.filter(c => c.date > now).forEach(c => {
                        candidates.push({
                            time: c.date, title: chatName,
                            body: c.title || '纪念日到了', chatId, type: 'countdown'
                        });
                    });
                }

                if (chat.proactiveEnabled && chat.proactiveInterval > 0 && chat.proactiveNext > now) {
                    candidates.push({
                        time: chat.proactiveNext, title: chatName,
                        body: `${chatName} 想找你聊聊`, chatId, type: 'proactive'
                    });
                }

                const tasks = schedulerStore.tasks || [];
                tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp > now).forEach(task => {
                    candidates.push({
                        time: task.timestamp, title: chatName,
                        body: task.content || '定时提醒', chatId, type: 'scheduled'
                    });
                });

                const randomConfig = schedulerStore.randomConfigs?.[chatId];
                if (randomConfig && randomConfig.enabled && randomConfig.nextTrigger > now) {
                    candidates.push({
                        time: randomConfig.nextTrigger, title: chatName,
                        body: `${chatName} 想找你聊聊`, chatId, type: 'random'
                    });
                }
            });

            if (candidates.length === 0) return false;

            candidates.sort((a, b) => a.time - b.time);
            const next = candidates[0];

            try {
                const { pushService } = await import('./pushService');
                const result = await pushService.schedule(next.time, {
                    title: next.title, body: next.body, tag: 'proactive-msg',
                    data: { chatId: next.chatId, type: next.type },
                    url: `/wechat?openChat=${encodeURIComponent(next.chatId)}`,
                });
                return !!result?.ok;
            } catch (e) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }

    destroy() {
        this.disableRealKeepAlive();
        if (this.wakeLock) {
            try { this.wakeLock.release(); } catch (e) { /* 静默 */ }
            this.wakeLock = null;
        }
        this.initialized = false;
        this._visibilityHandlerInstalled = false;
    }
}

const backgroundManager = new BackgroundManager();
export default backgroundManager;
export { backgroundManager };
