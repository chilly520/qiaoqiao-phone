<template>
  <div v-if="visible"
       class="fixed inset-0 bg-black/85 z-[150] flex flex-col items-center justify-center animate-fade-in"
       @click.self="$emit('close')">
      <!-- The Card -->
      <div class="w-[320px] h-[500px] rounded-[12px] relative overflow-hidden shadow-2xl transition-all duration-500"
           :class="showResult ? 'bg-[#f5f5f5]' : 'bg-[#D04035]'">

          <!-- 1. Unopened View -->
          <div v-if="!showResult" class="w-full h-full flex flex-col items-center relative">
              <!-- Top Arc Decoration -->
              <div class="absolute -top-[150px] -left-[10%] w-[120%] h-[350px] bg-[#E35447] rounded-[50%] shadow-lg z-0">
              </div>

              <!-- User Info -->
              <div class="z-10 mt-[80px] flex flex-col items-center">
                  <div class="flex items-center gap-2 mb-4">
                      <img :src="getAvatar()"
                           class="w-12 h-12 rounded-full border-2 border-[#FFE2B1] shadow-sm">
                      <span class="text-[#FFE2B1] font-medium text-lg">{{ getName() }}</span>
                  </div>
                  <div class="text-[#FFE2B1] text-xl font-medium px-8 text-center leading-relaxed">
                      {{ packet?.note || "恭喜发财，大吉大利" }}
                  </div>
              </div>

              <!-- Open Button -->
              <div class="z-10 mt-auto mb-[100px] flex flex-col items-center">
                  <div class="w-24 h-24 bg-[#EBC88E] rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform active:scale-90 border-4 border-[#E35447]"
                       :class="{ 'animate-spin-slow': isOpening }" @click="$emit('open')">
                      <span class="text-[#333] font-bold text-3xl font-serif">開</span>
                  </div>
                  <!-- Reject Link -->
                  <div v-if="packet?.role === 'ai'"
                       class="mt-6 text-[#FFE2B1]/70 text-sm cursor-pointer hover:text-white transition-colors"
                       @click="$emit('reject')">
                      退回红包
                  </div>
              </div>
          </div>

          <!-- 2. Result View (Half Red / Half White) -->
          <div v-else class="w-full h-full flex flex-col items-center relative animate-fade-in">
              <!-- Top Red Section -->
              <div class="absolute top-0 left-0 w-full h-[160px] bg-[#D04035]">
                  <!-- Curved Bottom -->
                  <div class="absolute -bottom-[40px] left-0 w-full h-[80px] bg-[#D04035] rounded-b-[50%] shadow-none z-0">
                  </div>
              </div>

              <!-- Avatar (Overlapping) -->
              <div class="z-10 mt-[120px] relative">
                  <div class="w-20 h-20 rounded-full p-1 bg-white shadow-md">
                      <img :src="getResultAvatar()"
                           class="w-full h-full rounded-full object-cover">
                  </div>
              </div>

              <!-- Content (White Area) -->
              <div class="z-10 mt-4 flex flex-col items-center text-gray-800">
                  <!-- Sender Info -->
                  <div class="flex flex-col items-center gap-2 mb-4">
                      <div class="w-10 h-10 rounded-lg overflow-hidden border border-white/20 shadow-sm">
                          <img :src="packet.role === 'user' ? (chatData.userAvatar || '/avatars/default.png') : chatData.avatar" class="w-full h-full object-cover">
                      </div>
                      <div class="text-xs text-gray-500 font-medium">
                          {{ packet.role === 'user' ? '我' : chatData.name }}的红包
                      </div>
                  </div>

                  <!-- Status -->
                  <div class="font-medium text-lg mb-1">
                      {{ getResultStatusName() }}
                  </div>
                  <div class="text-gray-400 text-sm mb-6">
                      {{ 
                          packet?.isRejected ? '资金已原路退回' : 
                          (
                              packet?.role === 'user' && !packet?.isClaimed ? '等待对方领取' :
                              (packet?.isClaimed ? '已存入零钱' : '已存入零钱') 
                          )
                      }}
                  </div>

                  <!-- Amount -->
                  <div class="flex items-baseline font-bold text-[#D04035] mb-8">
                      <span class="text-3xl mr-1">¥</span>
                      <span class="text-5xl border-b border-transparent">{{ resultAmount }}</span>
                  </div>

                  <div class="text-[#576b95] text-sm cursor-pointer" @click="$emit('view-wallet')">查看我的钱包</div>
              </div>

              <!-- Bottom Decoration -->
              <div class="mt-auto mb-4 text-gray-300 text-xs">
                  微信红包
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
const props = defineProps({
  visible: Boolean,
  packet: Object,
  chatData: Object,
  isOpening: Boolean,
  showResult: Boolean,
  resultAmount: [String, Number]
})

const DEFAULT_USER_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'

const getAvatar = () => {
    if (props.packet?.role === 'user') return props.chatData?.userAvatar || DEFAULT_USER_AVATAR
    return props.packet?.claimedBy?.avatar || props.chatData?.avatar
}

const getName = () => {
    return props.packet?.role === 'user' ? '我的红包' : props.chatData?.name
}

const getResultAvatar = () => {
    if (props.packet?.isClaimed) {
        return props.chatData?.userAvatar || DEFAULT_USER_AVATAR
    }
    // If viewing details of sent packet
    if (props.packet?.role === 'user') return props.chatData?.userAvatar || DEFAULT_USER_AVATAR
    return props.chatData?.avatar
}

const getResultStatusName = () => {
    if (props.packet?.claimedBy?.name) return props.packet.claimedBy.name
    if (props.packet?.isRejected) return '已退回'
    if (props.packet?.role === 'user') return '我的红包'
    return props.chatData?.name
}
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
.animate-spin-slow { animation: spin 1s linear infinite; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
</style>
