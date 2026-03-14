<template>
  <div v-if="visible" 
       class="fixed inset-0 bg-black/60 z-[170] flex flex-col items-center justify-center p-4 animate-fade-in"
       @click.self="close">
       
      <div class="bg-[#0f0f0f] w-[320px] rounded-[24px] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-[#d4af37]/30 animate-scale-up">
          <!-- Header (Black Gold Style) -->
          <div class="h-40 relative text-white flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-[#2d2d2d] to-[#010101]">
              <!-- Metal Texture -->
              <div class="absolute inset-0 opacity-[0.1] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>
              <!-- Metallic Shine -->
              <div class="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/15 via-transparent to-white/10"></div>
              
              <div class="relative z-10 flex flex-col items-center">
                  <div class="w-10 h-7 rounded bg-gradient-to-br from-[#d4af37] via-[#f1d592] to-[#b8860b] flex items-center justify-center shadow-lg relative overflow-hidden mb-4">
                      <div class="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#000_1px,#000_2px)]"></div>
                      <i class="fa-solid fa-microchip text-black/70 text-sm relative z-10"></i>
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                       <div class="h-px w-4 bg-[#d4af37]/40"></div>
                       <span class="text-[10px] font-black tracking-[0.3em] text-[#f1d592] uppercase">{{ pendingData.isApply ? 'Credit Request' : 'Family Grant' }}</span>
                       <div class="h-px w-4 bg-[#d4af37]/40"></div>
                  </div>
                  <div v-if="!pendingData.isApply" class="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#f1d592] via-[#d4af37] to-[#b8860b] drop-shadow-lg">¥{{ pendingData.amount }}</div>
                  <div v-else class="text-lg font-bold text-gray-400 italic tracking-[0.1em] opacity-60">Authentication...</div>
              </div>

              <!-- Logo -->
              <div class="absolute bottom-3 right-4 flex items-center bg-white/5 px-2 py-0.5 rounded border border-white/5 italic font-black text-[6px] text-[#f1d592] opacity-30">
                  <span class="text-rose-500">Union</span>Pay
              </div>
          </div>
          
          <!-- Content -->
          <div class="p-6 bg-[#0a0a0a] space-y-6">
              <!-- Note (Premium Quote Style) -->
              <div class="relative px-5 py-4 bg-white/5 rounded-2xl border border-white/10 italic text-gray-300 text-xs text-center shadow-inner">
                  <i class="fa-solid fa-quote-left absolute top-3 left-3 text-[10px] opacity-20 text-[#d4af37]"></i>
                  <span class="relative z-10">"{{ pendingData.note || '拿去买糖吃~' }}"</span>
                  <i class="fa-solid fa-quote-right absolute bottom-3 right-3 text-[10px] opacity-20 text-[#d4af37]"></i>
              </div>
              
              <!-- Settings -->
              <div v-if="!pendingData.isApply" class="space-y-5">
                  <div class="relative group">
                      <label class="text-[9px] font-black text-[#d4af37] px-1 uppercase tracking-widest block mb-2 opacity-60">Card Designation / 卡片名称</label>
                      <input v-model="form.cardName" type="text" class="w-full bg-black border border-white/10 rounded-xl p-4 text-sm focus:border-[#d4af37]/50 focus:ring-2 focus:ring-[#d4af37]/5 transition-all font-bold text-white placeholder-gray-700 outline-none shadow-inner">
                  </div>
                  
                  <div class="relative">
                      <label class="text-[9px] font-black text-[#d4af37] px-1 uppercase tracking-widest block mb-2 opacity-60">Account Number / 虚拟卡号</label>
                      <div class="flex items-center bg-black border border-white/10 rounded-xl p-4 shadow-inner">
                          <input v-model="form.number" type="text" placeholder="Default: 8888-****" class="w-full bg-transparent text-sm font-mono text-gray-400 outline-none">
                          <i class="fa-solid fa-lock text-[#d4af37]/30 text-[10px]"></i>
                      </div>
                  </div>
                  
                  <div>
                      <label class="text-[9px] font-black text-[#d4af37] px-1 uppercase tracking-widest block mb-2 opacity-60">Signature Color / 磨砂质感</label>
                      <div class="flex gap-3 overflow-x-auto py-1 px-1 scrollbar-hide">
                          <div v-for="t in themeOptions" :key="t.value" 
                               @click="form.theme = t.value"
                               class="w-8 h-8 rounded-full shrink-0 cursor-pointer ring-2 ring-offset-2 ring-offset-[#0a0a0a] transition-all relative overflow-hidden flex items-center justify-center shadow-lg"
                               :class="[t.class, form.theme === t.value ? 'ring-[#d4af37] scale-110' : 'ring-transparent opacity-40 hover:opacity-100']">
                               <i v-if="form.theme === t.value" class="fa-solid fa-check text-[10px] text-white mix-blend-difference"></i>
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Waiting Status -->
              <div v-else class="py-10 text-center">
                  <div class="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 relative">
                       <div class="absolute inset-0 rounded-full border-2 border-[#d4af37]/30 animate-ping"></div>
                       <i class="fa-solid fa-microchip text-[#d4af37] text-4xl opacity-40"></i>
                  </div>
                  <div class="text-white font-black text-sm tracking-widest uppercase">Encryption Active</div>
                  <div class="text-[11px] text-gray-500 mt-2 tracking-wide leading-relaxed">申请已成功发送，正在等待持卡人进行安全权限校验...</div>
              </div>
              
              <!-- Actions -->
              <div class="pt-2 flex gap-3">
                  <button v-if="!pendingData.isApply" class="flex-1 bg-white/5 text-gray-500 font-black py-4 rounded-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95 text-[10px] uppercase tracking-widest" @click="close">
                      Decline
                  </button>
                  <button v-if="!pendingData.isApply" class="flex-1 bg-gradient-to-r from-[#d4af37] via-[#f1d592] to-[#b8860b] text-black font-black py-4 rounded-xl shadow-[0_15px_35px_rgba(212,175,55,0.3)] transition-all hover:brightness-110 active:scale-95 text-[10px] uppercase tracking-widest border-t border-white/30" @click="handleConfirm">
                      Authorize & Claim
                  </button>
                  <button v-else class="w-full bg-white/5 text-gray-500 font-black py-4 rounded-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95 text-[10px] uppercase tracking-widest" @click="close">
                      Dismiss
                  </button>
              </div>
          </div>
      </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
