import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useMomentsStore } from './momentsStore'
import { generateImage } from '../utils/aiService'

const loopDB = localforage.createInstance({
    name: 'qiaoqiao-phone',
    storeName: 'world_loops'
})

/**
 * 世界圈 (World Loop) Store
 *
 * 设计原则:
 * - 世界圈有自己的独立数据模型 (loops),不与 chat 共享字段
 * - 世界圈关联的"载体聊天"通过 chat.loopId 字段关联,不在 chat 上加 isGroup 标签
 * - 这样世界圈和群聊的数据模型完全隔离,互不污染
 * - NPC 成员由世界圈独立管理 (loop.participants),不再写入 chat.participants
 */
export const useWorldLoopStore = defineStore('worldLoop', () => {
    const loops = ref({})
    const activeLoopId = ref(null)
    const isLoading = ref(false)

    // --- Core State ---
    const activeLoop = computed(() => loops.value[activeLoopId.value] || null)

    async function initStore() {
        const savedLoops = await loopDB.getItem('all_loops')
        if (savedLoops) {
            loops.value = savedLoops
        }
        console.log(`[WorldLoop] initStore loaded ${Object.keys(loops.value).length} loops`)
    }

    async function saveLoops() {
        await loopDB.setItem('all_loops', JSON.parse(JSON.stringify(loops.value)))
    }

    // --- Actions ---

    /**
     * 创建世界圈
     * 重要: 不在 chat 上设 isGroup = true,避免与群聊系统冲突
     */
    async function createLoop(name, description, initialParticipants = []) {
        const loopId = 'loop-' + Date.now()

        loops.value[loopId] = {
            id: loopId,
            name: name,
            description: description,
            createdAt: Date.now(),
            participants: Array.isArray(initialParticipants) ? [...initialParticipants] : [],
            currentMode: 'online', // 'online' (WeChat style) or 'offline' (Visual Novel style)
            userRole: '', // User's persona/identity in this world
            currentScene: {
                image: '',
                description: '初始场景',
                timestamp: Date.now()
            },
            history: [],
            summaryHistory: [],
            config: {
                contextLimit: 20,
                autoSummaryInterval: 50,
                aiStyle: '文学写实',
                conflictLevel: 0.5,
                bondStrength: 0.5,
                atmosphere: '明亮'
            },
            systemPrompt: `你是一个剧本杀/RPG游戏的GM。当前世界名称:${name}。背景:${description}`
        }

        await saveLoops()
        console.log(`[WorldLoop] Created loop: ${name} (${loopId})`)
        return loops.value[loopId]
    }

    /**
     * 添加 NPC 到世界圈
     * - 如果 npcData 有 id,则认为是已有 chat
     * - 否则创建新 chat
     * - 自动生成头像 (如果 useAIHead)
     * - 关键: 标记 belongToLoop 用于通讯录显示,但不污染 chat.isGroup 字段
     */
    async function addNPCToLoop(loopId, npcData) {
        const chatStore = useChatStore()
        const loop = loops.value[loopId]
        if (!loop) return null

        let charId = npcData.id
        if (!charId) {
            const newChar = chatStore.createChat(npcData.name, {
                prompt: npcData.prompt || '一个有趣的NPC',
                gender: npcData.gender || '未知'
            })
            charId = newChar.id

            // Auto generate avatar if requested
            if (npcData.useAIHead) {
                try {
                    const prompt = `A profile picture for a character named ${npcData.name}. ${npcData.prompt || ''} Anime style, high quality.`
                    const imageUrl = await generateImage(prompt, { chatId: charId, isCharacter: true, appearanceRef: true })
                    chatStore.updateCharacter(charId, { avatar: imageUrl })
                } catch (e) {
                    console.error('[WorldLoop] Failed to generate AI Avatar', e)
                }
            }
        }

        // Link to Loop (去重) - 仅设置 belongToLoop 字段,用于通讯录显示
        // 不修改 isGroup 字段,确保与群聊数据隔离
        if (!loop.participants.includes(charId)) {
            loop.participants.push(charId)
            await saveLoops()
        }
        // 标记 NPC 归属世界圈 (仅影响通讯录 NPC 列表显示)
        if (chatStore.chats[charId]) {
            chatStore.updateCharacter(charId, { belongToLoop: loopId })
        }

        return charId
    }

    /**
     * AI 召唤新成员
     * 一键生成人设、头像并加入世界圈
     */
    async function summonMember(loopId, theme) {
        const loop = loops.value[loopId]
        if (!loop) return null

        isLoading.value = true
        try {
            const { generateCharacterPersona, generateImage, generateCompleteProfile } = await import('../utils/aiService.js')

            // 1. Generate Persona
            const persona = await generateCharacterPersona(theme, loop.description)
            console.log(`[WorldLoop] Summoning: ${persona.name}`, persona)

            // 2. Create Chat/Character
            const chatStore = useChatStore()
            const newChar = chatStore.createChat(persona.name, {
                gender: persona.gender,
                prompt: persona.prompt,
                description: `${persona.identity || ''}. ${persona.personality || ''}`.trim()
            })
            const charId = newChar.id

            // 3. Generate Visuals & Profile (Background, Pinned moments)
            try {
                // Generate Avatar first
                const avatarUrl = await generateImage(`${persona.appearance}, anime style, masterpiece, high quality, profile picture`, { chatId: charId, isCharacter: true, appearanceRef: true })
                chatStore.updateCharacter(charId, { avatar: avatarUrl })

                // Generate full profile (Async, don't block)
                const momentsStore = useMomentsStore()
                generateCompleteProfile(newChar, useSettingsStore().personalization?.userProfile)
                    .then(profile => {
                        console.log('[WorldLoop] Full profile generated:', profile)
                        // 1. Update character metadata
                        chatStore.updateCharacter(charId, {
                            statusText: profile.signature || profile.bio,
                            momentsBackground: profile.backgroundUrl,
                            bio: {
                                ...(newChar.bio || {}),
                                ...(profile.bioFields || {})
                            }
                        })

                        // 2. Inject initial moments
                        const initialMoments = profile.pinnedMoments || profile.moments || []
                        if (initialMoments.length > 0) {
                            initialMoments.forEach(async m => {
                                await momentsStore.addMoment({
                                    authorId: charId,
                                    content: m.content,
                                    images: m.images || [],
                                    imageDescriptions: m.imageDescriptions || [],
                                    mentions: m.mentions || [],
                                    interactions: m.interactions || [],
                                    visibility: 'public'
                                }, { skipAutoInteraction: true })
                            })
                        }
                    })
            } catch (e) {
                console.error('[WorldLoop] Visual generation failed', e)
            }

            // 4. Add to Loop
            await addNPCToLoop(loopId, { id: charId, name: persona.name })

            return charId
        } finally {
            isLoading.value = false
        }
    }

    function setActiveLoop(id) {
        activeLoopId.value = id
    }

    function toggleMode(loopId) {
        const loop = loops.value[loopId]
        if (loop) {
            loop.currentMode = loop.currentMode === 'online' ? 'offline' : 'online'
            saveLoops()
        }
    }

    function updateLoop(id, data) {
        if (loops.value[id]) {
            // [BUG FIX] 保留对原 loop 对象的引用, 直接 mutate, 避免外部引用失效
            Object.assign(loops.value[id], data)
            saveLoops()
        }
    }

    function removeNPCFromLoop(loopId, charId) {
        const loop = loops.value[loopId]
        if (loop && loop.participants) {
            loop.participants = loop.participants.filter(id => id !== charId)
            // 清理 NPC 归属标记
            const chatStore = useChatStore()
            if (chatStore.chats[charId] && chatStore.chats[charId].belongToLoop === loopId) {
                chatStore.updateCharacter(charId, { belongToLoop: null })
            }
            saveLoops()
        }
    }

    /**
     * 删除整个世界圈
     * - 不删除关联 chat (用户可能还想保留 NPC 角色)
     * - 不删除 NPC 角色 chat (同上)
     * - 仅清除 loop 本体数据
     */
    async function deleteLoop(loopId) {
        if (!loops.value[loopId]) return false
        delete loops.value[loopId]
        if (activeLoopId.value === loopId) {
            activeLoopId.value = null
        }
        await saveLoops()
        console.log(`[WorldLoop] Deleted loop: ${loopId}`)
        return true
    }

    /**
     * 生成世界线总结
     * 基于载体聊天的对话记录
     */
    async function generateWorldSummary(loopId, chatId) {
        const chatStore = useChatStore()
        const loop = loops.value[loopId]
        if (!loop) return null

        isLoading.value = true
        try {
            // Use the chat ID (not loopId) for summarizeHistory
            const targetChatId = chatId || chatStore.contactList.find(c => c.loopId === loopId)?.id
            if (!targetChatId) {
                throw new Error('找不到世界圈关联的聊天')
            }

            const result = await chatStore.summarizeHistory(targetChatId, {
                silent: false,
                summaryPrompt: '你现在是上帝/GM,请基于上述对话记录,写一段"世界线总结"。重点记录剧情发生了哪些重大转折、角色的阵营变化、当前的地理位置以及接下来的潜在冲突点。字数控制在200字以内。'
            })

            if (result.success) {
                const latestMemory = chatStore.chats[targetChatId]?.summary || ''
                if (latestMemory) {
                    if (!loop.summaryHistory) loop.summaryHistory = []
                    loop.summaryHistory.push({
                        timestamp: Date.now(),
                        content: latestMemory
                    })
                    await saveLoops()
                    return latestMemory
                }
            }
            throw new Error(result.error || '总结生成失败')
        } finally {
            isLoading.value = false
        }
    }

    return {
        loops,
        activeLoopId,
        activeLoop,
        isLoading,
        initStore,
        createLoop,
        addNPCToLoop,
        summonMember,
        removeNPCFromLoop,
        deleteLoop,
        setActiveLoop,
        updateLoop,
        toggleMode,
        generateWorldSummary
    }
})
