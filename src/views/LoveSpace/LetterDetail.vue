<template>
  <div class="letter-detail animate-fade-in" v-if="letter">
    <div class="header">
      <button @click="$router.push('/couple/letter')" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>书信详情</h2>
      <button class="delete-letter-btn-detail" @click="confirmDelete" title="删除此信">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>

    <!-- 装饰花边 -->
    <div class="detail-decorations">
      <div class="grid-particle" v-for="n in 15" :key="n" :style="getParticleStyle(n)"></div>
    </div>

    <div class="letter-paper" :style="{'--letter-paper-bg': 'url(\'' + currentLetterPaper + '\')'}">
      <div class="paper-scroll-area">
        <div class="paper-content" :class="[`paper-${letterPaperIndex}`]">
          <h3 class="paper-title font-handwritten">{{ letter.title }}</h3>
          <div class="body-text font-handwritten">{{ letter.content }}</div>
          <div class="paper-footer">
            <p class="sign font-handwritten">—— 写信人：{{ letter.author === 'user' ? currentUserName : (loveSpaceStore.partner?.name || 'TA') }}</p>
            <p class="date">{{ formatFullDate(letter.createdAt) }}</p>
            <p class="author-badge" v-if="letter.author === 'character'">
              <i class="fa-solid fa-crown"></i> {{ loveSpaceStore.partner?.name || 'TA' }} 的亲笔信
            </p>
          </div>
        </div>

        <!-- 评论区：移回滚动区域，仅在滑动到底部时可见 -->
        <div class="letter-comments">
          <div class="comment-count">
            <i class="fa-regular fa-comment-dots"></i> {{ letter.comments?.length || 0 }} 条互动
          </div>
          <div class="comment-list" v-if="letter.comments?.length">
            <div v-for="c in letter.comments" :key="c.id" class="comment-item">
              <span class="comment-author">{{ c.authorName }}:</span>
              <span class="comment-text">{{ c.text }}</span>
            </div>
          </div>
          <div class="comment-input-area">
            <input v-model="newComment" placeholder="给这封信留个言吧..." @keyup.enter="addComment">
            <button @click="addComment" :disabled="!newComment.trim()">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义确认弹窗 -->
    <div v-if="showConfirmModal" class="modal-overlay" @click="showConfirmModal = false">
      <div class="modal-content" @click.stop>
        <h3>提示</h3>
        <p>确定要删除这封信吗？</p>
        <div class="modal-buttons">
          <button @click="confirmDeleteAction" class="confirm-btn">确定</button>
          <button @click="showConfirmModal = false" class="cancel-btn">取消</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="not-found">
    <p>未找到该信件</p>
    <button @click="$router.push('/couple/letter')">返回</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

const route = useRoute()
const router = useRouter()
const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const letterId = parseInt(route.params.id)

// 自定义弹窗状态
const showConfirmModal = ref(false)

// 随机信纸池 (13 张)
const randomLetterPapers = [
  '/images/mailbox/信纸 (1).jpg',
  '/images/mailbox/信纸 (2).jpg',
  '/images/mailbox/信纸 (3).jpg',
  '/images/mailbox/信纸 (4).jpg',
  '/images/mailbox/信纸 (5).jpg',
  '/images/mailbox/信纸 (6).jpg',
  '/images/mailbox/信纸 (7).jpg',
  '/images/mailbox/信纸 (8).jpg',
  '/images/mailbox/信纸 (9).jpg',
  '/images/mailbox/信纸 (10).jpg',
  '/images/mailbox/信纸 (11).jpg',
  '/images/mailbox/信纸 (12).jpg',
  '/images/mailbox/信纸 (13).jpg'
]

// 为每封信随机分配信纸（基于信件 ID 的哈希，确保每次打开同一封信显示相同信纸）
const getLetterPaper = (letterId) => {
  if (!letterId) return randomLetterPapers[0]
  const hash = Math.abs(letterId.toString().split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0
  }, 0))
  return randomLetterPapers[hash % randomLetterPapers.length]
}

