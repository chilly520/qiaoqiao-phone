/**
 * chatMessageDisplay 测试
 * 纯函数:ensureMessageString / looksLikeHtmlCard / stripCardBlocks /
 * stripModeWrapperTags / extractTaggedBlock / looksLikeMojibake /
 * getMessageThumbnail / getModePartitionedContent / hasInnerVoice
 */
import { describe, it, expect } from 'vitest'
import {
    ensureMessageString,
    looksLikeHtmlCard,
    stripCardBlocks,
    stripModeWrapperTags,
    extractTaggedBlock,
    looksLikeMojibake,
    getMessageThumbnail,
    getModePartitionedContent,
    hasInnerVoice,
    parseOfflineLine
} from '../src/utils/chatMessageDisplay'

// =====================================
// ensureMessageString
// =====================================
describe('ensureMessageString', () => {
    it('string 直接返回', () => {
        expect(ensureMessageString('hello')).toBe('hello')
    })

    it('空字符串返回空字符串', () => {
        expect(ensureMessageString('')).toBe('')
    })

    it('null 返回空字符串', () => {
        expect(ensureMessageString(null)).toBe('')
    })

    it('undefined 返回空字符串', () => {
        expect(ensureMessageString(undefined)).toBe('')
    })

    it('数字转字符串', () => {
        expect(ensureMessageString(42)).toBe('42')
    })

    it('数组:拼接每个 string 元素', () => {
        expect(ensureMessageString(['a', 'b', 'c'])).toBe('abc')
    })

    it('数组:提取 text/content 字段', () => {
        expect(ensureMessageString([{ text: 'hi' }, { content: ' world' }])).toBe('hi world')
    })

    it('对象:取 text 字段', () => {
        expect(ensureMessageString({ text: 'hello' })).toBe('hello')
    })

    it('对象:无 text 字段取 content', () => {
        expect(ensureMessageString({ content: 'world' })).toBe('world')
    })

    it('对象:text 优先于 content', () => {
        expect(ensureMessageString({ text: 'A', content: 'B' })).toBe('A')
    })

    it('对象:无 text/content 走 JSON.stringify', () => {
        const r = ensureMessageString({ a: 1, b: 2 })
        expect(r).toContain('"a":1')
        expect(r).toContain('"b":2')
    })
})

// =====================================
// looksLikeHtmlCard
// =====================================
describe('looksLikeHtmlCard', () => {
    it('包含 [CARD] 标签视为 HTML 卡片', () => {
        expect(looksLikeHtmlCard('[CARD]xxx[/CARD]')).toBe(true)
    })

    it('包含 type:html 和 html 字段', () => {
        expect(looksLikeHtmlCard('{"type":"html","html":"<div>hi</div>"}')).toBe(true)
    })

    it('包含 <div> 标签', () => {
        expect(looksLikeHtmlCard('<div>hello</div>')).toBe(true)
    })

    it('普通文本返回 false', () => {
        expect(looksLikeHtmlCard('这是一段普通对话')).toBe(false)
    })

    it('null 返回 false', () => {
        expect(looksLikeHtmlCard(null)).toBe(false)
    })
})

// =====================================
// stripCardBlocks
// =====================================
describe('stripCardBlocks', () => {
    it('去除 [CARD]...[/CARD] 块', () => {
        const r = stripCardBlocks('前缀 [CARD]卡片内容[/CARD] 后缀')
        expect(r).toContain('前缀')
        expect(r).toContain('后缀')
        expect(r).not.toContain('卡片内容')
    })

    it('无闭合标签也尽量清理', () => {
        const r = stripCardBlocks('开始 [CARD] 后面全是')
        expect(r.trim()).toBe('开始')
    })

    it('不包含 [CARD] 时原样返回', () => {
        expect(stripCardBlocks('普通文字')).toBe('普通文字')
    })
})

// =====================================
// stripModeWrapperTags
// =====================================
describe('stripModeWrapperTags', () => {
    it('去除 [ONLINE] 标签', () => {
        expect(stripModeWrapperTags('[ONLINE]内容[/ONLINE]')).toBe('内容')
    })

    it('去除 [OFFLINE] 标签', () => {
        expect(stripModeWrapperTags('[OFFLINE]内容[/OFFLINE]')).toBe('内容')
    })

    it('大小写不敏感', () => {
        expect(stripModeWrapperTags('[online]x[/online]')).toBe('x')
    })

    it('混合模式也清理', () => {
        expect(stripModeWrapperTags('[ONLINE]A[/ONLINE][OFFLINE]B[/OFFLINE]')).toBe('AB')
    })
})

// =====================================
// extractTaggedBlock
// =====================================
describe('extractTaggedBlock', () => {
    it('提取 [TAG]...[/TAG] 之间的内容', () => {
        const r = extractTaggedBlock('前缀 [INNER_VOICE]心声内容[/INNER_VOICE] 后缀', 'INNER_VOICE')
        expect(r).toBe('心声内容')
    })

    it('无开始标签返回 null', () => {
        expect(extractTaggedBlock('没有标签的内容', 'INNER_VOICE')).toBeNull()
    })

    it('无结束标签返回开始标签之后的所有内容', () => {
        const r = extractTaggedBlock('[INNER_VOICE]心声没结束', 'INNER_VOICE')
        expect(r).toBe('心声没结束')
    })
})

