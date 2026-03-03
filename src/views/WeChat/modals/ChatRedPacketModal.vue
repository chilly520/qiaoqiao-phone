<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/85 z-[150] flex flex-col items-center justify-center animate-fade-in"
        @click.self="$emit('close')">
        <!-- The Card -->
        <div class="w-[320px] h-[520px] rounded-[12px] relative overflow-hidden shadow-2xl transition-all duration-500 bg-[#f5f5f5]"
            :class="!showResult ? 'bg-[#D04035]' : 'bg-[#f5f5f5]'">

            <!-- 1. Unopened View -->
            <div v-if="!showResult" class="w-full h-full flex flex-col items-center relative">
                <!-- Top Arc Decoration -->
                <div
                    class="absolute -top-[150px] -left-[10%] w-[120%] h-[350px] bg-[#E35447] rounded-[50%] shadow-lg z-0">
                </div>

                <!-- User Info -->
                <div class="z-10 mt-[80px] flex flex-col items-center">
                    <div class="flex items-center gap-2 mb-4">
                        <img :src="getSenderAvatar()"
                            class="w-12 h-12 rounded-lg border-2 border-[#FFE2B1] shadow-sm object-cover">
                        <span class="text-[#FFE2B1] font-medium text-lg">{{ getSenderName() }}</span>
                    </div>
                    <div class="text-[#FFE2B1] text-xs opacity-80 mb-2">给你发了一个红包</div>
                    <div class="text-[#FFE2B1] text-xl font-bold px-8 text-center leading-relaxed mt-4 drop-shadow-md">
                        {{ packet?.note || "恭喜发财，大吉大利" }}
                    </div>
                </div>

                <!-- Open Button -->
                <div class="z-10 mt-auto mb-[80px] flex flex-col items-center">
                    <div v-if="packet?.remainingCount > 0"
                        class="w-24 h-24 bg-[#EBC88E] rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all active:scale-95 border-4 border-[#E35447] hover:brightness-105"
                        :class="{ 'animate-spinning': isOpening }" @click="$emit('open')">
                        <span class="text-[#333] font-bold text-4xl font-serif">開</span>
                    </div>
                    <div v-else class="text-[#FFE2B1] text-lg font-medium opacity-60">红包已被领光</div>

                    <!-- Reject Link -->
                    <div v-if="packet?.role === 'ai'"
                        class="mt-8 text-[#FFE2B1]/60 text-sm cursor-pointer hover:text-white transition-colors underline underline-offset-4"
                        @click="$emit('reject')">
                        不想要，退还资金
                    </div>
                </div>

                <div class="absolute bottom-4 text-[#FFE2B1]/40 text-[10px] tracking-widest">微信红包</div>
            </div>

            <!-- 2. Result Detail View -->
            <div v-else class="w-full h-full flex flex-col relative animate-slide-up bg-[#f5f5f5]">
                <!-- Header (Red Arc) -->
                <div
                    class="relative w-full h-[180px] bg-[#D04035] flex flex-col items-center pt-8 shrink-0 overflow-hidden">
                    <div class="absolute -bottom-[40%] left-[-10%] w-[120%] h-[100%] bg-[#D04035] rounded-[50%] z-0">
                    </div>

                    <div class="z-10 flex flex-col items-center">
                        <div class="flex items-center gap-2 mb-2">
                            <img :src="getSenderAvatar()" class="w-6 h-6 rounded border border-white/20">
                            <span class="text-white text-sm font-medium">{{ getSenderName() }}的红包</span>
                        </div>
                        <div class="text-white/80 text-xs mb-3">{{ packet?.note }}</div>

                        <!-- My Claim Result (If I claimed) -->
                        <div v-if="myClaim" class="flex items-baseline text-[#f8d0a0]">
                            <span class="text-2xl font-bold mr-1">{{ myClaim.amount }}</span>
                            <span class="text-xs">元</span>
                        </div>
                        <div v-else class="text-white font-medium">共 {{ packet?.totalAmount }} 元</div>
                    </div>
                </div>

                <!-- Claims List -->
                <div class="flex-1 overflow-y-auto px-4 py-2 z-10 -mt-4">
                    <div class="bg-white rounded-t-xl p-4 shadow-sm min-h-full">
                        <div
                            class="text-gray-400 text-[10px] mb-4 uppercase tracking-tighter font-bold flex justify-between">
                            <span>已领取 {{ packet?.claims?.length || 0 }}/{{ packet?.count || 1 }} 个</span>
                            <span>{{ packet?.packetType === 'lucky' ? '手气红包' : '普通红包' }}</span>
                        </div>

                        <div v-for="(claim, idx) in packet?.claims" :key="idx"
                            class="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 group">
                            <img :src="claim.avatar || '/avatars/default.png'"
                                class="w-10 h-10 rounded-lg object-cover bg-gray-100">
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm font-medium text-gray-800 truncate">{{ claim.name }}</span>
                                    <span class="text-sm font-bold text-gray-900">{{ claim.amount }}元</span>
                                </div>
                                <div class="flex justify-between items-center mt-0.5">
                                    <span class="text-[10px] text-gray-400">{{ formatTime(claim.time) }}</span>
                                    <span v-if="isLuckyKing(claim)"
                                        class="text-[10px] text-orange-500 font-bold flex items-center gap-0.5">
                                        <i class="fa-solid fa-crown text-[8px]"></i> 手气最佳
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div v-if="packet?.claims?.length === 0" class="py-12 flex flex-col items-center text-gray-300">
                            <i class="fa-solid fa-hourglass-start text-3xl mb-2 opacity-20"></i>
                            <span class="text-xs">暂无人领取</span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-4 bg-white border-t border-gray-100 flex justify-center shrink-0">
                    <span class="text-[#576b95] text-xs font-medium cursor-pointer"
                        @click="$emit('view-wallet')">查看我的零钱</span>
                </div>
            </div>
        </div>

        <!-- Bottom Close Button (Outside Card) -->
        <button
            class="mt-8 w-11 h-11 rounded-full border border-white/30 flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white hover:text-white active:scale-95 transition-all backdrop-blur-sm"
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
    chatData: Object,
    isOpening: Boolean,
    showResult: Boolean
})

const myClaim = computed(() => {
    return props.packet?.claims?.find(c => c.id === 'user')
})

const getSenderAvatar = () => {
    if (props.packet?.role === 'user') return props.chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'
    // If targeted member sent it
    if (props.packet?.senderId) {
        const p = props.chatData?.participants?.find(p => p.id === props.packet.senderId)
        if (p) return p.avatar
    }
    return props.chatData?.avatar
}

const getSenderName = () => {
    if (props.packet?.role === 'user') return '我'
    if (props.packet?.senderId) {
        const p = props.chatData?.participants?.find(p => p.id === props.packet.senderId)
        if (p) return p.name
    }
    return props.chatData?.name || '对方'
}

const isLuckyKing = (claim) => {
    if (props.packet?.packetType !== 'lucky') return false
    if (!props.packet?.claims || props.packet.claims.length < props.packet.count) return false

    // Max amount among all claims
    const max = Math.max(...props.packet.claims.map(c => c.amount))
    return claim.amount === max
}

const formatTime = (ts) => {
    if (!ts) return ''
    const date = new Date(ts)
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0')
}
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.15s ease-out;
}

.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-spinning {
    animation: spinRedPacket 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes spinRedPacket {
    0% {
        transform: rotateY(0deg);
    }

    100% {
        transform: rotateY(360deg);
    }
}

/* Custom Scrollbar */
::-webkit-scrollbar {
    width: 4px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #e0e0e0;
    border-radius: 10px;
}
</style>
