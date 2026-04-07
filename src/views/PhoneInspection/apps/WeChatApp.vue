<template>
    <div class="wechat-app flex flex-col h-full bg-[#EDEDED] relative overflow-hidden">

        <!-- ===== View: 朋友圈 (角色个人主页) ===== -->
        <div v-if="currentView === 'moments'" class="flex-1 flex flex-col overflow-hidden bg-white">
            <MomentsView :initial-profile-id="resolvedCharKey" @back="currentView = 'main'" />
        </div>

        <!-- ===== View: 聊天详情 (镜像主微信) ===== -->
        <div v-else-if="activeChatId" class="flex-1 flex flex-col overflow-hidden animate-slide-right relative z-40 bg-[#EDEDED]">
            <div class="flex items-center px-4 pt-14 pb-2.5 bg-[#EDEDED] border-b border-[#D6D6D6]">
                <button @click="activeChatId = null" class="w-9 h-9 flex items-center justify-center -ml-1 active:opacity-60 transition-opacity">
                    <i class="fa-solid fa-chevron-left text-lg text-black"></i>
                </button>
                <span class="flex-1 text-center font-bold text-[17px] leading-tight text-black truncate pr-8">{{ activeChatName }}</span>
            </div>

            <div ref="chatRef" class="flex-1 overflow-y-auto p-4 space-y-0 bg-[#EDEDED]" @scroll="handleChatScroll">
                <template v-for="(msg, index) in chatMessages" :key="msg.id || index">
                    <ChatMessageItem
                        :msg="msg"
                        :chat-data="chatDataForItem"
                        :index="index"
                        @toggle-select="() => {}"
                        @dblclick-avatar="() => {}"
                        @contextmenu-item="() => {}"
                    />
                </template>
                <div v-if="chatMessages.length === 0" class="flex flex-col items-center justify-center py-24 text-gray-300">
                    <i class="fa-regular fa-comment-dots text-4xl mb-3 opacity-30"></i>
                    <p class="text-sm">暂无聊天记录</p>
                </div>
            </div>

            <div class="shrink-0 px-3 py-2 bg-[#F7F7F7] border-t border-[#DCDCDC]">
                <div class="flex items-end gap-2">
                    <input v-model="sneakMessage" type="text"
                        placeholder="偷偷发一条消息..."
                        class="flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 outline-none text-sm text-gray-700 placeholder-gray-400"
                        maxlength="500" @keyup.enter="sendSneakMessage" :disabled="isSendingSneak">
                    <button @click="sendSneakMessage"
                        :disabled="!sneakMessage.trim() || isSendingSneak"
                        class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90"
                        :class="sneakMessage.trim() && !isSendingSneak ? 'bg-[#07c160] text-white' : 'bg-gray-100 text-gray-300'">
                        <i class="fa-solid fa-paper-plane text-sm"></i>
                    </button>
                </div>
                <p class="text-[9px] text-red-400/50 mt-1 ml-1">对方会看到这条消息</p>
            </div>
        </div>

        <!-- ===== View: 主界面 ===== -->
        <div v-else class="flex-1 flex flex-col overflow-hidden">

            <!-- 顶部导航栏 -->
            <div class="px-4 pt-12 pb-2 bg-[#EDEDED] flex items-center gap-3">
                <button @click="$emit('back')" class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors -ml-1">
                    <i class="fa-solid fa-chevron-left text-base text-black"></i>
                </button>
                <div class="flex-1 h-8 bg-white/90 backdrop-blur-sm rounded-md px-3 flex items-center shadow-sm">
                    <i class="fa-solid fa-magnifying-glass text-gray-350 text-xs mr-2"></i>
                    <span class="text-xs text-gray-400">搜索</span>
                </div>
                <button class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors">
                    <i class="fa-solid fa-circle-plus text-base text-black"></i>
                </button>
            </div>

            <!-- Tab栏 -->
            <div class="flex px-4 pt-2 pb-1 bg-[#EDEDED]">
                <button class="pb-2 mr-5 text-base relative transition-colors"
                    :class="mainTab === 'wechat' ? 'font-bold text-black' : 'text-black/45'"
                    @click="mainTab = 'wechat'">
                    微信
                    <div v-if="mainTab === 'wechat'" class="absolute bottom-0 left-0 right-0 h-[3px] bg-[#07C160] rounded-full"></div>
                </button>
                <button class="pb-2 text-base relative transition-colors"
                    :class="mainTab === 'moments' ? 'font-bold text-black' : 'text-black/45'"
                    @click="enterMoments()">
                    朋友圈
                    <div v-if="mainTab === 'moments'" class="absolute bottom-0 left-0 right-0 h-[3px] bg-[#07C160] rounded-full"></div>
                </button>
            </div>

            <!-- 聊天列表 -->
            <div class="flex-1 overflow-y-auto bg-white">
                <!-- 与用户的对话 (主私聊) -->
                <div class="flex items-center gap-3 px-4 py-[11px] cursor-pointer transition-colors active:bg-[#ECECEC] border-b border-[#EFEEED]"
                    @click="openUserChat()">
                    <img :src="userAvatar || defaultAvatar" class="w-11 h-11 rounded-[6px] object-cover bg-[#EDEDED] shrink-0" loading="lazy">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-0.5">
                            <span class="text-[16px] text-black truncate max-w-[55%]">{{ userName }}</span>
                            <span class="text-[11px] text-[#B2B2B2]">{{ lastMsgTime }}</span>
                        </div>
                        <p class="text-[13px] text-[#B2B2B2] truncate">{{ lastMsgPreview || '点击查看聊天' }}</p>
                    </div>
                </div>

                <!-- 其他会话记录 (群聊、其他角色等) -->
                <div v-for="conv in otherFullConvs" :key="conv.id"
                    class="flex items-center gap-3 px-4 py-[11px] cursor-pointer transition-colors active:bg-[#ECECEC] border-b border-[#EFEEED]"
                    @click="openChat(conv)">
                    <img :src="conv.avatar || defaultAvatar" class="w-11 h-11 rounded-[6px] object-cover bg-[#EDEDED] shrink-0" loading="lazy">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-0.5">
                            <span class="text-[16px] text-black truncate max-w-[55%]">{{ conv.name }}</span>
                            <span class="text-[11px] text-[#B2B2B2]">{{ conv.time }}</span>
                        </div>
                        <p class="text-[13px] text-[#B2B2B2] truncate">{{ conv.lastMsg || '[消息]' }}</p>
                    </div>
                </div>

                <div v-if="chatMessages.length === 0 && otherFullConvs.length === 0" class="flex flex-col items-center justify-center py-16 text-[#B2B2B2]">
                    <i class="fa-regular fa-comment-dots text-3xl mb-2 opacity-30"></i>
                    <p class="text-xs">暂无聊天记录</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import ChatMessageItem from '@/views/WeChat/components/ChatMessageItem.vue'
