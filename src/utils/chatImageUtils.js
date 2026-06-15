/**
 * Chat 相关的工具函数
 * 提取自 chatStore.js，降低主 Store 的复杂度
 */

/**
 * 压缩所有聊天和朋友圈中的图片
 * @param {Object} chats - 聊天对象集合（响应式）
 * @param {Function} saveChats - 保存聊天数据的函数
 * @returns {Promise<number>} 压缩的图片数量
 */
export async function compressAllChatImages(chats, saveChats) {
    console.log('[ChatImageUtils] Starting bulk image compression for all chats and moments...')
    const { compressImage } = await import('./imageUtils')
    let totalProcessed = 0
    let totalCompressed = 0

    // 1. 压缩聊天消息中的图片
    for (const chat of Object.values(chats.value || chats)) {
        if (!chat.msgs) continue
        for (const msg of chat.msgs) {
            // Case 1: type=image with base64
            if (msg.type === 'image' && msg.content && msg.content.startsWith('data:image')) {
                try {
                    const originalSize = msg.content.length
                    // Skip if already small (< 100KB)
                    if (originalSize < 100 * 1024) continue

                    // Convert base64 to File-like
                    const res = await fetch(msg.content)
                    const blob = await res.blob()
                    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })

                    const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.6 })
                    if (compressed.length < originalSize) {
                        msg.content = compressed
                        totalCompressed++
                    }
                } catch (e) {
                    console.warn('[ChatImageUtils] Bulk compression failed for message:', msg.id, e)
                }
            }
            totalProcessed++
            // Yield to main thread
            if (totalProcessed % 50 === 0) await new Promise(r => setTimeout(r, 0))
        }
    }

    // 2. 压缩朋友圈图片
    try {
        const momentsStore = (await import('../stores/momentsStore')).useMomentsStore()
        for (const moment of (momentsStore.moments || [])) {
            if (moment.images && Array.isArray(moment.images)) {
                for (let i = 0; i < moment.images.length; i++) {
                    const img = moment.images[i]
                    if (typeof img === 'string' && img.startsWith('data:image') && img.length > 100 * 1024) {
                        try {
                            const originalSize = img.length
                            const res = await fetch(img)
                            const blob = await res.blob()
                            const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
                            const compressed = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.6 })
                            if (compressed.length < originalSize) {
                                moment.images[i] = compressed
                                totalCompressed++
                            }
                        } catch (err) {
                            // ignore single image failure
                        }
                    }
                }
            }
        }
        await momentsStore.saveMoments?.()
    } catch (momentErr) {
        console.error('[ChatImageUtils] Moment compression failed:', momentErr)
    }

    console.log(`[ChatImageUtils] Bulk compression finished. Compressed ${totalCompressed} images.`)
    if (typeof saveChats === 'function') {
        await saveChats(true)
    }
    return totalCompressed
}

/**
 * 从 LS_JSON payload 中提取具体操作类型，用于生成精确的系统提示
 * @param {string} payload - JSON 字符串
 * @returns {string[]} 操作描述列表
 */
export function extractLSActions(payload) {
    const actions = []
    if (!payload || typeof payload !== 'string') return actions
    try {
        const parsed = JSON.parse(payload)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
            if (!item || typeof item !== 'object') continue
            const typeMap = {
                diary: '写了一篇日记',
                footprint: '更新了足迹',
                message: '留了一条言',
                gacha: '抽了一个扭蛋',
                letter: '写了一封信',
                question: '发了一个问题',
                answer: '回答了一个问题',
                letterComment: '评论了信件',
                albumComment: '评论了相册',
                diaryComment: '评论了日记',
                sticky: '写了一张便利贴',
                anniversary: '记录了一个纪念日',
                album: '上传了一张照片',
                house: '布置了小屋',
                schedule: '添加了一个日程',
                bind: '开通了情侣空间'
            }
            const action = typeMap[item.type] || item.type
            if (action) actions.push(action)
        }
    } catch {
        /* 非 JSON 或解析失败，返回空数组 */
    }
    return actions
}
