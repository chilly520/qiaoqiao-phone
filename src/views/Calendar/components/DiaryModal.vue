<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-container">
      <div class="modal-header">
        <h3>📝 写日记</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="date-display">
          <span class="date-icon">📅</span>
          <span class="date-text">{{ formattedDate }}</span>
        </div>
        
        <div class="form-group">
          <textarea
            v-model="content"
            rows="8"
            placeholder="写下今天的故事..."
            class="diary-input"
          />
        </div>
        
        <div class="form-group">
          <label>标签</label>
          <div class="tags-input">
            <div class="selected-tags">
              <span
                v-for="(tag, idx) in tags"
                :key="idx"
                class="tag"
              >
                {{ tag }}
                <button class="remove-tag" @click="removeTag(idx)">&times;</button>
              </span>
            </div>
            <input
              v-model="newTag"
              type="text"
              placeholder="添加标签 (回车确认)"
              @keydown.enter.prevent="addTag"
            />
          </div>
          <div class="suggested-tags">
            <button
              v-for="tag in suggestedTags"
              :key="tag"
              class="suggest-tag-btn"
              @click="addSuggestedTag(tag)"
            >
              + {{ tag }}
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label class="toggle-label">
            <input v-model="aiCanRead" type="checkbox" />
            <span>允许AI角色读取这篇日记</span>
          </label>
        </div>
        
        <div class="diary-stats">
          <span>{{ wordCount }} 字</span>
          <span>{{ readingTime }} 分钟阅读</span>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button class="btn-primary" @click="save">保存日记</button>
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

const content = ref(props.existing?.content || '')
const tags = ref(props.existing?.tags || [])
const newTag = ref('')
const aiCanRead = ref(props.existing?.aiCanRead || false)

const suggestedTags = [
  '日常', '工作', '学习', '心情', '美食', '旅行',
  '运动', '读书', '电影', '音乐', '梦想', '成长'
]

const formattedDate = computed(() => {
  const date = new Date(props.date)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
})

const wordCount = computed(() => content.value.length)
const readingTime = computed(() => Math.ceil(wordCount.value / 200))

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
  }
  newTag.value = ''
}

function addSuggestedTag(tag) {
  if (!tags.value.includes(tag)) {
    tags.value.push(tag)
  }
}

function removeTag(idx) {
  tags.value.splice(idx, 1)
}

function close() {
  emit('close')
}

function save() {
  emit('save', {
    content: content.value,
    tags: tags.value,
    aiCanRead: aiCanRead.value
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
  max-width: 480px;
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
  padding: 20px 24px;
  overflow-y: auto;
  max-height: calc(85vh - 140px);
}

.date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.15), rgba(197, 201, 255, 0.15));
  border-radius: 10px;
  margin-bottom: 16px;
}

.date-icon {
  font-size: 16px;
}

.date-text {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #5a5a7a;
  margin-bottom: 8px;
}

.diary-input {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.8;
  color: #5a5a7a;
  background: rgba(255, 255, 255, 0.8);
  resize: vertical;
  min-height: 160px;
}

.diary-input:focus {
  outline: none;
  border-color: #ffb7c5;
  box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.2);
}

.tags-input {
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.8);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  border-radius: 16px;
  font-size: 12px;
  color: white;
}

.remove-tag {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-tag:hover {
  background: rgba(255, 255, 255, 0.5);
}

.tags-input input {
  width: 100%;
  padding: 6px;
  border: none;
  font-size: 13px;
  color: #5a5a7a;
  background: transparent;
}

.tags-input input:focus {
  outline: none;
}

.suggested-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.suggest-tag-btn {
  padding: 4px 10px;
  border: 1px solid rgba(139, 122, 168, 0.3);
  border-radius: 12px;
  background: white;
  font-size: 11px;
  color: #8b7aa8;
  cursor: pointer;
  transition: all 0.3s ease;
}

.suggest-tag-btn:hover {
  border-color: #ffb7c5;
  color: #ff6b9d;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 8px 0;
}

.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #ff9eb5;
}

.diary-stats {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 10px;
  font-size: 12px;
  color: #9a8fb8;
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
