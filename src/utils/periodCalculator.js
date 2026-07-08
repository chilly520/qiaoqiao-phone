// =================================================================
// 生理期智能预测 / 排卵期 / 易孕期 统计算法
// =================================================================
// 核心思路:
// 1. 用最近 3-6 个完整周期计算"加权平均周期"(近期权重更高)
// 2. 用最近 3-6 个完整周期计算"加权平均经期时长"
// 3. 用最近 3-6 次"周期波动方差"评估预测置信度
// 4. 排卵日 = 下一经期开始前 14 天(标准医学模型)
// 5. 易孕期 = 排卵日前 5 天到后 1 天(精子存活 + 卵子存活窗口)
// 6. 周期相位:
//    - period: 实际经期
//    - prediction: 预测经期
//    - ovulation: 排卵日 ±0 天
//    - fertile: 易孕期(排卵前 5 天 ~ 排卵后 1 天)
//    - luteal: 黄体期(排卵后到下次经期前)
//    - safe: 安全期(月经结束到易孕期前)
// =================================================================

const MS_PER_DAY = 86400000

// 工具:把 Date 或 yyyy-mm-dd 字符串归一为当天 0 点的 Date
export function normalizeDate(input) {
  if (!input) return null
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate())
  }
  if (typeof input === 'string') {
    // 接受 "2024-01-15" 或 "2024-01-15T..." 形式
    const s = input.split('T')[0]
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return null
}

