<template>
  <div class="profile-subpage bg-[#f4f9f9] min-h-screen animate-fade-in">
    <!-- Header -->
    <header class="bg-white/90 backdrop-blur-xl border-b border-rose-100/50 px-4 pt-10 pb-3 sticky top-0 z-30 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="$emit('back')" class="w-9 h-9 rounded-2xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-lg active:scale-90 transition-all border border-rose-100/50 text-rose-600">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h1 class="text-[17px] font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-heart text-rose-400 text-sm"></i> 我的喜欢
        </h1>
      </div>
    </header>

    <!-- Content -->
    <main class="p-4">
      <div class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-rose-100/50">
        <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
          收藏的美好瞬间，记录每一个心动的时刻~
        </p>
        
        <div v-if="likedPosts.length > 0" class="space-y-3">
          <div v-for="post in likedPosts" :key="post.id" 
               @click="$emit('view-post', post)" 
               class="p-3 bg-rose-50/30 border border-rose-100 rounded-[16px] cursor-pointer hover:bg-rose-50 hover:shadow-md transition-all group">
            <div class="flex items-center gap-2.5 mb-1.5">
              <img :src="post.avatar" class="w-8 h-8 rounded-full border border-rose-100 bg-white object-cover">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-[12px] font-bold text-slate-600 truncate">{{ post.authorName }}</span>
                  <span class="text-[9px] text-rose-400 font-bold bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200">{{ post._forumName }}</span>
                </div>
              </div>
              <span class="text-[10px] text-slate-400">{{ formatTime(post._likedAt) }}</span>
            </div>
            <div class="text-[14px] font-bold text-slate-700 truncate group-hover:text-rose-600 transition-colors mb-2">{{ post.title }}</div>
            <div class="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
              <span class="flex items-center gap-1.5">
                <i class="fa-solid fa-heart text-rose-400 text-[10px]"></i> 
                {{ post.likes }}
              </span>
              <span class="flex items-center gap-1.5">
                <i class="fa-solid fa-comment text-blue-400 text-[10px]"></i> 
                {{ post.comments }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-12">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center">
            <i class="fa-regular fa-heart text-4xl text-rose-300"></i>
          </div>
          <p class="text-slate-400 text-sm mb-2">还没有喜欢的帖子哦~</p>
          <p class="text-slate-300 text-xs">去发现页逛逛吧</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useForumStore } from '@/stores/forumStore'

const forumStore = useForumStore()

const emit = defineEmits(['back', 'view-post'])

const likedPosts = computed(() => forumStore.getMyLikedPosts)

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
