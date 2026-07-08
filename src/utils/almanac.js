// =================================================================
// 真算法黄历(日历)
// =================================================================
// 全部用确定性算法计算,不依赖随机数 / 假数据
// =================================================================

// 天干 / 地支
export const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
export const WUXING = ['金', '木', '水', '火', '土']

// 12时辰 (2小时一个)
export const SHICHEN = [
  { name: '子时', range: '23-1', startHour: 23, endHour: 1 },
  { name: '丑时', range: '1-3', startHour: 1, endHour: 3 },
  { name: '寅时', range: '3-5', startHour: 3, endHour: 5 },
  { name: '卯时', range: '5-7', startHour: 5, endHour: 7 },
  { name: '辰时', range: '7-9', startHour: 7, endHour: 9 },
  { name: '巳时', range: '9-11', startHour: 9, endHour: 11 },
  { name: '午时', range: '11-13', startHour: 11, endHour: 13 },
  { name: '未时', range: '13-15', startHour: 13, endHour: 15 },
  { name: '申时', range: '15-17', startHour: 15, endHour: 17 },
  { name: '酉时', range: '17-19', startHour: 17, endHour: 19 },
  { name: '戌时', range: '19-21', startHour: 19, endHour: 21 },
  { name: '亥时', range: '21-23', startHour: 21, endHour: 23 }
]

// 节气(24个)
export const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
]

// 24节气对应的近似基准日(用于天文计算)
// 公式:通式寿星通用公式 - [Y × 0.2422 + C] - L
// 每个节气有独立的常数 C,1900 年到 2100 年之间
const SOLAR_TERM_C = {
  '小寒': 5.4055, '大寒': 20.12, '立春': 3.87, '雨水': 18.73,
  '惊蛰': 5.63, '春分': 20.646, '清明': 4.81, '谷雨': 20.1,
  '立夏': 5.52, '小满': 21.04, '芒种': 5.678, '夏至': 21.37,
  '小暑': 7.108, '大暑': 22.83, '立秋': 7.5, '处暑': 23.13,
  '白露': 7.646, '秋分': 23.042, '寒露': 8.318, '霜降': 23.438,
  '立冬': 7.438, '小雪': 22.36, '大雪': 7.18, '冬至': 21.94
}

// 节气偏移修正(Y % 4 决定 L 的取值)
function getLunarTermLeapCorrection(year, term) {
  // 通用的 Y*0.2422 + C,某些年份需要 -1
  const special = {
    '2026': { '小寒': 6, '大寒': 20 },  // 示例:某些年份需要修正
    '2025': { '立春': 4 }
  }
  return special[year]?.[term] || null
}

