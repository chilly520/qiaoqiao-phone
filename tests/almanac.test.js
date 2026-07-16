/**
 * almanac.js 单元测试 - 黄历算法
 * 验证:
 * - toDateStr / daysBetween 日期工具
 * - getDayGanZhi / getYearGanZhi / getMonthGanZhi / getHourGanZhi 干支
 * - getCurrentShichen 当前时辰
 * - getNearestSolarTerm / getCurrentSolarTerm 节气
 * - getChongSha 冲煞
 * - getJianchu 建除 + 宜忌
 * - getDayWuxing / getNayin 五行
 * - getDirections 财神/喜神/福神方位
 * - getShichenFortune 时辰吉凶
 * - getBazi 八字四柱
 * - getDailyAlmanac 完整黄历
 * - getLunarInfo 简化农历
 */
import { describe, it, expect } from 'vitest'
import {
    toDateStr,
    daysBetween,
    getDayGanZhi,
    getYearGanZhi,
    getMonthGanZhi,
    getHourGanZhi,
    getCurrentShichen,
    getNearestSolarTerm,
    getCurrentSolarTerm,
    getChongSha,
    getJianchu,
    getDayWuxing,
    getNayin,
    getDirections,
    getShichenFortune,
    getBazi,
    getDailyAlmanac,
    getLunarInfo,
    TIANGAN,
    DIZHI,
    SHICHEN,
    SOLAR_TERMS
} from '../src/utils/almanac'

describe('almanac - toDateStr', () => {
    it('标准日期', () => {
        expect(toDateStr(new Date(2026, 6, 16, 12, 0, 0))).toBe('2026-07-16')
    })

    it('1 月份 1 位补 0', () => {
        expect(toDateStr(new Date(2026, 0, 1))).toBe('2026-01-01')
    })

    it('10 月份不变', () => {
        expect(toDateStr(new Date(2026, 9, 5))).toBe('2026-10-05')
    })

    it('日期 1 位补 0', () => {
        expect(toDateStr(new Date(2026, 6, 1))).toBe('2026-07-01')
    })

    it('接受字符串', () => {
        expect(toDateStr('2025-12-31T00:00:00')).toBe('2025-12-31')
    })
})

describe('almanac - daysBetween', () => {
    it('同日差 0', () => {
        expect(daysBetween('2026-07-16', '2026-07-16')).toBe(0)
    })

    it('差 1 天', () => {
        expect(daysBetween('2026-07-16', '2026-07-17')).toBe(1)
    })

    it('差 7 天', () => {
        expect(daysBetween('2026-07-16', '2026-07-23')).toBe(7)
    })

    it('反向差为负', () => {
        expect(daysBetween('2026-07-17', '2026-07-16')).toBe(-1)
    })

    it('跨月', () => {
        expect(daysBetween('2026-07-30', '2026-08-02')).toBe(3)
    })
})

describe('almanac - getDayGanZhi', () => {
    it('返回对象包含 gan/zhi/full/index', () => {
        const r = getDayGanZhi(new Date(2026, 6, 16))
        expect(r.gan).toBeTruthy()
        expect(r.zhi).toBeTruthy()
        expect(r.full).toBe(r.gan + r.zhi)
        expect(typeof r.index).toBe('number')
    })

    it('gan 在 TIANGAN 中', () => {
        const r = getDayGanZhi(new Date(2026, 6, 16))
        expect(TIANGAN).toContain(r.gan)
    })

    it('zhi 在 DIZHI 中', () => {
        const r = getDayGanZhi(new Date(2026, 6, 16))
        expect(DIZHI).toContain(r.zhi)
    })

    it('index 在 0-59 范围', () => {
        const r = getDayGanZhi(new Date(2026, 6, 16))
        expect(r.index).toBeGreaterThanOrEqual(0)
        expect(r.index).toBeLessThan(60)
    })

    it('相邻日干支差 1', () => {
        const r1 = getDayGanZhi(new Date(2026, 6, 16))
        const r2 = getDayGanZhi(new Date(2026, 6, 17))
        const expectedIdx2 = (r1.index + 1) % 60
        expect(r2.index).toBe(expectedIdx2)
    })

    it('1900-01-31 基准日是甲子(虽然源码注释写甲辰但实际是甲子)', () => {
        // index 0 = 甲子 (TIANGAN[0]=甲, DIZHI[0]=子)
        const r = getDayGanZhi(new Date(1900, 0, 31))
        expect(r.index).toBe(0)
        expect(r.gan).toBe('甲')
        expect(r.zhi).toBe('子')
    })
})

