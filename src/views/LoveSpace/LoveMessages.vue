<template>
  <div class="love-messages">
    <!-- 头部 -->
    <div class="messages-header">
      <button class="back-btn" @click="goBack">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h1>💌 甜蜜留言</h1>
      <button class="add-btn" @click="showAddModal = true">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>

    <!-- 便利贴墙 -->
    <div class="message-wall">
      <div 
        v-for="message in sortedMessages" 
        :key="message.id"
        class="message-sticky"
        :style="{ 
          backgroundColor: getRandomColor(message.colorIndex),
          transform: `rotate(${getRandomRotation(message.id)}deg)`
        }">
        
        <div class="sticky-content">
          <p class="sticky-text">{{ message.content }}</p>
          <div class="sticky-footer">
            <span class="sticky-date">{{ formatDate(message.createdAt) }}</span>
            <button class="delete-btn" @click="deleteMessage(message)">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="messages.length === 0" class="empty-wall">
        <div class="empty-icon">💌</div>
        <p>还没有留言</p>
        <button class="first-message-btn" @click="showAddModal = true">
          <i class="fa-solid fa-plus"></i>
          写第一张留言
        </button>
      </div>
    </div>

    <!-- 添加留言弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h3>💕 写留言</h3>
        
        <div class="color-picker">
          <label>选择颜色</label>
          <div class="color-options">
            <div 
              v-for="(color, index) in colorOptions" 
              :key="index"
              class="color-option"
              :class="{ selected: selectedColorIndex === index }"
              @click="selectedColorIndex = index"
              :style="{ background: color }">
            </div>
          </div>
        </div>
        
        <textarea 
          v-model="newMessageContent"
          class="message-input"
          placeholder="想对 TA 说什么..."
          rows="4"></textarea>
        
        <div class="modal-actions">
          <button class="cancel-btn" @click="showAddModal = false">取消</button>
          <button class="send-btn" @click="sendMessage">
            <i class="fa-solid fa-paper-plane"></i>
            发送
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'

const router = useRouter()
const loveSpaceStore = useLoveSpaceStore()

// 状态
const showAddModal = ref(false)
const newMessageContent = ref('')
const selectedColorIndex = ref(0)

const colorOptions = [
  '#ffecd2', // 蜜桃粉
  '#a8edea', // 薄荷绿
  '#fed6e3', // 樱花粉
  '#ff9a9e', // 珊瑚红
  '#fecfef', // 淡紫
  '#a18cd1', // 薰衣草紫
  '#fbc2eb', // 玫瑰粉
  '#e0c3fc', // 浅紫
]

// 计算属性
const messages = computed(() => loveSpaceStore.messages)

const sortedMessages = computed(() => {
  return [...messages.value].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  )
})

// 方法
function goBack() {
  router.back()
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}.${day} ${hour}:${minute}`
}

function getRandomColor(index) {
  if (index !== undefined && colorOptions[index]) {
    return colorOptions[index]
  }
  return colorOptions[Math.floor(Math.random() * colorOptions.length)]
}

function getRandomRotation(id) {
  // 使用 ID 生成固定的旋转角度，避免每次渲染都变化
  const hash = id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return (hash % 7) - 3 // -3 到 3 度之间
}

function sendMessage() {
  if (!newMessageContent.value.trim()) {
    alert('请写点什么吧~')
    return
  }
  
  loveSpaceStore.addMessage({
    content: newMessageContent.value,
    colorIndex: selectedColorIndex.value
  })
  
  newMessageContent.value = ''
  showAddModal.value = false
}

function deleteMessage(message) {
  if (confirm('确定要删除这张留言吗？')) {
    const index = messages.value.findIndex(m => m.id === message.id)
    if (index !== -1) {
      loveSpaceStore.messages.splice(index, 1)
    }
  }
}
</script>

<style scoped>
.love-messages {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff5f7 0%, #ffe6eb 100%);
  padding: 20px;
}

.messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.2);
}

.messages-header h1 {
  font-size: 20px;
  color: #ff6b9d;
  margin: 0;
}

.add-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
  font-size: 20px;
}

.message-wall {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
}

.message-sticky {
  width: 200px;
  min-height: 200px;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  position: relative;
}

.message-sticky:hover {
  transform: scale(1.05);
  z-index: 10;
}

.sticky-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sticky-text {
  flex: 1;
  font-size: 14px;
  color: #5a5a7a;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.sticky-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.5);
}

.sticky-date {
  font-size: 11px;
  color: rgba(90, 90, 122, 0.6);
}

.delete-btn {
  background: none;
  border: none;
  color: rgba(255, 107, 157, 0.6);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.delete-btn:hover {
  color: #ff6b9d;
}

.empty-wall {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-wall p {
  font-size: 15px;
  color: #8b7aa8;
  margin-bottom: 20px;
}

.first-message-btn {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  border-radius: 50px;
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

.modal-content h3 {
  font-size: 18px;
  color: #ff6b9d;
  margin-bottom: 20px;
  text-align: center;
}

.color-picker {
  margin-bottom: 16px;
}

.color-picker label {
  display: block;
  font-size: 13px;
  color: #8b7aa8;
  margin-bottom: 8px;
  font-weight: 500;
}

.color-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.color-option {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: #ff6b9d;
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
}

.message-input {
  width: 100%;
  padding: 12px;
  border: 2px solid rgba(255, 107, 157, 0.3);
  border-radius: 12px;
  font-size: 14px;
  color: #5a5a7a;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.send-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.send-btn {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
