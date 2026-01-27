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

    const showLocationInput = ref(false)

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
        userLocation: {
            name: '北京市 > 朝阳区 > 某某街道',
            coords: { lat: 39.9042, lng: 116.4074 }
        },
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
            if (data) {
                console.log('[SettingsStore] Loading data from localStorage:', Object.keys(data))
            } else {
                console.warn('[SettingsStore] LocalStorage data is null/invalid.')
                return
            }

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
    function setUserLocation(location) {
        weather.value.userLocation = { ...weather.value.userLocation, ...location }
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

    // Data Management (LEGACY - Use BackupSettings.vue or localforage directly)
    /**
     * FULL SYSTEM EXPORT: Aggregates data from ALL stores (IndexedDB + LocalStorage)
     * This is the "Engine" for migration packages and cloud sync.
     */
    async function exportFullData(selection = {}, injectedData = {}) {
        const localforage = (await import('localforage')).default
        const data = {
            version: '2.1',
            timestamp: Date.now(),
            type: 'qiaoqiao_full_migration',
            payload: {}
        };

        const s = {
            chats: true, moments: true, settings: true,
            worldbook: true, stickers: true, favorites: true,
            wallet: true, weibo: true, music: true,
            avatarFrames: true, calls: true, logs: true,
            ...selection
        };

        // --- 1. IndexedDB Assets (Async) ---
        try {
            if (s.chats) {
                if (injectedData.chats) {
                    data.payload.chats = injectedData.chats;
                    console.log('[Export] Using injected chats');
                } else {
                    data.payload.chats = await localforage.getItem('qiaoqiao_chats_v2');
                }
            }
            if (s.moments) {
                if (injectedData.moments) {
                    data.payload.moments = injectedData.moments;
                    data.payload.momentsTop = injectedData.momentsTop;
                    data.payload.momentsNotifications = injectedData.momentsNotifications;
                    console.log('[Export] Using injected moments');
                } else {
                    const momentsDB = localforage.createInstance({ name: 'qiaoqiao-phone', storeName: 'moments' });
                    data.payload.moments = await momentsDB.getItem('all_moments');
                    data.payload.momentsTop = localStorage.getItem('wechat_moments_top');
                    data.payload.momentsNotifications = localStorage.getItem('wechat_moments_notifications');
                }
            }
            if (s.worldbook) {
                if (injectedData.worldbook) {
                    data.payload.worldbook = injectedData.worldbook;
                    console.log('[Export] Using injected worldbook');
                } else {
                    data.payload.worldbook = await localforage.getItem('wechat_worldbook_books');
                }
            }
        } catch (e) { console.error('[Export] IndexedDB failed:', e); }

        // --- 2. LocalStorage Assets ---
        // Also check injected for some of these if available
        const storageMap = {
            settings: 'qiaoqiao_settings',
            stickers: 'wechat_global_emojis',
            favorites: 'wechat_favorites',
            logs: 'system_logs',
            wallet: 'qiaoqiao_wallet',
            weibo: 'wechat_weibo_data',
            music: 'musicPlaylist',
            avatarFrames: 'avatar_frames',
            calls: 'wechat_calls'
        };

        for (const [key, lsKey] of Object.entries(storageMap)) {
            if (!s[key]) continue;

            if (injectedData[key]) {
                data.payload[key] = injectedData[key];
                continue;
            }

            const val = localStorage.getItem(lsKey);
            if (val) {
                try { data.payload[key] = JSON.parse(val); }
                catch (e) { data.payload[key] = val; }
            }
        }

        return data;
    }

    /**
     * FULL SYSTEM IMPORT: Distributes data back to all stores and triggers persistence.
     */
    async function importFullData(jsonContent) {
        try {
            const localforage = (await import('localforage')).default
            const raw = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
            console.log('[Import] Raw keys:', Object.keys(raw));
            const payload = raw.payload || raw.data || raw; // Handle various wrap formats
            console.log('[Import] Payload keys:', Object.keys(payload));

            let count = 0;

            // --- Compatibility Helper: Find key case-insensitively or via aliases ---
            const findKey = (obj, keys) => {
                const lowerKeys = keys.map(k => k.toLowerCase());
                for (const k of Object.keys(obj)) {
                    if (lowerKeys.includes(k.toLowerCase())) return obj[k];
                }
                return undefined;
            };

            // --- 1. IndexedDB Restore ---
            const chatsData = payload.chats || payload.qiaoqiao_chats || payload.wechat_chats || findKey(payload, ['chats', 'chat', 'history']);
            if (chatsData) {
                console.log('[Import] Restoring chats...');
                await localforage.setItem('qiaoqiao_chats_v2', chatsData);
                localStorage.setItem('qiaoqiao_migrated', 'true');
                count++;
            }

            const momentsData = payload.moments || payload.wechat_moments || findKey(payload, ['moments', 'moment', 'feed']);
            if (momentsData) {
                console.log('[Import] Restoring moments...');
                const momentsDB = localforage.createInstance({ name: 'qiaoqiao-phone', storeName: 'moments' });
                await momentsDB.setItem('all_moments', momentsData);

                const mTop = payload.momentsTop || payload.topMoments || payload.wechat_moments_top;
                if (mTop) localStorage.setItem('wechat_moments_top', typeof mTop === 'string' ? mTop : JSON.stringify(mTop));

                const mNotif = payload.momentsNotifications || payload.notifications || payload.wechat_moments_notifications;
                if (mNotif) localStorage.setItem('wechat_moments_notifications', typeof mNotif === 'string' ? mNotif : JSON.stringify(mNotif));

                count++;
            }

            const wbData = payload.worldbook || payload.wechat_worldbook_books || findKey(payload, ['worldbook', 'books']);
            if (wbData) {
                console.log('[Import] Restoring worldbook...');
                await localforage.setItem('wechat_worldbook_books', wbData);
                count++;
            }

            // --- 2. LocalStorage Restore ---
            // Map: Internal Store Key -> [Possible Backup Keys]
            const storageMapping = {
                'qiaoqiao_settings': ['settings', 'config', 'qiaoqiao_settings', 'setup'],
                'wechat_global_emojis': ['stickers', 'emojis', 'wechat_global_emojis'],
                'wechat_favorites': ['favorites', 'favs', 'wechat_favorites'],
                'system_logs': ['logs', 'system_logs', 'log'],
                'qiaoqiao_wallet': ['wallet', 'money', 'qiaoqiao_wallet'],
                'wechat_weibo_data': ['weibo', 'wechat_weibo_data', 'blogs'],
                'musicPlaylist': ['music', 'playlist', 'musicPlaylist'],
                'avatar_frames': ['avatarFrames', 'frames', 'avatar_frames'],
                'wechat_calls': ['calls', 'callHistory', 'wechat_calls']
            };

            for (const [lsKey, aliases] of Object.entries(storageMapping)) {
                // Direct match fallback
                let val = payload[aliases[0]] // check primary first
                if (val === undefined) val = findKey(payload, aliases)

                // If the payload IS the localStorage dump (flat key match)
                if (val === undefined && payload[lsKey]) val = payload[lsKey]

                if (val !== undefined) {
                    console.log(`[Import] Restoring ${lsKey} from alias match...`);
                    const dataStr = typeof val === 'string' ? val : JSON.stringify(val);
                    localStorage.setItem(lsKey, dataStr);
                    count++;
                }
            }

            console.log(`[Import] Total restored items: ${count}`);

            // If count is 0, let's try a last-resort "Flat Import" 
            // This handles files that might just be a direct dump of a single store.
            if (count === 0) {
                console.log('[Import] Trying flat import fallback...');
                // Check if the payload ITSELF looks like a chats object or a settings object
                if (payload.chats || (typeof payload === 'object' && Object.values(payload).some(v => v.msgs))) {
                    console.log('[Import] Detected flat chats structure, applying...');
                    await localforage.setItem('qiaoqiao_chats_v2', payload.chats || payload);
                    count++;
                }
            }

            if (count > 0) {
                setTimeout(() => window.location.reload(), 1000);
                return true;
            }
            console.warn('[Import] No matching keys found in payload!', payload);
            return false;
        } catch (e) {
            console.error('[Import] Full import failed:', e);
            return false;
        }
    }

    // LEGACY METHODS (Wrapped for compat)
    function exportData(options) { return JSON.stringify(exportFullData(options)); }
    async function importData(json) { return await importFullData(json); }

    async function resetAppData(options = {}) {
        if (options.wechat) {
            localStorage.removeItem('qiaoqiao_chats')
            localStorage.removeItem('wechat_chats') // Legacy key
            try {
                const localforage = (await import('localforage')).default
                await localforage.removeItem('qiaoqiao_chats_v2')
            } catch (e) { }
        }
        if (options.wallet) localStorage.removeItem('qiaoqiao_wallet')
        if (options.settings) localStorage.removeItem('qiaoqiao_settings')
        if (options.moments) localStorage.removeItem('wechat_moments')

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
        saveToStorage, loadFromStorage, showLocationInput,
        setWallpaper, setIcon, clearIcon, setWidget, setCardBg, setGlobalFont, setGlobalBg, setCustomCss, setTheme, updateUserProfile,
        savePreset, loadPreset, deletePreset, resetAllPersonalization,
        setVoiceEngine, updateMinimaxConfig, resetVoiceSettings,
        setWeatherConfig, updateLiveWeather, setCompressQuality, setDrawingConfig, setUserLocation,
        exportData, importData, resetAppData, resetGlobalData,
        exportFullData, importFullData
    }
})
