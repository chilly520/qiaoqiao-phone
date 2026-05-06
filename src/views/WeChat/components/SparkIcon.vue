<template>
  <div v-if="sparkIcon" class="spark-icon-wrapper" :class="[`size-${size}`, { pulse: sparkIcon.pulse }]" @click.stop="$emit('click')">
    <span class="spark-emoji" :style="{ fontSize: sparkIcon.size + 'px', filter: `drop-shadow(0 0 ${sparkIcon.size / 3}px ${sparkIcon.color}40)` }">
      {{ sparkIcon.icon }}
    </span>
    <span v-if="showDays && sparkIcon.streak > 0" class="spark-days" :style="{ color: sparkIcon.color, fontSize: (sparkIcon.size * 0.5) + 'px' }">
      {{ sparkIcon.streak }}
    </span>
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
  size: { type: String, default: 'md' },
  showDays: { type: Boolean, default: true }
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

const sparkIcon = computed(() => {
  if (!isSparkEnabled.value) return null
  return sparkStore.getSparkIcon(props.charId, props.size)
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
  gap: 1px;
  cursor: pointer;
  transition: transform 0.2s ease;
  position: relative;
}

.spark-icon-wrapper:hover {
  transform: scale(1.15);
}

.spark-icon-wrapper.size-sm {
  gap: 0px;
}
.spark-icon-wrapper.size-md {
  gap: 1px;
}
.spark-icon-wrapper.size-lg {
  gap: 2px;
}
.spark-icon-wrapper.size-xl {
  gap: 3px;
}

.spark-emoji {
  display: inline-block;
  line-height: 1;
  transition: all 0.3s ease;
}

.spark-days {
  font-weight: 800;
  font-family: 'Outfit', sans-serif;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  line-height: 1;
}

.equipped-title {
  font-size: 10px;
  animation: titleGlow 2s ease-in-out infinite;
}

@keyframes titleGlow {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

.spark-icon-wrapper.pulse .spark-emoji {
  animation: sparkPulse 1.5s ease-in-out infinite;
}

@keyframes sparkPulse {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 4px currentColor);
  }
  50% {
    transform: scale(1.15);
    filter: drop-shadow(0 0 8px currentColor);
  }
}
</style>
