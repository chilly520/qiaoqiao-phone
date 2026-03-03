<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>😊 记录心情</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="mood-selector">
          <button
            v-for="mood in moods"
            :key="mood.value"
            class="mood-item"
            :class="{ active: selectedMood === mood.value }"
            @click="selectedMood = mood.value"
          >
            <span class="mood-emoji">{{ mood.emoji }}</span>
            <span class="mood-label">{{ mood.label }}</span>
          </button>
        </div>
        
        <div class="form-group">
          <label>心情标签 (多选)</label>
          <div class="tags-grid">
            <button
              v-for="tag in moodTags"
              :key="tag"
              class="tag-btn"
              :class="{ active: selectedTags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label>心情日记</label>
          <textarea
            v-model="note"
            rows="4"
            placeholder="写下今天的心情..."
          />
        </div>
        
        <div class="mood-preview" :class="selectedMood">
          <span class="preview-emoji">{{ currentMoodEmoji }}</span>
          <span class="preview-text">{{ currentMoodText }}</span>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  date: String,
  existing: Object
})

const emit = defineEmits(['close', 'save'])

const moods = [
  { value: 'happy', label: '开心', emoji: '😊', color: '#ffb7c5' },
  { value: 'excited', label: '兴奋', emoji: '🤩', color: '#ffd8a8' },
  { value: 'calm', label: '平静', emoji: '😌', color: '#a8d8ea' },
  { value: 'loved', label: '被爱', emoji: '🥰', color: '#ff9eb5' },
  { value: 'tired', label: '疲惫', emoji: '😴', color: '#c5c9ff' },
  { value: 'sad', label: '难过', emoji: '😢', color: '#b4a7d6' },
  { value: 'angry', label: '生气', emoji: '😠', color: '#ff6b6b' },
  { value: 'anxious', label: '焦虑', emoji: '😰', color: '#9ec4bb' }
]

const moodTags = [
  '工作顺利', '学习进步', '运动健身', '美食享受', '朋友聚会',
  '家庭时光', '独处时光', '阅读思考', '追剧放松', '游戏娱乐',
  '户外散步', '音乐治愈', '恋爱甜蜜', '礼物惊喜', '小确幸'
]

const selectedMood = ref(props.existing?.mood || 'happy')
const selectedTags = ref(props.existing?.tags || [])
const note = ref(props.existing?.note || '')

const currentMoodEmoji = computed(() => {
  return moods.find(m => m.value === selectedMood.value)?.emoji || '😊'
})

const currentMoodText = computed(() => {
  return moods.find(m => m.value === selectedMood.value)?.label || '开心'
})

function toggleTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx > -1) {
    selectedTags.value.splice(idx, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

function close() {
  emit('close')
}

function save() {
  emit('save', {
    mood: selectedMood.value,
    tags: selectedTags.value,
    note: note.value
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(90, 90, 122, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 107, 157, 0.2);
  color: #ff6b9d;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(85vh - 140px);
}

.mood-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.mood-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid transparent;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
}

.mood-item:hover {
  background: white;
  transform: translateY(-2px);
}

.mood-item.active {
  border-color: #ff9eb5;
  background: linear-gradient(135deg, rgba(255, 158, 181, 0.2), rgba(197, 201, 255, 0.2));
}

.mood-emoji {
  font-size: 32px;
  line-height: 1;
}

.mood-label {
  font-size: 12px;
  color: #5a5a7a;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
  margin-bottom: 10px;
}

.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-btn {
  padding: 6px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 20px;
  background: white;
  font-size: 12px;
  color: #5a5a7a;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tag-btn:hover {
  border-color: #ffb7c5;
}

.tag-btn.active {
  border-color: #ff9eb5;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  font-size: 14px;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
  resize: vertical;
  min-height: 80px;
}

textarea:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.mood-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
  margin-top: 16px;
}

.preview-emoji {
  font-size: 36px;
}

.preview-text {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 122, 168, 0.1);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 24px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255, 183, 197, 0.4);
}

.btn-secondary {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.btn-secondary:hover {
  background: rgba(139, 122, 168, 0.2);
}
</style>