const letter = computed(() => {
  return loveSpaceStore.letters.find(l => l.id === letterId)
})

const currentLetterPaper = computed(() => {
  if (letter.value?.paperIndex !== undefined) {
    return encodeURI(randomLetterPapers[letter.value.paperIndex % randomLetterPapers.length])
  }
  const paper = getLetterPaper(letterId)
  const encodedPaper = encodeURI(paper)
  console.log('信件详情页信纸路径 (已编码):', letterId, encodedPaper)
  return encodedPaper
})

const letterPaperIndex = computed(() => {
  let index
  if (letter.value?.paperIndex !== undefined) {
    index = letter.value.paperIndex % randomLetterPapers.length
  } else {
    const paper = getLetterPaper(letterId)
    index = randomLetterPapers.indexOf(paper)
    if (index === -1) index = 0
  }
  console.log('[LetterDetail] 信纸索引:', index, '信件 ID:', letterId, 'paperIndex:', letter.value?.paperIndex)
  return index
})

// 获取当前用户名称（从对应角色的“我的人设”获取）
const currentUserName = computed(() => {
  const partnerId = loveSpaceStore.currentPartnerId
  if (partnerId && chatStore.chats[partnerId]) {
    return chatStore.chats[partnerId].userName || settingsStore.personalization?.userProfile?.name || '我'
  }
  return settingsStore.personalization?.userProfile?.name || '我'
})

const newComment = ref('')

function formatFullDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function getParticleStyle(index) {
  const size = Math.random() * 6 + 3
  const left = Math.random() * 100
  const delay = Math.random() * 5
  const duration = Math.random() * 8 + 8
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`
  }
}

async function addComment() {
  if (!newComment.value.trim() || !letter.value) return
  
  await loveSpaceStore.addLetterComment(letter.value.id, {
    authorId: 'user',
    authorName: currentUserName.value,
    text: newComment.value
  })
  
  newComment.value = ''
}

function confirmDelete() {
  showConfirmModal.value = true
}

function confirmDeleteAction() {
  loveSpaceStore.deleteLetter(letter.value.id)
  showConfirmModal.value = false
  router.back()
}
</script>

<style scoped>
@import url("https://fontsapi.zeoseven.com/223/main/result.css");

.letter-detail {
  min-height: 100vh;
  background: linear-gradient(135deg, #fdfaf5 0%, #f5ebe0 100%);
  display: flex;
  flex-direction: column;
}

.header {
  padding: 15px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border-bottom: 1px solid #f0e6d6;
  position: relative;
}

.header h2 {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
}

.back-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #a67c52;
  cursor: pointer;
}

.header-placeholder { width: 20px; }

/* 装饰花边 */
.detail-decorations {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}

/* 网格粒子 */
.grid-particle {
  position: absolute;
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.5) 0%, rgba(255, 107, 157, 0.3) 100%);
  border-radius: 50%;
  animation: particleFloat linear infinite;
  box-shadow: 0 2px 6px rgba(255, 182, 193, 0.25);
}

@keyframes particleFloat {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100px) rotate(720deg);
    opacity: 0;
  }
}

h2 {
  font-size: 17px;
  color: #5d4037;
  font-weight: 800;
}

.letter-paper {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  margin: 15px;
  border-radius: 12px;
  box-shadow: 
    0 4px 20px rgba(166, 124, 82, 0.15),
    0 8px 40px rgba(166, 124, 82, 0.1);
  overflow: hidden;
  background: white;
  background-image: var(--letter-paper-bg) !important;
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
}

.paper-scroll-area {
  margin-top: 15vh;
  margin-bottom: 10vh; /* 强制正文底部留空 10% */
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.paper-content {
  padding: 0 30px 20px;
  line-height: 32px;
  position: relative;
}

.paper-content .body-text {
  min-height: 300px;
  padding: 10px 20px;
  border-radius: 8px;
  color: #2d1f1a;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(255, 255, 255, 0.6);
}

.paper-title {
  font-size: 26px;
  text-align: center;
  margin-bottom: 35px;
  margin-top: 10px; /* 给起始位置一点微调 */
  color: #2d1f1a;
  font-weight: 900;
  text-shadow: 0 2px 4px rgba(255, 255, 255, 0.9), 0 3px 8px rgba(255, 255, 255, 0.7);
  position: relative;
  animation: brushWrite 1.5s ease-out;
}

@keyframes brushWrite {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-10px);
    filter: blur(3px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

.body-text {
  font-size: 20px;
  color: #4e342e;
  white-space: pre-wrap;
  min-height: 300px;
  line-height: 2;
  position: relative;
  animation: fadeInText 2s ease-out;
  text-shadow: 1px 1px 2px rgba(166, 124, 82, 0.15);
}

/* 段落间距 */
.body-text p {
  margin: 1em 0;
}

/* 信纸 1、2、3 (索引 0、1、2) 是深色背景，使用白色文字 - 提高优先级 */
.letter-detail .paper-content.paper-0 .body-text,
.letter-detail .paper-content.paper-1 .body-text,
.letter-detail .paper-content.paper-2 .body-text {
  color: #ffffff !important;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6) !important;
  text-indent: 2em;
}

.letter-detail .paper-content.paper-0 .paper-title,
.letter-detail .paper-content.paper-1 .paper-title,
.letter-detail .paper-content.paper-2 .paper-title {
  color: #ffffff !important;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.6) !important;
}

.letter-detail .paper-content.paper-0 .sign,
.letter-detail .paper-content.paper-1 .sign,
.letter-detail .paper-content.paper-2 .sign {
  color: #ffffff !important;
}

.letter-detail .paper-content.paper-0 .date,
.letter-detail .paper-content.paper-1 .date,
.letter-detail .paper-content.paper-2 .date {
  color: #f0f0f0 !important;
}

@keyframes fadeInText {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.paper-footer {
  margin-top: 50px;
  text-align: right;
  padding-bottom: 20px;
  position: relative;
}

.paper-footer::before {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 150px;
  height: 1px;
  background: linear-gradient(to right, transparent, #e9e0d1, transparent);
}

.sign { 
  font-weight: 900; 
  color: #2d1f1a; 
  font-size: 18px;
  text-shadow: 0 1px 3px rgba(255, 255, 255, 0.8), 0 2px 5px rgba(255, 255, 255, 0.6);
}
.date { 
  font-size: 12px; 
  color: #3d2f2a; 
  margin-top: 8px;
  letter-spacing: 1px;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.author-badge {
  margin-top: 15px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 236, 139, 0.1) 100%);
  border: 2px solid rgba(255, 215, 0, 0.4);
  border-radius: 20px;
  color: #b8860b;
  font-size: 13px;
  font-weight: 700;
  display: inline-block;
  text-align: center;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
}

.author-badge i {
  margin-right: 6px;
  color: #ffd700;
}

.delete-letter-btn-detail {
  width: 36px;
  height: 36px;
  padding: 0;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.95) 0%, rgba(255, 135, 135, 0.95) 100%);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
}

.delete-letter-btn-detail:hover {
  transform: scale(1.15) rotate(-10deg);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
  background: linear-gradient(135deg, rgba(255, 107, 107, 1) 0%, rgba(255, 135, 135, 1) 100%);
}

.delete-letter-btn-detail:active {
  transform: scale(0.95) rotate(0deg);
}

/* 自定义弹窗样式 */
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
  z-index: 9999;
  animation: fadeIn 0.2s;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  min-width: 280px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s;
}

.modal-content h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #333;
}

.modal-content p {
  margin: 0 0 20px;
  color: #666;
  font-size: 15px;
  line-height: 1.5;
}

.modal-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-buttons button {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modal-buttons .confirm-btn {
  background: #dc3545;
  color: white;
}

.modal-buttons .confirm-btn:hover {
  background: #c82333;
}

.modal-buttons .cancel-btn {
  background: #e9ecef;
  color: #495057;
}

.modal-buttons .cancel-btn:hover {
  background: #dee2e6;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.font-handwritten {
  font-family: "huangkaihuaLawyerfont", cursive !important;
  font-weight: normal;
}

.letter-comments {
  background: rgba(255, 255, 255, 0.4); /* 回归通透感 */
  padding: 20px 25px;
  border-top: 1px dashed rgba(0, 0, 0, 0.05);
  margin-top: 20px;
  backdrop-filter: blur(5px);
  border-radius: 15px;
  margin: 20px 15px;
}

.comment-count {
  font-size: 12px;
  color: #a67c52;
  margin-bottom: 12px;
  font-weight: 700;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.comment-item {
  font-size: 14px;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.8);
  padding: 10px 15px;
  border-radius: 10px;
  border-left: 3px solid #ffb6c1;
  box-shadow: 0 2px 8px rgba(233, 224, 209, 0.3);
  transition: all 0.3s ease;
  animation: slideInComment 0.5s ease-out;
}

.comment-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(233, 224, 209, 0.4);
}

@keyframes slideInComment {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.comment-author {
  color: #a67c52;
  font-weight: 800;
  margin-right: 6px;
}

.comment-text { color: #5d4037; }

.comment-input-area {
  display: flex;
  gap: 12px;
  align-items: center;
}

.comment-input-area input {
  flex: 1;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(233, 224, 209, 0.6);
  padding: 10px 15px;
  border-radius: 25px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
  font-family: "huangkaihuaLawyerfont", cursive;
}

.comment-input-area input:focus {
  border-color: #ffb6c1;
  box-shadow: 0 0 15px rgba(255, 182, 193, 0.3);
  transform: translateY(-2px);
}

.comment-input-area button {
  background: linear-gradient(135deg, #ffb6c1 0%, #ff69b4 100%);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  min-width: 40px; /* 防止被挤压 */
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 182, 193, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.comment-input-area button:hover {
  transform: scale(1.1) rotate(15deg);
  box-shadow: 0 6px 20px rgba(255, 182, 193, 0.6);
}

.comment-input-area button:active {
  transform: scale(0.95);
}

.animate-fade-in {
  animation: fadeInPage 0.6s ease-out;
}

@keyframes fadeInPage {
  from { 
    opacity: 0; 
    transform: translateY(20px) scale(0.95);
  }
  to { 
    opacity: 1; 
    transform: translateY(0) scale(1);
  }
}

.not-found {
  padding: 50px;
  text-align: center;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .letter-detail {
    padding: 0;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  h2 {
    font-size: 16px;
  }
  
  .back-btn {
    font-size: 18px;
  }
  
  .delete-letter-btn-detail {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
  
  .letter-paper {
    margin: 12px;
    border-radius: 10px;
  }
  
  .paper-scroll-area {
    margin-top: 12vh;
    margin-bottom: 8vh;
  }
  
  .paper-content {
    padding: 0 20px 30px;
  }
  
  .paper-title {
    font-size: 22px;
    margin-bottom: 25px;
  }
  
  .body-text {
    font-size: 17px;
    line-height: 1.8;
    min-height: 200px;
  }
  
  .paper-footer {
    margin-top: 35px;
  }
  
  .sign {
    font-size: 16px;
  }
  
  .date {
    font-size: 11px;
  }
  
  .author-badge {
    font-size: 12px;
    padding: 6px 12px;
  }
  
  .letter-comments {
    padding: 20px;
  }
  
  .comment-count {
    font-size: 11px;
  }
  
  .comment-item {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .comment-input-area input {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .comment-input-area button {
    width: 36px;
    height: 36px;
    min-width: 36px; /* 防止在手机端被挤压 */
    font-size: 14px;
    flex-shrink: 0;
  }
}
</style>
