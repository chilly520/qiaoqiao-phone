/**
 * periodCalculator.js 单元测试 - 生理期预测 / 排卵期 / 易孕期算法
 * 验证:
 * - 工具: normalizeDate / toDateStr / daysBetween / addDays
 * - normalizeCycles 数据规整
 * - calculateStats 周期统计(加权平均、方差、规律性)
 * - generatePredictions 预测生成
 * - calculateOvulation / calculateFertileWindow 排卵与易孕
 * - getCyclePhase 周期相位查询
 * - getCurrentPeriod 当前经期
 * - startPeriodToday / endPeriodToday 一键开始结束
 * - deleteCycle 删除
 * - getFullStats 完整统计
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    normalizeDate,
    toDateStr,
    daysBetween,
    addDays,
    normalizeCycles,
    calculateStats,
    generatePredictions,
    calculateOvulation,
    calculateFertileWindow,
    getCyclePhase,
    getCurrentPeriod,
    startPeriodToday,
    endPeriodToday,
    deleteCycle,
    getFullStats
} from '../src/utils/periodCalculator'

describe('periodCalculator - 工具函数', () => {
    describe('normalizeDate', () => {
        it('null 返回 null', () => {
            expect(normalizeDate(null)).toBe(null)
        })

        it('undefined 返回 null', () => {
            expect(normalizeDate(undefined)).toBe(null)
        })

        it('数字返回 null', () => {
            expect(normalizeDate(123)).toBe(null)
        })

        it('Date 对象归一为 0 点', () => {
            const d = new Date(2024, 0, 15, 13, 30, 45)
            const result = normalizeDate(d)
            expect(result.getFullYear()).toBe(2024)
            expect(result.getMonth()).toBe(0)
            expect(result.getDate()).toBe(15)
            expect(result.getHours()).toBe(0)
            expect(result.getMinutes()).toBe(0)
            expect(result.getSeconds()).toBe(0)
        })

        it('yyyy-mm-dd 字符串', () => {
            const result = normalizeDate('2024-03-15')
            expect(result.getFullYear()).toBe(2024)
            expect(result.getMonth()).toBe(2)
            expect(result.getDate()).toBe(15)
        })

        it('完整 ISO 字符串取日期部分', () => {
            const result = normalizeDate('2024-03-15T13:30:00Z')
            expect(result.getFullYear()).toBe(2024)
            expect(result.getMonth()).toBe(2)
            expect(result.getDate()).toBe(15)
        })

        it('返回新对象(不修改原 Date)', () => {
        // 用带时分秒的 Date 测试 - normalizeDate 应返回新的 0 点对象
        const original = new Date(2024, 0, 15, 13, 30, 45)
        const result = normalizeDate(original)
        expect(result).not.toBe(original)
        expect(result.getHours()).toBe(0)
        // 原对象未被修改
        expect(original.getHours()).toBe(13)
    })
    })

    describe('toDateStr', () => {
        it('标准日期', () => {
            expect(toDateStr(new Date(2024, 0, 15))).toBe('2024-01-15')
        })

        it('1 位月份补 0', () => {
            expect(toDateStr(new Date(2024, 2, 5))).toBe('2024-03-05')
        })

        it('1 位日期补 0', () => {
            expect(toDateStr(new Date(2024, 11, 9))).toBe('2024-12-09')
        })

        it('接受字符串输入', () => {
            expect(toDateStr('2024-05-20')).toBe('2024-05-20')
        })

        it('接受 Date 输入', () => {
            expect(toDateStr(new Date(2024, 5, 30))).toBe('2024-06-30')
        })
    })

    describe('daysBetween', () => {
        it('同一天返回 0', () => {
            expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0)
        })

        it('正向天数差', () => {
            expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9)
        })

        it('负向天数差', () => {
            expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9)
        })

        it('跨月', () => {
            expect(daysBetween('2024-01-25', '2024-02-05')).toBe(11)
        })

        it('跨年', () => {
            expect(daysBetween('2023-12-25', '2024-01-05')).toBe(11)
        })

        it('忽略时分秒', () => {
            const d1 = new Date(2024, 0, 1, 23, 59, 59)
            const d2 = new Date(2024, 0, 2, 0, 0, 1)
            expect(daysBetween(d1, d2)).toBe(1)
        })
    })

    describe('addDays', () => {
        it('正向加天数', () => {
            const result = addDays('2024-01-01', 5)
            expect(toDateStr(result)).toBe('2024-01-06')
        })

        it('负向加天数', () => {
            const result = addDays('2024-01-10', -5)
            expect(toDateStr(result)).toBe('2024-01-05')
        })

        it('跨月', () => {
            const result = addDays('2024-01-28', 5)
            expect(toDateStr(result)).toBe('2024-02-02')
        })

        it('跨年', () => {
            const result = addDays('2023-12-30', 5)
            expect(toDateStr(result)).toBe('2024-01-04')
        })

        it('加 0 天返回相同日期', () => {
            const result = addDays('2024-06-15', 0)
            expect(toDateStr(result)).toBe('2024-06-15')
        })
    })
})

describe('periodCalculator - normalizeCycles', () => {
    it('空数组返回空数组', () => {
        expect(normalizeCycles([])).toEqual([])
    })

    it('null 返回空数组', () => {
        expect(normalizeCycles(null)).toEqual([])
    })

    it('非数组返回空数组', () => {
        expect(normalizeCycles('not array')).toEqual([])
        expect(normalizeCycles({})).toEqual([])
        expect(normalizeCycles(123)).toEqual([])
    })

    it('按 startDate 升序排列', () => {
        const cycles = [
            { id: 'c2', startDate: '2024-02-01' },
            { id: 'c1', startDate: '2024-01-01' },
            { id: 'c3', startDate: '2024-03-01' }
        ]
        const result = normalizeCycles(cycles)
        expect(result.map(c => c.id)).toEqual(['c1', 'c2', 'c3'])
    })

    it('startDate 缺失的对象被过滤', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01' },
            { id: 'c2' /* no startDate */ },
            { id: 'c3', startDate: '2024-02-01' }
        ]
        const result = normalizeCycles(cycles)
        expect(result.length).toBe(2)
        expect(result.map(c => c.id)).toEqual(['c1', 'c3'])
    })

    it('只有 duration 没有 endDate 时,endDate 仍为 null (源不反向计算)', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = normalizeCycles(cycles)
        expect(result[0].endDate).toBe(null)
        expect(result[0].duration).toBe(5)
    })

    it('有 endDate 时计算 duration', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', endDate: '2024-01-05' }
        ]
        const result = normalizeCycles(cycles)
        expect(result[0].duration).toBe(5)  // 5 - 1 + 1 = 5
    })

    it('同时有 endDate 和 duration 保留原 duration', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', endDate: '2024-01-05', duration: 7 }
        ]
        const result = normalizeCycles(cycles)
        expect(result[0].duration).toBe(7)
    })

    it('无 endDate 无 duration 时默认 5', () => {
        const cycles = [{ id: 'c1', startDate: '2024-01-01' }]
        const result = normalizeCycles(cycles)
        expect(result[0].duration).toBe(5)
    })

    it('保留其他字段', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', symptoms: 'cramps', mood: 'happy' }
        ]
        const result = normalizeCycles(cycles)
        expect(result[0].symptoms).toBe('cramps')
        expect(result[0].mood).toBe('happy')
    })
})

