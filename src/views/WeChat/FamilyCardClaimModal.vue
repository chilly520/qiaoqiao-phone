<template>
  <div v-if="visible" 
       class="fixed inset-0 bg-black/60 z-[170] flex flex-col items-center justify-center p-4 animate-fade-in"
       @click.self="close">
       
      <div class="bg-white w-[300px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
          <!-- Header -->
          <div class="h-32 relative text-white flex flex-col items-center justify-center p-4 overflow-hidden" 
               :class="currentThemeClass">
              <div class="absolute inset-0 bg-black/10"></div>
              <!-- Decor -->
              <div class="absolute -right-4 -top-4 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
              
              <div class="relative z-10 flex flex-col items-center">
                  <div class="flex items-center gap-2 mb-2">
                      <i class="fa-solid fa-gift text-lg"></i>
                      <span class="font-bold">{{ pendingData.isApply ? '亲属卡申请' : '领取亲属卡' }}</span>
                  </div>
                  <div v-if="!pendingData.isApply" class="text-3xl font-mono font-bold tracking-tighter">¥{{ pendingData.amount }}</div>
                  <div v-else class="text-lg font-medium opacity-90">等待回应...</div>
              </div>
          </div>
          
          <!-- Content -->
          <div class="p-5 space-y-4">
              <!-- Note -->
              <div class="text-xs text-gray-500 text-center bg-gray-50 p-2 rounded-lg italic border border-gray-100">
                  "{{ pendingData.note || '拿去买糖吃~' }}"
              </div>
              
              <!-- Settings (Only for claim) -->
              <div v-if="!pendingData.isApply" class="space-y-3">
                  <div>
                      <label class="text-xs font-bold text-gray-400 block mb-1">卡片名称</label>
                      <input v-model="form.cardName" type="text" class="w-full bg-gray-100 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-pink-300 transition-all font-medium text-gray-700">
                  </div>
                  
                  <div>
                      <label class="text-xs font-bold text-gray-400 block mb-1">卡号 (选填)</label>
                      <input v-model="form.number" type="text" placeholder="留空自动生成" class="w-full bg-gray-100 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-pink-300 transition-all font-mono">
                  </div>
                  
                  <div>
                      <label class="text-xs font-bold text-gray-400 block mb-1">卡面主题</label>
                      <div class="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
                          <div v-for="t in themeOptions" :key="t.value" 
                               @click="form.theme = t.value"
                               class="w-8 h-8 rounded-full shrink-0 cursor-pointer ring-2 ring-offset-1 transition-all"
                               :class="[t.class, form.theme === t.value ? 'ring-gray-400 scale-110' : 'ring-transparent opacity-70 hover:opacity-100 hover:scale-105']"
                               :title="t.label">
                          </div>
                      </div>
                  </div>
              </div>

              <!-- Waiting Status (Only for Apply) -->
              <div v-else class="py-4 text-center">
                  <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <i class="fa-solid fa-hourglass-half text-gray-400 text-2xl"></i>
                  </div>
                  <div class="text-gray-500 font-medium">已发送申请，等待对方确认</div>
                  <div class="text-xs text-gray-400 mt-1">对方同意后即可在此领取</div>
              </div>
              
              <!-- Actions -->
              <div class="pt-2 flex gap-3">
                  <button v-if="!pendingData.isApply" class="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl border border-transparent hover:bg-gray-200 transition-all active:scale-95" @click="close">
                      取消
                  </button>
                  <button v-if="!pendingData.isApply" class="flex-1 bg-[#ff9a9e] text-white font-bold py-2.5 rounded-xl border border-transparent hover:brightness-105 transition-all shadow-md shadow-pink-200 active:scale-95" @click="handleConfirm">
                      确认领取
                  </button>
                  <button v-else class="w-full bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl border border-transparent hover:bg-gray-200 transition-all active:scale-95" @click="close">
                      关闭
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
const form = ref({ cardName: '', number: '', theme: 'pink' })

const themeOptions = [
  { value: 'pink', class: 'bg-gradient-to-br from-[#ff9a9e] to-[#fecfef]', label: '粉色浪漫' },
  { value: 'red', class: 'bg-gradient-to-br from-red-500 to-pink-600', label: '新年红' },
  { value: 'blue', class: 'bg-gradient-to-br from-blue-500 to-cyan-500', label: '深海蓝' },
  { value: 'gold', class: 'bg-gradient-to-br from-yellow-500 via-orange-400 to-yellow-600', label: '至尊金' },
  { value: 'black', class: 'bg-gradient-to-br from-gray-700 to-black', label: '黑金卡' },
  { value: 'purple', class: 'bg-gradient-to-br from-purple-500 to-indigo-600', label: '紫韵' },
]

const currentThemeClass = computed(() => {
  return themeOptions.find(t => t.value === form.value.theme)?.class || 'bg-gradient-to-br from-[#ff9a9e] to-[#fecfef]'
})

const open = (data, defaultName) => {
  pendingData.value = data
  form.value = {
      cardName: defaultName || '亲属卡',
      number: '',
      theme: 'pink'
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
