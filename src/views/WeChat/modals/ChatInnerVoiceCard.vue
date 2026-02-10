<template>
    <div v-if="visible" id="inner-voice-modal" class="active" @click.self="$emit('close')">
        <div class="voice-modal-content" @click.stop>
            <!-- Canvas for particles -->
            <canvas ref="voiceCanvas" id="voice-effect-canvas"></canvas>

            <!-- Header -->
            <div class="voice-modal-header">
                <button class="voice-modal-header-btn" @click="$emit('close')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="header-tab-group">
                    <div class="header-tab" :class="{ active: activeTab === 'main' }" @click="activeTab = 'main'">
                        Mindscape</div>
                    <div class="header-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">
                        State</div>
                </div>
                <div class="flex gap-2">
                    <button class="voice-modal-header-btn" @click="toggleHistory" title="历史记录">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div class="voice-modal-body">
                <!-- Tab 1: Main Mindscape -->
                <div v-if="!showHistory && activeTab === 'main'" id="voice-character-view" class="animate-fade-in">
                    <div class="voice-header-group">
                        <div class="voice-char-avatar-box">
                            <img :src="chatData.avatar" alt="Avatar">
                        </div>
                        <div class="voice-char-name">{{ chatData.name }}</div>
                        <div class="voice-char-meta">Current Mood / {{ historyList.length > 0 ? '已记录' : '无记录' }}</div>
                    </div>

                    <div class="voice-grid">
                        <div class="voice-card-inner">
                            <span class="voice-label-center">· 内 心 独 白 ·</span>
                            <div class="voice-text-inner">
                                {{ currentVoiceContent.mind || '（此刻内心毫无波澜...）' }}
                            </div>
                        </div>

                        <div class="voice-row mt-6">
                            <div class="voice-info-block">
                                <div class="voice-label">OUTFIT 穿搭</div>
                                <div class="voice-text-content">{{ currentVoiceContent.clothes || '—' }}</div>
                            </div>
                            <div class="voice-info-block">
                                <div class="voice-label">SCENE 环境</div>
                                <div class="voice-text-content">{{ currentVoiceContent.scene || '—' }}</div>
                            </div>
                        </div>

                        <div class="voice-info-block mt-4">
                            <div class="voice-label">ACTION 姿态</div>
                            <div class="voice-text-content">{{ currentVoiceContent.action || '—' }}</div>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: State & Positioning -->
                <div v-else-if="!showHistory && activeTab === 'stats'" class="animate-fade-in flex flex-col gap-6">
                    <!-- Top Status -->
                    <div class="stats-entry-group">
                        <div class="stats-row">
                            <div class="stats-item">
                                <div class="stats-label">DATE 日期</div>
                                <div class="stats-value">{{ currentVoiceContent.stats?.date || '—' }}</div>
                            </div>
                            <div class="stats-item text-right">
                                <div class="stats-label">TIME 时间</div>
                                <div class="stats-value font-mono">{{ currentVoiceContent.stats?.time || '—' }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Progress Bars -->
                    <div class="stats-bars-group">
                        <div class="bar-entry">
                            <div class="bar-label-row">
                                <span>EMOTION {{ getStatLabel('emotion', currentVoiceContent.stats?.emotion) }}</span>
                                <span>{{ getStatValue(currentVoiceContent.stats?.emotion) }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill emotion"
                                    :style="{ width: getStatValue(currentVoiceContent.stats?.emotion) + '%' }"></div>
                            </div>
                        </div>
                        <div class="bar-entry">
                            <div class="bar-label-row">
                                <span>SPIRIT {{ getStatLabel('spirit', currentVoiceContent.stats?.spirit) }}</span>
                                <span>{{ getStatValue(currentVoiceContent.stats?.spirit) }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill spirit"
                                    :style="{ width: getStatValue(currentVoiceContent.stats?.spirit) + '%' }"></div>
                            </div>
                        </div>
                        <div class="bar-entry">
                            <div class="bar-label-row">
                                <span>MOOD {{ getStatLabel('mood', currentVoiceContent.stats?.mood) }}</span>
                                <span>{{ getStatValue(currentVoiceContent.stats?.mood) }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill mood"
                                    :style="{ width: getStatValue(currentVoiceContent.stats?.mood) + '%' }"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Realistic Connection-Style Location -->
                    <div class="location-card premium-mode">
                        <div class="stats-label mb-3">CONNECTION 实时测距</div>

                        <div class="location-route-display">
                            <div class="route-stop">
                                <span class="stop-label">对方位置</span>
                                <span class="stop-name">{{ currentVoiceContent.stats?.location?.replace(/乔乔/g, 'Chilly')
                                    || '未追踪' }}</span>
                            </div>

                            <div class="route-link">
                                <div class="link-line"></div>
                                <div class="link-info">
                                    <i class="fa-solid fa-person-walking animate-walk"></i>
                                    <span class="link-dist">{{ formatDistance(currentVoiceContent.stats?.distance) ||
                                        '...' }}</span>
                                </div>
                            </div>

                            <div class="route-stop text-right">
                                <span class="stop-label">我的位置</span>
                                <span class="stop-name">{{ chatData?.userLocation ||
                                    settingsStore.weather.userLocation?.name ||
                                    settingsStore.weather.virtualLocation || '未知' }}</span>
                            </div>
                        </div>

                        <!-- Realistic Simulated Map with City Map Images -->
                        <div class="mini-map-container mt-4 animate-scale-up" :style="mapContainerStyle">
                            <div class="map-image-layer"></div>
                            <div class="map-glare-overlay"></div>

                            <!-- Distance Connector -->
                            <svg class="map-svg-overlay" width="100%" height="100%">
                                <defs>
                                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" style="stop-color:#d4af37;stop-opacity:0.2" />
                                        <stop offset="50%" style="stop-color:#d4af37;stop-opacity:0.8" />
                                        <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.2" />
                                    </linearGradient>
                                </defs>
                                <line :x1="userCoord.x + '%'" :y1="userCoord.y + '%'" :x2="finalCharCoord.x + '%'"
                                    :y2="finalCharCoord.y + '%'" class="map-connection-line" />

                            </svg>

                            <!-- Map Markers with Avatars -->
                            <div class="map-marker-premium user" :style="userPosStyle">
                                <div class="marker-avatar-container">
                                    <img :src="chatData?.userAvatar || userProfile?.avatar || '/broken-image.png'"
                                        class="marker-avatar">
                                    <div class="marker-ring"></div>
                                </div>
                                <div class="marker-info-tag">
                                    <span class="marker-name">{{ chatData?.userName || userProfile?.name || '我'
                                    }}</span>
                                </div>
                            </div>

                            <div class="map-marker-premium char" :style="charPosStyle">
                                <div class="marker-avatar-container char">
                                    <img :src="chatData?.avatar || '/broken-image.png'" class="marker-avatar">
                                    <div class="marker-ring char pulse"></div>
                                </div>
                                <div class="marker-info-tag char">
                                    <span class="marker-name">{{ chatData?.name || '对方' }}</span>
                                </div>
                            </div>


                            <div class="map-nav-panel">
                                <div class="nav-item">
                                    <i class="fa-solid fa-diamond-turn-right text-blue-400"></i>
                                    <span>{{ formatDistance(currentVoiceContent.stats?.distance) || '计算中' }}</span>
                                </div>
                                <div class="nav-divider"></div>
                                <div class="nav-item">
                                    <i class="fa-solid fa-clock opacity-50"></i>
                                    <span>约{{ calculateTravelTime(currentVoiceContent.stats?.distance) }}min</span>
                                </div>
                            </div>

                            <div class="map-brand-watermark">AMAP High-Res</div>
                        </div>
                    </div>
                </div>

                <!-- History View -->
                <div v-else id="voice-history-view" class="animate-fade-in">
                    <div id="voice-history-list" class="flex flex-col gap-2">
                        <div v-for="(item, idx) in sortedHistory" :key="item.id" class="voice-history-card"
                            @click="loadFromHistory(item.originalIndex)">
                            <div class="voice-history-time">{{ formatTime(item.timestamp) }}</div>
                            <div class="voice-history-preview">{{ item.preview }}</div>
                        </div>
                        <div v-if="historyList.length === 0" class="text-center text-gray-500 mt-10 text-xs">暂无历史记录
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="voice-modal-footer">
                <span class="footer-count">NO.{{ (currentIndex + 1).toString().padStart(2, '0') }} · {{
                    formatTime(currentVoice?.timestamp) }}</span>
                <div class="flex gap-2">
                    <button class="voice-modal-header-btn opacity-50 hover:opacity-100" @click="deleteCurrent"
                        title="删除当前">
                        <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
                    </button>
                    <div class="effect-badge" @click="toggleEffect">
                        <div class="effect-emoji-box">{{ currentEffect.emoji }}</div>
                        <div class="effect-name-box" :class="'len-' + currentEffect.name.length">
                            <span v-for="(char, i) in currentEffect.name" :key="i">{{ char }}</span>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Delete Confirm Overlay -->
            <div v-if="showDeleteConfirm"
                class="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
                <div class="text-[#e6dcc0] mb-6 font-serif">确定要删除这条记录吗？</div>
                <div class="flex gap-4">
                    <button @click="showDeleteConfirm = false"
                        class="px-6 py-2 text-gray-400 border border-gray-600 rounded-full text-sm">取消</button>
                    <button @click="confirmDelete"
                        class="px-6 py-2 text-red-400 border border-red-900 bg-red-900/20 rounded-full text-sm">确定删除</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useChatStore } from '../../../stores/chatStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({
    visible: Boolean,
    chatId: String,
    initialMsgId: String,
    chatData: Object
})

const emit = defineEmits(['close'])
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const userProfile = computed(() => settingsStore.personalization.userProfile)

const voiceCanvas = ref(null)
const showHistory = ref(false)
const showDeleteConfirm = ref(false)
const currentIndex = ref(0)
const activeTab = ref('main')

// --- Effect Types from Old File ---
const effectTypes = [
    { id: 'bamboo', emoji: '🎋', name: '听竹', color: '120, 160, 120', type: 'sway_fall' },
    { id: 'sakura', emoji: '🌸', name: '落樱', color: '255, 200, 210', type: 'sway_fall' },
    { id: 'snow', emoji: '❄️', name: '寒雪', color: '220, 220, 230', type: 'sway_fall' },
    { id: 'rain', emoji: '🌧️', name: '潇潇夜雨', color: '150, 180, 210', type: 'rain' },
    { id: 'storm', emoji: '⚡', name: '深夜惊雷', color: '180, 200, 220', type: 'rain_storm' },
    { id: 'fireworks', emoji: '🎆', name: '线香花火', color: '255, 215, 0', type: 'burst' },
    { id: 'meteor', emoji: '🌠', name: '星陨', color: '255, 255, 255', type: 'meteor' },
    { id: 'embers', emoji: '🔥', name: '余烬', color: '255, 100, 50', type: 'float_up_fade' },
    { id: 'gold', emoji: '✨', name: '流金', color: '212, 175, 55', type: 'flow_up' },
    { id: 'firefly', emoji: '🦋', name: '流萤', color: '160, 255, 160', type: 'wander' }
]

const currentEffectIndex = ref(Math.floor(Math.random() * effectTypes.length))
const currentEffect = computed(() => effectTypes[currentEffectIndex.value])

// --- Data Parsing Logic (Restored from Old File) ---
const parseVoiceData = (text) => {
    if (!text) return null
    let result = null
    if (typeof text === 'object') {
        result = text
    } else {
        const raw = text.toString().trim()

        // 1. Extract potential JSON block
        let jsonStr = raw.replace(/\[INNER[\s-_]*VOICE\]/i, '')
            .replace(/\[\/INNER[\s-_]*VOICE\]/i, '')
            .replace(/```json/gi, '').replace(/```/g, '').trim()

        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            jsonStr = jsonMatch[0]
        }

        // 2. Attempt Parse
        try {
            result = JSON.parse(jsonStr)
        } catch (e) {
            try {
                let fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
                fixed = fixed.replace(/[“”]/g, '"')
                result = JSON.parse(fixed)
            } catch (e2) {
                // Aggressive extraction...
            }
        }

        // Fallback or JSON processing
        if (result) {
            const getString = (val) => {
                if (!val) return null
                if (typeof val === 'string') return val.replace(/###/g, '').trim()
                if (typeof val === 'object') return val.content || val.thought || JSON.stringify(val).replace(/###/g, '').trim()
                return String(val)
            }

            let target = result
            // Check for nested structure: result.INNER_VOICE or result.inner_voice
            if (result.INNER_VOICE) target = result.INNER_VOICE
            else if (result.inner_voice) target = result.inner_voice

            // Map the final fields
            return {
                clothes: getString(target.着装 || target.outfit || target.clothes),
                scene: getString(target.环境 || target.scene || target.environment),
                mind: getString(target.心声 || target.mind || target.thought || target.thoughts || target.emotion),
                action: getString(target.行为 || target.action || target.behavior || target.plan),
                stats: target.stats || target[" stats"] || null
            }
        }
    }
    return null
}

// --- History Logic ---
const historyList = computed(() => {
    if (!props.chatId) return []
    const msgs = chatStore.chats[props.chatId]?.msgs || []

    // Robust Regex matching the one used in Store (Relaxed spaces)
    const voiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=\n\s*\[(?:CARD|DRAW|MOMENT|红包|转账|表情包|图片|SET_|NUDGE))|$)/i;

    return msgs.filter(m => {
        if (!m.content) return false;
        if (m.type === 'inner_voice_card') return true;
        // Test content against regex OR check for raw JSON characteristics
        const str = String(m.content);
        return voiceRegex.test(str) || (str.includes('{') && (str.includes('"status"') || str.includes('“status”') || str.includes('"心声"') || str.includes('“心声”')));
    }).map(m => {
        let content = m.content;
        if (typeof content === 'string') {
            const match = content.match(voiceRegex);
            if (match) {
                content = match[1]; // Extract just the JSON part
            }
            // Fallback: If no tag match but filter passed, it's likely raw JSON or missing tags. 
            // Let the parseVoiceData function handle the extraction from the raw string.
        }
        return { id: m.id, timestamp: m.timestamp, content: content };
    });
})

const currentVoice = computed(() => historyList.value[currentIndex.value])
const currentVoiceContent = computed(() => {
    if (!currentVoice.value) return {}
    return parseVoiceData(currentVoice.value.content) || {}
})

const sortedHistory = computed(() => {
    return historyList.value.map((item, index) => {
        const parsed = parseVoiceData(item.content)
        return {
            ...item,
            originalIndex: index,
            preview: parsed?.mind || (typeof item.content === 'string' ? item.content.substring(0, 35) : '...')
        }
    }).sort((a, b) => b.timestamp - a.timestamp)
})

const formatTime = (ts) => ts ? new Date(ts).toLocaleString() : '---'

// --- Stats Helpers ---
// --- Map Dynamics & Positioning ---
const rawDistance = computed(() => {
    const distStr = currentVoiceContent.value.stats?.distance || '5km'
    const numMatch = distStr.match(/\d+(\.\d+)?/)
    const num = numMatch ? parseFloat(numMatch[0]) : 5
    const isKm = distStr.includes('km') || (!distStr.includes('m') && num >= 0.5)
    return isKm ? num : num / 1000
})

// Randomized map offset based on location name and chatId to create "unique cutting" feel
const mapSeed = computed(() => {
    const str = (props.chatId || '') + (currentVoiceContent.value.stats?.location || '')
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash)
})

