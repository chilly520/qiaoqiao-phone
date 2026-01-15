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
                <div class="header-title">Mindscape</div>
                <div class="flex gap-2">
                    <button class="voice-modal-header-btn" @click="toggleHistory" title="历史记录">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button class="voice-modal-header-btn" @click="deleteCurrent" title="删除当前">
                        <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
                    </button>
                </div>
            </div>

            <!-- Body -->
            <div class="voice-modal-body">
                <div v-if="!showHistory" id="voice-character-view" class="animate-fade-in">
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

                        <div class="voice-info-block mt-6">
                            <div class="voice-label">ACTION 姿态</div>
                            <div class="voice-text-content">{{ currentVoiceContent.action || '—' }}</div>
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
                        <div v-if="historyList.length === 0" class="text-center text-gray-500 mt-10 text-xs">暂无历史记录</div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="voice-modal-footer">
                <span class="footer-count">NO.{{ (currentIndex + 1).toString().padStart(2, '0') }} · {{ formatTime(currentVoice?.timestamp) }}</span>
                <div class="effect-badge" @click="toggleEffect">
                    {{ currentEffect.name }}
                </div>
            </div>

            <!-- Delete Confirm Overlay -->
            <div v-if="showDeleteConfirm" class="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
                <div class="text-[#e6dcc0] mb-6">确定要删除这条心声记录吗？</div>
                <div class="flex gap-4">
                    <button @click="showDeleteConfirm = false" class="px-6 py-2 text-gray-400 border border-gray-600 rounded-full text-sm">取消</button>
                    <button @click="confirmDelete" class="px-6 py-2 text-red-400 border border-red-900 bg-red-900/20 rounded-full text-sm">确定删除</button>
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
        try {
            let jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim()
            if (jsonStr.includes('\\"')) jsonStr = jsonStr.replace(/\\"/g, '"')
            if (jsonStr.startsWith('{') && !jsonStr.endsWith('}')) jsonStr += '}'
            const match = jsonStr.match(/\{[\s\S]*\}/)
            if (match) {
                try { result = JSON.parse(match[0]) } 
                catch (e) {
                    try { result = JSON.parse(match[0].replace(/\\"/g, '"').replace(/\\\\/g, '\\')) } catch (e2) { }
                }
            }
        } catch (e) { }

        if (!result) {
            const extract = (keys) => {
                for (let k of keys) {
                    const reg = new RegExp(`(?:\\\\")?${k}(?:\\\\")?\\s*[:：]\\s*(?:\\\\")?((?:[^"\\\\}]|\\\\.)*?)(?:\\\\")?(?:,|}|$)`, 'i')
                    const m = raw.match(reg)
                    if (m && m[1]) return m[1].replace(/\\"/g, '"').replace(/###/g, '').trim()
                }
                return null
            }
            const outfit = extract(['着装', 'outfit', 'clothes', 'clothing', 'OUTFIT'])
            const scene = extract(['环境', 'scene', 'environment', 'SCENE'])
            const mind = extract(['心声', 'thoughts', 'mind', 'inner_voice', 'thought', 'THOUGHTS', 'emotion', 'EMOTION'])
            const action = extract(['行为', 'action', 'behavior', 'ACTION', 'plan', 'PLAN'])
            if (outfit || scene || mind || action) {
                result = { clothes: outfit, scene: scene, mind: mind, action: action }
            }
        }
    }

    if (result) {
        const getString = (val) => {
            if (!val) return null
            if (typeof val === 'string') return val.replace(/###/g, '').trim()
            if (typeof val === 'object') return (val.想法 || val.心情 || val.content || val.thought || val.mind || JSON.stringify(val)).replace(/###/g, '').trim()
            return String(val).replace(/###/g, '').trim()
        }
        let target = result
        if (result.content && typeof result.content === 'object') target = result.content
        else if (result.inner_voice && typeof result.inner_voice === 'object') target = result.inner_voice
        
        if (typeof target["心声"] === 'object' && target["心声"] !== null) {
            const inner = target["心声"]
            return {
                clothes: getString(target["着装"] || target.outfit || target.clothes || inner.着装),
                scene: getString(target["环境"] || target.scene || inner.环境),
                mind: getString(inner.想法 || inner.心情 || inner.content || inner.thought),
                action: getString(inner.行为 || target["行为"] || target.action || target.plan)
            }
        }
        return {
            clothes: getString(target["着装"] || target.clothes || target.outfit),
            scene: getString(target["环境"] || target.scene || target.environment),
            mind: getString(target["心声"] || target.mind || target.thought || target.thoughts || target.emotion),
            action: getString(target["行为"] || target.action || target.behavior || target.plan)
        }
    }
    return null
}

// --- History Logic ---
const historyList = computed(() => {
    if (!props.chatId) return []
    const msgs = chatStore.chats[props.chatId]?.msgs || []
    return msgs.filter(m => m.content && (m.type === 'inner_voice_card' || String(m.content).includes('[INNER_VOICE]')))
        .map(m => {
            let content = m.content
            const match = String(m.content).match(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/)
            if (match) content = match[1]
            return { id: m.id, timestamp: m.timestamp, content: content }
        })
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
    from { opacity: 0; }
    to { opacity: 1; }
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
