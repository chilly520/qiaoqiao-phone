<template>
  <div class="theater-message" :class="{ 'night-mode': isNightMode }">
    <template v-for="(segment, index) in renderedSegments" :key="`${msg?.id || 'msg'}-${index}`">
      <!-- 场景标签 -->
      <div v-if="segment.type === 'scene'" class="scene-chip">
        <i class="fa-solid fa-location-dot scene-icon"></i>
        <span>{{ segment.content }}</span>
      </div>

      <!-- 旁白/叙述 - 图1风格：浅绿/青色 callout -->
      <div v-else-if="segment.type === 'narration'" class="narration-card">
        <div class="narration-accent"></div>
        <div class="narration-main">
          <i class="fa-solid fa-bullhorn narration-icon"></i>
          <div class="narration-text">{{ segment.content }}</div>
        </div>
      </div>

      <!-- 动作描写 - 图3风格：淡色背景，斜体 -->
      <div v-else-if="segment.type === 'action'" class="action-card">
        <div class="action-text">{{ segment.content }}</div>
      </div>

      <!-- 对话 - 图3风格：头像+名字+对话内容 -->
      <div v-else class="dialogue-row" :class="{ 'is-self': isRightAligned(segment) }">
        <img
          v-if="segment.showAvatar"
          :src="isRightAligned(segment) ? userAvatar : charAvatar"
          class="dialogue-avatar"
          alt=""
        >

        <div class="dialogue-content">
          <!-- 说话人名字 -->
          <div v-if="segment.speakerTagged && segment.speaker" class="dialogue-name">
            {{ segment.speaker }}
          </div>
          <!-- 对话内容 - 优化排版 -->
          <div class="dialogue-text" :class="{ 'is-tagged': segment.speakerTagged }">
            {{ formatDialogueContent(segment.content) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../../stores/settingsStore'
import { parseOfflineSegments } from '../../../utils/chatMessageDisplay'

const props = defineProps({
  msg: {
    type: Object,
    required: true
  },
  chatData: {
    type: Object,
    default: null
  },
  suppressInitialAvatar: {
    type: Boolean,
    default: false
  }
})

const settingsStore = useSettingsStore()

const isNightMode = computed(() => settingsStore.offlineMode.themeMode === 'night')

const segments = computed(() => parseOfflineSegments(props.msg))

const characterName = computed(() => (
  props.chatData?.name 
  || props.chatData?.userName 
  || '对方'
))

const userName = computed(() => (
  props.chatData?.groupSettings?.myNickname
  || props.chatData?.userName
  || settingsStore.personalization.userProfile.name
  || '我'
))

const userAvatar = computed(() => (
  props.chatData?.userAvatar
  || settingsStore.personalization.userProfile.avatar
  || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'
))

const charAvatar = computed(() => (
  props.chatData?.avatar
  || 'https://api.dicebear.com/bottts/svg?seed=Bot'
))

const renderedSegments = computed(() => {
  let lastSpeaker = null

  return segments.value.map((segment) => {
    if (segment.type !== 'dialogue') {
      lastSpeaker = null // Reset on non-dialogue
      return segment
    }

    const currentSpeaker = segment.speaker || (props.msg?.role === 'user' ? userName.value : characterName.value)
    
    // 如果是 NPC 标签式发言，或者与上一个 segment 说话人不同，显示头像
    const showAvatar = currentSpeaker !== lastSpeaker
    
    const next = {
      ...segment,
      showAvatar: showAvatar
    }

    lastSpeaker = currentSpeaker
    return next
  })
})

function isRightAligned(segment) {
  if (segment.speakerTagged) return segment.speaker === userName.value
  return props.msg?.role === 'user'
}

// 优化对话内容排版：智能处理换行，避免过短行
function formatDialogueContent(content) {
  if (!content) return ''
  
  // 清理内容：移除所有类型的引号（包括中文引号）
  let cleanContent = content
    .replace(/^[""''"'"'「【〖]+|[""''"'"'」】〗]+$/g, '')  // 首尾引号
    .replace(/[""]/g, '')  // 中间的所有引号
    .trim()
  
  // 将内容按换行分割
  const lines = cleanContent.split(/\n/)
  
  // 过滤空行并清理每行
  const nonEmptyLines = lines
    .map(l => l.trim().replace(/^[""'']+|[""'']+$/g, ''))  // 每行首尾引号
    .filter(l => l.length > 0)
  
  if (nonEmptyLines.length === 0) return ''
  if (nonEmptyLines.length === 1) return nonEmptyLines[0]
  
  // 智能合并策略：
  // 1. 如果所有行都很短（平均<30字），合并成一行
  // 2. 否则，只合并那些明显被错误断开的行
  const avgLength = nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length
  
  if (avgLength < 30) {
    // 所有行都很短，直接合并成一行
    return nonEmptyLines.join('')
  }
  
  // 智能合并：合并被错误断开的行
  const result = []
  let buffer = nonEmptyLines[0]
  
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const currentLine = nonEmptyLines[i]
    const prevLine = buffer
    
    // 判断是否需要合并：
    // 1. 上一行没有结束标点（。！？；）
    // 2. 上一行很短（<20字）或当前行很短（<15字）
    const hasEndPunctuation = /[。！？；~\-…]$/.test(prevLine)
    const shouldMerge = !hasEndPunctuation || prevLine.length < 20 || currentLine.length < 15
    
    if (shouldMerge) {
      buffer += currentLine
    } else {
      result.push(buffer)
      buffer = currentLine
    }
  }
  
  if (buffer) result.push(buffer)
  
  return result.join('\n')
}
</script>

<style scoped>
.theater-message {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

/* 场景标签 - 居中显示 */
.scene-chip {
  width: fit-content;
  max-width: 100%;
  margin: 8px auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(245, 247, 250, 0.95);
  color: #7a8a9a;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.night-mode .scene-chip {
  background: rgba(40, 45, 55, 0.95);
  color: #9aa5b5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.scene-icon {
  color: #9ab;
  font-size: 10px;
}

.night-mode .scene-icon {
  color: #789;
}

/* 旁白卡片 - 图1风格：浅青背景，左侧重色边框，带小喇叭图标 */
.narration-card {
  width: 100%;
  position: relative;
  border-radius: 12px;
  background: rgba(224, 242, 241, 0.75);
  border: 1px solid rgba(178, 223, 219, 0.5);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  margin: 4px 0;
}

.night-mode .narration-card {
  background: rgba(20, 45, 45, 0.6);
  border-color: rgba(40, 90, 90, 0.4);
}

.narration-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(to bottom, #4db6ac, #26a69a);
  border-radius: 12px 0 0 12px;
}

.narration-main {
  padding: 14px 18px 14px 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.narration-icon {
  margin-top: 3px;
  font-size: 14px;
  color: #ff5252; /* 红色喇叭小图标 */
  opacity: 0.9;
  filter: drop-shadow(0 0 3px rgba(255, 82, 82, 0.3));
}

.narration-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.85;
  text-align: left;
  color: #2c3e50;
  white-space: pre-wrap;
  word-break: break-word;
  font-weight: 500;
}

.night-mode .narration-text {
  color: #b2dfdb;
}

/* 动作描写 - 淡色斜体 */
.action-card {
  width: fit-content;
  max-width: min(100%, 340px);
  margin: 4px auto;
  padding: 8px 16px;
  border-radius: 12px;
  background: rgba(240, 243, 247, 0.7);
  border: 1px solid rgba(225, 230, 235, 0.5);
}

.night-mode .action-card {
  background: rgba(45, 50, 60, 0.6);
  border-color: rgba(65, 75, 90, 0.4);
}

.action-text {
  font-size: 13px;
  line-height: 1.6;
  color: #7a8a9a;
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: center;
}

.night-mode .action-text {
  color: #9aa5b5;
}

/* 对话行 - 图3风格 */
.dialogue-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 0;
}

.dialogue-row.is-self {
  flex-direction: row-reverse;
  text-align: right;
}

.dialogue-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid rgba(255, 255, 255, 0.9);
}

.night-mode .dialogue-avatar {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border-color: rgba(60, 70, 85, 0.8);
}

.dialogue-content {
  min-width: 0;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dialogue-name {
  font-size: 12px;
  color: #8a9aaa;
  font-weight: 500;
  margin-bottom: 2px;
}

.night-mode .dialogue-name {
  color: #8a95a5;
}

.dialogue-row.is-self .dialogue-name {
  text-align: right;
}

.dialogue-text {
  color: #2a3540;
  font-size: 15px;
  line-height: 1.85;
  font-weight: 400;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialogue-text.is-tagged {
  color: #1a2530;
  font-weight: 500;
}

.night-mode .dialogue-text {
  color: #d0d8e0;
}

.night-mode .dialogue-text.is-tagged {
  color: #e8eef5;
}
</style>
