<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/70 z-[160] flex flex-col items-center justify-center p-4 animate-fade-in"
        @click.self="$emit('close')">
        <!-- Premium Card -->
        <div class="bg-white w-[300px] rounded-[16px] overflow-hidden shadow-2xl relative animate-scale-up">
            <div class="p-8 flex flex-col items-center text-center">

                <!-- State: Rejected -->
                <div v-if="packet?.isRejected" class="w-full">
                    <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-ban text-red-500 text-3xl"></i>
                    </div>
                    <div class="text-lg font-bold text-gray-900 mb-1">已拒收</div>
                    <div class="text-4xl font-black text-gray-900 mb-6 font-mono tracking-tight">¥{{ packet?.amount ||
                        '0.00' }}</div>
                    <div class="text-gray-400 text-xs leading-relaxed">{{ packet?.role === 'user' ? '资金已退回您的零钱' :
                        '资金已退回对方账户' }}</div>
                </div>

                <!-- State: Claimed -->
                <div v-else-if="packet?.isClaimed" class="w-full">
                    <div
                        class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-once">
                        <i class="fa-solid fa-circle-check text-[#07c160] text-3xl"></i>
                    </div>
                    <div class="text-lg font-bold text-gray-900 mb-1">已收款</div>
                    <div class="text-4xl font-black text-gray-900 mb-6 font-mono tracking-tight">¥{{ packet?.amount ||
                        '0.00' }}</div>
                    <div class="text-gray-400 text-xs">{{ packet?.role === 'user' ? '对方已收款' : '已存入零钱' }}</div>
                </div>

                <!-- State: Waiting (Sent by User) -->
                <div v-else-if="packet?.role === 'user'" class="w-full">
                    <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-hourglass-half text-[#f79c1f] text-3xl animate-pulse"></i>
                    </div>
                    <div class="text-lg font-bold text-gray-900 mb-1">等待对方收款</div>
                    <div class="text-4xl font-black text-gray-900 mb-6 font-mono tracking-tight">¥{{ packet?.amount ||
                        '0.00' }}</div>
                    <div class="text-gray-400 text-xs mb-6 px-4">对方确认后资金将存入其零钱。1天内未确认将自动退还。</div>
                </div>

                <!-- State: Group transfer NOT targeted to user (view details only) -->
                <div v-else-if="isGroupTransferNotForMe" class="w-full">
                    <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-arrow-right-arrow-left text-gray-400 text-3xl"></i>
                    </div>
                    <div class="text-lg font-bold text-gray-900 mb-1">转账详情</div>

                    <!-- Sender Info -->
                    <div
                        class="flex items-center justify-center gap-1.5 mb-6 bg-gray-50 py-2 px-4 rounded-full w-fit mx-auto border border-gray-100">
                        <span class="text-gray-400 text-[10px] font-medium">来自</span>
                        <img :src="senderAvatar" class="w-4 h-4 rounded-full object-cover shadow-sm">
                        <span class="text-gray-600 font-bold text-[11px]">{{ senderName }}</span>
                    </div>

                    <div class="text-4xl font-black text-gray-900 mb-4 font-mono tracking-tighter">¥{{ packet?.amount ||
                        '0.00' }}</div>
                    <div class="text-gray-400 text-xs">{{ packet?.note || '转账给您' }}</div>
                    <div class="text-gray-300 text-[10px] mt-2">此转账非发送给你</div>
                </div>

                <!-- State: Waiting (Sent to User — show accept/reject) -->
                <div v-else class="w-full">
                    <div class="w-16 h-16 bg-[#07c160]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fa-solid fa-wallet text-[#07c160] text-3xl"></i>
                    </div>

                    <div class="text-lg font-bold text-gray-900 mb-2">收到转账</div>

                    <!-- Sender Info -->
                    <div
                        class="flex items-center justify-center gap-1.5 mb-6 bg-gray-50 py-2 px-4 rounded-full w-fit mx-auto border border-gray-100">
                        <span class="text-gray-400 text-[10px] font-medium">来自</span>
                        <img :src="senderAvatar" class="w-4 h-4 rounded-full object-cover shadow-sm">
                        <span class="text-gray-600 font-bold text-[11px]">{{ senderName }}</span>
                    </div>

                    <div class="text-4xl font-black text-gray-900 mb-8 font-mono tracking-tighter">¥{{ packet?.amount ||
                        '0.00' }}</div>

                    <div class="flex flex-col gap-3 w-full">
                        <button
                            class="w-full bg-[#07c160] hover:bg-[#06ad56] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-[0.97]"
                            @click="$emit('confirm')">确认收款</button>
                        <button
                            class="w-full text-[#576b95] text-xs font-bold py-2 hover:bg-gray-50 rounded-lg transition-colors"
                            @click="$emit('reject')">立即退还</button>
                    </div>
                </div>
            </div>

            <!-- Bottom Accent -->
            <div class="h-1.5 w-full bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
        </div>

        <!-- Bottom Close Button -->
        <button
            class="mt-10 w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:bg-white/10 hover:border-white/50 hover:text-white active:scale-90 transition-all backdrop-blur-md"
            @click="$emit('close')">
            <i class="fa-solid fa-xmark text-xl"></i>
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    visible: Boolean,
    packet: Object,
    chatData: Object
})

// In group chats, use sender info from the message itself
const senderName = computed(() => {
    return props.packet?.senderName || props.chatData?.name || '对方'
})

const senderAvatar = computed(() => {
    return props.packet?.senderAvatar || props.chatData?.avatar || ''
})

// Check if this is a group transfer not targeted at the user
const isGroupTransferNotForMe = computed(() => {
    if (!props.chatData?.isGroup) return false
    const targetId = props.packet?.targetId
    if (!targetId) return false // No targetId means it's for the user (default)
    // If targetId is 'user' or matches known user IDs, it's for the user
    return targetId !== 'user' && targetId !== 'me'
})
</script>


<style scoped>
.animate-fade-in {
    animation: fadeIn 0.2s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.animate-bounce-once {
    animation: bounceOnce 0.5s ease-out 1;
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
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes bounceOnce {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-10px);
    }
}
</style>
