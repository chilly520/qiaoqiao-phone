import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { useChatStore } from './chatStore'
import { useSettingsStore } from './settingsStore'
import { useWeiboStore } from './weiboStore'
import { useMomentsStore } from './momentsStore'
import { generateImage } from '../utils/aiService'

const loopDB = localforage.createInstance({
    name: 'qiaoqiao-phone',
    storeName: 'world_loops'
})

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
    }

    async function saveLoops() {
        await loopDB.setItem('all_loops', JSON.parse(JSON.stringify(loops.value)))
    }

    // --- Actions ---

    async function createLoop(name, description, initialParticipants = []) {
        const loopId = 'loop-' + Date.now()

        loops.value[loopId] = {
            id: loopId,
            name: name,
            description: description,
            createdAt: Date.now(),
            participants: initialParticipants || [], // Add initial NPCs
            currentMode: 'online', // 'online' (WeChat style) or 'offline' (Visual Novel style)
            userRole: '', // User's persona/identity in this world
            currentScene: {
                image: '',
                description: '初始场景',
                timestamp: Date.now()
            },
            history: [],
            summaryHistory: [],
            systemPrompt: `你是一个剧本杀/RPG游戏的GM。当前世界名称：${name}。背景：${description}`
        }

        await saveLoops()
        console.log(`[WorldLoop] Created loop: ${name} (${loopId})`)

        // Update character metadata for initial participants
        const chatStore = useChatStore()
        initialParticipants.forEach(charId => {
            chatStore.updateCharacter(charId, {
                belongToLoop: loopId,
                tags: [...(chatStore.chats[charId]?.tags || []), '世界圈']
            })
        })

        return loops.value[loopId]
    }

    /**
     * Add NPC to Loop
     * Automatically handles avatar generation if not present
     */
    async function addNPCToLoop(loopId, npcData) {
        const chatStore = useChatStore()
        const loop = loops.value[loopId]
        if (!loop) return

        // 1. Create Character in chatStore if it doesn't exist
        let charId = npcData.id
        if (!charId) {
            const newChar = chatStore.createChat(npcData.name)
            charId = newChar.id

            // Auto generate avatar if requested
            if (npcData.useAIHead) {
                try {
                    const prompt = `A profile picture for a character named ${npcData.name}. ${npcData.prompt || ''} Anime style, high quality.`
                    const imageUrl = await generateImage(prompt)
                    chatStore.updateCharacter(charId, { avatar: imageUrl, prompt: npcData.prompt })
                } catch (e) {
                    console.error('Failed to generate AI Avatar', e)
                }
            }
        }

        // 2. Link to Loop
        if (!loop.participants.includes(charId)) {
            loop.participants.push(charId)
            // Update character metadata to show which loop they belong to
            chatStore.updateCharacter(charId, {
                belongToLoop: loopId,
                tags: [...(chatStore.chats[charId].tags || []), '世界圈']
            })
        }

        await saveLoops()
        return charId
    }

    /**
     * AI 召唤新成员
     * 一键生成人设、头像并加入世界圈
     */
    async function summonMember(loopId, theme) {
        const loop = loops.value[loopId]
        if (!loop) return

        isLoading.value = true
        try {
            const { generateCharacterPersona, generateImage, generateCompleteProfile } = await import('../utils/aiService')

            // 1. Generate Persona
            const persona = await generateCharacterPersona(theme, loop.description)
            console.log(`[WorldLoop] Summoning: ${persona.name}`, persona)

            // 2. Create Chat/Character
            const chatStore = useChatStore()
            const newChar = chatStore.createChat(persona.name, {
                gender: persona.gender,
                prompt: persona.prompt,
                description: `${persona.identity}. ${persona.personality}`
            })
            const charId = newChar.id

            // 3. Generate Visuals & Profile (Background, Pinned moments)
            try {
                // Generate Avatar first
                const avatarUrl = await generateImage(`${persona.appearance}, anime style, masterpiece, high quality, profile picture`)
                chatStore.updateCharacter(charId, { avatar: avatarUrl })

                // Generate full profile (Async, don't block)
                const momentsStore = useMomentsStore()
                generateCompleteProfile(newChar, useSettingsStore().personalization?.userProfile)
                    .then(profile => {
                        console.log('[WorldLoop] Full profile generated:', profile)
                        // 1. Update character metadata
                        chatStore.updateCharacter(charId, {
                            statusText: profile.signature || profile.bio, // Support both for transition
                            momentsBackground: profile.backgroundUrl,
                            // If profile has extended bio fields, apply them
                            bio: {
                                ...(newChar.bio || {}),
                                ...(profile.bioFields || {})
                            }
                        })

                        // 2. Inject initial moments
                        const initialMoments = profile.pinnedMoments || profile.moments || []
                        if (initialMoments.length > 0) {
                            initialMoments.forEach(m => {
                                momentsStore.addMoment({
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
            loops.value[id] = { ...loops.value[id], ...data }
            saveLoops()
        }
    }
    function removeNPCFromLoop(loopId, charId) {
        const loop = loops.value[loopId]
        if (loop && loop.participants) {
            loop.participants = loop.participants.filter(id => id !== charId)
            saveLoops()
        }
    }

    async function generateWorldSummary(loopId) {
        const chatStore = useChatStore()
        const loop = loops.value[loopId]
        if (!loop) return

        isLoading.value = true
        try {
            // Use the loop ID as the chat ID (World Circles share IDs)
            const result = await chatStore.summarizeHistory(loopId, {
                silent: false,
                summaryPrompt: '你现在是上帝/GM，请基于上述对话记录，写一段“世界线总结”。重点记录剧情发生了哪些重大转折、角色的阵营变化、当前的地理位置以及接下来的潜在冲突点。字数控制在200字以内。'
            })

            if (result.success) {
                const latestMemory = chatStore.chats[loopId]?.summary || ''
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
        setActiveLoop,
        updateLoop,
        toggleMode,
        generateWorldSummary
    }
})
