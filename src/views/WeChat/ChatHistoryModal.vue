<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" @click.self="close">
    <div class="bg-white rounded-2xl w-[85%] max-w-md shadow-2xl flex flex-col max-h-[70vh] animate-scale-in" @click.stop>
      
      <!-- Header -->
      <div class="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 class="font-bold text-gray-800">编辑历史</h3>
        <button @click="close" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- History List -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        <div v-if="!history || history.length === 0" class="text-center text-gray-400 py-8 text-sm">
           暂无修改记录
        </div>
        
        <div v-for="(h, idx) in history" :key="idx" class="bg-white p-3 rounded-xl border border-gray-200">
           <!-- Meta -->
           <div class="flex justify-between items-center mb-2">
               <span class="text-xs text-gray-400 font-mono">{{ new Date(h.timestamp).toLocaleString() }}</span>
               <span class="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                   {{ h.role === 'user' ? '我' : (h.role === 'ai' ? 'AI' : '系统') }}
               </span>
           </div>
           
           <!-- Content Preview -->
           <div class="text-sm text-gray-800 mb-3 break-all max-h-24 overflow-y-auto bg-gray-50 p-2 rounded border border-gray-100">
               {{ h.content }}
           </div>
           
           <!-- Restore Btn -->
           <button @click="restore(idx)" class="w-full py-1.5 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors border border-green-200 font-medium">
               恢复此版本
           </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useChatStore } from '../../stores/chatStore'

const props = defineProps(['modelValue', 'targetMsgId'])
const emit = defineEmits(['update:modelValue'])

const chatStore = useChatStore()
const history = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

watch(() => props.modelValue, (val) => {
    if (val && props.targetMsgId) {
        init()
    }
})

const init = () => {
    const msgs = chatStore.currentChat.msgs || []
    const msg = msgs.find(m => m.id === props.targetMsgId)
    if (msg && msg.history) {
        history.value = msg.history
    } else {
        history.value = []
    }
}

const restore = (idx) => {
    const msgs = chatStore.currentChat.msgs
    const msg = msgs.find(m => m.id === props.targetMsgId)
    if (!msg || !msg.history || !msg.history[idx]) return

    const targetVersion = msg.history[idx]

    // Push current logic to history
    msg.history.unshift({
        content: msg.content,
        timestamp: Date.now(),
        role: msg.role
    })

    // Apply restore
    msg.content = targetVersion.content
    if (targetVersion.role) msg.role = targetVersion.role
    
    // Check type inference? For now just content.
    // If storing type in history is needed, update save logic first.
    
    chatStore.saveChats()
    close()
    
    // Maybe toast?
}

const close = () => {
    visible.value = false
}
</script>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