const markerScale = computed(() => {
    // Distance-based scaling: 1.0 (close) to 0.7 (far)
    const dist = rawDistance.value
    const scaleFactor = Math.max(0.7, 1 - (dist / 100))
    return {
        user: 1.0,
        char: scaleFactor
    }
})

const userCoord = computed(() => {
    // User is slightly offset from center but relatively stable
    return { x: 45, y: 55 }
})

const finalCharCoord = computed(() => {
    const dist = rawDistance.value
    const seed = mapSeed.value
    const angle = (seed % 360) * (Math.PI / 180)

    // Base radius from distance
    let visualRadius = Math.min(42, 8 + (dist * 1.5))

    // Anti-collision: Ensure at least 12% distance to prevent overlapping tags/avatars
    const MIN_SAFE_DIST = 15
    if (visualRadius < MIN_SAFE_DIST) {
        visualRadius = MIN_SAFE_DIST
    }

    let targetX = userCoord.value.x + Math.cos(angle) * visualRadius
    let targetY = userCoord.value.y + Math.sin(angle) * visualRadius

    // Boundary & Obscuring check: Stay away from edges and bottom panel
    // Left/Right: 5%-95%, Top: 5%-75% (avoiding bottom panel which is roughly at 80%+)
    targetX = Math.max(10, Math.min(90, targetX))
    targetY = Math.max(10, Math.min(72, targetY))

    return { x: targetX, y: targetY }
})


