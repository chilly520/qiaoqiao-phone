import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLoggerStore } from './loggerStore'

export const useSettingsStore = defineStore('settings', () => {
    // --- 1. Core API Configs ---
    const apiConfigs = ref([
        {
            name: '默认配置',
            baseUrl: 'http://127.0.0.1:7861/v1',
            apiKey: 'pwd',
            model: 'gemini-2.0-flash-exp',
            temperature: 0.7,
            maxTokens: 4096,
            provider: 'openai'
        }
    ])
    const currentConfigIndex = ref(0)
    const currentConfig = computed(() => apiConfigs.value[currentConfigIndex.value] || apiConfigs.value[0])
    const apiConfig = computed(() => currentConfig.value)

    // --- 2. Personalization State ---
    const personalization = ref({
        wallpaper: '',
        icons: {
            app: 'wechat',
            url: '',
            map: {
                wechat: '/icons/wechat.png',
                search: '/icons/search.png',
                weibo: '/icons/weibo.png',
                couple: '/icons/couple.png',
                games: '/icons/games.png',
                settings: '/icons/settings.png',
                worldbook: '/icons/worldbook.png',
                reset: '/icons/reset.png',
                syslog: '/icons/syslog.png'
            }
        },
        widgets: {
            card1: '/widgets/bg_card1.jpg',
            card2: '/widgets/bg_card2.jpg'
        },
        cardBgs: {
            time: '/widgets/bg_time.png',
            location: '/widgets/bg_location.png',
            weather: '/widgets/bg_weather.jpg'
        },
        globalFont: {
            color: '#000000',
            shadow: '',
            url: ''
        },
        globalBg: '',
        customCss: '',
        theme: 'default', // 新增：主题选择 (default | kawaii | business)
        wallpaperOverlayOpacity: 0.5, // 新增：夜间模式聊天壁纸遮罩透明度 (0-1)
        userProfile: {
            name: '乔乔',
            avatar: '/avatars/小猫星星眼.jpg',
            wechatId: 'admin',
            signature: '对方很懒，什么都没有留下'
        },
        presets: []
    })

    // --- 3. Other States ---
    const voice = ref({
        engine: 'browser',
        minimax: {
            groupId: '',
            apiKey: '',
            modelId: 'speech-01-turbo',
            voiceId: ''
        }
    })
    const weather = ref({
        virtualLocation: '',
        realLocation: '',
        // Live data synced from HomeView
        temp: '--°',
        desc: '获取中',
        aqi: 'AQI --',
        icon: 'fa-sun'
    })
    const compressQuality = ref(0.7)
    const drawing = ref({
        provider: 'pollinations',
        apiKey: '',
        model: 'flux',
        quality: 'standard'
    })

    // --- 4. Persistence Helpers ---
    function saveToStorage() {
        const data = {
            apiConfigs: apiConfigs.value,
            currentConfigIndex: currentConfigIndex.value,
            personalization: personalization.value,
            voice: voice.value,
            weather: weather.value,
            compressQuality: compressQuality.value,
            drawing: drawing.value
        }
        const json = JSON.stringify(data)
        localStorage.setItem('qiaoqiao_settings', json)
        console.log('[SettingsStore] Saved to localStorage. JSON length:', json.length)
    }

    function loadFromStorage() {
        const saved = localStorage.getItem('qiaoqiao_settings')
        if (!saved) {
            console.log('[SettingsStore] No saved settings found in localStorage.')
            return
        }

        try {
            const data = JSON.parse(saved)
            console.log('[SettingsStore] Loading data from localStorage:', Object.keys(data))

            if (data.apiConfigs) apiConfigs.value = data.apiConfigs
            if (data.currentConfigIndex !== undefined) currentConfigIndex.value = data.currentConfigIndex

            if (data.personalization) {
                const defaultIconsMap = { ...personalization.value.icons.map }
                const defaultCardBgs = { ...personalization.value.cardBgs }
                const defaultWidgets = { ...personalization.value.widgets }

                personalization.value = { ...personalization.value, ...data.personalization }

                personalization.value.icons.map = { ...defaultIconsMap, ...(personalization.value.icons?.map || {}) }

                const savedBgs = personalization.value.cardBgs || {}
                personalization.value.cardBgs = {
                    time: savedBgs.time || defaultCardBgs.time,
                    location: savedBgs.location || defaultCardBgs.location,
                    weather: savedBgs.weather || defaultCardBgs.weather
                }

                const savedWidgets = personalization.value.widgets || {}
                personalization.value.widgets = {
                    card1: savedWidgets.card1 || defaultWidgets.card1,
                    card2: savedWidgets.card2 || defaultWidgets.card2
                }
            }

            if (data.voice) {
                voice.value.engine = data.voice.engine || 'browser'
                if (data.voice.minimax) {
                    voice.value.minimax = { ...voice.value.minimax, ...data.voice.minimax }
                }
            }

            if (data.weather) weather.value = { ...weather.value, ...data.weather }
            if (data.compressQuality !== undefined) compressQuality.value = data.compressQuality

            // Critical Check for Drawing
            if (data.drawing) {
                console.log('[SettingsStore] Found drawing config in storage. Model:', data.drawing.model, 'HasKey:', !!data.drawing.apiKey)
                drawing.value = { ...drawing.value, ...data.drawing }
            }

        } catch (e) {
            console.error('[SettingsStore] Failed to load settings:', e)
        }
    }

    // Initialize on load
    loadFromStorage()

    // --- 5. Actions ---

    // API Config Actions
    function updateConfig(index, newConfig) {
        if (index >= 0 && index < apiConfigs.value.length) {
            const oldName = apiConfigs.value[index].name
            apiConfigs.value[index] = { ...newConfig }
            saveToStorage()
            useLoggerStore().sys(`更新API配置: ${oldName} -> ${newConfig.name}`)
        }
    }
    function createConfig(config) {
        apiConfigs.value.push(config)
        saveToStorage()
        return apiConfigs.value.length - 1
    }
    function deleteConfig(index) {
        if (apiConfigs.value.length <= 1) return '至少需要保留一个配置'
        if (index >= 0 && index < apiConfigs.value.length) {
            apiConfigs.value.splice(index, 1)
            if (currentConfigIndex.value >= apiConfigs.value.length) {
                currentConfigIndex.value = apiConfigs.value.length - 1
            }
            saveToStorage()
            return true
        }
        return false
    }

    // Personalization Actions
    function setWallpaper(url) { personalization.value.wallpaper = url; saveToStorage(); }
    function setIcon(app, url) { personalization.value.icons.map[app] = url; saveToStorage(); }
    function clearIcon(app) {
        if (app) delete personalization.value.icons.map[app];
        else personalization.value.icons.map = {};
        saveToStorage();
    }
    function setWidget(id, url) { if (id in personalization.value.widgets) { personalization.value.widgets[id] = url; saveToStorage(); } }
    function setCardBg(type, url) { if (type in personalization.value.cardBgs) { personalization.value.cardBgs[type] = url; saveToStorage(); } }
    function setGlobalFont(settings) { personalization.value.globalFont = { ...personalization.value.globalFont, ...settings }; saveToStorage(); }
    function setGlobalBg(url) { personalization.value.globalBg = url; saveToStorage(); }
    function setCustomCss(css) { personalization.value.customCss = css; saveToStorage(); }
    function setTheme(themeName) { personalization.value.theme = themeName; saveToStorage(); }
    function updateUserProfile(profile) { personalization.value.userProfile = { ...personalization.value.userProfile, ...profile }; saveToStorage(); }

    // Preset Actions
    function savePreset(name) {
        const data = JSON.parse(JSON.stringify(personalization.value))
        delete data.presets
        const existingIndex = personalization.value.presets.findIndex(p => p.name === name)
        if (existingIndex >= 0) personalization.value.presets[existingIndex].data = data
        else personalization.value.presets.push({ name, data })
        saveToStorage()
    }
    function loadPreset(name) {
        const preset = personalization.value.presets.find(p => p.name === name)
        if (preset) {
            const currentPresets = personalization.value.presets
            personalization.value = { ...preset.data, presets: currentPresets }
            saveToStorage()
            return true
        }
        return false
    }
    function deletePreset(name) {
        const index = personalization.value.presets.findIndex(p => p.name === name)
        if (index >= 0) { personalization.value.presets.splice(index, 1); saveToStorage(); return true; }
        return false
    }
    function resetAllPersonalization() {
        personalization.value = {
            wallpaper: '',
            icons: { app: 'wechat', url: '', map: {} },
            widgets: { card1: '', card2: '' },
            cardBgs: { time: '', location: '', weather: '' },
            globalFont: { color: '#000000', shadow: '', url: '' },
            globalBg: '',
            customCss: '',
            presets: personalization.value.presets
        }
        saveToStorage()
    }

    // Voice & Weather Actions
    function setVoiceEngine(engine) { voice.value.engine = engine; saveToStorage(); }
    function updateMinimaxConfig(config) { voice.value.minimax = { ...voice.value.minimax, ...config }; saveToStorage(); }
    function resetVoiceSettings() {
        voice.value.engine = 'browser'
        voice.value.minimax = { groupId: '', apiKey: '', modelId: 'speech-01-turbo', voiceId: '' }
        saveToStorage()
    }
    function setWeatherConfig(config) { weather.value = { ...weather.value, ...config }; saveToStorage(); }
    function updateLiveWeather(data) {
        weather.value.temp = data.temp
        weather.value.desc = data.desc
        weather.value.aqi = data.aqi
        weather.value.icon = data.icon
        weather.value.lastUpdate = Date.now()
        saveToStorage()
    }
    function setCompressQuality(val) { compressQuality.value = typeof val === 'string' ? parseFloat(val) : val; saveToStorage(); }

    // Drawing Action
    function setDrawingConfig(config) {
        console.log('[SettingsStore] setDrawingConfig entry:', config)
        // Ensure we are working with a clean object
        const cleanConfig = JSON.parse(JSON.stringify(config))

        console.log('[SettingsStore] Drawing config before update:', JSON.stringify(drawing.value))
        drawing.value = { ...drawing.value, ...cleanConfig }
        console.log('[SettingsStore] Drawing config after update:', JSON.stringify(drawing.value))

        saveToStorage()

        // Immediate verification from storage
        const stored = localStorage.getItem('qiaoqiao_settings')
        if (stored) {
            try {
                const parsedStored = JSON.parse(stored)
                console.log('[SettingsStore] Drawing config in localStorage after save:', JSON.stringify(parsedStored.drawing))
            } catch (e) {
                console.error('[SettingsStore] Error parsing localStorage after save:', e)
            }
        } else {
            console.log('[SettingsStore] No settings found in localStorage after save.')
        }

        // Final sanity check
        console.log('[SettingsStore] Current drawing state after save:', JSON.stringify(drawing.value))
    }

    // Data Management
    function getChatListForExport() {
        try {
            const chatData = localStorage.getItem('qiaoqiao_chats')
            return chatData ? JSON.parse(chatData) : []
        } catch (e) { return [] }
    }

    function exportData(options = {}) {
        const exportContent = { timestamp: Date.now(), version: '2.0', type: 'qiaoqiao_backup' }
        if (options.settings) {
            const settings = localStorage.getItem('qiaoqiao_settings')
            if (settings) exportContent.settings = JSON.parse(settings)
        }
        if (options.wechat) {
            const chatData = localStorage.getItem('qiaoqiao_chats')
            if (chatData) {
                let chats = JSON.parse(chatData)
                if (options.selectedChats?.length > 0) chats = chats.filter(c => options.selectedChats.includes(c.id))
                exportContent.chats = chats
            }
        }
        if (options.wallet) {
            const wallet = localStorage.getItem('qiaoqiao_wallet')
            if (wallet) exportContent.wallet = JSON.parse(wallet)
        }
        return JSON.stringify(exportContent, null, 2)
    }

    async function importData(jsonContent) {
        try {
            const data = JSON.parse(jsonContent)
            let importCount = 0
            if (data.settings) {
                const currentSettings = JSON.parse(localStorage.getItem('qiaoqiao_settings') || '{}')
                const mergedSettings = { ...currentSettings, ...data.settings }
                localStorage.setItem('qiaoqiao_settings', JSON.stringify(mergedSettings))
                loadFromStorage()
                importCount++
            }
            if (data.chats) {
                const currentChats = JSON.parse(localStorage.getItem('qiaoqiao_chats') || '[]')
                const mergedChats = [...currentChats]
                data.chats.forEach(importedChat => {
                    const index = mergedChats.findIndex(c => c.id === importedChat.id)
                    if (index !== -1) mergedChats[index] = importedChat
                    else mergedChats.push(importedChat)
                })
                localStorage.setItem('qiaoqiao_chats', JSON.stringify(mergedChats))
                importCount++
            }
            if (data.wallet) {
                localStorage.setItem('qiaoqiao_wallet', JSON.stringify(data.wallet))
                importCount++
            }
            return importCount > 0
        } catch (e) { return false }
    }

    function resetAppData(options = {}) {
        if (options.wechat) localStorage.removeItem('qiaoqiao_chats')
        if (options.wallet) localStorage.removeItem('qiaoqiao_wallet')
        if (options.settings) localStorage.removeItem('qiaoqiao_settings')
        window.location.reload()
    }

    function resetGlobalData() {
        localStorage.clear()
        window.location.reload()
    }

    return {
        apiConfigs, currentConfigIndex, currentConfig, apiConfig,
        personalization, voice, weather, compressQuality, drawing,
        updateConfig, createConfig, deleteConfig,
        saveToStorage, loadFromStorage,
        setWallpaper, setIcon, clearIcon, setWidget, setCardBg, setGlobalFont, setGlobalBg, setCustomCss, setTheme, updateUserProfile,
        savePreset, loadPreset, deletePreset, resetAllPersonalization,
        setVoiceEngine, updateMinimaxConfig, resetVoiceSettings,
        setWeatherConfig, updateLiveWeather, setCompressQuality, setDrawingConfig,
        exportData, importData, resetAppData, resetGlobalData, getChatListForExport
    }
})
