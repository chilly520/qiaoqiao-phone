<template>
  <div class="h-full flex flex-col bg-[#ededed]">
    <!-- Top Bar -->
    <div class="h-[60px] bg-[#ededed] flex items-center px-4 relative z-10 shrink-0">
      <div @click="$router.back()" class="absolute left-4 w-10 h-10 flex items-center justify-center text-gray-800 -ml-2 active:bg-black/5 rounded-full transition-colors cursor-pointer">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg">钱包</div>
      
      <!-- Right Actions -->
      <div class="absolute right-4 flex items-center gap-4">
        <!-- Settings -->
        <i class="fa-solid fa-ellipsis text-lg cursor-pointer p-2 hover:bg-black/5 rounded-full" @click="showSettings = true"></i>
      </div>
    </div>
    
    <!-- Balance + Add Button -->
    <div class="bg-[#ededed] px-8 py-8 flex flex-col items-center justify-center text-[#1a1a1a] relative">
      <div class="absolute top-4 right-4 flex flex-col items-center cursor-pointer active:opacity-70" @click="showRecharge = true">
          <i class="fa-solid fa-plus-circle text-2xl text-[#07c160] bg-white rounded-full"></i>
          <span class="text-[10px] text-gray-500 mt-0.5">充值</span>
      </div>

      <i class="fa-brands fa-weixin text-[48px] text-[#07c160] mb-4"></i>
      <div class="text-sm text-gray-500 mb-1">我的零钱</div>
      <div class="flex items-baseline mb-6">
         <span class="text-2xl font-bold">¥</span>
         <span class="text-[40px] font-bold ml-1 font-mono tracking-tighter">{{ walletStore.balance.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Menu Grid -->
    <div class="bg-white mx-4 rounded-xl flex items-center justify-around py-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <!-- Bill -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3"
             @click="router.push('/wallet/bill')">
            <div class="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center">
                <i class="fa-solid fa-file-invoice-dollar text-[#fbbc05] text-xl"></i>
            </div>
            <span class="text-sm font-medium text-gray-700">账单</span>
        </div>
        
        <!-- Family Card -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3 border-l border-r border-gray-100"
             @click="router.push('/wallet/family-cards')">
            <div class="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <i class="fa-solid fa-people-roof text-[#ea4335] text-xl"></i>
            </div>
            <span class="text-sm font-medium text-gray-700">亲属卡</span>
        </div>

        <!-- Bank Card -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3"
             @click="router.push('/wallet/bank-cards')">
            <div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                 <i class="fa-solid fa-credit-card text-[#4285f4] text-xl"></i>
            </div>
            <span class="text-sm font-medium text-gray-700">银行卡</span>
        </div>
    </div>
    
    <!-- Footer Safe Info -->
    <div class="mt-auto pb-6 text-center">
        <div class="flex items-center justify-center gap-1 text-gray-400 text-xs">
            <i class="fa-solid fa-shield-halved"></i>
            <span>支付安全保障中</span>
        </div>
    </div>

    <!-- Modals -->
    <!-- Recharge Modal -->
    <div v-if="showRecharge" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6 animate-fade-in" @click.self="showRecharge = false">
        <div class="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up">
            <h3 class="font-bold text-lg mb-4 text-center">零钱充值</h3>
            
            <div class="mb-4">
                <label class="text-xs text-gray-500 mb-1 block">金额</label>
                <div class="flex items-center border-b-2 border-[#07c160] py-2">
                    <span class="text-2xl font-bold mr-2">¥</span>
                    <input type="number" v-model="rechargeAmount" class="w-full text-3xl font-bold outline-none bg-transparent" placeholder="0.00">
                </div>
            </div>
            
            <div class="mb-6">
                <label class="text-xs text-gray-500 mb-2 block">充值方式</label>
                <select v-model="rechargeMethod" class="w-full bg-gray-100 p-3 rounded-lg outline-none">
                     <option :value="null" disabled>请选择来源</option>
                     <option v-for="card in walletStore.bankCards" :key="card.id" :value="card.id">
                        {{ card.bankName }} ({{ card.number.slice(-4) }}) - 余额: ¥{{ card.balance }}
                     </option>
                     <option value="fake_bank">模拟银行卡 (无限额)</option>
                </select>
            </div>

            <button @click="handleRecharge" class="w-full bg-[#07c160] text-white py-3 rounded-lg font-bold active:bg-green-600 disabled:opacity-50" :disabled="!rechargeAmount || rechargeAmount <= 0">
                充值
            </button>
        </div>
    </div>
    
    <!-- Settings Modal -->
    <div v-if="showSettings" class="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center animate-fade-in" @click.self="showSettings = false">
        <div class="bg-white w-full sm:w-[320px] rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
            <h3 class="font-bold text-lg mb-6 text-center">支付设置</h3>
            
            <div class="space-y-4 mb-6">
                <!-- Payment Priority -->
                <div class="text-xs text-gray-500 mb-2">支付优先级</div>
                <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100" @click="changeDefaultMethod('balance')">
                        <div class="flex items-center gap-3">
                            <i class="fa-brands fa-weixin text-[#07c160]"></i>
                            <span>零钱优先</span>
                        </div>
                        <i v-if="walletStore.paymentSettings.defaultMethod === 'balance'" class="fa-solid fa-check text-[#07c160]"></i>
                    </div>
                </div>
                
                <!-- Family Cards with Collapsible Menu -->
                <div class="text-xs text-gray-500 mb-2 mt-4">亲属卡（可勾选具体卡）</div>
                <div class="border border-gray-100 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between p-3 bg-gray-50 cursor-pointer" @click="showFamilyCards = !showFamilyCards">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-people-roof text-[#ea4335]"></i>
                            <span>亲属卡优先</span>
                        </div>
                        <i :class="['fa-solid', showFamilyCards ? 'fa-chevron-up' : 'fa-chevron-down', 'text-gray-500']"></i>
                    </div>
                    
                    <!-- Family Card List -->
                    <div v-if="showFamilyCards" class="space-y-1 bg-white">
                        <div v-if="walletStore.familyCards.length === 0" class="p-4 text-xs text-gray-400">
                            暂无亲属卡
                        </div>
                        <div v-for="card in walletStore.familyCards" :key="card.id" class="flex items-center justify-between p-3 text-sm border-t border-gray-100 hover:bg-gray-50">
                            <div class="flex items-center gap-2">
                                <div :class="`w-3 h-3 rounded-full`" :style="{ backgroundColor: card.theme === 'pink' ? '#ff9a9e' : '#f79c1f' }"></div>
                                <div>
                                    <div class="font-medium">{{ card.remark }}</div>
                                    <div class="text-xs text-gray-500">{{ card.ownerName }} - ¥{{ card.amount }}</div>
                                </div>
                            </div>
                            <input type="radio" v-model="walletStore.paymentSettings.selectedCardId" :value="card.id" class="text-[#07c160]">
                        </div>
                    </div>
                </div>
                
                <!-- Bank Cards with Collapsible Menu -->
                <div class="text-xs text-gray-500 mb-2 mt-4">银行卡（可勾选具体卡）</div>
                <div class="border border-gray-100 rounded-lg overflow-hidden">
                    <div class="flex items-center justify-between p-3 bg-gray-50 cursor-pointer" @click="showBankCards = !showBankCards">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-credit-card text-[#4285f4]"></i>
                            <span>银行卡优先</span>
                        </div>
                        <i :class="['fa-solid', showBankCards ? 'fa-chevron-up' : 'fa-chevron-down', 'text-gray-500']"></i>
                    </div>
                    
                    <!-- Bank Card List -->
                    <div v-if="showBankCards" class="space-y-1 bg-white">
                        <div v-if="walletStore.bankCards.length === 0" class="p-4 text-xs text-gray-400">
                            暂无银行卡
                        </div>
                        <div v-for="card in walletStore.bankCards" :key="card.id" class="flex items-center justify-between p-3 text-sm border-t border-gray-100 hover:bg-gray-50">
                            <div class="flex items-center gap-2">
                                <div :class="`w-3 h-3 rounded-full`" :style="{ backgroundColor: card.theme === 'red' ? '#ea4335' : '#4285f4' }"></div>
                                <div>
                                    <div class="font-medium">{{ card.bankName }}</div>
                                    <div class="text-xs text-gray-500">**** **** **** {{ card.number.slice(-4) }}</div>
                                </div>
                            </div>
                            <input type="radio" v-model="walletStore.paymentSettings.selectedCardId" :value="card.id" class="text-[#07c160]">
                        </div>
                    </div>
                </div>
            </div>

            <button @click="showSettings = false" class="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold active:bg-gray-200">
                关闭
            </button>
        </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore' // For toast

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore() // Assuming it has triggerToast

const showRecharge = ref(false)
const showSettings = ref(false)
const rechargeAmount = ref('')
const rechargeMethod = ref('fake_bank')
const showFamilyCards = ref(false)
const showBankCards = ref(false)

const handleRecharge = () => {
    const amount = parseFloat(rechargeAmount.value)
    if (!amount || amount <= 0) return

    if (rechargeMethod.value === 'fake_bank') {
        walletStore.increaseBalance(amount, '充值', '模拟银行卡')
        chatStore.triggerToast(`充值 ¥${amount} 成功`, 'success')
        showRecharge.value = false
        rechargeAmount.value = ''
    } else {
        // Real bank card logic (deduct from card)
        // TODO: Implement bank card deduction logic in store
        // For now, assume it works if card exists
        const card = walletStore.bankCards.find(c => c.id === rechargeMethod.value)
        if (card) {
             if (card.balance >= amount) {
                 card.balance -= amount
                 // Add tx to card?
                 walletStore.increaseBalance(amount, '充值', `${card.bankName}(${card.number.slice(-4)})`)
                 chatStore.triggerToast(`充值 ¥${amount} 成功`, 'success')
                 walletStore.save()
                 showRecharge.value = false
                 rechargeAmount.value = ''
             } else {
                 chatStore.triggerToast('该银行卡余额不足', 'error')
             }
        }
    }
}

const changeDefaultMethod = (method) => {
    walletStore.paymentSettings.defaultMethod = method
    walletStore.save()
}
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
.animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.animate-slide-up { animation: slideUp 0.3s ease-out; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>