const userPosStyle = computed(() => ({
    left: `${userCoord.value.x}%`,
    top: `${userCoord.value.y}%`,
    zIndex: 22,
    transform: `translate(-50%, -50%) scale(${markerScale.value.user})`
}))

const charPosStyle = computed(() => ({
    left: `${finalCharCoord.value.x}%`,
    top: `${finalCharCoord.value.y}%`,
    zIndex: 21,
    opacity: markerScale.value.char > 0.8 ? 1 : 0.9,
    transform: `translate(-50%, -50%) scale(${markerScale.value.char})`
}))



const mapImages = [
    '/maps/城市地图中.png',
    '/maps/城市地图大1.png',
    '/maps/城市地图大2.png',
    '/maps/城市地图小.png'
]


const selectedMap = computed(() => {
    return mapImages[mapSeed.value % mapImages.length]
})

const mapContainerStyle = computed(() => {
    // Zoom effect: as distance increases, "zoom out" slightly, 
    // but the base scale is very high to support "random cropping"
    const dist = rawDistance.value
    const dynamicZoom = Math.max(1.2, 3 - (dist / 50)) // Stronger zoom for cropping feel

    return {
        '--map-seed': mapSeed.value,
        '--map-url': `url(${selectedMap.value})`,
        '--map-offset-x': `${(mapSeed.value % 70)}%`,
        '--map-offset-y': `${((mapSeed.value / 10) % 70)}%`,
        '--map-rotation': `${(mapSeed.value % 20) - 10}deg`, // Subtle rotation
        '--map-zoom': dynamicZoom
    }
})



