<template>
  <div class="soul-chat-container">
    <!-- Premium Glass Header -->
    <header class="chat-header">
      <div class="header-content">
        <button @click="$router.back()" class="header-icon-btn">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="header-title">灵魂共鸣</span>
        <div class="header-right-btns">
          <button @click="refreshData" class="header-icon-btn" :class="{ 'animating': isRefreshing }">
            <i class="fa-solid fa-rotate"></i>
          </button>
          <!-- Show Add only in ongoing tab -->
          <button v-if="activeTab === 'ongoing'" @click="showProposeModal = true" class="header-icon-btn highlight">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
      
      <!-- Ergonomic Tab System (No badge) -->
      <nav class="chat-tabs">
        <div 
          v-for="tab in tabs" 
          :key="tab.id"
          class="tab-item" 
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
          <div class="tab-indicator"></div>
        </div>
      </nav>
    </header>

    <!-- Scrollable Feed -->
    <main class="chat-feed" ref="scrollContainer">
      <div class="feed-inner">
        <transition-group name="fade-slide">
          <div 
            v-for="q in filteredQuestions" 
            :key="q.id" 
            class="question-thread shadow-sm"
          >
            <!-- Question Entry -->
            <div class="question-segment">
              <div class="segment-metadata">
                <img :src="getAvatar(q.authorId)" class="min-avatar" />
                <span class="meta-label">
                  <b>{{ q.authorName || (q.authorId === 'user' ? userName : partnerName) }}</b>
                  <time>{{ formatDate(q.createdAt) }}</time>
                </span>
                <button class="menu-btn" @click="confirmDelete(q.id)"><i class="fa-solid fa-trash-can"></i></button>
              </div>
              <div class="question-text-box">
                <p>{{ q.text }}</p>
                <div class="corner-shimmer"></div>
              </div>
            </div>

            <!-- Threaded Dialogue -->
            <div class="dialogue-flow">
              <!-- Legacy Answers Support -->
              <div v-if="q.userAnswer && (!q.replies || q.replies.length === 0)" class="chat-msg user">
                <div class="msg-bubble-wrap">
                   <div class="msg-bubble">{{ q.userAnswer }}</div>
                   <time class="msg-meta">{{ userName }} · {{ formatDate(q.userAnswerAt) }}</time>
                </div>
              </div>
              <div v-if="q.partnerAnswer && (!q.replies || q.replies.length === 0)" class="chat-msg partner">
                <div class="msg-bubble-wrap">
                   <div class="msg-bubble">{{ q.partnerAnswer }}</div>
                   <time class="msg-meta">{{ partnerName }} · {{ formatDate(q.partnerAnswerAt) }}</time>
                </div>
              </div>

              <!-- New Replies Array for Continued Dialogue -->
              <div 
                v-for="(r, idx) in q.replies" 
                :key="idx" 
                class="chat-msg" 
                :class="r.role === 'user' ? 'user' : 'partner'"
              >
                <div class="msg-bubble-wrap">
                   <div class="msg-bubble">{{ r.content }}</div>
                   <time class="msg-meta">{{ r.role === 'user' ? userName : partnerName }} · {{ formatDate(r.createdAt) }}</time>
                </div>
              </div>

              <!-- Waiting Indicator -->
              <div v-if="isWaiting(q)" class="partner-typing">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <span>{{ partnerName }} 正在感应...</span>
              </div>
              
              <!-- Reply Interface (Always allows another reply) -->
              <div class="reply-section">
                <div class="input-wrapper">
                  <textarea 
                    v-model="replyContentMap[q.id]"
                    placeholder="再对 TA 说点什么..."
                    rows="1"
                    @input="autoGrow($event.target)"
                  ></textarea>
                  <button 
                    class="btn-send" 
                    @click="handleSendReply(q.id)"
                    :disabled="!replyContentMap[q.id]?.trim()"
                  >
                    <i class="fa-solid fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition-group>

        <!-- Dynamic Empty State -->
        <div v-if="filteredQuestions.length === 0" class="empty-status">
          <div class="emotion-icon">💭</div>
          <h2>{{ activeTab === 'ongoing' ? '开启第一次互答吧' : '心声存档暂空' }}</h2>
          <p>{{ activeTab === 'ongoing' ? '有些深埋在心底的问题，也许现在就是开口的最佳契机' : '当提问完成共鸣后，将永久保存在属于你们的存档中' }}</p>
          <button v-if="activeTab === 'ongoing'" @click="showProposeModal = true" class="btn-startup">点此发起提问</button>
        </div>
        
        <div class="feed-footer-spacer"></div>
      </div>
    </main>

    <!-- Modal for Propose -->
    <transition name="pop-in">
      <div v-if="showProposeModal" class="modal-overlay" @click="handleModalClose">
        <div class="modal-card" @click.stop>
          <div class="card-bg-decoration"></div>
          <header class="modal-header">
            <h3>新的灵魂提问</h3>
            <button @click="handleModalClose" class="btn-close"><i class="fa-solid fa-xmark"></i></button>
          </header>
          <main class="modal-body">
            <textarea 
              v-model="proposeInput" 
              placeholder="写下一个你想问 TA 的问题..."
              class="modal-input"
            ></textarea>
            <div class="ai-assist-chip" @click="requestAIQuestion">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>帮我搜寻灵感</span>
            </div>
          </main>
          <footer class="modal-footer">
            <button class="btn-primary-ghost" @click="handleModalClose">取消</button>
            <button class="btn-primary-filled" @click="doPropose" :disabled="!proposeInput.trim()">送出提问</button>
          </footer>
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

