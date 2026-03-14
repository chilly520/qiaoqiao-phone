<template>
  <div class="love-sticky-container">
    <div class="header">
      <button class="back-btn" @click="$router.back()">←</button>
      <h2>便利贴墙</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button class="add-btn" @click="showAddModal = true">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    </div>
    
    <div class="sticky-wall">
      <div 
        v-for="note in processedStickies" 
        :key="note.id" 
        :class="['note-card', note.styleClass]"
      >
        <div v-if="hasCreamPin(note.styleClass)" class="dec-pin cream"></div>
        <div v-if="hasBluePin(note.styleClass)" class="dec-pin blue"></div>
        <div v-if="hasCenterTape(note.styleClass)" class="dec-tape center"></div>

        <template v-if="note.styleClass === 's-blue-memo'">
          <div class="inner">
            <div class="s-title">MEMO</div>
            <div class="bookmark"></div>
            <div class="note-content">
              <span>{{ note.content }}</span>
              <span class="note-signature" v-if="note.author">——{{ note.author === 'partner' ? (loveSpaceStore.partner?.name || 'TA') : currentUserName }}</span>
            </div>
          </div>
        </template>

        <template v-if="note.styleClass === 's-red-scallop'">
          <div class="inner scallop-inner">
            <div class="note-content">
              <span>{{ note.content }}</span>
              <span class="note-signature" v-if="note.author">——{{ note.author === 'partner' ? (loveSpaceStore.partner?.name || 'TA') : currentUserName }}</span>
            </div>
          </div>
        </template>
        
        <template v-if="note.styleClass === 's-red-apple'">
          <div class="apple-shape">
            <div class="apple-stem"></div>
            <div class="apple-core"></div>
          </div>
          <div class="note-content apple-text">
            <span>{{ note.content }}</span>
            <span class="note-signature" v-if="note.author">——{{ note.author === 'partner' ? (loveSpaceStore.partner?.name || 'TA') : currentUserName }}</span>
          </div>
        </template>

        <template v-else>
          <div class="note-content">
            <span>{{ note.content }}</span>
            <span class="note-signature" v-if="note.author">——{{ note.author === 'partner' ? (loveSpaceStore.partner?.name || 'TA') : currentUserName }}</span>
          </div>
        </template>
        
        <div class="note-footer">
          <span class="note-date">{{ formatDate(note.createdAt) }}</span>
        </div>
        
        <button class="delete-note-btn" @click.stop="deleteNote(note.id)">×</button>
      </div>
    </div>
    
    <div class="empty-wall" v-if="processedStickies.length === 0">
      <div class="empty-icon">🩹</div>
      <p>墙上空空的，写点贴纸告诉 TA 吧~</p>
    </div>

    <!-- 添加弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal animate-pop-in">
        <h3>留下你的贴纸</h3>
        <textarea 
          v-model="newContent" 
          placeholder="写下你想对 TA 说的话..." 
          maxlength="50"
          class="note-textarea"
        ></textarea>
        
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
import { useChatStore } from '@/stores/chatStore'

const loveSpaceStore = useLoveSpaceStore()
const chatStore = useChatStore()

const isGenerating = ref(false)
const showAddModal = ref(false)
const newContent = ref('')

async function generateMagic() {
  if (isGenerating.value) return
  isGenerating.value = true
  try {
    await loveSpaceStore.generateSingleFeature('sticky')
  } catch (e) {
    console.error('Magic generation failed', e)
  }
  isGenerating.value = false
}

async function saveSticky() {
  if (!newContent.value.trim()) return
  await loveSpaceStore.addSticky({
    content: newContent.value,
    author: 'user'
  })
  newContent.value = ''
  showAddModal.value = false
}

