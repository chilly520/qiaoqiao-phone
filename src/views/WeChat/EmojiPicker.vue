<template>
  <div class="emoji-picker h-[280px] bg-[#f5f5f5] border-t border-[#dcdcdc] flex flex-col animate-slide-up" @click.stop>
    
    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
      
      <!-- Tab 1: System Emoji -->
      <div v-if="activeTab === 'emoji'" class="grid grid-cols-8 gap-2">
         <div 
            v-for="emoji in simpleEmojiList" 
            :key="emoji"
            class="text-2xl cursor-pointer hover:bg-gray-200 rounded p-1 flex items-center justify-center transition-colors select-none"
            @click="$emit('select-emoji', emoji)"
         >
            {{ emoji }}
         </div>
      </div>

      <!-- Tab 2: Custom Stickers -->
      <div v-else-if="activeTab === 'sticker'">
         <!-- Scope Selector -->
         <div class="flex gap-2 mb-3 bg-white p-1 rounded-lg border border-gray-200">
             <div 
                 class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                 :class="activeScope === 'global' ? 'bg-gray-100 font-bold text-black' : 'text-gray-500 hover:bg-gray-50'"
                 @click="activeScope = 'global'"
             >全局通用</div>
             <div 
                 class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                 :class="activeScope !== 'global' ? 'bg-orange-50 font-bold text-[#ea5f39]' : 'text-gray-500 hover:bg-gray-50'"
                 @click="activeScope = chatStore.currentChatId"
             >{{ chatStore.chats[chatStore.currentChatId]?.name || '当前角色' }}专属</div>
         </div>

         <div class="grid grid-cols-4 gap-4">
           <!-- Add Button -->
          <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition" @click="triggerUpload">
              <i class="fa-solid fa-plus text-gray-400 text-2xl"></i>
              <span class="text-xs text-gray-400 mt-1">添加</span>
          </div>
          
          <!-- Batch Add Button -->
          <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition" @click="showBatchModal = true">
              <i class="fa-solid fa-file-import text-gray-400 text-2xl"></i>
              <span class="text-xs text-gray-400 mt-1">批量</span>
          </div>


          <!-- Sticker List -->
          <div 
            v-for="sticker in displayedStickers" 
            :key="sticker.url"
            class="relative group flex flex-col items-center gap-1"
          >
              <div class="aspect-square w-full bg-white rounded-lg border border-gray-200 cursor-pointer overflow-hidden p-2 relative"
                @click="$emit('select-sticker', sticker)"
                @contextmenu.prevent="handleStickerContext(sticker)"
              >
                  <img :src="sticker.url" class="w-full h-full object-contain">
                  
                  <!-- Visible Delete Button (Top Right) -->
                  <div class="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-500 transition-colors" @click.stop="deleteSticker(sticker.url)">
                      <i v-if="deletingUrl === sticker.url" class="fa-solid fa-check text-white text-[10px]"></i>
                      <i v-else class="fa-solid fa-xmark text-white text-[10px]"></i>
                  </div>
              </div>
              <!-- Sticker Name -->
              <span class="text-[10px] text-gray-500 truncate w-full text-center">{{ deletingUrl === sticker.url ? '确认删除?' : sticker.name }}</span>
          </div>
       </div>
      </div>
      
      <!-- Toast Notification -->
      <div v-if="toastMessage" class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs transition-opacity animate-fade-in z-50">
          {{ toastMessage }}
      </div>

    </div>

    <!-- Bottom Tab Bar -->
    <div class="h-[40px] border-t border-[#e5e5e5] bg-white flex items-center">
        <!-- Emoji Tab -->
        <div 
            class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
            :class="activeTab === 'emoji' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'"
            @click="activeTab = 'emoji'"
        >
            <i class="fa-regular fa-face-smile text-xl" :class="activeTab === 'emoji' ? 'text-[#07c160]' : 'text-gray-500'"></i>
        </div>
        
        <!-- Sticker Tab -->
        <div 
            class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
            :class="activeTab === 'sticker' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'"
            @click="activeTab = 'sticker'"
        >
            <i class="fa-regular fa-heart text-xl" :class="activeTab === 'sticker' ? 'text-[#ea5f39]' : 'text-gray-500'"></i>
        </div>

        <!-- Settings (Optional) -->
        <div class="w-[50px] h-full flex items-center justify-center cursor-pointer border-l border-[#f0f0f0]">
             <i class="fa-solid fa-gear text-gray-400 text-sm"></i>
        </div>
    </div>

    <!-- Hidden Input -->
    <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange">

    <!-- Batch Import Modal -->
    <div v-if="showBatchModal" class="absolute inset-0 bg-white z-50 flex flex-col p-4 animate-fade-in">
        <div class="flex justify-between items-center mb-2">
            <span class="font-bold text-gray-700">批量导入表情包</span>
            <button @click="showBatchModal = false" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div class="text-xs text-gray-500 mb-2">格式：名称：URL (每行一个)</div>
        <textarea 
            v-model="batchInput" 
            class="flex-1 border border-gray-200 rounded p-2 text-xs resize-none outline-none focus:border-green-500 mb-3"
            placeholder="示例：&#10;开心：https://example.com/1.png&#10;难过：https://example.com/2.png"
        ></textarea>
        <button @click="handleBatchImport" class="bg-[#07c160] text-white py-2 rounded font-medium active:bg-[#06ad56]">导入</button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'