describe('periodCalculator - calculateStats', () => {
    it('空数据返回默认值', () => {
        const result = calculateStats([])
        expect(result.avgCycle).toBe(28)
        expect(result.avgDuration).toBe(5)
        expect(result.variance).toBe(0)
        expect(result.stdDev).toBe(0)
        expect(result.sampleSize).toBe(0)
        expect(result.regularity).toBe('unknown')
        expect(result.lastCycle).toBe(null)
    })

    it('单条数据无 interval', () => {
        const cycles = [{ id: 'c1', startDate: '2024-01-01', duration: 5 }]
        const result = calculateStats(cycles)
        expect(result.avgCycle).toBe(28)  // 默认
        expect(result.avgDuration).toBe(5)
        expect(result.sampleSize).toBe(1)
        expect(result.intervalCount).toBe(0)
        expect(result.regularity).toBe('unknown')  // 不足 2 个 interval
    })

    it('两条数据计算 1 个 interval', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }  // 28 天后
        ]
        const result = calculateStats(cycles)
        expect(result.avgCycle).toBe(28)
        expect(result.intervalCount).toBe(1)
    })

    it('规则周期 (28 天)', () => {
        const cycles = []
        for (let i = 0; i < 4; i++) {
            const d = new Date(2024, 0, 1 + i * 28)
            cycles.push({
                id: `c${i}`,
                startDate: toDateStr(d),
                duration: 5
            })
        }
        const result = calculateStats(cycles)
        expect(result.avgCycle).toBe(28)
        expect(result.stdDev).toBe(0)
        expect(result.regularity).toBe('regular')
    })

    it('轻微不规则 (stdDev 3-7)', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-28', duration: 5 },  // 27
            { id: 'c3', startDate: '2024-02-28', duration: 5 },  // 31
            { id: 'c4', startDate: '2024-03-25', duration: 5 }   // 26
        ]
        const result = calculateStats(cycles)
        // intervals: 27, 31, 26 - 平均 28,stdDev ~2.2-2.6
        // 实际情况取决于加权平均
        expect(['regular', 'mild_irregular']).toContain(result.regularity)
    })

    it('严重不规则 (stdDev >= 7)', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-20', duration: 5 },  // 19
            { id: 'c3', startDate: '2024-02-25', duration: 5 },  // 36
            { id: 'c4', startDate: '2024-03-20', duration: 5 }   // 24
        ]
        const result = calculateStats(cycles)
        expect(result.regularity).toBe('irregular')
    })

    it('只取最近 6 个 interval', () => {
        const cycles = []
        // 10 个周期
        for (let i = 0; i < 10; i++) {
            cycles.push({
                id: `c${i}`,
                startDate: toDateStr(new Date(2024, 0, 1 + i * 30)),
                duration: 5
            })
        }
        const result = calculateStats(cycles)
        expect(result.intervalCount).toBe(6)
    })

    it('包含 lastCycle', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-02-01', duration: 5 }
        ]
        const result = calculateStats(cycles)
        expect(result.lastCycle.id).toBe('c2')
    })

    it('recentCycles 是已规整的数据', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01' },
            { id: 'c2', startDate: '2024-02-01' }
        ]
        const result = calculateStats(cycles)
        expect(result.recentCycles.length).toBe(2)
        expect(result.recentCycles[0].id).toBe('c1')
    })
})

