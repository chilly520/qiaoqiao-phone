<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { crypto } from 'node:crypto'

const chatStore = useChatStore()
const relativeCard = ref(null)

// 获取亲属卡数据
const getRelativeCardData = () => {
  const chatId = chatStore.currentChatId
  if (!chatId) return null
  
  const phoneData = chatStore.chats[chatId]?.phoneData
  if (!phoneData?.apps?.wallet?.relativeCards) return null
  
  let card = phoneData.apps.wallet.relativeCards.find(card => card.type === 'family')
  
  // 如果没有找到卡片，创建一个默认卡片并生成唯一ID
  if (!card) {
    card = {
      id: crypto.randomUUID(), // 生成唯一ID
      type: 'family',
      status: 'pending',
      cardNumber: '**** **** **** 1234',
      balance: '¥999,999.99',
      expiryDate: '2025-12',
      holderName: '用户姓名'
    }
  }
  
  return card
}

// 计算亲属卡状态
const cardStatus = computed(() => {
  const card = getRelativeCardData()
  if (!card) return 'pending'
  
  return card.status || 'active'
})

// 恢复黑金银行卡样式
const cardStyle = computed(() => {
  const card = getRelativeCardData()
  if (!card) return {}
  
  return {
    background: '#1a1a1a',
    border: '2px solid #ff6b00',
    boxShadow: '0 4px 8px rgba(255, 107, 0, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    color: '#fff',
    fontFamily: 'Arial, sans-serif'
  }
})

// 亲属卡详细信息
const cardDetails = computed(() => {
  const card = getRelativeCardData()
  if (!card) return {}
  
  return {
    cardNumber: card.cardNumber || '**** **** **** 1234',
    balance: card.balance || '¥999,999.99',
    expiryDate: card.expiryDate || '2025-12',
    holderName: card.holderName || '用户姓名',
    cardType: card.type || 'family'
  }
})

// 处理亲属卡申请
const handleApplyCard = () => {
  // 发送申请消息
  const message = '[申请亲属卡] 送我一张亲属卡好不好？以后你来管家~'
  chatStore.sendMessage(message)
}
</script>

<template>
  <div v-if="getRelativeCardData()" class="relative-card-container">
    <!-- 黑金银行卡样式 -->
    <div :style="cardStyle" class="relative-card">
      <div class="card-header">
        <div class="card-logo">🏦</div>
        <div class="card-title">黑金亲属卡</div>
        <div class="card-status" :class="cardStatus">
          {{ cardStatus === 'active' ? '已激活' : cardStatus === 'pending' ? '待审核' : '已失效' }}
        </div>
      </div>
      
      <div class="card-body">
        <div class="card-number">{{ cardDetails.cardNumber }}</div>
        <div class="card-balance">余额：{{ cardDetails.balance }}</div>
        <div class="card-info">
          <div>持卡人：{{ cardDetails.holderName }}</div>
          <div>有效期至：{{ cardDetails.expiryDate }}</div>
        </div>
      </div>
      
      <div class="card-footer">
        <div class="card-type">类型：{{ cardDetails.cardType }}</div>
        <div class="card-features">
          <span>无限额度</span>
          <span>全球免手续费</span>
          <span>专属客服</span>
        </div>
      </div>
    </div>
    
    <!-- 详情按钮 -->
    <button @click="handleApplyCard" class="apply-button">
      申请亲属卡
    </button>
  </div>
  
  <!-- 卡片未找到时的占位符 -->
  <div v-else class="card-placeholder">
    <div class="placeholder-icon">💳</div>
    <div class="placeholder-text">暂无亲属卡信息</div>
    <button @click="handleApplyCard" class="apply-button">
      立即申请
    </button>
  </div>
</template>

<style scoped>
.relative-card-container {
  margin: 16px;
  text-align: center;
}

.relative-card {
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.relative-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(255, 107, 0, 0.4);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-logo {
  font-size: 24px;
}

.card-title {
  font-size: 18px;
  font-weight: bold;
  margin: 0;
}

.card-status {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  min-width: 60px;
  text-align: center;
}

.card-status.active {
  background-color: #4CAF50;
  color: white;
}

.card-status.pending {
  background-color: #FFC107;
  color: black;
}

.card-status.inactive {
  background-color: #f44336;
  color: white;
}

.card-body {
  margin: 12px 0;
}

.card-number {
  font-size: 16px;
  font-weight: bold;
  margin: 8px 0;
}

.card-balance {
  font-size: 14px;
  color: #e91e63;
  margin: 8px 0;
}

.card-info {
  font-size: 12px;
  color: #ccc;
  margin: 8px 0;
}

.card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.card-type {
  font-size: 12px;
  color: #ddd;
  margin-bottom: 4px;
}

.card-features {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: #ddd;
}

.card-features span {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
}

.apply-button {
  margin-top: 16px;
  padding: 12px 24px;
  background-color: #ff6b00;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.apply-button:hover {
  background-color: #e65a00;
}

.card-placeholder {
  text-align: center;
  padding: 32px;
  color: #999;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.placeholder-text {
  font-size: 16px;
  margin-bottom: 16px;
}
</style>