<template>
    <!-- Apply Family Card Form Modal -->
    <div v-if="visible" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
            <h3 class="text-lg font-bold text-center mb-6">申请亲属卡</h3>

            <div class="space-y-5">
                <!-- Note Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">申请留言</label>
                    <textarea v-model="familyCardApplyNote"
                        class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：送我一张亲属卡好不好？以后你来管家~" rows="3" maxlength="100"></textarea>
                    <div class="text-xs text-gray-500 mt-1">写下你想要申请亲属卡的理由吧</div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-2">
                    <button @click="close"
                        class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                        取消
                    </button>
                    <button @click="confirm"
                        class="flex-1 bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                        :disabled="!familyCardApplyNote.trim()">
                        发送申请
                    </button>
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
    chatId: String
})

const emit = defineEmits(['update:visible', 'toast', 'applied'])
const chatStore = useChatStore()
const familyCardApplyNote = ref('送我一张亲属卡好不好？以后你来管家~')

watch(() => props.visible, (newVal) => {
    if (newVal) {
        familyCardApplyNote.value = '送我一张亲属卡好不好？以后你来管家~'
    }
})

const close = () => {
    emit('update:visible', false)
}

const confirm = () => {
    if (!familyCardApplyNote.value.trim()) return

    chatStore.addMessage(props.chatId, {
        role: 'user',
        type: 'familyCardApply',
        content: `[申请亲属卡] ${familyCardApplyNote.value}`,
        note: familyCardApplyNote.value,
        status: 'pending' // pending -> approved -> rejected
    })

    emit('toast', '已发送亲属卡申请，等待对方答复', 'success')
    emit('applied')
    close()
}
</script>
