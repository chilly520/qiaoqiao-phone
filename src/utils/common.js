/**
 * 公共数据处理工具
 * 统一项目中重复定义的小工具函数
 */

/**
 * 将任意类型的值安全转换为字符串
 * 处理字符串、字符串数组、对象（含 text/content 字段）等情况
 *
 * @param {*} val - 输入值
 * @returns {string} 转换后的字符串
 */
export function ensureString(val) {
    if (val == null) return ''
    if (typeof val === 'string') return val
    if (Array.isArray(val)) {
        return val.map(part => {
            if (typeof part === 'string') return part
            if (part && typeof part === 'object') {
                return part.text || part.content || ''
            }
            return ''
        }).join('')
    }
    if (val && typeof val === 'object') {
        if (val.text) return String(val.text)
        if (val.content) return String(val.content)
        try {
            return JSON.stringify(val)
        } catch (e) {
            return '[Object]'
        }
    }
    return String(val)
}

/**
 * 头像列表默认值
 */
export const DEFAULT_AVATARS = [
    '/avatars/小猫举爪.jpg',
    '/avatars/小猫吃芒果.jpg',
    '/avatars/小猫吃草莓.jpg',
    '/avatars/小猫喝茶.jpg',
    '/avatars/小猫坏笑.jpg',
    '/avatars/小猫开心.jpg',
    '/avatars/小猫挥手.jpg',
    '/avatars/小猫星星眼.jpg',
    '/avatars/小猫犯困.jpg'
]

/**
 * 随机获取一个默认头像
 */
export function getRandomAvatar() {
    return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]
}
