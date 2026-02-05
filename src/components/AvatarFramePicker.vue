<script setup>
import { ref } from 'vue'
import { useAvatarFrameStore } from '../stores/avatarFrameStore'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'

const props = defineProps({
  modelValue: Object
})
const emit = defineEmits(['update:modelValue', 'close'])

const frameStore = useAvatarFrameStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const fileInput = ref(null)
const importInput = ref(null)
const showUrlInput = ref(false)
const urlInput = ref('')
const isDeleteMode = ref(false)

function handleFrameClick(frame) {
  if (isDeleteMode.value) {
    // Delete Mode: Click deletes
    chatStore.triggerConfirm('删除头像框', '确定删除此头像框？', () => {
      frameStore.deleteFrame(frame.id)
      if (props.modelValue?.id === frame.id) {
        emit('update:modelValue', null) // Deselect if deleted
      }
      chatStore.triggerToast('已删除', 'success')
    })
  } else {
    // Normal Mode: Click selects
    emit('update:modelValue', frame)
    emit('close')
  }
}

function selectFrame(frame) {
  if (isDeleteMode.value) return // Disable specific selection in delete mode (except "None" which is safe)
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
</script>

<template>
  <div class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    @click.self="$emit('close')">
    <div class="w-full max-w-md h-[80vh] rounded-[24px] flex flex-col overflow-hidden shadow-2xl transition-all duration-300"
      :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border border-white/10' : 'bg-white'">
      
      <!-- Header -->
      <div class="p-5 border-b flex items-center justify-between transition-colors"
        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
        <h3 class="font-bold text-[18px] tracking-tight" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
          选择头像框
        </h3>
        <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:bg-white/10' : 'text-gray-500'">
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="p-4 border-b flex gap-2 flex-wrap items-center transition-colors"
        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10 bg-white/5' : 'bg-[#f8f9fa] border-gray-100'">
        
        <div class="flex gap-2 w-full mb-2">
            <button class="flex-1 text-xs px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'"
            @click="uploadFrame">
            <i class="fa-solid fa-upload"></i>本地
            </button>
            <button class="flex-1 text-xs px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-100'"
            @click="showUrlInput = !showUrlInput">
            <i class="fa-solid fa-link"></i>URL
            </button>
        </div>

        <div class="flex gap-2 w-full">
            <button class="flex-1 text-xs px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-600 border border-green-100'"
            @click="frameStore.exportFrames()">
            <i class="fa-solid fa-file-export"></i>导出
            </button>
            <button class="flex-1 text-xs px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-600 border border-green-100'"
            @click="importFrames">
            <i class="fa-solid fa-file-import"></i>导入
            </button>
            <button class="flex-1 text-xs px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
            :class="isDeleteMode ? 'bg-red-500 text-white shadow-lg' : (settingsStore.personalization.theme === 'dark' ? 'bg-white/10 text-gray-400 border border-white/10' : 'bg-gray-200 text-gray-600 border border-gray-300')"
            @click="isDeleteMode = !isDeleteMode">
            <i class="fa-solid" :class="isDeleteMode ? 'fa-check' : 'fa-trash'"></i>
            {{ isDeleteMode ? '完成' : '删除' }}
            </button>
        </div>
      </div>

      <!-- URL Input -->
      <Transition name="fade">
        <div v-if="showUrlInput" class="p-4 border-b flex gap-2 transition-colors"
            :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10 bg-black/20' : 'bg-blue-50/30 border-gray-100'">
            <input v-model="urlInput" type="text"
            class="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'"
            placeholder="粘贴头像框 URL 地址..." @keyup.enter="addFromUrl">
            <button class="bg-blue-500 text-white px-5 rounded-xl text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all shadow-lg shadow-blue-500/20" @click="addFromUrl">
            添加
            </button>
        </div>
      </Transition>

      <!-- Frame Grid -->
      <div class="flex-1 overflow-y-auto p-4 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'">
        <div class="grid grid-cols-4 gap-4">
          <!-- No Frame Option -->
          <div
            class="aspect-square border-2 rounded-2xl cursor-pointer flex flex-col items-center justify-center transition-all group relative overflow-hidden"
            :class="[
              !modelValue ? (settingsStore.personalization.theme === 'dark' ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : (settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5 hover:border-white/20' : 'bg-gray-50 border-gray-100 hover:border-gray-200')
            ]" @click="selectFrame(null)">
            <i class="fa-solid fa-ban text-2xl transition-transform group-hover:scale-110" :class="!modelValue ? 'text-blue-500' : 'text-gray-300'"></i>
            <span class="text-[10px] mt-1 font-bold tracking-tight" :class="!modelValue ? 'text-blue-500' : 'text-gray-400'">无框</span>
          </div>

          <!-- Frames -->
          <div v-for="frame in frameStore.frames" :key="frame.id"
            class="aspect-square border-2 rounded-2xl cursor-pointer overflow-hidden relative group transition-all animate-scale-in"
            :class="[
              modelValue?.id === frame.id ? 'border-blue-500 ring-4 ring-blue-500/10' : (settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5 hover:border-white/20' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-lg'),
              isDeleteMode ? 'shake-hover border-red-500/50 scale-95' : ''
            ]" @click="handleFrameClick(frame)">
            
            <img :src="frame.url" class="w-full h-full object-cover transition-transform group-hover:scale-110" :title="frame.name">

            <!-- Selection Indicator -->
            <div v-if="modelValue?.id === frame.id && !isDeleteMode" class="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] shadow-lg animate-scale-in">
                <i class="fa-solid fa-check"></i>
            </div>

            <!-- Delete Overlay (Only in Delete Mode) -->
            <div v-if="isDeleteMode"
              class="absolute inset-0 bg-red-500/40 backdrop-blur-[1px] flex items-center justify-center animate-fade-in">
              <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                 <i class="fa-solid fa-trash text-white text-lg drop-shadow-md"></i>
              </div>
            </div>
          </div>
        </div>

        <div v-if="frameStore.frames.length === 0" class="text-center py-16 flex flex-col items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center" :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5' : ''">
                <i class="fa-solid fa-image-portrait text-3xl opacity-20" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : ''"></i>
            </div>
            <p class="text-sm font-medium opacity-40" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : ''">
                暂无头像框，请先导入或上传
            </p>
        </div>
      </div>

      <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileUpload">
      <input type="file" ref="importInput" class="hidden" accept=".json" @change="handleImport">
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(2deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(-2deg); }
  100% { transform: rotate(0deg); }
}

.shake-hover {
  animation: shake 0.3s ease-in-out infinite;
}

@keyframes scaleIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
