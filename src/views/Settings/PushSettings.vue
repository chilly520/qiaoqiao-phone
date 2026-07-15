<template>
    <div class="flex flex-col h-full bg-gradient-to-b from-slate-50 to-slate-100">
        <!-- Header -->
        <div class="px-5 pt-4 pb-3 flex items-center gap-3 bg-white/70 backdrop-blur border-b border-slate-200">
            <button @click="goBack" class="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center">
                <i class="fa-solid fa-chevron-left text-slate-700 text-sm"></i>
            </button>
            <div class="flex-1">
                <h1 class="text-base font-bold text-slate-800">前台保活</h1>
                <p class="text-[11px] text-slate-500">App 切后台也能持续运行</p>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- 前台保活 (本地 audio + MediaSession 媒体卡片) -->
            <div class="glass-panel p-5 rounded-[20px]">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center">
                        <i class="fa-solid fa-music text-indigo-600"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-slate-800">前台保活</div>
                        <div class="text-[11px] text-slate-500 mt-0.5">{{ keepAliveDescription }}</div>
                    </div>
                    <div :class="['w-3 h-3 rounded-full', keepAliveDotColor]"></div>
                </div>

                <div class="text-[12px] space-y-1.5 text-slate-600 border-t border-slate-200 pt-3">
                    <div class="flex justify-between">
                        <span>运行状态</span>
                        <span :class="keepAliveActive ? 'text-emerald-600' : 'text-slate-500'">
                            {{ keepAliveActive ? '● 播放中' : '○ 未开启' }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>audio.paused</span>
                        <span :class="keepAliveActive && !audioPaused ? 'text-emerald-600' : 'text-slate-500'">
                            {{ keepAliveActive ? (audioPaused ? '已暂停' : '播放中') : '—' }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>MediaSession</span>
                        <span :class="keepAliveActive ? 'text-emerald-600' : 'text-slate-500'">
                            {{ keepAliveActive ? '已挂载' : '—' }}
                        </span>
                    </div>
                </div>

                <div class="mt-3 space-y-2">
                    <button
                        v-if="!keepAliveActive"
                        @click="handleEnableKeepAlive"
                        :disabled="keepAliveLoading"
                        class="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-400 to-violet-500 text-white font-bold text-sm shadow-md disabled:opacity-50"
                    >
                        <i class="fa-solid fa-play mr-2"></i>
                        {{ keepAliveLoading ? '启动中…' : '开启前台保活' }}
                    </button>

                    <button
                        v-else
                        @click="handleDisableKeepAlive"
                        class="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm"
                    >
                        <i class="fa-solid fa-stop mr-2"></i>
                        关闭前台保活
                    </button>
                </div>

                <div v-if="keepAliveError" class="mt-2 text-[11px] text-rose-500">
                    <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                    {{ keepAliveError }}
                </div>
            </div>

            <!-- 工作原理说明 -->
            <div class="glass-panel p-4 rounded-[20px] text-[12px] text-slate-600 space-y-2 leading-relaxed">
                <div class="font-bold text-slate-800 mb-1">
                    <i class="fa-solid fa-circle-info text-slate-400 mr-1"></i>
                    工作原理
                </div>
                <p>1. 开启后会播放一段 15Hz 超低频静音音频（完全听不到）</p>
                <p>2. 手机通知栏会出现一个带播放控件的媒体卡片（这是保活的必要标志）</p>
                <p>3. 浏览器会认为 App 正在播放媒体，切后台时不会被杀掉</p>
                <p>4. 定时消息、主动聊天、心跳等后台任务可继续运行</p>
                <p class="text-amber-600 mt-2">
                    <i class="fa-solid fa-lightbulb mr-1"></i>
                    注意：App 被完全划掉关闭后保活会失效；如果想 App 关闭后也能收到消息需要依赖系统通知（Web Push 已在 v1.10.120 移除）。
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import { backgroundManager } from '@/utils/backgroundManager'

const router = useRouter()
const chatStore = useChatStore()

// --- 前台保活 (audio + MediaSession) ---
const keepAliveActive = ref(false)
const keepAliveLoading = ref(false)
const keepAliveError = ref('')
const audioPaused = ref(false)
let keepAlivePollTimer = null

const keepAliveDescription = computed(() => {
    if (keepAliveActive.value) return '通知栏媒体卡片已显示,App 切后台不会被杀'
    return '播放微弱音频让通知栏出现媒体卡片,App 进入后台时仍能运行'
})

const keepAliveDotColor = computed(() => {
    if (keepAliveActive.value) return 'bg-emerald-500'
    return 'bg-slate-300'
})

function goBack() {
    router.push('/settings')
}

async function handleEnableKeepAlive() {
    if (keepAliveLoading.value) return
    keepAliveError.value = ''
    keepAliveLoading.value = true

    // 先确保基础保活启动
    backgroundManager.enable()

    const result = await backgroundManager.enableRealKeepAlive({
        title: 'qiaoqiao-phone',
        artist: '随时在线',
        album: 'CHILLY',
        icon: '/pwa-192x192.png'
    })

    keepAliveLoading.value = false

    if (result.ok) {
        keepAliveActive.value = true
        chatStore.triggerToast('前台保活已开启,通知栏会出现媒体卡片', 'success')
    } else {
        const reasonMap = {
            need_user_gesture: '请直接点击按钮触发 (浏览器拦截了非手势启动)',
            play_failed: '音频播放失败,可能浏览器不支持',
            no_window: '当前环境不支持',
            already_active: '已经在运行了'
        }
        keepAliveError.value = reasonMap[result.reason] || `启动失败: ${result.reason || '未知'}`
        chatStore.triggerToast(keepAliveError.value, 'error')
    }
}

function handleDisableKeepAlive() {
    backgroundManager.disableRealKeepAlive()
    keepAliveActive.value = false
    audioPaused.value = false
    keepAliveError.value = ''
    chatStore.triggerToast('前台保活已关闭', 'info')
}

onMounted(() => {
    // 启动后同步一次保活状态
    keepAliveActive.value = backgroundManager.isKeepAliveActive()
    // 轮询 audio.paused 状态(只有页面在时才更新)
    keepAlivePollTimer = setInterval(() => {
        if (backgroundManager.isKeepAliveActive()) {
            const audio = backgroundManager.keepAliveAudio
            audioPaused.value = !!(audio && audio.paused)
        } else {
            audioPaused.value = false
        }
    }, 1000)
})

onUnmounted(() => {
    if (keepAlivePollTimer) {
        clearInterval(keepAlivePollTimer)
        keepAlivePollTimer = null
    }
})
</script>
