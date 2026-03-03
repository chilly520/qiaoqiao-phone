<template>
    <!-- Send Family Card Form Modal -->
    <div v-if="visible" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
            <h3 class="text-lg font-bold text-center mb-6">赠送亲属卡</h3>

            <div class="space-y-5">
                <!-- Amount Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">设置额度</label>
                    <div class="relative">
                        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">¥
                        </div>
                        <input type="number" v-model="familyCardAmount"
                            class="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00" step="0.01" min="0.01">
                    </div>
                    <div class="text-xs text-gray-500 mt-1">请输入亲属卡额度，最低0.01元</div>
                </div>

                <!-- Note Input -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">备注</label>
                    <input type="text" v-model="familyCardNote"
                        class="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="例如：我的钱就是你的钱">
                    <div class="text-xs text-gray-500 mt-1">给亲属卡起个温馨的名字吧</div>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-2">
                    <button @click="close"
                        class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                        取消
                    </button>
                    <button @click="confirm"
                        class="flex-1 bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
                        :disabled="!familyCardAmount || parseFloat(familyCardAmount) <= 0">
                        发送
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { useChatStore } from '../../../stores/chatStore'
import { useWalletStore } from '../../../stores/walletStore'

const props = defineProps({
    visible: Boolean,
    chatId: String
})

const emit = defineEmits(['update:visible', 'toast', 'sent'])
const chatStore = useChatStore()
const walletStore = useWalletStore()

const familyCardAmount = ref('')
const familyCardNote = ref('我的钱就是你的钱')

watch(() => props.visible, (newVal) => {
    if (newVal) {
        familyCardAmount.value = ''
        familyCardNote.value = '我的钱就是你的钱'
    }
})

const close = () => {
    emit('update:visible', false)
}

const confirm = () => {
    const limit = parseFloat(familyCardAmount.value)
    if (!limit || limit <= 0) return

    // Pre-flight setup checking
    if (!walletStore.paymentSettings?.defaultMethod) {
        emit('toast', '温馨提示：您尚未设置支付方式，请前往钱包设置', 'warning')
        return
    }

    chatStore.addMessage(props.chatId, {
        role: 'user',
        type: 'familyCard',
        content: `[亲属卡] 送你一张亲属卡（额度: ${limit}元）`,
        limit: limit,
        note: familyCardNote.value,
        status: 'pending' // pending -> accepted -> active
    })

    emit('toast', `亲属卡已发送（最高限额 ¥${limit}），请等待对方领取`, 'success')
    emit('sent')
    close()
}
</script>