// Optional props if needed
})

const emit = defineEmits(['confirm'])

const visible = ref(false)
const pendingData = ref({}) // { uuid, amount, note, fromCharId }
const form = ref({ cardName: '', number: '', theme: 'black' })

const themeOptions = [
  { value: 'black', class: 'bg-gradient-to-br from-gray-700 to-black', label: '黑金卡' },
  { value: 'pink', class: 'bg-gradient-to-br from-[#ff9a9e] to-[#fecfef]', label: '粉色浪漫' },
  { value: 'red', class: 'bg-gradient-to-br from-red-500 to-pink-600', label: '新年红' },
  { value: 'blue', class: 'bg-gradient-to-br from-blue-500 to-cyan-500', label: '深海蓝' },
  { value: 'gold', class: 'bg-gradient-to-br from-yellow-500 via-orange-400 to-yellow-600', label: '至尊金' },
  { value: 'purple', class: 'bg-gradient-to-br from-purple-500 to-indigo-600', label: '紫韵' },
]

const currentThemeClass = computed(() => {
  return themeOptions.find(t => t.value === form.value.theme)?.class || 'bg-gradient-to-br from-gray-700 to-black'
})

const open = (data, defaultName) => {
  pendingData.value = data
  form.value = {
      cardName: defaultName || '亲属卡',
      number: '',
      theme: 'black'
  }
  visible.value = true
}

const close = () => {
  visible.value = false
}

const handleConfirm = () => {
  emit('confirm', {
      ...form.value,
      uuid: pendingData.value.uuid,
      amount: pendingData.value.amount,
      fromCharId: pendingData.value.fromCharId,
      note: pendingData.value.note
  })
  close()
}

defineExpose({ open, close })
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
.animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.scrollbar-hide::-webkit-scrollbar { display: none; }
</style>