// =====================================
// looksLikeMojibake
// =====================================
describe('looksLikeMojibake', () => {
    it('正常中文不是乱码', () => {
        expect(looksLikeMojibake('你好世界')).toBe(false)
    })

    it('空字符串不是乱码', () => {
        expect(looksLikeMojibake('')).toBe(false)
    })

    it('纯特殊字符(无中英数)是乱码', () => {
        expect(looksLikeMojibake('¯­‹??')).toBe(true)
    })

    it('有效 JSON 不是乱码', () => {
        expect(looksLikeMojibake('{"key":"value"}')).toBe(false)
    })

    it('损坏的 JSON 是乱码', () => {
        expect(looksLikeMojibake('{"key": broken')).toBe(true)
    })
})

// =====================================
// getMessageThumbnail
// =====================================
describe('getMessageThumbnail', () => {
    it('取前 30 字符加 ...', () => {
        const long = '这是一段很长的消息'.repeat(10)
        const r = getMessageThumbnail({ content: long })
        expect(r.length).toBeGreaterThan(30)
        expect(r.endsWith('...')).toBe(true)
    })

    it('不足 30 字符也加 ...', () => {
        const r = getMessageThumbnail({ content: '短的' })
        expect(r.endsWith('...')).toBe(true)
    })
})

// =====================================
// getModePartitionedContent
// =====================================
describe('getModePartitionedContent', () => {
    it('无标签时 OFFLINE 通过 theater 标记识别', () => {
        const content = '‖一些旁白‖'
        const offline = getModePartitionedContent(content, 'OFFLINE')
        expect(offline).toContain('旁白')
    })

    it('显式 [OFFLINE] 标签正确分区', () => {
        const content = '[OFFLINE]线下内容[/OFFLINE]'
        const offline = getModePartitionedContent(content, 'OFFLINE')
        expect(offline).toContain('线下内容')
    })

    it('OFFLINE 内容不会出现在 ONLINE 分区', () => {
        const content = '[OFFLINE]线下内容[/OFFLINE]'
        const online = getModePartitionedContent(content, 'ONLINE')
        expect(online).not.toContain('线下内容')
    })

    it('空内容返回空字符串', () => {
        expect(getModePartitionedContent('', 'OFFLINE')).toBe('')
    })
})

// =====================================
// hasInnerVoice
// =====================================
describe('hasInnerVoice', () => {
    it('包含 [INNER_VOICE] 标签返回 true', () => {
        expect(hasInnerVoice('[INNER_VOICE]心声[/INNER_VOICE]')).toBe(true)
    })

    it('包含 [INNERVOICE] 标签返回 true', () => {
        expect(hasInnerVoice('[INNERVOICE]心声[/INNERVOICE]')).toBe(true)
    })

    it('包含心声 JSON 字段返回 true', () => {
        expect(hasInnerVoice('{"mood":"开心","着装":"白裙"}')).toBe(true)
    })

    it('普通对话无心声', () => {
        expect(hasInnerVoice('今天天气真好,出去走走吧')).toBe(false)
    })
})

// =====================================
// parseOfflineLine
// =====================================
describe('parseOfflineLine', () => {
    it('旁白 ‖内容‖ 返回 narration', () => {
        const r = parseOfflineLine('‖她轻轻叹了口气‖')
        expect(r?.type).toBe('narration')
        expect(r?.content).toContain('轻轻叹了口气')
    })

    it('【场景】返回 scene', () => {
        const r = parseOfflineLine('【咖啡厅】')
        expect(r?.type).toBe('scene')
        expect(r?.content).toBe('咖啡厅')
    })

    it('(动作)返回 action', () => {
        const r = parseOfflineLine('(微笑着说)')
        expect(r?.type).toBe('action')
        expect(r?.content).toBe('微笑着说')
    })

    it('「角色:对话」返回带 speaker 的 dialogue', () => {
        const r = parseOfflineLine('「小明:你好啊」')
        expect(r?.type).toBe('dialogue')
        expect(r?.speaker).toBe('小明')
        expect(r?.content).toBe('你好啊')
    })

    it('"名字:对话" 形式返回 dialogue', () => {
        const r = parseOfflineLine('小红:今天吃饭了吗')
        expect(r?.type).toBe('dialogue')
        expect(r?.speaker).toBe('小红')
    })

    it('纯双引号对话返回 dialogue', () => {
        const r = parseOfflineLine('"我爱你"')
        expect(r?.type).toBe('dialogue')
    })

    it('空行返回 null', () => {
        expect(parseOfflineLine('')).toBeNull()
        expect(parseOfflineLine('   ')).toBeNull()
    })

    it('动作+对话混合返回 mixed', () => {
        const r = parseOfflineLine('(站起来)我先走了')
        expect(r?.type).toBe('mixed')
        expect(r?.parts).toBeTruthy()
    })
})
