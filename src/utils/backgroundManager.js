// Background keep-alive utility for PWA.
//
// 1.6.5 之前能跑、之后失效的根因是 1.10.1 引入 SW 之后页面生命周期被更激进地评估，
// 加上旧实现里 muted+volume=0 的 <audio> 和 17Hz+gain=0.0001 的 Web Audio
// 都被现代浏览器识别为"静默媒体"直接 pause / suspend,导致 setInterval 跟着
// 被节流到 1 分钟一次。
//
// 这里采用 4 层叠加的"真后台保活"策略,目标是不依赖 visibility 切换、让 JS 在
// 切后台后还能以较高频率跑:
//   1. <audio> 低音量不 muted (volume=0.01,让浏览器认为有真实音频流)
//   2. Web Audio 振荡器 100Hz + gain=0.05 (人耳能听但手机扬声器放不出来)
//   3. MediaSession API 声明"正在播放媒体"(让 OS 认为是音乐类 App,放宽限制)
//   4. 周期性 fetch 同源资源(保持网络栈活跃,部分浏览器对活跃连接节流更宽松)
//   5. Notification Triggers API 兜底(页面被 OS 杀掉时,浏览器原生弹通知)
//
// 配合已有的 visibilitychange 切回前台 catch-up,这套组合在 Android Chrome/Edge
// 上能拿到接近 1.6.5 时代的保活效果。

import { useLoggerStore } from '../stores/loggerStore';

class BackgroundManager {
    constructor() {
        this.audio = null;
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isActive = false;
        this.wakeLock = null;
        this.initialized = false;
        this.logger = null;
        this.checkInterval = null;
        this.checkIntervalTime = 60000; // 1分钟检查一次
        this.networkHeartbeatTimer = null;
        this.audioLogCount = 0;
        this.heartbeatLogCount = 0;
        this.wakeLockLogged = false;
        this.visibilityLogged = false;
        this.mediaSessionSet = false;
        // 后台保活工作状态，供 UI 显示
        this.keepAliveWorking = null; // null=未知, true=工作中, false=失效
    }

    init() {
        if (!this.logger) {
            try { this.logger = useLoggerStore(); } catch (e) { /* Early init */ }
        }

        if (this.initialized) return;

        this.log('Initializing background keep-alive system (v2: media-session + audible audio + network heartbeat)...', 'info');
        this.createAudioLoop();
        this.createWebAudioKeepAlive();
        this.setupMediaSession();
        this.startNetworkHeartbeat();
        this.setupVisibilityHandler();
        this.requestWakeLock();
        this.startCheckInterval();

        this.initialized = true;

        // 首次排程下一次原生系统通知(Chrome/Edge Android 才有效,iOS/Firefox 静默返回 false)
        this.computeAndScheduleNextNotification().catch(() => {});
    }

    log(message, level = 'sys') {
        console.log(`[BackgroundManager] ${message}`);
        if (this.logger) {
            if (level === 'info' || level === 'sys') this.logger.sys(message);
            else if (level === 'error') this.logger.error(message);
        }
    }

    /**
     * <audio> 保活：v1 的核心思路,但去掉 muted+volume=0 这种"明显静默"组合,
     * 改成 volume=0.01 + 不 muted,让浏览器认为这是一个真实在播的音频流。
     * 0.01 音量在手机扬声器上几乎听不到,但 audio graph 是活跃的,
     * 后台节流策略会宽松很多。
     */
    createAudioLoop() {
        const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

        this.audio = new Audio(silentWav);
        this.audio.loop = true;
        // [FIX] 不再 muted + volume=0,改为极低音量,绕开浏览器的"静默媒体"检测
        this.audio.muted = false;
        this.audio.volume = 0.01;
        this.audio.setAttribute('playsinline', '');
        this.audio.setAttribute('webkit-playsinline', '');

        this.playAudio();
    }

