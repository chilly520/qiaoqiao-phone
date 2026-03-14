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
        :style="{ backgroundColor: note.color || '#fff9c4' }"
        :data-color="note.color"
      >
        <button class="delete-note-btn" @click.stop="deleteSticky(note.id)">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="note-content" v-html="note.content"></div>
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

const stickies = computed(() => {
  const list = loveSpaceStore.stickies || []
  // 为旧数据添加默认颜色
  return list.map(note => ({
    ...note,
    color: note.color || '#fff9c4'  // 柠檬黄默认色
  }))
})
const showAddModal = ref(false)
const newContent = ref('')
const selectedColor = ref('#fff9c4')

const colors = [
  '#fff5e6',  // 奶油杏
  '#e8f5e9',  // 薄荷绿
  '#f3e5f5',  // 香芋紫
  '#e3f2fd',  // 天空蓝
  '#fce4ec',  // 樱花粉
  '#fff9c4',  // 柠檬黄
  '#ffe0b2',  // 蜜桃橙
  '#e0f7fa'   // 冰川蓝
];

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
  /* 小清新渐变背景 */
  background: 
    linear-gradient(135deg, rgba(255, 249, 196, 0.2) 0%, rgba(255, 255, 255, 0) 50%),
    linear-gradient(to bottom right, #fffde7 0%, #f1f8e9 50%, #f3e5f5 100%);
  background-size: 100% 100%, 200% 200%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 添加装饰性背景元素 */
.love-sticky::before {
  content: '';
  position: fixed;
  top: -30%;
  left: -10%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(255, 235, 59, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  animation: stickyBgFloat 10s ease-in-out infinite;
}

.love-sticky::after {
  content: '';
  position: fixed;
  bottom: -25%;
  right: -15%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(156, 199, 58, 0.06) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  animation: stickyBgFloat 12s ease-in-out infinite reverse;
}

@keyframes stickyBgFloat {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(30px, -30px) scale(1.08);
  }
}

/* 方格纸背景 */
.love-sticky .sticky-wall {
  background-image: 
    linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: center center;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(255, 182, 193, 0.15);
  border-bottom: 2px solid rgba(255, 182, 193, 0.2);
  position: relative;
  z-index: 10;
}

.back-btn, .add-btn {
  background: linear-gradient(135deg, #fff 0%, #fff5f7 100%);
  border: 2px solid rgba(255, 182, 193, 0.4);
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(255, 182, 193, 0.25);
}

.back-btn:hover, .add-btn:hover {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  border-color: #ff6b9d;
  color: white;
  transform: scale(1.12) rotate(-10deg);
  box-shadow: 0 6px 18px rgba(255, 182, 193, 0.45);
}

h2 {
  font-size: 18px;
  color: #ff6b9d;
  margin: 0;
  font-weight: 900;
  letter-spacing: 2px;
  font-family: "huangkaihuaLawyerfont", cursive;
  text-shadow: 1px 1px 2px rgba(255, 182, 193, 0.2);
}

.sticky-wall {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 40px;
  background-image: linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: center center;
}

.sticky-note {
  min-height: 180px !important;
  max-height: 280px !important;
  padding: 14px !important;
  display: flex !important;
  flex-direction: column !important;
  position: relative !important;
  border-radius: 0 !important;
  overflow: hidden !important;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.08) !important;
  border: 2px solid rgba(0,0,0,0.12) !important;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease !important;
  /* 背景色由内联样式控制 */
}

/* 便利贴内容层，确保在背景之上 */
.sticky-note .note-content {
  position: relative;
  z-index: 10;
}

/* 删除按钮，在内容之上 */
.sticky-note .delete-note-btn {
  position: absolute;
  z-index: 11;
}

/* 底部信息，在内容之上 */
.sticky-note .note-footer {
  position: relative;
  z-index: 10;
}

.sticky-note:hover {
  transform: translate(-3px, -3px) scale(1.02) !important;
  box-shadow: 6px 6px 0 rgba(0,0,0,0.12) !important;
  z-index: 10;
}

.delete-note-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.98);
  border: 2px solid rgba(255, 107, 157, 0.4);
  border-radius: 50%;
  color: #ff6b9d;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.2);
}

.sticky-note:hover .delete-note-btn {
  opacity: 1;
}

.delete-note-btn:hover {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fa3 100%);
  border-color: #ff6b9d;
  color: white;
  transform: scale(1.15) rotate(90deg);
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.4);
}

.sticky-note::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 50px;
  height: 10px;
  background: linear-gradient(90deg, rgba(255, 182, 193, 0.3), rgba(255, 107, 157, 0.2), rgba(255, 182, 193, 0.3));
  border-radius: 0 0 6px 6px;
  opacity: 0.7;
  box-shadow: 0 2px 4px rgba(255, 107, 157, 0.15);
  z-index: 5;
}

.sticky-note:active {
  transform: scale(1.05) !important;
  z-index: 10;
}

.note-content {
  flex: 1;
  font-family: 'Kaiti', 'STKaiti', serif;
  font-size: 14px;
  line-height: 1.7;
  color: #4a4a4a;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-all;
  display: flex;
  align-items: flex-start;
  font-weight: 500;
  max-width: 100%;
  /* 添加白色背景，确保文字清晰可见 */
  background: rgba(255, 255, 255, 0.95);
  padding: 8px;
  border-radius: 8px;
  position: relative;
  z-index: 10;
}

.note-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid rgba(255, 107, 157, 0.15);
}

.author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  object-fit: cover;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.note-date {
  font-size: 11px;
  color: #b8a5b4;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  letter-spacing: 0.5px;
}

.empty-wall {
  grid-column: span 2;
  text-align: center;
  padding: 100px 0;
  color: #b8a5b4;
}

.empty-icon { 
  font-size: 60px; 
  opacity: 0.3;
  animation: emptyIconFloat 3s ease-in-out infinite;
}

@keyframes emptyIconFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}

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

/* 移动端适配 */
@media (max-width: 480px) {
  .love-sticky {
    padding: 0;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  h2 {
    font-size: 16px;
  }
  
  .back-btn, .add-btn {
    font-size: 18px;
    padding: 8px;
  }
  
  .sticky-wall {
    padding: 12px;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 20px;
  }
  
  /* 强制覆盖内联样式和 !important */
  .sticky-wall .sticky-note {
    width: 100% !important;
    padding: 12px !important;
    min-height: 160px !important;
    max-height: 240px !important;
    height: auto !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  
  .sticky-wall .sticky-note .note-content {
    font-size: 12px !important;
    line-height: 1.5 !important;
    max-width: 100% !important;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    word-break: break-all !important;
  }
  
  .delete-note-btn {
    width: 20px;
    height: 20px;
    font-size: 14px;
  }
  
  .note-content {
    font-size: 13px;
    line-height: 1.4;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  .author-avatar {
    width: 16px;
    height: 16px;
  }
  
  .note-date {
    font-size: 9px;
  }
  
  .empty-wall {
    padding: 60px 0;
  }
  
  .empty-icon {
    font-size: 40px;
  }
  
  .modal {
    padding: 20px;
    width: 95%;
  }
  
  h3 {
    font-size: 16px;
    margin-bottom: 16px;
  }
  
  .note-textarea {
    height: 100px;
    padding: 12px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  
  .color-picker {
    gap: 10px;
    margin-bottom: 20px;
  }
  
  .color-circle {
    width: 26px;
    height: 26px;
  }
  
  .modal-actions {
    gap: 10px;
  }
  
  .cancel-btn, .save-btn {
    padding: 10px;
    font-size: 13px;
  }
}
</style>