const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const activeTab = ref('ongoing') // 'ongoing', 'archive'
const isRefreshing = ref(false)
const showProposeModal = ref(false)
const proposeInput = ref('')
const replyContentMap = reactive({})

const tabs = [
  { id: 'ongoing', name: '正在共鸣' },
  { id: 'archive', name: '心声存档' }
]

const questions = computed(() => {
  const qs = [...(loveSpaceStore.currentSpace?.questions || [])]
  return qs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const filteredQuestions = computed(() => {
  if (activeTab.value === 'ongoing') {
    return questions.value.filter(q => {
      // 正在共鸣：还没完成互答的（提问方除外的另一方还没说话）
      if (q.authorId === 'user') return !q.partnerAnswer
      return !q.userAnswer
    })
  } else {
    return questions.value.filter(q => {
      // 心声存档：对方已经回应了，或者双方都已经参与了
      if (q.authorId === 'user') return !!q.partnerAnswer
      if (q.authorId === 'partner') return !!q.userAnswer
      return !!q.userAnswer && !!q.partnerAnswer
    })
  }
})

// Identity Fix: Use chat-specific persona if available
const userAvatar = computed(() => {
  const chat = chatStore.chats[loveSpaceStore.currentPartnerId]
  return chat?.userAvatar || settingsStore.personalization.userProfile.avatar || '/default-avatar.png'
})
const userName = computed(() => {
  const chat = chatStore.chats[loveSpaceStore.currentPartnerId]
  return chat?.userName || settingsStore.personalization.userProfile.name || '我'
})
const partnerAvatar = computed(() => loveSpaceStore.partner?.avatar || '/default-avatar.png')
const partnerName = computed(() => loveSpaceStore.partner?.name || 'TA')

function getAvatar(authorId) {
  return authorId === 'user' ? userAvatar.value : partnerAvatar.value
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function isWaiting(q) {
  return q.userAnswer && !q.partnerAnswer
}

async function handleSendReply(id) {
  const content = replyContentMap[id]
  if (!content?.trim()) return
  
  await loveSpaceStore.answerQuestion(id, content, true)
  replyContentMap[id] = ''
}

async function doPropose() {
  if (!proposeInput.value.trim()) return
  
  const id = Date.now()
  await loveSpaceStore.addQuestion({
    id,
    text: proposeInput.value,
    authorId: 'user',
    authorName: userName.value // 使用绑定的人设名称
  })
  
  const question = loveSpaceStore.currentSpace.questions.find(q => q.id === id)
  if (question) {
    loveSpaceStore.generateQuestionReply(question)
  }
  
  proposeInput.value = ''
  showProposeModal.value = false
  activeTab.value = 'ongoing'
  chatStore.triggerToast('灵魂提问已发出 💌', 'success')
}

async function requestAIQuestion() {
  isRefreshing.value = true
  try {
    await loveSpaceStore.generateSingleFeature('question')
    showProposeModal.value = false
  } finally {
    isRefreshing.value = false
  }
}

function refreshData() {
  isRefreshing.value = true
  loveSpaceStore.loadFromStorage().then(() => {
    setTimeout(() => { isRefreshing.value = false }, 500)
  })
}

function confirmDelete(id) {
  chatStore.triggerConfirm('删除问答', '确定要抹除这段记忆吗？', async () => {
    loveSpaceStore.currentSpace.questions = loveSpaceStore.currentSpace.questions.filter(q => q.id !== id)
    await loveSpaceStore.saveToStorage()
    chatStore.triggerToast('已抹除', 'info')
  })
}

function handleModalClose() {
  showProposeModal.value = false
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

onMounted(() => {
})
</script>

<style scoped>
.soul-chat-container {
  height: 100vh;
  background: #fdfbff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'PingFang SC', 'SF Pro Text', system-ui;
}

/* Header Aesthetics */
.chat-header {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(15px);
  z-index: 1000;
  border-bottom: 1px solid rgba(168, 127, 251, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  height: 48px;
}

.header-icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #a87ffb;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  transition: all 0.2s;
}

.header-icon-btn:active { background: rgba(168, 127, 251, 0.05); transform: scale(0.9); }
.header-icon-btn.highlight { color: #8b5cf6; }
.header-icon-btn.animating i { animation: rotate 0.8s linear infinite; }

@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.header-title { font-size: 16px; font-weight: 800; color: #1a1a2e; }
.header-right-btns { display: flex; gap: 8px; }

/* Tabs */
.chat-tabs { display: flex; padding: 0 16px; gap: 24px; }
.tab-item { position: relative; padding: 12px 0; font-size: 13px; font-weight: 700; color: #aaa; cursor: pointer; transition: 0.3s; }
.tab-item.active { color: #8b5cf6; }
.tab-indicator { position: absolute; bottom: 0; left: 0; width: 0; height: 3px; background: linear-gradient(90deg, #8b5cf6, #ff7eb3); border-radius: 4px; transition: 0.3s; }
.tab-item.active .tab-indicator { width: 100%; }

/* Feed */
.chat-feed { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px; }
.feed-inner { display: flex; flex-direction: column; gap: 20px; max-width: 600px; margin: 0 auto; }

.question-thread { background: white; border-radius: 20px; overflow: hidden; border: 1px solid rgba(168, 127, 251, 0.05); }
.shadow-sm { box-shadow: 0 4px 20px rgba(168, 127, 251, 0.04); }

.question-segment { padding: 16px; background: linear-gradient(to bottom, #fdfbff, #ffffff); }
.segment-metadata { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.min-avatar { width: 32px; height: 32px; border-radius: 10px; object-fit: cover; }
.meta-label { flex: 1; display: flex; flex-direction: column; }
.meta-label b { font-size: 13px; color: #333; }
.meta-label time { font-size: 10px; color: #bbb; }
.menu-btn { background: none; border: none; color: #eee; font-size: 14px; padding: 4px; }
.menu-btn:hover { color: #ff6b6b; }

.question-text-box { background: #fcfaff; padding: 16px; border-radius: 16px; position: relative; }
.question-text-box p { margin: 0; font-size: 15px; line-height: 1.6; color: #4a4a6a; font-weight: 600; text-align: center; }
.corner-shimmer { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(168,127,251,0.03) 0%, transparent 70%); pointer-events: none; }

.dialogue-flow { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.chat-msg { display: flex; flex-direction: column; max-width: 85%; }
.chat-msg.user { align-self: flex-end; }
.chat-msg.partner { align-self: flex-start; }

.msg-bubble-wrap { display: flex; flex-direction: column; gap: 4px; }
.msg-bubble { padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; }
.user .msg-bubble { background: #fff5f8; color: #ff6b9d; border-bottom-right-radius: 4px; }
.partner .msg-bubble { background: #f7f5ff; color: #a87ffb; border-bottom-left-radius: 4px; }
.msg-meta { font-size: 9px; color: #ccc; }
.user .msg-meta { text-align: right; }

.partner-typing { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #ccc; padding: 4px; }
.dot { width: 4px; height: 4px; background: #ddd; border-radius: 50%; animation: bounce 1.4s infinite; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

.reply-section { margin-top: 8px; padding-top: 12px; border-top: 1px solid #fcfcfc; }
.input-wrapper { display: flex; align-items: flex-end; gap: 8px; background: #fafafc; border-radius: 20px; padding: 8px 12px; border: 1px solid #f3f3f7; }
.input-wrapper textarea { flex: 1; background: none; border: none; font-size: 14px; font-family: inherit; resize: none; padding: 4px; max-height: 120px; outline: none; }
.btn-send { background: #8b5cf6; color: white; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

.empty-status { padding: 80px 32px; text-align: center; }
.emotion-icon { font-size: 48px; margin-bottom: 24px; }
.empty-status h2 { font-size: 18px; color: #333; margin-bottom: 8px; }
.empty-status p { font-size: 13px; color: #999; margin-bottom: 32px; }
.btn-startup { background: white; border: 1px solid #8b5cf6; color: #8b5cf6; padding: 10px 24px; border-radius: 100px; font-weight: 700; }
.feed-footer-spacer { height: 100px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 2000; display: flex; align-items: flex-end; justify-content: center; }
.modal-card { background: white; width: 100%; max-width: 500px; border-radius: 32px 32px 0 0; padding: 24px; position: relative; overflow: hidden; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; position: relative; }
.modal-header h3 { font-size: 18px; font-weight: 800; color: #a87ffb; margin: 0; }
.modal-input { width: 100%; height: 140px; background: #fbfaff; border: 1.5px solid #f0eaff; border-radius: 20px; padding: 20px; font-size: 15px; resize: none; outline: none; box-sizing: border-box; }
.ai-assist-chip { margin-top: 16px; display: inline-flex; align-items: center; gap: 8px; background: #f0edff; color: #8b5cf6; padding: 8px 16px; border-radius: 100px; font-size: 12px; font-weight: 700; cursor: pointer; }
.modal-footer { display: flex; gap: 12px; margin-top: 24px; }
.btn-primary-ghost { flex: 1; padding: 14px; border-radius: 16px; border: none; background: #f5f5f5; color: #888; }
.btn-primary-filled { flex: 2; padding: 14px; border-radius: 16px; border: none; background: linear-gradient(135deg, #a87ffb, #ff7eb3); color: white; font-weight: 700; }

.fade-slide-enter-active { transition: 0.4s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(20px); }
.pop-in-enter-active { transition: 0.3s ease; }
.pop-in-enter-from .modal-card { transform: translateY(100%); }
</style>
