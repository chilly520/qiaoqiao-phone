<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/60 z-[170] flex flex-col items-center justify-center p-4 animate-fade-in"
        @click.self="close">

        <div class="bg-white w-[300px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
            <!-- Header (Matching Card Style) -->
            <div class="h-40 relative text-white flex flex-col items-center justify-center p-6 overflow-hidden"
                :class="currentThemeClass">
                <div class="absolute inset-0 bg-black/5"></div>
                <!-- Floating Circles for Premium Look -->
                <div class="absolute -right-4 -top-8 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                <div class="absolute left-0 bottom-0 w-16 h-16 bg-white/5 rounded-full blur-xl"></div>

                <div class="relative z-10 flex flex-col items-center w-full">
                    <div class="flex items-center gap-2 mb-3 px-3 py-1 bg-white/20 rounded-full backdrop-blur-md">
                        <i class="fa-solid fa-check-double text-xs"></i>
                        <span class="text-[10px] font-bold uppercase tracking-widest">Successfully Claimed</span>
                    </div>

                    <div class="text-sm font-medium opacity-90 mb-1">{{ cardData.ownerName }} 送给我的</div>
                    <div class="text-2xl font-bold mb-3 tracking-tight">{{ cardData.cardName }}</div>

                    <!-- Fake Card Number Style -->
                    <div class="font-mono text-[10px] tracking-[3px] opacity-60">
                        {{ formatCardNumber(cardData.number) }}
                    </div>
                </div>
            </div>

            <!-- Details Content -->
            <div class="p-6">
                <div class="space-y-6">
                    <!-- Status Message -->
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-wallet text-green-500"></i>
                        </div>
                        <div>
                            <p class="text-[13px] font-bold text-gray-800 leading-snug">已存入钱包</p>
                            <p class="text-[11px] text-gray-500 mt-0.5">可在支付时选择此卡进行消费</p>
                        </div>
                    </div>

                    <!-- Text Summary -->
                    <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div class="text-[13px] text-gray-600 leading-relaxed font-songti">
                            <span
                                class="text-gray-400 font-sans text-xs block mb-2 uppercase font-bold tracking-tighter">Summary</span>
                            {{ cardData.ownerName }} 送给 {{ userName }} 的「{{ cardData.cardName }}」已成功绑定并存入钱包。
                        </div>
                    </div>

                    <!-- Amount Info if available -->
                    <div v-if="cardData.amount > 0" class="flex justify-between items-center px-2">
                        <span class="text-xs text-gray-400 font-bold uppercase">Initial Limit</span>
                        <span class="text-sm font-bold text-gray-800 font-mono">¥ {{ cardData.amount }}</span>
                    </div>
                </div>

                <!-- Action -->
                <div class="mt-8">
                    <button
                        class="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 text-sm"
                        @click="close">
                        我知道了
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    userName: {
        type: String,
        default: '我'
    }
})

const visible = ref(false)
const cardData = ref({}) // { cardName, ownerName, number, theme, amount }

const themeOptions = [
    { value: 'pink', class: 'bg-gradient-to-br from-[#ff9a9e] to-[#fecfef]' },
    { value: 'red', class: 'bg-gradient-to-br from-red-500 to-pink-600' },
    { value: 'blue', class: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
    { value: 'gold', class: 'bg-gradient-to-br from-yellow-500 via-orange-400 to-yellow-600' },
    { value: 'black', class: 'bg-gradient-to-br from-gray-700 to-black' },
    { value: 'purple', class: 'bg-gradient-to-br from-purple-500 to-indigo-600' },
]

const currentThemeClass = computed(() => {
    return themeOptions.find(t => t.value === cardData.value.theme)?.class || 'bg-gradient-to-br from-[#ffcd94] to-[#ff9a9e]'
})

const formatCardNumber = (num) => {
    if (!num) return '**** **** **** 6666'
    // Simple mock formatting: 4 chars then spaces
    const s = String(num).replace(/\s/g, '')
    return s.replace(/(.{4})/g, '$1 ').trim()
}

const open = (data) => {
    cardData.value = data
    visible.value = true
}

const close = () => {
    visible.value = false
}

defineExpose({ open, close })
</script>

<script>
export default {
    name: 'FamilyCardDetailModal'
}
</script>

<style scoped>
.font-songti {
    font-family: "Songti SC", serif;
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