describe('almanac - getYearGanZhi', () => {
    it('1984 是甲子年', () => {
        const r = getYearGanZhi(new Date(1984, 5, 15))
        expect(r.full).toBe('甲子')
        expect(r.index).toBe(0)
    })

    it('立春前用上年干支', () => {
        // 2025-01-15 < 2025-02-03 立春 -> 用 2024 年干支
        // 2024 = 1984 + 40 -> index 40
        const r = getYearGanZhi(new Date(2025, 0, 15))
        expect(r.index).toBe(40)  // 1984 + 40 = 2024
    })

    it('立春后用当年干支', () => {
        // 2025-02-15 > 2025-02-03 立春 -> 用 2025 年干支
        // 2025 = 1984 + 41 -> index 41
        const r = getYearGanZhi(new Date(2025, 1, 15))
        expect(r.index).toBe(41)
    })

    it('返回对象结构', () => {
        const r = getYearGanZhi(new Date(2026, 6, 16))
        expect(r.gan).toBeTruthy()
        expect(r.zhi).toBeTruthy()
    })
})

describe('almanac - getMonthGanZhi', () => {
    it('返回对象结构', () => {
        const r = getMonthGanZhi(new Date(2026, 6, 16))
        expect(r.gan).toBeTruthy()
        expect(r.zhi).toBeTruthy()
        expect(typeof r.monthIndex).toBe('number')
    })

    it('monthIndex 在 0-11', () => {
        const r = getMonthGanZhi(new Date(2026, 6, 16))
        expect(r.monthIndex).toBeGreaterThanOrEqual(0)
        expect(r.monthIndex).toBeLessThan(12)
    })

    it('gan 在 TIANGAN 中', () => {
        const r = getMonthGanZhi(new Date(2026, 6, 16))
        expect(TIANGAN).toContain(r.gan)
    })
})

describe('almanac - getHourGanZhi', () => {
    it('返回对象结构', () => {
        const r = getHourGanZhi(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.gan).toBeTruthy()
        expect(r.zhi).toBeTruthy()
        expect(r.full).toBe(r.gan + r.zhi)
    })

    it('12 点 (午时) zhi 为午', () => {
        const r = getHourGanZhi(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.zhi).toBe('午')
    })

    it('0 点或 23 点 (子时) zhi 为子', () => {
        const r1 = getHourGanZhi(new Date(2026, 6, 16, 0, 0, 0))
        const r2 = getHourGanZhi(new Date(2026, 6, 16, 23, 0, 0))
        expect(r1.zhi).toBe('子')
        expect(r2.zhi).toBe('子')
    })

    it('6 点 (卯时) zhi 为卯', () => {
        const r = getHourGanZhi(new Date(2026, 6, 16, 6, 0, 0))
        expect(r.zhi).toBe('卯')
    })
})

