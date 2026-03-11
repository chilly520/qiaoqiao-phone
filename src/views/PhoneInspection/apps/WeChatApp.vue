<template>
    <div class="wechat-app flex flex-col h-full bg-[#EDEDED] relative overflow-hidden">
        <!-- View 1: Moments Wall (Priority 1) -->
        <div v-if="showMomentsWall" class="flex-1 flex flex-col bg-white overflow-hidden animate-fade-in relative z-50">
            <div class="flex-1 overflow-y-auto">
                <!-- Cover -->
                <div class="relative h-72 bg-gray-200">
                    <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=600"
                        class="w-full h-full object-cover">
                    <button @click="showMomentsWall = false"
                        class="absolute top-16 left-4 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white backdrop-blur-sm active:scale-95">
                        <i class="fa-solid fa-chevron-left text-lg"></i>
                    </button>
                    <div class="absolute bottom-[-20px] right-6 flex items-end gap-3">
                        <span class="mb-6 font-bold text-white text-lg text-shadow">{{ charName }}</span>
                        <img :src="charAvatar" class="w-16 h-16 rounded-xl border-4 border-white shadow-sm bg-gray-50">
                    </div>
                </div>

                <!-- Posts List -->
                <div class="mt-12 px-6 space-y-8 pb-10">
                    <div v-for="(post, idx) in momentsPosts" :key="idx" class="flex gap-4">
                        <div class="flex flex-col items-end w-12 flex-shrink-0">
                            <span class="text-xl font-bold">{{ post.day }}</span>
                            <span class="text-[10px] text-gray-400">{{ post.month }}月</span>
                        </div>
                        <div class="flex-1">
                            <div class="bg-[#F7F7F7] p-3 rounded-2xl mb-2">
                                <p class="text-[14px] text-gray-800 leading-relaxed">{{ post.content }}</p>
                            </div>
                            <div v-if="post.images && post.images.length > 0" class="flex gap-1 flex-wrap">
                                <img v-for="(img, i) in post.images" :key="i" :src="img"
                                    class="w-24 h-24 object-cover rounded-xl shadow-sm">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- View 2: Chat Detailed (Priority 2) -->
        <div v-else-if="activeChatId" class="flex-1 flex flex-col overflow-hidden animate-slide-right relative z-40">
            <!-- Chat Header -->
            <div class="wechat-header flex items-center px-4 pt-16 pb-3 bg-[#EDEDED] border-b border-[#D1D1D1]">
                <button @click="activeChatId = null" class="text-xl mr-4">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="flex-1 text-center truncate">
                    <span class="font-bold text-[17px] leading-tight">{{ activeChatName }}</span>
                </div>
                <button class="text-xl ml-4">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
            </div>

            <!-- Chat History -->
            <div class="chat-container flex-1 overflow-y-auto p-4 space-y-6 bg-[#EDEDED]" ref="chatRef">
                <div v-for="(msg, index) in activeChatHistory" :key="index"
                    :class="['flex items-start', msg.from === 'char' ? 'flex-row-reverse space-x-reverse' : 'flex-row']">

                    <!-- Avatar -->
                    <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                        :class="msg.from === 'char' ? 'ml-3' : 'mr-3'">
                        <img :src="msg.from === 'char' ? charAvatar : getContactAvatar(msg.from)"
                            class="w-full h-full object-cover shadow-sm bg-gray-50">
                    </div>

                    <!-- Sticker (Large Image Only) -->
                    <div v-if="isSticker(msg)" class="max-w-[120px]" @click="selectedMessage = msg">
                        <img :src="getStickerUrl(msg)" class="w-full h-auto rounded-lg animate-bounce-subtle">
                    </div>

                    <!-- Special Cards (Red Packet, Family Card, Shopping, etc.) -->
                    <div v-else-if="isCardMsg(msg)"
                        class="max-w-[70%] rounded-xl overflow-hidden shadow-md active:scale-95 transition-all"
                        :class="getCardBg(msg)" @click="handleCardClick(msg)">
                        <div class="p-3 flex items-start gap-3">
                            <div
                                class="w-10 h-10 flex items-center justify-center text-3xl bg-white/20 rounded-xl shadow-inner">
                                {{ getCardIcon(msg) }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[14px] font-black leading-tight text-white truncate">{{ getCardTitle(msg)
                                    }}</p>
                                <p class="text-[10px] text-white/70 mt-1 font-bold">{{ getCardSub(msg) }}</p>
                            </div>
                        </div>
                        <div
                            class="bg-black/10 px-3 py-1.5 text-[9px] text-white/50 font-black tracking-tighter uppercase">
                            {{ getCardTypeLabel(msg) }}
                        </div>
                    </div>

                    <!-- Bubble (Standard Text with Inner Voice) -->
                    <div v-else-if="getCleanContent(msg.content)" :class="[
                        'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed relative shadow-sm cursor-pointer active:scale-95 transition-transform flex flex-col gap-1',
                        msg.from === 'char' ? 'bg-[#95EC69] text-black bubble-right-fix' : 'bg-white text-black bubble-left-fix',
                        getInnerVoice(msg.content) ? 'border-2 border-pink-200/50' : ''
                    ]" @click="selectedMessage = msg">
                        <!-- Inner Voice (Hidden thoughts beautified) -->
                        <div v-if="getInnerVoice(msg.content)"
                            class="text-[10px] text-pink-500 font-bold italic mb-1 border-b border-pink-100 pb-1">
                            <i class="fa-solid fa-heart mr-1"></i> {{ getInnerVoice(msg.content) }}
                        </div>

                        <span class="font-medium">{{ getCleanContent(msg.content) }}</span>

                        <span
                            class="absolute bottom-[-18px] text-[9px] font-black text-gray-300 whitespace-nowrap tracking-tighter"
                            :class="msg.from === 'char' ? 'right-1' : 'left-1'">
                            {{ msg.time }}
                        </span>
                    </div>

                    <!-- Voice / Other (Simplified) -->
                    <div v-else-if="msg.type === 'voice'" :class="[
                        'w-32 h-10 px-3 rounded-xl flex items-center gap-2 cursor-pointer transition-all',
                        msg.from === 'char' ? 'bg-[#95EC69]' : 'bg-white'
                    ]">
                        <i class="fa-solid fa-waveform"></i>
                        <span class="text-xs font-bold">{{ msg.duration || '5"' }}</span>
                    </div>
                </div>
            </div>

            <!-- Bottom Bar -->
            <div class="wechat-footer bg-[#F7F7F7] border-t border-[#D1D1D1] px-3 pb-8 pt-2 flex items-center gap-3">
                <i class="fa-solid fa-microphone text-2xl text-[#515151]"></i>
                <div class="flex-1 h-9 bg-white rounded-md border border-gray-200"></div>
                <i class="fa-regular fa-face-smile text-2xl text-[#515151]"></i>
                <i class="fa-solid fa-circle-plus text-2xl text-[#515151]"></i>
            </div>
        </div>

        <!-- View 3: Main Tabs (Default) -->
        <div v-else class="flex-1 flex flex-col overflow-hidden animate-fade-in relative z-10">
            <!-- Header -->
            <div
                class="wechat-header flex items-center justify-between px-4 pt-16 pb-3 bg-[#EDEDED] border-b border-[#D1D1D1]">
                <button @click="$emit('back')" class="text-xl">
                    <i class="fa-solid fa-chevron-left text-gray-600"></i>
                </button>
                <span class="font-bold text-[17px]">{{ tabTitle }}</span>
                <button class="text-xl">
                    <i class="fa-solid fa-circle-plus text-gray-600"></i>
                </button>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 overflow-hidden">
                <!-- Chats -->
                <div v-if="currentTab === 'chats'" class="h-full overflow-y-auto">
                    <div v-for="conv in sortedConversations" :key="conv.id"
                        class="flex items-center p-3 bg-white border-b border-gray-100 active:bg-gray-100 cursor-pointer"
                        @click="activeChatId = conv.id">
                        <div class="relative mr-3">
                            <img :src="getContactAvatar(conv.id)"
                                class="w-12 h-12 rounded-lg object-cover shadow-sm bg-gray-50">
                            <div v-if="conv.isGroup"
                                class="absolute -top-1 -right-1 w-4 h-4 bg-gray-200 rounded-md border border-white flex items-center justify-center scale-75">
                                <i class="fa-solid fa-users text-[8px] text-gray-500"></i>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0 pr-2">
                            <div class="flex justify-between mb-1">
                                <span class="font-bold text-[16px] truncate flex items-center gap-1">
                                    {{ getContactName(conv.id) }}
                                    <span v-if="conv.isGroup" class="text-gray-300 text-[12px] font-medium">({{
                                        conv.memberCount || 3 }})</span>
                                </span>
                                <span class="text-[11px] text-gray-400">{{ conv.time }}</span>
                            </div>
                            <div class="text-[13px] text-gray-500 truncate flex items-center">
                                <span v-if="conv.unread > 0"
                                    class="w-2 h-2 bg-red-500 rounded-full mr-1 flex-shrink-0"></span>
                                {{ conv.lastMsg }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Contacts -->
                <div v-else-if="currentTab === 'contacts'" class="h-full overflow-y-auto bg-white">
                    <div class="p-2 bg-[#EDEDED] text-[12px] text-gray-500 px-4">我的好友</div>
                    <div v-for="contact in contacts" :key="contact.id"
                        class="flex items-center p-3 active:bg-gray-50 cursor-pointer border-b border-gray-50"
                        @click="openChatFromContact(contact.id)">
                        <img :src="contact.avatar" class="w-10 h-10 rounded-lg mr-3 object-cover shadow-sm bg-gray-50">
                        <span class="text-[16px] text-gray-800">{{ contact.remark || contact.name }}</span>
                    </div>
                </div>

                <!-- Discover -->
                <div v-else-if="currentTab === 'discover'" class="h-full bg-[#EDEDED]">
                    <div class="bg-white mt-3 border-y border-gray-200">
                        <div class="flex items-center p-4 active:bg-gray-50 cursor-pointer"
                            @click="showMomentsWall = true">
                            <div class="w-8 h-8 rounded-md bg-red-400 flex items-center justify-center mr-4 text-white">
                                <i class="fa-solid fa-camera"></i>
                            </div>
                            <span class="flex-1 text-[16px]">朋友圈</span>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-sm"></i>
                        </div>
                    </div>
                </div>

                <!-- Me -->
                <div v-else-if="currentTab === 'me'" class="h-full bg-[#EDEDED]">
                    <div class="bg-white px-6 pt-12 pb-8 flex items-center border-b border-gray-200">
                        <img :src="charAvatar"
                            class="w-16 h-16 rounded-xl mr-5 object-cover shadow-sm bg-gray-50 border-2 border-white">
                        <div class="flex-1">
                            <div class="font-bold text-[22px] text-gray-900 leading-tight">{{ charName }}</div>
                            <div class="text-[14px] text-gray-400 mt-1">微信号: {{ charId?.slice(0, 8) }}</div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300"></i>
                    </div>
                    <div class="bg-white mt-3 border-y border-gray-200">
                        <div class="flex items-center p-4 active:bg-gray-50 cursor-pointer"
                            @click="showMomentsWall = true">
                            <span class="flex-1 text-[16px]">朋友圈</span>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-sm"></i>
                        </div>
                    </div>
                    <div class="bg-white mt-3 border-y border-gray-200">
                        <div v-for="(item, idx) in ['支付', '收藏', '卡包', '表情']" :key="idx"
                            class="flex items-center p-4 border-b last:border-none border-gray-100 active:bg-gray-50">
                            <span class="flex-1 text-[16px] text-gray-800">{{ item }}</span>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-sm"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Tabs Nav -->
            <div
                class="wechat-tabs flex justify-around items-center px-4 pt-2 pb-6 border-t border-[#D1D1D1] bg-[#F7F7F7]">
                <div v-for="tab in tabData" :key="tab.id"
                    class="flex flex-col items-center cursor-pointer transition-colors"
                    :class="currentTab === tab.id ? 'text-[#07C160]' : 'text-[#999]'" @click="currentTab = tab.id">
                    <i :class="[currentTab === tab.id ? tab.activeIcon : tab.icon, 'text-2xl']"></i>
                    <span class="text-[10px] mt-1">{{ tab.label }}</span>
                </div>
            </div>
        </div>

        <!-- Message Detail Modal (Global within WeChat) -->
        <Transition name="fade">
            <div v-if="selectedMessage"
                class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                @click="selectedMessage = null">
                <div class="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-pop-in" @click.stop>
                    <div class="flex flex-col">
                        <div class="flex items-center gap-4 mb-6">
                            <img :src="selectedMessage.from === 'char' ? charAvatar : getContactAvatar(selectedMessage.from)"
                                class="w-12 h-12 rounded-xl object-cover border-2 border-pink-50">
                            <div class="flex-1">
                                <h3 class="text-lg font-black text-[#8F5E6E]">{{ selectedMessage.from === 'char' ?
                                    charName : getContactName(selectedMessage.from) }}</h3>
                                <p class="text-[10px] font-bold text-gray-400 mt-0.5">{{ selectedMessage.time }} · 发送的内容
                                </p>
                            </div>
                        </div>
                        <!-- Message Content / Detail UI -->
                        <div class="px-2 flex-1 overflow-y-auto custom-scrollbar">
                            <!-- Shopping/Transaction Receipt UI -->
                            <div v-if="isCardMsg(selectedMessage) && getCardIcon(selectedMessage) === '📦'"
                                class="bg-white rounded-3xl p-6 border-2 border-dashed border-gray-100 shadow-inner mb-6 flex flex-col items-center">
                                <div
                                    class="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center text-4xl mb-4">
                                    📦</div>
                                <h4 class="text-lg font-black text-gray-800 mb-1">速递详情</h4>
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">Order #{{
                                    selectedMessage.id?.toString().slice(-8) || 'JD8816' }}</p>
                                <div class="w-full space-y-3 mb-6">
                                    <div class="flex justify-between text-sm"><span
                                            class="text-gray-400 font-bold">商品名称</span><span
                                            class="font-black text-gray-800">{{ getCardTitle(selectedMessage) }}</span>
                                    </div>
                                    <div class="flex justify-between text-sm"><span
                                            class="text-gray-400 font-bold">物流状态</span><span
                                            class="font-black text-green-500">正在派送喵</span></div>
                                    <div class="flex justify-between text-sm"><span
                                            class="text-gray-400 font-bold">同步来源</span><span
                                            class="font-black text-pink-400">查手机系统自动关联</span></div>
                                </div>
                                <div class="w-full h-px bg-gray-50 mb-6"></div>
                                <p class="text-[11px] text-gray-400 italic text-center">每个礼包都藏着 TA 对你的爱喵~</p>
                            </div>

                            <!-- Family Card Application UI -->
                            <div v-else-if="isCardMsg(selectedMessage) && getCardIcon(selectedMessage) === '💳'"
                                class="bg-gradient-to-br from-slate-800 to-black rounded-3xl p-6 shadow-xl mb-6 flex flex-col items-center border border-slate-700">
                                <div
                                    class="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-4xl mb-4">
                                    💳</div>
                                <h4 class="text-lg font-black text-white mb-1">亲属卡申请确认</h4>
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">Security
                                    Token #{{ selectedMessage.id?.toString().slice(-6) || 'SEC-88' }}</p>
                                <div class="w-full space-y-4 mb-6">
                                    <div class="flex justify-between text-xs py-2 border-b border-white/5"><span
                                            class="text-white/40 font-bold">申请人</span><span
                                            class="font-black text-pink-300">{{ getContactName(selectedMessage.from)
                                            }}</span></div>
                                    <div class="flex justify-between text-xs py-2 border-b border-white/5"><span
                                            class="text-white/40 font-bold">期望额度</span><span
                                            class="font-black text-white">¥ 2,000.00 /月</span></div>
                                    <div class="flex justify-between text-xs py-2 border-b border-white/5"><span
                                            class="text-white/40 font-bold">功能状态</span><span
                                            class="font-black text-green-400 truncate">信任链路已建立</span></div>
                                </div>
                                <p class="text-[11px] text-slate-400 italic text-center px-2 leading-relaxed">"{{
                                    getCleanContent(selectedMessage.content) || '让 TA 照顾你的生活起居喵~' }}"</p>
                            </div>

                            <!-- Standard/Clean Text View -->
                            <div v-else
                                class="bg-[#F9F9F9] rounded-[24px] p-5 mb-8 border border-gray-50 max-h-[40vh] overflow-y-auto custom-scrollbar">
                                <p class="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap font-bold">
                                    {{ getCleanContent(selectedMessage.content) || selectedMessage.content }}
                                </p>
                                <div v-if="getInnerVoice(selectedMessage.content)"
                                    class="mt-4 pt-4 border-t border-pink-100">
                                    <p class="text-[11px] text-pink-400 font-black tracking-widest uppercase mb-1">内心独白
                                        (AI Voice)</p>
                                    <p class="text-[13px] text-pink-500 italic font-medium">"{{
                                        getInnerVoice(selectedMessage.content) }}"</p>
                                </div>
                            </div>
                        </div>
                        <button
                            class="w-full py-4 bg-[#FC6C9C] text-white rounded-2xl font-black shadow-lg shadow-pink-200 active:scale-95 transition-transform"
                            @click="selectedMessage = null">
                            知道啦喵~
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
    wechatData: Object,
    charAvatar: String,
    userAvatar: String,
    charName: String,
    charId: String
})

