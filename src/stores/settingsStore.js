import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
    // API配置列表 - 使用原版默认值
    const apiConfigs = ref([
        {
            name: '默认配置',
            baseUrl: 'http://127.0.0.1:7861/v1',
            apiKey: 'pwd',
            model: 'gemini-2.5-pro-nothinking',
            temperature: 0.7,
            maxTokens: 4096
        }
    ])

    // 当前选中的配置索引
    const currentConfigIndex = ref(0)

    const currentConfig = computed(() => {
        return apiConfigs.value[currentConfigIndex.value] || null
    })

    // Alias for compatibility with aiService
    const apiConfig = computed(() => currentConfig.value)

    // 从localStorage加载配置
    function loadFromStorage() {
        const saved = localStorage.getItem('qiaoqiao_settings')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                if (data.apiConfigs) {
                    apiConfigs.value = data.apiConfigs
                }
                if (data.currentConfigIndex !== undefined) {
                    currentConfigIndex.value = data.currentConfigIndex
                }
            } catch (e) {
                console.error('Failed to load settings:', e)
            }
        }
    }

    // 保存到localStorage
    function saveToStorage() {
        const data = {
            apiConfigs: apiConfigs.value,
            currentConfigIndex: currentConfigIndex.value
        }
        localStorage.setItem('qiaoqiao_settings', JSON.stringify(data))
    }

    // 更新配置
    function updateConfig(index, newConfig) {
        if (index >= 0 && index < apiConfigs.value.length) {
            apiConfigs.value[index] = { ...newConfig }
            saveToStorage()
        }
    }

    // 创建新配置
    function createConfig(config) {
        apiConfigs.value.push(config)
        saveToStorage()
        return apiConfigs.value.length - 1
    }

    // 删除配置
    function deleteConfig(index) {
        if (apiConfigs.value.length <= 1) {
            return '至少需要保留一个配置'
        }
        if (index >= 0 && index < apiConfigs.value.length) {
            apiConfigs.value.splice(index, 1)
            // 如果删除的是当前配置，切换到第一个
            if (currentConfigIndex.value >= apiConfigs.value.length) {
                currentConfigIndex.value = apiConfigs.value.length - 1
            }
            saveToStorage()
            return true
        }
        return false
    }

    // --- Personalization State ---
    const personalization = ref({
        wallpaper: '',
        icons: {
            app: 'wechat', // Default selected app for preview
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
            } // Map of app -> icon URL
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
        userProfile: {
            name: '乔乔',
            avatar: '/avatars/小猫星星眼.jpg',
            wechatId: 'admin'
        },
        presets: [] // Array of { name, data }
    })

    // --- Personalization Actions ---

    // Apply Wallpaper
    function setWallpaper(url) {
        personalization.value.wallpaper = url
        saveToStorage()
    }

    // Apply Icon
    function setIcon(app, url) {
        personalization.value.icons.map[app] = url
        saveToStorage()
    }

    // Clear Icon
    function clearIcon(app) {
        if (app) {
            delete personalization.value.icons.map[app]
        } else {
            personalization.value.icons.map = {}
        }
        saveToStorage()
    }

    // Apply Widget Url
    function setWidget(id, url) {
        if (id in personalization.value.widgets) {
            personalization.value.widgets[id] = url
            saveToStorage()
        }
    }

    // Check Widget Card Background Key
    function setCardBg(type, url) {
        if (type in personalization.value.cardBgs) {
            personalization.value.cardBgs[type] = url
            saveToStorage()
        }
    }

    // Global Font Settings
    function setGlobalFont(settings) {
        personalization.value.globalFont = { ...personalization.value.globalFont, ...settings }
        saveToStorage()
    }

    // Global Background
    function setGlobalBg(url) {
        personalization.value.globalBg = url
        saveToStorage()
    }

    // Custom CSS
    function setCustomCss(css) {
        personalization.value.customCss = css
        saveToStorage()
    }

    // User Profile
    function updateUserProfile(profile) {
        personalization.value.userProfile = { ...personalization.value.userProfile, ...profile }
        saveToStorage()
    }

    // Presets Management
    function savePreset(name) {
        const data = JSON.parse(JSON.stringify(personalization.value))
        // Remove presets array from the saved data to avoid recursion
        delete data.presets

        const existingIndex = personalization.value.presets.findIndex(p => p.name === name)
        if (existingIndex >= 0) {
            personalization.value.presets[existingIndex].data = data
        } else {
            personalization.value.presets.push({ name, data })
        }
        saveToStorage()
    }

    function loadPreset(name) {
        const preset = personalization.value.presets.find(p => p.name === name)
        if (preset) {
            // Restore data but keep the presets list itself
            const currentPresets = personalization.value.presets
            personalization.value = { ...preset.data, presets: currentPresets }
            saveToStorage()
            return true
        }
        return false
    }

    function deletePreset(name) {
        const index = personalization.value.presets.findIndex(p => p.name === name)
        if (index >= 0) {
            personalization.value.presets.splice(index, 1)
            saveToStorage()
            return true
        }
        return false
    }

    function resetAllPersonalization() {
        personalization.value = {
            wallpaper: '',
            icons: { app: 'wechat', url: '', map: {} },
            widgets: { card1: '', card2: '' },
            cardBgs: { time: '', location: '', weather: '' },
            globalFont: { color: '#166534', shadow: '0 2px 4px rgba(0,0,0,0.3)', url: '' },
            globalBg: '',
            customCss: '',
            presets: personalization.value.presets // Keep presets
        }
        saveToStorage()
    }


    // --- Voice/TTS State ---
    const voice = ref({
        engine: 'browser', // 'browser' | 'minimax'
        minimax: {
            groupId: '',
            apiKey: '',
            modelId: 'speech-01-turbo',
            voiceId: ''
        }
    })

    // --- Weather State ---
    const weather = ref({
        virtualLocation: '',
        realLocation: ''
    })

    // --- Storage State ---
    const compressQuality = ref(0.7)

    // --- Voice Actions ---
    function setVoiceEngine(engine) {
        voice.value.engine = engine
        saveToStorage()
    }

    // ... (Minimax actions)

    // --- Storage Actions ---
    function setCompressQuality(val) {
        compressQuality.value = typeof val === 'string' ? parseFloat(val) : val
        saveToStorage()
    }

    // 从localStorage加载配置 (Updated)
    const originalLoad = loadFromStorage
    loadFromStorage = function () { // Redeclare or overwrite logic
        const saved = localStorage.getItem('qiaoqiao_settings')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                if (data.apiConfigs) apiConfigs.value = data.apiConfigs
                if (data.currentConfigIndex !== undefined) currentConfigIndex.value = data.currentConfigIndex
                if (data.personalization) {
                    // Capture defaults before they are overwritten
                    const defaultIconsMap = { ...personalization.value.icons.map }
                    const defaultCardBgs = { ...personalization.value.cardBgs }
                    
                    personalization.value = { ...personalization.value, ...data.personalization }
                    
                    // Deep merge icons map to ensure new defaults are applied if saved map is empty or partial
                    if (personalization.value.icons) {
                         personalization.value.icons.map = { ...defaultIconsMap, ...(personalization.value.icons.map || {}) }
                    }
                    
                    // Deep merge card backgrounds: Treat empty strings as "use default"
                    if (personalization.value.cardBgs) {
                        const saved = personalization.value.cardBgs
                        personalization.value.cardBgs = {
                            time: saved.time || defaultCardBgs.time,
                            location: saved.location || defaultCardBgs.location,
                            weather: saved.weather || defaultCardBgs.weather
                        }
                    }
                    
                    // Deep merge widgets (Page 2)
                    if (personalization.value.widgets) {
                        const savedW = personalization.value.widgets
                        personalization.value.widgets = {
                            card1: savedW.card1 || '/widgets/bg_card1.jpg',
                            card2: savedW.card2 || '/widgets/bg_card2.jpg'
                        }
                    }
                    

                }
                if (data.voice) {
                    // ... existing voice load logic
                    voice.value.engine = data.voice.engine || 'browser'
                    if (data.voice.minimax) {
                        voice.value.minimax = { ...voice.value.minimax, ...data.voice.minimax }
                    }
                }
                if (data.weather) {
                    weather.value = { ...weather.value, ...data.weather }
                }
                if (data.compressQuality !== undefined) {
                    compressQuality.value = data.compressQuality
                }
            } catch (e) {
                console.error('Failed to load settings:', e)
            }
        }
    }

    // 保存到localStorage (Updated)
    const originalSave = saveToStorage
    saveToStorage = function () {
        const data = {
            apiConfigs: apiConfigs.value,
            currentConfigIndex: currentConfigIndex.value,
            personalization: personalization.value,
            voice: voice.value,
            weather: weather.value,
            compressQuality: compressQuality.value
        }
        localStorage.setItem('qiaoqiao_settings', JSON.stringify(data))
    }

    function updateMinimaxConfig(config) {
        voice.value.minimax = { ...voice.value.minimax, ...config }
        saveToStorage()
    }

    function resetVoiceSettings() {
        voice.value.engine = 'browser'
        voice.value.minimax = {
            groupId: '',
            apiKey: '',
            modelId: 'speech-01-turbo',
            voiceId: ''
        }
        saveToStorage()
    }

    // --- Data Management Actions ---
    // 获取存储的所有聊天角色列表（用于导出选择）
    function getChatListForExport() {
        try {
            const chatData = localStorage.getItem('qiaoqiao_chats')
            if (chatData) {
                return JSON.parse(chatData)
            }
        } catch (e) {
            console.error('Error reading chats for export:', e)
        }
        return []
    }

    function exportData(options = {}) {
        const exportContent = {
            timestamp: Date.now(),
            version: '2.0', // Updated version
            type: 'qiaoqiao_backup'
        }

        // 1. 导出设置 (System Settings)
        if (options.settings) {
            const settings = localStorage.getItem('qiaoqiao_settings')
            if (settings) exportContent.settings = JSON.parse(settings)
        }

        // 2. 导出聊天 (WeChat Data)
        if (options.wechat) {
            const chatData = localStorage.getItem('qiaoqiao_chats')
            if (chatData) {
                let chats = JSON.parse(chatData)
                // Filter by selected characters if specified
                if (options.selectedChats && options.selectedChats.length > 0) {
                    chats = chats.filter(c => options.selectedChats.includes(c.id))
                }
                exportContent.chats = chats
            }
        }

        // 3. Reserved for Wallet/Moments (Future Compatibility)
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

            // 1. Import Settings (Merge)
            if (data.settings) {
                const currentSettings = JSON.parse(localStorage.getItem('qiaoqiao_settings') || '{}')
                // Merge logic: Overwrite with imported keys, keep existing ones if not in import? 
                // Usually settings are overwritten.
                const mergedSettings = { ...currentSettings, ...data.settings }
                localStorage.setItem('qiaoqiao_settings', JSON.stringify(mergedSettings))
                loadFromStorage() // Reload to effect
                importCount++
            }

            // 2. Import Chats (Merge)
            if (data.chats) {
                const currentChats = JSON.parse(localStorage.getItem('qiaoqiao_chats') || '[]')
                // Merge logic: Replace chat if ID exists, add if new
                const mergedChats = [...currentChats]

                data.chats.forEach(importedChat => {
                    const index = mergedChats.findIndex(c => c.id === importedChat.id)
                    if (index !== -1) {
                        mergedChats[index] = importedChat // Overwrite existing
                    } else {
                        mergedChats.push(importedChat) // Add new
                    }
                })

                localStorage.setItem('qiaoqiao_chats', JSON.stringify(mergedChats))
                importCount++
            }

            // 3. Import Wallet (Simple overwrite for now)
            if (data.wallet) {
                localStorage.setItem('qiaoqiao_wallet', JSON.stringify(data.wallet))
                importCount++
            }

            // Fallback for Legacy Format (version 1.0)
            if (!data.version && data.settings && typeof data.settings === 'string') {
                localStorage.setItem('qiaoqiao_settings', data.settings)
                loadFromStorage()
                if (data.chat) localStorage.setItem('qiaoqiao_chats', data.chat)
                return true
            }

            return importCount > 0
        } catch (e) {
            console.error('Import failed:', e)
            return false
        }
    }

    // 重置应用数据 (Selective Reset)
    function resetAppData(options = {}) {
        // App-specific reset (e.g., just chats)
        if (options.wechat) {
            localStorage.removeItem('qiaoqiao_chats')
        }
        if (options.wallet) {
            localStorage.removeItem('qiaoqiao_wallet')
        }
        if (options.settings) {
            localStorage.removeItem('qiaoqiao_settings')
        }

        // Reload to reflect changes
        window.location.reload()
    }

    // 重置全局数据 (Factory Reset)
    function resetGlobalData() {
        localStorage.clear()
        window.location.reload()
    }

    // --- Weather Actions ---
    function setWeatherConfig(config) {
        weather.value = { ...weather.value, ...config }
        saveToStorage()
    }



    // Re-run load to populate personalization
    loadFromStorage()

    return {
        apiConfigs,
        apiConfigs,
        currentConfigIndex,
        currentConfig,
        apiConfig, // Export alias
        personalization,
        voice, // Export voice state
        updateConfig,
        createConfig,
        deleteConfig,
        saveToStorage,
        loadFromStorage,
        // Personalization Actions
        setWallpaper,
        setIcon,
        clearIcon,
        setWidget,
        setCardBg,
        setGlobalFont,
        setGlobalBg,
        setCustomCss,
        updateUserProfile,
        savePreset,
        loadPreset,
        deletePreset,
        resetAllPersonalization,
        // Voice Actions
        setVoiceEngine,
        updateMinimaxConfig,
        resetVoiceSettings,
        // Weather Actions
        weather,
        setWeatherConfig,
        // Storage Actions
        compressQuality,
        setCompressQuality,
        // Data Management Actions
        exportData,
        importData,
        resetAppData,
        resetGlobalData,
        getChatListForExport
    }
})
