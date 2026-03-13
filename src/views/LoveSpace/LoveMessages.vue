<template>
  <div class="love-messages">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>甜蜜留言</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button @click="showAddModal = true" class="add-btn">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>

    <!-- 留言列表 -->
    <div class="messages-list">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">💌</div>
        <p>还没有留言呢，快给 TA 留第一条吧~</p>
      </div>
      <div v-for="msg in sortedMessages" :key="msg.id" class="message-card" :class="{ 'from-partner': msg.senderId !== 'user' }">
        <div class="msg-header">
          <img :src="getAvatar(msg)" class="msg-avatar">
          <div class="msg-info">
            <span class="sender-name">{{ getSenderName(msg) }}</span>
            <span class="msg-time">{{ formatDate(msg.createdAt) }}</span>
          </div>
          <div class="msg-actions-right">
            <button class="action-btn-mini" @click="prepareReply(msg)">
              <i class="fa-solid fa-reply"></i>
            </button>
            <button class="action-btn-mini delete" @click="deleteMessage(msg.id)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div v-if="msg.replyToId" class="reply-quote">
          <div class="quote-border"></div>
          <p class="quote-text">{{ getReplyTargetContent(msg.replyToId) }}</p>
        </div>
        <div class="msg-content">
          {{ msg.content }}
        </div>
      </div>
    </div>

    <!-- 发布弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal animate-pop-in">
        <h3>{{ replyTarget ? '回复 TA' : '发送新留言' }}</h3>
        <div v-if="replyTarget" class="reply-target-preview">
          回复：{{ replyTarget.content.substring(0, 30) }}...
        </div>
        <textarea v-model="newMessage" placeholder="想对 TA 说点什么呢？" class="msg-input"></textarea>
        <div class="modal-actions">
          <button @click="showAddModal = false" class="cancel-btn">取消</button>
          <button @click="sendNewMessage" :disabled="!newMessage.trim()" class="send-btn">发送</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'

const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()

const messages = computed(() => loveSpaceStore.messages || [])
const sortedMessages = computed(() => [...messages.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const showAddModal = ref(false)
const newMessage = ref('')

const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const userName = computed(() => settingsStore.personalization.userProfile.name || '用户')

function getAvatar(msg) {
  if (msg.senderId === 'user') return userAvatar.value
  return loveSpaceStore.partner?.avatar || '/avatars/default.jpg'
}

function getSenderName(msg) {
  if (msg.senderId === 'user') return userName.value
  return loveSpaceStore.partner?.name || 'TA'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const replyTarget = ref(null)

function getReplyTargetContent(id) {
  const target = messages.value.find(m => m.id === id)
  return target ? target.content : '原留言已消失...'
}

function prepareReply(msg) {
  replyTarget.value = msg
  showAddModal.value = true
}

const isGenerating = ref(false)

async function generateMagic() {
  if (isGenerating.value) return
  isGenerating.value = true
  try {
    await loveSpaceStore.generateMagicContent()
  } catch (e) {
    console.error('Magic generation failed', e)
  }
  isGenerating.value = false
}

async function sendNewMessage() {
  if (!newMessage.value.trim()) return
  
  await loveSpaceStore.addMessage({
    content: newMessage.value,
    senderId: 'user',
    senderName: userName.value,
    replyToId: replyTarget.value?.id
  })
  
  newMessage.value = ''
  replyTarget.value = null
  showAddModal.value = false
  
  // Optional: Auto trigger AI reply after user sends message
  // generateMagic()
}

async function deleteMessage(id) {
  loveSpaceStore.currentSpace.messages = loveSpaceStore.currentSpace.messages.filter(m => m.id !== id)
  await loveSpaceStore.saveToStorage()
}
</script>

<style scoped>
.love-messages {
  height: 100vh;
  background: #fff5f7;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.magic-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #ff6b9d;
  cursor: pointer;
  transition: all 0.3s;
}

.magic-btn.animating {
  animation: magicRotate 1s infinite linear;
  color: #c084fc;
}

@keyframes magicRotate {
  0% { transform: scale(1) rotate(0); filter: hue-rotate(0); }
  50% { transform: scale(1.2) rotate(180deg); filter: hue-rotate(90deg); }
  100% { transform: scale(1) rotate(360deg); filter: hue-rotate(0); }
}

.back-btn, .add-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
  padding: 5px;
}

h2 {
  font-size: 18px;
  color: #5a5a7a;
  margin: 0;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  -webkit-overflow-scrolling: touch;
}

.date-header {
  font-size: 13px;
  font-weight: 800;
  color: #ff6b9d;
  margin: 15px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, #ff9dbd33, transparent);
}

.delete-btn-tiny {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #ccc;
  font-size: 12px;
  cursor: pointer;
  padding: 4px;
}

.delete-btn-tiny:hover { color: #ff4d4f; }

.footprint-card {
  background: white;
  padding: 16px;
  border-radius: 12px 20px 20px 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  position: relative;
}

.message-card {
  background: white;
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message-card.from-partner {
  background: #fff9fa;
  border: 1px solid #ffecf0;
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  position: relative;
}

.msg-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fff5f7;
  box-shadow: 0 2px 6px rgba(255, 107, 157, 0.1);
}

.msg-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sender-name {
  font-size: 14px;
  font-weight: 700;
  color: #5a5a7a;
  margin-bottom: 2px;
}

.msg-time {
  font-size: 10px;
  color: #a89bb9;
  font-weight: 500;
}

.msg-actions-right {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
}

.action-btn-mini {
  background: none;
  border: none;
  color: #ff6b9d;
  opacity: 0.3;
  cursor: pointer;
  padding: 5px;
  transition: opacity 0.2s;
}

.action-btn-mini:hover { opacity: 1; }
.action-btn-mini.delete:hover { color: #ff4d4f; }

.reply-quote {
  background: #f8f8f8;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
}

.quote-border {
  width: 3px;
  background: #ffc2d1;
  border-radius: 10px;
}

.quote-text {
  font-size: 12px;
  color: #8b7aa8;
  margin: 0;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.reply-target-preview {
  font-size: 12px;
  color: #ff6b9d;
  background: #fff5f7;
  padding: 8px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Modal */
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

.modal {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

h3 {
  margin-bottom: 16px;
  text-align: center;
  color: #ff6b9d;
}

.msg-input {
  width: 100%;
  height: 120px;
  border: 1px solid #ffecf0;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 20px;
  resize: none;
  font-family: inherit;
  outline: none;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn, .send-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.send-btn {
  background: #ff6b9d;
  color: white;
}

.send-btn:disabled {
  opacity: 0.5;
}
</style>