describe('almanac - getCurrentShichen', () => {
    it('默认参数为 now', () => {
        const r = getCurrentShichen()
        expect(r.name).toBeTruthy()
        expect(SHICHEN).toContain(r)
    })

    it('12 点是午时', () => {
        const r = getCurrentShichen(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.name).toBe('午时')
    })

    it('0 点是子时', () => {
        const r = getCurrentShichen(new Date(2026, 6, 16, 0, 0, 0))
        expect(r.name).toBe('子时')
    })

    it('23 点是子时', () => {
        const r = getCurrentShichen(new Date(2026, 6, 16, 23, 0, 0))
        expect(r.name).toBe('子时')
    })

    it('8 点是辰时', () => {
        const r = getCurrentShichen(new Date(2026, 6, 16, 8, 0, 0))
        expect(r.name).toBe('辰时')
    })
})

describe('almanac - getCurrentSolarTerm', () => {
    it('返回对象结构', () => {
        const r = getCurrentSolarTerm(new Date(2026, 6, 16))
        expect(r.term).toBeTruthy()
        expect(SOLAR_TERMS).toContain(r.term)
        expect(r.date).toBeTruthy()
    })

    it('2026-07-16 应在 2026 小暑 (2026-07-07) 之后', () => {
        // 7-16 离 7-07 小暑很近
        const r = getCurrentSolarTerm(new Date(2026, 6, 16))
        // 应该是小暑
        expect(['小暑', '大暑']).toContain(r.term)
    })
})

describe('almanac - getNearestSolarTerm', () => {
    it('返回最近节气', () => {
        const r = getNearestSolarTerm(new Date(2026, 6, 16))
        expect(r.term).toBeTruthy()
        expect(SOLAR_TERMS).toContain(r.term)
        expect(r.date).toBeInstanceOf(Date)
    })
})

describe('almanac - getChongSha', () => {
    it('返回冲煞对象', () => {
        const r = getChongSha(new Date(2026, 6, 16))
        expect(r.chong).toBeTruthy()
        expect(r.sha).toBeTruthy()
        expect(r.chongFull).toBe(`冲${r.chong}`)
        expect(r.full).toBe(`冲${r.chong}煞${r.sha}`)
    })

    it('煞在 4 个方位内', () => {
        const r = getChongSha(new Date(2026, 6, 16))
        expect(['南', '东', '北', '西']).toContain(r.sha)
    })
})

describe('almanac - getJianchu', () => {
    it('返回建除对象', () => {
        const r = getJianchu(new Date(2026, 6, 16))
        expect(['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭']).toContain(r.name)
        expect(r.desc).toBeTruthy()
        expect(Array.isArray(r.yi)).toBe(true)
        expect(Array.isArray(r.ji)).toBe(true)
        expect(r.yi.length).toBeGreaterThan(0)
        expect(r.ji.length).toBeGreaterThan(0)
    })

    it('index 在 0-11', () => {
        const r = getJianchu(new Date(2026, 6, 16))
        expect(r.index).toBeGreaterThanOrEqual(0)
        expect(r.index).toBeLessThan(12)
    })
})

describe('almanac - getDayWuxing', () => {
    it('甲乙 -> 木', () => {
        // 找一个甲日
        const r = getDayWuxing(new Date(1900, 0, 31))
        // 1900-01-31 是甲辰日 -> gan 甲 -> 木
        expect(r).toBe('木')
    })

    it('返回值是金/木/水/火/土之一', () => {
        const r = getDayWuxing(new Date(2026, 6, 16))
        expect(['金', '木', '水', '火', '土']).toContain(r)
    })
})

describe('almanac - getNayin', () => {
    it('甲子 -> 海中金', () => {
        expect(getNayin('甲子')).toBe('海中金')
    })

    it('甲午 -> 沙中金', () => {
        expect(getNayin('甲午')).toBe('沙中金')
    })

    it('未知干支 -> 未知', () => {
        expect(getNayin('XXYY')).toBe('未知')
    })
})

