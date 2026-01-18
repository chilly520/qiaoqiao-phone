import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'

export const useCallStore = defineStore('call', () => {
    // State
    const status = ref('none') // 'none', 'dialing', 'incoming', 'active', 'ended'
    const type = ref('voice') // 'voice', 'video'
    const partner = ref(null) // { name, avatar, id }
    const callStartTime = ref(null)
    const elapsedSeconds = ref(0)
    const isMuted = ref(false)
    const isSpeakerOn = ref(true)
    const isCameraOff = ref(false)

    const userPreviewMode = ref('camera') // 'camera', 'avatar'
    const aiPreviewMode = ref('avatar') // 'avatar', 'hidden'
    const isSpeaking = ref(false) // Added missing state used by UI

    const transcript = ref([]) // { role, content, timestamp }

    const customCallAvatarChar = ref('')
    const customCallAvatarUser = ref('')

    let timer = null
    let ringtone = null

    // ACTIONS
    const updateStatus = (newStatus) => {
        // AI can send status updates like "Hand-tied", etc.
        // We can display this in the UI
        console.log('[CallStore] AI Status Update:', newStatus);
    }

    const updateEnv = (newEnv) => {
        console.log('[CallStore] AI Env Update:', newEnv);
    }

    // Audio assets (Mock WeChat ringtones)
    const RINGTONE_INCOMING = 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'
    const RINGTONE_DIALING = 'https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3'

    // Computeds
    const durationText = computed(() => {
        const mins = Math.floor(elapsedSeconds.value / 60)
        const secs = elapsedSeconds.value % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    })

    // Actions
    const playRingtone = (url, loop = true) => {
        stopRingtone()
        ringtone = new Audio(url)
        ringtone.loop = loop
        ringtone.play().catch(e => console.warn('Ringtone play failed:', e))
    }

    const stopRingtone = () => {
        if (ringtone) {
            ringtone.pause()
            ringtone = null
        }
    }

    const startCall = (callPartner, callType = 'voice') => {
        status.value = 'dialing'
        type.value = callType
        partner.value = callPartner
        elapsedSeconds.value = 0
        transcript.value = []

        // Set custom avatars if defined in partner settings
        customCallAvatarChar.value = callPartner.callAvatarChar || ''
        customCallAvatarUser.value = callPartner.callAvatarUser || ''

        playRingtone(RINGTONE_DIALING)

        // We no longer auto-accept here.
        // The AI will handle acceptance via [接听] or system logic.
    }

    const receiveCall = (callPartner, callType = 'voice') => {
        status.value = 'incoming'
        type.value = callType
        partner.value = callPartner
        elapsedSeconds.value = 0
        transcript.value = []

        // Set custom avatars if defined in partner settings
        customCallAvatarChar.value = callPartner.callAvatarChar || ''
        customCallAvatarUser.value = callPartner.callAvatarUser || ''

        playRingtone(RINGTONE_INCOMING)
    }

    const acceptCall = () => {
        stopRingtone()
        status.value = 'active'
        callStartTime.value = Date.now()

        if (timer) clearInterval(timer)
        timer = setInterval(() => {
            elapsedSeconds.value++
        }, 1000)
    }

    const rejectCall = () => {
        stopRingtone()
        status.value = 'none'
        partner.value = null
    }

    const endCall = () => {
        if (status.value === 'ended' || status.value === 'none') return // Prevent double-ending

        // CRITICAL: Stop TTS immediately
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
        }

        stopRingtone()
        if (timer) {
            clearInterval(timer)
            timer = null
        }

        const finalDuration = durationText.value
        const callTypeLabel = type.value === 'video' ? '视频通话' : '语音通话'
        const currentPartner = partner.value
        const wasDialing = status.value === 'dialing'
        const shouldSave = status.value === 'active'

        status.value = 'ended'

        // Save to chat history as a packaged card
        const chatStore = useChatStore()
        if (currentPartner?.id && shouldSave) {
            // Generate summary from transcript
            const dialogueCount = transcript.value.length
            const previewText = transcript.value.slice(0, 2).map(t => {
                // Return cleaned text for preview
                return t.content.replace(/\[CALL_START\]|\[CALL_END\]|\[INNER_VOICE\]|\[\/INNER_VOICE\]/gi, '').trim()
            }).join('; ') + (dialogueCount > 2 ? '...' : '')

            const summaryText = `[通话记录]\n类型: ${callTypeLabel}\n对象: ${currentPartner.name}\n开始时间: ${new Date(callStartTime.value).toLocaleString()}\n通话时长: ${finalDuration}\n\n[对话摘录]\n${transcript.value.map(t => {
                const clean = t.content.replace(/\[CALL_START\]|\[CALL_END\]|\[INNER_VOICE\]|\[\/INNER_VOICE\]/gi, '').trim()
                return `${t.role === 'ai' ? currentPartner.name : '我'}: ${clean}`
            }).join('\n')}`

            chatStore.addMessage(currentPartner.id, {
                id: `call_${Date.now()}`,
                role: 'ai',
                type: 'favorite_card',
                content: JSON.stringify({
                    favoriteId: `call_rec_${Date.now()}`,
                    title: `与 ${currentPartner.name} 的${callTypeLabel}`,
                    source: '通话记录',
                    preview: `通话时长 ${finalDuration}\n${previewText}`,
                    fullContent: summaryText,
                    savedAt: Date.now()
                }),
                timestamp: Date.now()
            })
        }

        // If it was just dialing, exit immediately. Otherwise show "Ended" for 1.5s
        const exitDelay = wasDialing ? 0 : 1500

        setTimeout(() => {
            if (status.value === 'ended') {
                status.value = 'none'
                partner.value = null
            }
        }, exitDelay)
    }

    const addTranscriptLine = (role, content, action = '') => {
        transcript.value.push({
            role,
            content,
            action,
            timestamp: Date.now()
        })
    }

    const toggleMute = () => { isMuted.value = !isMuted.value }
    const toggleSpeaker = () => { isSpeakerOn.value = !isSpeakerOn.value }
    const toggleCamera = () => { isCameraOff.value = !isCameraOff.value }

    return {
        status,
        type,
        partner,
        elapsedSeconds,
        durationText,
        isMuted,
        isSpeakerOn,
        isCameraOff,
        isSpeaking,
        userPreviewMode,
        aiPreviewMode,
        transcript,
        customCallAvatarChar,
        customCallAvatarUser,

        startCall,
        receiveCall,
        acceptCall,
        rejectCall,
        endCall,
        addTranscriptLine,
        updateStatus,
        updateEnv,
        toggleMute,
        toggleSpeaker,
        toggleCamera
    }
})
