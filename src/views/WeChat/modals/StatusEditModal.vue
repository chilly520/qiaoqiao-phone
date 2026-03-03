<template>
    <!-- Status Edit Modal -->
    <div v-if="visible" class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 animate-fade-in">
        <div class="bg-white w-full max-w-[300px] rounded-2xl overflow-hidden shadow-2xl animate-scale-in" @click.stop>
            <div class="p-6">
                <div class="text-center font-bold text-lg text-gray-800 mb-4">编辑对方状态</div>
                <div class="relative mb-6">
                    <input v-model="statusEditInput" type="text"
                        class="w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-[#07c160] transition-all"
                        placeholder="想写啥写啥..." @keyup.enter="save">
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                        {{ statusEditInput?.length || 0 }}/30
                    </div>
                </div>
                <div v-if="!chatData?.isGroup" class="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-xl">
                    <span class="text-sm text-gray-500 ml-2">在线状态</span>
                    <div class="flex bg-gray-200 rounded-lg p-1">
                        <button @click="statusIsOnline = true"
                            class="px-3 py-1 rounded-md text-xs font-bold transition-all"
                            :class="statusIsOnline ? 'bg-[#00df6c] text-white shadow-sm' : 'text-gray-500'">在线</button>
                        <button @click="statusIsOnline = false"
                            class="px-3 py-1 rounded-md text-xs font-bold transition-all"
                            :class="!statusIsOnline ? 'bg-gray-400 text-white shadow-sm' : 'text-gray-500'">离线</button>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button @click="close"
                        class="flex-1 py-3 rounded-xl font-medium text-gray-500 bg-gray-100 active:bg-gray-200 transition-colors">取消</button>
                    <button @click="save"
                        class="flex-1 py-3 rounded-xl font-medium text-white bg-[#07c160] active:bg-[#06ad56] shadow-sm transition-colors">确定</button>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { useChatStore } from '../../../stores/chatStore'

const props = defineProps({
    visible: Boolean,
    chatData: Object
})

const emit = defineEmits(['update:visible', 'toast'])
const chatStore = useChatStore()
const statusEditInput = ref('')
const statusIsOnline = ref(true)

watch(() => props.visible, (newVal) => {
    if (newVal) {
        statusEditInput.value = props.chatData?.customStatus || ''
        statusIsOnline.value = props.chatData?.isOnline !== false
    }
})

const close = () => {
    emit('update:visible', false)
}

const save = () => {
    if (!props.chatData) return
    const text = statusEditInput.value.slice(0, 30) // max length constraint
    chatStore.updateCharacter(props.chatData.id, {
        customStatus: text,
        isOnline: statusIsOnline.value
    })
    emit('toast', '状态已更新', 'success')
    close()
}
</script>
