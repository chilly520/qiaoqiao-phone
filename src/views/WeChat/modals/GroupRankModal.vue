<script setup>
import { computed, ref } from 'vue'
import { useChatStore } from '../../../stores/chatStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({
    visible: Boolean,
    chatId: String
})

const emit = defineEmits(['close'])

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const chatData = computed(() => chatStore.chats[props.chatId])

const memberStats = computed(() => {
    if (!chatData.value || !chatData.value.isGroup) return []

    const results = []

    // ME
    const myTotal = chatData.value.groupSettings?.myActivity || 0
    results.push({
        id: 'user',
        name: chatData.value.groupSettings?.myNickname || chatStore.userName || '我',
        avatar: chatData.value.groupSettings?.myAvatar || settingsStore.personalization?.userProfile?.avatar || '/avatars/user.png',
        total: myTotal,
        daily: chatData.value.groupSettings?.myDailyActivity || 0,
        level: chatStore.calculateMemberLevel(myTotal),
        title: chatStore.getMemberTitle(props.chatId, 'user').split(' ').slice(1).join(' ')
    })

    // Others
    if (chatData.value.participants) {
        chatData.value.participants.forEach(p => {
            const pTotal = p.activity || 0
            results.push({
                id: p.id,
                name: p.nickname || p.name || '未知',
                avatar: p.avatar,
                total: pTotal,
                daily: p.dailyActivity || 0,
                level: chatStore.calculateMemberLevel(pTotal),
                title: chatStore.getMemberTitle(props.chatId, p.id).split(' ').slice(1).join(' ')
            })
        })
    }

    return results
})

const activeTab = ref('daily') // 'daily' or 'total'

const sortedStats = computed(() => {
    const list = [...memberStats.value]
    if (activeTab.value === 'daily') {
        return list.sort((a, b) => b.daily - a.daily || b.total - a.total)
    }
    return list.sort((a, b) => b.total - a.total || b.daily - a.daily)
})

const todayStr = computed(() => new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }))

// header subtitle depending on tab
const headerSubtitle = computed(() => {
    return activeTab.value === 'daily' ? todayStr.value : '累计发言'
})

</script>

<template>
    <div v-if="visible" class="fixed inset-0 z-[10002] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>

        <!-- Content -->
        <div
            class="relative bg-white w-full max-w-[380px] rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
            <!-- Header -->
            <div
                class="p-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white shrink-0 relative overflow-hidden">
                <div class="relative z-10">
                    <div class="flex justify-between items-start">
                        <div>
                            <h2 class="text-2xl font-black italic tracking-tighter">RANKING</h2>
                            <p class="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1">成员活跃值榜单 · {{ headerSubtitle }}</p>
                        </div>
                        <button @click="emit('close')"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>

                    <!-- Tabs -->
                    <div class="flex gap-2 mt-6">
                        <button @click="activeTab = 'daily'"
                            class="flex-1 py-2 rounded-xl text-xs font-black transition-all"
                            :class="activeTab === 'daily' ? 'bg-white text-orange-600 shadow-lg' : 'bg-black/10 text-white/70 hover:bg-black/20'">
                            今日活跃
                        </button>
                        <button @click="activeTab = 'total'"
                            class="flex-1 py-2 rounded-xl text-xs font-black transition-all"
                            :class="activeTab === 'total' ? 'bg-white text-orange-600 shadow-lg' : 'bg-black/10 text-white/70 hover:bg-black/20'">
                            累计发言
                        </button>
                    </div>
                </div>

                <!-- Decoration -->
                <i class="fa-solid fa-trophy absolute -bottom-4 -right-4 text-7xl opacity-20 rotate-12"></i>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                <div v-for="(item, idx) in sortedStats" :key="item.id"
                    class="bg-white p-3 rounded-2xl flex items-center gap-3 border border-gray-100/50 shadow-sm transition-all hover:shadow-md group">

                    <!-- Rank Number -->
                    <div class="w-8 flex flex-col items-center justify-center">
                        <template v-if="idx < 3">
                            <i class="fa-solid fa-crown text-lg"
                                :class="idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : 'text-orange-300'"></i>
                        </template>
                        <span v-else class="text-xs font-black text-gray-300">{{ idx + 1 }}</span>
                    </div>

                    <!-- Avatar -->
                    <div class="relative shrink-0">
                        <img :src="item.avatar"
                            class="w-12 h-12 rounded-xl object-cover border-2 border-gray-50 shadow-sm group-hover:scale-105 transition-transform" />
                        <div
                            class="absolute -bottom-1 -right-1 bg-white px-1.5 py-0.5 rounded-lg shadow-sm border border-gray-50 flex items-center gap-0.5">
                            <span class="text-[8px] font-black italic scale-90 text-orange-500">LV{{ item.level
                                }}</span>
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-0.5">
                            <span class="font-bold text-sm text-gray-800 truncate">{{ item.name }}</span>
                            <span v-if="item.title"
                                class="text-[9px] px-1 bg-gray-100 text-gray-500 rounded font-medium whitespace-nowrap">{{
                                item.title
                                }}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <template v-if="activeTab === 'daily'">
                                <div class="flex items-center gap-1">
                                    <i class="fa-solid fa-bolt text-[10px] text-orange-400"></i>
                                    <span class="text-[11px] text-gray-400 font-bold">今日: <span class="text-orange-500">{{ item.daily }}</span></span>
                                </div>
                            </template>
                            <template v-else>
                                <div class="flex items-center gap-1">
                                    <i class="fa-solid fa-message text-[10px] text-blue-400"></i>
                                    <span class="text-[11px] text-gray-400 font-bold">总计: <span class="text-blue-500">{{ item.total }}</span></span>
                                </div>
                            </template>
                        </div>
                    </div>

                    <!-- Badge / Trend -->
                    <div v-if="idx === 0" class="shrink-0">
                        <div class="bg-yellow-50 text-yellow-600 text-[10px] font-black px-2 py-1 rounded-lg">TOP</div>
                    </div>
                </div>

                <div v-if="sortedStats.length === 0" class="py-12 text-center space-y-2">
                    <i class="fa-solid fa-ghost text-4xl text-gray-200"></i>
                    <p class="text-sm text-gray-400">暂无排行数据</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 bg-white border-t border-gray-50 text-center shrink-0">
                <p class="text-[10px] text-gray-400 font-bold">每日 00:00 自动重置今日活跃值</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes scaleIn {
    from {
        opacity: 0;
        transform: scale(0.9);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
