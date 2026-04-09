<script setup>
import { useCallStore } from '../stores/callStore'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chatStore'
import { useSettingsStore } from '../stores/settingsStore'

const callStore = useCallStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const isExpanded = ref(true) // Always expanded now by default
const userInput = ref('')

const sendText = async () => {
    if (!userInput.value.trim() || !partner.value) return
    
    // Send to chat system
    await chatStore.addMessage(partner.value.id, {
        role: 'user',
        content: userInput.value,
        type: 'text',
        hidden: true // Keep it out of background chat history
    })
    
    userInput.value = ''
}

const handleGenerate = () => {
    if (!partner.value) return
    chatStore.sendMessageToAI(partner.value.id)
}

const partner = computed(() => callStore.partner)
const status = computed(() => callStore.status)
const isActive = computed(() => status.value === 'active' || status.value === 'dialing' || status.value === 'ended')

const userAvatarFallback = computed(() => {
    // Try to get from the current chat's metadata first
    const chat = chatStore.chats[partner.value?.id]
    return chat?.userAvatar || settingsStore.personalization?.userProfile?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'
})

// Event listeners for expanding
onMounted(() => {
    window.addEventListener('expand-call-visualizer', () => isExpanded.value = true)
})

onUnmounted(() => {
    window.removeEventListener('expand-call-visualizer', () => isExpanded.value = true)
})

const handleHangup = () => {
    console.log('[CallVisualizer] Hangup Clicked');
    callStore.endCall()
}

const handleMinimize = () => {
    isExpanded.value = false
}

const acceptCall = () => {
    console.log('[CallVisualizer] Accept Call Clicked');
    callStore.acceptCall()
}

const rejectCall = () => {
    console.log('[CallVisualizer] Reject Call Clicked');
    callStore.rejectCall()
}

const toggleMute = () => callStore.toggleMute()
const toggleSpeaker = () => callStore.toggleSpeaker()
const toggleCamera = () => callStore.toggleCamera()


const scrollContainer = ref(null)

const robustParseJSON = (str) => {
    if (!str) return null;
    try {
        // Normal parse
        return JSON.parse(str);
    } catch (e) {
        try {
            // Try after unescaping tendencies (AI sometimes over-escapes)
            let fixedStr = str.replace(/\\"/g, '"').replace(/\\n/g, '\n');
            return JSON.parse(fixedStr);
        } catch (e2) {
            // Try to find the inner-most object if it's wrapped
            const firstBrace = str.indexOf('{');
            const lastBrace = str.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                try {
                    return JSON.parse(str.substring(firstBrace, lastBrace + 1));
                } catch (e3) {
                   // Fallback: use regex for speech field
                   const speechMatch = str.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                   if (speechMatch) {
                       return { speech: speechMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
                   }
                }
            }
        }
    }
    return null;
}

const cleanLineContent = (text) => {
    if (!text) return '';
    let result = text;
    
    // 1. Try to extract from [CALL_START]...[CALL_END]
    const callMatch = result.match(/\[CALL_START\][\s\S]*?(\{[\s\S]*?\})[\s\S]*?\[CALL_END\]/i);
    if (callMatch) {
        const data = robustParseJSON(callMatch[1]);
        if (data && data.speech) {
            result = data.speech;
        }
    } else {
        // 2. Try to find raw JSON block even without tags
        const jsonMatch = result.match(/\{[\s\S]*?"speech"[\s\S]*?\}/);
        if (jsonMatch) {
            const data = robustParseJSON(jsonMatch[0]);
            if (data && data.speech) {
                result = data.speech;
            }
        } else {
            // 3. Last fallback: direct speech regex
            const speechMatch = result.match(/"speech"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (speechMatch && speechMatch[1]) {
                result = speechMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            }
        }
    }

    // 4. Final cleanup: Remove any remaining system tags
    return result.replace(/\[\/?(?:CALL_START|CALL_END|INNER[-_ ]?VOICE|朋友圈|MOMENT|REPLY|CARD|DRAW|MUSIC)\]/gi, '')
                 .replace(/\[(?:图片|语音|IMAGE|VOICE|RED|TRANSFER)[:：].*?\]/gi, '')
                 .replace(/\[(接听|拒绝|拒接|回复|撤回|LIKE|COMMENT)[:：].*?\]/gi, '')
                 .replace(/\\n/g, '\n')
                 .replace(/\s*[（\(]引用来自.*?[）\)]/gi, '')
                 .trim();
}

const parseContentWithBrackets = (content) => {
    if (!content) return [];
    const parts = [];
    // Regex for text in parentheses (supports (), （）)
    const regex = /([\s\S]*?)([\(（][\s\S]*?[\)）])/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match[1]) parts.push({ text: match[1], type: 'text' });
        parts.push({ text: match[2], type: 'bracket' });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
        parts.push({ text: content.substring(lastIndex), type: 'text' });
    }

    return parts.length > 0 ? parts : [{ text: content, type: 'text' }];
}

const transcriptList = computed(() => {
    return callStore.transcript.map(line => {
        const clean = cleanLineContent(line.content);
        return {
            ...line,
            cleanContent: clean,
            parts: parseContentWithBrackets(clean)
        };
    }).filter(line => line.cleanContent || line.action)
})

// STT Logic
const isListening = ref(false)
const interimTranscript = ref('')
let recognition = null
let isRestarting = false // 避免重复重启的标志

