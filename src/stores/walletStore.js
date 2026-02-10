import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useMahjongStore } from './mahjongStore.js'
import { useSettingsStore } from './settingsStore.js'
import { useChatStore } from './chatStore.js'

export const useWalletStore = defineStore('wallet', () => {
    // State
    const balance = ref(0.00) // 零钱余额

    // Transactions (Main Bill)
    // { id, type: 'income'|'expense', amount, title, time, source: 'balance'|'bank'|'family', methodDetail: '招商银行(8888)' }
    const transactions = ref([])

    // Bank Cards
    // { id, bankName, number, balance, theme: 'red'|'blue'|'gold'|'black'|'pink', transactions: [] }
    const bankCards = ref([])

    // Family Cards (Received from Characters)
    // { id, fromCharId, balance, limit, theme, transactions: [] }
    const familyCards = ref([])

    // Payment Settings
    const paymentSettings = ref({
        priority: ['balance', 'family', 'bank'], // Order of deduction
        // For specific override:
        defaultMethod: 'balance', // 'balance', 'bank', 'family'
        selectedCardId: null
    })

    // Actions
    function init() {
        const saved = localStorage.getItem('qiaoqiao_wallet')
        if (saved) {
            try {
                const data = JSON.parse(saved)
                balance.value = data.balance !== undefined ? data.balance : 0
                transactions.value = data.transactions || []
                bankCards.value = data.bankCards || []
                familyCards.value = data.familyCards || []

                if (data.paymentSettings) {
                    paymentSettings.value = { ...paymentSettings.value, ...data.paymentSettings }
                }

                // Check for monthly reset
                checkMonthlyReset()
            } catch (e) {
                console.error('Failed to load wallet data', e)
            }
        }
    }

    function checkMonthlyReset() {
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`
        let changed = false

        familyCards.value.forEach(card => {
            if (card.lastResetMonth !== currentMonth) {
                // It's a new month!
                card.usedAmount = 0
                card.lastResetMonth = currentMonth
                changed = true

                // Send notification on the 1st of the month (or first time seeing the new month)
                setTimeout(async () => {
                    try {
                        const { useChatStore } = await import('./chatStore')
                        const chatStore = useChatStore()
                        chatStore.addMessage(card.ownerId, {
                            role: 'system',
                            content: `「${card.remark || '亲属卡'}」本月额度已更新`
                        })
                    } catch (e) {
                        console.error('[WalletStore] Monthly reset notification failed', e)
                    }
                }, 1000) // Small delay to ensure chatStore is ready
            }
        })

        if (changed) save()
    }

    function save() {
        localStorage.setItem('qiaoqiao_wallet', JSON.stringify({
            balance: balance.value,
            transactions: transactions.value,
            bankCards: bankCards.value,
            familyCards: familyCards.value,
            paymentSettings: paymentSettings.value
        }))
    }

    // Money Operations
    function addTransaction(tx) {
        transactions.value.unshift({
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            time: Date.now(),
            ...tx
        })
        save()
    }

    // Increase Balance (Receive Red Packet / Top up from Bank)
    function increaseBalance(amount, title, sourceInfo = '零钱') {
        const numAmount = parseFloat(amount)
        balance.value = parseFloat((balance.value + numAmount).toFixed(2))
        addTransaction({
            type: 'income',
            amount: numAmount,
            title: title || '收入',
            source: 'balance',
            methodDetail: sourceInfo
        })
    }

    // Decrease Balance (Pay)
    // Supports intelligent payment method selection
    function decreaseBalance(amount, title, preferredMethod = null) {
        const numAmount = parseFloat(amount)
        if (numAmount <= 0) return false

        // Determine Payment Order
        // If preferredMethod is passed (e.g. from UI selection), try that first.
        // Otherwise use global settings.
        let methods = [...(paymentSettings.value.priority || ['balance', 'family', 'bank'])]

        // Override logic if preferred provided
        if (preferredMethod) {
            methods = [preferredMethod, ...methods.filter(m => m !== preferredMethod)]
        } else if (paymentSettings.value.defaultMethod) {
            const def = paymentSettings.value.defaultMethod
            methods = [def, ...methods.filter(m => m !== def)]
        }

        for (const method of methods) {
            if (method === 'balance') {
                if (balance.value >= numAmount) {
                    balance.value = parseFloat((balance.value - numAmount).toFixed(2))
                    addTransaction({
                        type: 'expense',
                        amount: numAmount,
                        title: title || '支出',
                        source: 'balance',
                        methodDetail: '零钱'
                    })
                    return true
                }
            } else if (method === 'family') {
                // Find a family card with enough balance
                let capableCard = null
                const specificId = paymentSettings.value.selectedCardId

                // 1. Try specifically selected card
                if (specificId) {
                    const specific = familyCards.value.find(c => c.id === specificId)
                    if (specific && (specific.amount - specific.usedAmount) >= numAmount) {
                        capableCard = specific
                    }
                }

                // 2. Fallback to any capable card if specific fails
                if (!capableCard) {
                    capableCard = familyCards.value.find(c => (c.amount - c.usedAmount) >= numAmount)
                }

                if (capableCard) {
                    capableCard.usedAmount = parseFloat((capableCard.usedAmount + numAmount).toFixed(2))

                    // Add Transaction to Card History
                    capableCard.transactions.push({
                        id: `ftx_${Date.now()}`,
                        type: 'expense',
                        amount: numAmount,
                        title: title || '支出',
                        time: Date.now()
                    })

                    // Add to Main Bill
                    addTransaction({
                        type: 'expense',
                        amount: numAmount,
                        title: title || '支出',
                        source: 'family',
                        methodDetail: `${capableCard.remark || '亲属卡'}`
                    })

                    // NEW: Notify the card owner
                    setTimeout(async () => {
                        try {
                            const { useChatStore } = await import('./chatStore')
                            const { useSettingsStore } = await import('./settingsStore')
                            const { useMahjongStore } = await import('./mahjongStore.js')
                            const chatStore = useChatStore()
                            const settingsStore = useSettingsStore()
                            const mahjongStore = useMahjongStore()

                            const waitForLoad = () => new Promise(resolve => {
                                if (chatStore.isLoaded) return resolve()
                                const timer = setInterval(() => {
                                    if (chatStore.isLoaded) {
                                        clearInterval(timer)
                                        resolve()
                                    }
                                }, 100)
                                setTimeout(() => { clearInterval(timer); resolve() }, 5000)
                            })
                            await waitForLoad()
                            const userName = mahjongStore.currentRoom?.players?.find(p => p.id === 'user')?.name || settingsStore.personalization?.userProfile?.name || '你'
                            const timestamp = Date.now()
                            const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                            const content = `${userName}使用「${capableCard.remark || '亲属卡'}」消费了${numAmount}元 [TIMESTAMP:${formattedTime}]`

                            // Try ID first
                            const success = await chatStore.addMessage(capableCard.ownerId, {
                                role: 'system',
                                content
                            })

                            // Fallback to name search if ID failed
                            if (success === false) {
                                const targetChat = Object.values(chatStore.chats).find(c => c.name === capableCard.ownerId || c.name === capableCard.ownerName)
                                if (targetChat) {
                                    chatStore.addMessage(targetChat.id, {
                                        role: 'system',
                                        content
                                    })
                                }
                            }
                        } catch (e) {
                            console.error('[WalletStore] Failed to notify owner', e)
                        }
                    }, 0)

                    return true
                }
            } else if (method === 'bank') {
                // Bank Card Logic
                let capableCard = null
                const specificId = paymentSettings.value.selectedCardId

                // 1. Try specifically selected card
                if (specificId) {
                    const specific = bankCards.value.find(c => c.id === specificId)
                    if (specific && Number(specific.balance || 0) >= numAmount) {
                        capableCard = specific
                    }
                }

                // 2. Fallback
                if (!capableCard) {
                    capableCard = bankCards.value.find(c => Number(c.balance || 0) >= numAmount)
                }

                if (capableCard) {
                    capableCard.balance = parseFloat((capableCard.balance - numAmount).toFixed(2))
                    capableCard.transactions.push({
                        id: `btx_${Date.now()}`,
                        type: 'expense',
                        amount: numAmount,
                        title: title || '支出',
                        time: Date.now()
                    })

                    addTransaction({
                        type: 'expense',
                        amount: numAmount,
                        title: title || '支出',
                        source: 'bank',
                        methodDetail: `${capableCard.bankName}(${capableCard.number.slice(-4)})`
                    })
                    return true
                }
            }
        }

        return false
    }

    // Add Bank Card
    function addBankCard(card) { // { bankName, number, balance, theme }
        const newCard = {
            id: `bank_${Date.now()}`,
            transactions: [],
            ...card,
            balance: parseFloat(card.balance) || 0
        }
        bankCards.value.push(newCard)
        save()
        return newCard
    }

    // Add Family Card
    function addFamilyCard(card) {
        // card: { ownerId, ownerName, amount, remark, bindTime }
        const newCard = {
            id: `family_${Date.now()}`,
            ownerId: card.ownerId,
            ownerName: card.ownerName || '对方',
            amount: parseFloat(card.amount) || 0, // Initial limit
            usedAmount: 0, // Amount already spent
            remark: card.remark || '亲属卡',
            bindTime: card.bindTime || Date.now(),
            transactions: [],
            theme: card.theme || 'pink',
            number: card.number || `66${Math.floor(Math.random() * 10000000000000)}`, // Card number
            lastResetMonth: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
        }
        familyCards.value.push(newCard)
        save()
        return newCard
    }

    // Use Family Card (Deduct from card limit)
    function useFamilyCard(cardId, amount, title) {
        const card = familyCards.value.find(c => c.id === cardId)
        if (!card) return false

        const numAmount = parseFloat(amount)
        const available = card.amount - card.usedAmount

        if (available >= numAmount) {
            card.usedAmount = parseFloat((card.usedAmount + numAmount).toFixed(2))
            card.transactions.push({
                id: `ftx_${Date.now()}`,
                type: 'expense',
                amount: numAmount,
                title: title || '支出',
                time: Date.now()
            })

            addTransaction({
                type: 'expense',
                amount: numAmount,
                title,
                source: 'family',
                methodDetail: `${card.ownerName}的亲属卡`
            })

            // NEW: Notify the card owner
            setTimeout(async () => {
                try {
                    const { useChatStore } = await import('./chatStore')
                    const { useSettingsStore } = await import('./settingsStore')
                    const { useMahjongStore } = await import('./mahjongStore.js')
                    const chatStore = useChatStore()
                    const settingsStore = useSettingsStore()
                    const mahjongStore = useMahjongStore()

                    const waitForLoad = () => new Promise(resolve => {
                        if (chatStore.isLoaded) return resolve()
                        const timer = setInterval(() => {
                            if (chatStore.isLoaded) {
                                clearInterval(timer)
                                resolve()
                            }
                        }, 100)
                        setTimeout(() => { clearInterval(timer); resolve() }, 5000)
                    })
                    await waitForLoad()
                    const userName = mahjongStore.currentRoom?.players?.find(p => p.id === 'user')?.name || settingsStore.personalization?.userProfile?.name || '你'
                    const timestamp = Date.now()
                    const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    const content = `${userName}使用「${card.remark || '亲属卡'}」消费了${numAmount}元 [TIMESTAMP:${formattedTime}]`

                    const success = await chatStore.addMessage(card.ownerId, {
                        role: 'system',
                        content
                    })

                    // Fallback to name search if ID failed
                    if (success === false) {
                        const targetChat = Object.values(chatStore.chats).find(c => c.name === card.ownerId || c.name === card.ownerName)
                        if (targetChat) {
                            chatStore.addMessage(targetChat.id, {
                                role: 'system',
                                content
                            })
                        }
                    }
                } catch (e) {
                    console.error('[WalletStore] Failed to notify owner', e)
                }
            }, 0)

            save()
            return true
        }
        return false
    }

    // Initialize
    init()

    return {
        balance, transactions, bankCards, familyCards, paymentSettings,
        increaseBalance, decreaseBalance, addBankCard, addFamilyCard, useFamilyCard, save, addTransaction
    }
})
