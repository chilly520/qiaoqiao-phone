<template>
  <div class="theater-message" :class="{ 'night-mode': isNightMode }" :style="fontScaleStyle">
    <template v-for="(segment, index) in renderedSegments" :key="`${msg?.id || 'msg'}-${index}`">
      <!-- (Redundant internal timestamp removed to prevent fragmentation spam) -->
      
      <!-- 场景/地点标签 -->
      <div v-if="segment.type === 'scene' || segment.type === 'location'" class="scene-chip">
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

      <!-- \u7cfb\u7edf\u63d0\u793a/\u901a\u77e5 - \u5c45\u4e2d\u5c0f\u5b57 -->
      <div v-else-if="segment.type === 'system'" class="system-chip">
        <div class="system-chip-content">
          <i class="fa-solid fa-circle-info system-icon"></i>
          <span>{{ segment.content }}</span>
        </div>
      </div>

      <!-- 对话 - 优化气泡样式 -->
      <div v-else class="dialogue-row" :class="[getDialogueClass(segment)]">
        <!-- 头像：仅角色和用户显示，NPC不显示 -->
        <img
          v-if="segment.showAvatar && !isNPC(segment)"
          :src="isRightAligned(segment) ? userAvatar : charAvatar"
          class="dialogue-avatar"
          alt=""
        >

        <div class="dialogue-content">
          <!-- 说话人名字 -->
          <div v-if="segment.speakerTagged && segment.speaker" class="dialogue-name" :class="[getSpeakerClass(segment)]">
            {{ segment.speaker }}
          </div>
          <!-- 对话气泡 -->
          <div class="dialogue-bubble" :class="[getBubbleClass(segment)]">
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
import { useChatStore } from '../../../stores/chatStore'
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
const chatStore = useChatStore()

// 使用当前聊天的独立主题模式
const isNightMode = computed(() => {
  const chatId = chatStore.currentChatId || props.chatData?.id
  if (chatId) {
    const chatMode = settingsStore.getChatOfflineMode(chatId)
    return chatMode.themeMode === 'night'
  }
  return false
})

// 字体缩放样式
const fontScaleStyle = computed(() => ({
  fontSize: `${settingsStore.fontScale * 100}%`
}))

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
  // 每个对话 segment 都显示头像
  return segments.value.map((segment) => {
    if (segment.type !== 'dialogue') {
      return segment
    }
 
    // 每个对话 segment 都显示头像
    return {
      ...segment,
      showAvatar: true
    }
  })
})

function isRightAligned(segment) {
  if (segment.speakerTagged) return segment.speaker === userName.value
  return props.msg?.role === 'user'
}

// 判断是否为 NPC（通过「名字：内容」格式且名字不是角色名或用户名）
function isNPC(segment) {
  if (!segment || !segment.speakerTagged || !segment.speaker) return false
  const speaker = segment.speaker
  // 如果是用户或角色，不是 NPC
  if (speaker === userName.value || speaker === characterName.value) return false
  // 其他带标签的发言者视为 NPC
  return true
}

// 获取对话行的样式类
function getDialogueClass(segment) {
  if (!segment) return []
  const classes = []
  if (isRightAligned(segment)) classes.push('is-self')
  if (isNPC(segment)) classes.push('is-npc')
  return classes
}

// 获取说话人名字样式类
function getSpeakerClass(segment) {
  if (!segment) return 'char-speaker'
  if (isNPC(segment)) return 'npc-speaker'
  if (isRightAligned(segment)) return 'user-speaker'
  return 'char-speaker'
}

// 获取气泡样式类
function getBubbleClass(segment) {
  if (!segment) return 'char-bubble'
  if (isNPC(segment)) return 'npc-bubble'
  if (isRightAligned(segment)) return 'user-bubble'
  return 'char-bubble'
}

