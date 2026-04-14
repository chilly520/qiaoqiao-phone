<template>
  <div class="love-diary">
    <div class="header">
      <button @click="viewMode === 'reading' ? viewMode = 'toc' : $router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>{{ viewMode === 'toc' ? '日记目录' : '交换日记' }}</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button @click="showAddModal = true" class="add-btn">
          <i class="fa-solid fa-pen-nib"></i>
        </button>
      </div>
    </div>

    <div v-if="viewMode === 'toc'" class="toc-container">
      <div class="toc-title">秘密</div>
      
      <div v-if="diary.length === 0" class="empty-state">
        <p>还没有日记，快来写下第一篇吧</p>
      </div>
      
      <div class="toc-list" v-else>
        <div 
          v-for="(entry, index) in sortedDiary" 
          :key="entry.id" 
          class="toc-item" 
          @click="goToPage(index)"
        >
          <span class="toc-number">{{ String(index + 1).padStart(2, '0') }}.</span>
          <div class="toc-info">
            <span class="toc-snippet">{{ truncateText(entry.content, 12) }}</span>
            <span class="toc-date">{{ getMonth(entry.createdAt) }} {{ getDay(entry.createdAt) }} · {{ entry.authorName }}</span>
          </div>
          <div class="toc-dotted-line"></div>
          <span class="toc-page-ref">P{{ index + 1 }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="viewMode === 'reading'" class="book-container" @touchstart="onTouchStart" @touchend="onTouchEnd">
      <div class="book-spine"></div>
      
      <div class="book">
        <div 
          v-for="(entry, index) in sortedDiary" 
          :key="entry.id" 
          class="page"
          :class="{ 'is-flipped': index < currentPage }"
          :style="{ zIndex: sortedDiary.length - index }"
        >
          <div class="page-front">
            <div class="page-content">
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
                
                <!-- 评论区 -->
                <div class="diary-comments">
                  <div class="comment-count">
                    <i class="fa-regular fa-comment-dots"></i> {{ entry.comments?.length || 0 }} 条互动
                  </div>
                  <div class="comment-list" v-if="entry.comments?.length">
                    <div v-for="c in entry.comments" :key="c.id" class="comment-item">
                      <span class="comment-author">{{ c.authorName }}:</span>
                      <span class="comment-text">{{ c.text }}</span>
                    </div>
                  </div>
                  <div class="comment-input-area">
                    <input v-model="newComment" placeholder="给这篇日记留个言吧..." @keyup.enter="addComment">
                    <button @click="addComment" :disabled="!newComment.trim()">
                      <i class="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="page-number">- {{ index + 1 }} -</div>
            </div>
          </div>
          <div class="page-back"></div>
        </div>
      </div>
    </div>

    <div class="book-controls" v-if="viewMode === 'reading' && sortedDiary.length > 0">
      <button @click="prevPage" :disabled="currentPage === 0" class="page-btn">上一页</button>
      <span class="page-indicator">{{ currentPage + 1 }} / {{ sortedDiary.length }}</span>
      <button @click="nextPage" :disabled="currentPage >= sortedDiary.length - 1" class="page-btn">下一页</button>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal animate-pop-in">
        <div class="modal-header">
          <h3>亲爱的日记...</h3>
        </div>
        <textarea v-model="newEntry" placeholder="记下这一刻的思绪..." class="diary-input"></textarea>
        <div class="modal-actions">
          <button @click="showAddModal = false" class="cancel-btn">以后再说</button>
          <button @click="saveEntry" :disabled="!newEntry.trim()" class="save-btn">封存记录</button>
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
const sortedDiary = computed(() => [...diary.value].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))

const viewMode = ref('toc') // 'toc' 为目录视图, 'reading' 为阅读视图
const showAddModal = ref(false)
const newEntry = ref('')
const currentPage = ref(0)
const newComment = ref('') 

const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const userName = computed(() => settingsStore.personalization.userProfile.name || '用户')

const isGenerating = computed(() => loveSpaceStore.isMagicGenerating)

// 截断文本用于目录预览
function truncateText(text, length) {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

// 跳转到指定日记页
function goToPage(index) {
  currentPage.value = index
  viewMode.value = 'reading'
}

// 滑动翻页逻辑
let touchStartX = 0
function onTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX
}

function onTouchEnd(e) {
  const touchEndX = e.changedTouches[0].screenX
  const swipeDistance = touchStartX - touchEndX
  
  // 防止误触翻页（需要足够大的滑动距离）
  if (Math.abs(swipeDistance) > 50) {
    if (swipeDistance > 0) {
      nextPage()
    } else {
      prevPage()
    }
    e.preventDefault()
  }
}

