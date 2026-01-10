import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWalletStore = defineStore('wallet', () => {
    const balance = ref(0.00)
    const transactions = ref([])

    // Load from localStorage
    const loadWallet = () => {
        try {
            const data = localStorage.getItem('qiaoqiao_wallet')
            if (data) {
                const parsed = JSON.parse(data)
                balance.value = parsed.balance || 0.00
                transactions.value = parsed.transactions || []
            }
        } catch (e) {
            console.error('Failed to load wallet:', e)
        }
    }

    // Save to localStorage
    const saveWallet = () => {
        try {
            localStorage.setItem('qiaoqiao_wallet', JSON.stringify({
                balance: balance.value,
                transactions: transactions.value
            }))
        } catch (e) {
            console.error('Failed to save wallet:', e)
        }
    }

    // Add Balance
    const addBalance = (amount, description, type = 'income') => {
        const numAmount = parseFloat(amount)
        if (isNaN(numAmount)) return

        balance.value += numAmount
        transactions.value.unshift({
            id: Date.now(),
            amount: numAmount,
            description,
            type,
            date: new Date().toISOString()
        })
        saveWallet()
    }

    // Initialize
    loadWallet()

    return {
        balance,
        transactions,
        addBalance,
        loadWallet,
        saveWallet
    }
})