// \u4f18\u5316\u5bf9\u8bdd\u5185\u5bb9\u6392\u7248\uff1a\u667a\u80fd\u5904\u7406\u6362\u884c\uff0c\u907f\u514d\u8fc7\u77ed\u884c
function formatDialogueContent(content) {
  if (!content) return ''
  
  // \u6e05\u7406\u5185\u5bb9\uff1a\u79fb\u9664\u6240\u6709\u7c7b\u578b\u7684\u5f15\u53f7\uff08\u5305\u62ec\u4e2d\u6587\u5f15\u53f7\uff09
  // Use escaped characters to prevent build-time syntax errors
  let cleanContent = content
    .replace(/^[\x22\x27\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\u3010\u3011\u3016\u3017]+|[\x22\x27\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\u3010\u3011\u3016\u3017]+$/g, '')
    .replace(/[\x22\x27\u201c\u201d\u2018\u2019]/g, '')
    .trim()
  
  // \u5c06\u5185\u5bb9\u6309\u6362\u884c\u5206\u5272
  const lines = cleanContent.split(/\n/)
  
  // \u8fc7\u6ee4\u7a7a\u884c\u5e76\u6e05\u7406\u6bcf\u884c
  const nonEmptyLines = lines
    .map(l => l.trim().replace(/^[\x22\x27\u201c\u201d\u2018\u2019]+|[\x22\x27\u201c\u201d\u2018\u2019]+$/g, ''))
    .filter(l => l.length > 0)
  
  if (nonEmptyLines.length === 0) return ''
  if (nonEmptyLines.length === 1) return nonEmptyLines[0]
  
  const avgLength = nonEmptyLines.reduce((sum, l) => sum + l.length, 0) / nonEmptyLines.length
  
  if (avgLength < 30) {
    return nonEmptyLines.join('')
  }
  
  const result = []
  let buffer = nonEmptyLines[0]
  
  for (let i = 1; i < nonEmptyLines.length; i++) {
    const currentLine = nonEmptyLines[i]
    const prevLine = buffer
    
    // \u5224\u65ad\u662f\u5426\u9700\u8981\u5408\u5e76\uff1a\u53e5\u5c3e\u6ca1\u6709\u7ec8\u6b62\u6807\u70b9
    const hasEndPunctuation = /[\u3002\uff01\uff1f\uff1b~\-\u2026]$/.test(prevLine)
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

// \u683c\u5f0f\u5316\u65f6\u95f4\u6233
function formatTimestamp(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}
</script>

<style scoped>
.theater-message {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
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

/* 系统提示/通知 - 居中小字 */
.system-chip {
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 6px 0;
}

.system-chip-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(4px);
  border-radius: 999px;
  color: #8a97a8;
  font-size: 10px;
  font-weight: 400;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.night-mode .system-chip-content {
  background: rgba(255, 255, 255, 0.05);
  color: #9aa5b5;
  border-color: rgba(255, 255, 255, 0.03);
}

.system-icon {
  font-size: 10px;
  opacity: 0.8;
}

/* 时间戳标签 */
.timestamp-chip {
  width: fit-content;
  margin: 4px auto 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(60, 80, 100, 0.25);
  color: #4a5568;
  font-size: 10px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.night-mode .timestamp-chip {
  background: rgba(30, 40, 50, 0.6);
  color: #cbd5e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.timestamp-chip i {
  font-size: 9px;
  opacity: 0.8;
}

/* 旁白卡片 - 图 1 风格：浅青背景，左侧重色边框，带小喇叭图标 */
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
  font-size: 1em;
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
  font-size: 0.93em;
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

/* 对话行 - 优化气泡样式 */
.dialogue-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 3px 0;
}

.dialogue-row.is-self {
  flex-direction: row-reverse;
  text-align: right;
}

/* NPC 对话居中显示 */
.dialogue-row.is-npc {
  justify-content: center;
}

.dialogue-row.is-npc .dialogue-content {
  align-items: center;
  text-align: center;
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

/* 说话人名字样式 */
.dialogue-name {
  font-size: 0.75em;
  font-weight: 600;
  margin-bottom: 2px;
  padding: 0 12px;
}

/* 角色名字 - 左侧 */
.dialogue-name.char-speaker {
  color: #5a7a9a;
  text-align: left;
}

.night-mode .dialogue-name.char-speaker {
  color: #a0b8d8;
}

/* 用户名字 - 右侧 */
.dialogue-name.user-speaker {
  color: #4a9a7a;
  text-align: right;
}

.night-mode .dialogue-name.user-speaker {
  color: #7dd3a0;
}

/* NPC 名字 - 居中 */
.dialogue-name.npc-speaker {
  color: #9a7a5a;
  text-align: center;
  font-style: italic;
}

.night-mode .dialogue-name.npc-speaker {
  color: #e8c8a0;
}

/* 对话气泡基础样式 */
.dialogue-bubble {
  font-size: 1.07em;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 10px 14px;
  border-radius: 16px;
  max-width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

/* 角色气泡 - 左侧淡蓝 */
.dialogue-bubble.char-bubble {
  background: linear-gradient(135deg, rgba(240, 248, 255, 0.95), rgba(230, 242, 252, 0.95));
  color: #2a4050;
  border-bottom-left-radius: 4px;
}

.night-mode .dialogue-bubble.char-bubble {
  background: linear-gradient(135deg, rgba(55, 70, 95, 0.85), rgba(50, 65, 90, 0.85));
  color: #d0e0f0;
  border-color: rgba(120, 150, 190, 0.25);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* 用户气泡 - 右侧淡绿 */
.dialogue-bubble.user-bubble {
  background: linear-gradient(135deg, rgba(232, 248, 240, 0.95), rgba(222, 242, 232, 0.95));
  color: #2a5040;
  border-bottom-right-radius: 4px;
}

.night-mode .dialogue-bubble.user-bubble {
  background: linear-gradient(135deg, rgba(45, 85, 70, 0.85), rgba(40, 80, 65, 0.85));
  color: #a8f0c8;
  border-color: rgba(100, 180, 140, 0.25);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* NPC 气泡 - 居中淡金 */
.dialogue-bubble.npc-bubble {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.95), rgba(252, 242, 225, 0.95));
  color: #5a4a3a;
  border-radius: 12px;
  font-style: italic;
  box-shadow: 0 2px 10px rgba(200, 160, 100, 0.15);
}

.night-mode .dialogue-bubble.npc-bubble {
  background: linear-gradient(135deg, rgba(80, 70, 55, 0.85), rgba(75, 65, 50, 0.85));
  color: #f0e0c0;
  border-color: rgba(200, 170, 120, 0.25);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* 系统芯片 - 居中小字 */
.system-chip {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 12px 0;
  pointer-events: none;
}

.system-chip-content {
  background: rgba(0, 0, 0, 0.05);
  color: #708090;
  font-size: 0.8em;
  padding: 4px 12px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0, 0, 0, 0.03);
  letter-spacing: 0.5px;
}

.night-mode .system-chip-content {
  background: rgba(255, 255, 255, 0.08);
  color: #90a0b0;
  border-color: rgba(255, 255, 255, 0.05);
}

.system-icon {
  font-size: 10px;
  opacity: 0.8;
}
</style>
