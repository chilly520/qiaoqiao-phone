<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import versionInfo from '../../version.json'

const router = useRouter()

const goBack = () => {
    router.push('/')
}

const openSettingsPage = (page) => {
    router.push(`/settings/${page}`)
}

// ========== 更新检查 (native APP 才支持) ==========
// native 端 (MainActivity) 启动后调 GitHub Releases API, 有新版就发 'chilly-update-available' event
const hasUpdate = ref(false)
const updateInfo = ref({ version: '', url: '' })

const onUpdateAvailable = (e) => {
    hasUpdate.value = true
    updateInfo.value = e.detail || { version: '', url: '' }
    console.log('[chilly] update available:', updateInfo.value)
}

const onUpdateClicked = () => {
    if (window.ChillyNative && updateInfo.value.url) {
        // native APP: 跳浏览器到 GitHub release 页 (用户点下载)
        window.ChillyNative.openExternalUrl(updateInfo.value.url)
    } else {
        // 纯网页: 跳到 https://github.com/chilly520/qiaoqiao-phone/releases
        window.open('https://github.com/chilly520/qiaoqiao-phone/releases', '_blank')
    }
}

onMounted(() => {
    window.addEventListener('chilly-update-available', onUpdateAvailable)
})
onUnmounted(() => {
    window.removeEventListener('chilly-update-available', onUpdateAvailable)
})
// ==================================================

// 设置分类 - 完全按照原版，标题黑色，副标题灰色
const settingsCards = [
    {
        title: 'API 连接',
        subtitle: 'OpenAI, 模型管理',
        icon: 'fa-solid fa-robot',
        gradient: 'from-blue-100 to-blue-200',
        iconColor: 'text-blue-600',
        subtitleColor: 'text-gray-500',
        page: 'api'
    },
    {
        title: '个性化',
        subtitle: '壁纸, 图标, 桌面组件',
        icon: 'fa-solid fa-wand-magic-sparkles',
        gradient: 'from-pink-100 to-pink-200',
        iconColor: 'text-pink-600',
        subtitleColor: 'text-gray-500',
        page: 'personalization'
    },
    {
        title: '语音服务',
        subtitle: 'TTS, MiniMax',
        icon: 'fa-solid fa-microphone',
        gradient: 'from-green-100 to-green-200',
        iconColor: 'text-green-600',
        subtitleColor: 'text-gray-500',
        page: 'voice'
    },
    {
        title: '天气与地点',
        subtitle: '位置映射, 虚拟城市',
        icon: 'fa-solid fa-cloud-sun',
        gradient: 'from-yellow-100 to-yellow-200',
        iconColor: 'text-yellow-600',
        subtitleColor: 'text-gray-500',
        page: 'weather'
    },
    {
        title: '存储空间',
        subtitle: '缓存清理, 空间释放',
        icon: 'fa-solid fa-database',
        gradient: 'from-orange-100 to-orange-200',
        iconColor: 'text-orange-600',
        subtitleColor: 'text-gray-500',
        page: 'storage'
    },
    {
        title: '生图配置',
        subtitle: 'Pollinations, Flux API',
        icon: 'fa-solid fa-image',
        gradient: 'from-cyan-100 to-cyan-200',
        iconColor: 'text-cyan-600',
        subtitleColor: 'text-gray-500',
        page: 'drawing'
    },
    {
        title: '数据备份',
        subtitle: 'GitHub 云端, 本地导出, 重置',
        icon: 'fa-solid fa-cloud-arrow-up',
        gradient: 'from-indigo-100 to-indigo-200',
        iconColor: 'text-indigo-600',
        subtitleColor: 'text-gray-500',
        page: 'backup'
    },
    {
        title: '前台保活',
        subtitle: '媒体卡片保活, 切后台不被杀',
        icon: 'fa-solid fa-music',
        gradient: 'from-indigo-100 to-violet-200',
        iconColor: 'text-indigo-600',
        subtitleColor: 'text-gray-500',
        page: 'push'
    },
    {
        title: 'MCP 服务',
        subtitle: 'AI 工具调用, 外部服务接入',
        icon: 'fa-solid fa-plug',
        gradient: 'from-purple-100 to-purple-200',
        iconColor: 'text-purple-600',
        subtitleColor: 'text-gray-500',
        page: 'mcp'
    }
]
</script>

<template>
  <div class="settings-app w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">设置中心</span>
       </div>
    </div>

    <!-- Settings Cards -->
    <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-4">
            <!-- 检查更新卡片 (红点提示) -->
            <div
                @click="onUpdateClicked"
                class="glass-panel p-5 rounded-[20px] flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer relative"
            >
                <!-- 红点 -->
                <span
                    v-if="hasUpdate"
                    class="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"
                ></span>
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-orange-200 flex items-center justify-center shadow-lg text-xl text-red-600">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </div>
                    <div>
                        <div class="font-bold text-lg text-gray-900">
                            {{ hasUpdate ? `发现新版本 v${updateInfo.version}` : '检查更新' }}
                        </div>
                        <div class="text-xs mt-1 text-gray-500">
                            {{ hasUpdate ? '点击跳到 GitHub 下载新版 APK' : `当前 v${versionInfo.version}, APP 启动时自动检查` }}
                        </div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
            </div>

            <!-- Individual Card - 完全按照原版HTML结构 -->
            <div
                v-for="card in settingsCards"
                :key="card.page"
                @click="openSettingsPage(card.page)"
                class="glass-panel p-5 rounded-[20px] flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
            >
                <!-- Left Side: Icon and Text -->
                <div class="flex items-center gap-5">
                    <!-- Icon Wrapper -->
                    <div 
                        class="w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg text-xl"
                        :class="[card.gradient, card.iconColor]"
                    >
                        <i :class="card.icon"></i>
                    </div>
                    <!-- Text Content -->
                    <div>
                        <div class="font-bold text-lg text-gray-900">{{ card.title }}</div>
                        <div class="text-xs mt-1" :class="card.subtitleColor">{{ card.subtitle }}</div>
                    </div>
                </div>
                <!-- Right Side: Chevron Arrow -->
                <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
            </div>
        </div>

        <!-- Version Info at the bottom of settings list -->
        <div class="py-10 flex flex-col items-center justify-center gap-1.5 opacity-30 select-none">
            <div class="text-[11px] font-bold tracking-[0.2em] text-gray-500">CHILLY OS</div>
            <div class="text-[9px] font-mono text-gray-400">
                v{{ versionInfo.version }} · {{ versionInfo.buildTime.split(' ')[0] }}
            </div>
        </div>
    </div>

  </div>
</template>

<style scoped>
/* 平滑滚动 */
.overflow-y-auto {
    -webkit-overflow-scrolling: touch;
}
</style>
