<template>
  <div class="offline-input-shell" @contextmenu.prevent>
    <div class="offline-toolbar no-scrollbar">
      <button class="toolbar-icon" @click.stop="$emit('toggle-panel')" title="更多功能">
        <i class="fa-solid fa-plus"></i>
      </button>
      <button class="toolbar-icon" @click.stop="$emit('toggle-emoji')" title="表情">
        <i class="fa-regular fa-face-smile"></i>
      </button>
      <button class="toolbar-icon" :class="{ active: musicVisible }" @click.stop="$emit('toggle-music')" title="音乐">
        <i class="fa-solid fa-music"></i>
      </button>
      <button class="toolbar-icon" :class="{ active: searchEnabled }" @click.stop="$emit('toggle-search')" title="联网搜索">
        <i class="fa-solid fa-globe"></i>
      </button>
      <button class="toolbar-icon" :class="{ active: settingsStore.isOfflineMode }" @click="toggleOfflineMode" title="切换模式">
        <i :class="settingsStore.isOfflineMode ? 'fa-solid fa-moon' : 'fa-regular fa-moon'"></i>
      </button>
      <button class="toolbar-icon" @click.stop="$emit('regenerate')" title="重新生成">
        <i class="fa-solid fa-rotate-right"></i>
      </button>
      <button class="toolbar-icon" @click.stop="$emit('request-phone')" title="查手机申请">
        <i class="fa-solid fa-mobile-screen-button"></i>
      </button>
      <button
        v-if="showScrollToBottom"
        class="toolbar-icon active animate-bounce-subtle"
        @click="$emit('scroll-to-bottom')"
        title="回到底部"
      >
        <i class="fa-solid fa-angles-down"></i>
      </button>
    </div>

    <div class="offline-input-row">
      <button class="voice-btn" @click="toggleVoiceMode" :title="isVoiceMode ? '切换键盘输入' : '切换语音输入'">
        <i class="fa-solid" :class="isVoiceMode ? 'fa-keyboard' : 'fa-microphone'"></i>
      </button>

      <div class="input-pill" :class="{ voice: isVoiceMode }">
        <textarea
          ref="textareaRef"
          v-model="inputVal"
          class="input-textarea no-scrollbar"
          rows="1"
          :disabled="isDisabled"
          :placeholder="isVoiceMode ? '按住说话...' : '回复他，或者做点什么...'"
          @keydown.enter.prevent="handleSend"
          @input="handleInput"
          style="max-height: 96px; overflow-y: auto;"
        ></textarea>
      </div>

      <button
        v-if="isTyping"
        class="send-btn stop-btn"
        @click="$emit('stop-generate')"
        title="停止生成"
      >
        <i class="fa-solid fa-square text-[11px]"></i>
      </button>

      <button
        v-else
        class="send-btn"
        :class="{ disabled: isDisabled }"
        @click="handleSend"
        :title="inputVal.trim() ? '发送' : '生成回复'"
      >
        <i class="fa-solid" :class="inputVal.trim() ? 'fa-paper-plane' : 'fa-wand-magic-sparkles'"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { useSettingsStore } from '../../../stores/settingsStore'

const settingsStore = useSettingsStore()

const props = defineProps({
  currentQuote: Object,
  chatData: Object,
  isTyping: Boolean,
  musicVisible: Boolean,
  searchEnabled: Boolean,
  showScrollToBottom: Boolean
})

const emit = defineEmits([
  'send', 'generate', 'stop-generate',
  'toggle-panel', 'toggle-emoji', 'toggle-music', 'toggle-search', 'regenerate',
  'cancel-quote', 'scroll-to-bottom', 'at-member', 'toggle-offline-mode'
])

const inputVal = ref('')
const isVoiceMode = ref(false)
const textareaRef = ref(null)

const toggleOfflineMode = () => {
  emit('toggle-offline-mode')
}

const toggleVoiceMode = () => {
  isVoiceMode.value = !isVoiceMode.value
}

const handleInput = () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 96)}px`
}

const handleSend = () => {
  const raw = inputVal.value.trim()
  if (!raw) {
    emit('generate')
    return
  }

  emit('send', { type: isVoiceMode.value ? 'voice' : 'text', content: raw })
  inputVal.value = ''
  nextTick(() => handleInput())
}

const isDisabled = computed(() => props.chatData?.isExited || props.chatData?.isDissolved)

defineExpose({
  insertText: (text) => {
    inputVal.value += text
    nextTick(() => {
      handleInput()
      textareaRef.value?.focus()
    })
  },
  setInput: (val) => {
    inputVal.value = val
    handleInput()
  }
})
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.offline-input-shell {
  padding-top: 2px;
}

.offline-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  padding: 0 4px 6px;
}

.toolbar-icon {
  color: rgba(94, 109, 128, 0.92);
  font-size: 17px;
  line-height: 1;
  flex: 0 0 auto;
  transition: transform 0.16s ease, color 0.16s ease;
}

.toolbar-icon:active {
  transform: scale(0.9);
}

.toolbar-icon.active {
  color: #e884ac;
}

.offline-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.voice-btn {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8c9bb0;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.1);
  transition: transform 0.16s ease;
}

.voice-btn:active,
.send-btn:active {
  transform: scale(0.94);
}

.input-pill {
  flex: 1;
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 8px 20px rgba(148, 163, 184, 0.1);
}

.input-pill.voice {
  background: rgba(253, 248, 250, 0.96);
}

.input-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #536273;
  font-size: 14px;
  line-height: 1.5;
  padding: 0;
}

.input-textarea::placeholder {
  color: #98a4b4;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #ffc98f, #f495ba);
  box-shadow: 0 8px 18px rgba(243, 120, 177, 0.18);
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.stop-btn {
  background: linear-gradient(135deg, #ff8a8a, #ef5d5d);
  box-shadow: 0 8px 18px rgba(239, 93, 93, 0.15);
}

.send-btn.disabled {
  opacity: 0.45;
  filter: grayscale(1);
  pointer-events: none;
}

@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.animate-bounce-subtle {
  animation: bounce-subtle 2s infinite ease-in-out;
}
</style>
