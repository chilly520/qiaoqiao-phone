<template>
  <div class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center" @click.self="$emit('close')">
    <div class="bg-white w-[90%] max-w-md h-[80vh] rounded-xl flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-lg">选择头像框</h3>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>
      
      <!-- Toolbar -->
      <div class="p-3 border-b flex gap-2 flex-wrap">
        <button class="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors" @click="uploadFrame">
          <i class="fa-solid fa-upload mr-1"></i>本地上传
        </button>
        <button class="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors" @click="showUrlInput = !showUrlInput">
          <i class="fa-solid fa-link mr-1"></i>URL上传
        </button>
        <button class="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors" @click="frameStore.exportFrames()">
          <i class="fa-solid fa-file-export mr-1"></i>导出库
        </button>
        <button class="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors" @click="importFrames">
          <i class="fa-solid fa-file-import mr-1"></i>导入库
        </button>
      </div>
      
      <!-- URL Input -->
      <div v-if="showUrlInput" class="p-3 border-b flex gap-2 animate-fade-in">
        <input v-model="urlInput" type="text" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="输入头像框URL">
        <button class="text-xs bg-blue-500 text-white px-4 rounded-lg hover:bg-blue-600" @click="addFromUrl">添加</button>
      </div>
      
      <!-- Frame Grid -->
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div class="grid grid-cols-4 gap-3">
          <!-- No Frame Option -->
          <div class="aspect-square border-2 rounded-lg cursor-pointer flex items-center justify-center bg-white hover:bg-gray-50 transition-colors" 
               :class="!modelValue ? 'border-blue-500 bg-blue-50' : 'border-gray-200'"
               @click="selectFrame(null)">
            <i class="fa-solid fa-ban text-gray-400 text-xl"></i>
          </div>
          
          <!-- Frames -->
          <div v-for="frame in frameStore.frames" :key="frame.id" 
               class="aspect-square border-2 rounded-lg cursor-pointer overflow-hidden relative group bg-white hover:shadow-md transition-all"
               :class="modelValue?.id === frame.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'"
               @click="selectFrame(frame)">
            <img :src="frame.url" class="w-full h-full object-cover" :title="frame.name">
            <button class="absolute top-1 right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600" 
                    @click.stop="deleteFrame(frame.id)">
              <i class="fa-solid fa-trash text-[10px]"></i>
            </button>
          </div>
        </div>
        
        <div v-if="frameStore.frames.length === 0" class="text-center text-gray-400 py-8">
          暂无头像框，请先导入或上传
        </div>
      </div>
      
      <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileUpload">
      <input type="file" ref="importInput" class="hidden" accept=".json" @change="handleImport">
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAvatarFrameStore } from '../stores/avatarFrameStore'
import { useChatStore } from '../stores/chatStore'

const props = defineProps({
  modelValue: Object
})
const emit = defineEmits(['update:modelValue', 'close'])

const frameStore = useAvatarFrameStore()
const chatStore = useChatStore()
const fileInput = ref(null)
const importInput = ref(null)
const showUrlInput = ref(false)
const urlInput = ref('')

function selectFrame(frame) {
  emit('update:modelValue', frame)
  emit('close')
}

function uploadFrame() {
  fileInput.value.click()
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      frameStore.addFrame({ url: ev.target.result })
      chatStore.triggerToast('✨ 头像框已添加', 'success')
    }
    reader.readAsDataURL(file)
  }
}

function addFromUrl() {
  if (urlInput.value) {
    frameStore.addFrame({ url: urlInput.value })
    chatStore.triggerToast('✨ 头像框已添加', 'success')
    urlInput.value = ''
    showUrlInput.value = false
  } else {
    chatStore.triggerToast('请输入URL', 'warning')
  }
}

function importFrames() {
  importInput.value.click()
}

async function handleImport(e) {
  const file = e.target.files[0]
  if (file) {
    try {
      const count = await frameStore.importFrames(file)
      chatStore.triggerToast(`✨ 成功导入 ${count} 个头像框`, 'success')
    } catch (err) {
      chatStore.triggerToast('❌ ' + err, 'error')
    }
  }
}

function deleteFrame(frameId) {
  if (confirm('确定删除此头像框？')) {
    frameStore.deleteFrame(frameId)
    chatStore.triggerToast('🗑️ 已删除', 'success')
  }
}
</script>