// 修复后的当前用户名称，从 settingsStore 获取
import { useSettingsStore } from '@/stores/settingsStore'
const settingsStore = useSettingsStore()
// 修复后的当前用户名称，从 chatStore 获取对应角色的“我的人设”名字
const currentUserName = computed(() => {
  const partnerId = loveSpaceStore.currentPartnerId
  if (partnerId && chatStore.chats[partnerId]) {
    // 优先使用该聊天绑定的“我的人设”中的名字
    return chatStore.chats[partnerId].userName || settingsStore.personalization?.userProfile?.name || '我'
  }
  return settingsStore.personalization?.userProfile?.name || '我'
})

// 20 种样式库
const availableStyles = [
  's-v1-grid', 's-v1-line', 's-v1-plaid', 's-v1-minimal',
  's-blue-grid', 's-blue-memo', 's-blue-matrix', 's-blue-time',
  's-blue-dash', 's-blue-plaid', 's-blue-todo', 's-blue-polaroid',
  's-red-frame', 's-red-scallop', 's-red-circle-grid', 's-red-apple',
  's-red-todo', 's-red-star-matrix', 's-red-habits', 's-red-tartan'
]

// 处理数据，固定分配样式
const processedStickies = computed(() => {
  const list = loveSpaceStore.stickies || []
  return list.map((note, index) => {
    // 使用 ID + 索引的组合哈希，确保样式分布更均匀
    const hashId = note.id ? 
      (String(note.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index) : 
      (index * 7 + 13) // 使用质数增加随机性
    
    const styleIndex = hashId % availableStyles.length
    
    return {
      ...note,
      styleClass: availableStyles[styleIndex]
    }
  })
})

// 装饰件判定方法
const hasCreamPin = (cls) => ['s-v1-grid', 's-blue-grid'].includes(cls)
const hasBluePin = (cls) => ['s-blue-plaid'].includes(cls)
const hasCenterTape = (cls) => ['s-v1-line', 's-blue-polaroid'].includes(cls)

// 删除便签
const deleteNote = (id) => {
  loveSpaceStore.deleteSticky(id)
}

// 格式化日期
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  // 1 分钟内显示刚刚
  if (diff < 60000) return '刚刚'
  // 1 小时内显示分钟
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  // 24 小时内显示小时
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  // 超过 24 小时显示日期
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${month}.${day} ${hour}:${minute}`
}
</script>

<style scoped>
@import url("https://fontsapi.zeoseven.com/494/main/result.css");

/* 容器及全局布局 */
.love-sticky-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f9fc;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  z-index: 100;
}

.header h2 { margin: 0; font-size: 18px; color: #333; }
.back-btn, .add-btn, .magic-btn { background: none; border: none; font-size: 20px; color: #666; cursor: pointer; display: flex; align-items: center; justify-content: center; }

.add-btn {
  width: 32px;
  height: 32px;
  background: #ff6b9d;
  color: white !important;
  border-radius: 50%;
  font-size: 16px;
  box-shadow: 0 4px 10px rgba(255, 107, 157, 0.3);
  transition: all 0.3s;
}

.add-btn:hover {
  transform: scale(1.1) rotate(90deg);
  background: #ff8fa3;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.magic-btn i {
  font-size: 18px;
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

.sticky-wall {
  flex: 1;
  overflow-y: auto;
  padding: 60px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 32px;
  align-items: start;
}

/* 基础便签样式 */
.note-card {
  min-height: 180px;
  position: relative;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  box-sizing: border-box;
  color: #333;
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  line-height: 1.6;
  font-family: 'Kaiti', 'STKaiti', serif;
}

.note-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 20px rgba(0,0,0,0.06);
  z-index: 10;
}

.note-content { 
  flex: 1; 
  word-wrap: break-word; 
  white-space: pre-wrap; 
  z-index: 2; 
  position: relative; 
  font-family: "PING FANG GONG ZI TI", 'Kaiti', 'STKaiti', serif;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #333;
}

.note-signature {
  display: block;
  margin-top: 8px;
  font-weight: bold;
  font-size: 13px;
  opacity: 0.8;
  text-align: right;
  width: 100%;
  color: #333;
}

.note-footer {
  margin-top: auto;
  padding-top: 12px;
  font-size: 11px;
  color: inherit;
  opacity: 0.7;
  display: flex;
  justify-content: center;
  font-family: -apple-system, sans-serif;
  z-index: 2;
}

.note-date {
  font-size: 10px;
  opacity: 0.6;
  text-align: center;
}

.note-date {
  font-size: 10px;
  opacity: 0.6;
  text-align: center;
}

/* 删除按钮 */
.delete-note-btn {
  position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
  background: rgba(255,255,255,0.8); border: none; border-radius: 50%;
  color: #ff6b6b; font-size: 14px; display: flex; align-items: center; justify-content: center;
  opacity: 0; cursor: pointer; transition: all 0.2s; z-index: 20;
}
.note-card:hover .delete-note-btn { opacity: 1; }
.delete-note-btn:hover { background: #ff6b6b; color: white; }

/* 拟物装饰 */
.dec-pin {
  position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
  width: 14px; height: 14px; border-radius: 50%;
  box-shadow: inset -2px -2px 4px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.08); z-index: 10;
}
.dec-pin.cream { background: #fffcf5; }
.dec-pin.blue { background: #a2c6e6; }

.dec-tape {
  position: absolute; width: 45px; height: 16px; backdrop-filter: blur(2px); z-index: 10;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.dec-tape.center {
  top: -8px; left: 50%; transform: translateX(-50%) rotate(-2deg);
  background: rgba(162, 198, 230, 0.4);
}

/* ================= 20 种样式库 ================= */

/* V1 基础 4 款 */
.s-v1-grid {
  background: #baddf2; padding: 24px 16px 16px; color: #333;
  background-image: linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px); background-size: 20px 20px;
}
.s-v1-line {
  background: #fffbf0; padding: 24px 16px 16px; color: #333;
  background-image: repeating-linear-gradient(transparent, transparent 25px, rgba(186, 221, 242, 0.4) 26px); background-position: 0 8px;
}
.s-v1-plaid {
  background: #f08a90; color: white; border: 5px solid white; padding: 16px;
  background-image: linear-gradient(rgba(255,255,255,0.3) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.3) 2px, transparent 2px), linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 30px 30px, 30px 30px, 10px 10px, 10px 10px;
}
.s-v1-minimal { background: #fffdf9; border: 2px solid #f08a90; padding: 24px 16px 16px; border-radius: 10px; color: #333; }

/* 蓝系 8 款 */
.s-blue-grid {
  background: #b6d3eb; padding: 24px 16px 16px; color: #333;
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px); background-size: 18px 18px;
}
.s-blue-memo { background: #9bbfe0; padding: 6px; }
.s-blue-memo .inner { background: #fffcf5; height: 100%; border-radius: 4px; padding: 12px; position: relative; display: flex; flex-direction: column; }
.s-blue-memo .s-title { color: #9bbfe0; font-weight: bold; margin-bottom: 8px; font-family: sans-serif; }
.s-blue-memo .bookmark { position: absolute; top: -6px; right: 15px; width: 14px; height: 25px; background: #9bbfe0; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
.s-blue-matrix {
  background: #b6d3eb; color: #333; padding: 16px; text-align: center;
  background-image: linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px); background-size: 50% 50%; background-position: center;
}
.s-blue-time {
  background: #b6d3eb; padding: 16px; display: flex; flex-direction: column; justify-content: center;
  background-image: radial-gradient(circle at center, #fffcf5 60px, transparent 61px); color: #333;
}
.s-blue-dash {
  background: #9bbfe0; padding: 20px; color: #333;
  background-image: repeating-linear-gradient(transparent, transparent 24px, rgba(255,255,255,0.4) 25px);
}
.s-blue-plaid {
  background: #fffcf5; padding: 24px 16px 16px; color: #333;
  background-image: linear-gradient(rgba(155,191,224,0.2) 4px, transparent 4px), linear-gradient(90deg, rgba(155,191,224,0.2) 4px, transparent 4px), linear-gradient(rgba(155,191,224,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(155,191,224,0.1) 1px, transparent 1px); background-size: 30px 30px, 30px 30px, 10px 10px, 10px 10px;
}
.s-blue-todo { background: #b6d3eb; padding: 16px; color: #333; border-left: 4px solid #fffcf5; }
.s-blue-polaroid { background: #fffcf5; padding: 30px 16px 16px; text-align: center; color: #333; border-bottom: 20px solid #fffcf5; }

/* 红系 8 款 */
.s-red-frame { background: #fffcf5; border: 2px solid #e48088; padding: 16px; color: #333; }
.s-red-scallop { background: #e48088; padding: 8px; color: white; }
.s-red-scallop .scallop-inner {
  background: #fffcf5; height: 100%; padding: 16px; color: #e48088; font-weight: bold;
  mask-image: radial-gradient(circle at 4px 4px, transparent 4px, black 4.5px); mask-size: 12px 12px; mask-position: -4px -4px;
}
.s-red-circle-grid {
  background: #ff6b81; 
  padding: 16px; 
  color: white;
  background-image: radial-gradient(circle, rgba(255,255,255,0.4) 2px, transparent 2px);
  background-size: 20px 20px;
}
.s-red-circle-grid .note-content {
  z-index: 10;
  text-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.s-red-circle-grid .note-signature,
.s-red-circle-grid .note-date {
  color: white;
  opacity: 0.9;
}
.s-red-apple { background: #b6d3eb; color: white; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 16px; }
.apple-shape { width: 80px; height: 70px; background: #ee5d68; border-radius: 40% 40% 50% 50%; border: 3px solid #fff; position: relative; display: flex; justify-content: center; align-items: center; margin-bottom: 10px; }
.apple-stem { position: absolute; top: -10px; width: 4px; height: 12px; background: #666; border-radius: 2px; }
.apple-core { width: 40px; height: 50px; background: #fffcf5; border-radius: 40% 40% 50% 50%; }
.apple-text { text-align: center; padding: 0 10px; }
.s-red-todo { background: #e48088; padding: 12px; color: white; }
.s-red-star-matrix { background: #e67780; color: white; padding: 16px; border: 1px dashed rgba(255,255,255,0.6); margin: 6px; }
.s-red-habits { background: #fffcf5; padding: 16px; color: #e48088; border-top: 6px solid #e48088; }
.s-red-tartan {
  background: #e67780; color: white; padding: 16px;
  background-image: linear-gradient(rgba(255,255,255,0.4) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.4) 2px, transparent 2px), linear-gradient(rgba(255,255,255,0.1) 4px, transparent 4px), linear-gradient(90deg, rgba(255,255,255,0.1) 4px, transparent 4px); background-size: 20px 20px, 20px 20px, 40px 40px, 40px 40px;
}

.empty-wall { width: 100%; text-align: center; color: #999; margin-top: 50px; font-size: 14px; grid-column: 1 / -1; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }

/* 移动端适配 */
@media (max-width: 480px) {
  .sticky-wall {
    padding: 24px 16px;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 25px;
  }
  
  .note-card {
    min-height: 140px;
    padding: 12px;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  .header h2 {
    font-size: 16px;
  }
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal {
  background: white;
  width: 100%;
  max-width: 320px;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}

.modal h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #333;
  text-align: center;
}

.note-textarea {
  width: 100%;
  height: 120px;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  resize: none;
  background: #fcfcfc;
  outline: none;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.modal-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 100px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.cancel-btn { background: #f5f5f5; color: #666; }
.save-btn { background: #ff6b9d; color: white; }
.save-btn:disabled { opacity: 0.5; }

.animate-pop-in {
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.85) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