const getStatValue = (val) => {

    if (typeof val === 'object' && val !== null) return val.value || 0
    return val || 0
}

const getStatLabel = (key, val) => {
    if (typeof val === 'object' && val !== null && val.label) return val.label
    const defaults = { emotion: '情绪', spirit: '精神', mood: '心情' }
    return defaults[key] || key.toUpperCase()
}

const calculateTravelTime = (distStr) => {
    if (!distStr) return 5
    // 解析距离字符串，支持m和km单位
    const numMatch = distStr.match(/\d+(\.\d+)?/)
    const num = numMatch ? parseFloat(numMatch[0]) : 0
    const isKm = distStr.includes('km') || (!distStr.includes('m') && num >= 1)

    // 将距离转换为km进行计算
    const distanceInKm = isKm ? num : num / 1000
    if (distanceInKm <= 0) return 0
    return Math.ceil(distanceInKm * 1.5)
}

// 格式化距离显示，根据距离大小自动选择m或km单位
const formatDistance = (distStr) => {
    if (!distStr) return '...'

    // 解析距离字符串
    const numMatch = distStr.match(/\d+(\.\d+)?/)
    const num = numMatch ? parseFloat(numMatch[0]) : 0

    // 根据距离大小选择合适的单位
    if (num < 1) {
        // 小于1km，转换为米
        return `${Math.round(num * 1000)}m`
    } else if (num < 10) {
        // 1-10km，保留一位小数
        return `${num.toFixed(1)}km`
    } else {
        // 10km以上，取整数
        return `${Math.round(num)}km`
    }
}

