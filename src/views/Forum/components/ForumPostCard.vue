<template>
  <div class="p-4 bg-white hover:bg-teal-50/30 transition-all border rounded-[24px] cursor-pointer flex flex-col gap-2 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] mb-3 overflow-hidden group relative"
       :class="[
         post.isBanned ? 'border-red-200 bg-red-50/30' : 'border-teal-100/50',
         post.isPinned ? 'ring-2 ring-amber-200/60' : '',
         post.isFeatured ? 'ring-2 ring-teal-200/60' : ''
       ]">
    <!-- Subtle hover glow -->
    <div class="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[24px]"></div>
    
    <!-- Tags Row -->
    <div v-if="post.isPinned || post.isFeatured || post.isHot || post.isBanned" class="flex flex-wrap gap-1.5 relative z-10 -mb-0.5">
      <span v-if="post.isPinned" class="inline-flex items-center gap-1 px-2 py-[3px] bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[10px] font-black tracking-widest">
        <i class="fa-solid fa-thumbtack text-[8px]"></i> 置顶
      </span>
      <span v-if="post.isFeatured" class="inline-flex items-center gap-1 px-2 py-[3px] bg-teal-50 text-teal-600 border border-teal-200 rounded-lg text-[10px] font-black tracking-widest">
        <i class="fa-solid fa-gem text-[8px]"></i> 加精
      </span>
      <span v-if="post.isHot" class="inline-flex items-center gap-1 px-2 py-[3px] bg-gradient-to-r from-orange-50 to-red-50 text-red-500 border border-red-200 rounded-lg text-[10px] font-black tracking-widest animate-pulse">
        <i class="fa-solid fa-fire text-[9px]"></i> 爆
      </span>
      <span v-if="post.isBanned" class="inline-flex items-center gap-1 px-2 py-[3px] bg-red-100 text-red-600 border border-red-300 rounded-lg text-[10px] font-black tracking-widest">
        <i class="fa-solid fa-ban text-[8px]"></i> 封禁
      </span>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between relative z-10">
      <div class="flex items-center gap-2">
        <img :src="post.avatar" alt="avatar" class="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 shadow-sm object-cover">
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-[14px] font-bold text-slate-800 tracking-wide">{{ post.authorName }}</span>
            <span v-if="post.isChar" class="px-1 py-[1px] bg-violet-50 text-violet-500 border border-violet-200 rounded text-[8px] font-black tracking-widest">角色</span>
          </div>
          <span class="text-[10px] text-slate-400 font-medium">{{ formatTime(post.timestamp) }}</span>
        </div>
      </div>
      <div v-if="post.authorId && post.authorId.startsWith && post.authorId.startsWith('u')" class="px-2 py-[2px] bg-gradient-to-r from-teal-500 to-emerald-400 text-white rounded-md text-[9px] font-bold tracking-widest shadow-sm">
        楼主
      </div>
    </div>

    <!-- Content Preview -->
    <div class="relative z-10 mt-1">
      <h3 class="font-black text-[16px] mb-1.5 leading-snug tracking-wide group-hover:text-teal-700 transition-colors"
          :class="[
            post.isFeatured ? 'text-teal-700' : post.isHot ? 'text-orange-700' : post.isBanned ? 'text-red-400 line-through' : 'text-slate-800'
          ]">{{ post.title }}</h3>
      <p class="text-[13px] text-slate-600 line-clamp-3 leading-relaxed markdown-preview tracking-wide" v-html="previewContent"></p>
    </div>

    <!-- Footer Stats -->
    <div class="flex items-center justify-between mt-2.5 text-slate-400 border-t border-slate-50 pt-3 relative z-10">
      <div class="flex gap-5">
        <div class="flex items-center gap-1.5 transition-all cursor-pointer group/btn active:scale-90" 
             :class="isLiked ? 'text-rose-500' : 'hover:text-rose-400'"
             @click.stop="$emit('toggle-like', post.id)">
          <i :class="isLiked ? 'fa-solid fa-heart text-xs animate-like-pop' : 'fa-regular fa-heart text-xs'" class="pb-[1px]"></i>
          <span class="text-xs font-bold">{{ post.likes }}</span>
        </div>
        <div class="flex items-center gap-1.5 hover:text-teal-500 transition-colors cursor-pointer group/btn">
          <i class="fa-regular fa-comment text-xs group-hover/btn:text-teal-500 pb-[1px]"></i>
          <span class="text-xs font-bold">{{ commentCount }}</span>
        </div>
      </div>
      <button class="flex items-center gap-1.5 hover:text-teal-500 transition-colors cursor-pointer group/btn" @click.stop="$emit('share')">
        <i class="fa-solid fa-share-nodes text-xs group-hover/btn:text-teal-500"></i>
        <span class="text-xs font-bold">分享</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  commentCount: {
    type: Number,
    default: 0
  },
  isLiked: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['share', 'toggle-like'])

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const previewContent = computed(() => {
  let text = props.post.content || '';
  text = text.replace(/!\[.*?\]\((.*?)\)/g, '<span class="text-teal-500 text-xs font-bold tracking-widest ml-1 bg-teal-50 px-1 rounded"> [图片] </span>');
  return text;
});
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@keyframes likePop {
  0% { transform: scale(1); }
  30% { transform: scale(1.4); }
  50% { transform: scale(0.9); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.animate-like-pop {
  animation: likePop 0.4s ease-out;
}
</style>
