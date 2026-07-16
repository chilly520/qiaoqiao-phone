/**
 * bioUtils.js 单元测试 - 个性签名更新与上下文
 * 验证:
 * - processBioUpdate: 解析 [BIO_UPDATE:...] 命令、写入 localStorage、清理显示文本
 * - getBioContext: 读取角色/用户个性签名、拼接到系统提示
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processBioUpdate, getBioContext } from '../src/utils/bioUtils'

describe('bioUtils - processBioUpdate', () => {
    beforeEach(() => {
        localStorage.clear()
        console.log.mockClear && console.log.mockClear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    describe('基础守卫', () => {
        it('无命令时返回原文本', () => {
            const result = processBioUpdate('你好世界', 'char1')
            expect(result).toBe('你好世界')
        })

        it('空字符串返回空字符串', () => {
            expect(processBioUpdate('', 'char1')).toBe('')
        })

        it('无 BIO_UPDATE 时不调用 localStorage.setItem', () => {
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
            processBioUpdate('hello world', 'char1')
            expect(setItemSpy).not.toHaveBeenCalled()
            setItemSpy.mockRestore()
        })

        it('空 charId 也能工作', () => {
            const result = processBioUpdate('[BIO_UPDATE:签名内容]', '')
            expect(result).toBe('')
            expect(localStorage.getItem('char_bio_')).toBe('签名内容')
        })
    })

    describe('单条 BIO_UPDATE 解析', () => {
        it('解析并移除命令', () => {
            const text = '好的!我更新了[BIO_UPDATE:快乐生活]签名'
            const result = processBioUpdate(text, 'char1')
            expect(result).toBe('好的!我更新了签名')
        })

        it('写入 localStorage', () => {
            processBioUpdate('[BIO_UPDATE:新的签名]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('新的签名')
        })

        it('trim 处理', () => {
            processBioUpdate('[BIO_UPDATE:  带空格的签名  ]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('带空格的签名')
        })

        it('只在文本开头时返回空', () => {
            const result = processBioUpdate('[BIO_UPDATE:签名]', 'char1')
            expect(result).toBe('')
        })

        it('只有命令时 trim 后为空', () => {
            const result = processBioUpdate('[BIO_UPDATE:hello]')
            expect(result).toBe('')
        })
    })

    describe('多条 BIO_UPDATE 处理', () => {
        it('处理多条命令', () => {
            const text = '第一段[BIO_UPDATE:签名1]第二段[BIO_UPDATE:签名2]结束'
            const result = processBioUpdate(text, 'char1')
            expect(result).toBe('第一段第二段结束')
        })

        it('最后一条命令覆盖前面的 localStorage', () => {
            processBioUpdate('[BIO_UPDATE:签名1][BIO_UPDATE:签名2]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('签名2')
        })

        it('跨多行的命令也能解析', () => {
            const text = '前面\n[BIO_UPDATE:多行签名]\n后面'
            const result = processBioUpdate(text, 'char1')
            expect(result).toContain('前面')
            expect(result).toContain('后面')
            expect(result).not.toContain('[BIO_UPDATE:')
            expect(localStorage.getItem('char_bio_char1')).toBe('多行签名')
        })
    })

    describe('特殊字符', () => {
        it('签名包含特殊符号', () => {
            processBioUpdate('[BIO_UPDATE:hello!@#$%^&*()]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('hello!@#$%^&*()')
        })

        it('签名包含中文标点', () => {
            processBioUpdate('[BIO_UPDATE:你好,世界。]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('你好,世界。')
        })

        it('签名包含数字', () => {
            processBioUpdate('[BIO_UPDATE:2024新年快乐]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('2024新年快乐')
        })

        it('签名包含空格', () => {
            processBioUpdate('[BIO_UPDATE:happy birthday]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('happy birthday')
        })
    })

    describe('charId 参数', () => {
        it('user ID 写入 char_bio_user', () => {
            processBioUpdate('[BIO_UPDATE:用户签名]', 'user')
            expect(localStorage.getItem('char_bio_user')).toBe('用户签名')
        })

        it('不同 charId 互不干扰', () => {
            processBioUpdate('[BIO_UPDATE:角色1签名]', 'char1')
            processBioUpdate('[BIO_UPDATE:角色2签名]', 'char2')
            expect(localStorage.getItem('char_bio_char1')).toBe('角色1签名')
            expect(localStorage.getItem('char_bio_char2')).toBe('角色2签名')
        })

        it('相同 charId 多次更新取最后一次', () => {
            processBioUpdate('[BIO_UPDATE:旧签名]', 'char1')
            processBioUpdate('[BIO_UPDATE:新签名]', 'char1')
            expect(localStorage.getItem('char_bio_char1')).toBe('新签名')
        })
    })

    describe('正则匹配边界', () => {
        it('命令内不含右方括号时正常', () => {
            const result = processBioUpdate('[BIO_UPDATE:没有右括号]后续', 'char1')
            expect(result).toBe('后续')
            expect(localStorage.getItem('char_bio_char1')).toBe('没有右括号')
        })

        it('类似格式但不是 BIO_UPDATE 不应匹配', () => {
            const result = processBioUpdate('[OTHER_UPDATE:foo]bar[BIO_UPDATE:bio]', 'char1')
            expect(result).toBe('[OTHER_UPDATE:foo]bar')
            expect(localStorage.getItem('char_bio_char1')).toBe('bio')
        })

        it('BIO_UPDATE 大小写敏感', () => {
            const result = processBioUpdate('[bio_update:lowercase]', 'char1')
            // 大小写不匹配,返回原文
            expect(result).toBe('[bio_update:lowercase]')
        })
    })

    describe('返回值', () => {
        it('返回值是字符串', () => {
            const result = processBioUpdate('plain text', 'char1')
            expect(typeof result).toBe('string')
        })

        it('返回值已 trim', () => {
            const result = processBioUpdate('   有空格的文本   ', 'char1')
            expect(result).toBe('有空格的文本')
        })

        it('不修改原始字符串中的命令的内部内容', () => {
            // processBioUpdate 内部会修改 cleanedText 但原 text 不变(因为是局部变量)
            const original = '[BIO_UPDATE:test]原文本'
            const result = processBioUpdate(original, 'char1')
            // original 仍是原样
            expect(original).toBe('[BIO_UPDATE:test]原文本')
            expect(result).toBe('原文本')
        })
    })

    describe('console.log 行为', () => {
        it('处理时输出日志', () => {
            processBioUpdate('[BIO_UPDATE:log测试]', 'char1')
            expect(console.log).toHaveBeenCalled()
        })

        it('无命令时不输出日志', () => {
            processBioUpdate('hello', 'char1')
            expect(console.log).not.toHaveBeenCalled()
        })
    })
})

describe('bioUtils - getBioContext', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    describe('基础行为', () => {
        it('返回字符串', () => {
            const result = getBioContext('char1')
            expect(typeof result).toBe('string')
        })

        it('始终包含功能提示', () => {
            const result = getBioContext('char1')
            expect(result).toContain('[功能提示')
            expect(result).toContain('[BIO_UPDATE:')
        })
    })

    describe('角色签名', () => {
        it('无角色签名时显示 (暂无)', () => {
            const result = getBioContext('char1')
            expect(result).toContain('你的个性签名：(暂无)')
        })

        it('有角色签名时显示内容', () => {
            localStorage.setItem('char_bio_char1', '快乐编程')
            const result = getBioContext('char1')
            expect(result).toContain('你的个性签名：快乐编程')
        })

        it('读取对应 charId 的签名', () => {
            localStorage.setItem('char_bio_charA', 'A签名')
            localStorage.setItem('char_bio_charB', 'B签名')
            const resultA = getBioContext('charA')
            const resultB = getBioContext('charB')
            expect(resultA).toContain('A签名')
            expect(resultB).toContain('B签名')
        })

        it('空字符串签名视为 (暂无)', () => {
            localStorage.setItem('char_bio_char1', '')
            const result = getBioContext('char1')
            expect(result).toContain('你的个性签名：(暂无)')
        })
    })

    describe('用户签名 (includeUser)', () => {
        it('默认包含用户签名', () => {
            localStorage.setItem('char_bio_user', '用户签名')
            const result = getBioContext('char1')
            expect(result).toContain('用户的个性签名：用户签名')
        })

        it('includeUser=false 不包含用户签名', () => {
            localStorage.setItem('char_bio_user', '用户签名')
            const result = getBioContext('char1', false)
            expect(result).not.toContain('用户的个性签名：')
        })

        it('无用户签名时 includeUser=true 也不显示用户段', () => {
            const result = getBioContext('char1', true)
            expect(result).not.toContain('用户的个性签名：')
        })

        it('includeUser=true 空字符串不显示', () => {
            localStorage.setItem('char_bio_user', '')
            const result = getBioContext('char1', true)
            expect(result).not.toContain('用户的个性签名：')
        })
    })

    describe('组合行为', () => {
        it('同时包含角色和用户签名', () => {
            localStorage.setItem('char_bio_char1', '角色签')
            localStorage.setItem('char_bio_user', '用户签')
            const result = getBioContext('char1', true)
            expect(result).toContain('你的个性签名：角色签')
            expect(result).toContain('用户的个性签名：用户签')
        })

        it('角色签名在用户签名之前', () => {
            localStorage.setItem('char_bio_char1', 'AAA')
            localStorage.setItem('char_bio_user', 'BBB')
            const result = getBioContext('char1', true)
            const aIdx = result.indexOf('你的个性签名：AAA')
            const bIdx = result.indexOf('用户的个性签名：BBB')
            expect(aIdx).toBeGreaterThanOrEqual(0)
            expect(bIdx).toBeGreaterThan(aIdx)
        })

        it('功能提示在最后', () => {
            localStorage.setItem('char_bio_char1', '签名')
            const result = getBioContext('char1', false)
            const tipIdx = result.indexOf('[功能提示')
            const sigIdx = result.indexOf('你的个性签名：签名')
            expect(tipIdx).toBeGreaterThan(sigIdx)
        })
    })

    describe('格式结构', () => {
        it('以换行符分隔段落', () => {
            const result = getBioContext('char1', false)
            expect(result).toContain('\n')
        })

        it('段落之间有空行', () => {
            const result = getBioContext('char1', false)
            // 角色签名段与功能提示段之间应有空行
            expect(result).toMatch(/\n\n/)
        })

        it('功能提示含完整示例格式', () => {
            const result = getBioContext('char1')
            expect(result).toContain('[BIO_UPDATE:新签名内容]')
        })
    })
})

describe('bioUtils - 集成行为', () => {
    beforeEach(() => {
        localStorage.clear()
        console.log.mockClear && console.log.mockClear()
        vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('processBioUpdate + getBioContext 联动', () => {
        // 1. AI 响应包含 BIO_UPDATE
        const aiResponse = '好的!我的新签名是[BIO_UPDATE:每天都要开心]'
        const cleaned = processBioUpdate(aiResponse, 'char1')
        expect(cleaned).toBe('好的!我的新签名是')

        // 2. 后续 getBioContext 能读到
        const context = getBioContext('char1', false)
        expect(context).toContain('你的个性签名：每天都要开心')
    })

    it('多次更新后 getBioContext 总是返回最新', () => {
        processBioUpdate('[BIO_UPDATE:旧]', 'char1')
        processBioUpdate('[BIO_UPDATE:新]', 'char1')
        const context = getBioContext('char1', false)
        expect(context).toContain('你的个性签名：新')
        expect(context).not.toContain('旧')
    })

    it('不同 charId 互不影响', () => {
        processBioUpdate('[BIO_UPDATE:角色1签]', 'char1')
        processBioUpdate('[BIO_UPDATE:用户签]', 'user')

        const charCtx = getBioContext('char1', true)
        const userCtx = getBioContext('user', false)

        // char1 视角
        expect(charCtx).toContain('你的个性签名：角色1签')
        expect(charCtx).toContain('用户的个性签名：用户签')

        // user 视角
        expect(userCtx).toContain('你的个性签名：用户签')
        expect(userCtx).not.toContain('用户的个性签名：')
    })
})
