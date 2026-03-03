<script setup>
import { computed } from 'vue'
import { useChatStore } from '../../../stores/chatStore'

const chatStore = useChatStore()
const props = defineProps({
    visible: Boolean
})

const emit = defineEmits(['close'])

const requests = computed(() => chatStore.pendingRequests || [])

function handleAccept(req) {
    chatStore.acceptPendingRequest(req.id)
    if (requests.value.length === 0) emit('close')
}

function handleReject(req) {
    chatStore.rejectPendingRequest(req.id)
    if (requests.value.length === 0) emit('close')
}

function formatDate(ts) {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
    <div v-if="visible"
        class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        @click.self="emit('close')">
        <div
            class="bg-gray-50 w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[80vh]">
            <div class="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-100 shrink-0">
                <h3 class="font-bold text-gray-900 text-lg">消息通知</h3>
                <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 p-2">
                    <i class="fa-solid fa-times text-xl"></i>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                <div v-if="requests.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-400">
                    <i class="fa-solid fa-bell-slash text-4xl mb-3 opacity-20"></i>
                    <span class="text-sm">暂无新通知</span>
                </div>

                <div v-for="req in requests" :key="req.id"
                    class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <img :src="req.fromAvatar || '/avatars/default.jpg'"
                                class="w-12 h-12 rounded-xl object-cover shrink-0" />
                            <div class="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm">
                                <i v-if="req.type === 'group_invite'"
                                    class="fa-solid fa-users text-[10px] text-green-500"></i>
                                <i v-else class="fa-solid fa-user-plus text-[10px] text-blue-500"></i>
                            </div>
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <span class="font-bold text-gray-900 text-sm truncate">{{ req.fromName }}</span>
                                <span class="text-[10px] text-gray-400 font-mono">{{ formatDate(req.timestamp) }}</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-0.5">
                                <template v-if="req.type === 'group_invite'">
                                    邀请你加入群聊 <span class="text-green-600 font-medium">"{{ req.targetName }}"</span>
                                </template>
                                <template v-else>
                                    申请加你为好友
                                </template>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button @click="handleReject(req)"
                            class="flex-1 py-2 text-xs font-bold text-gray-500 bg-gray-50 rounded-lg active:bg-gray-100 transition-colors">
                            拒绝
                        </button>
                        <button @click="handleAccept(req)"
                            class="flex-1 py-2 text-xs font-bold text-white bg-green-500 rounded-lg active:bg-green-600 transition-colors shadow-sm shadow-green-100">
                            通过
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-white/50 p-2 text-center text-[10px] text-gray-400 shrink-0">
                最多保留近期通知
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease;
}

.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
        transform: scale(0.95);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}
</style>
