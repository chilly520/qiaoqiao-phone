<template>
  <div class="h-[240px] bg-[#f7f7f7] border-t border-[#dcdcdc] p-4 animate-slide-up overflow-y-auto">
    <div class="grid grid-cols-4 gap-4">
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

      <!-- See Image (Text to Image) -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'see-image')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-image text-2xl text-[#4285f4]"></i>
        </div>
        <span class="text-xs text-[#888]">见图</span>
      </div>

      <!-- Video Call -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'video-call')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-video text-2xl text-[#07c160]"></i>
        </div>
        <span class="text-xs text-[#888]">视频通话</span>
      </div>

      <!-- Voice Call -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'voice-call')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-phone text-2xl text-[#07c160]"></i>
        </div>
        <span class="text-xs text-[#888]">语音通话</span>
      </div>

      <!-- Timer Mission -->
      <div class="flex flex-col items-center gap-2 cursor-pointer group" @click="$emit('action', 'timer')">
        <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center border border-[#dcdcdc] group-active:bg-gray-100">
           <i class="fa-solid fa-clock text-2xl text-[#6366f1]"></i>
        </div>
        <span class="text-xs text-[#888]">定时任务</span>
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
