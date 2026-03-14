<template>
  <div class="couple-album">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>我们的相册</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button @click="triggerUpload" class="add-btn">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </button>
      </div>
    </div>

    <!-- 顶部状态栏 -->
    <div class="album-stats">
      <div class="stat-item">
        <span class="num">{{ album.length }}</span>
        <span class="label">照片</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="num">{{ albumCountToday }}</span>
        <span class="label">今日新增</span>
      </div>
    </div>

    <!-- 照片墙 -->
    <div class="photo-grid">
      <div v-if="album.length === 0" class="empty-album">
        <div class="empty-icon">🖼️</div>
        <p>一张底片都没有发现呢...</p>
        <button @click="triggerUpload" class="upload-hint-btn">立即上传首张照片</button>
      </div>

      <div 
        v-for="photo in sortedAlbum" 
        :key="photo.id" 
        class="photo-card"
        @click="zoomPhoto(photo)"
      >
        <img :src="photo.url" class="photo-img" loading="lazy">
        <div class="photo-info">
          <span class="photo-date">{{ formatDate(photo.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- 隐藏的上传 input -->
    <input type="file" ref="fileInput" @change="onFileSelected" accept="image/*" class="hidden-input">

    <!-- 上传备注弹窗 -->
    <div v-if="showUploadModal" class="modal-overlay" @click="showUploadModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>添加照片备注</h3>
          <button @click="showUploadModal = false" class="modal-close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <img :src="pendingPhotoUrl" class="upload-preview-img">
          <textarea 
            v-model="uploadDesc" 
            placeholder="写下这张照片的故事或备注...（可选）" 
            class="upload-desc-input"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button @click="showUploadModal = false" class="cancel-btn">取消</button>
          <button @click="confirmUpload" class="upload-confirm-btn">上传照片</button>
        </div>
      </div>
    </div>

    <!-- 照片大图预览 -->
    <div v-if="zoomedPhoto" class="zoom-overlay animate-fade-in" @click="zoomedPhoto = null">
      <div class="zoom-header">
        <button class="zoom-back-btn" @click="zoomedPhoto = null">
          <i class="fa-solid fa-chevron-left"></i> 返回
        </button>
      </div>
      <div class="zoom-content" @click.stop>
        <img :src="zoomedPhoto.url" class="zoomed-img">
        
        <div class="photo-info-panel">
          <div class="info-header">
            <span class="zoom-date">{{ formatDateFull(zoomedPhoto.createdAt) }}</span>
            <button class="delete-photo-btn" @click="deletePhoto(zoomedPhoto.id)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          
          <!-- 评论区 (新功能) -->
          <div class="comments-section">
            <div v-if="zoomedPhoto.desc" class="photo-caption">{{ zoomedPhoto.desc }}</div>
            <div class="comment-list">
              <div v-for="c in zoomedPhoto.comments" :key="c.id" class="comment-item">
                <span class="comment-author">{{ c.authorName }}:</span>
                <span class="comment-text">{{ c.text }}</span>
              </div>
            </div>
            
            <div class="comment-input-row">
              <input v-model="newComment" placeholder="添加评论..." @keyup.enter="addComment">
              <button @click="addComment" :disabled="!newComment.trim()"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'

const loveSpaceStore = useLoveSpaceStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const fileInput = ref(null)
const zoomedPhoto = ref(null)
const newComment = ref('')
const showUploadModal = ref(false)
const uploadDesc = ref('')
const pendingPhotoUrl = ref('')
const isGenerating = computed(() => loveSpaceStore.isMagicGenerating)

async function generateMagic() {
  if (isGenerating.value) return
  try {
    chatStore.triggerToast('正在施放相册魔法... ✨', 'info')
    await loveSpaceStore.generateSingleFeature('album')
  } catch (e) {
    console.error('Magic generation failed', e)
    chatStore.triggerToast('施放魔法失败了', 'error')
  }
}

const album = computed(() => loveSpaceStore.album || [])
const sortedAlbum = computed(() => {
  return [...album.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const albumCountToday = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return album.value.filter(p => p.createdAt && p.createdAt.startsWith(today)).length
})

function triggerUpload() {
  fileInput.value.click()
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    pendingPhotoUrl.value = e.target.result
    showUploadModal.value = true
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

function confirmUpload() {
  if (!pendingPhotoUrl.value) return
  
  loveSpaceStore.addToAlbum({
    url: pendingPhotoUrl.value,
    type: 'user',
    desc: uploadDesc.value,
    comments: []
  })
  
  showUploadModal.value = false
  uploadDesc.value = ''
  pendingPhotoUrl.value = ''
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDateFull(dateStr) {
  const date = new Date(dateStr)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function zoomPhoto(photo) {
  zoomedPhoto.value = photo
}

async function addComment() {
  if (!newComment.value.trim() || !zoomedPhoto.value) return
  
  const photo = loveSpaceStore.currentSpace.album.find(p => p.id === zoomedPhoto.value.id)
  if (photo) {
    if (!photo.comments) photo.comments = []
    photo.comments.push({
      id: Date.now(),
      authorId: 'user',
      authorName: settingsStore.personalization.userProfile.name || '我',
      text: newComment.value,
      createdAt: new Date().toISOString()
    })
    await loveSpaceStore.saveToStorage()
    newComment.value = ''
  }
}

async function deletePhoto(id) {
  chatStore.triggerConfirm({
    title: '删除照片',
    message: '确定要永久删除这张记忆吗？',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: async () => {
      loveSpaceStore.currentSpace.album = loveSpaceStore.currentSpace.album.filter(p => p.id !== id)
      await loveSpaceStore.saveToStorage()
      zoomedPhoto.value = null
    }
  })
}
</script>

<style scoped>
.couple-album {
  min-height: 100vh;
  background: white;
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
}

.back-btn, .add-btn, .magic-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #5a5a7a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.magic-btn i {
  color: #ff6b9d;
}

.magic-btn.animating i {
  animation: magic-spin 1.5s infinite linear;
  color: #a87ffb;
}

@keyframes magic-spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

h2 {
  font-size: 18px;
  color: #5a5a7a;
  margin: 0;
  font-weight: 800;
}

.album-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 20px 30px;
  gap: 40px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item .num {
  font-size: 20px;
  font-weight: 800;
  color: #ff6b9d;
}

.stat-item .label {
  font-size: 11px;
  color: #a89bb9;
  font-weight: 600;
}

.stat-divider {
  width: 1px;
  height: 20px;
  background: #eee;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}

.photo-card {
  aspect-ratio: 1;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
  color: white;
  font-size: 9px;
  text-align: right;
}

.empty-album {
  grid-column: span 3;
  text-align: center;
  padding: 100px 20px;
}

.empty-icon { font-size: 60px; opacity: 0.2; margin-bottom: 20px; }

.upload-hint-btn {
  margin-top: 20px;
  padding: 10px 24px;
  border-radius: 100px;
  border: 2px solid #ff6b9d;
  background: white;
  color: #ff6b9d;
  font-weight: 700;
  cursor: pointer;
}

.hidden-input { display: none; }

/* Zoom Overlay */
.zoom-overlay {
  position: fixed;
  inset: 0;
  background: black;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.zoom-content {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.zoom-header {
  width: 100%;
  padding: 10px 20px;
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 20px);
  left: 0;
  z-index: 2010;
}

.zoom-back-btn {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 15px;
  backdrop-filter: blur(10px);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.zoomed-img {
  flex: 1;
  width: 100%;
  object-fit: contain;
  background: #000;
}

.photo-info-panel {
  padding: 24px;
  background: white;
  border-top: 1px solid #eee;
  border-radius: 30px 30px 0 0;
  max-height: 40vh;
  overflow-y: auto;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.zoom-date { font-size: 13px; color: #a89bb9; }

.delete-photo-btn {
  background: #fff1f0;
  border: none;
  color: #ff4d4f;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
}

.comments-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.photo-caption {
  font-size: 14px;
  color: #5a5a7a;
  font-weight: 600;
  padding-bottom: 10px;
  border-bottom: 1px dashed #f5f5f5;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-item {
  font-size: 13px;
  line-height: 1.5;
}

.comment-author {
  color: #ff6b9d;
  font-weight: 800;
  margin-right: 6px;
}

.comment-text { color: #5a5a7a; }

.comment-input-row {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.comment-input-row input {
  flex: 1;
  background: #f8f8f8;
  border: none;
  padding: 10px 15px;
  border-radius: 15px;
  outline: none;
  font-size: 13px;
}

.comment-input-row button {
  background: #ff6b9d;
  color: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 上传弹窗样式 */
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
  width: 90%;
  max-width: 400px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #5a5a7a;
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 20px;
}

.upload-preview-img {
  width: 100%;
  border-radius: 12px;
  margin-bottom: 16px;
}

.upload-desc-input {
  width: 100%;
  height: 100px;
  border: 1px solid #f0e6ff;
  border-radius: 12px;
  padding: 12px;
  font-family: inherit;
  font-size: 14px;
  resize: none;
  outline: none;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.modal-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.modal-actions .cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.modal-actions .upload-confirm-btn {
  background: linear-gradient(135deg, #a87ffb, #8b5cf6);
  color: white;
}

.animate-fade-in { animation: fadeIn 0.25s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* 移动端适配 */
@media (max-width: 480px) {
  .couple-album {
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
  
  .album-stats {
    padding: 12px 16px;
  }
  
  .stat-item {
    font-size: 12px;
  }
  
  .stat-item .num {
    font-size: 18px;
  }
  
  .photo-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 6px;
  }
  
  .photo-card {
    border-radius: 6px;
  }
  
  .photo-img {
    height: 100px;
  }
  
  .photo-info {
    font-size: 8px;
    padding: 3px;
  }
  
  .empty-album {
    grid-column: span 3;
    padding: 60px 16px;
  }
  
  .empty-icon {
    font-size: 48px;
  }
  
  .upload-hint-btn {
    font-size: 12px;
    padding: 8px 20px;
  }
  
  /* 上传弹窗适配 */
  .modal-content {
    width: 95%;
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-header h3 {
    font-size: 15px;
  }
  
  .modal-close {
    font-size: 18px;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .upload-desc-input {
    height: 80px;
    font-size: 13px;
    padding: 10px;
  }
  
  .modal-actions {
    padding: 12px 16px;
    gap: 10px;
  }
  
  .modal-actions button {
    padding: 10px;
    font-size: 13px;
  }
  
  /* 大图预览适配 */
  .zoom-header {
    top: calc(env(safe-area-inset-top, 0px) + 12px);
    padding: 8px 12px;
  }
  
  .zoom-back-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
  
  .photo-info-panel {
    padding: 16px;
    max-height: 35vh;
  }
  
  .info-header {
    margin-bottom: 12px;
  }
  
  .zoom-date {
    font-size: 11px;
  }
  
  .delete-photo-btn {
    font-size: 16px;
    padding: 4px;
  }
  
  .photo-caption {
    font-size: 13px;
    margin-bottom: 12px;
  }
  
  .comment-item {
    font-size: 12px;
    padding: 6px 0;
  }
  
  .comment-author {
    font-size: 12px;
  }
  
  .comment-input-row {
    gap: 8px;
  }
  
  .comment-input-row input {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .comment-input-row button {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}
</style>
