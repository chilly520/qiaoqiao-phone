<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
    router.back()
}

const openSettingsPage = (page) => {
    router.push(`/settings/${page}`)
}

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
    </div>

  </div>
</template>

<style scoped>
/* 平滑滚动 */
.overflow-y-auto {
    -webkit-overflow-scrolling: touch;
}
</style>
