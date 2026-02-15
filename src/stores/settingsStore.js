import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLoggerStore } from './loggerStore'
import { useChatStore } from './chatStore'
import { useMomentsStore } from './momentsStore'
import { useStickerStore } from './stickerStore'
import { useWorldBookStore } from './worldBookStore'

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
        userProfile: {
            name: '乔乔',
            avatar: '/avatars/小猫星星眼.jpg',
            wechatId: 'admin',
            signature: '对方很懒，什么都没有留下'
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

                // Inject Default Preset '乌金' if missing
                if (!personalization.value.presets) personalization.value.presets = [];
                const hasWuJin = personalization.value.presets.some(p => p.name === '乌金');
                if (!hasWuJin) {
                    personalization.value.presets.unshift({
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
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        selection: selectionState
      }

      if (selectionState.chats) {
        data.chats = injectedData.chats || JSON.parse(JSON.stringify(chatStore.chats || {}))
      }
      if (selectionState.moments) {
        data.moments = injectedData.moments || JSON.parse(JSON.stringify(momentsStore.moments || []))
        data.momentsTop = injectedData.momentsTop || JSON.parse(JSON.stringify(momentsStore.topMoments || []))
        data.momentsNotifications = injectedData.momentsNotifications || JSON.parse(JSON.stringify(momentsStore.notifications || []))
      }
      if (selectionState.settings) {
        data.settings = JSON.parse(JSON.stringify(personalization.value))
      }
      if (selectionState.worldbook) {
        data.worldbook = injectedData.worldbook || JSON.parse(JSON.stringify(worldBookStore.books || []))
      }
      if (selectionState.stickers) {
        data.stickers = injectedData.stickers || JSON.parse(JSON.stringify(stickerStore.stickers || []))
      }
      if (selectionState.favorites) {
        data.favorites = injectedData.favorites || JSON.parse(JSON.stringify(chatStore.favorites || []))
      }
      if (selectionState.wallet) {
        data.wallet = { balance: 0, records: [] }
      }
      if (selectionState.weibo) {
        data.weibo = { account: null, history: [] }
      }
      if (selectionState.music) {
        data.music = { playHistory: [], favorites: [] }
      }
      if (selectionState.logs) {
        data.logs = []
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

    return {
        apiConfigs, currentConfigIndex, currentConfig, apiConfig,
        personalization, voice, weather, compressQuality, drawing,
        updateConfig, createConfig, deleteConfig,
        saveToStorage, loadFromStorage,
        setWallpaper, setIcon, clearIcon, setWidget, setCardBg, setGlobalFont, setGlobalBg, setCustomCss, setTheme, updateUserProfile,
        savePreset, loadPreset, deletePreset, resetAllPersonalization,
        setVoiceEngine, updateMinimaxConfig, updateDoubaoConfig, updateBDeTTSConfig, updateVolcPaidConfig, resetVoiceSettings,
        setWeatherConfig, updateLiveWeather, setUserLocation, setCompressQuality, setDrawingConfig,
        exportData, importData, resetAppData, resetGlobalData, getChatListForExport,

        // 👇 这两个是你备份页面必须要的
        exportFullData,
        importFullData
    }
})