    async playAudio() {
        if (!this.audio) return;
        try {
            await this.audio.play();
            this.isActive = true;
            if (this.audioLogCount < 3) {
                this.log('Audio loop active (vol=0.01, unmuted).', 'info');
                this.audioLogCount++;
            }
        } catch (e) {
            if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
                return; // 静默，不改 isActive
            }
            if (this.audioLogCount < 3) {
                this.log('Audio play failed: ' + (e.message || e.name), 'error');
                this.audioLogCount++;
            }
            this.isActive = false;
        }
    }

    /**
     * Web Audio API 振荡器保活（v2 升级）：
     * 旧版用 17Hz + gain=0.0001,被现代浏览器识别为"无音频输出"直接 suspend。
     * 新版用 100Hz(人耳能听到但手机扬声器物理响应接近 0)+ gain=0.05,
     * 让 OS/浏览器认为这是一个真实活跃的音频流。
     *
     * 为什么是 100Hz:
     *  - 20-20000Hz 是人耳范围,100Hz 位于中间,理论上可闻
     *  - 但典型手机扬声器对 100Hz 以下的物理响应非常差(几乎放不出来)
     *  - 在普通环境下用户听不到,但 OS 看到的是有非零音频输出
     */
    createWebAudioKeepAlive() {
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return;

            this.audioCtx = new Ctor();
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();

            // [FIX] 100Hz + gain=0.05,让浏览器认为有真实音频流
            this.oscillator.frequency.value = 100;
            this.oscillator.type = 'sine';
            this.gainNode.gain.value = 0.05;

            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            this.oscillator.start();

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }

            this.log(`WebAudio keep-alive active (100Hz, gain=0.05, state=${this.audioCtx.state}).`, 'info');
        } catch (e) {
            this.log('WebAudio keep-alive init failed: ' + (e.message || e.name), 'error');
        }
    }

    /**
     * MediaSession API:声明"正在播放媒体"。
     * 这会让 Android 把页面当作音乐类 App 看待,通知栏出现媒体卡片,
     * 后台 JS 执行被显著放宽(类比 Spotify/网易云在后台保活)。
     */
    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        if (this.mediaSessionSet) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: '乔乔手机',
                artist: 'Proactive Companion',
                album: 'Background Service',
                artwork: [
                    { src: '/pwa-192x192.jpg', sizes: '192x192', type: 'image/jpeg' },
                    { src: '/pwa-512x512.jpg', sizes: '512x512', type: 'image/jpeg' }
                ]
            });
            // 声明播放状态为 playing,这是关键
            navigator.mediaSession.playbackState = 'playing';
            this.mediaSessionSet = true;
            this.log('MediaSession metadata set (playbackState=playing).', 'info');
        } catch (e) {
            this.log('MediaSession setup failed: ' + (e.message || e.name), 'error');
        }
    }

    /**
     * 网络心跳:周期性 fetch 同源资源,保持网络栈活跃。
     * Chrome 对有活跃网络请求/连接的页面,后台节流策略更宽松。
     * 同源 fetch 不会消耗外部 API 配额。
     */
    startNetworkHeartbeat() {
        if (this.networkHeartbeatTimer) return;
        const ping = () => {
            // 用 HEAD 拉个同源小资源,失败也无害
            fetch('/sw.js?v=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
                .catch(() => { /* 静默 */ });
        };
        // 立即打一发,之后每 25s 一次
        ping();
        this.networkHeartbeatTimer = setInterval(ping, 25000);
        this.log('Network heartbeat started (25s interval).', 'info');
    }

    stopNetworkHeartbeat() {
        if (this.networkHeartbeatTimer) {
            clearInterval(this.networkHeartbeatTimer);
            this.networkHeartbeatTimer = null;
        }
    }

    /**
     * 屏幕唤醒锁：仅在前台有效，页面隐藏后浏览器自动释放。
     */
    async requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        if (this.wakeLock) return;
        if (document.visibilityState !== 'visible') return;

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            if (!this.wakeLockLogged) {
                this.log('Screen Wake Lock acquired.', 'info');
                this.wakeLockLogged = true;
            }
            this.wakeLock.addEventListener('release', () => {
                this.wakeLock = null;
                if (document.visibilityState === 'visible') {
                    setTimeout(() => this.requestWakeLock(), 1000);
                }
            });
        } catch (err) { /* 静默 */ }
    }

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.visibilityLogged) {
                    this.log('App returned to foreground. Re-syncing keepers...', 'sys');
                    this.visibilityLogged = false; // 重置以便下次切走时再打
                }
                this.playAudio();
                this.requestWakeLock();
                this.setupMediaSession();

                // 切回前台时立即兜底 catch-up
                this.catchUpProactive().catch(() => {});

                // 唤醒可能因后台被挂起的 WebAudio
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }

                // 重新排程下一次原生系统通知(因为期间可能已经过期触发)
                this.computeAndScheduleNextNotification().catch(() => {});
            } else {
                if (!this.visibilityLogged) {
                    this.log('App entered background. Keep-alive chain (audio + mediaSession + heartbeat) should keep JS alive.', 'sys');
                    this.visibilityLogged = true;
                }
            }
        });
    }

    /**
     * 切回前台时立即扫描所有 overdue 的 proactive 任务并立刻触发，
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
            this.log('[CatchUp] Scanned all chats for missed triggers.', 'info');
        } catch (e) { /* 静默 */ }
    }

    /**
     * 通过 Notification Triggers API 在指定时间后台弹出系统通知。
     * 这是当前唯一能在手机后台真弹出系统通知的纯前端方案。
     *
     * 用法：在 proactive 逻辑里检测到下一次触发时间时，调用
     *   backgroundManager.scheduleNativeNotification(triggerTime, title, options)
     * 浏览器会原生在那个时间点弹通知——完全不需要页面在跑 JS。
     *
     * 注意：
     *  - 仅 Chrome/Edge 支持，Safari/Firefox 不支持
     *  - 一次只能排一个 trigger，同 tag 会被覆盖
     *  - 需要 SW 已激活 + 用户已授予通知权限
     */
    async scheduleNativeNotification(triggerTime, title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return false;
        }
        if (!('showTrigger' in Notification.prototype)) {
            // 当前浏览器不支持 Notification Triggers API（iOS/Firefox 走这里）
            return false;
        }
        try {
            if (!('serviceWorker' in navigator)) return false;
            const reg = await navigator.serviceWorker.ready;
            if (!reg || !reg.showNotification) return false;

            // 触发时间必须 >= now + ~5s,否则浏览器会拒绝
            const minTime = Date.now() + 5000;
            const fireTime = Math.max(triggerTime, minTime);

            await reg.showNotification(title, {
                icon: '/pwa-192x192.jpg',
                badge: '/pwa-192x192.jpg',
                tag: options.tag || 'proactive',
                renotify: true,
                showTrigger: new TimestampTrigger(fireTime),
                ...options
            });
            return true;
        } catch (e) {
            this.log('scheduleNativeNotification failed: ' + (e.message || e.name), 'error');
            return false;
        }
    }

    /**
     * 扫描所有聊天，预测"下一次"原生系统通知应该何时弹。
     * 取所有候选时间最早的 1 个，调用 scheduleNativeNotification 排程。
     *
     * 因为 Notification Triggers API 一次只能排一个 trigger 且会被覆盖，
     * 我们只关心"最近一次要发生的 proactive 事件"，到了之后再重排。
     */
    async computeAndScheduleNextNotification() {
        // iOS / Firefox 直接静默跳过,不影响前台逻辑
        if (!('showTrigger' in (typeof Notification !== 'undefined' ? Notification.prototype : {}))) {
            return false;
        }
        try {
            const { useChatStore } = await import('../stores/chatStore.js');
            const { useSchedulerStore } = await import('../stores/schedulerStore.js');
            const chatStore = useChatStore();
            const schedulerStore = useSchedulerStore();
            const chats = chatStore.chats;
            if (!chats) return false;

            const now = Date.now();
            const candidates = [];
            const MIN_LEAD = 30000; // 至少 30 秒后,避免 Chrome 拒绝

            Object.keys(chats).forEach(chatId => {
                const chat = chats[chatId];
                if (!chat) return;

                const chatName = chat.name || chat.remark || '新消息';
                const userMsgs = (chat.msgs || []).filter(m => m.role === 'user');
                const lastUserMsg = userMsgs.slice(-1)[0];
                const lastMsgTime = lastUserMsg ? lastUserMsg.timestamp : now;

                // 1. activeChat: 用户不在该聊天时的主动关怀
                if (chat.activeChat && chatStore.currentChatId !== chatId) {
                    const aInterval = parseInt(chat.activeInterval) || 120;
                    const lastTrigger = chat._lastActiveTriggeredTime || 0;
                    // 取 max:最后一条用户消息后+间隔, 或上次触发后+间隔
                    const earliest = Math.max(
                        lastMsgTime + aInterval * 60000,
                        lastTrigger + aInterval * 60000,
                        now + MIN_LEAD
                    );
                    if (earliest > now) {
                        candidates.push({
                            time: earliest,
                            title: chatName,
                            body: `${chatName} 想你了,过来看看`,
                            chatId,
                            type: 'active'
                        });
                    }
                }

                // 2. proactiveChat: 用户在该聊天但闲置时
                if (chat.proactiveChat && chatStore.currentChatId === chatId) {
                    const pInterval = parseInt(chat.proactiveInterval) || 30;
                    const lastTrigger = chat._lastProactiveTriggeredTime || 0;
                    const earliest = Math.max(
                        lastMsgTime + pInterval * 60000,
                        lastTrigger + pInterval * 60000,
                        now + MIN_LEAD
                    );
                    if (earliest > now) {
                        candidates.push({
                            time: earliest,
                            title: chatName,
                            body: `${chatName} 想说点什么`,
                            chatId,
                            type: 'proactive'
                        });
                    }
                }

                // 3. 定时任务
                const tasks = schedulerStore.tasks || [];
                tasks.filter(t => t.enabled && t.chatId === chatId && t.timestamp > now).forEach(task => {
                    candidates.push({
                        time: task.timestamp,
                        title: chatName,
                        body: task.content || '定时提醒',
                        chatId,
                        type: 'scheduled'
                    });
                });

                // 4. 随机 proactive
                const randomConfig = schedulerStore.randomConfigs?.[chatId];
                if (randomConfig && randomConfig.enabled && randomConfig.nextTrigger > now) {
                    candidates.push({
                        time: randomConfig.nextTrigger,
                        title: chatName,
                        body: `${chatName} 想找你聊聊`,
                        chatId,
                        type: 'random'
                    });
                }
            });

            if (candidates.length === 0) {
                this.log('[Proactive] No future trigger candidates, skipping schedule.', 'info');
                return false;
            }

            candidates.sort((a, b) => a.time - b.time);
            const next = candidates[0];

            this.log(
                `[Proactive] Scheduling native notif for ${next.title} at ${new Date(next.time).toLocaleString()} (type=${next.type})`,
                'info'
            );

            return await this.scheduleNativeNotification(next.time, next.title, {
                body: next.body,
                tag: 'proactive-msg', // 同 tag 会被替换,只保留最近一次
                data: { chatId: next.chatId, type: next.type }
            });
        } catch (e) {
            this.log('computeAndScheduleNextNotification failed: ' + (e.message || e.name), 'error');
            return false;
        }
    }

    enable() {
        this.init();
        if (this.audio) this.playAudio();
        this.requestWakeLock();
        // enable 也会被用户手势触发,这里再确保 MediaSession 设置一次
        this.setupMediaSession();
        if (!this.checkInterval) this.startCheckInterval();
    }

    startCheckInterval() {
        this.stopCheckInterval();

        this.checkInterval = setInterval(async () => {
            try {
                if (this.audio && this.audio.paused) this.playAudio();

                if (this.heartbeatLogCount < 3) {
                    this.log('Running background heartbeat...', 'info');
                    this.heartbeatLogCount++;
                }

                try {
                    const { useChatStore } = await import('../stores/chatStore.js');
                    const chatStore = useChatStore();
                    const chats = chatStore.chats;
                    if (chats) {
                        Object.keys(chats).forEach(chatId => {
                            chatStore.checkProactive(chatId);
                        });
                    }
                } catch (e) { /* 静默 */ }

                // 周期性地重排下一次原生系统通知,保证状态变化后下一次排程是最新的
                this.computeAndScheduleNextNotification().catch(() => {});
            } catch (error) {
                this.log(`Error in background check: ${error.message}`, 'error');
            }
        }, 20000);

        this.log('Background check interval started (20s)', 'info');
    }

    stopCheckInterval() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.log('Background check interval stopped', 'info');
        }
    }

    getStatus() {
        return {
            active: this.isActive,
            initialized: this.initialized,
            wakeLock: !!this.wakeLock,
            checkInterval: !!this.checkInterval,
            networkHeartbeat: !!this.networkHeartbeatTimer,
            audioContextState: this.audioCtx ? this.audioCtx.state : 'unsupported',
            mediaSessionSet: this.mediaSessionSet,
            keepAliveWorking: this.keepAliveWorking,
            supportsNotificationTriggers: 'showTrigger' in (typeof Notification !== 'undefined' ? Notification.prototype : {})
        };
    }

    destroy() {
        this.stopCheckInterval();
        this.stopNetworkHeartbeat();
        try { if (this.oscillator) this.oscillator.stop(); } catch (e) {}
        try { if (this.audioCtx) this.audioCtx.close(); } catch (e) {}
        if (this.wakeLock) {
            try { this.wakeLock.release(); } catch (e) {}
            this.wakeLock = null;
        }
        if (this.audio) {
            try { this.audio.pause(); this.audio.src = ''; } catch (e) {}
        }
        this.callbacks = { onChange: [], onLowBattery: [] };
    }
}

export const backgroundManager = new BackgroundManager();
