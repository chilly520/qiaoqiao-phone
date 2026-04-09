// Weather and Location Service (Store Adapter)
// 天气和定位服务 - 支持全局天气 + 角色独立城市映射
// v2: 新增按角色独立城市获取天气能力（异地恋/多角色场景）

import { useSettingsStore } from '../stores/settingsStore'

// 城市天气缓存: { "Tokyo": { temp, desc, aqi, icon, lastUpdate }, ... }
const cityWeatherCache = new Map()

// 默认缓存有效时间 30 分钟
const CACHE_TTL = 30 * 60 * 1000

class WeatherService {
    constructor() {
        this.locationEnabled = false
    }

    // 启用定位同步
    async enableLocationSync() {
        this.locationEnabled = true
        return { success: true }
    }

    // 禁用定位同步
    disableLocationSync() {
        // this.locationEnabled = false // Removed
    }

    // Helper to safely extract string from possible object location
    _parseLoc(loc) {
        if (!loc) return '';
        if (typeof loc === 'string') return loc.trim();
        if (typeof loc === 'object' && loc !== null) {
            return loc.name || loc.city || loc.address || '';
        }
        return String(loc);
    }

    // ===== 核心：为指定真实城市获取天气数据 =====
    // 返回: { temp, desc, aqi, icon } 或 null
    async fetchWeatherForCity(realCity) {
        if (!realCity || typeof realCity !== 'string') return null
        
        const cacheKey = realCity.trim()
        
        // 检查缓存是否有效
        const cached = cityWeatherCache.get(cacheKey)
        if (cached && (Date.now() - cached.lastUpdate < CACHE_TTL)) {
            console.log(`[WeatherService] Cache hit for ${cacheKey}`)
            return cached
        }
        
        try {
            console.log(`[WeatherService] Fetching fresh weather for ${cacheKey}...`)
            
            // 1. 地理编码
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cacheKey)}&count=1&language=zh&format=json`
            )
            if (!geoRes.ok) throw new Error('地理编码失败')
            
            const geoData = await geoRes.json()
            if (!geoData.results?.length) throw new Error(`找不到城市：${cacheKey}`)
            
            const { latitude, longitude, name: geoName, name_en } = geoData.results[0]
            const aqiCityName = name_en || geoName
            
            // 2. 天气数据
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&weathercode=true`
            )
            if (!weatherRes.ok) throw new Error('天气数据获取失败')
            
            const weatherData = await weatherRes.json()
            const current = weatherData.current_weather
            if (!current) throw new Error('天气数据格式错误')
            
            // WMO 天气代码 → 中文
            const codeMap = {
                0: { text: '晴', icon: 'fa-sun' },
                1: { text: '多云', icon: 'fa-cloud' },
                2: { text: '多云', icon: 'fa-cloud' },
                3: { text: '阴', icon: 'fa-cloud' },
                45: { text: '雾', icon: 'fa-smog' },
                48: { text: '雾', icon: 'fa-smog' },
                51: { text: '小雨', icon: 'fa-cloud-rain' },
                53: { text: '小雨', icon: 'fa-cloud-rain' },
                55: { text: '中雨', icon: 'fa-cloud-rain' },
                61: { text: '小雨', icon: 'fa-cloud-rain' },
                63: { text: '中雨', icon: 'fa-cloud-rain' },
                65: { text: '大雨', icon: 'fa-cloud-rain' },
                71: { text: '雪', icon: 'fa-snowflake' },
                75: { text: '雪', icon: 'fa-snowflake' },
                80: { text: '阵雨', icon: 'fa-cloud-showers-heavy' },
                81: { text: '阵雨', icon: 'fa-cloud-showers-heavy' },
                82: { text: '暴雨', icon: 'fa-cloud-showers-heavy' },
                95: { text: '雷阵雨', icon: 'fa-bolt' },
                96: { text: '雷雨', icon: 'fa-bolt' },
                99: { text: '雷雨', icon: 'fa-bolt' }
            }
            const wInfo = codeMap[current.weathercode] || { text: '未知', icon: 'fa-sun' }
            
            let aqiText = ''
            try {
                // AQI 数据
                const WAQI_TOKEN = 'aaae869d45d449aada6f69701077db35ced2a21f'
                const aqiRes = await fetch(`https://api.waqi.info/feed/${aqiCityName}/?token=${WAQI_TOKEN}`)
                if (aqiRes.ok) {
                    const aqiData = await aqiRes.json()
                    if (aqiData.status === 'ok' && aqiData.data?.aqi) {
                        aqiText = `AQI ${aqiData.data.aqi}`
                    }
                }
            } catch (e) {
                // AQI 获取失败不影响主流程
            }
            
            const result = {
                temp: `${Math.round(current.temperature)}°`,
                desc: wInfo.text,
                aqi: aqiText || '',
                icon: wInfo.icon,
                lastUpdate: Date.now(),
                realName: geoName
            }
            
            // 写入缓存
            cityWeatherCache.set(cacheKey, result)
            console.log(`[WeatherService] Fresh weather for ${cacheKey}: ${result.desc}, ${result.temp}`)
            return result
            
        } catch (error) {
            console.warn(`[WeatherService] Failed for ${cacheKey}:`, error.message)
            // 返回缓存（即使是旧的）作为降级
            return cached || null
        }
    }

    // ===== 获取角色独立的定位信息文本（用于AI Prompt） =====
    // charLocation 格式: { realCity: "东京", virtualCity: "云城" }
    getLocationContextText(charLocation = null) {
        const store = useSettingsStore()
        const weather = store.weather
        
        let realCity, virtualCity, temp, desc, aqi
        
        if (charLocation && charLocation.realCity) {
            // 使用角色的独立位置配置
            realCity = this._parseLoc(charLocation.realCity)
            virtualCity = this._parseLoc(charLocation.virtualCity) || realCity
            
            // 从缓存或全局store取天气
            const cached = cityWeatherCache.get(realCity.trim())
            if (cached && !this._isCacheExpired(cached)) {
                temp = cached.temp
                desc = cached.desc
                aqi = cached.aqi
            } else {
                // fallback 到全局天气
                temp = weather.temp || '--°'
                desc = weather.desc || '未知'
                aqi = weather.aqi || ''
            }
        } else {
            // 兼容旧逻辑：使用全局配置
            const uLocStr = this._parseLoc(weather.userLocation);
            realCity = this._parseLoc(weather.realLocation) || uLocStr || '未知城市'
            virtualCity = this._parseLoc(weather.virtualLocation) || realCity
            temp = weather.temp || '--°'
            desc = weather.desc || '未知'
            aqi = weather.aqi || ''
        }

        return `
【当前时空与环境】
地点：${virtualCity} ${realCity && realCity !== virtualCity ? `(实际归属地: ${realCity})` : ''}
天气：${desc}, ${temp}
空气质量：${aqi}
`.trim()
    }

    // ===== 获取位置信息对象（用于UI显示） =====
    // 支持 charLocation 参数来显示角色独立的位置
    getLocationInfo(charLocation = null) {
        const store = useSettingsStore()
        const weather = store.weather
        
        let realCity, virtualCity, weatherObj
        
        if (charLocation && charLocation.realCity) {
            realCity = this._parseLoc(charLocation.realCity)
            virtualCity = this._parseLoc(charLocation.virtualCity) || realCity
            
            const cached = cityWeatherCache.get(realCity.trim())
            if (cached && !this._isCacheExpired(cached)) {
                weatherObj = {
                    weather: cached.desc || '未知',
                    temperature: cached.temp || '--',
                    windDirection: '',
                    windPower: ''
                }
            } else {
                weatherObj = {
                    weather: weather.desc || '未知',
                    temperature: weather.temp || '--',
                    windDirection: '',
                    windPower: ''
                }
            }
        } else {
            // 兼容旧逻辑
            const uLocStr = this._parseLoc(weather.userLocation);
            realCity = this._parseLoc(weather.realLocation) || uLocStr || '未知'
            virtualCity = this._parseLoc(weather.virtualLocation) || realCity
            weatherObj = {
                weather: weather.desc || '未知',
                temperature: weather.temp || '--',
                windDirection: '',
                windPower: ''
            }
        }

        return {
            realCity: realCity,
            virtualCity: virtualCity,
            weather: weatherObj
        }
    }

    // 刷新指定城市的天气（角色设置页调用）
    async refreshWeatherForCity(realCity) {
        if (!realCity) return this.getLocationInfo()
        const result = await this.fetchWeatherForCity(realCity)
        return this.getLocationInfo({ realCity })
    }

    // 刷新天气（兼容旧接口）
    async refreshWeather() {
        return this.getLocationInfo()
    }
    
    _isCacheExpired(cached) {
        return !cached || !cached.lastUpdate || (Date.now() - cached.lastUpdate > CACHE_TTL)
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
    '杭州': '临安',
    '东京': '东京',
    '北京': '帝都',
    '成都': '蓉城',
    '南京': '金陵',
    '西安': '长安',
    '武汉': '江城',
    '长沙': '星城',
    '重庆': '山城',
    '广州': '花城',
    '苏州': '姑苏',
    '杭州': '临安',
    '台北': '台北',
    '香港': '香江',
    '澳门': '濠江'
}

// 热门城市列表（用于下拉选择）
export const POPULAR_CITIES = [
    { real: 'Shenzhen', display: '深圳' },
    { real: 'Beijing', display: '北京' },
    { real: 'Shanghai', display: '上海' },
    { real: 'Guangzhou', display: '广州' },
    { real: 'Hangzhou', display: '杭州' },
    { real: 'Chengdu', display: '成都' },
    { real: 'Chongqing', display: '重庆' },
    { real: 'Wuhan', display: '武汉' },
    { real: 'Nanjing', display: '南京' },
    { real: "Xi'an", display: '西安' },
    { real: 'Changsha', display: '长沙' },
    { real: 'Tokyo', display: '东京' },
    { real: 'Osaka', display: '大阪' },
    { real: 'Seoul', display: '首尔' },
    { real: 'Taipei', display: '台北' },
    { real: 'Hong Kong', display: '香港' },
    { real: 'London', display: '伦敦' },
    { real: 'Paris', display: '巴黎' },
    { real: 'New York', display: '纽约' },
    { real: 'Los Angeles', display: '洛杉矶' },
    { real: 'Singapore', display: '新加坡' },
    { real: 'Sydney', display: '悉尼' }
]
