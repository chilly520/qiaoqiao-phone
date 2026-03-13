<template>
  <div class="love-question">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>灵魂提问</h2>
      <div class="header-actions">
        <button v-if="!showProposeModal" @click="showProposeModal = true" class="action-btn">
          <i class="fa-solid fa-plus"></i>
        </button>
        <button @click="generateNewQuestion" class="action-btn" :disabled="isGenerating">
           <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': isGenerating }"></i>
        </button>
      </div>
    </div>

    <!-- 可滚动区域 -->
    <div class="scroll-container">
      <!-- 主体区域 -->
      <div class="question-body" v-if="activeQuestion">
        <div class="active-question-card animate-pop-in">
          <div class="question-text">
            <span class="quote">“</span>
            <h2>{{ activeQuestion.text }}</h2>
            <span class="quote">”</span>
          </div>

          <div class="answers-container">
            <!-- 历史对话流 -->
            <div class="answer-history">
               <!-- 对话式展示 -->
               <div v-if="activeQuestion.userAnswer" class="answer-row user">
                 <div class="answer-content">{{ activeQuestion.userAnswer }}</div>
               </div>
               <div v-if="activeQuestion.partnerAnswer" class="answer-row partner">
                 <div class="answer-content">{{ activeQuestion.partnerAnswer }}</div>
               </div>
               <!-- 特别提示：如果双方都答了，可以继续追加 -->
               <div v-if="activeQuestion.userAnswer && activeQuestion.partnerAnswer" class="interaction-hint">
                 你们的灵魂产生了共鸣，还可以继续交流哦...
               </div>
            </div>
          </div>

          <div class="question-actions">
            <textarea 
              v-if="!activeQuestion.userAnswer || (activeQuestion.userAnswer && activeQuestion.partnerAnswer)"
              v-model="myAnswer" 
              :placeholder="activeQuestion.userAnswer ? '继续对 TA 说...' : '写下你的回答...'" 
              class="answer-input"
            ></textarea>
            <button 
              v-if="!activeQuestion.userAnswer || (activeQuestion.userAnswer && activeQuestion.partnerAnswer)"
              @click="submitAnswer" 
              class="submit-btn" 
              :disabled="!myAnswer.trim()"
            >
              {{ activeQuestion.userAnswer ? '追加心声' : '提交心声' }}
            </button>
            <div v-else-if="!activeQuestion.partnerAnswer" class="waiting-box">
              <i class="fa-solid fa-hourglass-half fa-spin"></i>
              <span>正在等待 TA 的心声...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 还没提问时的空状态 -->
      <div v-else class="empty-state-section" @click="showProposeModal = true">
        <div class="propose-box">
          <div class="box-icon">💡</div>
          <h3>还没开始今天的提问？</h3>
          <p>点击这里给 TA 提一个直击灵魂的问题吧~</p>
        </div>
      </div>

      <!-- 历史提问列表 -->
      <div class="history-list">
         <div class="history-title">历史问答</div>
         <div v-if="answeredQuestions.length === 0" class="empty-history">
           还没有完成的灵魂问答哦~
         </div>
         <div v-for="q in answeredQuestions" :key="q.id" class="history-card" :class="{ 'is-active': activeQuestionId === q.id }" @click="activeQuestionId = q.id">
           <div class="h-main">
             <p class="h-text">{{ q.text }}</p>
             <button class="h-delete" @click.stop="deleteQuestion(q.id)">
               <i class="fa-solid fa-trash-can"></i>
             </button>
           </div>
           <div class="h-status" :class="{ 'completed': q.userAnswer && q.partnerAnswer }">
             <i class="fa-solid" :class="q.userAnswer && q.partnerAnswer ? 'fa-check-double' : 'fa-clock'"></i>
             {{ q.userAnswer && q.partnerAnswer ? '已完成互答' : '等待补充心声...' }}
           </div>
         </div>
      </div>
    </div>

    <!-- 提问弹窗 -->
    <div v-if="showProposeModal" class="modal-overlay" @click="showProposeModal = false">
      <div class="modal-content" @click.stop>
        <h3>提一个新问题</h3>
        <textarea 
          v-model="proposeInput" 
          placeholder="写下你想问 TA 的问题..." 
          class="propose-input"
        ></textarea>
        <div class="modal-actions">
          <button @click="showProposeModal = false" class="cancel-btn">取消</button>
          <button @click="submitPropose" class="submit-propose-btn" :disabled="!proposeInput.trim()">提问</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'

const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()

const questions = computed(() => loveSpaceStore.questions || [])
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const partnerAvatar = computed(() => loveSpaceStore.partner?.avatar || '/avatars/default.jpg')
const partnerName = computed(() => loveSpaceStore.partner?.name || 'TA')

const isGenerating = ref(false)
const myAnswer = ref('')
const proposeInput = ref('')
const activeQuestionId = ref(null)
const showProposeModal = ref(false)

const activeQuestion = computed(() => {
  if (activeQuestionId.value) return questions.value.find(q => q.id === activeQuestionId.value)
  // 核心优化：始终默认展示最新的问题，允许持续追加回答
  return questions.value[0] || null
})

