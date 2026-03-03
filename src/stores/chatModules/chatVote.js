export const setupVoteLogic = (chats, addMessage, updateMessage, saveChats) => {
    /**
     * Create a new vote message
     * @param {string} chatId 
     * @param {object} voteData { title, options, isMultiple, isAnonymous, creatorId, creatorName }
     */
    function createVote(chatId, voteData) {
        const voteId = 'v-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)
        const msg = {
            role: voteData.role || 'user',
            type: 'vote',
            content: JSON.stringify({
                id: voteId,
                title: voteData.title || '群投票',
                options: voteData.options || [],
                isMultiple: !!voteData.isMultiple,
                isAnonymous: !!voteData.isAnonymous,
                deadline: voteData.deadline || null, // Timestamp
                isEnded: false,
                creatorId: voteData.creatorId || 'user',
                creatorName: voteData.creatorName || '管理员',
                votes: {}, // userId -> [optionIdx1, optionIdx2, ...]
                createdAt: Date.now()
            })
        }
        return addMessage(chatId, msg)
    }

    /**
     * End a vote early or as scheduled
     */
    function endVote(chatId, msgId) {
        const chat = chats.value[chatId]
        if (!chat) return
        const msg = chat.msgs.find(m => m.id === msgId)
        if (!msg || msg.type !== 'vote') return

        let voteData = {}
        try {
            voteData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
        } catch (e) {
            return
        }

        if (voteData.isEnded) return

        voteData.isEnded = true
        voteData.endedAt = Date.now()

        updateMessage(chatId, msgId, { content: JSON.stringify(voteData) })
        saveChats()

        // Post a result card message
        addMessage(chatId, {
            role: 'system',
            type: 'vote_result',
            content: JSON.stringify({
                refId: msgId,
                title: voteData.title,
                votes: voteData.votes || {},
                options: voteData.options || [],
                creatorId: voteData.creatorId,
                isAnonymous: voteData.isAnonymous,
                endedAt: voteData.endedAt
            })
        })
    }

    /**
     * Cast or update a vote
     */
    function castVote(chatId, msgId, userId, optionIndices) {
        const chat = chats.value[chatId]
        if (!chat) return
        const msg = chat.msgs.find(m => m.id === msgId)
        if (!msg || msg.type !== 'vote') return

        let voteData = {}
        try {
            voteData = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
        } catch (e) {
            console.error('[VoteLogic] Parse error', e)
            return
        }

        // Apply vote (replace existing vote for this user)
        if (optionIndices.length === 0) {
            delete voteData.votes[userId]
        } else {
            voteData.votes[userId] = optionIndices
        }

        // Update message content
        updateMessage(chatId, msgId, { content: JSON.stringify(voteData) })
        saveChats()
    }

    return {
        createVote,
        castVote,
        endVote
    }
}
