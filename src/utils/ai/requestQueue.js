
import { useLoggerStore } from '../../stores/loggerStore'

export class RequestQueue {
    constructor(maxRate = 10, interval = 60000, concurrency = 3) {
        this.queue = [];
        this.activeCount = 0;
        this.timestamps = []; // Request execution timestamps for rate limiting
        
        this.maxRate = maxRate;
        this.interval = interval;
        this.concurrency = concurrency;

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
    triggerRateLimit(cooldownMs = 30000) {
        this.isRateLimited = true;
        this.retryAfter = Date.now() + cooldownMs;
        const logger = useLoggerStore();
        if (logger) {
            logger.addLog('ERROR', `API触发速率限制 (429 / Quota)，系统将暂停并发请求 ${(cooldownMs / 1000).toFixed(0)} 秒`, { retryAfter: new Date(this.retryAfter).toLocaleTimeString() });
        }
    }

    async processQueue() {
        // 1. Check if we can start any new tasks
        if (this.queue.length === 0) return;
        if (this.activeCount >= this.concurrency) return;

        const now = Date.now();

        // 2. Check Circuit Breaker
        if (this.isRateLimited) {
            if (now < this.retryAfter) {
                const remaining = Math.ceil((this.retryAfter - now) / 1000);
                if (Math.random() > 0.95) {
                    console.log(`[RequestQueue] Circuit Breaker Active. Waiting ${remaining}s...`);
                }
                setTimeout(() => this.processQueue(), 5000);
                return;
            } else {
                this.isRateLimited = false;
                console.log('[RequestQueue] Circuit Breaker Reset.');
            }
        }

        // 3. Check Standard Rate Limit (sliding window)
        this.timestamps = this.timestamps.filter(t => now - t < this.interval);
        if (this.timestamps.length >= this.maxRate) {
            const oldest = this.timestamps[0];
            const waitTime = this.interval - (now - oldest) + 500; // Small buffer
            console.log(`[RequestQueue] Global limit reached. Waiting ${Math.round(waitTime/1000)}s...`);
            setTimeout(() => this.processQueue(), Math.min(waitTime, 5000));
            return;
        }

        // 4. Start processing
        this.activeCount++;
        const task = this.queue.shift();

        // Check if task was aborted while in queue
        if (task.abortSignal && task.abortSignal.aborted) {
            task.reject(new DOMException('Aborted by user', 'AbortError'));
            this.activeCount--;
            this.processQueue();
            return;
        }

        // Log and execute
        this.timestamps.push(Date.now());
        
        // Execute asynchronously
        (async () => {
            try {
                console.log(`[RequestQueue] Executing task. Active: ${this.activeCount}, Pending: ${this.queue.length}`);
                const result = await task.apiFunc(...task.args);

                // Check for rate limit hints in the result (if not thrown)
                if (result && result.error && (
                    result.error.includes('429') ||
                    result.error.toLowerCase().includes('quota') ||
                    result.error.toLowerCase().includes('too many')
                )) {
                    this.triggerRateLimit();
                }

                task.resolve(result);
            } catch (error) {
                console.error('[RequestQueue] Execution error:', error);
                
                // Detect 429 from error message
                const eText = (error.message || '').toLowerCase();
                if (eText.includes('429') || eText.includes('quota') || eText.includes('rate limit') || eText.includes('too many')) {
                    this.triggerRateLimit();
                }

                task.reject(error);
            } finally {
                this.activeCount--;
                // Process next task
                setTimeout(() => this.processQueue(), 100);
            }
        })();

        // Try to start more tasks in parallel if concurrency allow
        if (this.activeCount < this.concurrency && this.queue.length > 0) {
            this.processQueue();
        }
    }
}
