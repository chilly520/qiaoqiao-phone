<template>
  <Teleport to="body">
    <div v-if="visible" class="spark-detail-overlay" @click.self="close">
      <div class="spark-detail-modal">
        <div class="spark-header" :style="{ background: `linear-gradient(135deg, ${sparkInfo?.level?.color || '#FF6B35'}20, transparent)` }">
          <button @click="close" class="close-btn">&times;</button>
          <div class="spark-main-icon">
            <span class="mega-icon">{{ sparkInfo?.level?.icon || '🔥' }}</span>
            <div v-if="sparkInfo?.streak > 0" class="streak-big" :style="{ color: sparkInfo?.level?.color }">
              {{ sparkInfo.streak }}天
            </div>
          </div>
          <h2 class="spark-title">{{ sparkInfo?.level?.name || '火花' }}</h2>
          <p class="spark-subtitle">与 {{ charName }} 的火花</p>
        </div>

        <div class="spark-body">
          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value" :style="{ color: '#FF6B35' }">{{ sparkInfo?.streak || 0 }}</div>
              <div class="stat-label">当前连续</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" :style="{ color: '#9400D3' }">{{ sparkInfo?.maxStreak || 0 }}</div>
              <div class="stat-label">最长记录</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" :style="{ color: '#00CED1' }">{{ sparkInfo?.totalChats || 0 }}</div>
              <div class="stat-label">累计聊天</div>
            </div>
          </div>

          <!-- Level Progress -->
          <div v-if="sparkInfo?.nextLevel" class="level-progress">
            <div class="progress-header">
              <span>下一等级: {{ sparkInfo.nextLevel.name }}</span>
              <span>{{ Math.round(sparkInfo.progressToNext) }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: sparkInfo.progressToNext + '%', background: `linear-gradient(90deg, ${sparkInfo.level.color}, ${sparkInfo.nextLevel.color})` }"></div>
            </div>
            <p class="progress-hint">还需 {{ sparkInfo.nextLevel.days - sparkInfo.streak }} 天</p>
          </div>

          <!-- Achievements -->
          <div class="section">
            <h3 class="section-title">🏆 成就</h3>
            <div v-if="sparkInfo?.achievements?.length > 0" class="achievement-grid">
              <div v-for="ach in sparkInfo.achievements" :key="ach.id" class="achievement-item unlocked">
                <span class="ach-icon">{{ ach.icon }}</span>
                <span class="ach-name">{{ ach.name }}</span>
                <span class="ach-reward">{{ ach.reward }}</span>
              </div>
            </div>
            <div v-else class="empty-state">暂无成就，继续聊天解锁！</div>
          </div>

          <!-- Titles -->
          <div class="section">
            <h3 class="section-title">👑 称号装备</h3>
            <div v-if="sparkInfo?.titles?.length > 0" class="title-grid">
              <div
                v-for="title in sparkInfo.titles"
                :key="title.id"
                class="title-item"
                :class="{ equipped: isEquipped(title.id) }"
                @click="toggleEquip(title.id)"
              >
                <span class="title-icon">{{ title.icon }}</span>
                <span class="title-name">{{ title.name }}</span>
                <span v-if="isEquipped(title.id)" class="equip-badge">✓</span>
              </div>
            </div>
            <p v-else class="empty-state">暂无称号，达成条件后解锁！</p>
          </div>

          <!-- All Levels Preview -->
          <div class="section">
            <h3 class="section-title">🔥 等级一览</h3>
            <div class="levels-list">
              <div
                v-for="(lv, idx) in allLevels"
                :key="lv.days"
                class="level-item"
                :class="{ current: lv.days === sparkInfo?.level?.days, unlocked: (sparkInfo?.maxStreak || 0) >= lv.days }"
              >
                <span class="lv-icon">{{ lv.icon }}</span>
                <span class="lv-name">{{ lv.name }}</span>
                <span class="lv-days">{{ lv.days }}天</span>
                <span v-if="lv.days === sparkInfo?.level?.days" class="lv-current">当前</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useSparkStore } from '../../../stores/sparkStore'

const props = defineProps({
  visible: Boolean,
  charId: String,
  charName: String
})

const emit = defineEmits(['close'])

const sparkStore = useSparkStore()

const sparkInfo = computed(() => {
  if (!props.charId) return null
  return sparkStore.getSparkInfo(props.charId)
})

const allLevels = computed(() => sparkStore.SPARK_CONFIG.levels)

function close() {
  emit('close')
}

function isEquipped(titleId) {
  return sparkStore.equippedTitles[props.charId] === titleId
}

function toggleEquip(titleId) {
  sparkStore.equipTitle(props.charId, titleId)
}
</script>

<style scoped>
.spark-detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.spark-detail-modal {
  background: white;
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 25px 60px rgba(0,0,0,0.25);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255,255,255,0.8);
  border: none;
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}
.close-btn:hover { transform: scale(1.1); }

.spark-header {
  padding: 32px 24px 24px;
  text-align: center;
  position: relative;
}

.spark-main-icon {
  margin-bottom: 12px;
}

.mega-icon {
  font-size: 64px;
  display: block;
  animation: floatIcon 3s ease-in-out infinite;
}

@keyframes floatIcon {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.streak-big {
  font-size: 28px;
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
  margin-top: 4px;
}

.spark-title {
  font-size: 22px;
  font-weight: 700;
  margin: 4px 0;
}

.spark-subtitle {
  font-size: 13px;
  color: #888;
}

.spark-body {
  padding: 0 20px 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 12px 8px;
  background: #f8f8f8;
  border-radius: 14px;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
}

.stat-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.level-progress {
  margin-bottom: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.progress-bar {
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-hint {
  font-size: 11px;
  color: #aaa;
  margin-top: 4px;
  text-align: right;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.achievement-grid,
.title-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.achievement-item,
.title-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f8f8f8;
  border-radius: 10px;
  font-size: 12px;
  transition: all 0.2s;
}

.achievement-item.unlocked {
  background: linear-gradient(135deg, #fff5e6, #fff);
  border: 1px solid #ffd70030;
}

.title-item {
  cursor: pointer;
}

.title-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.title-item.equipped {
  background: linear-gradient(135deg, #f0e6ff, #fff);
  border: 2px solid #9400D3;
  box-shadow: 0 0 12px #9400D320;
}

.ach-icon,
.title-icon {
  font-size: 18px;
}

.ach-name,
.title-name {
  font-weight: 600;
}

.ach-reward {
  font-size: 10px;
  color: #FF6B35;
  background: #FFF0E0;
  padding: 2px 6px;
  border-radius: 4px;
}

.equip-badge {
  margin-left: auto;
  background: #9400D3;
  color: white;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  color: #ccc;
  font-size: 13px;
  padding: 16px;
}

.levels-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.level-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  opacity: 0.4;
  transition: all 0.2s;
}

.level-item.unlocked {
  opacity: 0.7;
}

.level-item.current {
  opacity: 1;
  background: linear-gradient(135deg, #fff5e6, #fff);
  border: 1px solid #FFB34750;
  font-weight: 600;
}

.lv-icon { font-size: 20px; }
.lv-name { flex: 1; }
.lv-days { color: #999; font-size: 11px; }

.lv-current {
  background: #FF6B35;
  color: white;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
