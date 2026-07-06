<template>
    <div class="flex flex-col h-full bg-gradient-to-b from-slate-50 to-slate-100">
        <!-- Header -->
        <div class="px-5 pt-4 pb-3 flex items-center gap-3 bg-white/70 backdrop-blur border-b border-slate-200">
            <button @click="goBack" class="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center">
                <i class="fa-solid fa-chevron-left text-slate-700 text-sm"></i>
            </button>
            <div class="flex-1">
                <h1 class="text-base font-bold text-slate-800">后台通知</h1>
                <p class="text-[11px] text-slate-500">App 关闭时也能收到消息推送</p>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- 状态卡片 -->
            <div class="glass-panel p-5 rounded-[20px]">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center">
                        <i class="fa-solid fa-bell text-rose-600"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-slate-800">Web Push 通知</div>
                        <div class="text-[11px] text-slate-500 mt-0.5">{{ statusDescription }}</div>
                    </div>
                    <div :class="['w-3 h-3 rounded-full', statusDotColor]"></div>
                </div>

                <!-- 详细状态 -->
                <div class="text-[12px] space-y-1.5 text-slate-600 border-t border-slate-200 pt-3">
                    <div class="flex justify-between">
                        <span>浏览器支持</span>
                        <span :class="state.supported ? 'text-emerald-600' : 'text-rose-500'">
                            {{ state.supported ? '✓ 支持' : '✗ 不支持' }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>通知权限</span>
                        <span :class="permissionColor">
                            {{ permissionLabel }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>推送服务器</span>
                        <span :class="state.serverReachable ? 'text-emerald-600' : 'text-amber-600'">
                            {{ state.serverReachable ? '✓ 已连接' : '未配置' }}
                        </span>
                    </div>
                    <div class="flex justify-between">
                        <span>订阅状态</span>
                        <span :class="state.subscribed ? 'text-emerald-600' : 'text-slate-500'">
                            {{ state.subscribed ? '✓ 已订阅' : '未订阅' }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- 错误提示 -->
            <div v-if="state.lastError" class="glass-panel p-3 rounded-[16px] bg-rose-50 border border-rose-200">
                <div class="text-[12px] text-rose-700">
                    <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                    {{ state.lastError }}
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="glass-panel p-4 rounded-[20px] space-y-2">
                <button
                    v-if="!state.subscribed"
                    @click="handleSubscribe"
                    :disabled="loading || !state.supported"
                    class="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i class="fa-solid fa-bell mr-2"></i>
                    {{ loading ? '处理中...' : '开启后台通知' }}
                </button>

                <button
                    v-else
                    @click="handleUnsubscribe"
                    :disabled="loading"
                    class="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm disabled:opacity-50"
                >
                    <i class="fa-solid fa-bell-slash mr-2"></i>
                    {{ loading ? '处理中...' : '关闭后台通知' }}
                </button>

                <button
                    v-if="state.subscribed"
                    @click="handleTest"
                    :disabled="loading"
                    class="w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-medium text-sm disabled:opacity-50"
                >
                    <i class="fa-solid fa-paper-plane mr-2"></i>
                    发送测试推送
                </button>
            </div>

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
                <p>1. 浏览器向推送服务（FCM / Mozilla autopush）注册订阅</p>
                <p>2. 订阅信息保存到 Cloudflare Worker</p>
                <p>3. Worker 定时器每分钟扫描排程，到点时向所有订阅推送</p>
                <p>4. 浏览器 Service Worker 收到推送，弹出系统通知</p>
                <p class="text-rose-500 mt-2">
                    注意：iOS 需 iOS 16.4+ 才支持。Mac/Windows/Linux Chrome/Edge/Firefox 完美支持。
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chatStore'
import pushService from '@/utils/pushService'
import { backgroundManager } from '@/utils/backgroundManager'

const router = useRouter()
const chatStore = useChatStore()

const state = ref(pushService.getState())
const loading = ref(false)
let unsubState = null

const statusDescription = computed(() => {
    if (!state.value.supported) return '当前浏览器不支持 Web Push'
    if (!state.value.serverReachable) return '推送服务器未配置 (VITE_PUSH_SERVER_URL)'
    if (!state.value.subscribed) return '点击下方按钮开启通知'
    return '已开启 — 即使 App 在后台也能收到消息'
})

const statusDotColor = computed(() => {
    if (state.value.subscribed) return 'bg-emerald-500'
    if (state.value.serverReachable) return 'bg-amber-400'
    return 'bg-slate-300'
})

const permissionLabel = computed(() => {
    const p = state.value.permission
    if (p === 'granted') return '已授权'
    if (p === 'denied') return '已拒绝'
    return '未请求'
})

const permissionColor = computed(() => {
    const p = state.value.permission
    if (p === 'granted') return 'text-emerald-600'
    if (p === 'denied') return 'text-rose-500'
    return 'text-slate-500'
})

function goBack() {
    router.push('/settings')
}

async function handleSubscribe() {
    if (loading.value) return
    loading.value = true
    try {
        const res = await pushService.subscribe({
            userId: 'default',
            deviceName: navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'unknown',
        })
        if (res.ok) {
            chatStore.triggerToast('已开启后台通知', 'success')
        } else {
            const reasonMap = {
                not_supported: '当前浏览器不支持',
                server_unreachable: '无法连接推送服务器',
                permission_denied: '通知权限被拒绝，请去浏览器设置开启',
                subscribe_failed: '订阅失败：' + (res.error || ''),
                server_save_failed: '保存订阅失败：' + (res.error || ''),
                no_public_key: '服务器未配置 VAPID 公钥',
            }
            chatStore.triggerToast(reasonMap[res.reason] || '开启失败', 'error')
        }
    } finally {
        loading.value = false
    }
}

async function handleUnsubscribe() {
    if (loading.value) return
    loading.value = true
    try {
        const res = await pushService.unsubscribe()
        if (res.ok) chatStore.triggerToast('已关闭后台通知', 'success')
    } finally {
        loading.value = false
    }
}

async function handleTest() {
    if (loading.value) return
    loading.value = true
    try {
        const res = await pushService.test({
            title: 'Chilly Phone 测试 ✨',
            body: '如果你看到这条通知，说明后台推送正常工作 💕',
        })
        if (res.ok) {
            chatStore.triggerToast('测试推送已发送，请检查系统通知', 'success')
        } else {
            chatStore.triggerToast('发送失败：' + (res.error || res.reason || ''), 'error')
        }
    } finally {
        loading.value = false
    }
}

onMounted(async () => {
    await pushService.init()
    unsubState = pushService.onStateChange((s) => {
        state.value = { ...s }
    })

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
    if (unsubState) unsubState()
    if (keepAlivePollTimer) {
        clearInterval(keepAlivePollTimer)
        keepAlivePollTimer = null
    }
})

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

async function handleEnableKeepAlive() {
    if (keepAliveLoading.value) return
    keepAliveError.value = ''
    keepAliveLoading.value = true

    // 先确保基础保活启动
    backgroundManager.enable()

    const result = await backgroundManager.enableRealKeepAlive({
        title: 'qiaoqiao-phone',
        artist: '随时在线',
        album: 'qiaoqiao',
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
</script>
