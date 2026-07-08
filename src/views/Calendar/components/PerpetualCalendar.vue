<template>
  <div class="perpetual-calendar">
    <!-- 日期选择器 -->
    <div class="date-selector">
      <div class="selector-row">
        <select v-model="selectedYear" class="date-select">
          <option v-for="year in yearRange" :key="year" :value="year">{{ year }}年</option>
        </select>
        <select v-model="selectedMonth" class="date-select">
          <option v-for="m in 12" :key="m" :value="m - 1">{{ m }}月</option>
        </select>
        <select v-model="selectedDay" class="date-select">
          <option v-for="d in daysInMonth" :key="d" :value="d">{{ d }}日</option>
        </select>
      </div>
      <button class="today-btn" @click="goToToday">回到今天</button>
    </div>

    <!-- 黄历信息卡 -->
    <div class="almanac-card">
      <div class="card-header">
        <h2>📜 每日黄历</h2>
        <span class="date-display">{{ almanac.date }}</span>
      </div>

      <!-- 公历 + 干支 -->
      <div class="info-section">
        <h3>📅 日期与干支</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">公历</span>
            <span class="value">{{ almanac.solar.year }}年{{ almanac.solar.month }}月{{ almanac.solar.day }}日</span>
          </div>
          <div class="info-item">
            <span class="label">星期</span>
            <span class="value">{{ almanac.solar.weekdayName }}</span>
          </div>
          <div class="info-item">
            <span class="label">干支年</span>
            <span class="value highlight">{{ almanac.ganzhi.year.full }} ({{ almanac.zodiac }}年)</span>
          </div>
          <div class="info-item">
            <span class="label">干支月</span>
            <span class="value">{{ almanac.ganzhi.month.full }}</span>
          </div>
          <div class="info-item">
            <span class="label">干支日</span>
            <span class="value highlight">{{ almanac.ganzhi.day.full }}</span>
          </div>
          <div class="info-item">
            <span class="label">干支时</span>
            <span class="value">{{ almanac.ganzhi.hour.full }}</span>
          </div>
          <div class="info-item">
            <span class="label">当前节气</span>
            <span class="value term">{{ almanac.solar.term }}</span>
          </div>
          <div class="info-item">
            <span class="label">生肖</span>
            <span class="value zodiac">{{ almanac.zodiac }}</span>
          </div>
          <div class="info-item">
            <span class="label">五行</span>
            <span class="value wuxing-tag" :class="'wx-' + almanac.wuxing">{{ almanac.wuxing }}</span>
          </div>
          <div class="info-item">
            <span class="label">冲煞</span>
            <span class="value chong-sha">{{ almanac.chongSha.full }}</span>
          </div>
        </div>
      </div>

      <!-- 12建除 宜忌 -->
      <div class="info-section yi-ji">
        <h3>🎯 {{ almanac.jianchu.name }}日 宜忌</h3>
        <p class="jianchu-desc">{{ almanac.jianchu.desc }}</p>
        <div class="yi-ji-grid">
          <div class="yi-box">
            <div class="yi-ji-title">✅ 宜</div>
            <div class="yi-ji-content">
              <span v-for="(item, idx) in almanac.jianchu.yi" :key="idx" class="tag yi">{{ item }}</span>
            </div>
          </div>
          <div class="ji-box">
            <div class="yi-ji-title">❌ 忌</div>
            <div class="yi-ji-content">
              <span v-for="(item, idx) in almanac.jianchu.ji" :key="idx" class="tag ji">{{ item }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 吉神方位 -->
      <div class="info-section">
        <h3>🧭 神煞方位</h3>
        <div class="dir-grid">
          <div class="dir-item">
            <span class="dir-icon">💰</span>
            <span class="dir-label">财神</span>
            <span class="dir-value">{{ almanac.directions.caishen }}</span>
          </div>
          <div class="dir-item">
            <span class="dir-icon">😊</span>
            <span class="dir-label">喜神</span>
            <span class="dir-value">{{ almanac.directions.xishen }}</span>
          </div>
          <div class="dir-item">
            <span class="dir-icon">🍀</span>
            <span class="dir-label">福神</span>
            <span class="dir-value">{{ almanac.directions.fushen }}</span>
          </div>
        </div>
      </div>

      <!-- 12时辰吉凶 -->
      <div class="info-section">
        <h3>⏰ 十二时辰吉凶</h3>
        <div class="shichen-grid">
          <div
            v-for="(sc, idx) in almanac.shichen"
            :key="sc.name"
            class="shichen-item"
            :class="{ good: sc.isGood, bad: !sc.isGood, current: idx === currentShichenIdx }"
          >
            <div class="sc-name">{{ sc.name }}</div>
            <div class="sc-time">{{ sc.time }}</div>
            <div class="sc-luck">{{ sc.luck }}</div>
          </div>
        </div>
      </div>

      <!-- 八字排盘 -->
      <div class="info-section bazi">
        <h3>📿 四柱八字</h3>
        <div class="bazi-display">
          <div class="bazi-row">
            <div class="bazi-label">年柱</div>
            <div class="bazi-value">{{ almanac.bazi.year }}</div>
            <div class="bazi-na">{{ almanac.bazi.yearNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">月柱</div>
            <div class="bazi-value">{{ almanac.bazi.month }}</div>
            <div class="bazi-na">{{ almanac.bazi.monthNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">日柱</div>
            <div class="bazi-value highlight">{{ almanac.bazi.day }}</div>
            <div class="bazi-na">{{ almanac.bazi.dayNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">时柱</div>
            <div class="bazi-value">{{ almanac.bazi.hour }}</div>
            <div class="bazi-na">{{ almanac.bazi.hourNa }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <div class="almanac-note">
      <i class="fa-solid fa-circle-info"></i>
      干支/建除/冲煞/方位 全部基于真算法计算(J2000.0 + 通式寿星公式);运势类内容为传统经验推断,仅供参考。
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  getDailyAlmanac,
  getCurrentShichen,
  SHICHEN
} from '@/utils/almanac'

const today = new Date()
const selectedYear = ref(today.getFullYear())
const selectedMonth = ref(today.getMonth())
const selectedDay = ref(today.getDate())

const yearRange = computed(() => {
  const cur = today.getFullYear()
  return Array.from({ length: 100 }, (_, i) => cur - 50 + i)
})

const daysInMonth = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate()
})

const currentDate = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, selectedDay.value)
})

const almanac = computed(() => getDailyAlmanac(currentDate.value))

// 当前时辰索引
const currentShichenIdx = computed(() => {
  const sc = getCurrentShichen()
  return SHICHEN.findIndex(s => s.name === sc.name)
})

function goToToday() {
  selectedYear.value = today.getFullYear()
  selectedMonth.value = today.getMonth()
  selectedDay.value = today.getDate()
}
</script>

<style scoped>
.perpetual-calendar {
  padding: 0 0 20px;
}

/* 日期选择器 */
.date-selector {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}
.selector-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.date-select {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid rgba(139, 122, 168, 0.2);
  border-radius: 10px;
  background: white;
  color: #5a5a7a;
  font-size: 14px;
  cursor: pointer;
}
.today-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* 黄历卡片 */
.almanac-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(139, 122, 168, 0.1);
}
.card-header {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.3), rgba(197, 201, 255, 0.3));
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}
.date-display {
  font-size: 13px;
  color: #8b7aa8;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 10px;
  border-radius: 12px;
}