const answeredQuestions = computed(() => {
  // 核心改动：展示所有已经有哪怕一方回答过的问题，或者所有历史记录（排除当前最新且空的问题）
  return questions.value.filter(q => {
    // 如果是当前正在答的最新的那个，且还没答，就不放进历史列表
    if (q.id === activeQuestion.value?.id && !q.userAnswer && !q.partnerAnswer) return false
    return true
  }).sort((a,b) => b.id - a.id)
})

async function generateNewQuestion() {
  isGenerating.value = true
  await loveSpaceStore.generateMagicContent()
  isGenerating.value = false
}

async function submitAnswer() {
  if (!myAnswer.value.trim() || !activeQuestion.value) return
  
  await loveSpaceStore.answerQuestion(activeQuestion.value.id, myAnswer.value, true)
  myAnswer.value = ''
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
  
  activeQuestionId.value = id
  proposeInput.value = ''
  showProposeModal.value = false
}

async function deleteQuestion(id) {
  loveSpaceStore.currentSpace.questions = loveSpaceStore.currentSpace.questions.filter(q => q.id !== id)
  await loveSpaceStore.saveToStorage()
  if (activeQuestionId.value === id) activeQuestionId.value = null
}

onMounted(() => {
})
</script>

<style scoped>
.love-question {
  height: 100vh;
  background: #fbf8ff;
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
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
}

.back-btn, .action-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #a87ffb;
  cursor: pointer;
  padding: 5px;
}

.header-actions {
  display: flex;
  gap: 15px;
}

h2 { font-size: 18px; color: #5a5a7a; margin: 0; }

.scroll-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.question-body {
  padding: 20px;
}

.active-question-card {
  background: white;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(168, 127, 251, 0.08);
  border: 1px solid #f0e6ff;
}

.question-text {
  text-align: center;
  margin-bottom: 24px;
  position: relative;
}

.question-text .quote {
  font-size: 32px;
  color: #e0d0ff;
  font-family: serif;
  line-height: 1;
}

.question-text h2 {
  font-size: 20px;
  color: #5a5a7a;
  margin: 10px 0;
  font-weight: 700;
}

.answers-container {
  margin-bottom: 24px;
}

.answer-history {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.answer-row {
  display: flex;
  width: 100%;
}

.answer-row.user { justify-content: flex-end; }
.answer-row.partner { justify-content: flex-start; }

.answer-content {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
}

.user .answer-content {
  background: #fdf2f8;
  color: #ff6b9d;
  border-bottom-right-radius: 4px;
}

.partner .answer-content {
  background: #f5f3ff;
  color: #a87ffb;
  border-bottom-left-radius: 4px;
}

.interaction-hint {
  text-align: center;
  font-size: 11px;
  color: #a89bb9;
  margin-top: 10px;
  font-style: italic;
}

.question-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.answer-input {
  width: 100%;
  height: 100px;
  border: 1.5px solid #f0e6ff;
  border-radius: 16px;
  padding: 15px;
  font-family: inherit;
  font-size: 14px;
  outline: none;
  resize: none;
  background: #fbf8ff;
}

.submit-btn {
  background: linear-gradient(135deg, #a87ffb, #8b5cf6);
  color: white;
  border: none;
  padding: 14px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(168, 127, 251, 0.3);
}

.submit-btn:disabled {
  opacity: 0.5;
  box-shadow: none;
}

.waiting-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #a89bb9;
  font-size: 13px;
  padding: 20px;
  background: #fbf8ff;
  border-radius: 16px;
}

.history-list {
  padding: 0 20px 40px;
}

.history-title {
  font-size: 15px;
  font-weight: 800;
  color: #5a5a7a;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: #a87ffb;
  border-radius: 4px;
}

.history-card {
  background: white;
  padding: 20px;
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  margin-bottom: 16px;
  border: 1px solid transparent;
  transition: all 0.3s;
}

.history-card:active {
  transform: scale(0.98);
  border-color: #f0e6ff;
}

.h-text {
  font-size: 15px;
  color: #5a5a7a;
  margin-bottom: 10px;
  font-weight: 600;
}

.h-status {
  font-size: 12px;
  color: #10b981;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
}

.h-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.h-delete {
  background: none;
  border: none;
  color: #ccc;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
}

.h-delete:hover { color: #ff4d4f; }

.empty-history { text-align: center; color: #ccc; padding: 30px 0; }
.animate-pop-in { animation: popIn 0.4s ease-out; }
@keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

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

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

.modal-content h3 {
  margin-bottom: 16px;
  text-align: center;
  color: #a87ffb;
}

.propose-input {
  width: 100%;
  height: 120px;
  border: 1px solid #f0e6ff;
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

.cancel-btn, .submit-propose-btn {
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

.submit-propose-btn {
  background: #a87ffb;
  color: white;
}

.submit-propose-btn:disabled {
  opacity: 0.5;
}

.empty-state-section {
  padding: 40px 20px;
}

.propose-box {
  background: white;
  border-radius: 24px;
  padding: 40px 20px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(168, 127, 251, 0.08);
  border: 2px dashed #e0d0ff;
  cursor: pointer;
}

.box-icon {
  font-size: 40px;
  margin-bottom: 15px;
}
</style>
