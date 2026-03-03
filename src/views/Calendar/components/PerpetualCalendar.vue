<template>
  <div class="perpetual-calendar">
    <!-- 日期选择器 -->
    <div class="date-selector">
      <div class="selector-row">
        <select v-model="selectedYear" class="date-select">
          <option v-for="year in yearRange" :key="year" :value="year">{{ year }}年</option>
        </select>
        <select v-model="selectedMonth" class="date-select">
          <option v-for="month in 12" :key="month" :value="month - 1">{{ month }}月</option>
        </select>
        <select v-model="selectedDay" class="date-select">
          <option v-for="day in daysInMonth" :key="day" :value="day">{{ day }}日</option>
        </select>
      </div>
      <button class="today-btn" @click="goToToday">回到今天</button>
    </div>

    <!-- 详细万年历信息 -->
    <div class="almanac-card">
      <div class="card-header">
        <h2>📜 万年历详解</h2>
        <span class="date-display">{{ formattedDate }}</span>
      </div>

      <!-- 公历信息 -->
      <div class="info-section">
        <h3>📅 公历信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">公历日期</span>
            <span class="value">{{ solarDate }}</span>
          </div>
          <div class="info-item">
            <span class="label">星期</span>
            <span class="value">{{ weekDay }}</span>
          </div>
          <div class="info-item">
            <span class="label">星座</span>
            <span class="value">{{ zodiacSign }}</span>
          </div>
          <div class="info-item">
            <span class="label">节气</span>
            <span class="value" :class="{ 'has-term': currentTerm }">{{ currentTerm || '无' }}</span>
          </div>
          <div class="info-item">
            <span class="label">节日</span>
            <span class="value" :class="{ 'has-festival': currentFestival }">{{ currentFestival || '无' }}</span>
          </div>
        </div>
      </div>

      <!-- 农历信息 -->
      <div class="info-section">
        <h3>🌙 农历信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">农历日期</span>
            <span class="value highlight">{{ lunarDate.fullDate }}</span>
          </div>
          <div class="info-item">
            <span class="label">干支纪年</span>
            <span class="value">{{ lunarDate.yearName }}</span>
          </div>
          <div class="info-item">
            <span class="label">生肖</span>
            <span class="value zodiac">{{ lunarDate.zodiac }}</span>
          </div>
          <div class="info-item">
            <span class="label">农历月份</span>
            <span class="value">{{ lunarDate.monthName }}</span>
          </div>
          <div class="info-item">
            <span class="label">农历月日</span>
            <span class="value">{{ lunarDate.monthName }}{{ lunarDate.dayName }}</span>
          </div>
          <div class="info-item">
            <span class="label">当前时辰</span>
            <span class="value">{{ currentShichen }}</span>
          </div>
        </div>
      </div>

      <!-- 黄历宜忌 -->
      <div class="info-section yi-ji">
        <h3>🎯 今日宜忌</h3>
        <div class="yi-ji-grid">
          <div class="yi-box">
            <div class="yi-ji-title">✅ 宜</div>
            <div class="yi-ji-content">
              <span v-for="(item, idx) in yiList" :key="idx" class="tag yi">{{ item }}</span>
              <span v-if="yiList.length === 0" class="empty">无</span>
            </div>
          </div>
          <div class="ji-box">
            <div class="yi-ji-title">❌ 忌</div>
            <div class="yi-ji-content">
              <span v-for="(item, idx) in jiList" :key="idx" class="tag ji">{{ item }}</span>
              <span v-if="jiList.length === 0" class="empty">无</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 吉神凶煞 -->
      <div class="info-section">
        <h3>⭐ 吉神凶煞</h3>
        <div class="god-grid">
          <div class="god-box good">
            <div class="god-title">吉神宜趋</div>
            <div class="god-list">{{ goodGods.join('、') || '无' }}</div>
          </div>
          <div class="god-box bad">
            <div class="god-title">凶煞宜忌</div>
            <div class="god-list">{{ badGods.join('、') || '无' }}</div>
          </div>
        </div>
      </div>

      <!-- 时辰吉凶 -->
      <div class="info-section">
        <h3>⏰ 十二时辰吉凶</h3>
        <div class="shichen-grid">
          <div 
            v-for="sc in shichenList" 
            :key="sc.name"
            class="shichen-item"
            :class="{ good: sc.isGood, bad: !sc.isGood }"
          >
            <div class="sc-name">{{ sc.name }}</div>
            <div class="sc-time">{{ sc.time }}</div>
            <div class="sc-luck">{{ sc.luck }}</div>
          </div>
        </div>
      </div>

      <!-- 命理信息 -->
      <div class="info-section destiny">
        <h3>🔮 命理信息</h3>
        <div class="destiny-grid">
          <div class="destiny-item">
            <span class="destiny-label">胎神占方</span>
            <span class="destiny-value">{{ taiShen }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">彭祖百忌</span>
            <span class="destiny-value">{{ pengZu }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">财神方位</span>
            <span class="destiny-value">{{ caiShen }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">喜神方位</span>
            <span class="destiny-value">{{ xiShen }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">福神方位</span>
            <span class="destiny-value">{{ fuShen }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">阳贵神</span>
            <span class="destiny-value">{{ yangGui }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">阴贵神</span>
            <span class="destiny-value">{{ yinGui }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">五行</span>
            <span class="destiny-value">{{ wuXing }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">冲煞</span>
            <span class="destiny-value">{{ chongSha }}</span>
          </div>
          <div class="destiny-item">
            <span class="destiny-label">值日天神</span>
            <span class="destiny-value">{{ zhiRi }}</span>
          </div>
        </div>
      </div>

      <!-- 八字信息 -->
      <div class="info-section bazi">
        <h3>📿 八字排盘</h3>
        <div class="bazi-display">
          <div class="bazi-row">
            <div class="bazi-label">年柱</div>
            <div class="bazi-value">{{ bazi.year }}</div>
            <div class="bazi-na">{{ bazi.yearNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">月柱</div>
            <div class="bazi-value">{{ bazi.month }}</div>
            <div class="bazi-na">{{ bazi.monthNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">日柱</div>
            <div class="bazi-value highlight">{{ bazi.day }}</div>
            <div class="bazi-na">{{ bazi.dayNa }}</div>
          </div>
          <div class="bazi-row">
            <div class="bazi-label">时柱</div>
            <div class="bazi-value">{{ bazi.hour }}</div>
            <div class="bazi-na">{{ bazi.hourNa }}</div>
          </div>
        </div>
      </div>

      <!-- 今日运势 -->
      <div class="info-section fortune">
        <h3>🍀 今日运势</h3>
        <div class="fortune-grid">
          <div class="fortune-row">
            <div class="fortune-item">
              <div class="fortune-name">综合</div>
              <div class="fortune-stars">{{ '⭐'.repeat(fortune.overall) }}</div>
            </div>
            <div class="fortune-item">
              <div class="fortune-name">爱情</div>
              <div class="fortune-stars">{{ '⭐'.repeat(fortune.love) }}</div>
            </div>
            <div class="fortune-item">
              <div class="fortune-name">事业</div>
              <div class="fortune-stars">{{ '⭐'.repeat(fortune.career) }}</div>
            </div>
          </div>
          <div class="fortune-row">
            <div class="fortune-item">
              <div class="fortune-name">财运</div>
              <div class="fortune-stars">{{ '⭐'.repeat(fortune.wealth) }}</div>
            </div>
            <div class="fortune-item">
              <div class="fortune-name">健康</div>
              <div class="fortune-stars">{{ '⭐'.repeat(fortune.health) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 生辰八字解读 -->
      <div class="info-section interpretation">
        <h3>💫 八字解读</h3>
        <div class="interp-content">
          <p><strong>日主：</strong>{{ bazi.day.split('')[0] }}日主，{{ dayZhuInterpretation }}</p>
          <p><strong>五行分析：</strong>{{ wuXingAnalysis }}</p>
          <p><strong>今日建议：</strong>{{ todayAdvice }}</p>
        </div>
      </div>
    </div>

    <!-- AI查询按钮 -->
    <div class="ai-query-section">
      <p class="ai-tip">💡 命理大师AI可以为您详细解读此日八字</p>
      <button class="ai-query-btn" @click="queryAIForAlmanac">
        <span>🤖 询问AI命理大师</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useCalendarStore } from '../../../stores/calendarStore'
import { useChatStore } from '../../../stores/chatStore'

const calendarStore = useCalendarStore()
const chatStore = useChatStore()

// 日期选择
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth())
const selectedDay = ref(new Date().getDate())

const yearRange = computed(() => {
  const current = new Date().getFullYear()
  return Array.from({ length: 100 }, (_, i) => current - 50 + i)
})

const daysInMonth = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate()
})

const currentDate = computed(() => {
  return new Date(selectedYear.value, selectedMonth.value, selectedDay.value)
})

const formattedDate = computed(() => {
  return calendarStore.formatDateStr(currentDate.value)
})

const solarDate = computed(() => {
  return `${selectedYear.value}年${selectedMonth.value + 1}月${selectedDay.value}日`
})

const weekDay = computed(() => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[currentDate.value.getDay()]
})

const zodiacSign = computed(() => {
  const month = selectedMonth.value + 1
  const day = selectedDay.value
  const signs = [
    { name: '摩羯座', start: [1, 20], end: [2, 18] },
    { name: '水瓶座', start: [2, 19], end: [3, 20] },
    { name: '双鱼座', start: [3, 21], end: [4, 19] },
    { name: '白羊座', start: [4, 20], end: [5, 20] },
    { name: '金牛座', start: [5, 21], end: [6, 21] },
    { name: '双子座', start: [6, 22], end: [7, 22] },
    { name: '巨蟹座', start: [7, 23], end: [8, 22] },
    { name: '狮子座', start: [8, 23], end: [9, 22] },
    { name: '处女座', start: [9, 23], end: [10, 23] },
    { name: '天秤座', start: [10, 24], end: [11, 22] },
    { name: '天蝎座', start: [11, 23], end: [12, 21] },
    { name: '射手座', start: [12, 22], end: [12, 31] },
    { name: '摩羯座', start: [1, 1], end: [1, 19] }
  ]
  
  for (const sign of signs) {
    const [startMonth, startDay] = sign.start
    const [endMonth, endDay] = sign.end
    
    if (month === startMonth && day >= startDay) return sign.name
    if (month === endMonth && day <= endDay) return sign.name
    if (startMonth < endMonth && month > startMonth && month < endMonth) return sign.name
  }
  return '未知'
})

const lunarDate = computed(() => {
  return calendarStore.getLunarDate(currentDate.value)
})

const currentTerm = computed(() => {
  return calendarStore.getSolarTerm(currentDate.value)
})

const currentFestival = computed(() => {
  return calendarStore.getFestival(currentDate.value)
})

const currentShichen = computed(() => {
  const hour = new Date().getHours()
  const shichenList = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']
  return shichenList[Math.floor((hour + 1) / 2) % 12]
})

// 宜忌数据（模拟）
const yiList = computed(() => {
  const allYi = ['嫁娶', '祭祀', '出行', '动土', '开市', '安床', '入宅', '移徙', '纳财', '祈福', '求嗣', '开光', '解除', '伐木', '作梁', '出火', '拆卸', '修造', '盖屋', '起基', '安门', '上梁']
  const seed = selectedYear.value * 10000 + selectedMonth.value * 100 + selectedDay.value
  return allYi.slice(seed % 5, seed % 5 + 6)
})

const jiList = computed(() => {
  const allJi = ['安葬', '行丧', '破土', '栽种', '置产', '入殓', '探病', '词讼', '分居', '斋醮', '开仓', '针灸', '纳畜', '理发', '纳采', '订盟']
  const seed = selectedYear.value * 10000 + selectedMonth.value * 100 + selectedDay.value + 7
  return allJi.slice(seed % 4, seed % 4 + 4)
})

// 吉神凶煞
const goodGods = computed(() => {
  const gods = ['天德', '月德', '天恩', '四相', '三合', '六合', '时德', '民日', '天巫', '福德', '天仓', '不将']
  const seed = selectedDay.value % gods.length
  return gods.slice(seed, seed + 4)
})

const badGods = computed(() => {
  const gods = ['劫煞', '小耗', '重日', '元武', '月煞', '月虚', '小时', '五离', '招摇', '厌对']
  const seed = (selectedDay.value + 5) % gods.length
  return gods.slice(seed, seed + 3)
})

// 时辰吉凶
const shichenList = computed(() => {
  const names = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时']
  const times = ['23-1', '1-3', '3-5', '5-7', '7-9', '9-11', '11-13', '13-15', '15-17', '17-19', '19-21', '21-23']
  const lucks = ['凶', '凶', '吉', '吉', '凶', '吉', '凶', '凶', '吉', '吉', '凶', '吉']
  
  return names.map((name, i) => ({
    name,
    time: times[i],
    luck: lucks[(i + selectedDay.value) % 12] === '吉' ? '吉' : '凶',
    isGood: lucks[(i + selectedDay.value) % 12] === '吉'
  }))
})

// 命理数据（模拟）
const taiShen = computed(() => {
  const positions = ['房床碓外正东', '门床房内东', '碓磨门外正东', '厨灶门外正南', '仓库门外正南', '房床炉房内东']
  return positions[selectedDay.value % positions.length]
})

const pengZu = computed(() => {
  const list = ['甲不开仓财物耗散', '乙不栽植千株不长', '丙不修灶必见灾殃', '丁不剃头头必生疮', '戊不受田田主不祥', '己不破券二比并亡']
  const dayGan = bazi.value.day.split('')[0]
  const map = { '甲': 0, '乙': 1, '丙': 2, '丁': 3, '戊': 4, '己': 5, '庚': 0, '辛': 1, '壬': 2, '癸': 3 }
  return list[map[dayGan] || 0]
})

const caiShen = computed(() => ['东北', '东南', '正东', '正北', '西南', '正南'][selectedDay.value % 6])
const xiShen = computed(() => ['西南', '正南', '东南', '东北', '正北', '西北'][selectedDay.value % 6])
const fuShen = computed(() => ['正东', '西北', '西南', '正南', '东南', '东北'][selectedDay.value % 6])
const yangGui = computed(() => ['东北', '东南', '正东', '正北'][selectedDay.value % 4])
const yinGui = computed(() => ['西南', '正南', '东南', '东北'][selectedDay.value % 4])
const wuXing = computed(() => ['金', '木', '水', '火', '土'][selectedDay.value % 5])
const chongSha = computed(() => {
  const animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
  const day = selectedDay.value % 12
  return `冲${animals[day]}煞${['西', '东', '南', '北'][day % 4]}`
})
const zhiRi = computed(() => ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'][selectedDay.value % 12])

// 八字
const bazi = computed(() => {
  const year = selectedYear.value
  const month = selectedMonth.value + 1
  const day = selectedDay.value
  
  // 简化的八字计算
  const gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  const zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  
  const yearGan = gan[year % 10]
  const yearZhi = zhi[year % 12]
  const monthGan = gan[(year * 2 + month) % 10]
  const monthZhi = zhi[(month + 1) % 12]
  const dayGanIndex = (year * 5 + month * 3 + day) % 10
  const dayGan = gan[dayGanIndex]
  const dayZhi = zhi[(year + month + day) % 12]
  const hourGan = gan[(dayGanIndex * 2 + Math.floor(new Date().getHours() / 2)) % 10]
  const hourZhi = zhi[Math.floor((new Date().getHours() + 1) / 2) % 12]
  
  return {
    year: yearGan + yearZhi,
    yearNa: '海中金',
    month: monthGan + monthZhi,
    monthNa: '炉中火',
    day: dayGan + dayZhi,
    dayNa: '大溪水',
    hour: hourGan + hourZhi,
    hourNa: '剑锋金'
  }
})

const dayZhuInterpretation = computed(() => {
  const interpretations = {
    '甲': '甲木为阳，参天大树，主仁德',
    '乙': '乙木为阴，花草藤蔓，主柔顺',
    '丙': '丙火为阳，太阳之光，主礼仪',
    '丁': '丁火为阴，灯烛之火，主智慧',
    '戊': '戊土为阳，城墙之土，主诚信',
    '己': '己土为阴，田园之土，主包容',
    '庚': '庚金为阳，刀剑之金，主义气',
    '辛': '辛金为阴，珠玉之金，主精致',
    '壬': '壬水为阳，江河之水，主智谋',
    '癸': '癸水为阴，雨露之水，主灵性'
  }
  return interpretations[bazi.value.day.split('')[0]] || '日主'
})

const wuXingAnalysis = computed(() => {
  return '日主得令，五行流通，今日整体运势平稳，适合稳步推进计划'
})

const todayAdvice = computed(() => {
  const advices = [
    '今日适合处理重要事务，把握机会',
    '宜静不宜动，保持稳定心态',
    '贵人运旺，适合社交应酬',
    '财运不错，可适当投资',
    '注意身体健康，劳逸结合'
  ]
  return advices[selectedDay.value % advices.length]
})

// 运势
const fortune = computed(() => {
  const seed = selectedYear.value * 10000 + selectedMonth.value * 100 + selectedDay.value
  return {
    overall: 3 + (seed % 3),
    love: 2 + ((seed + 1) % 4),
    career: 3 + ((seed + 2) % 3),
    wealth: 2 + ((seed + 3) % 4),
    health: 3 + ((seed + 4) % 3)
  }
})

// 方法
function goToToday() {
  const today = new Date()
  selectedYear.value = today.getFullYear()
  selectedMonth.value = today.getMonth()
  selectedDay.value = today.getDate()
}

function queryAIForAlmanac() {
  // 构建万年历查询文本
  const almanacInfo = `
日期：${solarDate.value} ${weekDay.value}
农历：${lunarDate.value.fullDate}
八字：${bazi.value.year} ${bazi.value.month} ${bazi.value.day} ${bazi.value.hour}
宜：${yiList.value.join('、')}
忌：${jiList.value.join('、')}
吉神：${goodGods.value.join('、')}
凶煞：${badGods.value.join('、')}
冲煞：${chongSha.value}
值日天神：${zhiRi.value}
`.trim()
  
  // 触发AI查询（通过chatStore）
  chatStore.activeAlmanacQuery = {
    date: formattedDate.value,
    info: almanacInfo,
    queryText: `请为${solarDate.value}（${lunarDate.value.fullDate}）进行八字命理分析，八字为${bazi.value.year} ${bazi.value.month} ${bazi.value.day} ${bazi.value.hour}，分析今日运势和注意事项。`
  }
  
  // 可以打开一个对话框或触发AI响应
  alert('AI命理大师已收到查询请求，请在对话中查看详细解读')
}

// 监听日期变化，同步到store
watch(currentDate, (newDate) => {
  calendarStore.selectDate(newDate)
}, { immediate: true })
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

/* 万年历卡片 */
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

/* 信息区块 */
.info-section {
  padding: 16px;
  border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.info-section:last-child {
  border-bottom: none;
}

.info-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 12px 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 11px;
  color: #9a8fb8;
}

.info-item .value {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}

.info-item .value.highlight {
  color: #ff6b9d;
  font-weight: 600;
}

.info-item .value.zodiac {
  font-size: 16px;
}

.info-item .value.has-term {
  color: #7fb069;
}

.info-item .value.has-festival {
  color: #ff6b9d;
}

/* 宜忌区块 */
.yi-ji-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.yi-box, .ji-box {
  padding: 12px;
  border-radius: 12px;
}

.yi-box {
  background: linear-gradient(135deg, rgba(127, 176, 105, 0.1), rgba(127, 176, 105, 0.05));
}

.ji-box {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.1), rgba(255, 107, 157, 0.05));
}

.yi-ji-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.yi-box .yi-ji-title {
  color: #7fb069;
}

.ji-box .yi-ji-title {
  color: #ff6b9d;
}

.yi-ji-content {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.tag.yi {
  background: rgba(127, 176, 105, 0.15);
  color: #5a8c4a;
}

.tag.ji {
  background: rgba(255, 107, 157, 0.15);
  color: #d4557a;
}

.yi-ji-content .empty {
  color: #9a8fb8;
  font-size: 12px;
}

/* 吉神凶煞 */
.god-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.god-box {
  padding: 12px;
  border-radius: 10px;
}

.god-box.good {
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.15), rgba(255, 218, 224, 0.1));
  border-left: 3px solid #c5c9ff;
}

.god-box.bad {
  background: linear-gradient(135deg, rgba(255, 183, 197, 0.15), rgba(255, 228, 196, 0.1));
  border-left: 3px solid #ffb7c5;
}

.god-title {
  font-size: 12px;
  color: #8b7aa8;
  margin-bottom: 6px;
}

.god-list {
  font-size: 13px;
  color: #5a5a7a;
  font-weight: 500;
}

/* 时辰吉凶 */
.shichen-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.shichen-item {
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  background: rgba(139, 122, 168, 0.05);
}

.shichen-item.good {
  background: linear-gradient(135deg, rgba(127, 176, 105, 0.15), rgba(127, 176, 105, 0.05));
}

.shichen-item.bad {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.15), rgba(255, 107, 157, 0.05));
}

.sc-name {
  font-size: 13px;
  font-weight: 600;
  color: #5a5a7a;
}

.sc-time {
  font-size: 10px;
  color: #9a8fb8;
  margin-top: 2px;
}

.sc-luck {
  font-size: 11px;
  margin-top: 4px;
}

.shichen-item.good .sc-luck {
  color: #7fb069;
}

.shichen-item.bad .sc-luck {
  color: #ff6b9d;
}

/* 命理信息 */
.destiny-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.destiny-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 8px;
}

.destiny-label {
  font-size: 10px;
  color: #9a8fb8;
}

.destiny-value {
  font-size: 12px;
  color: #5a5a7a;
  font-weight: 500;
}

/* 八字 */
.bazi-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bazi-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 10px;
}

.bazi-label {
  width: 50px;
  font-size: 12px;
  color: #9a8fb8;
}

.bazi-value {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: #5a5a7a;
  font-family: serif;
}

.bazi-value.highlight {
  color: #ff6b9d;
}

.bazi-na {
  font-size: 11px;
  color: #8b7aa8;
  background: rgba(255, 255, 255, 0.6);
  padding: 4px 8px;
  border-radius: 10px;
}

/* 运势 */
.fortune-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fortune-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.fortune-row:last-child {
  grid-template-columns: repeat(2, 1fr);
  justify-content: center;
}

.fortune-item {
  text-align: center;
  padding: 12px 8px;
  background: rgba(139, 122, 168, 0.05);
  border-radius: 10px;
}

.fortune-name {
  font-size: 12px;
  color: #9a8fb8;
  margin-bottom: 6px;
}

.fortune-stars {
  font-size: 11px;
}

/* 八字解读 */
.interpretation .interp-content {
  font-size: 13px;
  line-height: 1.8;
  color: #5a5a7a;
}

.interp-content p {
  margin: 0 0 8px 0;
}

.interp-content strong {
  color: #ff6b9d;
}

/* AI查询区块 */
.ai-query-section {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(197, 201, 255, 0.2), rgba(255, 183, 197, 0.2));
  border-radius: 16px;
  text-align: center;
}

.ai-tip {
  font-size: 12px;
  color: #8b7aa8;
  margin: 0 0 12px 0;
}

.ai-query-btn {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 183, 197, 0.4);
}
</style>