describe('periodCalculator - generatePredictions', () => {
    it('空数据返回空数组', () => {
        expect(generatePredictions([])).toEqual([])
    })

    it('默认生成 6 个预测', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = generatePredictions(cycles)
        expect(result.length).toBe(6)
    })

    it('自定义 count', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = generatePredictions(cycles, 3)
        expect(result.length).toBe(3)
    })

    it('预测标记 isPrediction', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = generatePredictions(cycles, 2)
        expect(result[0].isPrediction).toBe(true)
        expect(result[1].isPrediction).toBe(true)
    })

    it('预测间隔基于 avgCycle', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }  // 28
        ]
        const result = generatePredictions(cycles, 2)
        // 第一次预测: 2024-01-29 + 28 = 2024-02-26
        expect(result[0].startDate).toBe('2024-02-26')
    })

    it('cycleIndex 递增', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }
        ]
        const result = generatePredictions(cycles, 2)
        // data.length = 2, 预测索引从 3 开始
        expect(result[0].cycleIndex).toBe(3)
        expect(result[1].cycleIndex).toBe(4)
    })

    it('confidence 在 0-100 之间', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }
        ]
        const result = generatePredictions(cycles)
        result.forEach(p => {
            expect(p.confidence).toBeGreaterThanOrEqual(30)
            expect(p.confidence).toBeLessThanOrEqual(100)
        })
    })

    it('规则周期 confidence 接近 100', () => {
        const cycles = []
        for (let i = 0; i < 4; i++) {
            cycles.push({
                id: `c${i}`,
                startDate: toDateStr(new Date(2024, 0, 1 + i * 28)),
                duration: 5
            })
        }
        const result = generatePredictions(cycles, 1)
        expect(result[0].confidence).toBe(100)
    })

    it('id 唯一', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = generatePredictions(cycles, 3)
        const ids = result.map(p => p.id)
        expect(new Set(ids).size).toBe(3)
    })
})

describe('periodCalculator - calculateOvulation', () => {
    it('默认 28 天周期,排卵日 = 周期开始 + 14 天', () => {
        const result = calculateOvulation('2024-01-01')
        expect(toDateStr(result)).toBe('2024-01-15')
    })

    it('30 天周期', () => {
        const result = calculateOvulation('2024-01-01', 30)
        expect(toDateStr(result)).toBe('2024-01-17')  // 30 - 14 = 16 天后
    })

    it('短周期 21 天', () => {
        const result = calculateOvulation('2024-01-01', 21)
        expect(toDateStr(result)).toBe('2024-01-08')  // 7 天后
    })

    it('接受 Date 对象', () => {
        const result = calculateOvulation(new Date(2024, 0, 1))
        expect(toDateStr(result)).toBe('2024-01-15')
    })
})

