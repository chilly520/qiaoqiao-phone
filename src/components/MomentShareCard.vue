<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: Object
})

const momentData = computed(() => {
  try {
    const parsed = typeof props.data === 'string' ? JSON.parse(props.data) : props.data
    return parsed || {}
  } catch (e) {
    return {}
  }
})
</script>

<template>
  <div class="moment-share-card bg-white rounded-[4px] border border-gray-200 shadow-sm w-[240px] overflow-hidden select-none">
    
    <!-- Title Area (If text exists) -->
    <div class="p-3 pb-2" v-if="momentData.originalText || momentData.text">
       <p class="text-[14px] text-black leading-snug line-clamp-2 font-medium">{{ momentData.originalText || momentData.text }}</p>
    </div>

    <!-- Content Area -->
    <div class="px-3 pb-3 flex gap-2" :class="!momentData.text ? 'pt-3' : ''">
      <!-- Image (Left) -->
      <div v-if="momentData.image" class="w-[50px] h-[50px] shrink-0 bg-gray-100">
         <img :src="momentData.image" class="w-full h-full object-cover">
      </div>
      <!-- Description/Fallback or just Right Side Spacer -->
      <div v-else class="w-[50px] h-[50px] shrink-0 bg-gray-100 flex items-center justify-center text-gray-400">
         <i class="fa-solid fa-image text-xl"></i>
      </div>

       <!-- Right Side Info (Author/Source) -->
       <div class="flex-1 flex flex-col justify-between py-0.5 max-w-[calc(100%-60px)]">
           <div class="text-[12px] text-gray-500 line-clamp-2" v-if="!momentData.text">分享了一条动态</div>
           <!-- Bottom Source Label -->
           <div class="mt-auto flex items-center gap-1.5 pt-1">
              <div class="w-3.5 h-3.5 rounded-sm flex items-center justify-center bg-gray-100">
                  <i class="fa-solid fa-camera-retro text-[8px] text-gray-400"></i>
              </div>
              <span class="text-[10px] text-gray-400 scale-95 origin-left">朋友圈</span>
           </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
