<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/85 z-[150] flex flex-col items-center justify-center animate-fade-in"
        @click.self="$emit('close')">

        <!-- The Card -->
        <div class="w-[320px] h-[520px] rounded-[12px] relative overflow-hidden shadow-2xl transition-all duration-500"
            :class="[
                !showResult ? 'bg-[#CF3B32]' : 'bg-[#f5f5f5]',
                isOpening ? 'animate-vibrate' : ''
            ]">

            <Transition name="packet-flip" mode="out-in">
                <!-- 1. Unopened View -->
                <div v-if="!showResult" key="unopened"
                    class="w-full h-full flex flex-col items-center relative overflow-hidden bg-[#CF3B32]">
                    <!-- Background Cover Image (If exists) -->
                    <div v-if="packet?.coverImage" class="absolute inset-0 z-0">
                        <img :src="packet.coverImage" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/20"></div>
                    </div>

                    <!-- Envelope Flap (The 'Texture') -->
                    <div
                        class="absolute -top-[160px] -left-[10%] w-[120%] h-[380px] bg-[#DE4F45] rounded-[50%] shadow-[0_4px_15px_rgba(0,0,0,0.2)] z-10 border-b border-black/5">
                    </div>

                    <!-- User Info & Note -->
                    <div class="z-20 mt-[60px] flex flex-col items-center w-full px-8">
                        <img :src="getSenderAvatar()"
                            class="w-16 h-16 rounded-2xl border-2 border-[#EBC88E]/40 mb-4 shadow-2xl object-cover">
                        <div class="text-[#FFE2B1] text-lg font-bold drop-shadow-lg tracking-wide">{{ getSenderName() }}
                        </div>
                        <div class="text-[#FFE2B1]/60 text-[10px] mt-1 mb-12 tracking-[0.2em] font-light">给你发了一个红包</div>

                        <div class="text-[#EBC88E] text-2xl font-medium text-center line-clamp-3 leading-relaxed drop-shadow-xl"
                            style="text-shadow: 0 2px 8px rgba(0,0,0,0.4);">
                            {{ packet?.note || '恭喜发财，大吉大利' }}
                        </div>
                    </div>

                    <!-- Open Button -->
                    <div class="z-20 mt-auto mb-[80px] flex flex-col items-center">
                        <div v-if="packet?.remainingCount > 0"
                            class="w-24 h-24 bg-[#EBC88E] rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.4)] cursor-pointer transition-all active:scale-95 border-4 border-[#CF3B32]/30 hover:brightness-110"
                            style="perspective: 1000px;" :class="{ 'animate-spinning-3d': isOpening }"
                            @click="$emit('open')">
                            <span class="text-[#333] font-bold text-4xl font-serif">開</span>
                        </div>
                        <div v-else
                            class="text-[#FFE2B1] text-lg font-bold drop-shadow-lg bg-black/40 px-6 py-2 rounded-full backdrop-blur-md border border-white/10">
                            红包已被领光</div>

                        <!-- Reject Link -->
                        <div v-if="packet?.role === 'ai'"
                            class="mt-10 text-[#FFE2B1]/80 text-sm font-bold cursor-pointer hover:text-white transition-colors underline underline-offset-4 drop-shadow-lg"
                            @click="$emit('reject')">
                            退回红包
                        </div>
                    </div>

                    <div
                        class="absolute bottom-4 z-20 text-[#FFE2B1]/40 text-[10px] tracking-[0.3em] font-bold uppercase">
                        WeChat Red Packet</div>
                </div>

                <!-- 2. Result Detail View -->
                <div v-else key="result" class="w-full h-full flex flex-col relative bg-[#f5f5f5]">
                    <!-- Header (Red Arc) -->
                    <div
                        class="relative w-full h-[180px] bg-[#D04035] flex flex-col items-center pt-8 shrink-0 overflow-hidden">
                        <!-- Header Decoration (Arc with optional Image) -->
                        <div
                            class="absolute -bottom-[40%] left-[-10%] w-[120%] h-[100%] bg-[#D04035] rounded-[50%] z-0 overflow-hidden">
                            <img v-if="packet?.coverImage" :src="packet.coverImage"
                                class="w-full h-full object-cover scale-150 transform translate-y-[-10%]">
                            <div v-if="packet?.coverImage" class="absolute inset-0 bg-black/20"></div>
                        </div>

                        <div class="z-10 flex flex-col items-center">
                            <div class="flex items-center gap-2 mb-2">
                                <img :src="getSenderAvatar()" class="w-6 h-6 rounded border border-white/20">
                                <span class="text-white text-sm font-medium">{{ getSenderName() }}的红包</span>
                            </div>
                            <div class="text-white/80 text-xs mb-3">{{ packet?.note }}</div>

                            <!-- My Claim Result or Single Chat Amount -->
                            <div v-if="myClaim || !chatData?.isGroup" class="flex flex-col items-center">
                                <div class="flex items-baseline text-[#f8d0a0] drop-shadow-sm">
                                    <span class="text-5xl font-black mr-1">{{ formatAmount }}</span>
                                    <span class="text-sm font-bold">元</span>
                                </div>
                                <div v-if="!chatData?.isGroup"
                                    class="text-white/60 text-[10px] mt-1 tracking-[0.2em] font-light">红包金额</div>
                            </div>
                            <div v-else class="text-[#f8d0a0] flex flex-col items-center">
                                <div class="text-white/90 text-xs mb-1 tracking-widest opacity-80">总金额</div>
                                <div class="flex items-baseline">
                                    <span class="text-3xl font-bold mr-1">{{ formatAmount }}</span>
                                    <span class="text-xs">元</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Claims List -->
                    <div class="flex-1 overflow-y-auto px-4 py-2 z-10 -mt-4">
                        <div class="bg-white rounded-t-xl p-4 shadow-sm min-h-full">
                            <div v-if="chatData?.isGroup"
                                class="text-gray-400 text-[10px] mb-4 uppercase tracking-tighter font-bold flex justify-between items-center border-b border-gray-50 pb-2">
                                <span>已领取 {{ packet?.claims?.length || 0 }}/{{ packet?.count || 1 }} 个，共 {{
                                    packet?.amount || '0.00' }} 元</span>
                                <span class="bg-gray-100 px-2 py-0.5 rounded text-[8px] italic">{{ packet?.packetType
                                    === 'lucky' ? '拼手气红包' : '普通红包' }}</span>
                            </div>

                            <div v-if="chatData?.isGroup">
                                <div v-for="(claim, idx) in packet?.claims" :key="idx"
                                    class="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                                    <div class="flex items-center gap-3">
                                        <img :src="claim.avatar" class="w-10 h-10 rounded-lg bg-gray-100 object-cover">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-800">{{ claim.name }}</span>
                                            <span class="text-[10px] text-gray-400">{{ formatTime(claim.timestamp)
                                                }}</span>
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-end">
                                        <div class="flex items-baseline font-bold text-gray-700">
                                            <span class="text-sm">{{ claim.amount }}</span>
                                            <span class="text-[10px] ml-0.5">元</span>
                                        </div>
                                        <div v-if="claim.isBest" class="flex items-center gap-1 text-[#f79c1f]">
                                            <i class="fa-solid fa-crown text-[8px]"></i>
                                            <span class="text-[8px] font-bold">手气最佳</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="flex flex-col items-center py-10 text-gray-400">
                                <template v-if="myClaim">
                                    <i class="fa-solid fa-circle-check text-4xl mb-3 text-green-500"></i>
                                    <span class="text-sm text-gray-600 font-medium">已存入零钱，可直接使用</span>
                                </template>
                                <template v-else-if="packet?.role === 'user' || packet?.senderId === 'user'">
                                    <!-- Sender's view of their own red packet -->
                                    <template v-if="packet?.isRejected">
                                        <i class="fa-solid fa-rotate-left text-4xl mb-3 text-orange-400 opacity-60"></i>
                                        <span class="text-sm">红包已退回</span>
                                    </template>
                                    <template v-else-if="packet?.isClaimed">
                                        <i class="fa-solid fa-check-circle text-4xl mb-3 text-green-500 opacity-40"></i>
                                        <span class="text-sm">红包已被领取</span>
                                    </template>
                                    <template v-else>
                                        <i class="fa-solid fa-clock text-4xl mb-3 text-gray-200"></i>
                                        <span class="text-sm">待对方领取</span>
                                    </template>
                                </template>
                                <template v-else>
                                    <!-- Recipient's view of an already claimed packet -->
                                    <i class="fa-solid fa-check-circle text-4xl mb-3 text-green-500 opacity-20"></i>
                                    <span class="text-sm">红包已领取</span>
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="p-4 bg-white border-t border-gray-100 flex justify-center shrink-0">
                        <span class="text-[#576b95] text-xs font-medium cursor-pointer"
                            @click="$emit('view-wallet')">查看我的零钱</span>
                    </div>
                </div>
            </Transition>
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
    showResult: Boolean,
    resultAmount: [String, Number]
})

