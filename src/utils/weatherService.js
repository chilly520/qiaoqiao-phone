// Weather and Location Service (Store Adapter)
// 天气和定位服务 - 适配系统桌面数据

import { useSettingsStore } from '../stores/settingsStore'

class WeatherService {
    constructor() {
        this.locationEnabled = false
    }

    // 启用定位同步
    async enableLocationSync() {
        this.locationEnabled = true
        // 无需额外操作，因为数据已经由HomeView同步到Store
        return { success: true }
    }

    // 禁用定位同步
    disableLocationSync() {
        // this.locationEnabled = false // Removed
    }

    // 获取定位信息文本（用于AI Prompt）
    getLocationContextText() {
        const store = useSettingsStore()
        const weather = store.weather

        const realCity = weather.realLocation || '未知城市'
        // 优先使用用户在设置中填写的“虚拟城市”，如果没有则默认等同于真实城市
        const virtualCity = weather.virtualLocation || realCity

        // 从Store获取实时天气数据（由HomeView更新）
        const temp = weather.temp || '--°'
        const desc = weather.desc || '未知'
        const aqi = weather.aqi || ''

        return `
【当前时空与环境】
地点：${virtualCity} ${realCity && realCity !== virtualCity ? `(实际归属地: ${realCity})` : ''}
天气：${desc}, ${temp}
空气质量：${aqi}
`.trim()
    }

    // 获取位置信息对象（用于UI显示）
    getLocationInfo() {
        // if (!this.locationEnabled) return null // UI might want to show it even if disabled? No, usually coupled.

        const store = useSettingsStore()
        const weather = store.weather
        const realCity = weather.realLocation || '未知'

        return {
            realCity: realCity,
            virtualCity: weather.virtualLocation || realCity,
            weather: {
                weather: weather.desc || '未知',
                temperature: weather.temp || '--',
                windDirection: '', // 系统桌面暂无风向数据
                windPower: ''
            }
        }
    }

    // 刷新天气 (实际上是不可操作的，因为依赖HomeView的循环)
    async refreshWeather() {
        // 这里我们不做任何网路请求，只是单纯返回store里的最新数据
        // 如果需要强制刷新，可能需要EventBus通知HomeView，但暂时不需要这么复杂
        return this.getLocationInfo()
    }
}

// Create singleton instance
export const weatherService = new WeatherService()

// 城市映射表（用于个人主页虚拟市同步等逻辑）
export const CITY_MAPPING = {
    '上海': '魔都',
    '北京': '帝都',
    '广州': '羊城',
    '深圳': '鹏城',
    '杭州': '临安'
}
