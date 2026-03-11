<template>
  <div class="profile-subpage bg-[#f4f9f9] min-h-screen animate-fade-in">
    <!-- Header -->
    <header class="bg-white/90 backdrop-blur-xl border-b border-teal-100/50 px-4 pt-10 pb-3 sticky top-0 z-30 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="$emit('back')" class="w-9 h-9 rounded-2xl bg-teal-50 hover:bg-teal-100 flex items-center justify-center text-lg active:scale-90 transition-all border border-teal-100/50 text-teal-600">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h1 class="text-[17px] font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-link text-emerald-400 text-sm"></i> 绑定专属角色
        </h1>
      </div>
    </header>

    <!-- Content -->
    <main class="p-4">
      <div class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-[#e8f3f3]">
        <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
          你可以勾选通讯录里的好友加入进来！生成的论坛剧情、话题及吃瓜方向，将大量参考这些角色的聊天记录及人设哦~(支持多选)
        </p>
        
        <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar bg-[#fcfdfd] p-2 rounded-[16px] border border-slate-100 shadow-inner">
          <label v-for="c in chatList" :key="c.id" 
                 class="flex items-center gap-3 p-2.5 bg-white border border-slate-100 rounded-[14px] hover:border-teal-200 cursor-pointer transition-all shadow-sm">
            <div class="relative flex items-center justify-center">
              <input type="checkbox" :value="c.id" v-model="forumStore.boundCharIds" 
                     @change="forumStore.saveStore()" class="peer sr-only">
              <div class="w-5 h-5 rounded flex items-center justify-center border-2 border-slate-200 
                          peer-checked:bg-teal-400 peer-checked:border-teal-400 transition-colors">
                <i class="fa-solid fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100"></i>
              </div>
            </div>
            <img :src="c.avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed='+c.name" 
                 class="w-8 h-8 rounded-full border border-slate-100/50 shadow-sm object-cover">
            <div class="flex-1 min-w-0">
              <span class="text-[14px] font-bold text-slate-800 tracking-wide block truncate">{{c.name}}</span>
            </div>
          </label>
          <div v-if="chatList.length === 0" class="text-xs text-center text-slate-400 py-3">
            通讯录空空如也~
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useForumStore } from '@/stores/forumStore'
import { useChatStore } from '@/stores/chatStore'

const forumStore = useForumStore()
const chatStore = useChatStore()

const chatList = computed(() => Object.values(chatStore.chats))
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>
