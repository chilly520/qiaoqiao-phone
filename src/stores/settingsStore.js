import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { useLoggerStore } from './loggerStore'
import { useChatStore } from './chatStore'
import { useMomentsStore } from './momentsStore'
import { useStickerStore } from './stickerStore'
import { useWorldBookStore } from './worldBookStore'
import localforage from 'localforage'

// Configure localforage for settings
const settingsDB = localforage.createInstance({
    name: 'qiaoqiao-phone',
    storeName: 'settings'
});

export const useSettingsStore = defineStore('settings', () => {
    // --- 1. Core API Configs ---
    const apiConfigs = ref([
        {
            name: '默认配置',
            baseUrl: 'http://127.0.0.1:7861/v1',
            apiKey: 'pwd',
            model: 'gemini-2.0-flash-exp',
            temperature: 0.7,
            maxTokens: 8192,
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
                syslog: '/icons/syslog.png',
                forum: '',
                calendar: '',
                shopping: '',
                eleme: '',
                live: '',
                douyin: '',
                browser: '',
                pomodoro: ''
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
        wechatBackgrounds: {
            chat: { url: '', localUrl: '' },
            contacts: { url: '', localUrl: '' },
            discover: { url: '', localUrl: '' },
            me: { url: '', localUrl: '' }
        },
        userProfile: {
            name: '我',
            avatar: '/avatars/default.jpg',
            wechatId: '',
            signature: ''
        },
        presets: [
            {
                name: '乌金',
                theme: 'dark',
                wallpaper: '/wallpaper_floral.jpg',
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
                        syslog: '/icons/syslog.png',
                        forum: '',
                        calendar: '',
                        shopping: '',
                        eleme: '',
                        live: '',
                        douyin: '',
                        browser: '',
                        pomodoro: ''
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
                    color: '#cbd5e1',
                    shadow: '0 1px 2px rgba(0,0,0,0.5)',
                    url: ''
                },
                globalBg: '',
                customCss: '',
                wallpaperOverlayOpacity: 0.5
            }
        ]
    })

    // --- 3. Other States ---
    const voice = ref({
        engine: 'doubao',
        minimax: {
            groupId: '',
            apiKey: '',
            modelId: 'speech-01-turbo',
            voiceId: ''
        },
        doubao: {
            cookie: '',
            speaker: 'zh_male_rap'
        },
        doubaoVoices: [
            { name: "霸道总裁 (男)", id: "tts.other.BV008_streaming" },
            { name: "冷酷哥哥 (男)", id: "ICL_zh_male_lengkugege_v1_tob" },
            { name: "Rap小哥 (男)", id: "zh_male_rap" },
            { name: "温柔女声 (女)", id: "tts.other.BV405_streaming" },
            { name: "温柔姐姐 (女)", id: "zh_female_zhubo" },
            { name: "温柔小妹 (女)", id: "zh_female_qingxin" },
            { name: "甜美女生 (女)", id: "zh_female_qingxin" },
            { name: "故事姐姐 (女)", id: "zh_female_story" },
            { name: "阳光青年 (男)", id: "zh_male_xiaoming" },
            { name: "四川姐姐 (女)", id: "zh_female_sichuan" },
            { name: "广西老表 (男)", id: "tts.other.BV029_streaming" },
            { name: "温柔总裁 (男)", id: "tts.other.BV056_streaming" },
            { name: "新闻主播 (男)", id: "zh_male_zhubo" },
            { name: "英文解说 (男 Adam)", id: "en_male_adam" },
            { name: "英文解说 (男 Bob)", id: "en_male_bob" },
            { name: "英文甜美 (女 Sarah)", id: "en_female_sarah" },
            { name: "日语男声 (Satoshi)", id: "jp_male_satoshi" },
            { name: "日语女声 (Mai)", id: "jp_female_mai" },
            { name: "韩语男声 (Gye)", id: "kr_male_gye" },
            { name: "西班牙语 (男 George)", id: "es_male_george" },
            { name: "葡萄牙语 (女 Alice)", id: "pt_female_alice" },
            { name: "德语女声 (Sophie)", id: "de_female_sophie" },
            { name: "法语男声 (Enzo)", id: "fr_male_enzo" },
            { name: "印尼女声 (Noor)", id: "id_female_noor" }
        ],
        bdetts: {
            speaker: 'zh_female_cancan_mars_bigtts'
        },
        bdettsVoices: [
            // --- 官方标准女声 ---
            { name: "通用女声 (灿灿)", id: "zh_female_cancan_mars_bigtts" }, // 最稳的标准女声
            { name: "清新女声 (小清新)", id: "zh_female_qingxin" },
            { name: "知性女声 (林说)", id: "zh_female_zhixing" },
            { name: "俏皮女声 (小俏皮)", id: "zh_female_qiaopi" },
            { name: "甜美女声 (小甜美)", id: "zh_female_tianmei" },
            { name: "邻家女孩 (小倩)", id: "zh_female_xiaoqian" },
            { name: "故事女声 (姐姐)", id: "zh_female_story" },
            { name: "温柔女声 (悦悦)", id: "zh_female_xiaoyue" },
            { name: "婆婆 (长生婆婆)", id: "zh_female_changshengpopo" },
            { name: "武则天 (霸气女皇)", id: "zh_female_wuzetian" },
            { name: "呆萌女声 (萌丫头)", id: "zh_female_mengyatou" },
            { name: "天津小可 (天津话)", id: "zh_female_xiaoke" },
            { name: "东北理性姐", id: "zh_female_dblizhi" },
            { name: "东北强势妹", id: "zh_female_dbqiangshi" },
            { name: "台湾女声 (林志玲风)", id: "zh_female_taiwan" },
            { name: "四川女声 (方言)", id: "zh_female_sichuan" },
            { name: "陕西女声 (方言)", id: "zh_female_shanxi" },

            // --- 官方标准男声 ---
            { name: "阳光男声 (小明)", id: "zh_male_xiaoming" }, // 最稳的标准男声
            { name: "亲切男声 (小亲切)", id: "zh_male_qinqie" },
            { name: "醇厚男声 (男播音)", id: "zh_male_chunhou" },
            { name: "开朗男声 (小建)", id: "zh_male_xiaojian" },
            { name: "活力男声 (小活力)", id: "zh_male_huoli" },
            { name: "悬疑解说 (冷酷/霸道)", id: "zh_male_changtianyi_xuanyi" }, // 完美替代冷酷哥哥
            { name: "古风男主 (小说旁白)", id: "zh_male_novel_narration" },
            { name: "译制片男声 (旁白/大佐)", id: "zh_male_narration" }, // 也可用 zh_male_ad_narration
            { name: "四郎 (甄嬛传)", id: "zh_male_silang" },
            { name: "京味男声 (侃爷)", id: "zh_male_beijing" },
            { name: "东北男声 (方言)", id: "zh_male_dongbei" },
            { name: "港普男声 (辉哥)", id: "zh_male_liangjiahui" },
            { name: "说唱男声 (Rap)", id: "zh_male_rap" },

            // --- 童声 & 特色 ---
            { name: "奶气萌娃 (正太)", id: "zh_male_yuanqizhengtai" },
            { name: "童年伙伴 (小男孩)", id: "zh_male_xiaohai" },
            { name: "可发女孩 (小朋友)", id: "zh_female_xiaopengyou" },
            { name: "孙悟空 (猴哥)", id: "zh_male_sunwukong_clone2" },
            { name: "熊二 (动画)", id: "zh_male_xionger" },
            { name: "佩奇猪 (动画)", id: "zh_female_peiqi" },
            { name: "樱桃丸子 (动画)", id: "zh_female_xiaowanzi" }
        ],
        volcPaid: {
            appId: '',
            token: '', // AccessToken
            speaker: 'BV004_streaming',
            emotion: 'neutral',
            speed: 1.0,
            pitch: 1.0
        },
        volcPaidVoices: [
            { name: "冷酷哥哥 (多情感)", id: "BV008_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "暖心姐姐", id: "BV004_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "开朗姐姐", id: "BV005_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "温柔桃子", id: "BV104_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "阳光甜妹", id: "BV021_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "撒娇学妹", id: "BV023_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "妩媚御姐", id: "BV024_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "和蔼奶奶", id: "BV006_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "邻居阿姨", id: "BV020_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "港片女主", id: "BV014_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "温暖阿虎", id: "BV011_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "霸道总裁 (冷酷)", id: "BV008_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "优柔帮主", id: "BV052_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "总裁大叔", id: "BV053_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "深夜播客", id: "BV013_streaming", emotions: ['neutral', 'happy', 'sad', 'angry', 'fear', 'disgust', 'surprise'] },
            { name: "阳光青年", id: "zh_male_xiaoming", emotions: ['neutral'] }
        ]
    })
    const weather = ref({
        virtualLocation: '',
        realLocation: '',
        userLocation: null,
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

    // --- 3.5 Offline Mode State (Per Chat) ---
    // 改为按聊天 ID 存储，每个聊天独立的线上线下状态和背景设置
    const chatOfflineModes = ref({}) // { chatId: { isOfflineMode: boolean, enableAIBackground: boolean, customBackground: string, backgroundHistory: array, backgroundType: string, themeMode: string, opacity: number, blur: number, fontScale: number } }
    
    // --- 3.6 Global Font Scale ---
    const fontScale = ref(1) // 全局字体缩放比例，默认 1
    
    // 获取指定聊天的线下模式状态
    function getChatOfflineMode(chatId) {
        if (!chatId) return { isOfflineMode: false, enableAIBackground: false, customBackground: '', backgroundType: 'default', themeMode: 'day', opacity: 1, blur: 0 }
        
        if (!chatOfflineModes.value[chatId]) {
            chatOfflineModes.value[chatId] = {
                isOfflineMode: false,
                enableAIBackground: false,
                customBackground: '',
                backgroundHistory: [],  // 背景图历史记录
                backgroundType: 'default',
                themeMode: 'day',
                opacity: 1,
                blur: 0
            }
        }
        return chatOfflineModes.value[chatId]
    }
    
    // 设置指定聊天的线下模式状态
    function setChatOfflineMode(chatId, config) {
        if (!chatId) return
        const current = getChatOfflineMode(chatId)
        chatOfflineModes.value[chatId] = { ...current, ...config }
        saveToStorage()
    }
    
    // 切换指定聊天的线上线下模式
    function toggleChatOfflineMode(chatId) {
        if (!chatId) return
        const current = getChatOfflineMode(chatId)
        chatOfflineModes.value[chatId] = { ...current, isOfflineMode: !current.isOfflineMode }
        saveToStorage()
    }
    
    // 切换指定聊天的 AI 背景生成
    function toggleChatAIBackground(chatId) {
        if (!chatId) return
        const current = getChatOfflineMode(chatId)
        chatOfflineModes.value[chatId] = { ...current, enableAIBackground: !current.enableAIBackground }
        saveToStorage()
    }

    // 添加背景图到历史记录
    function addBackgroundToHistory(chatId, imageUrl, scenePrompt) {
        if (!chatId || !imageUrl) return
        const current = getChatOfflineMode(chatId)
        if (!current.backgroundHistory) current.backgroundHistory = []

        // 避免重复添加相同的背景图（最近5条内）
        const recent5 = current.backgroundHistory.slice(0, 5)
        const isDuplicate = recent5.some(bg => bg.url === imageUrl)

        if (!isDuplicate) {
            current.backgroundHistory.unshift({
                url: imageUrl,
                prompt: scenePrompt || '',
                timestamp: Date.now(),
                date: new Date().toLocaleString('zh-CN')
            })

            // 最多保留20条历史记录
            if (current.backgroundHistory.length > 20) {
                current.backgroundHistory = current.backgroundHistory.slice(0, 20)
            }

            chatOfflineModes.value[chatId] = { ...current }
            saveToStorage()
            console.log(`[SettingsStore] 背景图已添加到历史，当前共 ${current.backgroundHistory.length} 条`)
        }

        return current.backgroundHistory
    }
    
    // 兼容旧代码的 getter（返回当前聊天的状态）
    const isOfflineMode = computed(() => {
        const chatStore = useChatStore()
        const currentChatId = chatStore.currentChatId
        return currentChatId ? getChatOfflineMode(currentChatId).isOfflineMode : false
    })
    
    const offlineMode = computed(() => {
        const chatStore = useChatStore()
        const currentChatId = chatStore.currentChatId
        return currentChatId ? getChatOfflineMode(currentChatId) : { enableAIBackground: false, customBackground: '', backgroundType: 'default', themeMode: 'day', opacity: 1, blur: 0 }
    })

    // --- 4. Persistence Helpers ---
    const isInitialized = ref(false)

    async function saveToStorage() {
        try {
            // Revert to JSON-based deep clone as it is the most reliable way to strip 
            // reactive proxies and ensure the object is cloneable for IndexedDB.
            // Using toRaw on the main fields first to improve performance.
            const dataToSave = {
                apiConfigs: JSON.parse(JSON.stringify(toRaw(apiConfigs.value))),
                currentConfigIndex: toRaw(currentConfigIndex.value),
                personalization: JSON.parse(JSON.stringify(toRaw(personalization.value))),
                voice: JSON.parse(JSON.stringify(toRaw(voice.value))),
                weather: JSON.parse(JSON.stringify(toRaw(weather.value))),
                compressQuality: toRaw(compressQuality.value),
                drawing: JSON.parse(JSON.stringify(toRaw(drawing.value))),
                chatOfflineModes: JSON.parse(JSON.stringify(toRaw(chatOfflineModes.value))),
                fontScale: toRaw(fontScale.value)
            }
            
            // Save to IndexedDB (localforage)
            await settingsDB.setItem('qiaoqiao_settings_v2', dataToSave)
            console.log('[SettingsStore] Saved to localforage.')
            // To fully resolve the user's issue, we gradually remove it from localStorage once migrated
            if (isInitialized.value && localStorage.getItem('qiaoqiao_settings')) {
                localStorage.removeItem('qiaoqiao_settings')
            }
        } catch (e) {
            console.error('[SettingsStore] Failed to save to localforage:', e)
            // Fallback: don't let the crash bubble up and kill the UI thread
        }
    }

    async function loadFromStorage() {
        try {
            // 1. Try localforage first
            let data = await settingsDB.getItem('qiaoqiao_settings_v2')
            
            // 2. Migration from localStorage
            if (!data) {
                const saved = localStorage.getItem('qiaoqiao_settings')
                if (saved) {
                    data = JSON.parse(saved)
                    console.log('[SettingsStore] Migrating from localStorage...')
                }
            }

            if (!data) {
                console.log('[SettingsStore] No saved settings found.')
                isInitialized.value = true
                return
            }

            console.log('[SettingsStore] Loading data:', Object.keys(data))

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

                // WeChat Backgrounds Migration
                if (data.personalization.wechatBackgrounds) {
                    personalization.value.wechatBackgrounds = {
                        ...personalization.value.wechatBackgrounds,
                        ...data.personalization.wechatBackgrounds
                    }
                } else {
                    // Legacy: Check old key if necessary
                    const legacy = localStorage.getItem('qiaqiao_background_settings')
                    if (legacy) {
                        try {
                            const legacyData = JSON.parse(legacy)
                            personalization.value.wechatBackgrounds = {
                                ...personalization.value.wechatBackgrounds,
                                ...legacyData
                            }
                        } catch (e) { }
                    }
                }

                // Inject Default Preset '乌金' if missing
                if (!personalization.value.presets) personalization.value.presets = [];
                const hasWuJin = personalization.value.presets.some(p => p.name === '乌金');
                if (!hasWuJin) {
                    personalization.value.presets.unshift({
                        name: '乌金',
                        theme: 'default', // Don't force dark theme, keep current theme
                        wallpaper: '/wallpaper_floral.jpg',
                        icons: {
                            app: 'wechat',
                            url: '',
                            map: {
                                // Only configure icons that actually exist in /public/icons/
                                wechat: '/icons/wechat.png',
                                weibo: '/icons/weibo.png',
                                couple: '/icons/couple.png',
                                games: '/icons/games.png',
                                settings: '/icons/settings.png',
                                worldbook: '/icons/worldbook.png',
                                reset: '/icons/reset.png',
                                syslog: '/icons/syslog.png',
                                search: '/icons/search.png'
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
                            color: '#cbd5e1',
                            shadow: '0 1px 2px rgba(0,0,0,0.5)',
                            url: ''
                        },
                        globalBg: '',
                        customCss: '',
                        wallpaperOverlayOpacity: 0.5
                    });
                }
            }

            if (data.voice) {
                voice.value.engine = data.voice.engine || 'browser'
                if (data.voice.minimax) {
                    voice.value.minimax = { ...voice.value.minimax, ...data.voice.minimax }
                }
                if (data.voice.doubao) {
                    voice.value.doubao = { ...voice.value.doubao, ...data.voice.doubao }
                }
                if (data.voice.doubaoVoices) {
                    // Force data migration: Ensure BV056 always displays the latest name
                    voice.value.doubaoVoices = data.voice.doubaoVoices.map(v => {
                        if (v.id === 'tts.other.BV056_streaming') {
                            // Normalize all variations of the old name to the new one
                            const oldNames = ['奶气萌娃', '奶气萌娃 (女)', '温柔总裁'];
                            if (oldNames.some(old => v.name.includes(old)) || v.name === '温柔总裁') {
                                return { ...v, name: '温柔总裁 (男)' };
                            }
                        }
                        return v;
                    });
                }
            }

            if (data.weather) weather.value = { ...weather.value, ...data.weather }
            if (data.compressQuality !== undefined) compressQuality.value = data.compressQuality

            // Critical Check for Drawing
            if (data.drawing) {
                console.log('[SettingsStore] Found drawing config in storage. Model:', data.drawing.model, 'HasKey:', !!data.drawing.apiKey)
                drawing.value = { ...drawing.value, ...data.drawing }
            }

            // Load Offline Mode settings (migrate from old format to new per-chat format)
            if (data.chatOfflineModes) {
                chatOfflineModes.value = data.chatOfflineModes
            } else if (data.isOfflineMode !== undefined || data.offlineMode) {
                // 迁移旧的全局数据到新的格式
                chatOfflineModes.value._legacy_global_mode = data.isOfflineMode ?? false
                chatOfflineModes.value._legacy_global_config = data.offlineMode || {}
            }
            
            // Load Font Scale
            if (data.fontScale !== undefined) {
                fontScale.value = data.fontScale
            }

            isInitialized.value = true
            // Save back to ensure migration
            saveToStorage()
        } catch (e) {
            console.error('[SettingsStore] Failed to load settings:', e)
            isInitialized.value = true
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
    function setWechatBackground(tab, data) {
        if (!personalization.value.wechatBackgrounds) {
            personalization.value.wechatBackgrounds = { chat: {}, contacts: {}, discover: {}, me: {} }
        }
        personalization.value.wechatBackgrounds[tab] = { ...personalization.value.wechatBackgrounds[tab], ...data }
        saveToStorage()
    }

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
            const currentIconsMap = { ...personalization.value.icons.map }
            
            // Merge preset data while preserving existing icon mappings
            personalization.value = { ...preset.data, presets: currentPresets }
            
            // Merge icon mappings: start with current icons, then override with preset icons
            personalization.value.icons.map = { ...currentIconsMap }
            // Override only the icons that exist in preset
            if (preset.data.icons?.map) {
                Object.assign(personalization.value.icons.map, preset.data.icons.map)
            }
            
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
    function updateDoubaoConfig(config) { voice.value.doubao = { ...voice.value.doubao, ...config }; saveToStorage(); }
    function updateBDeTTSConfig(config) { voice.value.bdetts = { ...voice.value.bdetts, ...config }; saveToStorage(); }
    function updateVolcPaidConfig(config) { voice.value.volcPaid = { ...voice.value.volcPaid, ...config }; saveToStorage(); }
    function updateDoubaoVoices(voices) { voice.value.doubaoVoices = voices; saveToStorage(); }
    function resetVoiceSettings() {
        voice.value.engine = 'browser'
        voice.value.minimax = { groupId: '', apiKey: '', modelId: 'speech-01-turbo', voiceId: '' }
        voice.value.doubao = { cookie: '', speaker: 'tts.other.BV008_streaming' }
        voice.value.bdetts = { speaker: 'zh_female_cancan_mars_bigtts' }
        voice.value.volcPaid = { appId: '', token: '', speaker: 'BV004_streaming', emotion: 'neutral', speed: 1.0, pitch: 1.0 }
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
    function setUserLocation(location) {
        weather.value.userLocation = location
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

    // ======================================================================
    // 👇👇👇 这里是为你补全、适配你原有项目的 2 个核心方法，解决所有报错
    // ======================================================================
    const exportFullData = async (selectionState = {}, injectedData = {}) => {
        const chatStore = useChatStore()
        const momentsStore = useMomentsStore()
        const stickerStore = useStickerStore()
        const worldBookStore = useWorldBookStore()

        const data = {
            version: '3.0.0',
            timestamp: new Date().toISOString(),
            selection: selectionState
        }

        if (selectionState.chats) {
            data.chats = injectedData.chats || toRaw(chatStore.chats || {})
        }
        if (selectionState.moments) {
            data.moments = injectedData.moments || toRaw(momentsStore.moments || [])
            data.momentsTop = injectedData.momentsTop || toRaw(momentsStore.topMoments || [])
            data.momentsNotifications = injectedData.momentsNotifications || toRaw(momentsStore.notifications || [])
        }
        if (selectionState.settings) {
            data.settings = toRaw(personalization.value)
            data.apiConfigs = toRaw(apiConfigs.value)
            data.currentConfigIndex = currentConfigIndex.value
            data.voice = toRaw(voice.value)
            data.weather = toRaw(weather.value)
            data.drawing = toRaw(drawing.value)
            data.compressQuality = compressQuality.value
            data.fontScale = fontScale.value
        }
        if (selectionState.worldbook) {
            data.worldbook = injectedData.worldbook || toRaw(worldBookStore.books || [])
        }
        if (selectionState.stickers) {
            data.stickers = injectedData.stickers || toRaw(stickerStore.stickers || [])
        }
        if (selectionState.favorites) {
            data.favorites = injectedData.favorites || toRaw(chatStore.favorites || [])
        }
        if (selectionState.wallet) {
            try { const { useWalletStore } = await import('./walletStore'); const ws = useWalletStore()
                data.wallet = { balance: ws.balance, transactions: ws.transactions, bankCards: ws.bankCards, familyCards: ws.familyCards, paymentSettings: ws.paymentSettings }
            } catch(e) { data.wallet = { balance: 0, transactions: [], bankCards: [], familyCards: [], paymentSettings: { priority:['balance','family','bank'] }}}
        }
        if (selectionState.weibo) {
            try { const { useWeiboStore } = await import('./weiboStore'); const wb = useWeiboStore()
                data.weibo = { user: wb.user, settings: wb.settings, posts: wb.posts, dmMessages: wb.dmMessages }
            } catch(e) { data.weibo = null }
        }
        if (selectionState.music) {
            try { const { useMusicStore } = await import('./musicStore'); const ms = useMusicStore()
                data.music = { playlist: ms.playlist, currentIndex: ms.currentIndex, isShuffling: ms.isShuffling, repeatMode: ms.repeatMode }
            } catch(e) { data.music = null }
        }
        if (selectionState.forum) {
            try { const { useForumStore } = await import('./forumStore'); const fs = useForumStore()
                data.forum = { forums: fs.forums, alts: fs.alts, posts: fs.posts, comments: fs.comments, likedPosts: fs.likedPosts, moderators: fs.moderators }
            } catch(e) { data.forum = null }
        }
        if (selectionState.shopping) {
            try { const { useShoppingStore } = await import('./shoppingStore'); const ss = useShoppingStore()
                data.shopping = { products: ss.products, cart: ss.cart, orders: ss.orders, logistics: ss.logistics, addresses: ss.addresses, favorites: ss.favorites, coupons: ss.coupons, points: ss.points, reviews: ss.reviews }
            } catch(e) { data.shopping = null }
        }
        if (selectionState.lovespace) {
            try { const { useLoveSpaceStore } = await import('./loveSpaceStore'); const ls = useLoveSpaceStore()
                data.lovespace = { spaces: ls.spaces, currentPartnerId: ls.currentPartnerId }
            } catch(e) { data.lovespace = null }
        }
        if (selectionState.phoneinspection) {
            try { const { usePhoneInspectionStore } = await import('./phoneInspectionStore'); const ps = usePhoneInspectionStore()
                data.phoneinspection = { wallpaperLibrary: ps.wallpaperLibrary, photoFrames: ps.photoFrames }
            } catch(e) { data.phoneinspection = null }
        }
        if (selectionState.calendar) {
            try { const { default: calStore } = await import('./calendarStore'); const saved = localStorage.getItem('calendar_data')
                data.calendar = saved ? JSON.parse(saved) : null
            } catch(e) { data.calendar = null }
        }
        if (selectionState.backpack) {
            try { const { useBackpackStore } = await import('./backpackStore'); const bs = useBackpackStore()
                data.backpack = bs.items
            } catch(e) { data.backpack = null }
        }
        if (selectionState.avatarframe) {
            try { const { useAvatarFrameStore } = await import('./avatarFrameStore'); const afs = useAvatarFrameStore()
                data.avatarframe = afs.frames
            } catch(e) { data.avatarframe = null }
        }
        if (selectionState.mahjong) {
            try { const { useMahjongStore } = await import('./mahjongStore'); const mjs = useMahjongStore()
                data.mahjong = { beans: mjs.beans, score: mjs.score, rank: mjs.rank, wins: mjs.wins, losses: mjs.losses }
            } catch(e) { data.mahjong = null }
        }
        if (selectionState.worldloop) {
            try { const { useWorldLoopStore } = await import('./worldLoopStore'); const wls = useWorldLoopStore()
                data.worldloop = wls.loops
            } catch(e) { data.worldloop = null }
        }

        return data
    }

    const importFullData = async (remoteData) => {
        try {
            const chatStore = useChatStore()
            const momentsStore = useMomentsStore()
            const stickerStore = useStickerStore()
            const worldBookStore = useWorldBookStore()

            if (remoteData.chats) {
                chatStore.chats = remoteData.chats
                chatStore.saveChats?.()
            }
            if (remoteData.moments) {
                momentsStore.moments = remoteData.moments
                momentsStore.topMoments = remoteData.momentsTop || []
                momentsStore.notifications = remoteData.momentsNotifications || []
                momentsStore.saveMoments?.()
            }
            if (remoteData.settings) {
                personalization.value = { ...personalization.value, ...remoteData.settings }
                saveToStorage()
            }
            if (remoteData.apiConfigs && Array.isArray(remoteData.apiConfigs)) {
                apiConfigs.value = remoteData.apiConfigs
                if (typeof remoteData.currentConfigIndex === 'number') currentConfigIndex.value = remoteData.currentConfigIndex
                saveToStorage()
            }
            if (remoteData.voice) voice.value = { ...voice.value, ...remoteData.voice }
            if (remoteData.weather) weather.value = { ...weather.value, ...remoteData.weather }
            if (remoteData.drawing) drawing.value = { ...drawing.value, ...remoteData.drawing }
            if (typeof remoteData.compressQuality === 'number') compressQuality.value = remoteData.compressQuality
            if (typeof remoteData.fontScale === 'number') fontScale.value = remoteData.fontScale
            if (remoteData.worldbook) {
                worldBookStore.books = remoteData.worldbook
                worldBookStore.saveEntries?.()
            }
            if (remoteData.stickers) {
                stickerStore.stickers = remoteData.stickers
                stickerStore.saveStickers?.()
            }
            if (remoteData.favorites) {
                chatStore.favorites = remoteData.favorites
                chatStore.saveFavorites?.()
            }
            if (remoteData.wallet) {
                try { const { useWalletStore } = await import('./walletStore'); const ws = useWalletStore()
                    if (remoteData.wallet.balance !== undefined) ws.balance = remoteData.wallet.balance
                    if (remoteData.wallet.transactions) ws.transactions = remoteData.wallet.transactions
                    if (remoteData.wallet.bankCards) ws.bankCards = remoteData.wallet.bankCards
                    if (remoteData.wallet.familyCards) ws.familyCards = remoteData.wallet.familyCards
                    if (remoteData.wallet.paymentSettings) ws.paymentSettings = { ...ws.paymentSettings, ...remoteData.wallet.paymentSettings }
                    localStorage.setItem('qiaoqiao_wallet', JSON.stringify({ balance: ws.balance, transactions: ws.transactions, bankCards: ws.bankCards, familyCards: ws.familyCards, paymentSettings: ws.paymentSettings }))
                } catch(e) { console.warn('[Import] wallet restore failed', e)}
            }
            if (remoteData.weibo) {
                try { const { useWeiboStore } = await import('./weiboStore'); const wb = useWeiboStore()
                    if (remoteData.weibo.user) wb.user = { ...wb.user, ...remoteData.weibo.user }
                    if (remoteData.weibo.settings) wb.settings = { ...wb.settings, ...remoteData.weibo.settings }
                    if (remoteData.weibo.posts) wb.posts = remoteData.weibo.posts
                    if (remoteData.weibo.dmMessages) wb.dmMessages = remoteData.weibo.dmMessages
                    localforage.setItem('weibo_data', { user: wb.user, settings: wb.settings, posts: wb.posts, hotSearch: wb.hotSearch, dmMessages: wb.dmMessages })
                } catch(e) { console.warn('[Import] weibo restore failed', e)}
            }
            if (remoteData.music) {
                try { const ms = (await import('./musicStore')).useMusicStore()
                    if (remoteData.music.playlist) ms.playlist = remoteData.music.playlist
                    if (typeof remoteData.music.currentIndex === 'number') ms.currentIndex = remoteData.music.currentIndex
                    localStorage.setItem('musicPlaylist', JSON.stringify({ playlist: ms.playlist, currentIndex: ms.currentIndex, timestamp: Date.now() }))
                } catch(e) { console.warn('[Import] music restore failed', e)}
            }
            if (remoteData.forum) {
                try { const { useForumStore } = await import('./forumStore'); const fs = useForumStore()
                    if (remoteData.forum.forums) fs.forums = remoteData.forum.forums
                    if (remoteData.forum.alts) fs.alts = remoteData.forum.alts
                    if (remoteData.forum.posts) fs.posts = remoteData.forum.posts
                    if (remoteData.forum.comments) fs.comments = remoteData.forum.comments
                    if (remoteData.forum.likedPosts) fs.likedPosts = remoteData.forum.likedPosts
                    localforage.setItem('forum_store_v2', { forums: fs.forums, alts: fs.alts, posts: fs.posts, comments: fs.comments, likedPosts: fs.likedPosts, moderators: fs.moderators })
                } catch(e) { console.warn('[Import] forum restore failed', e)}
            }
            if (remoteData.shopping) {
                try { const { useShoppingStore } = await import('./shoppingStore'); const ss = useShoppingStore()
                    const keys = ['products','cart','orders','logistics','addresses','favorites','coupons','points','reviews']
                    keys.forEach(k => { if (remoteData.shopping[k]) ss[k] = remoteData.shopping[k] })
                    localforage.setItem('shopping_store_v2', { products: ss.products, cart: ss.cart, orders: ss.orders, logistics: ss.logistics, addresses: ss.addresses, favorites: ss.favorites, coupons: ss.coupons, points: ss.points, reviews: ss.reviews })
                } catch(e) { console.warn('[Import] shopping restore failed', e)}
            }
            if (remoteData.lovespace) {
                try { const { useLoveSpaceStore } = await import('./loveSpaceStore'); const ls = useLoveSpaceStore()
                    if (remoteData.lovespace.spaces) ls.spaces = remoteData.lovespace.spaces
                    if (remoteData.lovespace.currentPartnerId) ls.currentPartnerId = remoteData.lovespace.currentPartnerId
                } catch(e) { console.warn('[Import] lovespace restore failed', e)}
            }
            if (remoteData.phoneinspection) {
                try { const { usePhoneInspectionStore } = await import('./phoneInspectionStore'); const ps = usePhoneInspectionStore()
                    if (remoteData.phoneinspection.wallpaperLibrary) ps.wallpaperLibrary = remoteData.phoneinspection.wallpaperLibrary
                    if (remoteData.phoneinspection.photoFrames) ps.photoFrames = remoteData.phoneinspection.photoFrames
                } catch(e) { console.warn('[Import] phoneinspection restore failed', e)}
            }
            if (remoteData.calendar) {
                try { localStorage.setItem('calendar_data', JSON.stringify(remoteData.calendar)) } catch(e) {}
            }
            if (remoteData.backpack) {
                try { const { useBackpackStore } = await import('./backpackStore'); const bs = useBackpackStore()
                    bs.items = remoteData.backpack; localStorage.setItem('qiaoqiao_backpack', JSON.stringify(bs.items))
                } catch(e) { console.warn('[Import] backpack restore failed', e)}
            }
            if (remoteData.avatarframe) {
                try { const { useAvatarFrameStore } = await import('./avatarFrameStore'); const afs = useAvatarFrameStore()
                    afs.frames = remoteData.avatarframe; localStorage.setItem('avatar_frames', JSON.stringify(afs.frames))
                } catch(e) { console.warn('[Import] avatarframe restore failed', e)}
            }
            if (remoteData.mahjong) {
                try { const { useMahjongStore } = await import('./mahjongStore'); const mjs = useMahjongStore()
                    if (remoteData.mahjong.beans !== undefined) mjs.beans = remoteData.mahjong.beans
                    if (remoteData.mahjong.score !== undefined) mjs.score = remoteData.mahjong.score
                    localStorage.setItem('mahjong_stats', JSON.stringify({ beans: mjs.beans, score: mjs.score, rank: mjs.rank, wins: mjs.wins, losses: mjs.losses }))
                } catch(e) { console.warn('[Import] mahjong restore failed', e)}
            }
            if (remoteData.worldloop) {
                try { const { useWorldLoopStore } = await import('./worldLoopStore'); const wls = useWorldLoopStore()
                    wls.loops = remoteData.worldloop; wls.saveLoops?.()
                } catch(e) { console.warn('[Import] worldloop restore failed', e)}
            }
            return true
        } catch (err) {
            console.error('导入失败', err)
            return false
        }
    }
    // ======================================================================
    // 👆👆👆 补全结束
    // ======================================================================

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

    // --- Offline Mode Actions ---
    function toggleOfflineMode() {
        const chatStore = useChatStore()
        if (chatStore.currentChatId) {
            toggleChatOfflineMode(chatStore.currentChatId)
        }
    }
    function toggleAIBackground() {
        const chatStore = useChatStore()
        if (chatStore.currentChatId) {
            toggleChatAIBackground(chatStore.currentChatId)
        }
    }
    function setOfflineModeConfig(config) {
        const chatStore = useChatStore()
        if (chatStore.currentChatId) {
            setChatOfflineMode(chatStore.currentChatId, config)
        }
    }
    
    // 设置全局字体缩放
    function setFontScale(scale) {
        fontScale.value = Math.max(0.8, Math.min(1.5, scale))
        saveToStorage()
    }

    // --- Initialization ---
    loadFromStorage()

    return {
        apiConfigs, currentConfigIndex, currentConfig, apiConfig,
        personalization, voice, weather, compressQuality, drawing,
        isOfflineMode, offlineMode,
        updateConfig, createConfig, deleteConfig,
        saveToStorage, loadFromStorage,
        setWallpaper, setIcon, clearIcon, setWidget, setCardBg, setGlobalFont, setGlobalBg, setCustomCss, setTheme, updateUserProfile,
        setWechatBackground,
        savePreset, loadPreset, deletePreset, resetAllPersonalization,
        setVoiceEngine, updateMinimaxConfig, updateDoubaoConfig, updateBDeTTSConfig, updateVolcPaidConfig, resetVoiceSettings,
        setWeatherConfig, updateLiveWeather, setUserLocation, setCompressQuality, setDrawingConfig,
        toggleOfflineMode, toggleAIBackground, setOfflineModeConfig,
        getChatOfflineMode, setChatOfflineMode, toggleChatOfflineMode, toggleChatAIBackground,
        addBackgroundToHistory,
        fontScale, setFontScale,
        exportData, importData, resetAppData, resetGlobalData, getChatListForExport,

        // 👇 这两个是你备份页面必须要的
        exportFullData,
        importFullData
    }
})
