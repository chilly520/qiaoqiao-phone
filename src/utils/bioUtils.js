// Bio Update Detection Utility
// Place this in chatStore.js or aiService.js

/**
 * Detect and process [BIO_UPDATE:...] commands in AI responses
 * @param {string} text - AI response text
 * @param {string} charId - Character ID (or 'user')
 * @returns {string} - Cleaned text without bio update command
 */
export function processBioUpdate(text, charId) {
    const bioUpdateRegex = /\[BIO_UPDATE:([^\]]+)\]/g
    let match
    let cleanedText = text

    while ((match = bioUpdateRegex.exec(text)) !== null) {
        const newBio = match[1].trim()

        // Update localStorage
        localStorage.setItem(`char_bio_${charId}`, newBio)

        // [BUG FIX] 移除死代码 contextMsg: 原代码声明了 contextMsg + timestamp,
        // 但唯一消费者 `chatStore.addSystemMessage(contextMsg)` 是注释掉的, 且本文件
        // 没有 chatStore 注入, 即使取消注释也会 ReferenceError. 这段代码每条 BIO_UPDATE
        // 都白白构造一个字符串 + 一次 Date.toLocaleString, 纯死代码, 直接删除.
        // (如果未来需要在聊天里记录 bio 变更, 应由调用方 (chatStore) 在调用本函数后
        // 自行 addSystemMessage, 而不是在这里隐式副作用.)

        // Remove the command from display text
        // [BUG FIX] replace → replaceAll, 同 taskUtils.js 的 BUG 7.3 修复理由:
        // 多次重复的 [BIO_UPDATE:...] 命令只清掉第一处.
        cleanedText = cleanedText.replaceAll(match[0], '')

        console.log('[Bio Update]', charId, '->', newBio)
    }

    return cleanedText.trim()
}

/**
 * Get bio context for chat system prompts
 * @param {string} charId - Character ID  
 * @param {boolean} includeUser - Whether to include user bio
 * @returns {string} - Bio context text
 */
export function getBioContext(charId, includeUser = true) {
    let context = ''
    
    // Character's own bio
    const charBio = localStorage.getItem(`char_bio_${charId}`) || ''
    if (charBio) {
        context += `\n你的个性签名：${charBio}`
    } else {
        context += `\n你的个性签名：(暂无)`
    }
    
    // User's bio
    if (includeUser) {
        const userBio = localStorage.getItem('char_bio_user') || ''
        if (userBio) {
            context += `\n用户的个性签名：${userBio}`
        }
    }
    
    // Add bio modification capability for the character
    context += '\n\n[功能提示：如果你想修改自己的个性签名，可以在回复中使用格式 [BIO_UPDATE:新签名内容]，系统会自动为你更新]'
    
    return context
}

// Usage in chatStore.js:
// 
// When processing AI response (AI is the character with charId):
// const cleanedResponse = processBioUpdate(aiResponse, charId)  // charId = 角色ID
// addMessage(chatId, { role: 'assistant', content: cleanedResponse })
//
// When building system prompt for chat:
// const bioContext = getBioContext(chatId)  // chatId = 角色ID
// const systemPrompt = `${characterPrompt}${bioContext}\n\n${otherInstructions}`
//
// Example conversation:
// 用户: "你改一下你的个性签名吧，写成'快乐生活，认真工作'"
// AI(林深): "好的！[BIO_UPDATE:快乐生活，认真工作]我的个性签名已经更新了"
// 系统自动: 更新 localStorage.char_bio_林深Id = "快乐生活，认真工作"
// 用户看到: "好的！我的个性签名已经更新了"
