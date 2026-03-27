<template>
  <div class="soul-question-page">
    <!-- 顶部导航栏 - 毛玻璃效果 -->
    <div class="header">
      <div class="header-content">
        <div class="header-left" @click="$emit('back')">
          <i class="fa-solid fa-chevron-left"></i>
        </div>
        <div class="header-title">灵魂提问</div>
        <div class="header-right">
          <button class="icon-btn refresh" @click="refreshQuestions" :class="{ 'rotating': isRefreshing }">
            <i class="fa-solid fa-rotate"></i>
          </button>
          <button class="icon-btn add" @click="showProposeModal = true">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
      
      <!-- 符合人体工学的标签切换 -->
      <div class="tab-switcher">
        <div 
          class="tab-item" 
          :class="{ active: activeTab === 'all' }" 
          @click="activeTab = 'all'"
        >
          心声动态
          <div class="active-bar"></div>
        </div>
        <div 
          class="tab-item" 
          :class="{ active: activeTab === 'pending' }" 
          @click="activeTab = 'pending'"
        >
          待我回应
          <span v-if="pendingCount > 0" class="badge">{{ pendingCount }}</span>
          <div class="active-bar"></div>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-scroll">
      <transition-group name="list" tag="div" class="question-list">
        <!-- 循环渲染问题卡片 -->
        <div 
          v-for="q in filteredQuestions" 
          :key="q.id" 
          class="question-card"
          :class="{ 'is-new': isRecent(q.createdAt) }"
        >
          <!-- 提问者信息栏 -->
          <div class="card-header">
            <img :src="getAvatar(q.authorId)" class="author-avatar" />
            <div class="author-meta">
              <div class="author-name">
                {{ q.authorName || '神秘嘉宾' }}
                <span class="action-label">发起了提问</span>
              </div>
              <div class="timestamp">{{ formatDate(q.createdAt) }}</div>
            </div>
            <div class="status-icon" :class="getStatusClass(q)">
              <i :class="getStatusIcon(q)"></i>
            </div>
          </div>

          <!-- 问题内容主体 -->
          <div class="question-body">
            <div class="quote-mark top"><i class="fa-solid fa-quote-left"></i></div>
            <p class="question-text">{{ q.text }}</p>
            <div class="quote-mark bottom"><i class="fa-solid fa-quote-right"></i></div>
          </div>

          <!-- 回答区域 -->
          <div class="answers-stack">
            <!-- 自己的回答 -->
            <div v-if="q.userAnswer" class="answer-item user">
              <div class="answer-header">
                <img :src="userAvatar" class="mini-avatar" />
                <span class="name">我</span>
                <span class="time">{{ formatDate(q.userAnswerAt) }}</span>
              </div>
              <div class="answer-bubble">
                {{ q.userAnswer }}
              </div>
            </div>

            <!-- TA的回答 -->
            <div v-if="q.partnerAnswer" class="answer-item partner">
              <div class="answer-header">
                <img :src="partnerAvatar" class="mini-avatar" />
                <span class="name">{{ partnerName }}</span>
                <span class="time">{{ formatDate(q.partnerAnswerAt) }}</span>
              </div>
              <div class="answer-bubble">
                {{ q.partnerAnswer }}
              </div>
            </div>

            <!-- 等待回应状态 -->
            <div v-if="!q.partnerAnswer && q.authorId === 'user'" class="waiting-partner">
              <div class="pulse-icon"></div>
              <span>期待 TA 的心声中...</span>
            </div>

            <!-- 需要我回答 -->
            <div v-if="!q.userAnswer" class="my-reply-zone">
              <textarea 
                v-model="replyInputs[q.id]"
                class="reply-textarea"
                placeholder="这一刻，你想说些什么？"
                rows="2"
              ></textarea>
              <button 
                class="reply-submit" 
                @click="handleReply(q.id)"
                :disabled="!replyInputs[q.id]?.trim()"
              >
                <i class="fa-solid fa-paper-plane"></i>
                提交心声
              </button>
            </div>
          </div>
        </div>
      </transition-group>

      <!-- 空状态 -->
      <div v-if="filteredQuestions.length === 0" class="empty-state">
        <div class="empty-icon">✨</div>
        <p>{{ activeTab === 'pending' ? '太棒了！所有问题都已回应' : '还没有开启灵魂对话呢' }}</p>
        <button class="start-btn" @click="showProposeModal = true">向 TA 提问</button>
      </div>
    </div>

    <!-- 提问弹窗 -->
    <transition name="fade">
      <div v-if="showProposeModal" class="modal-overlay" @click="showProposeModal = false">
        <div class="propose-modal" @click.stop>
          <div class="modal-header">
            <h3>灵魂之问</h3>
            <button class="modal-close" @click="showProposeModal = false">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <textarea 
              v-model="proposeInput"
              class="propose-textarea"
              placeholder="问一个让彼此更靠近的问题吧..."
            ></textarea>
            <div class="tips">
              <i class="fa-solid fa-lightbulb"></i>
              <span>真诚的提问能让感情升温哦</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="propose-btn" @click="submitPropose" :disabled="!proposeInput.trim()">
              确认提问
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

