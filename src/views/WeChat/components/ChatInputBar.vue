<template>
    <div class="bg-[#f7f7f7] border-t border-[#dcdcdc] relative z-20" @contextmenu.prevent>
        <!-- Reply Bar Overlay -->
        <div v-if="currentQuote"
            class="absolute bottom-full left-0 right-0 mb-0 bg-white shadow-sm border-t border-gray-100 p-3 flex justify-between items-center z-30">
            <div class="text-sm text-gray-700 truncate max-w-[85%] border-l-4 border-gray-300 pl-2">
                <span class="font-medium text-gray-900">{{ currentQuote.role === 'user' ? '我' : (chatData.name || '对方')
                    }}:</span>
                {{ currentQuote.content }}
            </div>
            <button @click="$emit('cancel-quote')" class="text-gray-400 hover:text-gray-600">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <!-- Row 1: Function Toolbar -->
        <div
            class="flex items-center px-4 pt-2 pb-1 gap-4 text-[#4a4a4a] text-[18px] select-none overflow-x-auto no-scrollbar">
            <!-- Plus (Panel Toggle) -->
            <i class="fa-solid fa-circle-plus cursor-pointer hover:text-gray-800 transition-colors"
                @click="$emit('toggle-panel')" title="更多功能"></i>

            <!-- Emoji -->
            <i class="fa-regular fa-face-smile cursor-pointer hover:text-gray-800 transition-colors"
                @click.stop="$emit('toggle-emoji')" title="表情"></i>



            <!-- Regenerate -->
            <i class="fa-solid fa-rotate-right cursor-pointer hover:text-blue-500 transition-colors"
                @click="$emit('regenerate')" title="重新生成"></i>

            <!-- Music -->
            <i class="fa-solid fa-music cursor-pointer hover:text-yellow-600 transition-colors"
                :class="{ 'text-yellow-500': musicVisible }" @click="$emit('toggle-music')" title="音乐 (一起听歌)"></i>

            <!-- Web Search -->
            <i class="fa-solid fa-globe cursor-pointer hover:text-blue-600 transition-colors"
                :class="{ 'text-blue-500': searchEnabled }" @click="$emit('toggle-search')" title="联网搜索"></i>

            <!-- Current Location (Manual) -->
            <i class="fa-solid fa-location-dot cursor-pointer hover:text-green-600 transition-colors"
                @click="settingsStore.showLocationInput = true" title="当前位置"></i>
        </div>

        <!-- Row 2: Input Box + Actions -->
        <div class="flex items-end px-3 pb-3 pt-1 gap-2">
            <!-- Voice Toggle -->
            <button
                class="mb-1 text-[#2e2e2e] text-[22px] hover:text-gray-600 transition-colors w-[28px] flex justify-center"
                @click="toggleVoiceMode" :title="isVoiceMode ? '切换到文字模式' : '切换到语音模式'">
                <i class="fa-solid transition-all"
                    :class="isVoiceMode ? 'fa-keyboard text-cyan-400' : 'fa-microphone'"></i>
            </button>

            <!-- Input Wrapper -->
            <div class="flex-1 bg-white rounded-lg border border-gray-300 flex items-center min-h-[38px] px-3 py-2 shadow-sm"
                :class="isVoiceMode ? 'border-blue-400' : ''">
                <textarea v-model="inputVal"
                    class="w-full bg-transparent border-none focus:ring-0 resize-none outline-none text-[15px] leading-[22px] text-gray-800 placeholder-gray-400"
                    rows="1" :placeholder="isVoiceMode ? '输入文字，发送后将以语音形式显示...' : '发送消息...'"
                    @keydown.enter.prevent="handleSend" @input="handleAutoResize" ref="textareaRef"
                    style="max-height: 66px; overflow-y: auto;"></textarea>
            </div>

            <!-- Stop Btn (When Typing) -->
            <button v-if="isTyping"
                class="mb-1 text-white bg-red-500 rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-red-600 transition-all active:scale-95 shadow-sm"
                @click="$emit('stop-generate')" title="停止生成">
                <i class="fa-solid fa-square text-[10px]"></i>
            </button>

            <!-- Generate Btn -->
            <button v-else-if="!inputVal.trim()"
                class="mb-1 text-white bg-[#07c160] rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-[#06ad56] transition-all active:scale-95 shadow-sm"
                @click="$emit('generate')">
                <i class="fa-solid fa-wand-magic-sparkles text-[13px]"></i>
            </button>

            <!-- Send Btn -->
            <button v-else
                class="mb-1 text-white bg-[#07c160] rounded-full w-[34px] h-[34px] flex items-center justify-center hover:bg-[#06ad56] transition-all active:scale-95 shadow-sm"
                @click="handleSend">
                <i class="fa-solid fa-paper-plane text-[13px]"></i>
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useSettingsStore } from '../../../stores/settingsStore'

const settingsStore = useSettingsStore()

const props = defineProps({
    currentQuote: Object,
    chatData: Object,
    isTyping: Boolean,
    musicVisible: Boolean,
    searchEnabled: Boolean
})

const emit = defineEmits([
    'send', 'generate', 'stop-generate',
    'toggle-panel', 'toggle-emoji', 'toggle-music', 'toggle-search', 'regenerate',
    'cancel-quote'
])

const inputVal = ref('')
const isVoiceMode = ref(false)
const textareaRef = ref(null)

const toggleVoiceMode = () => {
    isVoiceMode.value = !isVoiceMode.value
    // We could emit this state if parent needs it, but keeping it local is simpler for now
}

const handleAutoResize = () => {
    if (!textareaRef.value) return
    textareaRef.value.style.height = 'auto'
    const scrollHeight = textareaRef.value.scrollHeight
    textareaRef.value.style.height = Math.min(scrollHeight, 66) + 'px'
}

const handleSend = () => {
    const raw = inputVal.value.trim()
    if (!raw) return

    let content = raw
    let type = 'text'

    if (isVoiceMode.value) {
        type = 'voice'
    } else {
        // Draw Command Interception
        if (content.toLowerCase().startsWith('/draw ')) {
            const prompt = content.substring(6).trim()
            content = `[DRAW: ${prompt}]`
        }
    }

    emit('send', {
        type,
        content,
        isVoice: isVoiceMode.value
    })

    inputVal.value = ''
    nextTick(() => {
        handleAutoResize()
    })
}

// Expose methods for parent to manipulate input (e.g. Emoji Picker)
defineExpose({
    insertText: (text) => {
        inputVal.value += text
        nextTick(() => {
            if (textareaRef.value) textareaRef.value.focus()
            handleAutoResize()
        })
    },
    focus: () => {
        if (textareaRef.value) textareaRef.value.focus()
    },
    clear: () => {
        inputVal.value = ''
        handleAutoResize()
    },
    // For voice recognition script in parent if it exists
    setInput: (val) => {
        inputVal.value = val
        handleAutoResize()
    }
})
</script>

<style scoped>
.fa-globe.text-blue-500 {
    animation: pulse-blue 2s infinite;
}

@keyframes pulse-blue {
    0% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.1);
        opacity: 0.8;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

/* Hide scrollbar for functionality toolbar */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