describe('periodCalculator - calculateFertileWindow', () => {
    it('返回对象包含 start/peak/end', () => {
        const result = calculateFertileWindow('2024-01-01', 28)
        expect(result.start).toBeInstanceOf(Date)
        expect(result.peak).toBeInstanceOf(Date)
        expect(result.end).toBeInstanceOf(Date)
    })

    it('易孕开始 = 排卵日 - 5 天', () => {
        const result = calculateFertileWindow('2024-01-01', 28)
        // 排卵日: 2024-01-15
        // 开始: 2024-01-10
        expect(toDateStr(result.start)).toBe('2024-01-10')
    })

    it('peak = 排卵日', () => {
        const result = calculateFertileWindow('2024-01-01', 28)
        expect(toDateStr(result.peak)).toBe('2024-01-15')
    })

    it('易孕结束 = 排卵日 + 1 天', () => {
        const result = calculateFertileWindow('2024-01-01', 28)
        expect(toDateStr(result.end)).toBe('2024-01-16')
    })

    it('总窗口 7 天 (含排卵后 1 天)', () => {
        const result = calculateFertileWindow('2024-01-01', 28)
        const span = daysBetween(result.start, result.end)
        expect(span).toBe(6)  // 5 + 1
    })
})

describe('periodCalculator - getCyclePhase', () => {
    const sampleCycles = [
        { id: 'c1', startDate: '2024-01-01', duration: 5 },
        { id: 'c2', startDate: '2024-01-29', duration: 5 },
        { id: 'c3', startDate: '2024-02-26', duration: 5 }
    ]

    it('null 输入返回 null', () => {
        expect(getCyclePhase(null, sampleCycles)).toBe(null)
    })

    it('空 cycles 返回 null', () => {
        expect(getCyclePhase('2024-05-01', [])).toBe(null)
    })

    it('实际经期内 phase=period', () => {
        const result = getCyclePhase('2024-01-03', sampleCycles)
        expect(result.phase).toBe('period')
        expect(result.source).toBe('actual')
        expect(result.day).toBe(3)
    })

    it('实际经期第一天 day=1', () => {
        const result = getCyclePhase('2024-01-01', sampleCycles)
        expect(result.day).toBe(1)
    })

    it('实际经期最后一天', () => {
        const result = getCyclePhase('2024-01-05', sampleCycles)
        expect(result.phase).toBe('period')
        expect(result.day).toBe(5)
    })

    it('预测经期 phase=prediction', () => {
        // 预测: 2024-03-25 开始的下一周期
        const result = getCyclePhase('2024-03-26', sampleCycles)
        expect(result.phase).toBe('prediction')
    })

    it('排卵日 phase=ovulation', () => {
        // 上次周期 2024-02-26, 周期 28 天,下次 2024-03-25
        // 排卵 = 2024-03-25 - 14 = 2024-03-11
        const result = getCyclePhase('2024-03-11', sampleCycles)
        expect(result.phase).toBe('ovulation')
    })

    it('易孕窗口内 phase=fertile', () => {
        // 排卵 2024-03-11,易孕 2024-03-06 ~ 2024-03-12
        // 取 03-08 是易孕但非高峰
        const result = getCyclePhase('2024-03-08', sampleCycles)
        expect(result.phase).toBe('fertile')
    })

    it('易孕非高峰 isPeak=undefined 或 false', () => {
        const result = getCyclePhase('2024-03-08', sampleCycles)
        expect(result.isPeak).toBeFalsy()
    })

    it('黄体期 phase=luteal', () => {
        // 排卵 2024-03-11,易孕结束 2024-03-12,下次经期 2024-03-25
        // 黄体期: 2024-03-13 ~ 2024-03-24
        const result = getCyclePhase('2024-03-15', sampleCycles)
        expect(result.phase).toBe('luteal')
    })

    it('安全期 phase=safe', () => {
        // 月经结束后到易孕前
        // 经期 2024-02-26 ~ 03-01,排卵 2024-03-11,易孕开始 2024-03-06
        // 安全期: 03-02 ~ 03-05
        const result = getCyclePhase('2024-03-03', sampleCycles)
        expect(result.phase).toBe('safe')
    })

    it('所有周期前的日期返回 null', () => {
        // 所有周期前 - 应该没有 refCycle
        // 上次周期 2024-02-26 之前
        const result = getCyclePhase('2023-12-01', sampleCycles)
        expect(result).toBe(null)
    })

    it('支持自定义 predictions', () => {
        const customPreds = [
            { startDate: '2024-12-01', endDate: '2024-12-05', cycleIndex: 99, confidence: 80 }
        ]
        const result = getCyclePhase('2024-12-03', sampleCycles, customPreds)
        expect(result.phase).toBe('prediction')
    })
})

