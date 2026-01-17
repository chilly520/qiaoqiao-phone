/**
 * BackgroundManager.js
 * Handles background persistence and wake lock for mobile devices.
 * Uses a silent audio loop to prevent browser from suspending the JS thread.
 */

class BackgroundManager {
    constructor() {
        this.audio = null;
        this.isActive = false;
        this.wakeLock = null;
        this.initialized = false;
    }

    /**
     * Initialize background persistence logic.
     * Must be called after a user interaction (click/touch).
     */
    init() {
        if (this.initialized) return;

        console.log('[BackgroundManager] Initializing keep-alive...');
        this.createAudioLoop();
        this.setupVisibilityHandler();
        this.requestWakeLock();

        this.initialized = true;
    }

    /**
     * Creates a silent audio loop to trick mobile browsers into keeping the app alive.
     */
    createAudioLoop() {
        // A very short silent WAV file (1 pixel worth of audio)
        const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";

        this.audio = new Audio(silentWav);
        this.audio.loop = true;
        this.audio.volume = 0.01; // Nearly silent

        // Start playing immediately
        this.playAudio();
    }

    async playAudio() {
        if (!this.audio) return;
        try {
            await this.audio.play();
            this.isActive = true;
            console.log('[BackgroundManager] Silent audio loop started.');
        } catch (e) {
            console.warn('[BackgroundManager] Audio play failed (policy?):', e);
            this.isActive = false;
        }
    }

    /**
     * Requests Screen Wake Lock to prevent screen sleep if supported.
     */
    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('[BackgroundManager] Wake Lock active.');

                this.wakeLock.addEventListener('release', () => {
                    console.log('[BackgroundManager] Wake Lock released.');
                    // Try to re-request if released involuntarily (e.g. backgrounded then foregrounded)
                    if (document.visibilityState === 'visible') {
                        this.requestWakeLock();
                    }
                });
            } catch (err) {
                console.warn('[BackgroundManager] Wake Lock failed:', err.name, err.message);
            }
        }
    }

    /**
     * Handles visibility changes (entering/leaving background).
     */
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('[BackgroundManager] App returned to foreground.');
                this.playAudio();
                this.requestWakeLock();
            } else {
                console.log('[BackgroundManager] App entered background. Audio loop maintaining thread.');
            }
        });
    }

    /**
     * Manual trigger to ensure it starts after user interaction.
     */
    enable() {
        this.init();
        if (this.audio && this.audio.paused) {
            this.playAudio();
        }
    }
}

export const backgroundManager = new BackgroundManager();