const initRecognition = () => {
    if ('webkitSpeechRecognition' in window) {
        recognition = new window.webkitSpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true // Capture partially to detect start of speech
        recognition.lang = 'zh-CN' // Assume Chinese for now

        recognition.onstart = () => {
            isListening.value = true
        }

        recognition.onresult = (event) => {
             // If speaking, interrupt TTS and AI generation immediately
             window.speechSynthesis.cancel() // Global cancel
             if (partner.value) {
                 chatStore.stopGeneration(true, partner.value.id)
             }
             
             let finalStr = ''
             let interimStr = '' 

             for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalStr += event.results[i][0].transcript
                } else {
                    interimStr += event.results[i][0].transcript
                }
             }

             // Show interim real-time
             interimTranscript.value = interimStr
             
             // If we have final result, send it
             if (finalStr) {
                 userInput.value = finalStr
                 sendText() 
                 interimTranscript.value = ''
                 // Auto-triggering AI to respond to the spoken input
                 setTimeout(() => handleGenerate(), 300)
             }
        }

        recognition.onend = () => {
             // Keep listening even after a sentence is finalized, unless manually stopped
             // Ensure we don't restart if an error-triggered restart is already in progress
             if (isListening.value && recognition && !isRestarting) {
                 try {
                     recognition.start()
                 } catch(e) {
                     console.error('Auto-restart failed:', e)
                     // 自动重启失败时，不做进一步处理，避免递归错误
                 }
             }
        }

        recognition.onerror = (event) => {
            // no-speech and network are NORMAL during calls - use warn not error
            const isNormal = event.error === 'no-speech' || event.error === 'network' || event.error === 'aborted'
            if (isNormal) {
                console.warn(`[STT] ${event.error} (normal)`)
            } else {
                console.error('Speech recognition error', event.error)
            }
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                 chatStore.triggerToast('麦克风权限被拒绝或不可用，请在浏览器地址栏左侧开启权限。', 'warning')
                 isListening.value = false
            } else if (event.error === 'no-speech') {
                 // Ignore "no speech" to keep listening if it was intended
            } else if (event.error === 'network') {
                 chatStore.triggerToast('语音识别网络错误，请检查网络连接后重试。', 'warning')
                 // 发生网络错误时，先标记为正在重启，停止现有服务并稍后重启
                 if (isListening.value && !isRestarting) {
                     isRestarting = true
                     try {
                         // 先尝试停止，即使它可能已经停止了
                         if (recognition) {
                             try {
                                 recognition.stop()
                             } catch (e) {}
                         }
                         
                         // 延迟更长时间后重新初始化并启动，确保系统释放资源
                         setTimeout(() => {
                            if (!isListening.value) {
                                isRestarting = false;
                                return;
                            }
                             try {
                                 initRecognition()
                                 if (recognition) {
                                     recognition.start()
                                 }
                             } catch (e) {
                                 console.error('Recognition retry failed', e)
                                 chatStore.triggerToast('语音识别自动重启失败，请尝试重新开启麦克风。', 'warning')
                             } finally {
                                 isRestarting = false
                             }
                         }, 2000)
                     } catch (e) {
                         console.error('Network error recovery failed', e)
                         isRestarting = false
                     }
                 }
            } else if (event.error === 'audio-capture') {
                 chatStore.triggerToast('麦克风无法捕获音频，请检查麦克风设备。', 'warning')
                 isListening.value = false
            } else if (event.error === 'aborted') {
                 // 忽略中止错误，可能是手动停止导致的
            } else {
                 console.error('Unknown speech recognition error:', event.error)
                 chatStore.triggerToast(`语音识别错误: ${event.error}`, 'warning')
            }
        }

    } else {
        chatStore.triggerToast('您的浏览器不支持语音识别功能，请尝试使用 Chrome。', 'info')
    }
}

const toggleMic = () => {
    try {
        if (callStore.isMuted) {
            // User wants to UNMUTE
            startListening()
        } else {
            // User wants to MUTE
            stopListening()
        }
    } catch (e) {
        console.error('[CallVisualizer] toggleMic error:', e);
        chatStore.triggerToast('麦克风操作失败，请重试', 'error');
    }
}

const startListening = () => {
    // If permission was already denied, don't just spam recognition.start()
    if (recognition) {
        try {
            // 先检查是否已经在运行
            if (!isListening.value) {
                recognition.start()
            }
            isListening.value = true
            callStore.isMuted = false
        } catch (e) {
            // If already started, just sync state
            if (e.message?.includes('already started')) {
                isListening.value = true;
                callStore.isMuted = false;
            } else {
                console.error('Recognition start failed', e)
                chatStore.triggerToast('麦克风启动失败，请检查权限', 'warning')
                // 尝试重新初始化
                setTimeout(() => {
                    initRecognition()
                    if (recognition) {
                        try {
                            recognition.start()
                            isListening.value = true
                            callStore.isMuted = false
                        } catch (e2) {
                            console.error('Recognition restart failed after error', e2)
                        }
                    }
                }, 500)
            }
        }
    } else {
        initRecognition()
        if (recognition) {
            try {
                recognition.start()
            } catch (e) {
                console.error('Initial recognition start failed', e)
            }
        }
        isListening.value = true
        callStore.isMuted = false
    }
}

const stopListening = () => {
    try {
        isRestarting = true
        if (recognition) {
            try {
                recognition.stop()
            } catch(e) {
                console.error('Stop recognition failed:', e)
            }
        }
    } finally {
        isListening.value = false
        interimTranscript.value = ''
        callStore.isMuted = true // Mute store state
        isRestarting = false
    }
}

