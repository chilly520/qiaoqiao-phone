<template>
  <div v-if="sparkIcon" class="spark-icon-wrapper" :class="[`size-${size}`, { pulse: sparkIcon.pulse, inactive: !sparkIcon.isActive }]" @click.stop="$emit('click')">
    <!-- QQ-style: Icon with number overlay -->
    <div class="spark-icon-container">
      <!-- Fire emoji/icon -->
      <span class="spark-emoji" :style="{ fontSize: sparkIcon.size + 'px', color: sparkIcon.isActive ? sparkIcon.color : '#CCCCCC' }">
        {{ sparkIcon.icon }}
      </span>

      <!-- Day count number (like QQ: 66, 32, etc.) -->
      <span v-if="showDays && sparkIcon.streak >= 0"
        class="spark-number"
        :class="{ 'number-active': sparkIcon.isActive, 'number-inactive': !sparkIcon.isActive }"
        :style="{
          fontSize: (sparkIcon.size * 0.55) + 'px',
          color: sparkIcon.isActive ? '#FFFFFF' : '#999999',
          background: sparkIcon.isActive ? sparkIcon.color : '#E0E0E0',
          minWidth: (sparkIcon.size * 0.7) + 'px',
          height: (sparkIcon.size * 0.6) + 'px',
          lineHeight: (sparkIcon.size * 0.6) + 'px'
        }">
        {{ sparkIcon.streak }}
      </span>
    </div>

    <!-- Level indicator (small dots or badge for list view) -->
    <span v-if="showLevel && sparkIcon.level > 0" class="spark-level-badge" :title="`Lv.${sparkIcon.level} ${sparkIcon.levelName}`">
      Lv{{ sparkIcon.level }}
    </span>

    <!-- Equipped title icon -->
    <span v-if="equippedTitle" class="equipped-title" :title="equippedTitle.name">
      {{ equippedTitle.icon }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSparkStore } from '../../../stores/sparkStore'

const props = defineProps({
  charId: { type: String, required: true },
  size: { type: String, default: 'md' }, // sm, md, lg, xl
  showDays: { type: Boolean, default: true },
  showLevel: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const sparkStore = useSparkStore()

const isSparkEnabled = computed(() => {
  try {
    const disabledChars = JSON.parse(localStorage.getItem('spark_disabled_chars') || '[]')
    return !disabledChars.includes(props.charId)
  } catch (e) {
    return true
  }
})

const sparkInfo = computed(() => {
  if (!isSparkEnabled.value) return null
  return sparkStore.getSparkIcon(props.charId, props.size)
})

const sparkIcon = computed(() => {
  if (!sparkInfo.value) return null

  const info = sparkInfo.value
  const hasStreak = info.streak > 0

  // Calculate level based on days (every 10 days = 1 level)
  const level = hasStreak ? Math.floor(info.streak / 10) + 1 : 0

  return {
    ...info,
    level,
    isActive: hasStreak,
    icon: hasStreak ? info.level?.icon || '🔥' : '🔥',
    color: hasStreak ? info.level?.color || '#FF6B35' : '#CCCCCC'
  }
})

const equippedTitle = computed(() => {
  const titleId = sparkStore.equippedTitles[props.charId]
  if (!titleId) return null
  return sparkStore.SPARK_CONFIG.titles.find(t => t.id === titleId)
})
</script>

<style scoped>
.spark-icon-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  transition: transform 0.2s ease;
  position: relative;
}

.spark-icon-wrapper:hover {
  transform: scale(1.15);
}

/* Size variants */
.spark-icon-wrapper.size-sm .spark-emoji { font-size: 14px; }
.spark-icon-wrapper.size-md .spark-emoji { font-size: 18px; }
.spark-icon-wrapper.size-lg .spark-emoji { font-size: 26px; }
.spark-icon-wrapper.size-xl .spark-emoji { font-size: 34px; }

/* Icon container - positions emoji and number */
.spark-icon-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spark-emoji {
  display: inline-block;
  line-height: 1;
  transition: all 0.3s ease;
  filter: drop-shadow(0 0 3px currentColor30);
}

/* Day number - positioned on top-right of icon like QQ */
.spark-number {
  position: absolute;
  bottom: -2px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-family: 'Outfit', -apple-system, sans-serif;
  border-radius: 6px;
  padding: 0 2px;
  letter-spacing: -0.5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  z-index: 2;
  transition: all 0.2s ease;
}

.number-active {
  animation: numberPulse 2s ease-in-out infinite;
}

@keyframes numberPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* Level badge (optional, for detailed views) */
.spark-level-badge {
  font-size: 9px;
  font-weight: 700;
  color: #FF6B35;
  background: linear-gradient(135deg, #FFF5E6, #FFE8CC);
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid #FFB34740;
  white-space: nowrap;
}

/* Equipped title */
.equipped-title {
  font-size: 10px;
  animation: titleGlow 2s ease-in-out infinite;
}

@keyframes titleGlow {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* Pulse animation for active sparks (7+ days) */
.spark-icon-wrapper.pulse .spark-emoji {
  animation: sparkPulse 1.5s ease-in-out infinite;
}

@keyframes sparkPulse {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 4px currentColor);
  }
  50% {
    transform: scale(1.2);
    filter: drop-shadow(0 0 10px currentColor);
  }
}

/* Inactive state (grayed out) */
.spark-icon-wrapper.inactive .spark-emoji {
  filter: grayscale(80%) opacity(0.5);
}
</style>
