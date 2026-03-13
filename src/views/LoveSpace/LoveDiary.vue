<template>
  <div class="love-diary">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>交换日记</h2>
      <button @click="showAddModal = true" class="add-btn">
        <i class="fa-solid fa-pen-nib"></i>
      </button>
    </div>

    <!-- 日记列表 -->
    <div class="diary-list">
      <div v-if="diary.length === 0" class="empty-state">
        <div class="empty-icon">📔</div>
        <p>还没有日记呢，快记录今天的甜蜜吧~</p>
      </div>
      
      <div v-for="entry in sortedDiary" :key="entry.id" class="diary-card">
        <div class="diary-date">
          <span class="day">{{ getDay(entry.createdAt) }}</span>
          <span class="month">{{ getMonth(entry.createdAt) }}</span>
        </div>
        <div class="diary-body">
          <div class="diary-meta">
            <img :src="getAvatar(entry)" class="author-avatar">
            <span class="author-name">{{ entry.authorName }}</span>
            <button class="delete-diary-btn" @click="deleteDiary(entry.id)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          <div class="diary-content">{{ entry.content }}</div>
          <div v-if="entry.image" class="diary-image-wrapper">
            <img :src="entry.image" class="diary-image">
          </div>
        </div>
      </div>
    </div>

    <!-- 写日记弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal animate-pop-in">
        <div class="modal-header">
          <span class="modal-icon">✍️</span>
          <h3>亲爱的日记...</h3>
        </div>
        <textarea v-model="newEntry" placeholder="记下这一刻的甜意..." class="diary-input"></textarea>
        <div class="modal-actions">
          <button @click="showAddModal = false" class="cancel-btn">以后再说</button>
          <button @click="saveEntry" :disabled="!newEntry.trim()" class="save-btn">封存甜蜜</button>
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

const diary = computed(() => loveSpaceStore.diary || [])
const sortedDiary = computed(() => [...diary.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const showAddModal = ref(false)
const newEntry = ref('')

const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const userName = computed(() => settingsStore.personalization.userProfile.name || '用户')

function getAvatar(entry) {
  if (entry.authorId === 'user') return userAvatar.value
  return loveSpaceStore.partner?.avatar || '/avatars/default.jpg'
}

function getDay(dateStr) {
  return new Date(dateStr).getDate().toString().padStart(2, '0')
}

function getMonth(dateStr) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return months[new Date(dateStr).getMonth()]
}

async function saveEntry() {
  if (!newEntry.value.trim()) return
  
  await loveSpaceStore.addDiary({
    content: newEntry.value,
    authorId: 'user',
    authorName: userName.value
  })
  
  newEntry.value = ''
  showAddModal.value = false
}

async function deleteDiary(id) {
  loveSpaceStore.currentSpace.diary = loveSpaceStore.currentSpace.diary.filter(d => d.id !== id)
  await loveSpaceStore.saveToStorage()
}
</script>

<style scoped>
.love-diary {
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

.diary-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.diary-card {
  display: flex;
  gap: 15px;
}

.diary-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-width: 50px;
}

.day {
  font-size: 28px;
  font-weight: 900;
  color: #ff6b9d;
  line-height: 1;
}

.month {
  font-size: 11px;
  font-weight: 700;
  color: #a89bb9;
  letter-spacing: 2px;
}

.diary-body {
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(255, 107, 157, 0.08);
  position: relative;
  background-image: linear-gradient(#f0f0f0 1.1px, transparent 1.1px);
  background-size: 100% 28px;
  line-height: 28px;
}

.diary-body::after {
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 20px;
  background: rgba(255, 107, 157, 0.2);
  border-radius: 4px;
}

.diary-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  line-height: 1;
}

.delete-diary-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: #ccc;
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
  transition: color 0.2s;
}

.delete-diary-btn:hover { color: #ff4d4f; }

.author-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.author-name {
  font-size: 11px;
  color: #ff6b9d;
  font-weight: 800;
  opacity: 0.8;
}

.diary-content {
  font-family: 'Zhi Mang Xing', 'Long Cang', 'Kaiti', 'STKaiti', cursive, serif;
  font-size: 19px;
  color: #5a5a7a;
  white-space: pre-wrap;
  padding-top: 4px;
  line-height: 28px;
}

.diary-image-wrapper {
  margin-top: 15px;
  border-radius: 12px;
  overflow: hidden;
  border: 3px solid white;
  box-shadow: 0 5px 15px rgba(0,0,0,0.05);
  transform: rotate(-1deg);
}

.diary-image {
  width: 100%;
  max-height: 250px;
  object-fit: cover;
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

.diary-input {
  width: 100%;
  height: 180px;
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

.cancel-btn, .save-btn {
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

.save-btn {
  background: #ff6b9d;
  color: white;
}

.save-btn:disabled {
  opacity: 0.5;
}
</style>