const emit = defineEmits(['back'])

const activeChatId = ref(null)
const currentTab = ref('chats')
const showMomentsWall = ref(false)
const selectedMessage = ref(null)
const chatRef = ref(null)

const momentsPosts = computed(() => {
    return props.wechatData?.moments?.posts || []
})

const tabData = [
    { id: 'chats', label: '微信', icon: 'fa-regular fa-comment-dots', activeIcon: 'fa-solid fa-comment-dots' },
    { id: 'contacts', label: '通讯录', icon: 'fa-regular fa-address-book', activeIcon: 'fa-solid fa-address-book' },
    { id: 'discover', label: '发现', icon: 'fa-regular fa-compass', activeIcon: 'fa-solid fa-compass' },
    { id: 'me', label: '我', icon: 'fa-regular fa-user', activeIcon: 'fa-solid fa-user' }
]

const tabTitle = computed(() => {
    if (currentTab.value === 'chats') return '微信'
    if (currentTab.value === 'contacts') return '通讯录'
    if (currentTab.value === 'discover') return '发现'
    if (currentTab.value === 'me') return ''
    return '微信'
})

const conversations = computed(() => {
    return props.wechatData?.conversations || []
})

const contacts = computed(() => {
    return props.wechatData?.contacts || []
})

const sortedConversations = computed(() => {
    return [...conversations.value].sort((a, b) => (b.isTop ? 1 : -1) - (a.isTop ? 1 : -1))
})

