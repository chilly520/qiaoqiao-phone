import { useSettingsStore } from '../settingsStore'
import { generateReply, generateImage } from '../../utils/aiService'
import { GROUP_MEMBER_GENERATOR_PROMPT } from '../../utils/ai/prompts'

export const setupGroupLogic = (chats, createChat, addMessage, saveChats, getRandomAvatar, sendMessageToAI, _extractJsonFromText) => {

    function _deriveGroupNoFromChatId(chatId) {
        if (!chatId) return `G${Date.now()}`
        const digits = String(chatId).replace(/\D/g, '').slice(-8)
        return digits ? `G${digits}` : `G${Date.now().toString().slice(-8)}`
    }

    function _ensureGroupDefaults(chatId) {
        const c = chats.value[chatId]
        if (!c) return

        if (c.isGroup === undefined) c.isGroup = false
        if (!Array.isArray(c.participants)) c.participants = []

        if (c.isGroup) {
            if (!c.groupProfile || typeof c.groupProfile !== 'object') {
                c.groupProfile = {
                    avatar: c.avatar || getRandomAvatar(),
                    name: c.name || '未命名群聊',
                    groupNo: _deriveGroupNoFromChatId(chatId),
                    announcement: '',
                    announcements: []
                }
            } else {
                if (!c.groupProfile.avatar) c.groupProfile.avatar = c.avatar || getRandomAvatar()
                if (!c.groupProfile.name) c.groupProfile.name = c.name || '未命名群聊'
                if (!c.groupProfile.groupNo) c.groupProfile.groupNo = _deriveGroupNoFromChatId(chatId)
                if (c.groupProfile.announcement === undefined) c.groupProfile.announcement = ''
                if (!Array.isArray(c.groupProfile.announcements)) c.groupProfile.announcements = []
            }

            if (!c.groupSettings || typeof c.groupSettings !== 'object') {
                c.groupSettings = {
                    myPersona: c.userPersona || '',
                    myNickname: '',
                    myRole: 'owner', // Default to owner for created groups
                    myCustomTitle: '',
                    myActivity: 0,
                    myDailyActivity: 0,
                    lastDailyReset: 0,
                    levelTitles: ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说'],
                    muteUntil: 0,
                    groupPrompt: '',
                    worldBookLinks: Array.isArray(c.worldBookLinks) ? c.worldBookLinks : [],
                    timeAware: c.timeAware !== false,
                    allowInvite: true, // Whether members can invite
                    autoInvite: false, // Whether AI can invite
                    welcomeMessage: '',
                    proactive: { enabled: false, intervalMinutes: 60 },
                    memory: {
                        contextMemoryCount: c.contextLimit || 20,
                        contextDisplayCount: 50,
                        autoSummaryEvery: 30
                    },
                    pat: { enabled: true, action: c.patAction || '', suffix: c.patSuffix || '' },
                    bubbleBg: {
                        preset: 'default',
                        blur: 0,
                        opacity: 1,
                        theme: 'light'
                    }
                }
            } else {
                if (c.groupSettings.myPersona === undefined) c.groupSettings.myPersona = c.userPersona || ''
                if (c.groupSettings.myNickname === undefined) c.groupSettings.myNickname = ''
                if (c.groupSettings.myRole === undefined) c.groupSettings.myRole = 'owner'
                if (c.groupSettings.myCustomTitle === undefined) c.groupSettings.myCustomTitle = ''
                if (c.groupSettings.myActivity === undefined) c.groupSettings.myActivity = 0
                if (c.groupSettings.myDailyActivity === undefined) c.groupSettings.myDailyActivity = 0
                if (c.groupSettings.lastDailyReset === undefined) c.groupSettings.lastDailyReset = 0
                if (!Array.isArray(c.groupSettings.levelTitles)) c.groupSettings.levelTitles = ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说']
                if (c.groupSettings.muteUntil === undefined) c.groupSettings.muteUntil = 0
                if (c.groupSettings.groupPrompt === undefined) c.groupSettings.groupPrompt = ''
                if (!Array.isArray(c.groupSettings.worldBookLinks)) c.groupSettings.worldBookLinks = Array.isArray(c.worldBookLinks) ? c.worldBookLinks : []
                if (c.groupSettings.timeAware === undefined) c.groupSettings.timeAware = c.timeAware !== false
                if (c.groupSettings.allowInvite === undefined) c.groupSettings.allowInvite = true
                if (c.groupSettings.autoInvite === undefined) c.groupSettings.autoInvite = false
                if (c.groupSettings.welcomeMessage === undefined) c.groupSettings.welcomeMessage = ''
                if (!c.groupSettings.proactive) c.groupSettings.proactive = { enabled: false, intervalMinutes: 60 }
                if (!c.groupSettings.memory) {
                    c.groupSettings.memory = {
                        contextMemoryCount: c.contextLimit || 20,
                        contextDisplayCount: 50,
                        autoSummaryEvery: 30
                    }
                } else {
                    if (c.groupSettings.memory.contextMemoryCount === undefined) c.groupSettings.memory.contextMemoryCount = c.contextLimit || 20
                    if (c.groupSettings.memory.contextDisplayCount === undefined) c.groupSettings.memory.contextDisplayCount = 50
                    if (c.groupSettings.memory.autoSummaryEvery === undefined) c.groupSettings.memory.autoSummaryEvery = 30
                }
                if (!c.groupSettings.pat) c.groupSettings.pat = { enabled: true, action: c.patAction || '', suffix: c.patSuffix || '' }
                if (!c.groupSettings.bubbleBg) c.groupSettings.bubbleBg = { preset: 'default', blur: 0, opacity: 1, theme: 'light' }
            }

            // Ensure participants have basic role structure
            if (Array.isArray(c.participants)) {
                c.participants.forEach(p => {
                    if (p.role === undefined) p.role = 'member'
                    if (p.customTitle === undefined) p.customTitle = ''
                    if (p.nickname === undefined) p.nickname = ''
                    if (p.muteUntil === undefined) p.muteUntil = 0
                    if (p.activity === undefined) p.activity = 0
                    if (p.dailyActivity === undefined) p.dailyActivity = 0
                })
            }

            // Keep list display in sync
            c.name = c.groupProfile.name
            c.avatar = c.groupProfile.avatar

            // Apply backward logic to outer model for AI visibility
            c.userPersona = c.groupSettings.myPersona
            c.worldBookLinks = c.groupSettings.worldBookLinks
            c.timeAware = c.groupSettings.timeAware
            c.contextLimit = c.groupSettings.memory.contextMemoryCount
            c.proactiveChat = c.groupSettings.proactive.enabled
            c.proactiveInterval = c.groupSettings.proactive.intervalMinutes
            c.autoSummary = !!c.groupSettings.autoSummary
            c.summaryLimit = parseInt(c.groupSettings.memory.autoSummaryEvery) || 30
        }
    }

    function createGroupChat(payload = {}) {
        const name = payload.name || '未命名群聊'
        const avatar = payload.avatar || getRandomAvatar()
        const tempId = payload.id // optional
        const ownerId = payload.ownerId || 'user'

        // Check if chat with this ID already exists to prevent duplicates
        if (tempId && chats.value[tempId]) {
            return chats.value[tempId]
        }

        const participants = Array.isArray(payload.participants) ? [...payload.participants] : []
        const settingsStore = useSettingsStore()

        // Ensure user is included
        if (!participants.some(p => p.id === 'user')) {
            participants.unshift({
                id: 'user',
                name: settingsStore.personalization?.userProfile?.name || '我',
                avatar: settingsStore.personalization?.userProfile?.avatar || getRandomAvatar(),
                role: ownerId === 'user' ? 'owner' : 'member'
            })
        }

        // Apply owner role to specified ID
        participants.forEach(p => {
            if (p.id === ownerId) p.role = 'owner'
            else if (p.role === 'owner' && p.id !== ownerId) p.role = 'admin' // Downgrade other owners if any
        })

        const chat = createChat(name, {
            id: tempId,
            avatar,
            isGroup: true,
            participants,
            groupProfile: payload.groupProfile || {
                avatar,
                name,
                groupNo: payload.groupNo || _deriveGroupNoFromChatId(tempId || ''),
                announcement: payload.announcement || ''
            },
            groupSettings: payload.groupSettings || {
                myRole: ownerId === 'user' ? 'owner' : 'member',
                myCustomTitle: '',
                myActivity: 0,
                levelTitles: ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说']
            }
        })

        _ensureGroupDefaults(chat.id)
        saveChats()
        return chat
    }

    function updateGroupProfile(chatId, patch = {}) {
        const chat = chats.value[chatId]
        if (!chat) return false
        chat.isGroup = true
        _ensureGroupDefaults(chatId)
        chat.groupProfile = { ...(chat.groupProfile || {}), ...(patch || {}) }
        if (chat.groupProfile?.name) chat.name = chat.groupProfile.name
        if (chat.groupProfile?.avatar) chat.avatar = chat.groupProfile.avatar
        saveChats()
        return true
    }

    function updateGroupSettings(chatId, patch = {}) {
        const chat = chats.value[chatId]
        if (!chat) return false
        chat.isGroup = true
        _ensureGroupDefaults(chatId)
        chat.groupSettings = { ...(chat.groupSettings || {}), ...(patch || {}) }
        // lightweight sync for AI service compatibility
        if (chat.groupSettings?.myPersona !== undefined) chat.userPersona = chat.groupSettings.myPersona
        if (Array.isArray(chat.groupSettings?.worldBookLinks)) chat.worldBookLinks = chat.groupSettings.worldBookLinks
        if (chat.groupSettings?.timeAware !== undefined) chat.timeAware = chat.groupSettings.timeAware
        if (chat.groupSettings?.memory?.contextMemoryCount !== undefined) chat.contextLimit = chat.groupSettings.memory.contextMemoryCount
        if (chat.groupSettings?.memory?.autoSummaryEvery !== undefined) {
            const n = parseInt(chat.groupSettings.memory.autoSummaryEvery) || 0
            if (n > 0) {
                chat.autoSummary = true
                chat.summaryLimit = n
            }
        }
        if (chat.groupSettings?.proactive?.enabled !== undefined) {
            chat.proactiveChat = !!chat.groupSettings.proactive.enabled
        }
        if (chat.groupSettings?.proactive?.intervalMinutes !== undefined) {
            chat.proactiveInterval = parseInt(chat.groupSettings.proactive.intervalMinutes) || 60
        }
        saveChats()
        return true
    }

    function updateGroupParticipants(chatId, participants = []) {
        const chat = chats.value[chatId]
        if (!chat) return false
        chat.isGroup = true
        _ensureGroupDefaults(chatId)
        chat.participants = Array.isArray(participants) ? participants : []
        saveChats()
        return true
    }

    async function generateGroupMembers(requirement, options = {}) {
        const count = Math.max(1, Math.min(50, Number(options.count || 6)))
        const groupTheme = String(options.groupTheme || '').trim()

        const system = GROUP_MEMBER_GENERATOR_PROMPT(count, groupTheme, requirement)

        const dummyChar = {
            id: 'group-generator',
            name: '群成员生成器',
            userName: '用户',
            userPersona: '',
            avatar: '',
            bio: {}
        }

        const resp = await generateReply(
            [
                { role: 'system', content: system },
                { role: 'user', content: String(requirement || '').trim() || '生成一组有趣的群聊成员。' }
            ],
            dummyChar,
            null,
            { stream: false, skipProcessing: true }
        )

        const text = resp?.content || (resp?.choices && resp.choices[0]?.message?.content) || ''
        const jsonStr = _extractJsonFromText(text)
        if (!jsonStr) return { error: 'AI 未返回可解析的 JSON', raw: text }
        try {
            let parsed = JSON.parse(jsonStr)

            // Normalize to array
            if (!Array.isArray(parsed) && typeof parsed === 'object') {
                if (Array.isArray(parsed.members)) parsed = parsed.members
                else if (Array.isArray(parsed.data)) parsed = parsed.data
                else if (Array.isArray(parsed.characters)) parsed = parsed.characters
                else parsed = [parsed]
            }

            if (!Array.isArray(parsed)) return { error: 'AI 返回的 JSON 非法', raw: text }

            // Final normalization and ASYNC IMAGE GENERATION
            const normalized = parsed.map((p, idx) => {
                const seed = encodeURIComponent((p?.name || `Member${idx + 1}`).toString().replace(/\s+/g, ''))
                return {
                    id: String(p?.id || `p-${Date.now()}-${idx}`),
                    name: String(p?.name || `成员${idx + 1}`),
                    avatar: String(p?.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}`),
                    avatar_prompt: String(p?.avatar_prompt || ''),
                    roleId: p?.roleId || null,
                    isOwner: !!p?.isOwner,
                    isAdmin: !!p?.isAdmin,
                    isNPC: true, // Required so they show up in the contact list
                    prompt: String(p?.prompt || ''),
                    bio: {
                        gender: p?.bio?.gender || '未知',
                        age: p?.bio?.age || '未知',
                        mbti: p?.bio?.mbti || '未知',
                        traits: Array.isArray(p?.bio?.traits) ? p.bio.traits : [],
                        hobbies: Array.isArray(p?.bio?.hobbies) ? p.bio.hobbies : [],
                        signature: p?.bio?.signature || ''
                    }
                }
            })

            // Run image generation in background but await final result
            console.log(`[Batch Generator] Drawing avatars for ${normalized.length} members...`)
            await Promise.all(normalized.map(async (m) => {
                if (m.avatar_prompt && m.avatar_prompt.length > 5) {
                    try {
                        // Use the internal generateImage function
                        const imgUrl = await generateImage(m.avatar_prompt)
                        if (imgUrl) {
                            m.avatar = imgUrl
                            console.log(`[Batch Generator] Successfully drew avatar for ${m.name}`)
                        }
                    } catch (err) {
                        console.warn(`[Batch Generator] Avatar draw failed for ${m.name}, keeping placeholder.`, err)
                    }
                }
            }))

            return { members: normalized, raw: text }
        } catch (e) {
            return { error: 'AI JSON 解析失败', raw: text }
        }
    }

    function transferGroupOwner(chatId, newOwnerId) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        if (!chat.isGroup) return

        // Reset current roles
        if (chat.groupSettings.myRole === 'owner') chat.groupSettings.myRole = 'member'
        chat.participants.forEach(p => {
            if (p.role === 'owner') p.role = 'member'
        })

        // Assign new owner
        if (newOwnerId === 'user') {
            chat.groupSettings.myRole = 'owner'
        } else {
            const p = chat.participants.find(p => p.id === newOwnerId)
            if (p) p.role = 'owner'
        }
        saveChats()
    }

    function setParticipantRole(chatId, participantId, role) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        if (participantId === 'user') {
            chat.groupSettings.myRole = role
        } else {
            const p = chat.participants.find(p => p.id === participantId)
            if (p) p.role = role
        }
        saveChats()
    }

    function setParticipantTitle(chatId, participantId, title) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        if (participantId === 'user') {
            chat.groupSettings.myCustomTitle = title
        } else {
            const p = chat.participants.find(p => p.id === participantId)
            if (p) p.customTitle = title
        }
        saveChats()
    }

    function muteParticipant(chatId, participantId, minutes) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        const until = minutes > 0 ? Date.now() + minutes * 60000 : 0
        if (participantId === 'user') {
            chat.groupSettings.muteUntil = until
        } else {
            const p = chat.participants.find(p => p.id === participantId)
            if (p) p.muteUntil = until
        }
        saveChats()
    }

    function exitGroup(chatId) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        if (!chat.isGroup) return

        const oldRole = chat.groupSettings?.myRole

        // 1. Add system message
        const settingsStore = useSettingsStore()
        const userName = chat.groupSettings?.myNickname || settingsStore.personalization?.userProfile?.name || '用户'
        addMessage(chatId, {
            role: 'system',
            content: `${userName}退出了该群聊`,
            type: 'system'
        })

        // 2. Transfer ownership if was owner
        if (oldRole === 'owner') {
            // Find first admin or first member (EXCLUDING user)
            const otherParticipants = (chat.participants || []).filter(p => p.id !== 'user')
            const nextOwner = otherParticipants.find(p => p.role === 'admin') || otherParticipants[0]
            if (nextOwner) {
                transferGroupOwner(chatId, nextOwner.id)
            }
        }

        // 3. Trigger AI reaction
        sendMessageToAI(chatId)

        // 4. Set exited flag
        chat.isExited = true
        if (!chat.groupSettings) chat.groupSettings = {}
        chat.groupSettings.myRole = 'exited'

        saveChats()
    }

    function dissolveGroup(chatId) {
        if (!chats.value[chatId]) return
        const chat = chats.value[chatId]
        if (!chat.isGroup) return

        addMessage(chatId, {
            role: 'system',
            content: `该群聊已被解散`,
            type: 'system'
        })

        chat.isDissolved = true
        chat.inChatList = false
        chat.isArchived = true

        saveChats()
    }


    return {
        createGroupChat,
        updateGroupProfile,
        updateGroupSettings,
        updateGroupParticipants,
        generateGroupMembers,
        transferGroupOwner,
        setParticipantRole,
        setParticipantTitle,
        muteParticipant,
        exitGroup,
        dissolveGroup,
        _ensureGroupDefaults,
        _deriveGroupNoFromChatId
    }
}



