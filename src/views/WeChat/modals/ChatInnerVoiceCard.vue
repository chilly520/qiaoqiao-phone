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
                                <span>EMOTION 情绪</span>
                                <span>{{ currentVoiceContent.stats?.emotion || 0 }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill emotion"
                                    :style="{ width: (currentVoiceContent.stats?.emotion || 0) + '%' }"></div>
                            </div>
                        </div>
                        <div class="bar-entry">
                            <div class="bar-label-row">
                                <span>SPIRIT 精神</span>
                                <span>{{ currentVoiceContent.stats?.spirit || 0 }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill spirit"
                                    :style="{ width: (currentVoiceContent.stats?.spirit || 0) + '%' }"></div>
                            </div>
                        </div>
                        <div class="bar-entry">
                            <div class="bar-label-row">
                                <span>MOOD 心情</span>
                                <span>{{ currentVoiceContent.stats?.mood || 0 }}%</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill mood"
                                    :style="{ width: (currentVoiceContent.stats?.mood || 0) + '%' }"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Location -->
                    <div class="location-card">
                        <div class="stats-label mb-2">LOCATION 当前位置</div>
                        <div class="location-text">{{ currentVoiceContent.stats?.location || '未知位置' }}</div>

                        <!-- Mini Map Visualization -->
                        <div class="mini-map-container mt-4">
                            <div class="map-bg"></div>
                            <div class="map-point user" title="用户位置"></div>
                            <div class="map-point char" title="角色位置"></div>
                            <div class="map-distance-line"></div>
                            <div class="map-distance-label">{{ currentVoiceContent.stats?.distance || '距离未知' }}</div>
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
                        {{ currentEffect.name }}
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

const props = defineProps({
    visible: Boolean,
    chatId: String,
    initialMsgId: String,
    chatData: Object
})

const emit = defineEmits(['close'])
const chatStore = useChatStore()
const voiceCanvas = ref(null)
const showHistory = ref(false)
const showDeleteConfirm = ref(false)
const currentIndex = ref(0)
const activeTab = ref('main')

// --- Effect Types from Old File ---
const effectTypes = [
    { id: 'bamboo', name: '🎋 听竹', color: '120, 160, 120', type: 'sway_fall' },
    { id: 'sakura', name: '🌸 落樱', color: '255, 200, 210', type: 'sway_fall' },
    { id: 'snow', name: '❄️ 寒雪', color: '220, 220, 230', type: 'sway_fall' },
    { id: 'rain', name: '🌧️ 潇潇夜雨', color: '150, 180, 210', type: 'rain' },
    { id: 'storm', name: '⚡ 深夜惊雷', color: '180, 200, 220', type: 'rain_storm' },
    { id: 'fireworks', name: '🎆 线香花火', color: '255, 215, 0', type: 'burst' },
    { id: 'meteor', name: '🌠 星陨', color: '255, 255, 255', type: 'meteor' },
    { id: 'embers', name: '🔥 余烬', color: '255, 100, 50', type: 'float_up_fade' },
    { id: 'gold', name: '✨ 流金', color: '212, 175, 55', type: 'flow_up' },
    { id: 'firefly', name: '🦋 流萤', color: '160, 255, 160', type: 'wander' }
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

// --- Actions ---
const toggleHistory = () => { showHistory.value = !showHistory.value }
const toggleEffect = () => {
    currentEffectIndex.value = (currentEffectIndex.value + 1) % effectTypes.length
    particles = []
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
    color: #8c7e63;
    letter-spacing: 2px;
    margin-bottom: 4px;
    font-family: 'Cormorant Garamond', serif;
}

.stats-value {
    color: #dcdcdc;
    font-size: 14px;
    font-weight: 300;
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

.location-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 16px;
    position: relative;
    overflow: hidden;
}

.location-text {
    font-size: 13px;
    color: #dcdcdc;
    font-weight: 300;
    line-height: 1.5;
}

.mini-map-container {
    height: 120px;
    background: #0d0d0f;
    border-radius: 12px;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
}

.map-bg {
    position: absolute;
    inset: 0;
    background-image:
        radial-gradient(rgba(212, 175, 55, 0.15) 1px, transparent 1px),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 20px 20px, 40px 40px, 40px 40px;
    opacity: 0.5;
}

.map-point {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    position: absolute;
    box-shadow: 0 0 10px currentColor;
    z-index: 2;
}

.map-point.user {
    color: #d4af37;
    background: #d4af37;
    top: 30%;
    left: 40%;
}

.map-point.char {
    color: #fff;
    background: #fff;
    top: 60%;
    left: 70%;
}

.map-distance-line {
    position: absolute;
    top: 30%;
    left: 40%;
    width: 38%;
    height: 38%;
    border-top: 1px dashed rgba(212, 175, 55, 0.4);
    transform: rotate(45deg);
    transform-origin: 0 0;
    z-index: 1;
}

.map-distance-label {
    position: absolute;
    bottom: 8px;
    right: 12px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    padding: 2px 8px;
    border-radius: 8px;
    font-size: 10px;
    color: #d4af37;
    font-family: font-mono;
    border: 1px solid rgba(212, 175, 55, 0.2);
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
}

.effect-badge {
    font-size: 10px;
    color: #8c7e63;
    letter-spacing: 1px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 4px 12px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: 0.3s;
}

.effect-badge:hover {
    border-color: rgba(212, 175, 55, 0.4);
    color: #e6dcc0;
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
