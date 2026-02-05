<template>
  <div class="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" @click="$emit('close')">
    <div class="bg-white w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-scale-up h-[80vh]" @click.stop>
      <!-- Header -->
      <div class="p-5 border-b flex justify-between items-center bg-gradient-to-r from-indigo-50 to-blue-50">
        <div>
          <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
            <i class="fa-solid fa-clock text-indigo-500"></i> 定时任务
          </h3>
          <p class="text-[10px] text-gray-500">AI角色为你设定的未来提醒</p>
        </div>
        <button @click="$emit('close')" class="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        <div v-if="tasks.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-12">
          <i class="fa-solid fa-calendar-check text-5xl mb-4"></i>
          <p class="text-sm">暂无定时任务</p>
          <p class="text-[10px] mt-1 text-center px-8">你可以通过对话让AI设置定时内容，<br/>例如：“明早八点叫我起床”</p>
        </div>

        <div v-for="task in sortedTasks" :key="task.id" 
             class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 transition-all"
             :class="{'opacity-60 grayscale-[0.5]': !task.enabled}">
          
          <!-- Icon -->
          <div class="w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0"
               :class="task.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'">
            <span class="text-[9px] font-bold uppercase">{{ formatDay(task.timestamp) }}</span>
            <span class="text-sm font-black">{{ formatTime(task.timestamp) }}</span>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-0.5">
              <img v-if="getChar(task.chatId)" :src="getChar(task.chatId).avatar" class="w-3.5 h-3.5 rounded-full object-cover">
              <span class="text-[10px] font-bold text-gray-400 truncate">{{ getChar(task.chatId)?.name || '未知角色' }}</span>
            </div>
            <p class="text-sm text-gray-800 font-medium truncate">{{ task.content }}</p>
            <p class="text-[9px] text-gray-400 mt-1">{{ formatFullDate(task.timestamp) }}</p>
          </div>

          <!-- Control -->
          <div class="flex flex-col gap-2">
            <button @click="schedulerStore.toggleTask(task.id)" 
                    class="w-10 h-6 rounded-full relative transition-colors duration-200"
                    :class="task.enabled ? 'bg-emerald-500' : 'bg-gray-200'">
              <div class="absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200"
                   :class="task.enabled ? 'left-5' : 'left-1'"></div>
            </button>
            <button @click="schedulerStore.removeTask(task.id)" class="text-gray-300 hover:text-red-500 transition-colors text-center">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t bg-white">
        <p class="text-[10px] text-gray-400 text-center uppercase tracking-widest">Global Scheduler powered by Chilly OS</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSchedulerStore } from '../../../stores/schedulerStore'
import { useChatStore } from '../../../stores/chatStore'

const emit = defineEmits(['close'])
const schedulerStore = useSchedulerStore()
const chatStore = useChatStore()

const tasks = computed(() => schedulerStore.tasks)
const sortedTasks = computed(() => {
    return [...tasks.value].sort((a, b) => a.timestamp - b.timestamp)
})

const getChar = (chatId) => {
    return chatStore.chats[chatId] || null
}

const formatTime = (ts) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const formatDay = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return '今天'
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    if (d.toDateString() === tomorrow.toDateString()) return '明天'
    return `${d.getMonth() + 1}/${d.getDate()}`
}

const formatFullDate = (ts) => {
    const d = new Date(ts)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
.animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
