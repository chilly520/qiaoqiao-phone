// Background utility for PWA.
//
// 之前的 silent.wav + MediaSession + Web Audio 振荡器那一套"假保活"在现代
// 移动浏览器（Chrome Android / iOS Safari / Edge Mobile）下都没生效：
// - 静默媒体（volume≈0 / gain≈0）会被浏览器识别为"无音频输出"直接 pause / suspend
// - 即便 audio 真的在播,MediaSession 通知卡也不一定显示（依赖浏览器策略 + 真实播放）
// - 用户在通知栏里根本看不到媒体卡片,JS 切后台后依然被节流到 1 分钟一次
//
// 所以 v1.10.46 起移除所有"假保活"代码，只保留两个真正有用的部分：
//   1. Screen Wake Lock  - 前台时不熄屏（Android Chrome 有效,iOS 静默降级）
//   2. visibilitychange - 监听前后台切换,回到前台时 catchUpProactive 兜底触发
// 真正能穿透 App 完全关闭的是 Web Push（pushService.schedule），由 chatStore
// 的 proactive / scheduler / 定时任务模块调用,跟 backgroundManager 无关。

import { useLoggerStore } from '../stores/loggerStore';

class BackgroundManager {
    constructor() {
        this.wakeLock = null;
        this.initialized = false;
        this.logger = null;
        // 后台保活工作状态，供 UI 显示（恒为 false：现代浏览器已无可靠保活手段）
        this.keepAliveWorking = false;
    }

    init() {
        if (!this.logger) {
            try { this.logger = useLoggerStore(); } catch (e) { /* Early init */ }
        }

        if (this.initialized) return;

        // 只挂可见性切换 + 唤醒锁,不玩 audio / mediaSession 那一套了
        this.setupVisibilityHandler();
        this.initialized = true;
    }

    log(message, level = 'sys') {
        // 后台保活相关的日志基本只剩可见性切换,默认 debug 不刷屏
        if (this.logger && level !== 'debug') {
            if (level === 'info' || level === 'sys') this.logger.sys(message);
            else if (level === 'error') this.logger.error(message);
        }
    }

    /**
     * Screen Wake Lock：前台时阻止屏幕熄灭（仅 Android Chrome 有效,iOS Safari 不支持）。
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
                // 切回前台时立即兜底 catch-up,补齐后台期间被节流掉的所有 proactive / 定时任务
                this.catchUpProactive().catch(() => {});
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
     * 兼容老调用：v1.10.46 之前 App.vue / 各种 hook 会调 enable() 来触发保活链路,
     * 现在只剩 wake lock 一件事,enable() 退化为幂等的 init + requestWakeLock。
     */
    enable() {
        this.init();
        this.requestWakeLock();
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

                // 1. 倒数日
                if (Array.isArray(chat.countdowns)) {
                    chat.countdowns.filter(c => c.date > now).forEach(c => {
                        candidates.push({
                            time: c.date, title: chatName,
                            body: c.title || '纪念日到了', chatId, type: 'countdown'
                        });
                    });
                }

                // 2. proactive 间隔
                if (chat.proactiveEnabled && chat.proactiveInterval > 0 && chat.proactiveNext > now) {
                    candidates.push({
                        time: chat.proactiveNext, title: chatName,
                        body: `${chatName} 想找你聊聊`, chatId, type: 'proactive'
                    });
                }

                // 3. 定时任务
                const tasks = schedulerStore.tasks || [];
                tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp > now).forEach(task => {
                    candidates.push({
                        time: task.timestamp, title: chatName,
                        body: task.content || '定时提醒', chatId, type: 'scheduled'
                    });
                });

                // 4. 随机 proactive
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

            // 优先通过 Web Push 后端调度
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