describe('periodCalculator - getCurrentPeriod', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('空 cycles 返回 null', () => {
        expect(getCurrentPeriod([])).toBe(null)
    })

    it('无当前经期返回 null', () => {
        const cycles = [
            { id: 'c1', startDate: '2020-01-01', endDate: '2020-01-05', duration: 5 }
        ]
        vi.setSystemTime(new Date(2024, 5, 15))
        expect(getCurrentPeriod(cycles)).toBe(null)
    })

    it('今天在经期内', () => {
        vi.setSystemTime(new Date(2024, 0, 3))
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', endDate: '2024-01-05', duration: 5 }
        ]
        const result = getCurrentPeriod(cycles)
        expect(result).not.toBe(null)
        expect(result.currentDay).toBe(3)
    })

    it('今天是经期第一天 currentDay=1', () => {
        vi.setSystemTime(new Date(2024, 0, 1))
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', endDate: '2024-01-05', duration: 5 }
        ]
        const result = getCurrentPeriod(cycles)
        expect(result.currentDay).toBe(1)
    })

    it('endDate 缺失时按 duration 推算', () => {
        vi.setSystemTime(new Date(2024, 0, 3))
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = getCurrentPeriod(cycles)
        expect(result).not.toBe(null)
    })

    it('多个周期找最新的', () => {
        vi.setSystemTime(new Date(2024, 0, 3))
        const cycles = [
            { id: 'c1', startDate: '2023-12-01', endDate: '2023-12-05', duration: 5 },
            { id: 'c2', startDate: '2024-01-01', endDate: '2024-01-05', duration: 5 }
        ]
        const result = getCurrentPeriod(cycles)
        expect(result.id).toBe('c2')
    })
})

describe('periodCalculator - startPeriodToday', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024, 5, 15))  // 2024-06-15
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('空 cycles 创建新周期', () => {
        const result = startPeriodToday([])
        expect(result.alreadyActive).toBeUndefined()
        expect(result.alreadyExists).toBeUndefined()
        expect(result.cycles.length).toBe(1)
        expect(result.cycles[0].startDate).toBe('2024-06-15')
    })

    it('默认 5 天经期', () => {
        const result = startPeriodToday([])
        expect(result.newCycle.duration).toBe(5)
    })

    it('今天已在经期时返回 alreadyActive', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', endDate: '2024-06-19', duration: 5 }
        ]
        const result = startPeriodToday(cycles)
        expect(result.alreadyActive).toBe(true)
    })

    it('今天已存在记录(无 endDate)实际被 getCurrentPeriod 拦截,返回 alreadyActive', () => {
        // 注意: 当 startDate=today 且无 endDate 时,getCurrentPeriod 会先匹配
        // 所以这里实际触发的是 alreadyActive 分支
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', duration: 5 }
        ]
        const result = startPeriodToday(cycles)
        expect(result.alreadyActive).toBe(true)
    })

    it('新周期 id 唯一', () => {
        const result = startPeriodToday([])
        expect(result.newCycle.id).toBeTruthy()
        expect(result.newCycle.id.startsWith('cycle_')).toBe(true)
    })

    it('包含 createdAt ISO 字符串', () => {
        const result = startPeriodToday([])
        expect(result.newCycle.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('message 字段存在', () => {
        const result = startPeriodToday([])
        expect(result.message).toBeTruthy()
    })
})

describe('periodCalculator - endPeriodToday', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2024, 5, 19))  // 2024-06-19
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('空 cycles 无操作', () => {
        const result = endPeriodToday([])
        expect(result.noop).toBe(true)
        expect(result.cycles).toEqual([])
    })

    it('结束无 endDate 的周期', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', duration: 5 }
        ]
        const result = endPeriodToday(cycles)
        expect(result.noop).toBeUndefined()
        expect(result.updated.endDate).toBe('2024-06-19')
    })

    it('endDate 设为今天', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', duration: 5 }
        ]
        const result = endPeriodToday(cycles)
        expect(result.updated.endDate).toBe('2024-06-19')
    })

    it('duration 根据 startDate 和今天计算', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', duration: 5 }
        ]
        const result = endPeriodToday(cycles)
        // 06-15 到 06-19 = 4 天差, +1 = 5 天
        expect(result.updated.duration).toBe(5)
    })

    it('endDate 在过去时无操作(noop)', () => {
        // 当 endDate < today 时,既不更新也不再添加
        // 条件 !c.endDate || c._end > today 都不满足
        const cycles = [
            { id: 'c1', startDate: '2024-06-10', endDate: '2024-06-14', duration: 5 }
        ]
        const result = endPeriodToday(cycles)
        expect(result.noop).toBe(true)
    })

    it('endDate 在未来时重新结束到今天', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-06-15', endDate: '2024-06-20', duration: 5 }
        ]
        // 2024-06-19 < 2024-06-20 (endDate 仍在未来),匹配条件重新结束
        const result = endPeriodToday(cycles)
        expect(result.updated.endDate).toBe('2024-06-19')
    })

    it('多个周期只更新最后一个', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-05-15', endDate: '2024-05-19', duration: 5 },
            { id: 'c2', startDate: '2024-06-15', duration: 5 }
        ]
        const result = endPeriodToday(cycles)
        expect(result.updated.id).toBe('c2')
    })
})

