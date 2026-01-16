// Battery monitoring utility using Battery Status API
// 电池监控工具

class BatteryMonitor {
    constructor() {
        this.battery = null
        this.level = 100
        this.charging = false
        this.callbacks = {
            onChange: [],
            onLowBattery: []
        }
        this.lowBatteryThreshold = 0.3 // 30%
        this.hasNotified = false
    }

    async init() {
        try {
            if ('getBattery' in navigator) {
                this.battery = await navigator.getBattery()
                this.updateBatteryInfo()
                this.setupListeners()
                console.log('[BatteryMonitor] Initialized successfully')
                return true
            } else {
                console.warn('[BatteryMonitor] Battery API not supported')
                return false
            }
        } catch (error) {
            console.error('[BatteryMonitor] Failed to initialize:', error)
            return false
        }
    }

    setupListeners() {
        if (!this.battery) return

        const updateHandler = () => {
            this.updateBatteryInfo()
            this.notifyChange()
            this.checkLowBattery()
        }

        // Event Listeners
        this.battery.addEventListener('levelchange', updateHandler)
        this.battery.addEventListener('chargingchange', () => {
            updateHandler()
            if (this.charging) {
                this.hasNotified = false
            }
        })

        // Polling Fallback (Every 30s) - Fixes "imprecise sync" on some devices
        if (this.pollInterval) clearInterval(this.pollInterval)
        this.pollInterval = setInterval(updateHandler, 30000)
    }

    updateBatteryInfo() {
        if (!this.battery) return

        this.level = Math.round(this.battery.level * 100)
        this.charging = this.battery.charging
    }

    checkLowBattery() {
        if (this.charging || this.hasNotified) return

        if (this.battery.level <= this.lowBatteryThreshold) {
            this.hasNotified = true
            this.notifyLowBattery()
        }
    }

    notifyChange() {
        this.callbacks.onChange.forEach(cb => cb({
            level: this.level,
            charging: this.charging
        }))
    }

    notifyLowBattery() {
        this.callbacks.onLowBattery.forEach(cb => cb({
            level: this.level,
            charging: this.charging
        }))
    }

    onChange(callback) {
        this.callbacks.onChange.push(callback)
    }

    onLowBattery(callback) {
        this.callbacks.onLowBattery.push(callback)
    }

    getBatteryInfo() {
        return {
            level: this.level,
            charging: this.charging,
            isLow: this.level <= this.lowBatteryThreshold * 100 && !this.charging
        }
    }

    destroy() {
        if (this.pollInterval) clearInterval(this.pollInterval)
        this.callbacks = { onChange: [], onLowBattery: [] }
    }
}

// Create singleton instance
export const batteryMonitor = new BatteryMonitor()
