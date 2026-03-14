<template>
    <div v-if="visible"
        class="fixed inset-0 bg-black/60 z-[170] flex flex-col items-center justify-center p-4 animate-fade-in"
        @click.self="close">

      <div class="bg-[#0f0f0f] w-[320px] rounded-[24px] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-[#d4af37]/30 animate-scale-up">
            <!-- Header (Black Gold Style) -->
            <div class="h-48 relative text-white flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-[#2d2d2d] to-[#010101]">
                <!-- Metal Texture -->
                <div class="absolute inset-0 opacity-[0.1] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>
                <!-- Card Shine -->
                <div class="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/15 via-transparent to-white/10"></div>
                
                <div class="relative z-10 flex flex-col items-center w-full">
                    <div class="w-10 h-7 rounded bg-gradient-to-br from-[#d4af37] via-[#f1d592] to-[#b8860b] flex items-center justify-center shadow-lg relative overflow-hidden mb-5">
                        <div class="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#000_1px,#000_2px)]"></div>
                        <i class="fa-solid fa-microchip text-black/70 text-sm relative z-10"></i>
                    </div>

                    <div class="flex items-center gap-2 mb-3 px-3 py-1 bg-[#d4af37]/15 rounded-full border border-[#d4af37]/20">
                        <i class="fa-solid fa-shield-halved text-[10px] text-[#f1d592]"></i>
                        <span class="text-[9px] font-black uppercase tracking-[0.2em] text-[#f1d592]">Authorized Access</span>
                    </div>

                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-1.5 opacity-60">{{ cardData.ownerName }} · 专属授权</div>
                    <div class="text-2xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#f1d592] via-[#d4af37] to-[#b8860b] drop-shadow-lg">
                        {{ cardData.cardName }}
                    </div>

                    <!-- Card Number Display -->
                    <div class="font-mono text-[10px] tracking-[4px] text-white/30 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                        {{ formatCardNumber(cardData.number) }}
                    </div>
                </div>

                <!-- Corner Logo -->
                <div class="absolute bottom-4 right-4 flex items-center bg-white/5 px-2 py-1 rounded border border-white/5 italic font-black text-[7px] text-[#f1d592] tracking-tighter opacity-40">
                    <span class="text-rose-500">Union</span>Pay
                </div>
            </div>

            <!-- Details Content -->
            <div class="p-6 bg-[#0a0a0a]">
                <div class="space-y-6">
                    <!-- Status Message -->
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-2xl bg-[#07c160]/10 flex items-center justify-center shrink-0 border border-[#07c160]/20 shadow-inner">
                            <i class="fa-solid fa-circle-check text-[#07c160] text-lg"></i>
                        </div>
                        <div>
                            <p class="text-[13px] font-black text-gray-100 uppercase tracking-wide">卡片已生效</p>
                            <p class="text-[11px] text-gray-500 mt-1 leading-relaxed">该亲属卡已成功绑定至您的钱包，消费时可选择作为扣款方式。</p>
                        </div>
                    </div>

                    <!-- Text Summary -->
                    <div class="bg-white/5 rounded-2xl p-5 border border-white/10 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-[#d4af37]/5 rounded-full blur-xl"></div>
                        <div class="text-[12px] text-gray-300 leading-relaxed relative z-10">
                            <span class="text-[#d4af37] text-[10px] block mb-3 uppercase font-black tracking-[0.2em] opacity-60">Ledger Entry</span>
                            由 <span class="text-[#f1d592] font-black">{{ cardData.ownerName }}</span> 为你赠送的卡片 <span class="text-white font-black">「{{ cardData.cardName }}」</span> 已由系统核实，并开启全额支付权限。
                        </div>
                    </div>

                    <!-- Amount Info -->
                    <div v-if="cardData.amount > 0" class="flex justify-between items-center px-4 py-3 bg-black rounded-2xl border border-white/10 shadow-inner">
                        <span class="text-[11px] text-[#d4af37] font-black uppercase tracking-widest opacity-60">Grant Limit / 额度</span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-[10px] text-[#d4af37] font-bold">¥</span>
                            <span class="text-2xl font-black text-white font-mono tracking-tighter">{{ cardData.amount }}</span>
                        </div>
                    </div>
                </div>

                <!-- Action -->
                <div class="mt-8">
                    <button
                        class="w-full bg-gradient-to-r from-[#d4af37] via-[#f1d592] to-[#b8860b] text-black font-black py-4 rounded-xl shadow-[0_10px_30px_rgba(212,175,55,0.2)] transition-all hover:brightness-110 active:scale-95 text-xs uppercase tracking-[0.2em] border-t border-white/30"
                        @click="close">
                        确认详情
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
