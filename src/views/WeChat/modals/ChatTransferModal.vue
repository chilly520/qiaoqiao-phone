<template>
  <div v-if="visible"
       class="fixed inset-0 bg-black/60 z-[160] flex flex-col items-center justify-center p-4 animate-fade-in"
       @click.self="$emit('close')">
      <div class="bg-white w-[280px] rounded-[12px] overflow-hidden shadow-xl relative">
          <div class="p-8 flex flex-col items-center text-center">
              <div v-if="packet?.isRejected">
                  <i class="fa-solid fa-ban text-red-500 text-5xl mb-4"></i>
                  <div class="text-xl font-medium text-black mb-1">已拒收</div>
                  <div class="text-3xl font-bold text-black mb-6">¥{{ packet?.amount || '0.00' }}</div>
                  <div class="text-gray-400 text-sm">{{ packet?.role === 'user' ? '资金已退回您的零钱' : '资金已退回对方账户' }}</div>
              </div>
              <div v-else-if="packet?.isClaimed">
                  <i class="fa-solid fa-check-circle text-[#07c160] text-5xl mb-4"></i>
                  <div class="text-xl font-medium text-black mb-1">已收款</div>
                  <div class="text-3xl font-bold text-black mb-6">¥{{ packet?.amount || '0.00' }}</div>
                  <div class="text-gray-400 text-sm">{{ packet?.role === 'user' ? '对方已收款' : '已存入零钱' }}</div>
              </div>
              <!-- Waiting (I sent it) -->
              <div v-else-if="packet?.role === 'user'">
                  <i class="fa-solid fa-hourglass-half text-[#f79c1f] text-5xl mb-4 animate-pulse"></i>
                  <div class="text-xl font-medium text-black mb-1">等待对方收款</div>
                  <div class="text-3xl font-bold text-black mb-6">¥{{ packet?.amount || '0.00' }}</div>
                  <div class="text-gray-400 text-sm mb-6">1天内未确认将自动退还</div>
              </div>
              <!-- Waiting (I received it) -->
              <div v-else>
                  <i class="fa-solid fa-circle-check text-[#07c160] text-5xl mb-4"></i>
                  <div class="text-xl font-medium text-black mb-1">收到转账</div>
                  
                  <!-- Info -->
                  <div class="flex items-center justify-center gap-2 mb-4 mt-2">
                       <span class="text-gray-500 text-sm">来自</span>
                       <div class="flex items-center gap-1">
                          <img :src="chatData.avatar" class="w-5 h-5 rounded full object-cover">
                          <span class="text-gray-700 font-medium text-sm">{{ chatData.name }}</span>
                       </div>
                  </div>

                  <div class="text-3xl font-bold text-black mb-6">¥{{ packet?.amount || '0.00' }}</div>
                  <div class="text-gray-400 text-sm mb-6">确认收款后资金将存入零钱</div>

                  <div class="flex flex-col gap-3 w-full">
                      <button
                          class="w-full bg-[#07c160] hover:bg-[#06ad56] text-white py-3 rounded-lg font-medium transition-colors"
                          @click="$emit('confirm')">确认收款</button>
                      <button
                          class="w-full text-[#576b95] text-sm py-2 hover:bg-gray-50 rounded-lg transition-colors"
                          @click="$emit('reject')">立即退还</button>
                  </div>
              </div>
          </div>
      </div>

      <!-- Bottom Close Button (Outside Card) -->
      <button
          class="mt-8 w-10 h-10 rounded-full border border-white/40 flex items-center justify-center text-white/80 hover:bg-white/10 hover:border-white hover:text-white active:scale-95 transition-all backdrop-blur-sm"
          @click="$emit('close')">
          <i class="fa-solid fa-xmark text-xl"></i>
      </button>
  </div>
</template>

<script setup>
defineProps({
  visible: Boolean,
  packet: Object,
  chatData: Object
})
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
