<template>
  <div class="love-anniversary">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>纪念日</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button @click="showAddModal = true" class="add-btn">
          <i class="fa-solid fa-calendar-plus"></i>
        </button>
      </div>
    </div>

    <div class="scroll-container">
      <!-- 倒计时卡片 -->
      <div class="countdown-section" v-if="nextAnniversary">
        <div class="countdown-card">
          <div class="countdown-info">
            <p class="next-title">距离 {{ nextAnniversary.name }} 还有</p>
            <div class="days-remaining">
              <span class="num">{{ nextAnniversary.days }}</span>
              <span class="unit">天</span>
            </div>
            <p class="target-date">{{ formatDate(nextAnniversary.date) }}</p>
          </div>
          <div class="card-bg-icon">🎉</div>
        </div>
      </div>

      <!-- 纪念日列表 -->
      <div class="anniversary-list">
        <div class="section-title">
          <i class="fa-solid fa-heart"></i>
          <span>甜蜜里程碑</span>
        </div>

        <div v-if="anniversaries.length === 0" class="empty-state">
          <p>还没有记录纪念日呢，快拉上 TA 一起创建吧~</p>
        </div>

        <div v-for="item in sortedAnniversaries" :key="item.id" class="anniversary-item">
          <div class="item-date">
            <div class="dot" :class="{ 'past': isPast(item.date) }"></div>
            <span class="date-text">{{ formatDate(item.date) }}</span>
          </div>
          <div class="item-card">
            <div class="item-name">{{ item.name }}</div>
            <div class="item-status" :class="{ 'past': isPast(item.date) }">
              {{ getStatusText(item.date) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加纪念日弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>添加新纪念日</h3>
        <div class="input-group">
          <label>纪念日名称</label>
          <input v-model="newName" type="text" placeholder="如：第一次看电影" class="text-input">
        </div>
        <div class="input-group">
          <label>日期</label>
          <input v-model="newDate" type="date" class="date-input">
        </div>
        <div class="modal-actions">
          <button @click="showAddModal = false" class="cancel-btn">取消</button>
          <button @click="saveAnniversary" :disabled="!newName.trim() || !newDate" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'

const loveSpaceStore = useLoveSpaceStore()

const anniversaries = computed(() => loveSpaceStore.anniversaries || [])
const nextAnniversary = computed(() => loveSpaceStore.nextAnniversary)

const isGenerating = ref(false)

async function generateMagic() {
  if (isGenerating.value) return
  isGenerating.value = true
  try {
    await loveSpaceStore.generateSingleFeature('anniversary')
  } catch (e) {
    console.error('Magic generation failed', e)
  }
  isGenerating.value = false
}

const showAddModal = ref(false)
const newName = ref('')
const newDate = ref('')

const sortedAnniversaries = computed(() => {
  return [...anniversaries.value].sort((a, b) => new Date(a.date) - new Date(b.date))
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function isPast(dateStr) {
  return new Date(dateStr) < new Date()
}

function getStatusText(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '已过去'
  if (diff === 0) return '就是今天！'
  return `还有 ${diff} 天`
}

async function saveAnniversary() {
  if (!newName.value.trim() || !newDate.value) return
  
  await loveSpaceStore.addAnniversary({
    name: newName.value,
    date: new Date(newDate.value).toISOString()
  })
  
  newName.value = ''
  newDate.value = ''
  showAddModal.value = false
}
</script>

<style scoped>
.love-anniversary {
  height: 100vh;
  background: #fffafa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scroll-container {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
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
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.back-btn, .add-btn, .magic-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #ff6b9d;
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
}

.countdown-section {
  padding: 20px;
}

.countdown-card {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 24px;
  padding: 30px;
  color: white;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(255, 107, 157, 0.3);
}

.countdown-info {
  position: relative;
  z-index: 2;
}

.next-title {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 10px;
}

.days-remaining {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 15px;
}

.days-remaining .num {
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
}

.days-remaining .unit {
  font-size: 18px;
  font-weight: 700;
}

.target-date {
  font-size: 12px;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.2);
  display: inline-block;
  padding: 4px 12px;
  border-radius: 100px;
}

.card-bg-icon {
  position: absolute;
  right: -20px;
  bottom: -20px;
  font-size: 120px;
  opacity: 0.1;
  transform: rotate(-15deg);
}

.anniversary-list {
  padding: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  color: #ff6b9d;
  font-weight: 700;
}

.anniversary-item {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.item-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 85px;
  padding-top: 5px;
}

.dot {
  width: 10px;
  height: 10px;
  background: #ff6b9d;
  border-radius: 50%;
  margin-bottom: 8px;
  box-shadow: 0 0 10px rgba(255, 107, 157, 0.5);
}

.dot.past {
  background: #ccc;
  box-shadow: none;
}

.date-text {
  font-size: 11px;
  color: #8b7aa8;
  font-weight: 600;
}

.item-card {
  flex: 1;
  background: white;
  padding: 16px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  font-size: 15px;
  font-weight: 600;
  color: #5a5a7a;
}

.item-status {
  font-size: 12px;
  color: #ff6b9d;
  font-weight: 700;
}

.item-status.past {
  color: #ccc;
  font-weight: 400;
}

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

.modal {
  background: white;
  border-radius: 24px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
}

h3 {
  color: #ff6b9d;
  text-align: center;
  margin-bottom: 20px;
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  font-size: 13px;
  color: #8b7aa8;
  margin-bottom: 8px;
  font-weight: 600;
}

.text-input, .date-input {
  width: 100%;
  padding: 12px;
  border: 1.5px solid #ffecf0;
  border-radius: 12px;
  outline: none;
  font-family: inherit;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn { background: #f5f5f5; color: #666; }
.save-btn { background: #ff6b9d; color: white; }
.save-btn:disabled { opacity: 0.5; }

.empty-state {
  text-align: center;
  color: #a89bb9;
  padding: 40px 0;
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .love-anniversary {
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
  
  .scroll-container {
    padding: 12px;
  }
  
  .countdown-card {
    padding: 16px;
  }
  
  .next-title {
    font-size: 12px;
  }
  
  .days-remaining .num {
    font-size: 36px;
  }
  
  .days-remaining .unit {
    font-size: 14px;
  }
  
  .target-date {
    font-size: 11px;
  }
  
  .section-title {
    font-size: 14px;
  }
  
  .anniversary-item {
    gap: 10px;
  }
  
  .item-date {
    min-width: 60px;
  }
  
  .dot {
    width: 8px;
    height: 8px;
  }
  
  .date-text {
    font-size: 10px;
  }
  
  .item-card {
    padding: 12px;
  }
  
  .item-name {
    font-size: 13px;
  }
  
  .item-status {
    font-size: 11px;
  }
  
  .modal {
    padding: 20px;
    width: 95%;
  }
  
  h3 {
    font-size: 16px;
  }
  
  .input-group label {
    font-size: 12px;
  }
  
  .text-input, .date-input {
    padding: 10px;
    font-size: 13px;
  }
  
  .modal-actions {
    gap: 8px;
  }
  
  .cancel-btn, .save-btn {
    padding: 10px;
    font-size: 13px;
  }
}
</style>
