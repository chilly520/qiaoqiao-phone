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

        this.battery.addEventListener('levelchange', () => {
            this.updateBatteryInfo()
            this.notifyChange()
            this.checkLowBattery()
        })

        this.battery.addEventListener('chargingchange', () => {
            this.updateBatteryInfo()
            this.notifyChange()
            // Reset notification flag when charging starts
            if (this.charging) {
                this.hasNotified = false
            }
        })
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
        // Clean up listeners if needed
        this.callbacks = { onChange: [], onLowBattery: [] }
    }
}

// Create singleton instance
export const batteryMonitor = new BatteryMonitor()