// --- Actions ---
const toggleHistory = () => { showHistory.value = !showHistory.value }
const toggleEffect = () => {
    currentEffectIndex.value = (currentEffectIndex.value + 1) % effectTypes.length
    // Re-measure in case layout changed
    const canvas = voiceCanvas.value
    if (canvas) {
        width = canvas.offsetWidth
        height = canvas.offsetHeight
        canvas.width = width
        canvas.height = height
    }
    particles.length = 0 // Clear array correctly
    initParticles()
}

const loadFromHistory = (index) => {
    currentIndex.value = index
    showHistory.value = false
}
const deleteCurrent = () => { showDeleteConfirm.value = true }
const confirmDelete = () => {
    if (!currentVoice.value || !props.chatId) return
    chatStore.deleteMessage(props.chatId, currentVoice.value.id)
    showDeleteConfirm.value = false
    if (historyList.value.length === 0) emit('close')
    else currentIndex.value = Math.max(0, currentIndex.value - 1)
}

// --- Animation Core ---
let voiceCtx = null
let particles = []
let animationFrameId = null
let width = 0, height = 0

class Particle {
    constructor(typeOverride, startX, startY) { this.init(typeOverride, startX, startY) }
    init(typeOverride, startX, startY) {
        const effect = currentEffect.value
        if (typeOverride === 'burst') {
            this.isBurst = true; this.x = startX; this.y = startY; this.prevX = this.x; this.prevY = this.y
            const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 1.5 + 0.5
            this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed
            this.gravity = 0.03; this.drag = 0.96; this.alpha = 1; this.decay = Math.random() * 0.01 + 0.005; this.size = Math.random() * 1.5 + 0.5
            return
        }
        this.isBurst = false; this.x = Math.random() * width; this.alpha = Math.random() * 0.5 + 0.2
        if (effect.type === 'sway_fall') {
            this.y = -10; this.vy = Math.random() * 0.5 + 0.3; this.vx = 0; this.size = Math.random() * 4 + 2
            this.sway = Math.random() * Math.PI * 2; this.swaySpeed = Math.random() * 0.02 + 0.01
            this.rotation = Math.random() * 360; this.rotSpeed = Math.random() - 0.5
        } else if (effect.type === 'rain' || effect.type === 'rain_storm') {
            this.y = Math.random() * height; this.vx = -0.5; this.vy = Math.random() * 10 + 15
            this.size = Math.random() * 20 + 10; this.alpha = 0.2
        } else if (effect.type === 'meteor') {
            this.x = Math.random() * width * 1.5 - width * 0.25; this.y = -100; this.vx = -4 - Math.random() * 4; this.vy = 4 + Math.random() * 4
            this.size = Math.random() * 30 + 20; this.alpha = 0; this.delay = Math.random() * 100
        } else if (effect.type === 'float_up_fade' || effect.type === 'flow_up') {
            this.y = height + 10; this.vx = Math.random() * 0.5 - 0.25; this.vy = -(Math.random() * 1 + 0.5); this.size = Math.random() * 2 + 1
            if (effect.type === 'float_up_fade') { this.alpha = 1; this.decay = 0.01 }
        } else {
            this.y = Math.random() * height; this.vx = Math.random() - 0.5; this.vy = Math.random() - 0.5; this.size = 2
        }
        this.prevX = this.x; this.prevY = this.y
    }
    update() {
        this.prevX = this.x; this.prevY = this.y; const effect = currentEffect.value
        if (this.isBurst) {
            this.vx *= this.drag; this.vy *= this.drag; this.vy += this.gravity; this.x += this.vx; this.y += this.vy; this.alpha -= this.decay
        } else if (effect.type === 'sway_fall') {
            this.y += this.vy; this.sway += this.swaySpeed; this.x += Math.sin(this.sway) * 0.5; this.rotation += this.rotSpeed
            if (this.y > height + 20) this.init()
        } else if (effect.type === 'meteor') {
            if (this.delay > 0) { this.delay--; return }; this.x += this.vx; this.y += this.vy
            if (this.y < height / 2) this.alpha += 0.05; else this.alpha -= 0.05
            if (this.alpha > 1) this.alpha = 1; if (this.y > height + 100) this.init()
        } else {
            this.x += this.vx; this.y += this.vy
            if (effect.type === 'float_up_fade') { this.alpha -= 0.005; if (this.alpha <= 0) this.init() }
            if (this.y > height + 20 && this.vy > 0) this.init()
            if (this.y < -20 && this.vy < 0) this.init()
        }
    }
    draw() {
        if (this.alpha <= 0 || !voiceCtx) return; voiceCtx.save(); const effect = currentEffect.value
        if (effect.type === 'sway_fall') {
            voiceCtx.translate(this.x, this.y); voiceCtx.rotate(this.rotation * Math.PI / 180); voiceCtx.fillStyle = `rgba(${effect.color}, ${this.alpha})`; voiceCtx.beginPath()
            if (effect.id === 'bamboo') voiceCtx.ellipse(0, 0, this.size / 3, this.size, 0, 0, Math.PI * 2)
            else if (effect.id === 'sakura') { voiceCtx.moveTo(0, 0); voiceCtx.bezierCurveTo(this.size / 2, -this.size / 2, this.size, 0, 0, this.size); voiceCtx.bezierCurveTo(-this.size, 0, -this.size / 2, -this.size / 2, 0, 0) }
            else voiceCtx.arc(0, 0, this.size / 2, 0, Math.PI * 2); voiceCtx.fill()
        } else if (this.isBurst || effect.type === 'flow_up' || effect.type === 'rain' || effect.type === 'rain_storm' || effect.type === 'meteor') {
            voiceCtx.strokeStyle = `rgba(${effect.color}, ${this.alpha})`; voiceCtx.lineWidth = this.isBurst ? this.size : 1
            if (effect.type === 'meteor') voiceCtx.lineWidth = 2; voiceCtx.beginPath(); voiceCtx.moveTo(this.prevX, this.prevY)
            let endX = this.x; let endY = this.y
            if (effect.type === 'rain' || effect.type === 'rain_storm') { endX = this.x + this.vx * 2; endY = this.y + this.size }
            else if (effect.type === 'meteor') { endX = this.x - this.vx * 8; endY = this.y - this.vy * 8 }
            voiceCtx.lineTo(endX, endY); voiceCtx.stroke()
        } else {
            voiceCtx.translate(this.x, this.y); voiceCtx.fillStyle = `rgba(${effect.color}, ${this.alpha})`
            if (effect.id === 'firefly') { voiceCtx.shadowBlur = 5; voiceCtx.shadowColor = `rgba(${effect.color}, 1)` }
            voiceCtx.beginPath(); voiceCtx.arc(0, 0, this.size, 0, Math.PI * 2); voiceCtx.fill()
        }
        voiceCtx.restore()
    }
}