const activeChat = computed(() => {
    return conversations.value.find(c => c.id === activeChatId.value)
})

const activeChatName = computed(() => {
    if (!activeChatId.value) return ''
    return getContactName(activeChatId.value)
})

const activeChatHistory = computed(() => {
    return activeChat.value?.history || []
})

function getContact(id) {
    if (id === 'user') return contacts.value.find(c => c.id === 'user') || { name: '你', avatar: props.userAvatar }
    return contacts.value.find(c => c.id === id) || { name: '未知', avatar: '/avatars/default.png' }
}

function getContactName(id) {
    if (activeChat.value?.isGroup) {
        if (id === 'char') {
            // 在该群组历史中，char 可能有专门的昵称
            return props.charName
        }
        const msgMatch = activeChat.value.history.find(m => m.senderId === id)
        if (msgMatch?.senderName) return msgMatch.senderName
    }
    const contact = getContact(id)
    return contact.remark || contact.name || '微信用户'
}

function getContactAvatar(id) {
    if (activeChat.value?.isGroup) {
        const msgMatch = activeChat.value.history.find(m => m.senderId === id)
        if (msgMatch?.senderAvatar) return msgMatch.senderAvatar
    }
    return getContact(id).avatar || '/avatars/default.png'
}

// --- Content Cleaning Logic (Beautification) ---
function getCleanContent(content) {
    if (!content || typeof content !== 'string') return content;
    let clean = content;
    // Remove all JSON blocks
    clean = clean.replace(/\{[\s\S]*?\}/g, '');
    // Remove all instruction tags
    clean = clean.replace(/\[\s*INNER[-_ ]VOICE\s*\][\s\S]*?\[\/\s*INNER[-_ ]VOICE\s*\]/gi, '');
    clean = clean.replace(/\[(GIFT|礼物|CARD|HTML|DASHBOARD|UPDATE|FAMILY_CARD|亲属卡|申请亲属卡|拒绝亲属卡|红包|转账)[:：\-\s]?[^\]]*\]/gi, '');
    clean = clean.replace(/\[(领取|拒收|通过|申请)[:：\-\s]?[^\]]*\]/gi, '');
    clean = clean.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：\-\s]*https?:\/\/[^\]]+\]/gi, '');
    return clean.trim();
}

