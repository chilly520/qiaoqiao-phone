<template>
  <div class="profile-subpage bg-[#f4f9f9] min-h-screen animate-fade-in">
    <!-- Header -->
    <header class="bg-white/90 backdrop-blur-xl border-b border-teal-100/50 px-4 pt-10 pb-3 sticky top-0 z-30 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="$emit('back')" class="w-9 h-9 rounded-2xl bg-teal-50 hover:bg-teal-100 flex items-center justify-center text-lg active:scale-90 transition-all border border-teal-100/50 text-teal-600">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h1 class="text-[17px] font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-shield-halved text-amber-500 text-sm"></i> 版务管理
        </h1>
      </div>
    </header>

    <!-- Content -->
    <main class="p-4">
      <!-- Moderator Info -->
      <div class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-amber-100/50 mb-4">
        <h3 class="font-black text-slate-800 text-[16px] mb-1 flex items-center gap-2">
          <i class="fa-solid fa-shield-halved text-amber-500 text-sm"></i> 版主信息
        </h3>
        <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">每个板块有独立的版主和管理员团队</p>

        <!-- Moderator -->
        <div class="text-[10px] font-bold text-amber-500 tracking-widest mb-2 px-1">🛡️ 版主</div>
        <div class="p-3 bg-amber-50/50 border border-amber-100 rounded-[16px] mb-3">
          <div class="flex items-center gap-3">
            <img :src="currentModData.moderatorAvatar" 
                 class="w-10 h-10 rounded-full border-2 border-amber-200 shadow-sm object-cover bg-white">
            <div class="flex-1 min-w-0">
              <div class="font-bold text-amber-800 text-[14px] truncate">{{ currentModData.moderatorName }}</div>
              <div class="text-[10px] text-amber-500 font-medium">{{ currentModData.moderatorAltId ? '玩家版主' : 'NPC 版主 (AI 管理)' }}</div>
            </div>
            <span class="px-2 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black tracking-widest border border-amber-200">版主</span>
          </div>
        </div>

        <!-- Admins -->
        <div class="text-[10px] font-bold text-indigo-400 tracking-widest mb-2 px-1">👮 管理员</div>
        <div class="space-y-2 mb-4">
          <div v-for="(admin, idx) in (currentModData.admins || [])" :key="idx" 
               class="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-[14px]">
            <div class="flex items-center gap-2.5">
              <img :src="admin.avatar" 
                   class="w-8 h-8 rounded-full border border-indigo-200 shadow-sm object-cover bg-white">
              <div class="flex-1 min-w-0">
                <div class="font-bold text-indigo-700 text-[13px] truncate">{{ admin.name }}</div>
                <div class="text-[10px] text-indigo-400 font-medium">{{ admin.altId ? '玩家管理员' : 'NPC 管理员' }}</div>
              </div>
              <span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-500 rounded text-[9px] font-black tracking-widest border border-indigo-200">管理</span>
            </div>
          </div>
        </div>

        <!-- Apply / Resign Buttons -->
        <div class="flex gap-2 mb-4">
          <button v-if="!forumStore.isUserModerator" 
                  @click="$emit('apply-mod')" 
                  class="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-[16px] font-bold text-[13px] shadow-lg shadow-amber-500/20 active:scale-95 transition-all tracking-wider flex items-center justify-center gap-2">
            <i class="fa-solid fa-gavel"></i> 申请成为版主
          </button>
          <button v-else 
                  @click="$emit('resign-mod')" 
                  class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[16px] font-bold text-[13px] active:scale-95 transition-all tracking-wider flex items-center justify-center gap-2">
            <i class="fa-solid fa-right-from-bracket"></i> 卸任版主
          </button>
        </div>

        <!-- Banned Users List -->
        <div v-if="currentModData.bannedUsers.length > 0">
          <div class="text-[11px] font-bold text-red-400 tracking-widest mb-2 px-1 flex items-center gap-1">
            <i class="fa-solid fa-user-slash text-[9px]"></i> 封号名单 ({{ currentModData.bannedUsers.length }})
          </div>
          <div class="space-y-1.5">
            <div v-for="name in currentModData.bannedUsers" :key="name" 
                 class="flex items-center justify-between p-2 bg-red-50 border border-red-100 rounded-xl">
              <div class="flex items-center gap-2">
                <img :src="'https://api.dicebear.com/7.x/notionists/svg?seed=' + name" 
                     class="w-6 h-6 rounded-full bg-white">
                <span class="text-[13px] font-bold text-red-600">{{ name }}</span>
              </div>
              <button v-if="forumStore.isUserStaff" 
                      @click="$emit('unban-user', name)" 
                      class="px-2 py-1 bg-white text-green-500 rounded-lg text-[10px] font-bold border border-green-200 hover:bg-green-50 transition-colors">
                <i class="fa-solid fa-lock-open mr-1"></i>解封
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-slate-300 text-sm">
          <i class="fa-solid fa-peace text-xl mb-2 block"></i>
          暂无封号用户，世界和平~
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useForumStore } from '@/stores/forumStore'

const forumStore = useForumStore()

const currentModData = computed(() => {
  if (!forumStore.currentForumId) return { moderatorName: 'NPC', moderatorAvatar: '', moderatorAltId: null, bannedUsers: [] }
  return forumStore.getModeratorData(forumStore.currentForumId)
})

defineEmits(['apply-mod', 'resign-mod', 'unban-user'])
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