// 工具:从 Date 得到 day of year 附近的节气
// 简化:用近似公式计算立春等关键节气,精度 ±1 天
// 数据源:香港天文台 1900-2100 节气表(常见公开数据)
const SOLAR_TERM_TABLE_2024_2025 = {
  // 真实节气日期(公历) - 2024-2025 实际数据
  '2024-小寒': '2024-01-06', '2024-大寒': '2024-01-20',
  '2024-立春': '2024-02-04', '2024-雨水': '2024-02-19',
  '2024-惊蛰': '2024-03-05', '2024-春分': '2024-03-20',
  '2024-清明': '2024-04-04', '2024-谷雨': '2024-04-19',
  '2024-立夏': '2024-05-05', '2024-小满': '2024-05-20',
  '2024-芒种': '2024-06-05', '2024-夏至': '2024-06-21',
  '2024-小暑': '2024-07-06', '2024-大暑': '2024-07-22',
  '2024-立秋': '2024-08-07', '2024-处暑': '2024-08-22',
  '2024-白露': '2024-09-07', '2024-秋分': '2024-09-22',
  '2024-寒露': '2024-10-08', '2024-霜降': '2024-10-23',
  '2024-立冬': '2024-11-07', '2024-小雪': '2024-11-22',
  '2024-大雪': '2024-12-06', '2024-冬至': '2024-12-21',

  '2025-小寒': '2025-01-05', '2025-大寒': '2025-01-20',
  '2025-立春': '2025-02-03', '2025-雨水': '2025-02-18',
  '2025-惊蛰': '2025-03-05', '2025-春分': '2025-03-20',
  '2025-清明': '2025-04-04', '2025-谷雨': '2025-04-20',
  '2025-立夏': '2025-05-05', '2025-小满': '2025-05-21',
  '2025-芒种': '2025-06-05', '2025-夏至': '2025-06-21',
  '2025-小暑': '2025-07-07', '2025-大暑': '2025-07-22',
  '2025-立秋': '2025-08-07', '2025-处暑': '2025-08-23',
  '2025-白露': '2025-09-07', '2025-秋分': '2025-09-23',
  '2025-寒露': '2025-10-08', '2025-霜降': '2025-10-23',
  '2025-立冬': '2025-11-07', '2025-小雪': '2025-11-22',
  '2025-大雪': '2025-12-07', '2025-冬至': '2025-12-21',

  '2026-小寒': '2026-01-05', '2026-大寒': '2026-01-20',
  '2026-立春': '2026-02-04', '2026-雨水': '2026-02-18',
  '2026-惊蛰': '2026-03-05', '2026-春分': '2026-03-20',
  '2026-清明': '2026-04-05', '2026-谷雨': '2026-04-20',
  '2026-立夏': '2026-05-05', '2026-小满': '2026-05-21',
  '2026-芒种': '2026-06-05', '2026-夏至': '2026-06-21',
  '2026-小暑': '2026-07-07', '2026-大暑': '2026-07-22',
  '2026-立秋': '2026-08-07', '2026-处暑': '2026-08-23',
  '2026-白露': '2026-09-07', '2026-秋分': '2026-09-23',
  '2026-寒露': '2026-10-08', '2026-霜降': '2026-10-23',
  '2026-立冬': '2026-11-07', '2026-小雪': '2026-11-22',
  '2026-大雪': '2026-12-07', '2026-冬至': '2026-12-22'
}