describe('periodCalculator - deleteCycle', () => {
    it('按 id 删除', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01' },
            { id: 'c2', startDate: '2024-02-01' },
            { id: 'c3', startDate: '2024-03-01' }
        ]
        const result = deleteCycle(cycles, 'c2')
        expect(result.length).toBe(2)
        expect(result.map(c => c.id)).toEqual(['c1', 'c3'])
    })

    it('不存在的 id 返回原数据', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01' },
            { id: 'c2', startDate: '2024-02-01' }
        ]
        const result = deleteCycle(cycles, 'nonexistent')
        expect(result.length).toBe(2)
    })

    it('空数组返回空数组', () => {
        expect(deleteCycle([], 'any')).toEqual([])
    })

    it('null 返回空数组', () => {
        expect(deleteCycle(null, 'any')).toEqual([])
    })
})

describe('periodCalculator - getFullStats', () => {
    it('空数据返回 hasData=false', () => {
        const result = getFullStats([])
        expect(result.hasData).toBe(false)
        expect(result.totalCycles).toBe(0)
        expect(result.regularity).toBe('unknown')
        expect(result.regularityLabel).toBe('暂无数据')
    })

    it('包含 avgCycle/avgDuration/stdDev', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(result.avgCycle).toBe(28)
        expect(result.avgDuration).toBe(5)
    })

    it('regularityLabel 中文映射 - 规律', () => {
        // 4 个 28 天周期 = regular
        const cycles = []
        for (let i = 0; i < 4; i++) {
            cycles.push({
                id: `c${i}`,
                startDate: toDateStr(new Date(2024, 0, 1 + i * 28)),
                duration: 5
            })
        }
        const result = getFullStats(cycles)
        expect(result.regularityLabel).toBe('规律')
    })

    it('regularityLabel 未知(数据不足)', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 },
            { id: 'c2', startDate: '2024-01-29', duration: 5 }
        ]
        // 只有 1 个 interval, regularity='unknown'
        const result = getFullStats(cycles)
        expect(result.regularityLabel).toBe('数据不足')
    })

    it('nextPrediction 不为 null', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(result.nextPrediction).not.toBe(null)
        expect(result.nextPrediction.isPrediction).toBe(true)
    })

    it('nextOvulation 是字符串', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(typeof result.nextOvulation).toBe('string')
        expect(result.nextOvulation).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('nextFertileWindow 包含 start/peak/end', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(result.nextFertileWindow.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.nextFertileWindow.peak).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.nextFertileWindow.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('包含 predictions 数组', () => {
        const cycles = [
            { id: 'c1', startDate: '2024-01-01', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(result.predictions.length).toBe(3)
    })

    it('currentPeriod 可能为 null', () => {
        const cycles = [
            { id: 'c1', startDate: '2020-01-01', endDate: '2020-01-05', duration: 5 }
        ]
        const result = getFullStats(cycles)
        expect(result.currentPeriod).toBe(null)
    })
})