defineEmits(['select-emoji', 'select-sticker'])

const stickerStore = useStickerStore()
const chatStore = useChatStore()

const activeTab = ref('emoji')
const activeScope = ref('global') // 'global' or chatId

const fileInput = ref(null)
const showBatchModal = ref(false)
const batchInput = ref('')

const displayedStickers = computed(() => {
    return stickerStore.getStickers(activeScope.value)
})

// Standard Emoji List (Subset)
const simpleEmojiList = [
    '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','​​​​​​😨','😩','🤯','😬','​​​​​​😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','🤧','😇','🤠','🤡','🥳','🥴','🥺','🤥','🤫','🤭','🧐','🤓'
];

const triggerUpload = () => {
    fileInput.value.click()
}

const deletingUrl = ref(null)
const toastMessage = ref('')
const toastTimer = ref(null)

const showToast = (msg) => {
    toastMessage.value = msg
    clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
        toastMessage.value = ''
    }, 2000)
}

const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (file) {
        try {
            await stickerStore.uploadSticker(file, activeScope.value)
            showToast('添加成功')
        } catch (e) {
            console.error(e)
            showToast('添加失败')
        }
        event.target.value = ''
    }
}

const deleteSticker = (url) => {
    if (deletingUrl.value === url) {
        stickerStore.deleteSticker(url, activeScope.value)
        deletingUrl.value = null
        showToast('删除成功')
    } else {
        deletingUrl.value = url
        // Auto reset confirmation after 3s
        setTimeout(() => {
            if (deletingUrl.value === url) deletingUrl.value = null
        }, 3000)
    }
}

const handleStickerContext = (sticker) => {
    // Optional
}

const handleBatchImport = () => {
    if (!batchInput.value.trim()) return
    
    const lines = batchInput.value.split('\n')
    let count = 0
    
    lines.forEach(line => {
        line = line.trim()
        if (!line) return
        
        // Split by standard colon or Chinese colon
        // Use regex to split by first occurrence of : or ：
        const separatorMatch = line.match(/[:：]/)
        
        if (separatorMatch) {
            const separatorIndex = separatorMatch.index
            const name = line.substring(0, separatorIndex).trim()
            const url = line.substring(separatorIndex + 1).trim()
            
            if (url && url.startsWith('http')) {
                const success = stickerStore.addSticker(url, name, activeScope.value)
                if (success) count++
            }
        } else if (line.startsWith('http')) {
            // Unnamed URL check
            const success = stickerStore.addSticker(line, '', activeScope.value) // Store will generate name
            if (success) count++
        }
    })
    
    showToast(`成功导入 ${count} 个表情包`)
    batchInput.value = ''
    showBatchModal.value = false
}
</script>

<style scoped>
.emoji-picker {
    user-select: none;
}
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d1d1;
    border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