function getInnerVoice(content) {
    if (!content || typeof content !== 'string') return null;
    const match = content.match(/\[\s*INNER[-_ ]VOICE\s*\]([\s\S]*?)\[\/\s*INNER[-_ ]VOICE\s*\]/i);
    if (match) return match[1].trim();
    return null;
}

function isSticker(msg) {
    const c = msg.content || '';
    return msg.type === 'sticker' || (typeof c === 'string' && /\[(?:表情包|STICKER|IMAGE)[:：\-\s]*https?:\/\/[^\]]+\]/i.test(c));
}

function getStickerUrl(msg) {
    const c = msg.content || '';
    const match = c.match(/https?:\/\/[^\]\s]+/i);
    return match ? match[0] : '/stickers/default.png';
}

function isCardMsg(msg) {
    if (['redpacket', 'transfer', 'shopping', 'gift', 'family_card'].includes(msg.type)) return true;
    const c = msg.content || '';
    return typeof c === 'string' && /\[(红包|转账|亲属卡|申请亲属卡|拒绝亲属卡|FAMILY_CARD|礼物|订单|GIFT)[:：\-\s]?[^\]]*\]/i.test(c);
}

function getCardIcon(msg) {
    const c = (msg.content || '').toLowerCase();
    if (msg.type === 'redpacket' || c.includes('红包')) return '🧧';
    if (msg.type === 'transfer' || c.includes('转账')) return '💰';
    if (c.includes('拒绝亲属卡')) return '🚫';
    if (msg.type === 'family_card' || c.includes('亲属卡')) return '💳';
    if (msg.type === 'shopping' || c.includes('订单')) return '📦';
    if (msg.type === 'gift' || c.includes('礼物')) return '🎁';
    return '📋';
}