const initParticles = () => {
    if (currentEffect.value.type !== 'burst') {
        let count = 40; if (currentEffect.value.type.includes('rain')) count = 100; if (currentEffect.value.type === 'meteor') count = 5
        for (let i = 0; i < count; i++) particles.push(new Particle())
    }
}

const drawLightning = () => {
    if (currentEffect.value.id !== 'storm') return
    if (Math.random() < 0.008) {
        voiceCtx.fillStyle = 'rgba(255, 255, 255, 0.15)'; voiceCtx.fillRect(0, 0, width, height)
        voiceCtx.beginPath(); let lx = Math.random() * width; let ly = 0; voiceCtx.moveTo(lx, ly)
        while (ly < height) { lx += (Math.random() - 0.5) * 80; ly += Math.random() * 50 + 20; voiceCtx.lineTo(lx, ly) }
        voiceCtx.strokeStyle = 'rgba(255,255,255,0.6)'; voiceCtx.lineWidth = 2; voiceCtx.stroke()
    }
}

let lastLaunch = 0
const startAnimation = () => {
    const loop = (timestamp) => {
        if (!props.visible || !voiceCtx || !voiceCanvas.value) return
        voiceCtx.fillStyle = 'rgba(0, 0, 0, 0.2)'; voiceCtx.fillRect(0, 0, width, height); voiceCtx.globalCompositeOperation = 'lighter'
        drawLightning()
        if (currentEffect.value.type === 'burst') {
            if (timestamp - lastLaunch > Math.random() * 2000 + 1500) {
                const x = Math.random() * width * 0.6 + width * 0.2; const y = Math.random() * height * 0.4 + height * 0.1
                for (let i = 0; i < 50; i++) particles.push(new Particle('burst', x, y)); lastLaunch = timestamp
            }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(); particles[i].draw()
            if (particles[i].isBurst && particles[i].alpha <= 0) particles.splice(i, 1)
        }
        voiceCtx.globalCompositeOperation = 'source-over'; animationFrameId = requestAnimationFrame(loop)
    }
    animationFrameId = requestAnimationFrame(loop)
}

watch(() => props.visible, (val) => {
    if (val) {
        if (!historyList.value.length) return
        const idx = historyList.value.findIndex(item => item.id === props.initialMsgId)
        currentIndex.value = idx !== -1 ? idx : historyList.value.length - 1
        nextTick(() => {
            const canvas = voiceCanvas.value
            if (!canvas) return
            width = canvas.offsetWidth; height = canvas.offsetHeight
            canvas.width = width; canvas.height = height
            voiceCtx = canvas.getContext('2d')
            particles = []
            initParticles()
            startAnimation()
        })
    } else if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
    }
})

onUnmounted(() => { if (animationFrameId) cancelAnimationFrame(animationFrameId) })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Noto+Serif+SC:wght@300;500;700&display=swap');

#inner-voice-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Noto Serif SC', serif;
}