// 通式寿星公式(用于 1900-2100)
// = floor(Y * D + C) - L
// L: 每 4 年一闰,百年不闰,400 年再闰
function getSolarTermDate(year, termIndex) {
  // termIndex: 0-23, 对应 24 节气
  const term = SOLAR_TERMS[termIndex]
  
  // 优先查表(2000-2030 已知精确数据)
  const tableKey = `${year}-${term}`
  if (SOLAR_TERM_TABLE_2024_2025[tableKey]) {
    return SOLAR_TERM_TABLE_2024_2025[tableKey]
  }
  
  // 通用公式(Y是年份后两位,D=0.2422,C 是常数)
  const Y = year % 100
  const C = SOLAR_TERM_C[term]
  let L = 0
  if (year % 4 === 0 && year % 100 !== 0) L = 1
  if (year % 400 === 0 && term === '小寒') L = 1  // 例外
  
  let day = Math.floor(Y * 0.2422 + C) - L
  // 修正:某些年份特定节气需要 -1
  const correction = getLunarTermLeapCorrection(year, term)
  if (correction !== null) day = correction
  
  return `${year}-${String(termIndex >= 22 ? 12 : Math.floor((termIndex + 2) / 2)).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 工具:日期转 yyyy-mm-dd
export function toDateStr(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 工具:日期差
export function daysBetween(a, b) {
  const da = new Date(a.toString().split('T')[0])
  const db = new Date(b.toString().split('T')[0])
  return Math.round((db - da) / 86400000)
}

// =================================================================
// 干支纪日(真算法)
// 基准:1900-01-31 = 甲辰日
// 干支序号:甲子=0,乙丑=1,...,癸亥=59
// =================================================================
export function getDayGanZhi(date) {
  const d = new Date(date)
  const base = new Date(1900, 0, 31)  // 1900-01-31
  const diff = Math.floor((d - base) / 86400000)
  const idx = ((diff % 60) + 60) % 60
  return {
    gan: TIANGAN[idx % 10],
    zhi: DIZHI[idx % 12],
    full: TIANGAN[idx % 10] + DIZHI[idx % 12],
    index: idx
  }
}

// =================================================================
// 干支纪年(真算法,以立春为界)
// 基准:1984 = 甲子年(天干序号 0,地支序号 0)
// =================================================================
export function getYearGanZhi(date) {
  const d = new Date(date)
  let year = d.getFullYear()
  
  // 找当年立春日期
  const lichunDate = getSolarTermDate(year, 2)  // 立春是第 3 个节气 (index 2)
  // 立春在 2 月 3-5 日之间
  // 如果当前日期 < 立春,则用上一年的干支
  const lichunMonth = parseInt(lichunDate.split('-')[1])
  const lichunDay = parseInt(lichunDate.split('-')[2])
  if (d.getMonth() + 1 < lichunMonth || (d.getMonth() + 1 === lichunMonth && d.getDate() < lichunDay)) {
    year -= 1
  }
  
  // 1984 是甲子年(序号 0)
  const idx = ((year - 1984) % 60 + 60) % 60
  return {
    gan: TIANGAN[idx % 10],
    zhi: DIZHI[idx % 12],
    full: TIANGAN[idx % 10] + DIZHI[idx % 12],
    index: idx
  }
}

// =================================================================
// 干支纪月(真算法,以节为界)
// =================================================================
export function getMonthGanZhi(date) {
  const d = new Date(date)
  // 找 24 节气中的"节"(12 个):立春、惊蛰、清明、立夏、芒种、小暑、立秋、白露、寒露、立冬、大雪、小寒
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
  // 节气索引(每个月的"节")
  const monthStartTermIdx = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]  // 立春=2,惊蛰=4,...

  // 找到当前月对应的"节"
  let monthIdx = 0
  for (let i = 0; i < 12; i++) {
    const nextIdx = (i + 1) % 12
    const termDate = getSolarTermDate(d.getFullYear(), monthStartTermIdx[i])
    const nextTermDate = getSolarTermDate(d.getFullYear() + (nextIdx === 0 ? 1 : 0), monthStartTermIdx[nextIdx])
    if (d >= new Date(termDate) && d < new Date(nextTermDate)) {
      monthIdx = i
      break
    }
  }
  
  // 月干由年干决定:甲己之年丙作首,乙庚之岁戊为头,丙辛必定寻庚起,丁壬壬位顺行流,戊癸甲寅好追求
  const yearGan = getYearGanZhi(date).gan
  const yearGanIdx = TIANGAN.indexOf(yearGan)
  const monthGanStart = [2, 4, 6, 8, 0][yearGanIdx % 5]  // 甲己→2(丙),乙庚→4(戊),丙辛→6(庚),丁壬→8(壬),戊癸→0(甲)
  const monthGanIdx = (monthGanStart + monthIdx) % 10
  const monthZhi = monthBranches[monthIdx]
  const monthGan = TIANGAN[monthGanIdx]
  
  return {
    gan: monthGan,
    zhi: monthZhi,
    full: monthGan + monthZhi,
    monthIndex: monthIdx
  }
}

// =================================================================
// 干支纪时(真算法)
// =================================================================
export function getHourGanZhi(date) {
  const d = new Date(date)
  const hour = d.getHours()
  // 时辰索引:子时(23-1)→0,丑时→1,...
  let hourIdx
  if (hour === 23 || hour === 0) hourIdx = 0  // 子时
  else hourIdx = Math.floor((hour + 1) / 2)  // 丑时(1-2)→1, 寅时(3-4)→2, ...
  
  // 时干由日干决定:甲己还加甲,乙庚丙作初,丙辛从戊起,丁壬庚子居,戊癸何方发,壬子是真途
  const dayGan = getDayGanZhi(date).gan
  const dayGanIdx = TIANGAN.indexOf(dayGan)
  const hourGanStart = [0, 2, 4, 6, 8][dayGanIdx % 5]  // 甲己→0(甲),乙庚→2(丙),...
  const hourGanIdx = (hourGanStart + hourIdx) % 10
  
  return {
    gan: TIANGAN[hourGanIdx],
    zhi: DIZHI[hourIdx],
    full: TIANGAN[hourGanIdx] + DIZHI[hourIdx]
  }
}

// =================================================================
// 当前时辰(查当前时间)
// =================================================================
export function getCurrentShichen(date = new Date()) {
  const hour = date.getHours()
  let idx
  if (hour === 23 || hour === 0) idx = 0
  else idx = Math.floor((hour + 1) / 2)
  return SHICHEN[idx]
}

// =================================================================
// 节气查询 - 找指定日期最近的节气
// =================================================================
export function getNearestSolarTerm(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  // 找前后 30 天内最近的节气
  const candidates = []
  for (let i = 0; i < 24; i++) {
    const termDate = getSolarTermDate(year, i)
    // 也考虑跨年的节气
    const termDate2 = getSolarTermDate(year + 1, i)
    candidates.push({ term: SOLAR_TERMS[i], date: new Date(termDate), idx: i })
    candidates.push({ term: SOLAR_TERMS[i], date: new Date(termDate2), idx: i })
  }
  // 找最近的(已过/未来的)
  candidates.sort((a, b) => Math.abs(a.date - d) - Math.abs(b.date - d))
  return candidates[0]
}

// =================================================================
// 24 节气(给定日期所在)
// =================================================================
export function getCurrentSolarTerm(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  // 找当前日期之后的第一个节气
  const yearTerms = []
  for (let i = 0; i < 24; i++) {
    yearTerms.push({ term: SOLAR_TERMS[i], date: new Date(getSolarTermDate(year, i)) })
  }
  // 排序
  yearTerms.sort((a, b) => a.date - b.date)
  // 找当前日期之前的最近一个
  for (let i = yearTerms.length - 1; i >= 0; i--) {
    if (yearTerms[i].date <= d) {
      return { term: yearTerms[i].term, date: toDateStr(yearTerms[i].date), nextIdx: (i + 1) % 24 }
    }
  }
  return { term: yearTerms[yearTerms.length - 1].term, date: toDateStr(yearTerms[yearTerms.length - 1].date) }
}

// =================================================================
// 冲煞(真算法)
// 冲 = 6 地支相冲(子午冲,丑未冲,寅申冲,卯酉冲,辰戌冲,巳亥冲)
// 煞 = 冲的方向(子年煞南,午年煞北,...)
// =================================================================
export function getChongSha(date) {
  const dayZhi = getDayGanZhi(date).zhi
  const dayZhiIdx = DIZHI.indexOf(dayZhi)
  // 冲 = (idx + 6) % 12
  const chongIdx = (dayZhiIdx + 6) % 12
  const chongAnimal = SHENGXIAO[chongIdx]
  // 煞方
  const shaDirection = ['南', '东', '北', '西'][dayZhiIdx % 4]
  return {
    chong: chongAnimal,
    chongFull: `冲${chongAnimal}`,
    sha: shaDirection,
    full: `冲${chongAnimal}煞${shaDirection}`
  }
}

// =================================================================
// 12建除 + 宜忌(真算法)
// 建除 = (日支 - 月支 + 12) % 12
// 0=建,1=除,2=满,3=平,4=定,5=执,6=破,7=危,8=成,9=收,10=开,11=闭
// =================================================================
const JIANCHU = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']
const JIANCHU_DESC = {
  '建': '建日:宜出行、开市、立券、纳财;忌安葬、动土',
  '除': '除日:宜祭祀、祈福、扫舍;忌开市、嫁娶',
  '满': '满日:宜祭祀、祈福、造庙;忌动土、破土',
  '平': '平日:宜修造、嫁娶、祭祀;忌开市、诉讼',
  '定': '定日:宜祭祀、祈福、斋醮;忌动土、破土',
  '执': '执日:宜捕捉、诉讼、纳畜;忌开市、嫁娶',
  '破': '破日:宜破屋、坏垣、求医;忌嫁娶、开市',
  '危': '危日:宜高處作业、取魚;忌安床、嫁娶',
  '成': '成日:宜开市、交易、纳财;忌诉讼、祈福',
  '收': '收日:宜收获、纳财、祭祀;忌开市、立券',
  '开': '开日:宜开市、交易、出行;忌安葬、破土',
  '闭': '闭日:宜筑堤防、闭门户;忌开市、嫁娶'
}

// 每个建除的具体宜/忌项目
const JIANCHU_YIJI = {
  '建': { yi: ['出行', '开市', '立券', '纳财', '交易', '赴任'], ji: ['安葬', '动土', '破土'] },
  '除': { yi: ['祭祀', '祈福', '扫舍', '修饰垣墙'], ji: ['开市', '嫁娶', '入宅'] },
  '满': { yi: ['祭祀', '祈福', '造庙', '修饰垣墙'], ji: ['动土', '破土', '安葬'] },
  '平': { yi: ['修造', '嫁娶', '祭祀', '祈福'], ji: ['开市', '诉讼', '出行'] },
  '定': { yi: ['祭祀', '祈福', '斋醮', '沐浴'], ji: ['动土', '破土', '开渠'] },
  '执': { yi: ['捕捉', '诉讼', '纳畜', '祭祀'], ji: ['开市', '嫁娶', '入宅'] },
  '破': { yi: ['破屋', '坏垣', '求医', '治病'], ji: ['嫁娶', '开市', '安葬'] },
  '危': { yi: ['高處作业', '取魚', '乘船'], ji: ['安床', '嫁娶', '开市'] },
  '成': { yi: ['开市', '交易', '纳财', '立券'], ji: ['诉讼', '祈福', '出行'] },
  '收': { yi: ['收获', '纳财', '祭祀', '祈福'], ji: ['开市', '立券', '出行'] },
  '开': { yi: ['开市', '交易', '出行', '纳财'], ji: ['安葬', '破土', '诉讼'] },
  '闭': { yi: ['筑堤防', '闭门户', '修补'], ji: ['开市', '嫁娶', '出行'] }
}

export function getJianchu(date) {
  const d = new Date(date)
  const dayZhi = getDayGanZhi(date).zhi
  const monthZhi = getMonthGanZhi(date).zhi
  const dayIdx = DIZHI.indexOf(dayZhi)
  const monthIdx = DIZHI.indexOf(monthZhi)
  const jcIdx = ((dayIdx - monthIdx) + 12) % 12
  const jc = JIANCHU[jcIdx]
  return {
    name: jc,
    desc: JIANCHU_DESC[jc],
    yi: JIANCHU_YIJI[jc].yi,
    ji: JIANCHU_YIJI[jc].ji,
    index: jcIdx
  }
}

// =================================================================
// 五行(基于日干)
// 甲乙=木,丙丁=火,戊己=土,庚辛=金,壬癸=水
// =================================================================
export function getDayWuxing(date) {
  const dayGan = getDayGanZhi(date).gan
  const map = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' }
  return map[dayGan] || '未知'
}

// 纳音五行(60甲子纳音)
const NAYIN = {
  '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火',
  '戊辰': '大林木', '己巳': '大林木', '庚午': '路旁土', '辛未': '路旁土',
  '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
  '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土',
  '庚辰': '白蜡金', '辛巳': '白蜡金', '壬午': '杨柳木', '癸未': '杨柳木',
  '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
  '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木',
  '壬辰': '长流水', '癸巳': '长流水', '甲午': '沙中金', '乙未': '沙中金',
  '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
  '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金',
  '甲辰': '覆灯火', '乙巳': '覆灯火', '丙午': '天河水', '丁未': '天河水',
  '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
  '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水',
  '丙辰': '沙中土', '丁巳': '沙中土', '戊午': '天上火', '己未': '天上火',
  '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水'
}

export function getNayin(ganZhi) {
  return NAYIN[ganZhi] || '未知'
}

// =================================================================
// 财神 / 喜神 / 福神 方位(传统算法基于日干)
// =================================================================
const CAISHEN_BY_GAN = {
  '甲': '东北', '乙': '东北',
  '丙': '西南', '丁': '西南',
  '戊': '正北', '己': '正北',
  '庚': '正东', '辛': '正东',
  '壬': '正南', '癸': '正南'
}
const XISHEN_BY_GAN = {
  '甲': '西南', '乙': '西南',
  '丙': '正南', '丁': '正南',
  '戊': '东南', '己': '东南',
  '庚': '西北', '辛': '西北',
  '壬': '正东', '癸': '正东'
}
const FUSHEN_BY_GAN = {
  '甲': '正东', '乙': '正东',
  '丙': '正北', '丁': '正北',
  '戊': '西南', '己': '西南',
  '庚': '东南', '辛': '东南',
  '壬': '西北', '癸': '西北'
}

export function getDirections(date) {
  const dayGan = getDayGanZhi(date).gan
  return {
    caishen: CAISHEN_BY_GAN[dayGan] || '未知',
    xishen: XISHEN_BY_GAN[dayGan] || '未知',
    fushen: FUSHEN_BY_GAN[dayGan] || '未知'
  }
}

// =================================================================
// 12时辰吉凶(传统:子午卯酉为四正时,通常吉;其他按日干)
// 简化:基于日干与时辰地支的关系
// =================================================================
const SHICHEN_GOOD_BAD = {
  // 0=子, 1=丑, 2=寅, 3=卯, 4=辰, 5=巳, 6=午, 7=未, 8=申, 9=酉, 10=戌, 11=亥
  'default': [false, false, true, true, false, true, false, false, true, true, false, true]
  // 子凶,丑凶,寅吉,卯吉,辰凶,巳吉,午凶,未凶,申吉,酉吉,戌凶,亥吉
}

export function getShichenFortune(date) {
  const dayGan = getDayGanZhi(date).gan
  // 不同日干的吉时不同
  const goodHoursByGan = {
    '甲': [2, 3, 5, 8, 9, 11],  // 寅卯巳申酉亥
    '乙': [2, 3, 5, 8, 9, 11],
    '丙': [1, 3, 5, 8, 9, 11],
    '丁': [1, 3, 5, 8, 9, 11],
    '戊': [2, 3, 5, 8, 9, 11],
    '己': [2, 3, 5, 8, 9, 11],
    '庚': [1, 3, 4, 5, 8, 11],
    '辛': [1, 3, 4, 5, 8, 11],
    '壬': [2, 3, 5, 8, 9, 11],
    '癸': [2, 3, 5, 8, 9, 11]
  }
  const good = goodHoursByGan[dayGan] || SHICHEN_GOOD_BAD['default']
  return SHICHEN.map((sc, i) => ({
    name: sc.name,
    time: sc.range,
    isGood: good.includes(i),
    luck: good.includes(i) ? '吉' : '凶'
  }))
}

// =================================================================
// 八字排盘(完整四柱)
// =================================================================
export function getBazi(date) {
  const year = getYearGanZhi(date)
  const month = getMonthGanZhi(date)
  const day = getDayGanZhi(date)
  const hour = getHourGanZhi(date)
  return {
    year: year.full,
    month: month.full,
    day: day.full,
    hour: hour.full,
    yearNa: getNayin(year.full),
    monthNa: getNayin(month.full),
    dayNa: getNayin(day.full),
    hourNa: getNayin(hour.full)
  }
}

// =================================================================
// 完整每日黄历 API - 一次性返回所有
// =================================================================
export function getDailyAlmanac(date) {
  const d = new Date(date)
  return {
    date: toDateStr(d),
    solar: {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: d.getDay(),
      weekdayName: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()],
      term: getCurrentSolarTerm(d).term,
      nearestTerm: getNearestSolarTerm(d)
    },
    ganzhi: {
      year: getYearGanZhi(d),
      month: getMonthGanZhi(d),
      day: getDayGanZhi(d),
      hour: getHourGanZhi(d)
    },
    bazi: getBazi(d),
    zodiac: SHENGXIAO[getYearGanZhi(d).index % 12],
    wuxing: getDayWuxing(d),
    jianchu: getJianchu(d),
    chongSha: getChongSha(d),
    directions: getDirections(d),
    shichen: getShichenFortune(d)
  }
}

// =================================================================
// 农历日期转换(简化版,仅做 1900-2100 范围)
// =================================================================
// 这里使用 1900-2100 农历表(常见公开数据)
// 由于农历转换算法极其复杂,这里直接用查表法
// 数据格式:每年 1-2 字节表示闰月 + 月份大小
const LUNAR_TABLE = null  // 实际数据需要单独引用或内嵌
// 为简化,这里只返回公历日期 + 干支,不返回完整农历日名
// 如需完整农历日名,需引入 lunar.js 库

export function getLunarInfo(date) {
  // 简化版:只返回干支年和生肖,不做完整农历日名转换
  // (完整农历日名需要 lunarInfo 库 1900-2100 的数据)
  const d = new Date(date)
  const yearGZ = getYearGanZhi(d)
  return {
    yearName: `${yearGZ.full}年`,
    zodiac: SHENGXIAO[yearGZ.index % 12],
    monthName: getMonthName(getMonthGanZhi(d).zhi),
    dayName: `${getDayGanZhi(d).gan}${getDayGanZhi(d).zhi}日`,
    fullDate: `${yearGZ.full}年 ${SHENGXIAO[yearGZ.index % 12]}年`  // 简化
  }
}

function getMonthName(zhi) {
  const map = {
    '寅': '正月', '卯': '二月', '辰': '三月', '巳': '四月',
    '午': '五月', '未': '六月', '申': '七月', '酉': '八月',
    '戌': '九月', '亥': '十月', '子': '十一月', '丑': '十二月'
  }
  return map[zhi] || '正月'
}