function getCardTitle(msg) {
    const c = (msg.content || '');
    if (msg.type === 'redpacket') return '微信红包';
    if (msg.type === 'transfer') return '微信转账';
    if (msg.type === 'shopping') return '订单已发出';
    if (c.includes('申请亲属卡')) return '亲属卡申请';
    if (c.includes('拒绝亲属卡')) return '亲属卡已被退回';
    if (msg.type === 'family_card') return '亲属卡已送达';
    return '点击查看详情';
}

function getCardSub(msg) {
    if (msg.type === 'redpacket') return '微信红包';
    if (msg.type === 'family_card') return '由于 TA 对你的信任...';
    if (msg.type === 'shopping') return '正在派送中喵';
    return '查收实时动态';
}

function getCardBg(msg) {
    const c = (msg.content || '').toLowerCase();
    if (msg.type === 'redpacket' || c.includes('红包')) return 'bg-gradient-to-br from-orange-400 to-red-500';
    if (msg.type === 'transfer' || c.includes('转账')) return 'bg-gradient-to-br from-orange-300 to-orange-500';
    if (msg.type === 'family_card' || c.includes('亲属卡')) return 'bg-gradient-to-br from-slate-700 to-slate-900';
    if (msg.type === 'shopping' || c.includes('订单')) return 'bg-gradient-to-br from-pink-400 to-rose-500';
    return 'bg-gradient-to-br from-indigo-400 to-purple-500';
}