function nextPage() {
  if (currentPage.value < sortedDiary.value.length - 1) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--
  }
}

async function generateMagic() {
  if (isGenerating.value) return
  try {
    const chatStore = (await import('@/stores/chatStore.js')).useChatStore()
    chatStore.triggerToast('正在为你凝聚恋爱日记... ✨', 'info')
    await loveSpaceStore.generateSingleFeature('diary')
  } catch (e) {
    console.error('Magic generation failed', e)
  }
}

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
  
  // 保存后自动切换到阅读模式，并翻到最后一页
  viewMode.value = 'reading'
  setTimeout(() => {
    currentPage.value = sortedDiary.value.length - 1
  }, 100)
}

async function deleteDiary(id) {
  loveSpaceStore.currentSpace.diary = loveSpaceStore.currentSpace.diary.filter(d => d.id !== id)
  await loveSpaceStore.saveToStorage()
  
  if (sortedDiary.value.length === 0) {
    viewMode.value = 'toc'
  } else if (currentPage.value >= sortedDiary.value.length && currentPage.value > 0) {
    currentPage.value--
  }
}

async function addComment() {
  const entry = sortedDiary.value[currentPage.value]
  if (!newComment.value.trim() || !entry) return
  
  await loveSpaceStore.addDiaryComment(entry.id, {
    authorId: 'user',
    authorName: userName.value,
    text: newComment.value
  })
  
  newComment.value = ''
  
  // 触发 AI 回复（异步，不阻塞 UI）
  loveSpaceStore.generateDiaryComment({
    ...entry,
    comments: entry.comments || []
  }).catch(err => console.error('[LoveDiary] generateDiaryComment error:', err))
}
</script>

<style scoped>
/* 外部字体：优先加载，失败时有优雅降级 */
@import url("https://fontsapi.zeoseven.com/223/main/result.css");

/* 手写体降级：外部字体加载失败时使用系统楷体 */
@font-face {
  font-family: "huangkaihuaLawyerfont";
  src: local("黄凯华律师体"), local("楷体"), local("KaiTi"), local("STKaiti");
}

.love-diary {
  height: 100vh;
  background: #fdfaf6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  z-index: 100;
}

.back-btn, .add-btn, .magic-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #c7a78e;
  cursor: pointer;
  padding: 5px;
}

.header-actions {
  display: flex;
  gap: 15px;
}

h2 {
  font-size: 18px;
  color: #8b7355;
  margin: 0;
  font-weight: normal;
  letter-spacing: 2px;
}

/* 目录视图样式 */
.toc-container {
  flex: 1;
  overflow-y: auto;
  margin: 10px 20px 30px 20px;
  background: #fffdf9;
  border-radius: 4px 12px 12px 4px;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.05);
  border-left: 6px solid #e8dcc8;
  padding: 30px 20px;
}

.toc-title {
  font-size: 28px;
  color: #8b7355;
  text-align: center;
  margin-bottom: 30px;
  font-family: Georgia, serif;
  letter-spacing: 4px;
  border-bottom: 1px solid #e8dcc8;
  padding-bottom: 20px;
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.toc-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  cursor: pointer;
}

.toc-number {
  font-size: 16px;
  color: #c7a78e;
  font-family: Georgia, serif;
  min-width: 35px;
}

.toc-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toc-snippet {
  font-size: 15px;
  color: #4a4036;
  font-weight: bold;
}

.toc-date {
  font-size: 12px;
  color: #b5a48f;
}

.toc-dotted-line {
  flex: 1;
  border-bottom: 1px dotted #d3c4b5;
  margin: 0 10px;
  position: relative;
  top: 5px;
}

.toc-page-ref {
  font-size: 14px;
  color: #b5a48f;
  font-family: Georgia, serif;
}

/* 书本容器核心样式 (保持不变) */
.book-container {
  flex: 1;
  position: relative;
  margin: 10px 20px 30px 30px;
  perspective: 1500px;
  display: flex;
  /* 关键修复：阻止容器自身滚动，让触摸事件完全交给翻页手势 */
  overflow: hidden;
  touch-action: pan-y;
}

