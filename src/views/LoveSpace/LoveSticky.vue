<template>
  <div class="love-sticky">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>便利贴墙</h2>
      <button @click="showAddModal = true" class="add-btn">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>

    <div class="sticky-wall">
      <div v-if="stickies.length === 0" class="empty-wall">
        <div class="empty-icon">🩹</div>
        <p>墙上空空的，写点贴纸告诉 TA 吧~</p>
      </div>

      <div 
        v-for="note in stickies" 
        :key="note.id" 
        class="sticky-note" 
        :style="{ backgroundColor: note.color, transform: `rotate(${note.rotation}deg)` }"
      >
        <button class="delete-note-btn" @click.stop="deleteSticky(note.id)">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="note-content">{{ note.content }}</div>
        <div class="note-footer">
          <img :src="getAvatar(note.author)" class="author-avatar">
          <span class="note-date">{{ formatDetailedDate(note.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 添加弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>留下你的贴纸</h3>
        <textarea 
          v-model="newContent" 
          placeholder="写下你想对 TA 说的话..." 
          maxlength="50"
          class="note-textarea"
        ></textarea>
        
        <div class="color-picker">
          <div 
            v-for="c in colors" 
            :key="c" 
            class="color-circle" 
            :style="{ backgroundColor: c }"
            :class="{ active: selectedColor === c }"
            @click="selectedColor = c"
          ></div>
        </div>

        <div class="modal-actions">
          <button @click="showAddModal = false" class="cancel-btn">不留了</button>
          <button @click="saveSticky" :disabled="!newContent.trim()" class="save-btn">贴上去</button>
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

const stickies = computed(() => loveSpaceStore.stickies || [])
const showAddModal = ref(false)
const newContent = ref('')
const selectedColor = ref('#fff9c4')

const colors = ['#fff9c4', '#ffccbc', '#f1f8e9', '#e1f5fe', '#f3e5f5', '#ffebee'];

function getAvatar(author) {
  if (author === 'user') return settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg'
  return loveSpaceStore.partner?.avatar || '/avatars/default.jpg'
}

function formatDetailedDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

async function deleteSticky(id) {
  await loveSpaceStore.deleteSticky(id)
}

async function saveSticky() {
  if (!newContent.value.trim()) return

  await loveSpaceStore.addSticky({
    content: newContent.value,
    color: selectedColor.value,
    author: 'user',
    rotation: Math.random() * 10 - 5 // 随机旋转 -5 到 5 度
  })

  newContent.value = ''
  showAddModal.value = false
}
</script>

<style scoped>
.love-sticky {
  height: 100vh;
  background: #f0f0f0;
  display: flex;
  flex-direction: column;
  background-image: 
    radial-gradient(#d1d1d1 1px, transparent 1px),
    linear-gradient(to right, #e5e5e5 1px, transparent 1px),
    linear-gradient(to bottom, #e5e5e5 1px, transparent 1px);
  background-size: 20px 20px;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.back-btn, .add-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #5a5a7a;
  cursor: pointer;
}

h2 {
  font-size: 18px;
  color: #5a5a7a;
  margin: 0;
}

.sticky-wall {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: masonry;
  gap: 16px;
  perspective: 1000px;
}

.sticky-note {
  aspect-ratio: 1;
  padding: 16px;
  box-shadow: 2px 5px 15px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.delete-note-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: rgba(0,0,0,0.05);
  border: none;
  border-radius: 50%;
  color: #888;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
  cursor: pointer;
  transition: all 0.2s;
}

.sticky-note:hover .delete-note-btn {
  opacity: 1;
}

.delete-note-btn:hover {
  background: #ff4d4f;
  color: white;
}

.sticky-note:active {
  transform: scale(1.05) rotate(0) !important;
  z-index: 10;
}

.note-content {
  flex: 1;
  font-family: 'Kaiti', 'STKaiti', serif;
  font-size: 15px;
  line-height: 1.5;
  color: #444;
  overflow: hidden;
}

.note-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid white;
}

.note-date {
  font-size: 10px;
  color: #888;
}

.empty-wall {
  grid-column: span 2;
  text-align: center;
  padding: 100px 0;
  color: #aaa;
}

.empty-icon { font-size: 50px; opacity: 0.3; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
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
  max-width: 360px;
}

h3 { text-align: center; color: #5a5a7a; margin-bottom: 20px; }

.note-textarea {
  width: 100%;
  height: 120px;
  padding: 16px;
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 12px;
  resize: none;
  font-family: inherit;
  margin-bottom: 20px;
  outline: none;
}

.color-picker {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
}

.color-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  cursor: pointer;
}

.color-circle.active {
  border-color: #5a5a7a;
  transform: scale(1.1);
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 12px;
  border-radius: 100px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn { background: #f5f5f5; color: #888; }
.save-btn { background: #5a5a7a; color: white; }
</style>