const emit = defineEmits(['back'])
const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const activeTab = ref('all') // 'all' or 'pending'
const proposeInput = ref('')
const showProposeModal = ref(false)
const isRefreshing = ref(false)
const replyInputs = reactive({})

// 模拟数据适配
const questions = computed(() => {
  const qs = loveSpaceStore.currentSpace?.questions || []
  return [...qs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const filteredQuestions = computed(() => {
  if (activeTab.value === 'pending') {
    return questions.value.filter(q => !q.userAnswer)
  }
  return questions.value
})

const pendingCount = computed(() => {
  return questions.value.filter(q => !q.userAnswer).length
})

const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/default-avatar.png')
const partnerAvatar = computed(() => {
  const partner = loveSpaceStore.currentSpace?.partner
  return partner?.avatar || '/default-avatar.png'
})
const partnerName = computed(() => loveSpaceStore.currentSpace?.partner?.name || 'TA')

function getAvatar(authorId) {
  return authorId === 'user' ? userAvatar.value : partnerAvatar.value
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${date.getMonth() + 1}月${date.getDate()}日 ${h}:${m}`
}

function isRecent(dateStr) {
  if (!dateStr) return false
  return (new Date() - new Date(dateStr)) < 10 * 60 * 1000 // 10分钟内算新
}

function getStatusClass(q) {
  if (q.userAnswer && q.partnerAnswer) return 'completed'
  if (q.userAnswer || q.partnerAnswer) return 'partial'
  return 'none'
}

function getStatusIcon(q) {
  if (q.userAnswer && q.partnerAnswer) return 'fa-solid fa-check-double'
  if (q.userAnswer || q.partnerAnswer) return 'fa-solid fa-check'
  return 'fa-regular fa-clock'
}

async function handleReply(id) {
  const content = replyInputs[id]
  if (!content || !content.trim()) return
  
  await loveSpaceStore.answerQuestion(id, content, true)
  delete replyInputs[id]
}

async function submitPropose() {
  if (!proposeInput.value.trim()) return
  
  const id = Date.now()
  await loveSpaceStore.addQuestion({
    id,
    text: proposeInput.value,
    authorId: 'user',
    authorName: settingsStore.personalization.userProfile.name || '我'
  })
  
  // 用户提问后，自动触发 AI 回答
  const question = loveSpaceStore.currentSpace.questions.find(q => q.id === id)
  if (question) {
    loveSpaceStore.generateQuestionReply(question)
  }
  
  proposeInput.value = ''
  showProposeModal.value = false
  activeTab.value = 'all'
}

function refreshQuestions() {
  isRefreshing.value = true
  loveSpaceStore.loadFromStorage().finally(() => {
    setTimeout(() => { isRefreshing.value = false }, 800)
  })
}

function isRecentAnswer(q) {
  // 辅助函数判断是否有最新回复
  return false
}
</script>

<style scoped>
.soul-question-page {
  height: 100vh;
  background: #fdf8ff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* Header & Tabs */
.header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  z-index: 100;
  border-bottom: 1px solid rgba(168, 127, 251, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  height: 50px;
}

.header-left i {
  font-size: 20px;
  color: #6a5acd;
}

.header-title {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  letter-spacing: 0.5px;
}

.header-right {
  display: flex;
  gap: 16px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #a87ffb;
  cursor: pointer;
  padding: 4px;
  transition: transform 0.3s;
}

.icon-btn:active { transform: scale(0.9); }
.rotating { animation: rotate 0.8s linear infinite; }

@keyframes rotate { 
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); } 
}

.tab-switcher {
  display: flex;
  padding: 0 40px;
  gap: 30px;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  color: #888;
  position: relative;
  transition: all 0.3s;
  cursor: pointer;
}

.tab-item.active {
  color: #a87ffb;
  font-weight: 700;
}

.active-bar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 3px;
  background: linear-gradient(90deg, #a87ffb, #ff6b9d);
  border-radius: 3px;
  transition: width 0.3s;
}

.tab-item.active .active-bar {
  width: 24px;
}

.badge {
  position: absolute;
  top: 8px;
  right: -12px;
  background: #ff4d4d;
  color: white;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 12px;
}

/* Scrollable Content */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 40px;
  box-sizing: border-box;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Question Card */
.question-card {
  background: white;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(168, 127, 251, 0.08);
  border: 1px solid rgba(168, 127, 251, 0.05);
  position: relative;
  transition: transform 0.2s;
}

.question-card.is-new {
  border: 1px solid #ffecf0;
  background: linear-gradient(to bottom, #fff, #fff9fb);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.author-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}

.author-meta {
  flex: 1;
}

.author-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.action-label {
  font-size: 12px;
  font-weight: 400;
  color: #999;
  margin-left: 4px;
}

.timestamp {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}

.status-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.status-icon.completed { color: #10b981; background: #ecfdf5; }
.status-icon.partial { color: #a87ffb; background: #f5f3ff; }
.status-icon.none { color: #ccc; background: #f9f9f9; }

.question-body {
  position: relative;
  padding: 12px 30px;
  margin-bottom: 16px;
  background: #fbf9ff;
  border-radius: 16px;
}

.quote-mark {
  position: absolute;
  color: #e0d5ff;
  font-size: 20px;
  opacity: 0.6;
}

.quote-mark.top { top: 8px; left: 8px; }
.quote-mark.bottom { bottom: 8px; right: 8px; }

.question-text {
  font-size: 17px;
  line-height: 1.6;
  color: #444;
  font-weight: 600;
  text-align: center;
  margin: 0;
}

/* Answers */
.answers-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.answer-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.mini-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.answer-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.5;
  max-width: 90%;
}

.user .answer-bubble {
  background: #fff0f5;
  color: #ff6b9d;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.partner .answer-bubble {
  background: #f5f3ff;
  color: #a87ffb;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.waiting-partner {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #bbb;
  padding: 10px;
  justify-content: center;
}

.pulse-icon {
  width: 6px;
  height: 6px;
  background: #a87ffb;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}

/* Reply Zone */
.my-reply-zone {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reply-textarea {
  width: 100%;
  background: #fdfdfd;
  border: 1px dashed #e0d5ff;
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.3s;
}

.reply-textarea:focus {
  border-color: #a87ffb;
  background: white;
}

.reply-submit {
  align-self: flex-end;
  background: linear-gradient(135deg, #a87ffb, #8b5cf6);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(168, 127, 251, 0.2);
}

.reply-submit:disabled {
  opacity: 0.5;
  box-shadow: none;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80px;
  color: #ccc;
}

.empty-icon { font-size: 48px; margin-bottom: 20px; }

.start-btn {
  margin-top: 20px;
  background: white;
  border: 1.5px solid #a87ffb;
  color: #a87ffb;
  padding: 10px 24px;
  border-radius: 100px;
  font-weight: 600;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.propose-modal {
  background: white;
  width: 85%;
  max-width: 360px;
  border-radius: 28px;
  padding: 24px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 { margin: 0; color: #a87ffb; font-size: 18px; }

.modal-close { background: none; border: none; font-size: 20px; color: #ccc; }

.propose-textarea {
  width: 100%;
  height: 120px;
  border: 1px solid #f0eaff;
  background: #fbfaff;
  border-radius: 16px;
  padding: 16px;
  font-size: 15px;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.tips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: #a89bb9;
}

.modal-footer { margin-top: 24px; }

.propose-btn {
  width: 100%;
  background: linear-gradient(135deg, #a87ffb, #ff6b9d);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 16px;
  box-shadow: 0 8px 15px rgba(168, 127, 251, 0.2);
}

/* Animations */
.list-enter-active, .list-leave-active { transition: all 0.4s ease; }
.list-enter-from { opacity: 0; transform: translateY(20px); }
.list-leave-to { opacity: 0; transform: scale(0.9); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 480px) {
  .header-title { font-size: 16px; }
  .tab-switcher { padding: 0 20px; }
  .question-text { font-size: 16px; }
  .propose-modal { width: 90%; padding: 20px; }
}
</style>