// 工具:转 yyyy-mm-dd
export function toDateStr(date) {
  const d = normalizeDate(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 工具:天数差(忽略时间)
export function daysBetween(a, b) {
  const da = normalizeDate(a)
  const db = normalizeDate(b)
  return Math.round((db - da) / MS_PER_DAY)
}

// 工具:加天数
export function addDays(date, n) {
  const d = normalizeDate(date)
  d.setDate(d.getDate() + n)
  return d
}

// =================================================================
// 数据规整
// 输入的 cycles 数组应当形如:
//   [{ id, startDate: 'yyyy-mm-dd', endDate?: 'yyyy-mm-dd', duration?, symptoms?, ... }, ...]
// 输出:按 startDate 升序,自动补全 endDate/duration
// =================================================================
export function normalizeCycles(cycles) {
  if (!Array.isArray(cycles)) return []
  const sorted = cycles
    .map(c => ({
      ...c,
      _start: normalizeDate(c.startDate),
      _end: c.endDate ? normalizeDate(c.endDate) : null
    }))
    .filter(c => c._start)
    .sort((a, b) => a._start - b._start)

  return sorted.map(c => {
    let duration = c.duration
    if (!duration && c._end) {
      duration = daysBetween(c._start, c._end) + 1
    }
    return {
      ...c,
      startDate: toDateStr(c._start),
      endDate: c._end ? toDateStr(c._end) : null,
      duration: duration || 5
    }
  })
}

// =================================================================
// 加权平均 - 越近的周期权重越高
// 用线性衰减权重(最近权重 1.0,前 N-1 个 0.7,再之前 0.4)
// =================================================================
function weightedAverage(values) {
  if (!values || values.length === 0) return 0
  if (values.length === 1) return values[0]
  const n = values.length
  const weights = values.map((_, i) => {
    // i=0 是最早的,越靠后权重越高
    const recency = i / (n - 1)  // 0 ~ 1
    return 0.4 + 0.6 * recency
  })
  const sumW = weights.reduce((a, b) => a + b, 0)
  const sumWV = values.reduce((acc, v, i) => acc + v * weights[i], 0)
  return sumWV / sumW
}

// =================================================================
// 周期统计
// 输入:已规整的 cycles 数组
// 输出:{ avgCycle, avgDuration, variance, sampleSize, regularity, lastCycle }
// =================================================================
export function calculateStats(cycles) {
  const data = normalizeCycles(cycles)
  if (data.length === 0) {
    return {
      avgCycle: 28,
      avgDuration: 5,
      variance: 0,
      stdDev: 0,
      sampleSize: 0,
      regularity: 'unknown', // 'regular' | 'irregular' | 'unknown'
      lastCycle: null,
      recentCycles: []
    }
  }

  // 计算相邻周期间隔(cycle length)
  const intervals = []
  for (let i = 1; i < data.length; i++) {
    intervals.push(daysBetween(data[i - 1]._start, data[i]._start))
  }

  // 只取最近 6 个 interval
  const recentIntervals = intervals.slice(-6)
  const avgCycle = recentIntervals.length > 0
    ? Math.round(weightedAverage(recentIntervals))
    : 28

  // 经期时长
  const recentDurations = data.slice(-6).map(c => c.duration).filter(Boolean)
  const avgDuration = recentDurations.length > 0
    ? Math.round(weightedAverage(recentDurations) * 10) / 10
    : 5

  // 方差 / 标准差
  let variance = 0
  let stdDev = 0
  if (recentIntervals.length >= 2) {
    const mean = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length
    variance = recentIntervals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / recentIntervals.length
    stdDev = Math.sqrt(variance)
  }

  // 规律性:标准差 < 3 天算 regular,3-7 天 mild irregular,>7 天 irregular
  let regularity = 'unknown'
  if (recentIntervals.length >= 2) {
    if (stdDev < 3) regularity = 'regular'
    else if (stdDev < 7) regularity = 'mild_irregular'
    else regularity = 'irregular'
  }

  return {
    avgCycle,
    avgDuration,
    variance: Math.round(variance * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    sampleSize: data.length,
    intervalCount: recentIntervals.length,
    regularity,
    lastCycle: data[data.length - 1] || null,
    recentCycles: data
  }
}

// =================================================================
// 生成预测周期
// 输入:已规整的 cycles 数组,预测未来 N 个周期
// 输出:[{ startDate, endDate, isPrediction, confidence, cycleIndex }]
// =================================================================
export function generatePredictions(cycles, count = 6) {
  const data = normalizeCycles(cycles)
  if (data.length === 0) return []

  const stats = calculateStats(data)
  const lastCycle = data[data.length - 1]
  const lastStart = lastCycle._start

  const predictions = []
  let prevStart = lastStart

  for (let i = 1; i <= count; i++) {
    // 用加权平均(后续预测用前 N 个 interval 推算)
    // 简化:每个预测间隔 = avgCycle + (i-1) * 0(假设稳定)
    // 也可以用更复杂的趋势,这里保守
    const interval = stats.avgCycle
    const predStart = addDays(prevStart, interval)
    const predEnd = addDays(predStart, Math.max(1, Math.round(stats.avgDuration)) - 1)
    
    // 置信度:用 stdDev 反推,波动越大置信度越低
    let confidence = 1.0
    if (stats.stdDev > 0) {
      confidence = Math.max(0.3, 1.0 - stats.stdDev / 20)
    }
    
    predictions.push({
      id: `pred_${i}_${predStart.getTime()}`,
      startDate: toDateStr(predStart),
      endDate: toDateStr(predEnd),
      duration: stats.avgDuration,
      isPrediction: true,
      cycleIndex: data.length + i,
      confidence: Math.round(confidence * 100)
    })
    prevStart = predStart
  }
  return predictions
}

// =================================================================
// 排卵期 / 易孕期
// 标准模型:下次经期前 14 天 = 排卵日
// 易孕窗口:排卵前 5 天 ~ 排卵后 1 天
// =================================================================
export function calculateOvulation(cycleStart, cycleLength = 28) {
  // 排卵日 = 下次经期前 14 天 = 当前周期开始 + (cycleLength - 14) 天
  const start = normalizeDate(cycleStart)
  const ovulationDate = addDays(start, cycleLength - 14)
  return ovulationDate
}

export function calculateFertileWindow(cycleStart, cycleLength = 28) {
  const ovulationDate = calculateOvulation(cycleStart, cycleLength)
  return {
    start: addDays(ovulationDate, -5), // 易孕开始
    peak: ovulationDate,               // 排卵高峰
    end: addDays(ovulationDate, 1)     // 易孕结束
  }
}

// =================================================================
// 周期相位查询 - 给定日期,返回所处阶段
// 这是日历展示的核心 API
// =================================================================
// 返回:
//   null - 无特殊状态
//   { phase: 'period', day, source: 'actual' | 'prediction' }
//   { phase: 'prediction', day, confidence }
//   { phase: 'ovulation', cycleRef }
//   { phase: 'fertile', isPeak: bool, cycleRef }
//   { phase: 'luteal', day }
//   { phase: 'safe', type: 'pre-ovulation' | 'post-ovulation' }
export function getCyclePhase(date, cycles, predictions = null) {
  const d = normalizeDate(date)
  if (!d) return null

  const data = normalizeCycles(cycles)
  if (data.length === 0) return null

  // 1) 真实经期(优先级最高)
  for (const c of data) {
    const s = c._start
    const e = c._end || addDays(s, c.duration - 1)
    if (d >= s && d <= e) {
      return {
        phase: 'period',
        day: daysBetween(s, d) + 1,
        source: 'actual',
        cycleIndex: c.cycleIndex || data.indexOf(c) + 1
      }
    }
  }

  // 2) 预测经期
  const preds = predictions || generatePredictions(data, 6)
  for (const p of preds) {
    const s = normalizeDate(p.startDate)
    const e = normalizeDate(p.endDate)
    if (d >= s && d <= e) {
      return {
        phase: 'prediction',
        day: daysBetween(s, d) + 1,
        source: 'prediction',
        confidence: p.confidence,
        cycleIndex: p.cycleIndex
      }
    }
  }

  // 3) 排卵 / 易孕 / 安全期(用最后一次实际或最近预测周期算)
  // 优先级:实际最后一次 > 第一个未来预测
  const allCycles = [
    ...data.map(c => ({ start: c._start, isPrediction: false })),
    ...preds.map(p => ({ start: normalizeDate(p.startDate), isPrediction: true }))
  ]
  
  // 找到离 d 最近的前一个周期开始
  let refCycle = null
  for (const c of allCycles) {
    if (c.start <= d) refCycle = c
    else break
  }
  
  if (!refCycle) return null
  
  // 用"下次经期前 14 天 = 排卵日"反推
  // 我们现在位于 refCycle.start 之后,需要知道下次经期
  // refCycle.start 加上"平均周期长度"就是下次经期
  const stats = calculateStats(data)
  const nextPeriodStart = addDays(refCycle.start, stats.avgCycle)
  const ovulationDate = addDays(nextPeriodStart, -14)
  const fertileStart = addDays(ovulationDate, -5)
  const fertileEnd = addDays(ovulationDate, 1)
  
  if (d.getTime() === ovulationDate.getTime()) {
    return { phase: 'ovulation', cycleRef: toDateStr(nextPeriodStart) }
  }
  if (d >= fertileStart && d <= fertileEnd) {
    return {
      phase: 'fertile',
      isPeak: d.getTime() === ovulationDate.getTime(),
      cycleRef: toDateStr(nextPeriodStart)
    }
  }
  
  // 判断 luteal(排卵后到下次经期前)还是 safe
  if (d > fertileEnd && d < nextPeriodStart) {
    return {
      phase: 'luteal',
      day: daysBetween(ovulationDate, d)
    }
  }
  
  // d < fertileStart 时是 safe(月经后到易孕前)
  return {
    phase: 'safe',
    type: 'pre-ovulation',
    day: daysBetween(refCycle.start, d)
  }
}

// =================================================================
// 当前进行中的经期
// =================================================================
export function getCurrentPeriod(cycles) {
  const data = normalizeCycles(cycles)
  if (data.length === 0) return null
  const today = normalizeDate(new Date())
  // 从最新往回找
  for (let i = data.length - 1; i >= 0; i--) {
    const c = data[i]
    const s = c._start
    const e = c._end || addDays(s, c.duration - 1)
    if (today >= s && today <= e) {
      return {
        ...c,
        startDate: toDateStr(s),
        endDate: toDateStr(e),
        currentDay: daysBetween(s, today) + 1
      }
    }
  }
  return null
}

// =================================================================
// 一键开始 / 结束经期(常用 API)
// =================================================================
export function startPeriodToday(cycles) {
  const today = normalizeDate(new Date())
  const todayStr = toDateStr(today)
  const data = normalizeCycles(cycles)
  // 如果已有进行中的,直接返回
  const current = getCurrentPeriod(cycles)
  if (current) {
    return { cycles: data, message: '今天已在经期中', alreadyActive: true }
  }
  // 检查今天是否已存在记录
  const existing = data.find(c => c.startDate === todayStr)
  if (existing) {
    return { cycles: data, message: '今天已记录开始', alreadyExists: true }
  }
  // 默认经期 5 天
  const newCycle = {
    id: `cycle_${Date.now()}`,
    startDate: todayStr,
    endDate: null,
    duration: 5,
    createdAt: new Date().toISOString()
  }
  return {
    cycles: [...data, newCycle],
    message: '已开始记录,默认 5 天,可在统计页修改结束日',
    newCycle
  }
}

export function endPeriodToday(cycles) {
  const today = normalizeDate(new Date())
  const todayStr = toDateStr(today)
  const data = normalizeCycles(cycles)
  // 找到最后一个未结束的周期
  for (let i = data.length - 1; i >= 0; i--) {
    const c = data[i]
    if (!c.endDate || c._end > today) {
      const updated = {
        ...c,
        endDate: todayStr,
        duration: daysBetween(c._start, today) + 1
      }
      const newCycles = [...data]
      newCycles[i] = updated
      return {
        cycles: newCycles,
        message: '已结束当前经期',
        updated
      }
    }
  }
  return { cycles: data, message: '没有进行中的经期', noop: true }
}

// =================================================================
// 删除一个周期记录
// =================================================================
export function deleteCycle(cycles, cycleId) {
  return normalizeCycles(cycles).filter(c => c.id !== cycleId)
}

// =================================================================
// 完整 stats API - 给 PeriodStatistics 页用
// =================================================================
export function getFullStats(cycles) {
  const data = normalizeCycles(cycles)
  if (data.length === 0) {
    return {
      hasData: false,
      totalCycles: 0,
      avgCycle: 28,
      avgDuration: 5,
      stdDev: 0,
      regularity: 'unknown',
      regularityLabel: '暂无数据',
      lastCycle: null,
      currentPeriod: null,
      nextPrediction: null,
      nextOvulation: null,
      nextFertileWindow: null,
      recentCycles: []
    }
  }

  const stats = calculateStats(data)
  const predictions = generatePredictions(data, 3)
  const current = getCurrentPeriod(data)
  const nextPred = predictions[0] || null
  const nextOvul = nextPred ? calculateOvulation(nextPred.startDate, stats.avgCycle) : null
  const nextFertile = nextPred ? calculateFertileWindow(nextPred.startDate, stats.avgCycle) : null

  const regularityLabels = {
    regular: '规律',
    mild_irregular: '轻微不规律',
    irregular: '不规律',
    unknown: '数据不足'
  }

  return {
    hasData: true,
    totalCycles: data.length,
    avgCycle: stats.avgCycle,
    avgDuration: stats.avgDuration,
    stdDev: stats.stdDev,
    variance: stats.variance,
    sampleSize: stats.sampleSize,
    intervalCount: stats.intervalCount,
    regularity: stats.regularity,
    regularityLabel: regularityLabels[stats.regularity] || '未知',
    lastCycle: data[data.length - 1],
    currentPeriod: current,
    nextPrediction: nextPred,
    nextOvulation: nextOvul ? toDateStr(nextOvul) : null,
    nextFertileWindow: nextFertile ? {
      start: toDateStr(nextFertile.start),
      peak: toDateStr(nextFertile.peak),
      end: toDateStr(nextFertile.end)
    } : null,
    recentCycles: data,
    predictions
  }
}
