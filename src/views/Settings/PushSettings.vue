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
})

onUnmounted(() => {
    if (unsubState) unsubState()
})
</script>
