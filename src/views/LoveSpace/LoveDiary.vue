<template>
  <div class="love-diary">
    <!-- 头部 -->
    <div class="diary-header">
      <button class="back-btn" @click="goBack">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <h1>📔 交换日记</h1>
      <button class="magic-btn" @click="generateDiary" title="AI 生成">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
      </button>
    </div>

    <!-- 日记列表 -->
    <div class="diary-list">
      <div 
        v-for="diary in sortedDiaries" 
        :key="diary.id"
        class="diary-card"
        :class="{ 'ai-generated': diary.aiGenerated }">
        
        <div class="diary-date">
          <span class="date">{{ formatDate(diary.date) }}</span>
          <span class="weather" v-if="diary.weather">{{ diary.weather }}</span>
        </div>
        
        <div class="diary-content">
          <div class="content-section" v-if="diary.userContent">
            <div class="section-label">📝 你的日记</div>
            <p class="section-text">{{ diary.userContent }}</p>
          </div>
          
          <div class="content-section" v-if="diary.partnerContent">
            <div class="section-label">💕 TA 的日记</div>
            <p class="section-text">{{ diary.partnerContent }}</p>
          </div>
        </div>
        
        <div class="diary-actions">
          <button class="action-btn" @click="editDiary(diary)">
            <i class="fa-solid fa-pen"></i>
            编辑
          </button>
          <button class="action-btn" @click="deleteDiary(diary)">
            <i class="fa-solid fa-trash"></i>
            删除
          </button>
        </div>
      </div>
      
      <div v-if="diaries.length === 0" class="empty-state">
        <div class="empty-icon">📔</div>
        <p>还没有日记</p>
        <button class="create-btn" @click="createDiary">
          <i class="fa-solid fa-plus"></i>
          写一篇日记
        </button>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showEditor" class="editor-overlay" @click.self="closeEditor">
      <div class="editor-modal">
        <h3>{{ editingDiary ? '编辑日记' : '写日记' }}</h3>
        
        <div class="editor-fields">
          <div class="field">
            <label>日期</label>
            <input type="date" v-model="editorForm.date" class="input">
          </div>
          
          <div class="field">
            <label>天气</label>
            <select v-model="editorForm.weather" class="input">
              <option value="☀️">☀️ 晴</option>
              <option value="☁️">☁️ 多云</option>
              <option value="🌧️">🌧️ 雨</option>
              <option value="⛈️">⛈️ 雷雨</option>
              <option value="❄️">❄️ 雪</option>
            </select>
          </div>
          
          <div class="field">
            <label>心情</label>
            <div class="mood-selector">
              <span 
                v-for="mood in moodOptions" 
                :key="mood"
                class="mood-item"
                :class="{ selected: editorForm.mood === mood }"
                @click="editorForm.mood = mood">
                {{ mood }}
              </span>
            </div>
          </div>
          
          <div class="field">
            <label>你的内容</label>
            <textarea 
              v-model="editorForm.userContent"
              class="textarea"
              rows="5"
              placeholder="今天发生了什么..."></textarea>
          </div>
        </div>
        
        <div class="editor-actions">
          <button class="cancel-btn" @click="closeEditor">取消</button>
          <button class="save-btn" @click="saveDiary">保存</button>
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
const showEditor = ref(false)
const editingDiary = ref(null)
const editorForm = ref({
  date: new Date().toISOString().split('T')[0],
  weather: '☀️',
  mood: '😊',
  userContent: '',
  partnerContent: ''
})

const moodOptions = ['😊', '😢', '😠', '😴', '🤩', '', '😰', '']

// 计算属性
const diaries = computed(() => loveSpaceStore.diary)

const sortedDiaries = computed(() => {
  return [...diaries.value].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  )
})