.animate-fade-in {
    animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

.voice-modal-content {
    width: 90%;
    max-width: 380px;
    max-height: 85vh;
    height: auto;
    background: radial-gradient(circle at 50% 0%, #2a2520 0%, #0a0a0c 85%);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.06'/%3E%3C/svg%3E"),
        radial-gradient(circle at 50% 0%, #2a2520 0%, #0a0a0c 85%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.95), inset 0 0 40px rgba(0, 0, 0, 0.6);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    user-select: none;
}

#voice-effect-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    mix-blend-mode: screen;
}

.voice-modal-header {
    padding: 20px 24px;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(10, 10, 12, 0.8);
}

.header-tab-group {
    display: flex;
    gap: 16px;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.header-tab {
    font-size: 11px;
    color: #8c7e63;
    letter-spacing: 2px;
    padding: 4px 12px;
    border-radius: 16px;
    cursor: pointer;
    transition: 0.3s;
    text-transform: uppercase;
    font-family: 'Cormorant Garamond', serif;
}

.header-tab.active {
    background: #d4af37;
    color: #000;
    text-shadow: none;
    font-weight: bold;
}

.stats-entry-group {
    background: rgba(255, 255, 255, 0.03);
    padding: 16px;
    border-radius: 12px;
    border-left: 1px solid rgba(212, 175, 55, 0.3);
}

.stats-row {
    display: flex;
    justify-content: space-between;
    gap: 20px;
}

.stats-item {
    flex: 1;
}

.stats-label {
    font-size: 10px;
    color: #6d5e4a;
    letter-spacing: 2px;
    margin-bottom: 4px;
    font-family: 'Cormorant Garamond', serif;
    font-weight: bold;
}

.stats-value {
    color: #e6e6e6;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
    white-space: nowrap;
}

.stats-bars-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 4px;
}

.bar-label-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 6px;
    letter-spacing: 1px;
    font-family: 'Cormorant Garamond', serif;
}

.bar-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    overflow: hidden;
}

.bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 1s ease-out;
}