// Watch mute state changes from store (e.g. if toggled elsewhere)
watch(() => callStore.isMuted, (newVal) => {
    // FIX: Only stop listening when explicitly muted (user clicked mute button)
    // Don't stop on initial value changes during call setup
    if (newVal && isListening.value) {
        stopListening()
    }
})

// Watch call status to auto-start camera and microphone for calls
watch(() => callStore.status, (newStatus, oldStatus) => {
    // Auto-start camera when video call becomes active
    if (newStatus === 'active' && oldStatus !== 'active' && callStore.type === 'video') {
        if (callStore.isCameraOff) {
            startCamera()
        }
    }
    // Auto-start voice recognition when any call becomes active
    if (newStatus === 'active' && oldStatus !== 'active') {
        // FIX: Always try to start STT when call connects
        // Previously only started when isMuted=true (default is false, so never started!)
        // Now: init recognition immediately so user can speak right away
        if (!recognition) {
            initRecognition()
        }
        // Small delay to ensure DOM/call state is ready
        setTimeout(() => {
            try { startListening() } catch(e) { console.warn('Auto-start STT failed:', e) }
        }, 500)
    }
    // Stop camera and listening when call ends
    if (newStatus === 'none' || newStatus === 'ended') {
        stopCamera()
        stopListening()
    }
})

// Keyboard Toggle
const isKeyboardVisible = ref(false)
const toggleKeyboard = () => {
    isKeyboardVisible.value = !isKeyboardVisible.value
}


// Video / Avatar Logic
const videoElement = ref(null)
const cameraStream = ref(null)
const isVirtualAvatarMode = ref(false)

const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        cameraStream.value = stream
        if (videoElement.value) {
            videoElement.value.srcObject = stream
        }
        callStore.isCameraOff = false
    } catch (err) {
        console.error('Camera access failed', err)
        chatStore.triggerToast('无法访问摄像头，请检查权限。', 'error')
        callStore.isCameraOff = true
    }
}

const stopCamera = () => {
    if (cameraStream.value) {
        cameraStream.value.getTracks().forEach(track => track.stop())
        cameraStream.value = null
    }
    callStore.isCameraOff = true
}

const toggleCameraFunc = () => {
    if (callStore.isCameraOff) {
        startCamera()
    } else {
        stopCamera()
    }
}

const toggleVirtualAvatar = () => {
    console.log('[CallVisualizer] Virtual avatar button clicked')
    console.log('[CallVisualizer] Current virtual avatar mode:', callStore.virtualAvatarMode)
    // Cycle through modes using callStore method
    callStore.toggleVirtualAvatarMode()
    console.log('[CallVisualizer] New virtual avatar mode:', callStore.virtualAvatarMode)
    
    // Toast notification for user
    let msg = ''
    if (callStore.virtualAvatarMode === 1) {
        msg = '已开启两人虚拟形象。AI 将看到你的动作并配合虚拟演出。'
    } else if (callStore.virtualAvatarMode === 2) {
        msg = '已开启对方虚拟形象。若开启摄像头，AI 将重点感知你的视觉环境。'
    } else {
        msg = '已切换至实景动态。AI 观察你并每轮生成通话场景图，制造直播感。'
    }
    console.log('[CallVisualizer] Toast message:', msg)
    chatStore.triggerToast(msg, 'success')
}


// Cleanup
onUnmounted(() => {
    stopListening()
    stopCamera()
})

