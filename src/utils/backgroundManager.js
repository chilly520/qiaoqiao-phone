import { useLoggerStore } from '../stores/loggerStore';

class BackgroundManager {
    constructor() {
        this.audio = null;
        this.isActive = false;
        this.wakeLock = null;
        this.initialized = false;
        this.logger = null;
        this.checkInterval = null;
        this.checkIntervalTime = 60000; // 1分钟检查一次
        this.audioLogCount = 0; // 限制音频日志频率
        this.heartbeatLogCount = 0; // 限制心跳日志频率
        this.wakeLockLogged = false; // 限制 Wake Lock 日志
        this.visibilityLogged = false; // 限制 visibility 日志
    }

    /**
     * Initialize background persistence logic.
     * Must be called after a user interaction (click/touch).
     */
    init() {
        if (!this.logger) {
            try { this.logger = useLoggerStore(); } catch (e) { /* Early init */ }
        }

        if (this.initialized) return;

        this.log('Initializing background keep-alive system...', 'info');
        this.createAudioLoop();
        this.setupVisibilityHandler();
        this.requestWakeLock();
        this.startCheckInterval();

        this.initialized = true;
    }

    log(message, level = 'sys') {
        console.log(`[BackgroundManager] ${message}`);
        if (this.logger) {
            if (level === 'info' || level === 'sys') this.logger.sys(message);
            else if (level === 'error') this.logger.error(message);
        }
    }

    /**
     * Creates a silent audio loop to trick mobile browsers into keeping the app alive.
     */
    createAudioLoop() {
        // A short silent WAV file
        const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";

        this.audio = new Audio(silentWav);
        this.audio.loop = true;
        this.audio.volume = 0.01;

        // Important for iOS: must be initiated by user gesture then re-played on visibility change
        this.playAudio();
    }

    async playAudio() {
        if (!this.audio) return;
        try {
            await this.audio.play();
            this.isActive = true;
            // 只在前3次打印日志，之后静默
            if (this.audioLogCount < 3) {
                this.log('Silent audio loop is active (maintaining JS thread).', 'info');
                this.audioLogCount++;
            }
        } catch (e) {
            // Only log error if not actively paused by logic
            if (e.name !== 'AbortError' && this.audioLogCount < 3) {
                this.log('Audio play failed (waiting for user gesture): ' + e.message, 'info');
                this.audioLogCount++;
            }
            this.isActive = false;
        }
    }

    /**
     * Requests Screen Wake Lock to prevent screen sleep if supported.
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            if (this.wakeLock) return; // Already have it

            // 只有当页面可见时才尝试获取Wake Lock
            if (document.visibilityState !== 'visible') {
                return;
            }
            
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                if (!this.wakeLockLogged) {
                    this.log('Screen Wake Lock acquired.', 'info');
                    this.wakeLockLogged = true;
                }

                this.wakeLock.addEventListener('release', () => {
                    this.wakeLock = null;
                    // Wake Lock 释放日志只在调试时需要，日常静默
                    // Try to re-request if released involuntarily
                    if (document.visibilityState === 'visible') {
                        setTimeout(() => this.requestWakeLock(), 1000);
                    }
                });
            } catch (err) {
                // Ignore silent failures
            }
        }
    }

    /**
     * Handles visibility changes (entering/leaving background).
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!this.visibilityLogged) {
                    this.log('App returned to foreground. Re-syncing keepers...', 'sys');
                }
                this.playAudio();
                this.requestWakeLock();
            } else {
                if (!this.visibilityLogged) {
                    this.log('App entered background. Audio loop maintaining execution.', 'sys');
                    this.visibilityLogged = true; // 只打印一次
                }
                // Ensure audio is playing before fully backgrounding
                if (this.audio) {
                    this.playAudio();
                }
            }
        });
    }

    /**
     * Manual trigger to ensure it starts after user interaction.
     */
    enable() {
        this.init();
        if (this.audio) {
            this.playAudio();
        }
        this.requestWakeLock();
    }

    /**
     * Starts a periodic check interval to trigger proactive messages and other background tasks.
     */
    startCheckInterval() {
        this.stopCheckInterval(); // Clear any existing interval

        this.checkInterval = setInterval(async () => {
            try {
                // Heartbeat: Try to ensure audio is playing
                if (this.audio && this.audio.paused) {
                    this.playAudio();
                }

                // If audio failed and hasn't recovered, isActive might be false
                // But we still try to run checks if possible
                
                // 只在前3次打印心跳日志
                if (this.heartbeatLogCount < 3) {
                    this.log('Running background heartbeat...', 'info');
                    this.heartbeatLogCount++;
                }
                
                // Try to import and use chatStore
                try {
                    // Use dynamic import for ES modules
                    const { useChatStore } = await import('../stores/chatStore.js');
                    const chatStore = useChatStore();
                    
                    // Check for all chats
                    // Pinia stores unwrap refs, so .value is not needed on the store instance
                    const chats = chatStore.chats;
                    if (chats) {
                        Object.keys(chats).forEach(chatId => {
                            chatStore.checkProactive(chatId);
                        });
                    }
                } catch (e) {
                    // Chat store might not be available yet, or component not mounted
                    // 静默处理，不打印日志避免刷屏
                }
            } catch (error) {
                this.log(`Error in background check: ${error.message}`, 'error');
            }
        }, 20000); // 20秒检查一次，更频繁的保活

        this.log('Background check interval started (20s)', 'info');
    }

    /**
     * Stops the periodic check interval.
     */
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
            checkInterval: !!this.checkInterval
        };
    }
}

export const backgroundManager = new BackgroundManager();
