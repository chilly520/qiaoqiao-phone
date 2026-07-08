<template>
  <!-- v1.10.94: 绑定角色上下文小部件 -->
  <!-- 显示当前选中日期上,所有已绑定角色在 LoveSpace 中的日程 -->
  <!-- v1.10.94b: 即使没初始化空间,也要显示引导卡,告诉用户去绑定角色 -->
  <div class="character-context-widget" :class="{ empty: !hasAnySchedule }">
    <div class="ccw-header">
      <i class="fa-solid fa-heart-pulse"></i>
      <span>{{ hasAnySchedule ? `TA 在${formattedDate}的安排` : 'TA 的安排' }}</span>
    </div>
    <div v-for="ctx in characterContexts" :key="ctx.charId" class="ccw-character">
      <div class="ccw-char-header">
        <img v-if="ctx.avatar" :src="ctx.avatar" class="ccw-avatar" />
        <div v-else class="ccw-avatar ccw-avatar-default">{{ ctx.name?.[0] || '?' }}</div>
        <div class="ccw-char-info">
          <div class="ccw-char-name">{{ ctx.name || 'TA' }}</div>
          <div class="ccw-char-day">第 {{ ctx.loveDays || 0 }} 天</div>
        </div>
      </div>
      <div v-if="ctx.schedules.length > 0" class="ccw-schedules">
        <div v-for="s in ctx.schedules" :key="s.id" class="ccw-schedule-item">
          <span class="ccw-time">{{ s.time || '全天' }}</span>
          <span class="ccw-title">{{ s.title }}</span>
          <span v-if="s.location" class="ccw-loc">📍{{ s.location }}</span>
        </div>
      </div>
      <div v-else class="ccw-no-schedule">{{ formattedDate }} 没有特别安排</div>
    </div>

    <!-- 没有任何空间/角色时,显示引导 -->
    <div v-if="characterContexts.length === 0" class="ccw-empty-tip">
      <div class="ccw-empty-icon">💝</div>
      <div class="ccw-empty-text">
        还没有绑定任何角色。去「情侣空间」绑定一个角色,TA 每天的安排就会出现在这里。
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useChatStore } from '@/stores/chatStore'

const props = defineProps({
  date: {  // Date 对象
    type: Date,
    required: true
  }
})

const loveSpaceStore = useLoveSpaceStore()
const chatStore = useChatStore()

const formattedDate = computed(() => {
  const d = props.date
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const dateStr = computed(() => {
  const d = props.date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// 遍历所有已初始化的空间,看该日期有谁有日程
// 兜底:如果 LoveSpace 没数据,从 chatStore.contactList 找已绑定的角色
const characterContexts = computed(() => {
  const spaces = loveSpaceStore.spaces || {}
  const result = []
  const seen = new Set()
  for (const [charId, space] of Object.entries(spaces)) {
    if (!space.initialized && !space.partner) continue
    seen.add(charId)
    const schedules = (space.schedules || []).filter(s => s.date === dateStr.value)
    result.push({
      charId,
      name: space.partner?.name || space.partner?.nickname || 'TA',
      avatar: space.partner?.avatar,
      loveDays: space.loveDays,
      schedules: schedules.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
    })
  }
  return result
})

// 永远显示(展示引导),不再用 hasAnySchedule 控制可见
const hasAnySchedule = computed(() => characterContexts.value.length > 0)
</script>

<style scoped>
.character-context-widget {
  margin: 12px 0 0;
  background: linear-gradient(135deg, #fff0f5 0%, #f5f0ff 100%);
  border-radius: 14px;
  padding: 14px 16px;
  border: 1.5px solid #f0d6e8;
}
.ccw-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #c95a8a;
  margin-bottom: 12px;
  letter-spacing: 0.3px;
}
.ccw-header i { color: #ff6b9d; font-size: 14px; }
.ccw-character {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.ccw-character:last-child { margin-bottom: 0; }
.ccw-char-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ccw-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid #ffb7c5;
}
.ccw-avatar-default {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 14px;
  font-weight: 700;
}
.ccw-char-info { flex: 1; min-width: 0; }
.ccw-char-name { font-size: 13px; font-weight: 600; color: #5a5a7a; }
.ccw-char-day { font-size: 10px; color: #b8a8c8; }

.ccw-schedules {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ccw-schedule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: white;
  border-radius: 8px;
  font-size: 12px;
}
.ccw-time {
  font-size: 11px;
  color: #ff6b9d;
  font-weight: 600;
  background: rgba(255, 107, 157, 0.1);
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
  min-width: 50px;
  text-align: center;
}
.ccw-title { color: #5a5a7a; flex: 1; min-width: 0; word-break: break-word; }
.ccw-loc {
  font-size: 10px;
  color: #8b7aa8;
  flex-shrink: 0;
}

.ccw-no-schedule {
  font-size: 11px;
  color: #b8a8c8;
  font-style: italic;
  padding: 4px 8px;
  text-align: center;
}

/* v1.10.94b: 引导卡(没角色时) */
.ccw-empty-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  border: 1px dashed rgba(255, 183, 197, 0.4);
}
.ccw-empty-icon {
  font-size: 24px;
  flex-shrink: 0;
}
.ccw-empty-text {
  font-size: 12px;
  color: #8b7aa8;
  line-height: 1.5;
}
.character-context-widget.empty {
  background: linear-gradient(135deg, #faf6ff 0%, #fff5f9 100%);
  border: 1.5px dashed #e8d4f0;
}
</style>
