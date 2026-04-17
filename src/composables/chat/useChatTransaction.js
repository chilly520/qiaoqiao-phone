import { ref } from 'vue'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

export function useChatTransaction() {
    const walletStore = useWalletStore()
    const chatStore = useChatStore()

    // State
    const showRedPacketModal = ref(false)
    const showTransferModal = ref(false)
    const currentRedPacket = ref(null)
    const isOpening = ref(false)
    const showResult = ref(false)
    const resultAmount = ref(0)

    // Helper to update specific message in store reactive deeply
    const updateMessageState = (updates) => {
        if (!currentRedPacket.value) return
        const chat = chatStore.chats[chatStore.currentChatId]
        if (!chat) return
        const msg = chat.msgs.find(m => m.id === currentRedPacket.value.id)
        if (msg) {
            Object.assign(msg, updates)
            if (currentRedPacket.value) Object.assign(currentRedPacket.value, updates)
        }
    }

    // Actions
    const handlePayClick = (msg) => {
        currentRedPacket.value = msg

        // User Sent Message: View Details Only
        if (msg.role === 'user') {
            const contentStr = typeof msg.content === 'string' ? msg.content : ''
            if (msg.type === 'transfer' || contentStr.includes('[转账]')) {
                showRedPacketModal.value = true // Reuse RP modal for details style
                showResult.value = true
                resultAmount.value = msg.amount
                isOpening.value = false
            } else {
                showRedPacketModal.value = true
                showResult.value = true
                resultAmount.value = msg.amount
                isOpening.value = false
            }
            return
        }

        // Unified check
        if (msg.isClaimed || msg.isRejected) {
            const contentStr = typeof msg.content === 'string' ? msg.content : ''
            if (msg.type === 'transfer' || contentStr.includes('转账')) {
                showTransferModal.value = true
            } else {
                showRedPacketModal.value = true
                showResult.value = true
                isOpening.value = false
                resultAmount.value = msg.amount
            }
            return
        }

        // New AI Message -> Open Logic
        const contentStr = typeof msg.content === 'string' ? msg.content : ''
        const isRedPacket = msg.type === 'redpacket' || contentStr.includes('[发红包')
        const isTransfer = msg.type === 'transfer' || contentStr.includes('[转账')

        if (isRedPacket) {
            showRedPacketModal.value = true
            showResult.value = false
            isOpening.value = false
            resultAmount.value = msg.amount
        } else if (isTransfer) {
            showTransferModal.value = true
        }
    }

    const openRedPacket = async () => {
        if (isOpening.value || !currentRedPacket.value) return
        isOpening.value = true

        let result = null
        try {
            result = await chatStore.claimRedPacket(chatStore.currentChatId, currentRedPacket.value.id, 'user')
        } catch (e) {
            console.error('[useChatTransaction] claimRedPacket 抛出异常:', e)
            result = null
        }

        setTimeout(() => {
            isOpening.value = false
            if (!result) {
                showResult.value = false
                return
            }
            if (result.already) {
                showResult.value = true
                resultAmount.value = result.item?.amount ?? 0
            } else if (result.claimed) {
                showResult.value = true
                resultAmount.value = result.amount ?? 0
            } else if (result.empty) {
                showResult.value = true
                resultAmount.value = 0
            }
        }, 1000)
    }

    const confirmTransfer = () => {
        if (!currentRedPacket.value) return
        // 防重：已领取过不再重复记账
        if (currentRedPacket.value.isClaimed) {
            showTransferModal.value = false
            return
        }
        const amount = parseFloat(currentRedPacket.value.amount || 0)
        walletStore.increaseBalance(amount, '微信转账', `收到转账: ${currentRedPacket.value.note || ''}`)

        updateMessageState({
            isClaimed: true,
            claimTime: Date.now()
        })

        const chat = chatStore.chats[chatStore.currentChatId]
        if (chat) {
            // In group chats, use the sender info from the message itself
            const senderName = currentRedPacket.value?.senderName || chat.remark || chat.name || '对方'
            const userName = useSettingsStore().personalization?.userProfile?.name || '我'
            chatStore.addMessage(chat.id, {
                role: 'system',
                content: `${userName}已领取了${senderName}的转账`
            })
            chatStore.saveChats()
        }

        showTransferModal.value = false
    }

    const rejectPayment = () => {
        if (isOpening.value) return

        updateMessageState({
            isRejected: true,
            rejectTime: Date.now()
        })
        showResult.value = true

        const chat = chatStore.chats[chatStore.currentChatId]
        if (chat && currentRedPacket.value) {
            // In group chats, use the sender info from the message itself
            const senderName = currentRedPacket.value?.senderName || chat.remark || chat.name || '对方'
            const contentStr = typeof currentRedPacket.value.content === 'string' ? currentRedPacket.value.content : ''
            const typeStr = (currentRedPacket.value.type === 'transfer' || contentStr.includes('转账')) ? '转账' : '红包'

            chatStore.addMessage(chat.id, {
                role: 'system',
                type: 'system',
                content: `你拒收了${senderName}的${typeStr}`
            })
            chatStore.saveChats()
        }
    }

    const closeModals = () => {
        showRedPacketModal.value = false
        showTransferModal.value = false
        currentRedPacket.value = null
    }

    return {
        showRedPacketModal,
        showTransferModal,
        currentRedPacket,
        isOpening,
        showResult,
        resultAmount,
        handlePayClick,
        openRedPacket,
        confirmTransfer,
        rejectPayment,
        closeModals
    }
}
