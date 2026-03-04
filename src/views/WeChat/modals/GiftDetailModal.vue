<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/60 z-[200] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
        @click.self="close">

        <div
            class="bg-white w-[320px] rounded-[32px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-scale-up border border-white/20">
            <!-- Header section -->
            <div class="h-44 relative flex flex-col items-center justify-center p-6 text-center"
                :class="isClaimed ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-rose-400 to-pink-600'">
                <!-- Background Decorations -->
                <div class="absolute -right-4 -top-8 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                <div class="absolute -left-8 bottom-0 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>

                <div class="relative z-10">
                    <div
                        class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner mb-4 mx-auto border border-white/30">
                        <img :src="giftData.giftImage || 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png'"
                            class="w-10 h-10 object-contain drop-shadow-lg">
                    </div>

                    <h3 class="text-white text-xl font-black tracking-tight drop-shadow-sm">{{ giftData.giftName }}</h3>
                    <div class="flex items-center justify-center gap-2 mt-2">
                        <span
                            class="px-2 py-0.5 bg-black/10 rounded-full text-[10px] text-white/90 font-bold uppercase tracking-widest border border-white/10">
                            {{ isClaimed ? '已领取' : '待领取' }}
                        </span>
                        <span class="text-white/70 text-[10px] font-mono">ID: {{ giftData.giftId?.slice(-6) || '---'
                            }}</span>
                    </div>
                </div>
            </div>

            <!-- Content section -->
            <div class="p-6 bg-gradient-to-b from-white to-gray-50">
                <div class="space-y-5">
                    <!-- Note area -->
                    <div class="relative">
                        <i class="fa-solid fa-quote-left absolute -top-2 -left-2 text-gray-100 text-3xl z-0"></i>
                        <div
                            class="relative z-10 bg-gray-50/50 rounded-2xl p-4 border border-gray-100 italic text-[13px] text-gray-600 leading-relaxed text-center font-songti">
                            "{{ giftData.giftNote || '对方没有留下特别的留言...' }}"
                        </div>
                    </div>

                    <!-- Details list -->
                    <div class="space-y-3 pt-2">
                        <div
                            class="flex items-center justify-between text-[11px] font-bold uppercase tracking-tighter text-gray-400 border-b border-gray-50 pb-2">
                            <span>详细信息 / DETAILS</span>
                        </div>

                        <!-- Quantity -->
                        <div class="flex justify-between items-center py-1">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-layer-group text-gray-300 w-4"></i>
                                <span class="text-xs text-gray-500">数量</span>
                            </div>
                            <span class="text-sm font-black text-gray-800">{{ giftData.giftQuantity || 1 }}</span>
                        </div>

                        <!-- Sender -->
                        <div class="flex justify-between items-center py-1">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-paper-plane text-gray-300 w-4"></i>
                                <span class="text-xs text-gray-500">来自</span>
                            </div>
                            <span class="text-sm font-bold text-gray-800">{{ giftData.senderName || '好友' }}</span>
                        </div>

                        <!-- Claimant (only if claimed) -->
                        <div v-if="isClaimed" class="flex justify-between items-center py-1">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-user-check text-green-300 w-4"></i>
                                <span class="text-xs text-gray-500">领取人</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <img v-if="claimantAvatar" :src="claimantAvatar"
                                    class="w-4 h-4 rounded-full object-cover">
                                <span class="text-sm font-bold text-green-600">{{ claimantName }}</span>
                            </div>
                        </div>

                        <!-- Time -->
                        <div v-if="timeLabel" class="flex justify-between items-center py-1">
                            <div class="flex items-center gap-2">
                                <i class="fa-regular fa-clock text-gray-300 w-4"></i>
                                <span class="text-xs text-gray-500">{{ isClaimed ? '领取时间' : '发送时间' }}</span>
                            </div>
                            <span class="text-[11px] font-medium text-gray-400 font-mono">{{ timeLabel }}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="mt-8 flex flex-col gap-3">
                    <template v-if="canClaim">
                        <button @click="handleClaim"
                            class="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-200 hover:shadow-xl transition-all active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                            <i class="fa-solid fa-gift"></i>
                            确认领取礼物
                        </button>
                        <button @click="close"
                            class="w-full py-3 text-gray-400 font-bold hover:text-gray-600 transition-colors text-xs text-center">
                            稍后再领
                        </button>
                    </template>
                    <button v-else @click="close"
                        class="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 text-sm uppercase tracking-widest">
                        我知道了
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const visible = ref(false)
const giftData = ref({})
const onConfirm = ref(null)

const isClaimed = computed(() => giftData.value.status === 'claimed' || giftData.value.type === 'gift_claimed')

const claimantName = computed(() => giftData.value.claimantName || giftData.value.claimedBy?.name || '---')
const claimantAvatar = computed(() => giftData.value.claimantAvatar || giftData.value.claimedBy?.avatar || '')

const timeLabel = computed(() => {
    const ts = isClaimed.value ? (giftData.value.claimTime || Date.now()) : giftData.value.timestamp
    if (!ts) return ''
    return new Date(ts).toLocaleString('zh-CN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
})

const canClaim = computed(() => {
    // Determine if the "Confirm Claim" button should be shown
    // It should be shown if the status is not claimed AND it's coming from someone else
    return !isClaimed.value && (giftData.value.role !== 'user' && !giftData.value._isSender)
})

const open = (data, confirmCallback = null) => {
    giftData.value = { ...data }
    onConfirm.value = confirmCallback
    visible.value = true
}

const close = () => {
    visible.value = false
}

const handleClaim = () => {
    if (onConfirm.value) onConfirm.value()
    close()
}

defineExpose({ open, close })
</script>

<style scoped>
.font-songti {
    font-family: "Songti SC", "STSong", "SimSun", serif;
}

.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes scaleUp {
    from {
        transform: scale(0.95);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