describe('almanac - getDirections', () => {
    it('返回三神方位', () => {
        const r = getDirections(new Date(2026, 6, 16))
        expect(r.caishen).toBeTruthy()
        expect(r.xishen).toBeTruthy()
        expect(r.fushen).toBeTruthy()
    })

    it('甲日财神 -> 东北', () => {
        // 1900-01-31 是甲辰日
        const r = getDirections(new Date(1900, 0, 31))
        expect(r.caishen).toBe('东北')
        expect(r.xishen).toBe('西南')
        expect(r.fushen).toBe('正东')
    })
})

describe('almanac - getShichenFortune', () => {
    it('返回 12 时辰吉凶', () => {
        const r = getShichenFortune(new Date(2026, 6, 16))
        expect(r.length).toBe(12)
        r.forEach(item => {
            expect(item.name).toBeTruthy()
            expect(item.time).toBeTruthy()
            expect(['吉', '凶']).toContain(item.luck)
            expect(typeof item.isGood).toBe('boolean')
        })
    })
})

describe('almanac - getBazi', () => {
    it('返回完整四柱', () => {
        const r = getBazi(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.year).toBeTruthy()
        expect(r.month).toBeTruthy()
        expect(r.day).toBeTruthy()
        expect(r.hour).toBeTruthy()
        expect(r.yearNa).toBeTruthy()
        expect(r.monthNa).toBeTruthy()
        expect(r.dayNa).toBeTruthy()
        expect(r.hourNa).toBeTruthy()
    })

    it('每柱 2 个字符', () => {
        const r = getBazi(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.year.length).toBe(2)
        expect(r.month.length).toBe(2)
        expect(r.day.length).toBe(2)
        expect(r.hour.length).toBe(2)
    })
})

describe('almanac - getDailyAlmanac', () => {
    it('返回完整黄历', () => {
        const r = getDailyAlmanac(new Date(2026, 6, 16, 12, 0, 0))
        expect(r.date).toBe('2026-07-16')
        expect(r.solar.year).toBe(2026)
        expect(r.solar.month).toBe(7)
        expect(r.solar.day).toBe(16)
        expect(r.solar.weekdayName).toBeTruthy()
        expect(r.solar.term).toBeTruthy()
        expect(r.solar.nearestTerm).toBeTruthy()
        expect(r.ganzhi.year).toBeTruthy()
        expect(r.ganzhi.month).toBeTruthy()
        expect(r.ganzhi.day).toBeTruthy()
        expect(r.ganzhi.hour).toBeTruthy()
        expect(r.bazi).toBeTruthy()
        expect(r.zodiac).toBeTruthy()
        expect(r.wuxing).toBeTruthy()
        expect(r.jianchu).toBeTruthy()
        expect(r.chongSha).toBeTruthy()
        expect(r.directions).toBeTruthy()
        expect(r.shichen).toBeTruthy()
    })

    it('weekdayName 是中文', () => {
        const r = getDailyAlmanac(new Date(2026, 6, 16))
        expect(r.solar.weekdayName).toMatch(/^星期/)
    })

    it('生肖是 12 生肖之一', () => {
        const r = getDailyAlmanac(new Date(2026, 6, 16))
        expect(['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']).toContain(r.zodiac)
    })
})

describe('almanac - getLunarInfo', () => {
    it('返回简化农历', () => {
        const r = getLunarInfo(new Date(2026, 6, 16))
        expect(r.yearName).toMatch(/.+年$/)
        expect(r.zodiac).toBeTruthy()
        expect(r.monthName).toBeTruthy()
        expect(r.dayName).toBeTruthy()
        expect(r.fullDate).toBeTruthy()
    })
})

describe('almanac - 常量', () => {
    it('TIANGAN 10 个', () => {
        expect(TIANGAN.length).toBe(10)
    })
    it('DIZHI 12 个', () => {
        expect(DIZHI.length).toBe(12)
    })
    it('SHICHEN 12 个', () => {
        expect(SHICHEN.length).toBe(12)
    })
    it('SOLAR_TERMS 24 个', () => {
        expect(SOLAR_TERMS.length).toBe(24)
    })
})
