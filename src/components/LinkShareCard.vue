<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: [Object, String]
})

const linkData = computed(() => {
  try {
    const parsed = typeof props.data === 'string' ? JSON.parse(props.data) : props.data
    return parsed || {}
  } catch (e) {
    return {}
  }
})

const platformIcon = computed(() => {
  switch (linkData.value.platform) {
    case 'douyin': return 'fa-brands fa-tiktok'
    case 'xiaohongshu': return 'fa-solid fa-book'
    case 'bilibili': return 'fa-brands fa-bilibili'
    case 'weibo': return 'fa-brands fa-weibo'
    case 'zhihu': return 'fa-brands fa-zhihu'
    case 'youtube': return 'fa-brands fa-youtube'
    case 'twitter': return 'fa-brands fa-x-twitter'
    case 'instagram': return 'fa-brands fa-instagram'
    default: return 'fa-solid fa-link'
  }
})

const platformColor = computed(() => {
  switch (linkData.value.platform) {
    case 'douyin': return '#000000'
    case 'xiaohongshu': return '#ff2442'
    case 'bilibili': return '#fb7299'
    case 'weibo': return '#e6162d'
    case 'zhihu': return '#0084ff'
    case 'youtube': return '#ff0000'
    case 'twitter': return '#000000'
    case 'instagram': return '#e1306c'
    default: return '#576b95'
  }
})

function openLink() {
  const url = linkData.value.url
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <div class="link-share-card bg-white rounded-[4px] border border-gray-200 shadow-sm w-[240px] overflow-hidden select-none cursor-pointer active:scale-95 transition-transform"
    @click="openLink">
    <!-- 缩略图 -->
    <div v-if="linkData.image" class="w-full h-[120px] bg-gray-100 overflow-hidden">
      <img :src="linkData.image" class="w-full h-full object-cover" referrerpolicy="no-referrer"
        @error="$event.target.style.display='none'">
    </div>

    <!-- 标题 + 描述 -->
    <div class="p-3">
      <p class="text-[14px] text-black leading-snug line-clamp-2 font-medium mb-1">
        {{ linkData.title || linkData.url || '分享了一个链接' }}
      </p>
      <p v-if="linkData.description" class="text-[12px] text-gray-500 leading-snug line-clamp-2 mb-2">
        {{ linkData.description }}
      </p>

      <!-- 底部来源 -->
      <div class="flex items-center gap-1.5 pt-1">
        <div class="w-3.5 h-3.5 rounded-sm flex items-center justify-center"
          :style="{ background: platformColor }">
          <i :class="platformIcon" class="text-[8px] text-white"></i>
        </div>
        <span class="text-[10px] text-gray-400 scale-95 origin-left">
          {{ linkData.source || linkData.hostname || '网页' }}
        </span>
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
