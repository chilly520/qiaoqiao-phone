
import { useLoggerStore } from '../../stores/loggerStore'

export class RequestQueue {
    constructor(maxRate = 8, interval = 10000) {
        this.queue = [];
        this.isProcessing = false;
        this.timestamps = []; // Request timestamps for rate limiting

        this.maxRate = maxRate;
        this.interval = interval;

        // Circuit Breaker for 429
        this.isRateLimited = false;
        this.retryAfter = 0;
    }

    // Add request to queue
    enqueue(apiFunc, args, abortSignal) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                apiFunc,
                args,
                abortSignal,
                resolve,
                reject
            });
            this.processQueue();
        });
    }

    // Trigger explicit rate limit cooldown
    triggerRateLimit(cooldownMs = 300000) { // Default 5 minutes
        this.isRateLimited = true;
        this.retryAfter = Date.now() + cooldownMs;
        const logger = useLoggerStore();
        if (logger) {
            logger.addLog('ERROR', `API触发速率限制 (429 / Quota)，系统将暂停请求 ${(cooldownMs / 1000).toFixed(0)} 秒`, { retryAfter: new Date(this.retryAfter).toLocaleTimeString() });
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        const now = Date.now();

        // 1. Check Circuit Breaker
        if (this.isRateLimited) {
            if (now < this.retryAfter) {
                // Still in cooldown
                const remaining = Math.ceil((this.retryAfter - now) / 1000);
                if (Math.random() > 0.9) { // Log occasionally to avoid spam
                    console.log(`[RateLimit] Circuit Breaker Active.Waiting ${remaining}s...`);
                }
                setTimeout(() => this.processQueue(), 5000); // Check again in 5s
                return;
            } else {
                // Cooldown over
                this.isRateLimited = false;
                console.log('[RateLimit] Circuit Breaker Reset.');
            }
        }

        // 2. Check Standard Rate Limit
        // Filter out timestamps older than the interval
        this.timestamps = this.timestamps.filter(t => now - t < this.interval);

        if (this.timestamps.length >= this.maxRate) {
            // Rate limited. Wait until the oldest timestamp expires.
            const oldest = this.timestamps[0];
            const waitTime = this.interval - (now - oldest) + 100; // +100ms buffer
            console.log(`[RateLimit] Limit reached.Waiting ${waitTime}ms...`);
            setTimeout(() => this.processQueue(), waitTime);
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        // Check if task was aborted while in queue
        if (task.abortSignal && task.abortSignal.aborted) {
            task.reject(new DOMException('Aborted', 'AbortError'));
            this.isProcessing = false;
            this.processQueue(); // Process next
            return;
        }

        try {
            // Execute
            console.log('[RequestQueue] Processing request. Queue length:', this.queue.length);
            this.timestamps.push(Date.now());
            const result = await task.apiFunc(...task.args);

            // Critical check for 429 in result (if apiFunc catches it)
            if (result && result.error && (result.error.includes('429') || result.error.replace(/\s/g, '').includes('QuotaExceeded') || result.error.includes('Too Many Requests'))) {
                this.triggerRateLimit(300000); // 5 mins
            }

            task.resolve(result);
        } catch (error) {
            // Handle raw throw (if apiFunc didn't catch)
            if (error.message && (error.message.includes('429') || error.message.includes('Quota'))) {
                this.triggerRateLimit(300000);
            }

            // Log error to System Logs UI
            const logger = useLoggerStore();
            if (logger) {
                // Simplified log (Detailed error already logged by _generateReplyInternal usually)
                // logger.addLog('ERROR', `API Request Failed: ${error.message} `, error);
            }

            task.reject(error);
        } finally {
            this.isProcessing = false;
            // Delay next process slightly to ensure UI updates or avoid race
            setTimeout(() => this.processQueue(), 500); // Increased buffer to 500ms
        }
    }
}