const formatAmount = computed(() => {
    // Priority: My Claim Amount > Prop resultAmount > Packet Amount
    const val = myClaim.value ? myClaim.value.amount : (props.resultAmount || props.packet?.amount)
    if (!val && val !== 0) return '0.00'
    return parseFloat(val).toFixed(2)
})

const myClaim = computed(() => {
    return props.packet?.claims?.find(c => c.id === 'user')
})

const getSenderAvatar = () => {
    if (props.packet?.role === 'user') return props.chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'
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

/* 3D Coin Spinning Animation */
.animate-spinning-3d {
    animation: spinCoin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    transform-style: preserve-3d;
}

@keyframes spinCoin {
    0% {
        transform: rotateY(0deg) scale(1);
    }

    50% {
        transform: rotateY(180deg) scale(1.1);
    }

    100% {
        transform: rotateY(360deg) scale(1);
    }
}

/* Vibrate Animation for the whole card */
.animate-vibrate {
    animation: vibrate 0.1s linear infinite;
}

@keyframes vibrate {
    0% {
        transform: translate(0);
    }

    25% {
        transform: translate(1px, 1px);
    }

    50% {
        transform: translate(-1px, 1px);
    }

    75% {
        transform: translate(1px, -1px);
    }

    100% {
        transform: translate(-1px, -1px);
    }
}

/* Transition between unopened and result */
.packet-flip-enter-active,
.packet-flip-leave-active {
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.packet-flip-enter-from {
    opacity: 0;
    transform: scale(0.8) rotateY(-90deg);
}

.packet-flip-leave-to {
    opacity: 0;
    transform: scale(1.1) rotateY(90deg);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
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