.book-spine {
  position: absolute;
  left: -15px;
  top: 0;
  bottom: 0;
  width: 30px;
  background: linear-gradient(to right, #e3cba8, #f4e4c9, #e3cba8);
  border-radius: 5px 0 0 5px;
  box-shadow: inset -2px 0 5px rgba(0,0,0,0.1), 2px 0 5px rgba(0,0,0,0.2);
  z-index: 0;
}

.book {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.page {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  transition: transform 0.8s cubic-bezier(0.645, 0.045, 0.355, 1);
  transform-style: preserve-3d;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 2px 8px 8px 2px;
}

.page.is-flipped {
  transform: rotateY(-180deg);
}

.page-front, .page-back {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  backface-visibility: hidden;
  border-radius: 2px 8px 8px 2px;
}

.page-front {
  background: #fffdf9;
  background-image: linear-gradient(#f0ebe1 1px, transparent 1px);
  background-size: 100% 32px;
  background-position: 0 50px;
  border-left: 2px solid #e8dcc8;
}

.page-back {
  background: #faf6f0;
  transform: rotateY(180deg);
  box-shadow: inset 5px 0 10px rgba(0,0,0,0.05);
}

.page-content {
  padding: 30px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* 修复：允许长日记内容完整显示，不被裁切 */
  overflow-y: visible;
  /* 但限制在页面边界内 */
  max-height: calc(100% - 60px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.page-number {
  margin-top: auto;
  text-align: center;
  color: #ccc;
  font-size: 12px;
  padding-top: 20px;
}

/* 页面内部排版 */
.diary-date {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e8dcc8;
}

.day {
  font-size: 32px;
  font-family: Georgia, serif;
  color: #8b7355;
}

.month {
  font-size: 14px;
  color: #b5a48f;
  letter-spacing: 1px;
}

.diary-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.author-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1px solid #e8dcc8;
}

.author-name {
  font-size: 13px; color: #8b7355; font-weight: bold;
}

.delete-diary-btn {
  margin-left: auto; background: none; border: none;
  color: #d3c4b5; cursor: pointer; transition: color 0.3s;
}

.delete-diary-btn:hover { color: #ff6b9d; }

.diary-content {
  font-family: "huangkaihuaLawyerfont", cursive;
  font-size: 20px;
  color: #4e342e;
  line-height: 2;
  white-space: pre-wrap;
  text-shadow: 1px 1px 2px rgba(166, 124, 82, 0.15);
}

.diary-image-wrapper {
  margin-top: 20px; padding: 8px; background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); transform: rotate(-2deg);
}

.diary-image {
  width: 100%; max-height: 200px; object-fit: cover; display: block;
}

/* 评论区样式 */
.diary-comments {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px dashed #e8dcc8;
}

.comment-count {
  font-size: 12px;
  color: #a67c52;
  margin-bottom: 12px;
  font-weight: 700;
}

.comment-list {
  margin-bottom: 15px;
}

.comment-item {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.comment-author {
  color: #8b7355;
  font-weight: 600;
  margin-right: 6px;
}

.comment-text {
  color: #4a4036;
}

.comment-input-area {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.comment-input-area input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8dcc8;
  border-radius: 20px;
  font-size: 13px;
  background: white;
  outline: none;
}

.comment-input-area input:focus {
  border-color: #ff6b9d;
}

.comment-input-area button {
  padding: 8px 16px;
  background: #ff6b9d;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.comment-input-area button:hover {
  background: #ff528a;
  transform: scale(1.05);
}

.comment-input-area button:disabled {
  background: #e8dcc8;
  cursor: not-allowed;
  transform: none;
}

.empty-state {
  text-align: center;
  color: #c7a78e;
  padding: 40px 0;
}

/* 底部控制栏 */
.book-controls {
  padding: 15px 20px; display: flex;
  justify-content: space-between; align-items: center;
  background: transparent;
}

.page-btn {
  background: none; border: 1px solid #c7a78e; color: #8b7355;
  padding: 8px 16px; border-radius: 20px; font-size: 14px; cursor: pointer;
}

.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.page-indicator {
  color: #8b7355; font-size: 14px; letter-spacing: 2px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}

.modal {
  background: #fffdf9; border-radius: 12px; padding: 24px;
  width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

h3 {
  margin-bottom: 20px; text-align: center; color: #8b7355; font-weight: normal;
}

.diary-input {
  width: 100%; height: 180px; border: 1px solid #e8dcc8;
  background: transparent; padding: 15px; margin-bottom: 20px;
  resize: none; font-family: inherit; outline: none; line-height: 1.6;
}

.modal-actions { display: flex; gap: 12px; }

.cancel-btn, .save-btn {
  flex: 1; padding: 12px; border-radius: 8px; border: none;
  font-size: 14px; cursor: pointer;
}

.cancel-btn { background: #f0ebe1; color: #8b7355; }
.save-btn { background: #c7a78e; color: white; }
.save-btn:disabled { opacity: 0.5; }

/* 动画 */
@keyframes magic-spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

.magic-btn.animating i { animation: magic-spin 1.5s infinite linear; }
</style>