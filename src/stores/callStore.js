import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useChatStore } from './chatStore'
import { useFavoritesStore } from './favoritesStore'

export const useCallStore = defineStore('call', () => {
    // State
    const status = ref('none') // 'none', 'dialing', 'incoming', 'active', 'ended'
    const type = ref('voice') // 'voice', 'video'
    const partner = ref(null) // { name, avatar, id }
    const initiator = ref('user') // 'user' or 'ai'
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
        if (status.value !== 'none') {
            const chatStore = useChatStore()
            chatStore.triggerToast('当前通话尚未结束', 'warning')
            return
        }
        status.value = 'dialing'
        initiator.value = 'user'
        type.value = callType
        partner.value = callPartner
        elapsedSeconds.value = 0
        transcript.value = []

        // Set custom avatars if defined in partner settings
        customCallAvatarChar.value = callPartner.callAvatarChar || ''
        customCallAvatarUser.value = callPartner.callAvatarUser || ''

        playRingtone(RINGTONE_DIALING)
    }

    const receiveCall = (callPartner, callType = 'voice') => {
        const chatStore = useChatStore()

        // --- Busy Signal Logic ---
        if (status.value !== 'none') {
            console.log(`[CallStore] Auto-rejecting incoming call from ${callPartner.name} due to active call with ${partner.value?.name}`);

            // Add system message to the new partner's chat history
            chatStore.addMessage(callPartner.id, {
                role: 'system',
                type: 'system',
                content: `【系统提示：由于你当前正在与其他角色通话，${callPartner.name}的呼叫已自动转入占线状态。】`,
                timestamp: Date.now()
            })

            // Also give the AI a little hint that the user is busy
            chatStore.sendMessageToAI(callPartner.id, {
                hiddenHint: `用户当前正在与其他角色进行语音/视频通话，你刚才的呼叫被自动挂断了（提示占线）。请对此表现出自然的反应（如：留言、询问、或者等会儿再打）。`
            })

            return
        }

        status.value = 'incoming'
        initiator.value = 'ai'
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
        if (status.value === 'none') return

        const currentPartner = partner.value
        const callTypeLabel = type.value === 'video' ? '视频通话' : '语音通话'
        const chatStore = useChatStore()

        if (currentPartner?.id) {
            chatStore.addMessage(currentPartner.id, {
                role: 'system',
                type: 'system',
                content: status.value === 'dialing' ? '已取消' : '对方已拒绝',
                timestamp: Date.now()
            })
        }

        stopRingtone()
        status.value = 'none'
        partner.value = null
    }

    const endCall = () => {
        if (status.value === 'ended' || status.value === 'none') return // Prevent double-ending

        const chatStore = useChatStore()

        // CRITICAL: Stop TTS immediately
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
        }

        // Stop AI Generation if potential call response is pending
        if (partner.value?.id) {
            chatStore.stopGeneration(true, partner.value.id)
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
        const wasIncoming = status.value === 'incoming'
        const shouldSave = status.value === 'active'

        status.value = 'ended'

        // Add System message for "Call Ended" or "Hung up/Rejected"
        if (currentPartner?.id) {
            if (wasDialing) {
                chatStore.addMessage(currentPartner.id, {
                    role: 'system',
                    type: 'system',
                    content: '已取消',
                    timestamp: Date.now()
                })
            } else if (wasIncoming) {
                chatStore.addMessage(currentPartner.id, {
                    role: 'system',
                    type: 'system',
                    content: '已拒绝',
                    timestamp: Date.now()
                })
            } else if (shouldSave) {
                // Active call ended normally
                chatStore.addMessage(currentPartner.id, {
                    role: 'system',
                    type: 'system',
                    content: `${callTypeLabel}时间 ${finalDuration}`,
                    timestamp: Date.now()
                })
            }
        }

        // Save to chat history as a packaged card (Favorite Card)
        if (currentPartner?.id && shouldSave) {
            // Fallback: If transcript is empty, try to harvest from chatStore hidden messages
            if (transcript.value.length === 0) {
                console.log('[CallStore] Transcript empty, harvesting from chatStore...');
                const chat = chatStore.chats[currentPartner.id];
                const chatHistory = chat ? chat.msgs : [];
                // Look for hidden messages added during the call's timeframe
                const callMsgs = chatHistory.filter(m => m.hidden && m.timestamp >= callStartTime.value && m.timestamp <= Date.now());
                if (callMsgs.length > 0) {
                    callMsgs.forEach(m => {
                        transcript.value.push({
                            role: m.role,
                            content: m.content,
                            timestamp: m.timestamp
                        });
                    });
                }
            }

            // Generate summary from transcript
            const dialogueCount = transcript.value.length
            const previewText = transcript.value.slice(0, 2).map(t => {
                // Return cleaned text for preview
                return String(t.content || '').replace(/\[CALL_START\]|\[CALL_END\]|\[INNER_VOICE\]|\[\/INNER_VOICE\]/gi, '').trim()
            }).join('; ') + (dialogueCount > 2 ? '...' : '')

            const summaryText = `[通话记录]\n类型: ${callTypeLabel}\n对象: ${currentPartner.name}\n开始时间: ${new Date(callStartTime.value).toLocaleString()}\n通话时长: ${finalDuration}\n\n[对话摘录]\n${transcript.value.map(t => {
                let clean = String(t.content || '');

                // Stage 1: Strip standard [CALL_START]...[CALL_END] blocks
                if (clean.includes('[CALL_START]')) {
                    const jsonMatch = clean.match(/\[CALL_START\]\s*(\{[\s\S]*?\}|[\s\S]*?)\s*\[CALL_END\]/i);
                    if (jsonMatch) {
                        try {
                            const data = JSON.parse(jsonMatch[1]);
                            clean = data.speech || clean;
                        } catch (e) { }
                    }
                }

                // Stage 2: Deep search for any JSON-like blocks that might have leaked
                if (clean.includes('{') && (clean.includes('"speech"') || clean.includes('"status"'))) {
                    const blocks = clean.match(/\{[\s\S]*?\}/g);
                    if (blocks) {
                        for (let i = blocks.length - 1; i >= 0; i--) {
                            const block = blocks[i];
                            if (block.includes('"speech"') || block.includes('"status"') || block.includes('"action"')) {
                                try {
                                    const data = JSON.parse(block);
                                    if (data.speech) {
                                        clean = data.speech;
                                        break;
                                    }
                                } catch (e) {
                                    const speechExtract = block.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                                    if (speechExtract) {
                                        clean = speechExtract[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                // Stage 3: Final cleanup
                clean = clean.replace(/\[CALL_START\]|\[CALL_END\]|\[INNER_VOICE\]|\[\/INNER_VOICE\]/gi, '')
                    .replace(/\\n/g, '\n')
                    .trim();

                // Advanced Stage 4: Remove possible repeated character prefixes ONLY if they exactly match the expected pattern
                const namePrefix = new RegExp(`^${currentPartner.name}\\s*[:：]\\s*`, 'i');
                clean = clean.replace(namePrefix, '');
                clean = clean.replace(/^我\s*[:：]\s*/, '');

                return `${t.role === 'ai' ? currentPartner.name : '我'}: ${clean}`
            }).join('\n\n')}`



            const callRecContent = {
                favoriteId: `call_rec_${Date.now()}`,
                title: `与 ${currentPartner.name} 的${callTypeLabel}`,
                source: '通话记录',
                preview: `通话时长 ${finalDuration}\n${previewText}`,
                fullContent: summaryText,
                savedAt: Date.now()
            };

            chatStore.addMessage(currentPartner.id, {
                id: `call_${Date.now()}`,
                role: initiator.value === 'user' ? 'user' : 'ai',
                type: 'favorite_card',
                content: JSON.stringify(callRecContent),
                timestamp: Date.now()
            })

            // Also add to global favorites list
            try {
                const favoritesStore = useFavoritesStore();
                favoritesStore.favorites.unshift({
                    id: callRecContent.favoriteId,
                    type: 'text', // Render as text summary
                    source: '通话记录',
                    savedAt: Date.now(),
                    author: currentPartner.name,
                    avatar: currentPartner.avatar,
                    content: summaryText,
                    preview: callRecContent.preview,
                    title: callRecContent.title,
                    isCallRecord: true
                });
                if (typeof favoritesStore.saveFavorites === 'function') {
                    favoritesStore.saveFavorites();
                } else {
                    console.warn('[CallStore] saveFavorites is not a function');
                }
            } catch (favErr) {
                console.error('[CallStore] Failed to save to favorites:', favErr);
            }

            chatStore.addMessage(currentPartner.id, {
                role: 'system',
                type: 'system',
                content: '通话结束，已为你生成并保存通话摘录至收藏夹。',
                timestamp: Date.now()
            })
        }

        // If it was just dialing or incoming (not active), exit immediately. Otherwise show "Ended" for 1.5s
        const wasDialingOrIncoming = wasDialing || wasIncoming
        const exitDelay = wasDialingOrIncoming ? 0 : 1500

        setTimeout(() => {
            if (status.value === 'ended') {
                status.value = 'none'
                // Only clear partner AFTER the delay so UI can show "Call Ended" correctly
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

    const updateLastTranscriptLine = (content) => {
        if (transcript.value.length > 0) {
            const lastLine = transcript.value[transcript.value.length - 1];
            if (lastLine.role === 'ai') {
                lastLine.content = content;
            }
        }
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
        updateLastTranscriptLine,
        updateStatus,
        updateEnv,
        toggleMute,
        toggleSpeaker,
        toggleCamera
    }
})
