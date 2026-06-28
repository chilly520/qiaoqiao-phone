// Background keep-alive utility for PWA.
//
// 1.6.5 之前能跑、之后失效的根因是 1.10.1 引入 SW 之后页面生命周期被更激进地评估，
// 加上旧实现里 muted+volume=0 的 <audio> 和 17Hz+gain=0.0001 的 Web Audio
// 都被现代浏览器识别为"静默媒体"直接 pause / suspend,导致 setInterval 跟着
// 被节流到 1 分钟一次。
//
// 这里采用 4 层叠加的"真后台保活"策略,目标是不依赖 visibility 切换、让 JS 在
// 切后台后还能以较高频率跑:
//   1. Web Audio 振荡器 100Hz + gain=0.05 (人耳能听但手机扬声器放不出来),
//      单一 AudioContext 兼任 audio element 角色(让 MediaSession 识别出"在播媒体")
//   2. MediaSession API 声明"正在播放媒体"(让 OS 认为是音乐类 App,放宽限制)
//   3. 周期性 fetch 同源资源(保持网络栈活跃,部分浏览器对活跃连接节流更宽松)
//   4. Notification Triggers API 兜底(页面被 OS 杀掉时,浏览器原生弹通知)
//
// ⚠️ 关键: autoplay policy 要求首次 audio.play() 必须在用户手势上下文中。
// onMounted 里直接调用 play() 会被 NotAllowedError 拦截,所以改成在第一次
// 任意 pointerdown/click/touchstart/keydown 时再启动,启动后保活链路接管。

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

        this.log('Initializing background keep-alive system (v4: real <audio> + mediaSession)...', 'info');
        // 1) 程序化创建 <audio>,挂到 DOM,这是 MediaSession 显示通知卡的必要条件
        this.createAudioElement();
        // 2) 创建 Web Audio 振荡器作为"出声身份"双保险(部分浏览器会同时看 audio 元素和音频节点)
        this.createWebAudioKeepAlive();
        // 3) 注册 MediaSession + 行为回调
        this.setupMediaSession();
        // 4) 网络心跳
        this.startNetworkHeartbeat();
        // 5) 可见性切换
        this.setupVisibilityHandler();
        // 6) 首次手势解锁
        this.setupUserGestureUnlocker();
        // 7) 兜底周期任务
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
     * 程序化创建 <audio> 元素 + 挂到 DOM。
     * 关键: 现代移动浏览器(Edge Mobile / Chrome Android)只在有真实 <audio>/<video>
     * 元素在播放时,才会在通知栏显示媒体卡片并放宽后台 JS 限制。
     * 单独的 Web Audio 振荡器 + MediaSession metadata 不够。
     */
    createAudioElement() {
        try {
            if (this.audio && this.audio.parentNode) return;

            const a = new Audio();
            a.id = 'qiaqiao-keepalive-audio';
            a.src = '/silent.wav';
            a.loop = true;
            // 必须非 0:浏览器会基于 volume 判断是否有可听输出,volume=0 会被识别为静默媒体并 pause
            a.volume = 0.01;
            a.muted = false;
            a.preload = 'auto';
            a.setAttribute('playsinline', '');
            a.setAttribute('webkit-playsinline', '');
            // 隐藏起来但保留在 DOM(部分浏览器要求 audio 元素在文档中)
            a.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(a);

            this.audio = a;
            this.log('<audio> element created and attached to DOM (src=/silent.wav, loop, volume=0.01).', 'info');
        } catch (e) {
            this.log('createAudioElement failed: ' + (e.message || e.name), 'error');
        }
    }

    /**
     * Web Audio 振荡器保活（v4 双保险）：
     * Web Audio 振荡器 + 真实 <audio> 元素双管齐下,确保 OS 真的把页面当媒体 App。
     * 1) 100Hz(人耳能听到但手机扬声器物理响应接近 0)+ gain=0.05, OS 看到有非零音频输出
     * 2) 必须等用户手势才能 resume(),否则被 autoplay policy 静默拦截
     */
    createWebAudioKeepAlive() {
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) {
                this.log('WebAudio not supported in this browser.', 'error');
                return;
            }

            this.audioCtx = new Ctor();
            this.oscillator = this.audioCtx.createOscillator();
            this.gainNode = this.audioCtx.createGain();

            this.oscillator.frequency.value = 100;
            this.oscillator.type = 'sine';
            this.gainNode.gain.value = 0.05;

            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            this.oscillator.start();

            this.log(`WebAudio context created (state=${this.audioCtx.state}). Will resume on first user gesture.`, 'info');
        } catch (e) {
            this.log('WebAudio keep-alive init failed: ' + (e.message || e.name), 'error');
        }
    }

    /**
     * 启动音频 + 更新 MediaSession。在用户手势上下文中调用才能成功。
     * v4: 优先播真实 <audio> 元素,失败再回退到 Web Audio 振荡器 resume。
     */
    async startAudioPlayback() {
        let audioOk = false;
        let ctxOk = false;

        // 1) 真实 <audio> 元素:这是通知栏出现媒体卡片的硬性条件
        if (this.audio) {
            try {
                if (this.audio.paused) {
                    await this.audio.play();
                }
                audioOk = !this.audio.paused;
                if (audioOk) {
                    this.log(`<audio> playing. paused=${this.audio.paused} currentTime=${this.audio.currentTime.toFixed(1)}`, 'info');
                } else {
                    this.log('<audio> still paused after play() call.', 'error');
                }
            } catch (e) {
                this.log('<audio>.play() failed: ' + (e.message || e.name), 'error');
            }
        } else {
            this.log('No <audio> element to play.', 'error');
        }

        // 2) Web Audio 振荡器:作为"出声身份"双保险
        if (this.audioCtx) {
            try {
                if (this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }
                ctxOk = this.audioCtx.state === 'running';
            } catch (e) {
                this.log('AudioContext resume failed: ' + (e.message || e.name), 'error');
            }
        }

        this.isActive = audioOk || ctxOk;
        this.keepAliveWorking = this.isActive;

        if (this.isActive) {
            this.setupMediaSession();
            this.log(`Keep-alive active. audioOk=${audioOk} ctxOk=${ctxOk}`, 'info');
        } else {
            this.log('Both <audio> and AudioContext failed to start.', 'error');
        }

        return this.isActive;
    }

    /**
     * 注册"首次用户手势"监听器,用来解锁 autoplay policy。
     * 用 capture phase + document + 多事件类型,确保不漏任何用户交互。
     */
    setupUserGestureUnlocker() {
        if (this._unlockerInstalled) return;
        this._unlockerInstalled = true;

        const unlock = async (e) => {
            // 防止 click 等合成事件重复触发
            if (this._unlockerFired) return;
            this._unlockerFired = true;

            // 优先调一次(可能会成功,因为这次调用确实在用户手势上下文里)
            const ok = await this.startAudioPlayback();

            // 移除所有 unlock 监听器
            ['pointerdown', 'click', 'touchstart', 'keydown'].forEach(type => {
                document.removeEventListener(type, unlock, true);
            });

            // 广播事件,UI 层可以监听
            window.dispatchEvent(new CustomEvent('keep-alive-unlocked', { detail: { ok } }));

            if (ok) {
                this.log('Autoplay unlocked successfully on first user gesture.', 'info');
            } else {
                this.log('Autoplay still blocked after user gesture, may need direct interaction with audio element.', 'error');
            }
        };

        ['pointerdown', 'click', 'touchstart', 'keydown'].forEach(type => {
            document.addEventListener(type, unlock, { capture: true, passive: true });
        });

        this.log('User gesture unlocker installed. Tap anywhere to start background keep-alive.', 'info');
    }

    /**
     * MediaSession API:声明"正在播放媒体"。
     * 这会让 Android 把页面当作音乐类 App 看待,通知栏出现媒体卡片,
     * 后台 JS 执行被显著放宽(类比 Spotify/网易云在后台保活)。
     * v4: 绑定到真实 <audio> 元素,这是通知栏出现媒体卡片的硬性条件。
     */
    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Chilly Phone',
                artist: 'Proactive Companion',
                album: 'Background Service',
                artwork: [
                    { src: '/pwa-192x192.png?v=4', sizes: '192x192', type: 'image/png' },
                    { src: '/pwa-512x512.png?v=4', sizes: '512x512', type: 'image/png' }
                ]
            });
            // 声明播放状态为 playing,这是关键
            navigator.mediaSession.playbackState = 'playing';

            // 注册 action handlers,让媒体卡片上的按钮能控制 audio
            // (虽然保活场景下我们不希望用户暂停,所以这些是 no-op)
            const noop = () => { /* keep-alive 必须保持 playing */ };
            navigator.mediaSession.setActionHandler('play', () => {
                if (this.audio) this.audio.play().catch(() => {});
            });
            navigator.mediaSession.setActionHandler('pause', noop);
            navigator.mediaSession.setActionHandler('previoustrack', noop);
            navigator.mediaSession.setActionHandler('nexttrack', noop);
            navigator.mediaSession.setActionHandler('seekbackward', noop);
            navigator.mediaSession.setActionHandler('seekforward', noop);
            navigator.mediaSession.setActionHandler('seekto', noop);
            navigator.mediaSession.setActionHandler('stop', noop);

            this.mediaSessionSet = true;
            this.log('MediaSession metadata set (playbackState=playing, action handlers bound to <audio>).', 'info');
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
                this.startAudioPlayback();
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
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
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
        // 尝试启动音频(在用户手势上下文中调用会成功)
        this.startAudioPlayback();
        this.requestWakeLock();
        // enable 也会被用户手势触发,这里再确保 MediaSession 设置一次
        this.setupMediaSession();
        if (!this.checkInterval) this.startCheckInterval();
    }

    startCheckInterval() {
        this.stopCheckInterval();

        this.checkInterval = setInterval(async () => {
            try {
                // 检查 WebAudio 状态,如果被后台挂起就唤醒
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }

                if (this.heartbeatLogCount < 3) {
                    this.log('Running background heartbeat (60s)...', 'info');
                    this.heartbeatLogCount++;
                }
                // 移除每周期重排,避免 CPU spike;通知排程只在 init / visibilitychange 触发
            } catch (error) {
                this.log(`Error in background check: ${error.message}`, 'error');
            }
        }, 60000);

        this.log('Background check interval started (60s)', 'info');
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
        this.callbacks = { onChange: [], onLowBattery: [] };
    }
}

export const backgroundManager = new BackgroundManager();