function getCardTypeLabel(msg) {
    if (msg.type === 'redpacket') return 'WECHAT RED PACKET';
    if (msg.type === 'family_card') return 'FAMILY CARD SYSTEM';
    if (msg.type === 'shopping') return 'JD/TB ORDER SYNC';
    return 'SYNCED DATA';
}

function handleCardClick(msg) {
    const c = (msg.content || '').toLowerCase();
    if (msg.type === 'shopping' || c.includes('订单')) {
        // 跳转到购物应用
        console.log('[WeChat] Redirecting to shopping app');
        // emit('back') -> logic needed to change currentApp in store
    }
    selectedMessage.value = msg;
}

function openChatFromContact(id) {
    activeChatId.value = id
}

// Scroll to bottom when opening chat
watch(activeChatId, async (newVal) => {
    if (newVal) {
        await nextTick()
        scrollToBottom()
    }
})

function scrollToBottom() {
    if (chatRef.value) {
        chatRef.value.scrollTop = chatRef.value.scrollHeight
    }
}

onMounted(() => {
    if (activeChatId.value) {
        scrollToBottom()
    }
})
</script>

<style scoped>
.wechat-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-left-fix::before {
    content: '';
    position: absolute;
    top: 10px;
    left: -8px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 8px solid white;
}

.bubble-right-fix::after {
    content: '';
    position: absolute;
    top: 10px;
    right: -8px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-left: 8px solid #95EC69;
}

.chat-container::-webkit-scrollbar {
    display: none;
}
</style>
