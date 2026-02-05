<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../../stores/walletStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'

const router = useRouter()
const walletStore = useWalletStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

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
        const card = walletStore.bankCards.find(c => c.id === rechargeMethod.value)
        if (card) {
             if (card.balance >= amount) {
                 card.balance -= amount
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

<template>
  <div class="h-full flex flex-col transition-colors duration-300"
    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
    <!-- Top Bar -->
    <div class="h-[60px] flex items-center px-4 relative z-10 shrink-0 transition-colors"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#ededed]'">
      <div @click="$router.back()" 
        class="absolute left-4 w-10 h-10 flex items-center justify-center -ml-2 rounded-full transition-colors cursor-pointer"
        :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800 hover:bg-black/5'">
        <i class="fa-solid fa-chevron-left text-lg"></i>
      </div>
      <div class="flex-1 text-center font-bold text-lg" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">钱包</div>
      
      <!-- Right Actions -->
      <div class="absolute right-4 flex items-center gap-4">
        <!-- Settings -->
        <i class="fa-solid fa-ellipsis text-lg cursor-pointer p-2 rounded-full transition-colors" 
            :class="settingsStore.personalization.theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800 hover:bg-black/5'"
            @click="showSettings = true"></i>
      </div>
    </div>
    
    <!-- Balance + Add Button -->
    <div class="px-8 py-8 flex flex-col items-center justify-center relative transition-colors"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#ededed] text-[#1a1a1a]'">
      <div class="absolute top-4 right-4 flex flex-col items-center cursor-pointer active:opacity-70 transition-transform active:scale-95" @click="showRecharge = true">
          <i class="fa-solid fa-plus-circle text-2xl text-[#07c160] rounded-full"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-transparent shadow-[0_0_10px_rgba(7,193,96,0.3)]' : 'bg-white'"></i>
          <span class="text-[10px] mt-0.5" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">充值</span>
      </div>

      <i class="fa-brands fa-weixin text-[48px] text-[#07c160] mb-4"></i>
      <div class="text-sm mb-1" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">我的零钱</div>
      <div class="flex items-baseline mb-6">
         <span class="text-2xl font-bold">¥</span>
         <span class="text-[40px] font-bold ml-1 font-mono tracking-tighter">{{ walletStore.balance.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Menu Grid -->
    <div class="mx-4 rounded-xl flex items-center justify-around py-6 shadow-xl transition-colors border"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/5 shadow-black/20' : 'bg-white border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.02)]'">
        <!-- Bill -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3"
             @click="router.push('/wallet/bill')">
            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'">
                <i class="fa-solid fa-file-invoice-dollar text-[#fbbc05] text-xl"></i>
            </div>
            <span class="text-sm font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'">账单</span>
        </div>
        
        <!-- Family Card -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3 border-r transition-colors"
             :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5' : 'border-gray-100'"
             @click="router.push('/wallet/family-cards')">
            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'">
                <i class="fa-solid fa-people-roof text-[#ea4335] text-xl"></i>
            </div>
            <span class="text-sm font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'">亲属卡</span>
        </div>

        <!-- Bank Card -->
        <div class="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 w-1/3"
             @click="router.push('/wallet/bank-cards')">
            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'">
                 <i class="fa-solid fa-credit-card text-[#4285f4] text-xl"></i>
            </div>
            <span class="text-sm font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'">银行卡</span>
        </div>
    </div>
    
    <!-- Footer Safe Info -->
    <div class="mt-auto pb-6 text-center">
        <div class="flex items-center justify-center gap-1 text-xs" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-600' : 'text-gray-400'">
            <i class="fa-solid fa-shield-halved"></i>
            <span>支付安全保障中</span>
        </div>
    </div>

    <!-- Modals -->
    <!-- Recharge Modal -->
    <div v-if="showRecharge" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" @click.self="showRecharge = false">
        <div class="p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-scale-up"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]' : 'bg-white'">
            <h3 class="font-bold text-lg mb-4 text-center" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">零钱充值</h3>
            
            <div class="mb-4">
                <label class="text-xs mb-1 block" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">金额</label>
                <div class="flex items-center border-b-2 border-[#07c160] py-2">
                    <span class="text-2xl font-bold mr-2" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">¥</span>
                    <input type="number" v-model="rechargeAmount" class="w-full text-3xl font-bold outline-none bg-transparent" placeholder="0.00"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">
                </div>
            </div>
            
            <div class="mb-6">
                <label class="text-xs mb-2 block" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">充值方式</label>
                <select v-model="rechargeMethod" class="w-full p-3 rounded-lg outline-none transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border border-white/10 text-white' : 'bg-gray-100 text-gray-900'">
                     <option :value="null" disabled>请选择来源</option>
                     <option v-for="card in walletStore.bankCards" :key="card.id" :value="card.id">
                        {{ card.bankName }} ({{ card.number.slice(-4) }}) - 余额: ¥{{ card.balance }}
                     </option>
                     <option value="fake_bank">模拟银行卡 (无限额)</option>
                </select>
            </div>

            <button @click="handleRecharge" class="w-full bg-[#07c160] text-white py-3 rounded-lg font-bold active:bg-green-600 disabled:opacity-50 transition-all shadow-lg active:scale-95" :disabled="!rechargeAmount || rechargeAmount <= 0">
                充值
            </button>
        </div>
    </div>
    
    <!-- Settings Modal -->
    <div v-if="showSettings" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center animate-fade-in" @click.self="showSettings = false">
        <div class="w-full sm:w-[320px] rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up max-h-[80vh] shadow-2xl overflow-hidden flex flex-col"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]' : 'bg-white'">
            <h3 class="font-bold text-lg mb-6 text-center" :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-900'">支付设置</h3>
            
            <div class="flex-1 overflow-y-auto space-y-4 mb-6 pr-1 custom-scrollbar">
                <!-- Payment Priority -->
                <div class="text-xs mb-2" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">支付优先级</div>
                <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10 hover:bg-white/5 text-gray-300' : 'border-gray-100 hover:bg-gray-50 text-gray-900'"
                        @click="changeDefaultMethod('balance')">
                        <div class="flex items-center gap-3">
                            <i class="fa-brands fa-weixin text-[#07c160]"></i>
                            <span>零钱优先</span>
                        </div>
                        <i v-if="walletStore.paymentSettings.defaultMethod === 'balance'" class="fa-solid fa-check text-[#07c160]"></i>
                    </div>
                </div>
                
                <!-- Family Cards -->
                <div class="text-xs mb-2 mt-4" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">亲属卡（可勾选具体卡）</div>
                <div class="border rounded-lg overflow-hidden transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
                    <div class="flex items-center justify-between p-3 cursor-pointer transition-colors" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#334155] text-white' : 'bg-gray-50 text-gray-900'"
                        @click="showFamilyCards = !showFamilyCards">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-people-roof text-[#ea4335]"></i>
                            <span>亲属卡优先</span>
                        </div>
                        <i :class="['fa-solid', showFamilyCards ? 'fa-chevron-up' : 'fa-chevron-down', 'text-gray-500']"></i>
                    </div>
                    
                    <!-- Family Card List -->
                    <div v-if="showFamilyCards" class="space-y-1 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/10' : 'bg-white'">
                        <div v-if="walletStore.familyCards.length === 0" class="p-4 text-xs text-gray-500">
                            暂无亲属卡
                        </div>
                        <div v-for="card in walletStore.familyCards" :key="card.id" class="flex items-center justify-between p-3 text-sm border-t hover:bg-white/5 transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5 text-gray-400' : 'border-gray-100 text-gray-700'">
                            <div class="flex items-center gap-2">
                                <div :class="`w-3 h-3 rounded-full`" :style="{ backgroundColor: card.theme === 'pink' ? '#ff9a9e' : '#f79c1f' }"></div>
                                <div>
                                    <div class="font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : ''">{{ card.remark }}</div>
                                    <div class="text-xs opacity-60">{{ card.ownerName }} - ¥{{ card.amount }}</div>
                                </div>
                            </div>
                            <input type="radio" v-model="walletStore.paymentSettings.selectedCardId" :value="card.id" class="accent-[#07c160]" @change="changeDefaultMethod('family')">
                        </div>
                    </div>
                </div>
                
                <!-- Bank Cards -->
                <div class="text-xs mb-2 mt-4" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">银行卡（可勾选具体卡）</div>
                <div class="border rounded-lg overflow-hidden transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
                    <div class="flex items-center justify-between p-3 cursor-pointer transition-colors" 
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#334155] text-white' : 'bg-gray-50 text-gray-900'"
                        @click="showBankCards = !showBankCards">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-credit-card text-[#4285f4]"></i>
                            <span>银行卡优先</span>
                        </div>
                        <i :class="['fa-solid', showBankCards ? 'fa-chevron-up' : 'fa-chevron-down', 'text-gray-500']"></i>
                    </div>
                    
                    <!-- Bank Card List -->
                    <div v-if="showBankCards" class="space-y-1 transition-colors" :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/10' : 'bg-white'">
                        <div v-if="walletStore.bankCards.length === 0" class="p-4 text-xs text-gray-500">
                            暂无银行卡
                        </div>
                        <div v-for="card in walletStore.bankCards" :key="card.id" class="flex items-center justify-between p-3 text-sm border-t hover:bg-white/5 transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'border-white/5 text-gray-400' : 'border-gray-100 text-gray-700'">
                            <div class="flex items-center gap-2">
                                <div :class="`w-3 h-3 rounded-full`" :style="{ backgroundColor: card.theme === 'red' ? '#ea4335' : '#4285f4' }"></div>
                                <div>
                                    <div class="font-medium" :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : ''">{{ card.bankName }}</div>
                                    <div class="text-xs opacity-60">**** **** **** {{ card.number.slice(-4) }}</div>
                                </div>
                            </div>
                            <input type="radio" v-model="walletStore.paymentSettings.selectedCardId" :value="card.id" class="accent-[#07c160]" @change="changeDefaultMethod('bank')">
                        </div>
                    </div>
                </div>
            </div>

            <button @click="showSettings = false" class="w-full py-3 rounded-lg font-bold transition-all active:scale-95 mt-auto"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">
                关闭
            </button>
        </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
.animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.animate-slide-up { animation: slideUp 0.3s ease-out; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
</style>
