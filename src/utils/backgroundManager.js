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
            this.log('Silent audio loop is active (maintaining JS thread).', 'info');
        } catch (e) {
            this.log('Audio play failed (browser policy?): ' + e.message, 'error');
            this.isActive = false;
        }
    }

    /**
     * Requests Screen Wake Lock to prevent screen sleep if supported.
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            // 只有当页面可见时才尝试获取Wake Lock
            if (document.visibilityState !== 'visible') {
                this.log('Skipping Wake Lock request: page is not visible', 'info');
                return;
            }
            
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                this.log('Screen Wake Lock acquired.', 'info');

                this.wakeLock.addEventListener('release', () => {
                    this.log('Wake Lock was released.', 'sys');
                    // Try to re-request if released involuntarily
                    if (document.visibilityState === 'visible') {
                        this.requestWakeLock();
                    }
                });
            } catch (err) {
                this.log(`Wake Lock failed: ${err.name} - ${err.message}`, 'info');
            }
        }
    }

    /**
     * Handles visibility changes (entering/leaving background).
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.log('App returned to foreground. Re-syncing keepers...', 'sys');
                this.playAudio();
                this.requestWakeLock();
                this.startCheckInterval(); // Restart check interval when app is visible
            } else {
                this.log('App entered background. Audio loop maintaining execution.', 'sys');
                // Ensure audio is playing before fully backgrounding
                if (this.audio && this.audio.paused) {
                    this.playAudio();
                }
                // Keep check interval running in background
                // Some browsers may throttle it, but we'll let it run
                this.log('Background check interval continuing in background mode', 'info');
            }
        });
    }

    /**
     * Manual trigger to ensure it starts after user interaction.
     */
    enable() {
        this.init();
        if (this.audio && (this.audio.paused || this.audio.ended)) {
            this.playAudio();
        }
    }

    /**
     * Starts a periodic check interval to trigger proactive messages and other background tasks.
     */
    startCheckInterval() {
        this.stopCheckInterval(); // Clear any existing interval

        this.checkInterval = setInterval(async () => {
            try {
                // Only run checks if the app is active
                if (!this.isActive) return;

                this.log('Running background check for proactive messages...', 'info');
                
                // Try to import and use chatStore
                try {
                    // Use dynamic import for ES modules
                    const { useChatStore } = await import('../stores/chatStore');
                    const chatStore = useChatStore();
                    
                    // Check for all chats
                    if (chatStore.chats && chatStore.chats.value) {
                        Object.keys(chatStore.chats.value).forEach(chatId => {
                            chatStore.checkProactive(chatId);
                        });
                    }
                } catch (e) {
                    // Chat store might not be available yet, or component not mounted
                    this.log(`Chat store not available for background check: ${e.message}`, 'info');
                }
            } catch (error) {
                this.log(`Error in background check: ${error.message}`, 'error');
            }
        }, this.checkIntervalTime);

        this.log(`Background check interval started (${this.checkIntervalTime / 1000}s)`, 'info');
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
