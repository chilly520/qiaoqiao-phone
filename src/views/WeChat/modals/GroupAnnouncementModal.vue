<template>
    <div v-if="visible"
        class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="close">
        <div class="bg-white w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-scale-in"
            @click.stop>
            <!-- Header -->
            <div
                class="h-16 px-6 bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-between shrink-0">
                <h3 class="font-bold text-white text-lg">群公告</h3>
                <button @click="close"
                    class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <i class="fa-solid fa-xmark text-white"></i>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- New Announcement Form (Visible for Admin/Owner) -->
                <div v-if="canManage" class="bg-amber-50 rounded-2xl p-4 border border-amber-100 shadow-sm">
                    <div class="text-xs font-bold text-amber-700 mb-2 flex items-center gap-2">
                        <i class="fa-solid fa-plus-circle"></i> 发布新公告
                    </div>
                    <textarea v-model="newContent" placeholder="在此输入新公告内容..."
                        class="w-full bg-white/80 border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none resize-none h-24 focus:ring-2 focus:ring-amber-400 transition-all"></textarea>
                    <div class="flex items-center justify-between mt-3">
                        <label class="flex items-center gap-2 text-[10px] text-amber-600 cursor-pointer">
                            <input type="checkbox" v-model="isPinned" class="accent-amber-500" />
                            <span>置顶此公告</span>
                        </label>
                        <button @click="publishAnnouncement" :disabled="!newContent.trim()"
                            class="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-4 py-1.5 rounded-lg shadow-sm disabled:opacity-50 transition-all">
                            立即发布
                        </button>
                    </div>
                </div>

                <!-- Current Pinned Announcement -->
                <div v-if="pinnedAnnouncement" class="space-y-2">
                    <div class="text-xs font-bold text-gray-500 flex items-center gap-2 ml-1">
                        <i class="fa-solid fa-thumbtack text-amber-500"></i> 当前置顶
                    </div>
                    <div class="bg-white border-2 border-amber-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-amber-50/50 rounded-full blur-2xl -mr-8 -mt-8">
                        </div>
                        <div class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{{
                            pinnedAnnouncement.content }}</div>
                        <div class="mt-3 flex items-center justify-between text-[10px] text-gray-400">
                            <span>发布人: {{ pinnedAnnouncement.sender }}</span>
                            <span>{{ formatDate(pinnedAnnouncement.timestamp) }}</span>
                        </div>
                    </div>
                </div>

                <!-- History -->
                <div class="space-y-3">
                    <div class="text-xs font-bold text-gray-500 ml-1">公告历史 ({{ history.length }})</div>
                    <div v-if="history.length === 0" class="text-center py-6 text-xs text-gray-400 italic">
                        暂无历史公告
                    </div>
                    <div v-for="(item, idx) in history" :key="item.id"
                        class="bg-gray-50 rounded-2xl p-4 border border-gray-100 group relative">
                        <div class="text-sm text-gray-700 leading-normal whitespace-pre-wrap">{{ item.content }}</div>
                        <div class="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                            <span>{{ item.sender }} · {{ formatDate(item.timestamp) }}</span>
                            <div v-if="canManage" class="flex gap-2">
                                <button @click="pinItem(item)" class="text-amber-500 hover:text-amber-600">
                                    {{ item.isPinned ? '取消置顶' : '置顶' }}
                                </button>
                                <button @click="deleteItem(item)" class="text-gray-400 hover:text-red-500">删除</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useChatStore } from '../../../stores/chatStore'

const chatStore = useChatStore()
const props = defineProps(['chatData', 'visible'])
const emit = defineEmits(['close'])

const newContent = ref('')
const isPinned = ref(true)

const chatId = computed(() => props.chatData?.id)
const chat = computed(() => chatStore.chats[chatId.value])

const close = () => {
    emit('close')
}

const history = computed(() => {
    if (!chat.value?.groupProfile?.announcements) return []
    return [...chat.value.groupProfile.announcements].sort((a, b) => b.timestamp - a.timestamp)
})

const pinnedAnnouncement = computed(() => {
    return history.value.find(a => a.isPinned) || history.value[0] || null
})

const canManage = computed(() => {
    if (!chat.value) return false
    const myRole = chat.value.groupSettings?.myRole || 'member'
    return myRole === 'owner' || myRole === 'admin'
})

const publishAnnouncement = () => {
    if (!newContent.value.trim()) return

    const item = {
        id: 'ann-' + Date.now(),
        content: newContent.value.trim(),
        sender: chat.value.groupSettings?.myNickname || chatStore.userName || '我',
        timestamp: Date.now(),
        isPinned: isPinned.value
    }

    // Update store
    const announcements = [...(chat.value.groupProfile.announcements || [])]
    if (isPinned.value) {
        announcements.forEach(a => a.isPinned = false)
    }
    announcements.push(item)

    chatStore.updateGroupProfile(chatId.value, {
        announcement: isPinned.value ? item.content : (pinnedAnnouncement.value?.content || item.content),
        announcements: announcements
    })

    // Add a system message to the chat
    chatStore.addMessage(chatId.value, {
        role: 'system',
        content: `📢 ${item.sender} 发布了新公告：${item.content.substring(0, 30)}${item.content.length > 30 ? '...' : ''}`
    })

    newContent.value = ''
    chatStore.triggerToast('公告发布成功', 'success')
}

const pinItem = (item) => {
    const announcements = [...chat.value.groupProfile.announcements]
    const target = announcements.find(a => a.id === item.id)
    if (!target) return

    const wasPinned = target.isPinned
    announcements.forEach(a => a.isPinned = false)
    target.isPinned = !wasPinned

    chatStore.updateGroupProfile(chatId.value, {
        announcement: target.isPinned ? target.content : (announcements.find(a => a.isPinned)?.content || ''),
        announcements: announcements
    })
}

const deleteItem = (item) => {
    chatStore.triggerConfirm('删除公告', '确定删除此公告吗？', () => {
        const announcements = chat.value.groupProfile.announcements.filter(a => a.id !== item.id)
        chatStore.updateGroupProfile(chatId.value, {
            announcements: announcements,
            announcement: announcements.find(a => a.isPinned)?.content || (announcements[0]?.content || '')
        })
    })
}

const formatDate = (ts) => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>
