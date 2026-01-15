import { defineStore } from 'pinia'
import { ref } from 'vue'

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
            } catch (e) {
                console.error('Failed to load wallet data', e)
            }
        }
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
    function decreaseBalance(amount, title) {
        const numAmount = parseFloat(amount)
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
            ownerName: card.ownerName || '未知',
            amount: parseFloat(card.amount) || 0, // Initial limit
            usedAmount: 0, // Amount already spent
            remark: card.remark || '亲属卡',
            bindTime: card.bindTime || Date.now(),
            transactions: [],
            theme: card.theme || 'pink',
            number: card.number || `66${Math.floor(Math.random() * 10000000000000)}` // Card number
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