import MomentsView from '@/views/WeChat/MomentsView.vue'

const props = defineProps({
    wechatData: Object,
    charName: String,
    charAvatar: String,
    charId: String
})

defineEmits(['back', 'sneak-message-sent'])

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

// ========== 视图状态 ==========
const currentView = ref('main')
const mainTab = ref('wechat')
const activeChatId = ref(null)
const sneakMessage = ref('')
const isSendingSneak = ref(false)
const chatRef = ref(null)

// ========== 核心数据：精确匹配当前角色 ==========
function findCharChat(targetId) {
    if (!targetId) return null
    if (chatStore.chats[targetId]) return { chat: chatStore.chats[targetId], key: targetId }
    const idStr = String(targetId)
    for (const [k, c] of Object.entries(chatStore.chats)) {
        if (String(k) === idStr || c.id === targetId || String(c.id) === idStr ||
            c.wechatId === targetId || c.wechatId === idStr || c.name === targetId) {
            return { chat: c, key: k }
        }
    }
    return null
}

// 严格匹配：不用fallback，找不到就是找不到
const charData = computed(() => findCharChat(props.charId))
const charChat = computed(() => charData.value?.chat || null)
const resolvedCharKey = computed(() => charData.value?.key || props.charId)

// ========== 用户信息 ==========
const userName = computed(() => {
    // 优先从同步过来的联系人数据中找备注（比如：老婆大人）
    const userInContacts = props.wechatData?.contacts?.find(c => c.id === 'user')
    if (userInContacts?.remark) return userInContacts.remark
    
    if (charChat.value?.userName) return charChat.value.userName
    const n = settingsStore.personalization?.userProfile?.name
    return (n && n !== '我') ? n : '我'
})
const userAvatar = computed(() => charChat.value?.userAvatarUrl || charChat.value?.userAvatar || settingsStore.personalization?.userProfile?.avatar || '')
const defaultAvatar = computed(() => props.charAvatar || '')

// ========== 聊天消息（镜像：从角色视角看，用户消息在左，角色自己的消息在右）==========
// 同时过滤掉隐藏类消息（心声/system/recall等），避免残留空时间戳
const chatMessages = computed(() => {
    if (!charChat.value) return []
    const msgs = charChat.value.msgs
    if (!Array.isArray(msgs) || msgs.length === 0) return []

    return msgs
        .filter(msg => {
            // 排除明确隐藏的
            if (msg.hidden) return false
            // 排除 system 类型（系统提示等）
            if (msg.role === 'system' || msg.type === 'system') return false
            // 排除已撤回
            if (msg.isRecalled || msg.recalled) return false
            // 排除心声/内心戏（包含 status/心声/着装 等JSON字段的）
            const raw = String(msg.content || '')
            if (/^\s*\{.*"(status|心声|着装|环境|行为|stats|mind|outfit|scene|action|thoughts)"\s*:/.test(raw)) return false
            // 排除纯标签无内容的
            const cleaned = raw.replace(/\[([^\]]*)\]/g, '').trim()
            if (!cleaned && !msg.image && !msg.type?.match(/^(image|voice|music|card|redpacket|transfer|gift)/)) return false
            return true
        })
        .map((msg, idx) => {
            const isFromUser = msg.role === 'user'
            const mirroredRole = isFromUser ? 'ai' : 'user'
            return { ...msg, id: msg.id || ('msg-' + idx), timestamp: msg.timestamp || Date.now(), role: mirroredRole }
        })
})

