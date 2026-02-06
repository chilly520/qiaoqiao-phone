<script setup>
import { useCallStore } from '../stores/callStore'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chatStore'

const callStore = useCallStore()
const chatStore = useChatStore()
const isExpanded = ref(true) // Always expanded now by default
const userInput = ref('')

const sendText = async () => {
    if (!userInput.value.trim() || !partner.value) return
    
    // Send to chat system (will be captured by store as transcript line too, 
    // but we might want to filter it from visualizer depending on preference)
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

const toggleMute = () => callStore.toggleMute()
const toggleSpeaker = () => callStore.toggleSpeaker()
const toggleCamera = () => callStore.toggleCamera()


const scrollContainer = ref(null)

const cleanLineContent = (text) => {
    if (!text) return ''
    // Remove protocol tags and bracketed system labels
    return text.replace(/\[CALL_START\]|\[CALL_END\]|\[INNER_VOICE\]|\[\/INNER_VOICE\]/gi, '')
               .replace(/\{[\s\S]*?}/g, '') // Remove any raw JSON that leaked
               .trim()
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
            if (isListening.value) {
                try { recognition.start() } catch(e) {}
            }
        }

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error)
            isListening.value = false
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                 chatStore.triggerToast('麦克风权限被拒绝或不可用，请在浏览器地址栏左侧开启权限。', 'warning')
            } else if (event.error === 'no-speech') {
                 // Ignore "no speech" to keep listening if it was intended
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
            recognition.start()
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
            }
        }
    } else {
        initRecognition()
        recognition?.start()
        isListening.value = true
        callStore.isMuted = false
    }
}

const stopListening = () => {
    try {
        recognition?.stop()
    } catch(e) {}
    isListening.value = false
    interimTranscript.value = ''
    callStore.isMuted = true // Mute store state
}

