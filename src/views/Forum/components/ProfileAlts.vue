<template>
  <div class="profile-subpage bg-[#f4f9f9] min-h-screen animate-fade-in">
    <!-- Header -->
    <header class="bg-white/90 backdrop-blur-xl border-b border-teal-100/50 px-4 pt-10 pb-3 sticky top-0 z-30 shadow-sm">
      <div class="flex items-center gap-3">
        <button @click="$emit('back')" class="w-9 h-9 rounded-2xl bg-teal-50 hover:bg-teal-100 flex items-center justify-center text-lg active:scale-90 transition-all border border-teal-100/50 text-teal-600">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h1 class="text-[17px] font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-masks-theater text-indigo-400"></i> 我的马甲衣橱
        </h1>
      </div>
    </header>

    <!-- Content -->
    <main class="p-4">
      <div class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-[#e8f3f3]">
        <div class="flex justify-between items-center mb-5">
          <h3 class="font-black text-slate-800 text-[16px] flex items-center gap-2">
            <i class="fa-solid fa-masks-theater text-indigo-400"></i> 马甲列表
          </h3>
          <button @click="$emit('add-alt')" class="w-[34px] h-[34px] rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100 flex items-center justify-center transition-colors shadow-sm">
            <i class="fa-solid fa-plus mt-[1px]"></i>
          </button>
        </div>
        
        <div class="flex flex-col gap-3">
          <div v-for="alt in forumStore.alts" :key="alt.id" 
               class="p-3 bg-white border border-slate-100 rounded-[18px] flex items-center gap-3 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
            <!-- Selector highlighting current alt -->
            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-teal-300 to-emerald-400 opacity-0 transition-opacity" 
                 :class="{'opacity-100': forumStore.currentAltId === alt.id}"></div>
            
            <img :src="alt.avatar" 
                 class="w-12 h-12 rounded-full border border-slate-100 shadow-sm bg-slate-50 object-cover ml-1">
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5">
                <h4 class="font-bold text-slate-800 text-[14px] truncate">{{ alt.name }}</h4>
                <span v-if="alt.isRealUser" class="bg-rose-50 text-rose-500 border border-rose-100 text-[9px] px-1.5 py-[2px] rounded-md font-bold uppercase tracking-widest leading-none pointer-events-none self-center">实名守护</span>
              </div>
              <div class="text-[11px] text-slate-500 truncate font-medium flex items-center gap-1.5">
                <span class="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
                {{ alt.role }}
              </div>
            </div>

            <!-- Set Active / Delete -->
            <div class="flex items-center gap-2 mr-1">
              <button v-if="forumStore.currentAltId !== alt.id" 
                      @click="forumStore.currentAltId = alt.id; forumStore.saveStore()" 
                      class="w-[32px] h-[32px] rounded-xl text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-100 flex items-center justify-center transition-all bg-opacity-70" 
                      title="换上此马甲">
                <i class="fa-solid fa-check"></i>
              </button>
              <span v-else class="text-[10px] font-bold text-teal-500 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">使用中</span>

              <button v-if="forumStore.alts.length > 1" 
                      @click="forumStore.removeAlt(alt.id)" 
                      class="w-[32px] h-[32px] rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-transparent flex items-center justify-center transition-all">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { useForumStore } from '@/stores/forumStore'

const forumStore = useForumStore()
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