.bar-fill.emotion {
    background: linear-gradient(to right, #d4af37, #ffcf33);
}

.bar-fill.spirit {
    background: linear-gradient(to right, #8c7e63, #d4af37);
}

.bar-fill.mood {
    background: linear-gradient(to right, #615a4b, #8c7e63);
}

.location-card.premium-mode {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 20px;
}

.location-route-display {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.route-stop {
    display: flex;
    flex-direction: column;
}

.stop-label {
    font-size: 8px;
    color: #8c7e63;
    letter-spacing: 1px;
    margin-bottom: 2px;
    text-transform: uppercase;
}

.stop-name {
    font-size: 12px;
    color: #e6e6e6;
    font-weight: 300;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.route-link {
    position: relative;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.link-line {
    position: absolute;
    left: 4px;
    right: 4px;
    height: 1px;
    background: linear-gradient(to right, #d4af37, #8c7e63);
    opacity: 0.2;
}

.link-info {
    background: #1a1a1c;
    border: 1px solid rgba(212, 175, 55, 0.2);
    padding: 2px 12px;
    border-radius: 20px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.link-dist {
    font-size: 9px;
    color: #d4af37;
    font-family: font-mono;
    font-weight: bold;
    white-space: nowrap;
}

.animate-walk {
    font-size: 10px;
    color: #d4af37;
    animation: walkMotion 1.5s infinite linear;
}

@keyframes walkMotion {
    0% {
        transform: translateX(-5px);
        opacity: 0;
    }

    50% {
        transform: translateX(0);
        opacity: 1;
    }

    100% {
        transform: translateX(5px);
        opacity: 0;
    }
}

.mini-map-container {
    height: 180px;
    background: #e5e7eb;
    border-radius: 12px;
    position: relative;
    border: 1px solid rgba(0, 0, 0, 0.1);
    overflow: hidden;
    box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.1);
    --map-zoom: 1;
    /* Default zoom */
}


.map-image-layer {
    position: absolute;
    inset: -50%;
    background-image: var(--map-url);
    background-size: cover;
    background-position: var(--map-offset-x) var(--map-offset-y);
    transform: scale(var(--map-zoom)) rotate(var(--map-rotation));
    transition: all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    filter: brightness(0.95) contrast(1.05);
}

.map-glare-overlay {

    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, transparent 60%);
    pointer-events: none;
    z-index: 5;
}


.map-marker-premium {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.marker-avatar-container {
    width: 36px;
    height: 36px;
    position: relative;
    padding: 2.5px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.marker-avatar-container.char {
    background: #4a90e2;
    /* Modern map blue for marker */
}

.marker-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.marker-ring {
    position: absolute;
    inset: -3px;
    border: 2px solid rgba(74, 144, 226, 0.4);
    border-radius: 50%;
}

.marker-ring.char {
    border-color: rgba(212, 175, 55, 0.6);
}

.pulse {
    animation: markerPulse 2s infinite;
}

@keyframes markerPulse {
    0% {
        transform: scale(1);
        opacity: 0.8;
    }

    70% {
        transform: scale(1.8);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 0;
    }
}

.marker-info-tag {
    margin-top: 8px;
    background: #ffffff;
    padding: 3px 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(0, 0, 0, 0.05);
}

.marker-info-tag.char {
    background: #2c2c2e;
    border: 1px solid #4a90e2;
}

.marker-name {
    font-size: 10px;
    color: #333;
    font-weight: 600;
    max-width: 65px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.marker-info-tag.char .marker-name {
    color: #4a90e2;
}


.map-connection-line {
    stroke: #4a90e2;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 6 8;
    animation: lineDash 30s linear infinite;
    opacity: 0.6;
}

@keyframes lineDash {
    to {
        stroke-dashoffset: -200;
    }
}

.map-nav-panel {
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 10px;
    padding: 8px 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 30;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: #333;
    font-weight: 600;
    white-space: nowrap;
}

.map-brand-watermark {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 9px;
    color: rgba(0, 0, 0, 0.2);
    font-weight: 800;
    letter-spacing: 0.5px;
    pointer-events: none;
    z-index: 10;
}

.animate-scale-up {
    animation: scaleUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleUp {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.header-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 16px;
    letter-spacing: 6px;
    color: #e6dcc0;
    text-transform: uppercase;
}

.voice-modal-header-btn {
    background: transparent;
    border: none;
    color: #8c7e63;
    font-size: 16px;
    cursor: pointer;
    transition: 0.3s;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.voice-modal-header-btn:hover {
    color: #e6dcc0;
    text-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

.voice-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 24px;
    scrollbar-width: thin;
    scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
}

.voice-modal-body::-webkit-scrollbar {
    width: 4px;
}

.voice-modal-body::-webkit-scrollbar-thumb {
    background-color: rgba(212, 175, 55, 0.3);
    border-radius: 2px;
}

.voice-header-group {
    text-align: center;
    margin-bottom: 5px;
}

.voice-char-avatar-box {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    margin: 0 auto 12px;
    padding: 3px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    outline: 1px solid rgba(212, 175, 55, 0.4);
    outline-offset: 4px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
}

.voice-char-avatar-box img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
}

.voice-char-name {
    font-size: 24px;
    color: #e6dcc0;
    letter-spacing: 3px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    font-family: 'Noto Serif SC', serif;
    font-weight: 500;
}

.voice-char-meta {
    font-size: 11px;
    color: #8c7e63;
    letter-spacing: 2px;
    margin-top: 6px;
    font-style: italic;
    opacity: 0.8;
}

.voice-card-inner {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 24px 20px;
    text-align: center;
    position: relative;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.voice-card-inner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 1px;
    height: 20px;
    background: linear-gradient(to bottom, #d4af37, transparent);
}

.voice-label-center {
    font-size: 11px;
    color: #8c7e63;
    letter-spacing: 4px;
    margin-bottom: 12px;
    display: block;
    opacity: 0.7;
}

.voice-text-inner {
    font-size: 15px;
    color: #dcdcdc;
    line-height: 1.9;
    font-weight: 300;
    white-space: pre-line;
    font-family: 'Noto Serif SC', serif;
}

.voice-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.voice-info-block {
    position: relative;
    padding-left: 10px;
    border-left: 2px solid rgba(212, 175, 55, 0.2);
}

.voice-label {
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 6px;
    letter-spacing: 2px;
    font-family: 'Cormorant Garamond', serif;
    white-space: nowrap;
}

.voice-text-content {
    font-size: 13px;
    color: #a0a0a0;
    line-height: 1.6;
    text-align: justify;
    font-weight: 300;
}

.voice-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(10, 10, 12, 0.8);
    z-index: 10;
    flex-shrink: 0;
}

.footer-count {
    font-size: 10px;
    color: #555;
    letter-spacing: 2px;
    font-family: 'Cormorant Garamond', serif;
    white-space: nowrap;
}

.effect-badge {
    color: #8c7e63;
    border: 1px solid rgba(212, 175, 55, 0.15);
    padding: 3px 10px;
    border-radius: 8px;
    background: rgba(10, 10, 12, 0.4);
    backdrop-filter: blur(8px);
    cursor: pointer;
    transition: 0.3s;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.effect-emoji-box {
    font-size: 16px;
    filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.2));
}

.effect-name-box {
    display: grid;
    gap: 1.5px;
    line-height: 1;
}

.effect-name-box.len-2 {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, 1fr);
}

.effect-name-box.len-4 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
}

.effect-name-box span {
    font-size: 7.5px;
    width: 9px;
    height: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 0.5px solid rgba(212, 175, 55, 0.1);
    color: #d4af37;
    font-weight: bold;
    border-radius: 1px;
}

.effect-badge:hover {
    border-color: rgba(212, 175, 55, 0.4);
    background: rgba(255, 255, 255, 0.08);
}



/* History Card */
.voice-history-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 12px 15px;
    cursor: pointer;
    transition: all 0.3s;
}

.voice-history-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(212, 175, 55, 0.3);
}

.voice-history-time {
    font-size: 10px;
    color: #8c7e63;
    margin-bottom: 4px;
    font-family: 'Cormorant Garamond', serif;
}

.voice-history-preview {
    font-size: 13px;
    color: #a0a0a0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