// 方法
function goBack() {
  router.back()
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${month}月${day}日 ${weekday}`
}

function createDiary() {
  editingDiary.value = null
  editorForm.value = {
    date: new Date().toISOString().split('T')[0],
    weather: '☀️',
    mood: '😊',
    userContent: '',
    partnerContent: ''
  }
  showEditor.value = true
}

function editDiary(diary) {
  editingDiary.value = diary
  editorForm.value = {
    date: diary.date,
    weather: diary.weather || '☀️',
    mood: diary.mood || '😊',
    userContent: diary.userContent || '',
    partnerContent: diary.partnerContent || ''
  }
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editingDiary.value = null
}

function saveDiary() {
  if (!editorForm.value.userContent.trim()) {
    alert('请写点什么吧~')
    return
  }
  
  if (editingDiary.value) {
    // 更新日记
    const index = diaries.value.findIndex(d => d.id === editingDiary.value.id)
    if (index !== -1) {
      loveSpaceStore.diary[index] = {
        ...editingDiary.value,
        ...editorForm.value,
        updatedAt: new Date().toISOString()
      }
    }
  } else {
    // 新建日记
    loveSpaceStore.addDiary({
      ...editorForm.value,
      aiGenerated: false
    })
  }
  
  closeEditor()
}

function deleteDiary(diary) {
  if (confirm('确定要删除这篇日记吗？')) {
    const index = diaries.value.findIndex(d => d.id === diary.id)
    if (index !== -1) {
      loveSpaceStore.diary.splice(index, 1)
    }
  }
}

async function generateDiary() {
  // TODO: AI 生成日记
  alert('✨ 正在施展魔法生成日记...')
  
  // 模拟 AI 生成
  setTimeout(() => {
    loveSpaceStore.addDiary({
      date: new Date().toISOString().split('T')[0],
      weather: '☀️',
      mood: '🥰',
      userContent: '',
      partnerContent: '今天也是想你的一天呢~ 早上起来看到阳光很好，就想起你笑起来的样子。下午路过花店，看到玫瑰开得正好，差点就想买下来送给你了。不知道你今天过得怎么样？记得要好好吃饭，好好休息哦。💕',
      aiGenerated: true
    })
  }, 1500)
}
</script>

<style scoped>
.love-diary {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff5f7 0%, #ffe6eb 100%);
  padding: 20px;
}

.diary-header {
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

.diary-header h1 {
  font-size: 20px;
  color: #ff6b9d;
  margin: 0;
}

.magic-btn {
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
}

.diary-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.diary-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(255, 107, 157, 0.2);
}

.diary-card.ai-generated {
  border: 2px solid #ffb7c5;
}

.diary-date {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 107, 157, 0.3);
}

.date {
  font-size: 15px;
  font-weight: 600;
  color: #ff6b9d;
}

.weather {
  font-size: 18px;
}

.diary-content {
  margin-bottom: 16px;
}

.content-section {
  margin-bottom: 12px;
}

.content-section:last-child {
  margin-bottom: 0;
}

.section-label {
  font-size: 13px;
  color: #8b7aa8;
  margin-bottom: 6px;
  font-weight: 500;
}

.section-text {
  font-size: 14px;
  color: #5a5a7a;
  line-height: 1.8;
  white-space: pre-wrap;
}

.diary-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid rgba(255, 107, 157, 0.3);
  background: rgba(255, 107, 157, 0.05);
  border-radius: 8px;
  font-size: 13px;
  color: #ff6b9d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.action-btn:hover {
  background: rgba(255, 107, 157, 0.1);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 15px;
  color: #8b7aa8;
  margin-bottom: 20px;
}

.create-btn {
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

/* 编辑器 */
.editor-overlay {
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

.editor-modal {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.editor-modal h3 {
  font-size: 18px;
  color: #ff6b9d;
  margin-bottom: 20px;
  text-align: center;
}

.editor-fields {
  margin-bottom: 20px;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 13px;
  color: #8b7aa8;
  margin-bottom: 6px;
  font-weight: 500;
}

.input {
  width: 100%;
  padding: 10px;
  border: 2px solid rgba(255, 107, 157, 0.3);
  border-radius: 8px;
  font-size: 14px;
  color: #5a5a7a;
}

.textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid rgba(255, 107, 157, 0.3);
  border-radius: 8px;
  font-size: 14px;
  color: #5a5a7a;
  resize: vertical;
  font-family: inherit;
}

.mood-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mood-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 107, 157, 0.3);
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.mood-item:hover {
  transform: scale(1.1);
}

.mood-item.selected {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.2), rgba(255, 183, 197, 0.2));
  border-color: #ff6b9d;
  transform: scale(1.15);
}

.editor-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.save-btn {
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

.save-btn {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
}
</style>
