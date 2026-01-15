import { ref } from 'vue'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'

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

    const openRedPacket = () => {
        if (isOpening.value) return
        isOpening.value = true

        setTimeout(() => {
            // Race condition check
            if (!currentRedPacket.value || currentRedPacket.value.isRejected) {
                isOpening.value = false
                return
            }

            isOpening.value = false
            showResult.value = true

            const amount = parseFloat(currentRedPacket.value.amount || (Math.random() * 100).toFixed(2))
            resultAmount.value = amount

            // Add to Wallet
            walletStore.increaseBalance(amount, '微信红包', `领取红包: ${currentRedPacket.value.note || ''}`)

            // Update State
            updateMessageState({
                isClaimed: true,
                claimTime: Date.now()
            })

            // Add System Message
            const chat = chatStore.chats[chatStore.currentChatId]
            if (chat) {
                const senderName = chat.remark || chat.name
                const userName = chat.userName || '用户'
                chatStore.addMessage(chat.id, {
                    role: 'system',
                    type: 'system',
                    content: `${userName}领取了${senderName}的红包`
                })
                chatStore.saveChats()
            }

        }, 1000)
    }

    const confirmTransfer = () => {
        const amount = parseFloat(currentRedPacket.value.amount || 0)
        walletStore.increaseBalance(amount, '微信转账', `收到转账: ${currentRedPacket.value.note || ''}`)

        updateMessageState({
            isClaimed: true,
            claimTime: Date.now()
        })

        const chat = chatStore.chats[chatStore.currentChatId]
        if (chat) {
            const senderName = chat.remark || chat.name || '对方'
            const userName = chat.userName || '用户'
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
            const senderName = chat.remark || chat.name || '对方'
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
