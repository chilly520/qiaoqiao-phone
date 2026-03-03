<template>
    <div v-if="visible"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="bg-white w-[85%] max-w-[340px] rounded-3xl overflow-hidden shadow-2xl flex flex-col" @click.stop>
            <!-- Header with Gradient -->
            <div :class="sendType === 'redpacket'
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-orange-600'
                : 'bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600'"
                class="h-16 relative flex items-center justify-center shrink-0">
                <span class="font-bold text-white text-xl tracking-wide drop-shadow-md">
                    {{ sendType === 'redpacket' ? '发红包' : '转账' }}
                </span>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-pointer rounded-full hover:bg-white/20 transition-colors"
                    @click="close">
                    <i class="fa-solid fa-xmark text-white text-xl drop-shadow"></i>
                </div>

                <!-- Decorative Elements -->
                <div v-if="sendType === 'redpacket'" class="absolute inset-0 overflow-hidden pointer-events-none">
                    <div class="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                    <div class="absolute -bottom-6 -left-6 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl"></div>
                </div>
            </div>

            <div class="p-6 flex flex-col gap-5 bg-gradient-to-b from-white to-gray-50">
                <!-- Recipient Info (Transfer Mode) -->
                <div v-if="sendType === 'transfer'" class="flex flex-col items-center gap-3 -mt-2 w-full">
                    <div class="relative">
                        <img :src="transferRecipient?.avatar || chatData?.avatar"
                            class="w-16 h-16 rounded-2xl bg-gray-200 object-cover shadow-lg ring-4 ring-white">
                        <div
                            class="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center shadow-md">
                            <i class="fa-solid fa-coins text-white text-xs"></i>
                        </div>
                    </div>
                    <div class="text-gray-700 text-sm">转账给 <span class="font-bold text-gray-900">{{
                        transferRecipient?.nickname || transferRecipient?.name || chatData?.name }}</span></div>

                    <!-- Group Member Picker -->
                    <div v-if="chatData?.isGroup" class="w-full mt-2">
                        <select v-model="transferRecipientId"
                            class="w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400">
                            <option v-for="p in chatData?.participants" :key="p.id" :value="p.id"
                                :hidden="p.id === 'user'">
                                {{ p.nickname || p.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <!-- Red Packet Icon (Red Packet Mode) -->
                <div v-if="sendType === 'redpacket'" class="flex justify-center -mt-2">
                    <div
                        class="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3">
                        <i class="fa-solid fa-gift text-white text-4xl drop-shadow-lg"></i>
                    </div>
                </div>

                <!-- Red Packet Type and Count (Red Packet Mode) -->
                <div v-if="sendType === 'redpacket'" class="flex flex-col gap-4">
                    <div class="flex bg-gray-100 p-1 rounded-xl">
                        <button @click="packetType = 'lucky'"
                            class="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                            :class="packetType === 'lucky' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500'">
                            拼手气红包
                        </button>
                        <button @click="packetType = 'fixed'"
                            class="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                            :class="packetType === 'fixed' ? 'bg-red-500 text-white shadow-md' : 'text-gray-500'">
                            普通红包
                        </button>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-medium text-gray-500 ml-1">红包个数</label>
                        <div class="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border-2 border-gray-100">
                            <input type="number" v-model="sendCount" min="1" max="100"
                                class="flex-1 bg-transparent border-none outline-none text-lg font-bold text-gray-900">
                            <span class="text-gray-400 text-sm">个</span>
                        </div>
                    </div>
                </div>

                <!-- Amount Input -->
                <div class="flex flex-col gap-3">
                    <div class="text-gray-600 font-medium text-sm ml-1">
                        {{ sendType === 'transfer' ? '转账金额' : (packetType === 'lucky' ? '总金额' : '单个金额') }}
                    </div>
                    <div class="flex items-center gap-2 border-b-2 pb-2 pt-1 transition-colors min-h-[80px]"
                        :class="sendAmount ? (sendType === 'redpacket' ? 'border-red-500' : 'border-orange-500') : 'border-gray-300'">
                        <span class="text-gray-900 font-bold text-4xl">¥</span>
                        <input type="text" inputmode="decimal" v-model="sendAmount" placeholder="0.00"
                            class="flex-1 min-w-0 bg-transparent border-none outline-none text-5xl font-bold text-gray-900 placeholder-gray-300"
                            style="font-family: 'SF Pro Display', -apple-system, sans-serif;">
                    </div>
                </div>

                <!-- Note Input -->
                <div class="flex flex-col gap-2">
                    <label class="text-xs font-medium ml-1"
                        :class="sendType === 'redpacket' ? 'text-red-600' : 'text-orange-600'">
                        {{ sendType === 'redpacket' ? '💌 寄语' : '📝 添加备注' }}
                    </label>
                    <input type="text" v-model="sendNote" :placeholder="sendType === 'redpacket' ? '恭喜发财，大吉大利' : '转账给您'"
                        class="w-full bg-white rounded-xl px-4 py-3 border-2 border-gray-200 text-sm outline-none placeholder-gray-400 focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all">
                </div>

                <button @click="confirmSend"
                    class="w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    :class="sendType === 'redpacket'
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                        : 'bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white'"
                    :disabled="!sendAmount">
                    <i class="fa-solid mr-2" :class="sendType === 'redpacket' ? 'fa-gift' : 'fa-paper-plane'"></i>
                    {{ sendType === 'redpacket' ? '塞钱进红包' : '确认转账' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useWalletStore } from '../../../stores/walletStore'
import { useChatStore } from '../../../stores/chatStore'

const props = defineProps({
    visible: Boolean,
    sendType: {
        type: String,
        default: 'redpacket'
    },
    chatData: Object
})

const emit = defineEmits(['update:visible', 'toast'])

const walletStore = useWalletStore()
const chatStore = useChatStore()

const sendAmount = ref('')
const sendNote = ref('')
const sendCount = ref(1)
const packetType = ref('lucky')
const transferRecipientId = ref('')

const transferRecipient = computed(() => {
    if (!props.chatData?.isGroup) return props.chatData
    return props.chatData?.participants?.find(p => String(p.id) === String(transferRecipientId.value)) || props.chatData
})

// Initialize form when opening
watch(() => props.visible, (newVal) => {
    if (newVal) {
        sendAmount.value = props.sendType === 'redpacket' ? '8.88' : '520'
        sendNote.value = props.sendType === 'redpacket' ? '恭喜发财，大吉大利' : '转账给您'
        sendCount.value = 1
        packetType.value = 'lucky'
        if (props.sendType === 'transfer' && props.chatData?.isGroup) {
            transferRecipientId.value = props.chatData.participants?.[0]?.id || ''
        }
    }
})

const close = () => {
    emit('update:visible', false)
}

const confirmSend = () => {
    if (!sendAmount.value) {
        emit('toast', '请输入金额', 'warning')
        return
    }

    const amount = parseFloat(sendAmount.value)
    if (isNaN(amount) || amount <= 0) {
        emit('toast', '请输入有效的金额', 'warning')
        return
    }

    if (!walletStore.paymentSettings?.defaultMethod) {
        emit('toast', '温馨提示：您尚未设置支付方式，请前往钱包设置', 'warning')
        return
    }

    const isRP = props.sendType === 'redpacket'
    const title = isRP ? '发红包' : '转账'

    const actualTotalAmount = (isRP && packetType.value === 'fixed')
        ? amount * (parseInt(sendCount.value) || 1)
        : amount

    const success = walletStore.decreaseBalance(actualTotalAmount, title)

    if (!success) {
        emit('toast', `支付失败：余额不足 (当前余额 ¥${walletStore.balance.toFixed(2)})`, 'error')
        return
    }

    chatStore.addMessage(chatStore.currentChatId, {
        role: 'user',
        type: props.sendType,
        content: `[${isRP ? '红包' : '转账'}] ${isRP ? (sendNote.value || '恭喜发财') : (amount + '元')}`,
        amount: amount,
        count: isRP ? parseInt(sendCount.value) || 1 : 1,
        packetType: isRP ? packetType.value : null,
        note: sendNote.value || (isRP ? '恭喜发财，大吉大利' : '转账给您'),
        targetId: isRP ? null : (props.chatData?.isGroup ? transferRecipientId.value : undefined),
        status: 'sent'
    })

    close()
}
</script>
