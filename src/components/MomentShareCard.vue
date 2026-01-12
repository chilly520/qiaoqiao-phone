<script setup>
import { computed } from 'vue'

const props = defineProps({
    data: Object
})

const momentData = computed(() => {
    try {
        return typeof props.data === 'string' ? JSON.parse(props.data) : props.data
    } catch (e) {
        return {}
    }
})
</script>

<template>
  <div class="moment-share-card bg-white rounded-lg p-3 border border-gray-100 shadow-sm max-w-[240px] cursor-pointer active:bg-gray-50 transition-colors">
    <div class="flex flex-col gap-2">
      <!-- Author -->
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-earth-asia text-[10px] text-gray-400"></i>
        <span class="text-xs text-gray-500 font-medium">来自 {{ momentData.author || '朋友圈' }} 的分享</span>
      </div>
      
      <!-- Content Preview -->
      <div class="flex gap-2">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-800 line-clamp-3 leading-snug">{{ momentData.text || '分享了一条状态' }}</p>
        </div>
        <div v-if="momentData.image" class="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0">
          <img :src="momentData.image" class="w-full h-full object-cover">
        </div>
      </div>
      
      <!-- Footer Label -->
      <div class="border-t border-gray-50 pt-1.5 mt-1">
        <span class="text-[10px] text-gray-400">朋友圈</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
