<script setup>
import { ref, onMounted } from 'vue'
import { useMomentsStore } from '../../stores/momentsStore'

const emit = defineEmits(['back'])

const momentsStore = useMomentsStore()

const formatTime = (ts) => {
    const now = Date.now()
    const diff = (now - ts) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
    return new Date(ts).toLocaleDateString()
}

onMounted(() => {
    // Mark all as read when entering this page
    momentsStore.markNotificationsRead()
})
</script>

<template>
    <div class="h-full bg-white flex flex-col animate-slide-in-right">
        <!-- Navbar -->
        <div class="h-12 bg-[#ededed] border-b border-[#dcdcdc] flex items-center px-4 shrink-0 relative">
            <button
                class="w-8 h-8 flex items-center justify-center -ml-2 active:bg-gray-200 rounded-full transition-colors"
                @click="emit('back')">
                <i class="fa-solid fa-chevron-left text-black text-lg"></i>
            </button>
            <span class="absolute left-1/2 -translate-x-1/2 font-medium text-base">消息</span>
            <div class="w-8"></div> <!-- Spacer -->
        </div>

        <!-- Notification List -->
        <div class="flex-1 overflow-y-auto">
            <div v-if="momentsStore.notifications.length === 0"
                class="flex flex-col items-center justify-center h-40 text-gray-400">
                <span>暂无新消息</span>
            </div>

            <div v-for="item in momentsStore.notifications" :key="item.id"
                class="flex items-start px-4 py-3 active:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer"
                @click="emit('jump', item.momentId)">
                <!-- Avatar -->
                <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 mr-3 bg-gray-100">
                    <img :src="item.actorAvatar" class="w-full h-full object-cover">
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 flex flex-col justify-center min-h-[40px]">
                    <div class="text-[#576b95] font-bold text-sm mb-0.5">{{ item.actorName }}</div>

                    <div v-if="item.type === 'like'" class="flex items-center text-gray-500 text-sm">
                        <i class="fa-regular fa-heart mr-1"></i>
                    </div>
                    <div v-else class="text-sm text-black leading-snug">
                        {{ item.content }}
                    </div>

                    <div class="text-xs text-gray-300 mt-1">{{ formatTime(item.timestamp) }}</div>
                </div>

                <!-- Moment Thumbnail -->
                <div class="w-14 h-14 bg-gray-100 ml-3 shrink-0 overflow-hidden" v-if="item.momentImage">
                    <img :src="item.momentImage" class="w-full h-full object-cover">
                </div>
                <div class="w-14 h-14 bg-gray-100 ml-3 shrink-0 flex items-center justify-center text-xs text-gray-400"
                    v-else>
                    文章
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-slide-in-right {
    animation: slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}
</style>