// Auto-scroll logic
watch(() => callStore.transcript.length, () => {
    nextTick(() => {
        if (scrollContainer.value) {
            scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
        }
    })
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isActive && (status !== 'none' && isExpanded)" class="call-visualizer-overlay">
      <!-- NEW: Full Screen Video Background for Video Calls -->
      <div v-if="callStore.type === 'video' && status !== 'incoming'" class="video-container-full-screen">
          <!-- AI/Partner View (Large Fullscreen) -->
          <div class="main-video-view">
              <!-- If Mode is 1 (Both) or 2 (AI Only), show Virtual Char Avatar. Otherwise show original (background img) -->
              <img 
                :src="(callStore.virtualAvatarMode === 1 || callStore.virtualAvatarMode === 2) ? (callStore.customCallAvatarChar || partner?.avatar) : (partner?.avatar)" 
                class="main-img-full"
                :class="{ 'is-virtual': callStore.virtualAvatarMode === 1 || callStore.virtualAvatarMode === 2 }"
              >
          </div>

          <!-- Self View (PIP Overlay) -->
          <div class="self-video-pip">
              <!-- Real Camera Feed: Only if NOT in 'Both' virtual mode AND camera is ON -->
              <div v-if="!callStore.isCameraOff && callStore.virtualAvatarMode !== 1" class="camera-feed-pip">
                  <video ref="videoElement" autoplay playsinline muted class="pip-video-feed"></video>
              </div>
              <!-- Virtual Avatar: If in 'Both' virtual mode OR camera is OFF -->
              <div v-else class="virtual-avatar-pip">
                  <img :src="callStore.customCallAvatarUser || userAvatarFallback" class="pip-avatar-img">
                  <div class="pip-label">我</div>
              </div>
          </div>
      </div>

      <!-- Background for Voice or Incoming (Blurred Partner Avatar) -->
      <div v-if="callStore.type === 'voice' || status === 'incoming'" class="call-background">
        <img :src="partner?.avatar" class="bg-image" alt="Background">
        <div class="bg-overlay"></div>
        <!-- Decorative cute elements -->
        <div class="cute-decor cute-decor-1">♡</div>
        <div class="cute-decor cute-decor-2">✿</div>
        <div class="cute-decor cute-decor-3">♪</div>
      </div>

      <!-- Header (Status & Partner) -->
      <div class="call-header">
        <button class="header-btn minimize-btn" @click="handleMinimize">
            <i class="fa-solid fa-compress"></i>
        </button>
        <div class="partner-info">
          <div class="name">{{ partner?.name }}</div>
          <div class="info" :class="{ 'text-green-400': (partner?.id && chatStore.typingStatus[partner.id]) || callStore.isSpeaking }">
            {{ 
                status === 'dialing' ? '正在呼叫...' : 
                status === 'ended' ? '通话已结束' :
                isListening ? '对方正在聆听...' :
                (partner?.id && chatStore.typingStatus[partner.id]) ? '对方正在说话...' :
                callStore.isSpeaking ? '对方正在说话...' :
                callStore.durationText 
            }}
          </div>
        </div>
        <!-- Spacer to balance Minimize button -->
        <div class="header-spacer" style="width: 40px;"></div>
      </div>

      <!-- Main Visual Area -->
      <div class="visual-area" :class="callStore.type">
        
        <!-- CASE 1: Voice Call Layout (Cute & Compact) -->
        <template v-if="callStore.type === 'voice'">
            <div class="voice-layout-container">
               <!-- Cute compact avatar at top -->
               <div class="avatar-wrapper-cute">
                   <div class="avatar-ring">
                       <div class="sparkle sparkle-1">✦</div>
                       <div class="sparkle sparkle-2">✧</div>
                       <div class="sparkle sparkle-3">★</div>
                       <img :src="partner?.avatar" class="avatar-cute" :class="{ 'speaking': callStore.isSpeaking }">
                   </div>
                   <!-- Status badge under avatar -->
                   <div v-if="status === 'active'" class="avatar-status-badge animate-fade-in">
                       <span class="pulse-dot"></span> 通话中
                   </div>
                   <div v-else-if="status === 'dialing'" class="avatar-status-badge dialing-badge animate-fade-in">
                       呼叫中...
                   </div>
                   <div v-else-if="status === 'incoming'" class="avatar-status-badge incoming-badge animate-fade-in">
                       {{ partner?.name }} 来电 ♡
                   </div>
               </div>
               
               <!-- STT feedback bubble (compact) -->
               <div v-if="isListening && interimTranscript" class="stt-bubble-cute animate-fade-in">
                   <div class="stt-icon-wrap"><i class="fa-solid fa-microphone"></i></div>
                   <span>{{ interimTranscript }}</span>
               </div>
            </div>
        </template>


        <!-- CASE 2: Video Call Layout (Placeholder when not established) -->
        <template v-else>
            <div v-if="status === 'dialing' || status === 'incoming'" class="video-preview-placeholder">
                <i class="fa-solid fa-video text-4xl mb-4 opacity-20"></i>
                <div class="text-sm opacity-60">准备视频通话...</div>
            </div>
            <!-- Establish established established established established established -->
            <div v-else-if="callStore.isCameraOff && !isVirtualAvatarMode" class="video-off-placeholder">
                <i class="fa-solid fa-video-slash text-4xl mb-4 opacity-20"></i>
                <div class="text-sm opacity-40">对方摄像头已关闭</div>
            </div>
        </template>
      </div>

      <!-- Dialogue / Transcript Box (Subtitles) -->
      <div class="transcript-box list-mode" ref="scrollContainer">
         <div v-for="(line, index) in transcriptList" :key="index" 
              class="transcript-line animate-fade-in" 
              :class="{ 'is-user': line.role === 'user' }">
             <div v-if="line.parts.some(p => p.type === 'text')" class="speech-bubble">
                <span v-if="line.role === 'user'" class="role-label-user">我: </span>
                <span v-else class="role-label-ai">{{ partner?.name }}: </span>
                <template v-for="(part, pIdx) in line.parts" :key="pIdx">
                    <span v-if="part.type === 'text'">{{ part.text }}</span>
                </template>
             </div>
             <template v-for="(part, pIdx) in line.parts" :key="'extra-' + pIdx">
                <div v-if="part.type === 'bracket'" class="action-hint">
                    {{ part.text }}
                </div>
             </template>
             <div v-if="line.action" class="action-hint">
                ({{ line.action }})
             </div>
         </div>
      </div>
        
        <div class="call-controls-container">
            <!-- Incoming Call Controls -->
            <div v-if="status === 'incoming'" class="incoming-controls">
                <div class="incoming-buttons">
                    <button class="incoming-btn reject-btn" @click="rejectCall">
                        <i class="fa-solid fa-phone-slash"></i>
                        <span>拒绝</span>
                    </button>
                    <button class="incoming-btn accept-btn" @click="acceptCall">
                        <i class="fa-solid fa-phone"></i>
                        <span>接听</span>
                    </button>
                </div>
            </div>

            <!-- Active Call Controls: 4 buttons in ONE ROW (Cute style) -->
            <div v-else>
                <div class="control-row main-controls cute-row">
                    
                    <!-- Mic / STT -->
                    <button class="cute-control-btn mic-btn" 
                            :class="{ 
                                active: isListening, 
                                'is-listening': isListening,
                                muted: callStore.isMuted 
                            }" 
                            @click="toggleMic">
                        <div class="btn-icon-circle">
                            <i class="fa-solid" :class="callStore.isMuted ? 'fa-microphone-slash' : 'fa-microphone'"></i>
                        </div>
                        <span class="btn-label">{{ callStore.isMuted ? '静音' : '麦克风' }}</span>
                    </button>

                    <!-- Speaker Toggle -->
                    <button class="cute-control-btn speaker-btn" :class="{ active: callStore.isSpeakerOn }" @click="toggleSpeaker">
                        <div class="btn-icon-circle">
                            <i class="fa-solid" :class="callStore.isSpeakerOn ? 'fa-volume-high' : 'fa-headphones-simple'"></i>
                        </div>
                        <span class="btn-label">{{ callStore.isSpeakerOn ? '免提' : '听筒' }}</span>
                    </button>

                    <!-- Video Toggles (Only for video calls) -->
                    <template v-if="callStore.type === 'video'">
                        <button class="cute-control-btn camera-btn" :class="{ active: !callStore.isCameraOff }" @click="toggleCameraFunc">
                            <div class="btn-icon-circle">
                                <i class="fa-solid" :class="!callStore.isCameraOff ? 'fa-video' : 'fa-video-slash'"></i>
                            </div>
                            <span class="btn-label">摄像头</span>
                        </button>

                        <button class="cute-control-btn avatar-toggle-btn" :class="{ active: callStore.virtualAvatarMode > 0 }" @click="toggleVirtualAvatar">
                            <div class="btn-icon-circle">
                                <i v-if="callStore.virtualAvatarMode === 1" class="fa-solid fa-users"></i>
                                <i v-else-if="callStore.virtualAvatarMode === 2" class="fa-solid fa-wand-magic-sparkles"></i>
                                <i v-else class="fa-solid fa-image"></i>
                            </div>
                            <span class="btn-label">虚拟形象</span>
                        </button>
                    </template>

                    <!-- Keyboard Toggle (Voice calls only) -->
                    <template v-else>
                        <button class="cute-control-btn keyboard-btn" :class="{ active: isKeyboardVisible }" @click="toggleKeyboard">
                            <div class="btn-icon-circle">
                                <i class="fa-solid fa-keyboard"></i>
                            </div>
                            <span class="btn-label">键盘</span>
                        </button>
                    </template>

                    <!-- Hangup -->
                    <button class="cute-control-btn hangup-btn" @click="handleHangup">
                        <div class="btn-icon-circle hangup-icon-circle">
                            <i class="fa-solid fa-phone-slash"></i>
                        </div>
                        <span class="btn-label hangup-label">挂断</span>
                    </button>

                </div>

                 <!-- Keyboard Area (Collapsible) -->
                <div v-if="isKeyboardVisible" class="call-input-bar animate-fade-in">
                    <input 
                        v-model="userInput" 
                        @keyup.enter="sendText"
                        type="text" 
                        placeholder="在此输入文字..." 
                        class="call-input"
                    >
                    <button 
                        class="send-btn" 
                        @click="sendText" 
                        :disabled="!userInput.trim() || (partner && chatStore.typingStatus[partner.id])"
                    >
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                     <!-- Generate button still useful if user types but wants to trigger AI explicitly -->
                    <button 
                        class="generate-btn" 
                        @click="handleGenerate"
                        :disabled="partner && chatStore.typingStatus[partner.id]"
                    >
                        <i class="fa-solid" :class="partner && chatStore.typingStatus[partner.id] ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
  </Transition>
</template>

<style scoped>
.call-visualizer-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999; /* Top most layer */
  background: #000;
  display: flex;
  flex-direction: column;
  color: white;
  overflow: hidden;
}