// Watch mute state changes from store (e.g. if toggled elsewhere)
watch(() => callStore.isMuted, (newVal) => {
    if (newVal && isListening.value) {
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
    isVirtualAvatarMode.value = !isVirtualAvatarMode.value
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
      <!-- Background (Blurred Partner Avatar or Video Feed) -->
      <div class="call-background">
        <img :src="partner?.avatar" class="bg-image" alt="Background">
        <div class="bg-overlay"></div>
      </div>

      <!-- Header (Status & Partner) -->
      <div class="call-header">
        <button class="header-btn minimize-btn" @click="handleMinimize">
            <i class="fa-solid fa-compress"></i>
        </button>
        <div class="partner-info">
          <div class="name">{{ partner?.name }}</div>
          <div class="info" :class="{ 'text-green-400': chatStore.isTyping || callStore.isSpeaking }">
            {{ 
                status === 'dialing' ? '正在呼叫...' : 
                status === 'ended' ? '通话已结束' :
                isListening ? '对方正在聆听...' :
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
        
        <!-- CASE 1: Voice Call Layout -->
        <template v-if="callStore.type === 'voice'">
            <div class="voice-layout-container">
               <div class="avatar-wrapper">
                   <div class="voice-aura">
                        <div class="wave wave1"></div>
                        <div class="wave wave2"></div>
                        <div class="wave wave3"></div>
                   </div>
                   <img :src="partner?.avatar" class="avatar-large" :class="{ 'speaking': callStore.isSpeaking }">
               </div>
               <div class="voice-status-labels">
                   <div v-if="status === 'active'" class="active-status-label animate-fade-in">正在通话...</div>
                   <div v-else-if="status === 'dialing'" class="dialing-status-label animate-fade-in">正在呼叫对方...</div>
                   
                   <!-- Real-time STT display bubble -->
                   <div v-if="isListening && interimTranscript" class="stt-feedback-bubble animate-fade-in">
                       <i class="fa-solid fa-microphone text-green-400 mr-2"></i>
                       {{ interimTranscript }}
                   </div>
               </div>
            </div>
        </template>


        <!-- CASE 2: Video Call Layout -->
        <template v-else>
            <!-- Background if camera off -->
            <div v-if="callStore.isCameraOff && !isVirtualAvatarMode" class="video-off-placeholder">
                <i class="fa-solid fa-video-slash text-4xl mb-4 opacity-20"></i>
                <div class="text-sm opacity-40">摄像头已关闭</div>
            </div>

            <div v-else class="video-container-full">
                <!-- 2A: Virtual Avatar Mode -->
                <div v-if="isVirtualAvatarMode" class="virtual-avatar-split">
                     <div class="virtual-half char-half">
                         <img :src="callStore.customCallAvatarChar || partner?.avatar" class="virtual-img">
                         <div class="half-label">{{ partner?.name }}</div>
                     </div>
                     <div class="virtual-half user-half">
                         <img :src="callStore.customCallAvatarUser || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'" class="virtual-img">
                         <div class="half-label">我</div>
                     </div>
                </div>

                <!-- 2B: Real Camera Feed -->
                <div v-else class="camera-feed-full">
                    <video ref="videoElement" autoplay playsinline muted class="camera-video"></video>
                </div>
            </div>
        </template>
      </div>

      <!-- Dialogue / Transcript Box (Subtitles) -->
      <div class="transcript-box list-mode" ref="scrollContainer">
         <div v-for="(line, index) in transcriptList" :key="index" 
              class="transcript-line animate-fade-in" 
              :class="{ 'is-user': line.role === 'user' }">
             <div class="speech-bubble">
                <span v-if="line.role === 'user'" class="role-label-user">我: </span>
                <span v-else class="role-label-ai">{{ partner?.name }}: </span>
                <template v-for="(part, pIdx) in line.parts" :key="pIdx">
                    <span :class="{ 'bracket-text': part.type === 'bracket' }">{{ part.text }}</span>
                </template>
             </div>
             <div v-if="line.action" class="action-hint">
                ({{ line.action }})
             </div>
         </div>
      </div>
        
        <div class="call-controls-container">
            <!-- Main Controls -->
            <div class="control-row main-controls">
                
                <!-- Mic / STT -->
                <button class="control-btn" 
                        :class="{ 
                            active: isListening, 
                            'is-listening': isListening,
                            'is-muted-active': callStore.isMuted 
                        }" 
                        @click="toggleMic">
                    <i class="fa-solid" :class="callStore.isMuted ? 'fa-microphone-slash' : 'fa-microphone'"></i>
                    <span>{{ callStore.isMuted ? '已静音' : '听得见' }}</span>
                </button>


                <!-- Speaker (Visual Toggle) -->
                <button class="control-btn" :class="{ active: callStore.isSpeakerOn }" @click="toggleSpeaker">
                    <i class="fa-solid" :class="callStore.isSpeakerOn ? 'fa-volume-high' : 'fa-ear-listen'"></i>
                    <span>{{ callStore.isSpeakerOn ? '免提' : '听筒' }}</span>
                </button>

                <!-- Video Toggles (Only show for video call) -->
                <template v-if="callStore.type === 'video'">
                    <!-- Camera Toggle -->
                    <button class="control-btn" :class="{ active: !callStore.isCameraOff }" @click="toggleCameraFunc">
                        <i class="fa-solid" :class="!callStore.isCameraOff ? 'fa-video' : 'fa-video-slash'"></i>
                        <span>{{ !callStore.isCameraOff ? '视频中' : '摄像头' }}</span>
                    </button>

                    <!-- Virtual Avatar Toggle -->
                    <button class="control-btn" :class="{ active: isVirtualAvatarMode }" @click="toggleVirtualAvatar">
                        <i class="fa-solid fa-image"></i>
                        <span>虚拟形象</span>
                    </button>
                </template>

                 <!-- Keyboard Toggle -->
                <button class="control-btn" :class="{ active: isKeyboardVisible }" @click="toggleKeyboard">
                    <i class="fa-solid fa-keyboard"></i>
                    <span>键盘</span>
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
                <button class="send-btn" @click="sendText" :disabled="!userInput.trim()">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
                 <!-- Generate button still useful if user types but wants to trigger AI explicitly -->
                <button class="generate-btn" @click="handleGenerate">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </button>
            </div>

            <!-- Hangup -->
            <div class="hangup-row">
                 <button class="hangup-btn" @click="handleHangup">
                    <i class="fa-solid fa-phone-slash"></i>
                 </button>
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
  z-index: -1;
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(40px) brightness(0.4);
  transform: scale(1.2);
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 20%, rgba(0,0,0,0.6) 100%);
}

.call-header {
  padding: 40px 20px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}

.partner-info .name {
  font-size: 20px;
  font-weight: 600;
}

.partner-info .info {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 4px;
}

.visual-area {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column; /* Vertical stack */
  padding-top: 20px;
}

.video-container-full {
    position: absolute;
    inset: 0;
    z-index: 1; /* Above background but below controls */
    display: flex;
    flex-direction: column;
}

.camera-feed-full {
    width: 100%;
    height: 100%;
    background: black;
}

.camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.virtual-avatar-split {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: #000;
}

.virtual-half {
    flex: 1;
    overflow: hidden;
    position: relative;
}

.virtual-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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

.stt-feedback-bubble {
    background: rgba(7, 193, 96, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(7, 193, 96, 0.4);
    padding: 10px 20px;
    border-radius: 20px;
    color: #fff;
    font-size: 15px;
    max-width: 80%;
    text-align: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
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

.call-controls-container {
  padding: 30px 20px 50px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
  position: relative;
  z-index: 20;
}

.main-controls {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.control-btn {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: white;
  cursor: pointer;
  width: 70px;
  transition: all 0.2s ease;
}

.control-btn i {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
}

.control-btn.active i {
  background: #07c160;
  box-shadow: 0 0 15px rgba(7, 193, 96, 0.5);
}

.control-btn.active.is-listening i {
    animation: pulse-mic 1.5s infinite;
}

@keyframes pulse-mic {
    0% { box-shadow: 0 0 0 0 rgba(7, 193, 96, 0.7); }
    70% { box-shadow: 0 0 0 12px rgba(7, 193, 96, 0); }
    100% { box-shadow: 0 0 0 0 rgba(7, 193, 96, 0); }
}

.control-btn span {
  font-size: 11px;
  opacity: 0.8;
  font-weight: 500;
}

.hangup-row {
  display: flex;
  justify-content: center;
}

.hangup-btn {
  width: 72px;
  height: 72px;
  background: #ff4d4f;
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(255, 77, 79, 0.4);
  transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
  position: relative;
}

.hangup-btn:hover {
    transform: scale(1.1) rotate(-10deg);
    box-shadow: 0 12px 35px rgba(255, 77, 79, 0.5);
    background: #ff7875;
}

.hangup-btn:active {
    transform: scale(0.9);
}

.hangup-btn::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid rgba(255, 77, 79, 0.3);
    animation: hangup-ping 2s infinite;
}

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
    flex: 0.6; /* Balanced ratio to give transcript box more room */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px; /* Tighter gap */
    margin-top: 10px;
}


.avatar-wrapper {
    position: relative;
    width: 120px; 
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.avatar-large {
  width: 80px; 
  height: 80px;
  border-radius: 50%;
  box-shadow: 0 0 30px rgba(7, 193, 96, 0.4);
  border: 3px solid rgba(255, 255, 255, 0.2);
  z-index: 10;
  position: relative;
  transition: all 0.3s ease;
  object-fit: cover;
}

.avatar-large.speaking {
  box-shadow: 0 0 50px rgba(7, 193, 96, 0.8);
  transform: scale(1.05);
}

.voice-aura {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.wave {
    position: absolute;
    width: 80px; 
    height: 80px;
    border-radius: 50%;
    background: rgba(7, 193, 96, 0.2);
    animation: wave-ping 3s infinite ease-out;
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
