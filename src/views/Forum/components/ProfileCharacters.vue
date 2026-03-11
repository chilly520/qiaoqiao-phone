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
          <div v-for="c in chatList" :key="c.id" 
               :class="['flex items-center gap-3 p-2.5 bg-white border rounded-[14px] transition-all shadow-sm cursor-pointer', 
                         selectedChars.includes(c.id) ? 'border-teal-300 bg-teal-50/30' : 'border-slate-100 hover:border-teal-200']">
            <div class="flex items-center justify-center">
              <input type="checkbox" :value="c.id" v-model="selectedChars" 
                     @change="updateBoundChars" 
                     class="w-5 h-5 rounded border-2 border-slate-300 text-teal-500 focus:ring-teal-400 focus:ring-2 cursor-pointer">
            </div>
            <img :src="c.avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed='+c.name" 
                 class="w-8 h-8 rounded-full border border-slate-100/50 shadow-sm object-cover">
            <div class="flex-1 min-w-0">
              <span class="text-[14px] font-bold text-slate-800 tracking-wide block truncate">{{c.name}}</span>
            </div>
            <!-- Activity Level Selector (only for bound chars) -->
            <select v-if="selectedChars.includes(c.id)" 
                    v-model="charActivityMap[c.id]"
                    @change="updateCharActivity(c.id, charActivityMap[c.id])"
                    @click.stop
                    class="text-xs bg-white border border-teal-300 rounded-full px-2.5 py-1.5 text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium shadow-sm">
              <option value="high">🔥 高活跃</option>
              <option value="medium">💬 中活跃</option>
              <option value="low">🌙 低活跃</option>
            </select>
          </div>
          <div v-if="chatList.length === 0" class="text-xs text-center text-slate-400 py-3">
            通讯录空空如也~
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useForumStore } from '@/stores/forumStore'
import { useChatStore } from '@/stores/chatStore'

const forumStore = useForumStore()
const chatStore = useChatStore()

const chatList = computed(() => Object.values(chatStore.chats))

// Local state for selected chars and activity levels
const selectedChars = ref([...forumStore.boundCharIds])
const charActivityMap = ref({})

// Initialize activity map from chat store
const initActivityMap = () => {
  Object.values(chatStore.chats).forEach(char => {
    if (forumStore.boundCharIds.includes(char.id)) {
      charActivityMap.value[char.id] = char.forumActivity || 'medium'
    }
  })
}

// Initialize on mount
initActivityMap()

// Update bound chars when checkbox changes
const updateBoundChars = () => {
  forumStore.boundCharIds = [...selectedChars.value]
  forumStore.saveStore()
}

// Update char activity in chat store
const updateCharActivity = (charId, activity) => {
  const chat = chatStore.chats[charId]
  if (chat) {
    chat.forumActivity = activity
    chatStore.saveStore()
    console.log(`✅ Updated ${chat.name} forum activity to ${activity}`)
  }
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