.call-background {
  position: absolute;
  inset: 0;
  z-index: -2;
  /* Soft pastel gradient - cute & fresh */
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 40%, #fbc2eb 70%, #a6c1ee 100%);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

/* Cute floating decorations */
.cute-decor {
  position: absolute;
  font-size: 20px;
  opacity: 0.25;
  animation: floatDecor 4s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}
.cute-decor-1 { top: 15%; left: 10%; font-size: 28px; animation-delay: 0s; }
.cute-decor-2 { top: 60%; right: 12%; font-size: 22px; animation-delay: 1.5s; }
.cute-decor-3 { bottom: 25%; left: 18%; font-size: 18px; animation-delay: 0.8s; }

@keyframes floatDecor {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.25; }
  50% { transform: translateY(-15px) rotate(8deg); opacity: 0.45; }
}

.call-background::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: lightFlow 6s linear infinite;
}

.call-background::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    -45deg,
    transparent,
    rgba(255, 255, 255, 0.15),
    transparent
  );
  animation: lightFlow 8s linear infinite reverse;
}

@keyframes lightFlow {
  0% {
    transform: rotate(0deg) translateX(0) translateY(0);
  }
  25% {
    transform: rotate(90deg) translateX(10%) translateY(10%);
  }
  50% {
    transform: rotate(180deg) translateX(0) translateY(20%);
  }
  75% {
    transform: rotate(270deg) translateX(-10%) translateY(10%);
  }
  100% {
    transform: rotate(360deg) translateX(0) translateY(0);
  }
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(40px) brightness(0.9);
  transform: scale(1.2);
  opacity: 0.3;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 20%, rgba(0,0,0,0.05) 100%);
}

.call-header {
  padding: 40px 20px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 10;
}

.header-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.partner-info {
  text-align: center;
  position: relative;
  z-index: 10;
}