// ========== 最后一条消息预览 ==========
const lastMsgPreview = computed(() => getLastMsgPreview(chatMessages.value))
const lastMsgTime = computed(() => formatTimeAgo(chatMessages.value))

function getLastMsgPreview(msgs) {
    if (!msgs || msgs.length === 0) return ''
    const last = msgs[msgs.length - 1]
    let content = ''
    if (typeof last.content === 'string') content = last.content
    else if (last.content && typeof last.content === 'object') content = last.content.text || JSON.stringify(last.content)
    else content = String(last.content || '')
    return content.replace(/\[.*?\]/g, '').replace(/\n/g, ' ').trim().substring(0, 30) || '[消息]'
}

function formatTimeAgo(msgs) {
    if (!msgs || msgs.length === 0) return ''
    const ts = msgs[msgs.length - 1]?.timestamp
    if (!ts) return ''
    const diff = Date.now() - ts
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

// ========== 其他会话数据补全（头像、名称等） ==========
const otherFullConvs = computed(() => {
    const list = props.wechatData?.conversations || []
    return list.filter(c => c.id !== 'user').map(c => { // 排除已手动置顶的 user 对话
        const isGroup = c.isGroup
        let avatar = c.avatar
        let name = c.name

        if (isGroup) {
            avatar = avatar || 'https://cdn-icons-png.flaticon.com/128/33/33308.png'
        } else {
            // 尝试同步系统内已有的头像
            const knownContact = props.wechatData?.contacts?.find(contact => contact.id === c.id)
            if (knownContact) {
                avatar = knownContact.avatar
                name = knownContact.remark || knownContact.name || name
            } else {
                avatar = avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + c.id
            }
        }

        return { ...c, avatar, name }
    })
})

// ========== 当前选中聊天 ==========
const activeChat = computed(() => {
    if (activeChatId.value === 'user-chat' || activeChatId.value === 'user') {
        return { id: 'user', name: userName.value }
    }
    return otherFullConvs.value.find(c => c.id === activeChatId.value)
})
const activeChatName = computed(() => activeChat.value?.name || '')

// ========== ChatMessageItem需要的chatData ==========
const chatDataForItem = computed(() => ({
    id: resolvedCharKey.value,
    name: props.charName || '',
    // 镜像模式：交换头像，让翻转role后头像位置正确
    // ChatMessageItem: 左边显示avatar(对方), 右边显示userAvatar(自己)
    // 角色视角: 左边=用户(应显示userAvatar), 右边=角色(应显示charAvatar) → 交换！
    avatar: userAvatar.value,
    isGroup: false,
    bgTheme: 'light',
    avatarShape: 'rounded',
    userAvatarFrame: null,
    avatarFrame: null,
    userAvatar: props.charAvatar || ''
}))

// ========== 方法 ==========
function enterMoments() {
    mainTab.value = 'moments'
    currentView.value = 'moments'
}

function openUserChat() {
    activeChatId.value = 'user'
    currentView.value = 'chat'
    nextTick(scrollToBottom)
}

function openChat(conv) {
    activeChatId.value = conv.id
    currentView.value = 'chat'
    nextTick(scrollToBottom)
}

async function sendSneakMessage() {
    if (!sneakMessage.value.trim() || isSendingSneak.value) return
    isSendingSneak.value = true
    const msgContent = sneakMessage.value.trim()

    const newMsg = { role: 'user', content: msgContent, type: 'text', timestamp: Date.now(), id: 'sneak-' + Date.now() }

    if (charChat.value) {
        if (!Array.isArray(charChat.value.msgs)) charChat.value.msgs = []
        charChat.value.msgs.push(newMsg)
    }

    sneakMessage.value = ''
    await nextTick()
    scrollToBottom()
    setTimeout(() => { isSendingSneak.value = false }, 800)
}

function scrollToBottom() {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
}
function handleChatScroll() {}

watch(activeChatId, () => { nextTick(scrollToBottom) })
</script>

<style scoped>
.wechat-app {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
}
.animate-slide-right {
    animation: slideRight 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
@keyframes slideRight {
    from { transform: translateX(16px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
</style>