.info-section {
  padding: 16px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}
.info-section:last-child { border-bottom: none; }
.info-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 12px 0;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: rgba(139, 122, 168, 0.04);
  border-radius: 8px;
}
.info-item .label {
  font-size: 10px;
  color: #9a8fb8;
}
.info-item .value {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}
.info-item .value.highlight { color: #ff6b9d; font-weight: 600; }
.info-item .value.zodiac { font-size: 16px; }
.info-item .value.term { color: #7fb069; font-weight: 600; }
.info-item .value.chong-sha { color: #e6a23c; font-weight: 600; }

/* 五行颜色 */
.wx-木 { color: #67c23a; font-weight: 600; }
.wx-火 { color: #f56c6c; font-weight: 600; }
.wx-土 { color: #d4a857; font-weight: 600; }
.wx-金 { color: #909399; font-weight: 600; }
.wx-水 { color: #409eff; font-weight: 600; }

/* 宜忌区块 */
.jianchu-desc {
  font-size: 12px;
  color: #8b7aa8;
  background: rgba(255, 183, 197, 0.08);
  padding: 8px 12px;
  border-radius: 8px;
  margin: 0 0 12px;
  border-left: 3px solid #ffb7c5;
}
.yi-ji-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.yi-box, .ji-box {
  padding: 12px;
  border-radius: 12px;
}
.yi-box { background: linear-gradient(135deg, rgba(127, 176, 105, 0.1), rgba(127, 176, 105, 0.05)); }
.ji-box { background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(255, 107, 157, 0.05)); }
.yi-ji-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.yi-box .yi-ji-title { color: #7fb069; }
.ji-box .yi-ji-title { color: #ff6b9d; }
.yi-ji-content { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}
.tag.yi { background: rgba(127, 176, 105, 0.18); color: #5a8c4a; }
.tag.ji { background: rgba(255, 107, 157, 0.18); color: #d4557a; }

/* 神煞方位 */
.dir-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.dir-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  background: linear-gradient(135deg, #fff8f0, #fff0f5);
  border-radius: 12px;
  border: 1px solid #ffe4d6;
}
.dir-icon { font-size: 24px; }
.dir-label { font-size: 11px; color: #9a8fb8; }
.dir-value { font-size: 13px; font-weight: 700; color: #ff6b9d; }

/* 时辰吉凶 */
.shichen-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.shichen-item {
  padding: 10px 4px;
  border-radius: 10px;
  text-align: center;
  background: rgba(139, 122, 168, 0.05);
  position: relative;
}
.shichen-item.good {
  background: linear-gradient(135deg, rgba(127, 176, 105, 0.18), rgba(127, 176, 105, 0.05));
}
.shichen-item.bad {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.12), rgba(255, 107, 157, 0.05));
}
.shichen-item.current {
  outline: 2px solid #ff6b9d;
  outline-offset: -2px;
  box-shadow: 0 0 12px rgba(255, 107, 157, 0.3);
}
.sc-name { font-size: 12px; font-weight: 600; color: #5a5a7a; }
.sc-time { font-size: 9px; color: #9a8fb8; margin-top: 2px; }
.sc-luck { font-size: 11px; margin-top: 4px; font-weight: 600; }
.shichen-item.good .sc-luck { color: #7fb069; }
.shichen-item.bad .sc-luck { color: #ff6b9d; }

/* 八字 */
.bazi-display { display: flex; flex-direction: column; gap: 8px; }
.bazi-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.1), rgba(255, 183, 197, 0.05));
  border-radius: 10px;
}
.bazi-label { width: 50px; font-size: 12px; color: #9a8fb8; }
.bazi-value {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: #5a5a7a;
  font-family: serif;
  text-align: center;
}
.bazi-value.highlight { color: #ff6b9d; }
.bazi-na {
  font-size: 11px;
  color: #8b7aa8;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 8px;
  border-radius: 10px;
}

/* 提示 */
.almanac-note {
  margin: 16px 20px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.1), rgba(255, 183, 197, 0.1));
  border-radius: 12px;
  font-size: 11px;
  color: #8b7aa8;
  line-height: 1.6;
  border-left: 3px solid #c5c9ff;
}
.almanac-note i { margin-right: 6px; color: #c5c9ff; }
</style>