.partner-info .name {
  font-size: 20px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.partner-info .info {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 4px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.visual-area {
  flex: 1;
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column; /* Vertical stack */
  padding-top: 20px;
}

.video-container-full-screen {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
}

.main-video-view {
    width: 100%;
    height: 100%;
}

.main-img-full {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.self-video-pip {
    position: absolute;
    top: 90px;
    right: 15px;
    width: 110px;
    height: 165px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 25px rgba(0,0,0,0.6);
    border: 1.5px solid rgba(255,255,255,0.3);
    z-index: 10;
    background: #111;
    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.camera-feed-pip, .virtual-avatar-pip {
    width: 100%;
    height: 100%;
    position: relative;
}

.pip-video-feed, .pip-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.pip-label {
    position: absolute;
    bottom: 6px;
    right: 6px;
    font-size: 10px;
    background: rgba(0,0,0,0.4);
    color: white;
    padding: 1px 5px;
    border-radius: 4px;
    backdrop-filter: blur(4px);
}

.avatar-large {
  width: 100px; /* Shrunk from 140px */
  height: 100px;
  border-radius: 50%;
  box-shadow: 0 0 30px rgba(7, 193, 96, 0.4);
  border: 3px solid rgba(255, 255, 255, 0.2);
  z-index: 10;
  position: relative;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  object-fit: cover;
}

.avatar-large.speaking {
    animation: avatar-pulse 2s infinite ease-in-out;
    border-color: rgba(7, 193, 96, 0.6);
    box-shadow: 0 0 50px rgba(7, 193, 96, 0.6);
}

@keyframes avatar-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

.voice-status-labels {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    width: 100%;
}

.active-status-label {
    font-size: 16px;
    letter-spacing: 1px;
    opacity: 0.8;
}

.incoming-status-label {
    text-align: center;
    font-size: 16px;
    opacity: 0.9;
}

.incoming-status-label .call-type {
    font-size: 14px;
    opacity: 0.7;
    margin-top: 4px;
}

/* Cute compact STT bubble */
.stt-bubble-cute {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.25);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.35);
    padding: 8px 16px;
    border-radius: 24px;
    color: #fff;
    font-size: 13.5px;
    max-width: 85%;
    text-align: left;
    box-shadow: 
        0 4px 15px rgba(0,0,0,0.1),
        inset 0 1px 2px rgba(255,255,255,0.3);
}

.stt-icon-wrap {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #55efc4, #00b894);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(85, 239, 196, 0.35);
    animation: stt-pulse 1.5s infinite;
}
@keyframes stt-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 2px 10px rgba(85, 239, 196, 0.35); }
    50% { transform: scale(1.08); box-shadow: 0 2px 18px rgba(85, 239, 196, 0.6); }
}

.incoming-controls {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.video-off-placeholder, .video-preview-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    position: relative;
    z-index: 5;
    text-align: center;
}

.incoming-buttons {
    display: flex;
    gap: 60px;
    align-items: center;
    justify-content: center;
}

.incoming-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
}

.incoming-btn i {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all 0.3s ease;
}

.incoming-btn span {
    font-size: 14px;
    color: white;
    opacity: 0.8;
}

.accept-btn i {
    background: rgba(7, 193, 96, 0.8);
    color: white;
    box-shadow: 0 0 20px rgba(7, 193, 96, 0.6);
}

.reject-btn i {
    background: rgba(255, 77, 79, 0.8);
    color: white;
    box-shadow: 0 0 20px rgba(255, 77, 79, 0.6);
}

.accept-btn:hover i {
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(7, 193, 96, 0.8);
}

.reject-btn:hover i {
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(255, 77, 79, 0.8);
}

.transcript-box {
    position: relative;
    flex: 1;
    margin: 10px 20px;
    padding: 20px 10px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: transparent;
    z-index: 10;
    scrollbar-width: none; 
    -ms-overflow-style: none;
    -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
    mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
}
.transcript-box::-webkit-scrollbar { display: none; }

.transcript-line {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-width: 85%;
}

.transcript-line.is-user {
    align-self: flex-end;
    align-items: flex-end;
}

.speech-bubble {
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    padding: 10px 14px;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    line-height: 1.4;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.05);
}

.bracket-text {
    font-size: 0.9em;
    opacity: 0.7;
    font-style: italic;
    color: #ccc;
    margin: 0 2px;
}

.transcript-line.is-user .speech-bubble {
    background: rgba(7, 193, 96, 0.6);
    border-color: rgba(7, 193, 96, 0.3);
}

.role-label-ai {
    font-weight: bold;
    color: #fff;
    opacity: 0.9;
    margin-right: 4px;
}

.role-label-user {
    color: #95EC69;
    margin-right: 6px;
    font-weight: bold;
}

.action-hint {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
}

/* ========================================
   🌸 KAWAII CONTROL BUTTONS - 小清新可爱风格
   ======================================== */

/* Control container */
.call-controls-container {
  padding: 16px 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 20;
}

/* Row layout - force horizontal */
.cute-row {
    display: flex !important;
    flex-direction: row !important;
    justify-content: center !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 10px !important;
    padding: 4px 8px;
}

/* Each button - soft pill shape, not boring circle! */
.cute-control-btn {
    background: none;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    padding: 8px 6px;
    border-radius: 18px;
    min-width: 62px;
}

.cute-control-btn:hover { transform: translateY(-4px) scale(1.05); }
.cute-control-btn:active { transform: scale(0.92) translateY(0); }

