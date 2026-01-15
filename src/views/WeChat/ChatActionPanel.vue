<template>
  <div class="h-[200px] bg-[#f7f7f7] border-t border-[#dcdcdc] p-6 animate-slide-up">
    <div class="grid grid-cols-5 gap-4">
      <!-- Album (Image) -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'album')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-regular fa-image text-2xl text-[#505050]"></i>
        </div>
        <span class="text-xs text-[#888]">相册</span>
      </div>

      <!-- Camera (Placeholder) -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'camera')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-camera text-2xl text-[#505050]"></i>
        </div>
        <span class="text-xs text-[#888]">拍照</span>
      </div>

      <!-- Red Packet -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'redpacket')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-envelope text-2xl text-[#ea5f39]"></i>
        </div>
        <span class="text-xs text-[#888]">红包</span>
      </div>

      <!-- Transfer -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'transfer')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-arrow-right-arrow-left text-2xl text-[#f79e39]"></i>
        </div>
        <span class="text-xs text-[#888]">转账</span>
      </div>
      
      <!-- Family Card -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'family-card')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-people-roof text-2xl text-[#ea4335]"></i>
        </div>
        <span class="text-xs text-[#888]">亲属卡</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['action'])
</script>

<style scoped>
.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