/* Icon capsule - soft pastel pill shape */
.btn-icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 16px; /* Squircle - softer than perfect circle */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    /* Default: warm white glassmorphism */
    background: linear-gradient(145deg, rgba(255,255,255,0.45), rgba(255,255,255,0.2));
    backdrop-filter: blur(14px);
    border: 1.5px solid rgba(255,255,255,0.4);
    box-shadow:
        0 4px 15px rgba(0,0,0,0.08),
        0 1px 3px rgba(0,0,0,0.05),
        inset 0 1px 2px rgba(255,255,255,0.6);
    color: #555;
}

/* Label text */
.btn-label {
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.8px;
    opacity: 0.6;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* ========================================
   🎤 MIC BUTTON - Mint Green (薄荷绿)
   ======================================== */
.mic-btn .btn-icon-circle {
    background: linear-gradient(145deg, #a8e6cf, #88d8b0);
    box-shadow:
        0 4px 16px rgba(134, 216, 176, 0.4),
        0 1px 3px rgba(0,0,0,0.06),
        inset 0 1px 2px rgba(255,255,255,0.5);
    color: #1a5c42;
    border-color: rgba(255,255,255,0.45);
}
.mic-btn .btn-label { color: #a8e6cf; opacity: 0.9; }

.mic-btn.active .btn-icon-circle,
.mic-btn.is-listening .btn-icon-circle {
    background: linear-gradient(145deg, #55efc4, #00b894);
    box-shadow:
        0 6px 24px rgba(85, 239, 196, 0.5),
        0 0 40px rgba(85, 239, 196, 0.15),
        inset 0 1px 2px rgba(255,255,255,0.4);
    color: white;
}
.mic-btn.active .btn-label { color: #55efc4; opacity: 1; font-weight: 700; }

.mic-btn.muted .btn-icon-circle {
    background: linear-gradient(145deg, #ffcfcf, #fab1a0);
    box-shadow: 0 4px 16px rgba(250, 177, 160, 0.35), inset 0 1px 2px rgba(255,255,255,0.4);
    color: #a33;
}
.mic-btn.muted .btn-label { color: #fab1a0; }

.mic-btn.is-listening .btn-icon-circle {
    animation: mic-breathe 2s ease-in-out infinite;
}
@keyframes mic-breathe {
    0%, 100% { box-shadow: 0 6px 24px rgba(85, 239, 196, 0.5), 0 0 40px rgba(85, 239, 196, 0.15); }
    50% { box-shadow: 0 6px 28px rgba(85, 239, 196, 0.7), 0 0 50px rgba(85, 239, 196, 0.25); transform: scale(1.03); }
}

/* ========================================
   🔊 SPEAKER BUTTON - Sky Blue (天空蓝)
   ======================================== */
.speaker-btn .btn-icon-circle {
    background: linear-gradient(145deg, #a8d8ea, #88c8dc);
    box-shadow: 0 4px 16px rgba(136, 200, 220, 0.4), inset 0 1px 2px rgba(255,255,255,0.5);
    color: #1a4c5c;
    border-color: rgba(255,255,255,0.45);
}
.speaker-btn .btn-label { color: #a8d8ea; opacity: 0.9; }

.speaker-btn.active .btn-icon-circle {
    background: linear-gradient(145deg, #74b9ff, #0984e3);
    box-shadow: 0 6px 24px rgba(116, 185, 255, 0.5), 0 0 30px rgba(116,185,255,0.15);
    color: white;
}
.speaker-btn.active .btn-label { color: #74b9ff; opacity: 1; font-weight: 700; }

/* ========================================
   ⌨️ KEYBOARD BUTTON - Lavender (薰衣草紫)
   ======================================== */
.keyboard-btn .btn-icon-circle {
    background: linear-gradient(145deg, #d4bbff, #c4a7e8);
    box-shadow: 0 4px 16px rgba(196, 167, 232, 0.4), inset 0 1px 2px rgba(255,255,255,0.5);
    color: #3c1e5c;
    border-color: rgba(255,255,255,0.45);
}
.keyboard-btn .btn-label { color: #d4bbff; opacity: 0.9; }

.keyboard-btn.active .btn-icon-circle {
    background: linear-gradient(145deg, #a29bfe, #6c5ce7);
    box-shadow: 0 6px 24px rgba(162, 155, 254, 0.5), 0 0 30px rgba(162,155,254,0.15);
    color: white;
}
.keyboard-btn.active .btn-label { color: #a29bfe; opacity: 1; font-weight: 700; }

/* ========================================
   📹 CAMERA BUTTON - Warm Yellow (暖阳黄)
   ======================================== */
.camera-btn .btn-icon-circle {
    background: linear-gradient(145deg, #ffeaa7, #fdcb6e);
    box-shadow: 0 4px 16px rgba(253, 203, 110, 0.35), inset 0 1px 2px rgba(255,255,255,0.5);
    color: #8a6d20;
    border-color: rgba(255,255,255,0.45);
}
.camera-btn.active .btn-icon-circle {
    background: linear-gradient(145deg, #ffd93d, #f0b429);
    box-shadow: 0 6px 20px rgba(240, 180, 41, 0.45);
    color: #5c4300;
}

/* Avatar toggle */
.avatar-toggle-btn .btn-icon-circle {
    background: linear-gradient(145deg, #f8b4d4, #f093c2);
    box-shadow: 0 4px 16px rgba(240, 147, 194, 0.35), inset 0 1px 2px rgba(255,255,255,0.5);
    color: #5c1e3c;
}
.avatar-toggle-btn.active .btn-icon-circle {
    background: linear-gradient(145deg, #fd79a8, #e84393);
    box-shadow: 0 6px 22px rgba(232, 67, 147, 0.45);
    color: white;
}

/* ========================================
   📞 HANGUP BUTTON - Coral Rose (珊瑚红)
   ======================================== */
.hangup-btn { margin-top: 0; }
.hangup-btn .btn-icon-circle {
    width: 50px !important;
    height: 50px !important;
    border-radius: 50% !important; /* Circle for hangup - universal symbol */
    background: linear-gradient(145deg, #ff7675, #d63031) !important;
    color: white !important;
    border: none !important;
    box-shadow:
        0 5px 20px rgba(214, 48, 49, 0.4),
        0 0 35px rgba(214, 48, 49, 0.12) !important;
    animation: hangup-soft-glow 2.5s ease-in-out infinite;
}
.hangup-btn:hover .btn-icon-circle {
    transform: scale(1.08);
    box-shadow:
        0 8px 28px rgba(214, 48, 49, 0.5),
        0 0 45px rgba(214, 48, 49, 0.2) !important;
}
.hangup-btn:active .btn-icon-circle {
    transform: scale(0.92);
}
.hangup-label {
    color: #ff7675 !important;
    opacity: 0.95 !important;
    font-weight: 700 !important;
}
@keyframes hangup-soft-glow {
    0%, 100% { box-shadow: 0 5px 20px rgba(214, 48, 49, 0.4), 0 0 35px rgba(214, 48, 49, 0.12); }
    50% { box-shadow: 0 5px 24px rgba(214, 48, 49, 0.52), 0 0 42px rgba(214, 48, 49, 0.18); }
}

.hangup-row {
  display: flex;
  justify-content: center;
}

/* (hangup-btn old large-circle styles removed - now using cute-control-btn.hangup-btn) */

@keyframes hangup-ping {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
}

.call-input-bar {
    display: flex;
    gap: 10px;
    padding: 0 20px;
}

.call-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 10px 15px;
    color: white;
    outline: none;
    backdrop-filter: blur(5px);
}

.send-btn, .generate-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #07c160;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.generate-btn { background: #10b981; }

.voice-layout-container {
    flex: 0 0 auto; /* Don't take up too much space - let transcript have room */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start; /* Align to top */
    gap: 8px;
    padding-top: 5px;
}

/* Cute compact avatar */
.avatar-wrapper-cute {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.avatar-ring {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255,255,255,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 
        0 4px 20px rgba(253, 121, 168, 0.35),
        0 0 40px rgba(253, 121, 168, 0.15),
        inset 0 2px 10px rgba(255,255,255,0.5);
}

.avatar-cute {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.7);
    object-fit: cover;
    /* Now positioned inside ring via flex center */
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.avatar-cute.speaking {
    animation: cute-bounce 1.6s infinite ease-in-out;
    box-shadow: 
        0 0 20px rgba(253, 148, 178, 0.6),
        0 0 40px rgba(253, 148, 178, 0.25);
}

@keyframes cute-bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
}

/* Sparkles around avatar */
.sparkle {
    position: absolute;
    font-size: 14px;
    color: #ffd700;
    animation: sparkle-twinkle 2s ease-in-out infinite;
    z-index: 3;
}
.sparkle-1 { top: -4px; right: 2px; font-size: 16px; animation-delay: 0s; }
.sparkle-2 { bottom: 2px; left: -4px; font-size: 13px; animation-delay: 0.7s; }
.sparkle-3 { top: 50%; right: -6px; font-size: 11px; animation-delay: 1.4s; }

@keyframes sparkle-twinkle {
    0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
    50% { opacity: 1; transform: scale(1.2) rotate(18deg); }
}

/* Status badge under avatar */
.avatar-status-badge {
    font-size: 12px;
    color: #fff;
    background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
    padding: 3px 14px;
    border-radius: 20px;
    letter-spacing: 1px;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0,0,0,0.2);
    box-shadow: 0 2px 10px rgba(232, 67, 147, 0.3);
    white-space: nowrap;
}
.dialing-badge { background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%); }
.incoming-badge { background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); }

.pulse-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fff;
    margin-right: 5px;
    vertical-align: middle;
    animation: dot-pulse 1.5s infinite;
}
@keyframes dot-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
}

/* Fix squashed buttons in input bar */
.send-btn, .generate-btn {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #07c160;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
}

.send-btn:disabled, .generate-btn:disabled {
    background: #333 !important;
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none !important;
}

.generate-btn { background: #10b981; }

/* Control buttons fix */
.control-btn {
    flex-shrink: 0;
    width: 70px;
    /* ... existing ... */
}

/* User specifically requested MUTE turn GREEN to show it is 'closed'/active-state-of-muting */
.control-btn.is-muted-active i {
    background: #07c160;
    color: white;
    box-shadow: 0 0 15px rgba(7, 193, 96, 0.5);
}

.hangup-control-btn i {
    background: #ff4d4f;
    color: white;
    box-shadow: 0 0 15px rgba(255, 77, 79, 0.5);
}

.hangup-control-btn:hover i {
    background: #ff7875;
    box-shadow: 0 0 20px rgba(255, 77, 79, 0.7);
}

@keyframes wave-ping {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(2.2); opacity: 0; }
}


.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.animate-fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
