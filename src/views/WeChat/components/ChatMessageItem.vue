<template>
    <div class="w-full z-10">
        <!-- Center Time Divider -->
        <div v-if="shouldShowTimeDivider" class="flex justify-center my-4 animate-fade-in relative">
            <span class="text-[10px] px-2 py-0.5 rounded shadow-sm select-none transition-colors duration-300"
                :class="chatData?.bgTheme === 'dark' ? 'text-white/60 bg-white/10' : 'text-gray-400 bg-gray-100/60'">
                {{ formatTimelineTime(msg.timestamp) }}
            </span>
        </div>

        <!-- Multi-select Layer Wrapper -->
        <div class="flex items-center gap-3 transition-all duration-300 relative"
            :class="isMultiSelectMode ? 'pl-10' : ''">

            <!-- Selection Circle -->
            <div v-if="isMultiSelectMode"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all shrink-0"
                :class="isSelected ? 'bg-[#07c160] border-[#07c160]' : 'border-gray-300 bg-white/10'"
                @click.stop="$emit('toggle-select', msg.id)">
                <i v-if="isSelected" class="fa-solid fa-check text-white text-[10px]"></i>
            </div>

            <div class="flex-1 overflow-visible" @click="isMultiSelectMode ? $emit('toggle-select', msg.id) : null">

                <!-- CASE 1: System / Recall Message -->
                <div v-if="msg.type === 'system' || msg.role === 'system'"
                    class="flex flex-col items-center my-2 w-full animate-fade-in"
                    @contextmenu.prevent="emitContextMenu">
                    <span class="text-[11px] px-3 py-1 rounded font-songti select-none transition-colors duration-300"
                        :class="[
                            msg.isRecallTip ? 'cursor-pointer hover:bg-opacity-80 transition-colors' : '',
                            chatData?.bgTheme === 'dark' ? 'bg-white/10 text-white/40' : 'bg-gray-200/50 text-gray-400'
                        ]" @click="msg.isRecallTip && (localShowDetail = !localShowDetail)">
                        {{ msg.content }}
                    </span>
                    <!-- Foldable Content -->
                    <div v-if="localShowDetail && msg.realContent"
                        class="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 max-w-[80%] break-all shadow-sm animate-fade-in-down">
                        <div class="mb-0.5 text-gray-400 text-[10px]">原内容:</div>
                        {{ msg.realContent }}
                    </div>
                </div>

                <!-- CASE 2: Regular Message -->
                <div v-else class="flex gap-2 w-full" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">

                    <!-- Avatar -->
                    <div class="relative w-10 h-10 shrink-0 cursor-pointer z-10 overflow-visible"
                        @click.stop="$emit('click-avatar', msg)" @dblclick="$emit('dblclick-avatar', msg)">
                        <!-- Inner Avatar -->
                        <div class="absolute overflow-hidden bg-white shadow-sm transition-all duration-300" :class="[
                            (msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame) || chatData?.avatarShape === 'circle' ? 'rounded-full' : 'rounded',
                            { 'animate-shake': shakingAvatars?.has(msg.id) }
                        ]" :style="avatarInnerStyle">
                            <img :src="avatarSrc" class="w-full h-full object-cover">
                        </div>
                        <!-- Frame -->
                        <img v-if="frameSrc" :src="frameSrc" class="absolute pointer-events-none z-20 object-contain"
                            style="left: -15%; top: -25%; width: 130%; height: 130%; max-width: none;">
                    </div>

                    <!-- Content Column -->
                    <div class="flex flex-col" :class="[
                        msg.role === 'user' ? 'items-end' : 'items-start',
                        msg.type === 'html' ? 'w-full' : 'max-w-[80%]'
                    ]">

                        <!-- Pay Card -->
                        <div v-if="isPayCard" class="pay-card"
                            :class="{ 'received': msg.isClaimed || msg.status === 'received', 'rejected': msg.isRejected }"
                            @click="$emit('click-pay', msg)" @contextmenu.prevent="emitContextMenu">
                            <div class="pay-top"
                                :class="{ 'bg-[#ea5f39]': !msg.type || msg.type === 'redpacket', 'bg-[#f79c1f]': msg.type === 'transfer', 'opacity-90': msg.isClaimed }">
                                <div class="pay-icon">
                                    <i v-if="msg.type === 'transfer'"
                                        :class="msg.isClaimed ? 'fa-solid fa-check' : 'fa-solid fa-right-left'"></i>
                                    <i v-else
                                        :class="msg.isClaimed ? 'fa-regular fa-envelope-open' : 'fa-regular fa-envelope'"></i>
                                </div>
                                <div class="pay-info">
                                    <div class="pay-title">{{ getPayTitle(msg) }}</div>
                                    <div class="pay-desc">{{ getPayDesc(msg) }}</div>
                                </div>
                            </div>
                            <div class="pay-bottom">{{ getPayStatusText(msg) }}</div>
                        </div>

                        <!-- Case 5: Family Card (Priority High) -->
                        <div v-else-if="isFamilyCard" class="flex flex-col items-center gap-1">
                            <!-- Card Container -->
                            <div class="flex flex-col items-start gap-2 max-w-[280px]">
                                <!-- Mixed Text Bubble (if any) -->
                                <div v-if="mixedText"
                                    class="px-3 py-2 text-[15px] leading-relaxed break-words shadow-sm relative transition-all rounded-[16px] text-gray-800 bg-white"
                                    :class="msg.role === 'user' ? 'bg-[#95EC69]' : 'bg-white'">
                                    <span v-html="marked(mixedText)"></span>
                                </div>

                                <!-- The Card -->
                                <div class="cursor-pointer relative overflow-hidden transition-transform duration-200 active:scale-95 shadow-sm hover:shadow-md select-none rounded-xl bg-gradient-to-br from-[#2b2b2b] to-[#1a1a1a]"
                                    :class="[
                                        isFamilyCardReject || msg.isClaimed ? 'opacity-80 grayscale cursor-default' : '',
                                        chatData?.bgTheme === 'dark' ? 'border border-white/10' : ''
                                    ]" style="width: 260px; height: 145px;" @click="handleFamilyCardClick">

                                    <!-- Decorative Background Elements -->
                                    <div
                                        class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10">
                                    </div>
                                    <div
                                        class="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl transform -translate-x-5 translate-y-5">
                                    </div>
                                    <div
                                        class="absolute top-1/2 left-1/2 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-shine opacity-0 hover:opacity-100 transition-opacity duration-700">
                                    </div>

                                    <div class="family-card-chip"></div>
                                    <i class="fa-brands fa-weixin family-card-logo"></i>

                                    <div class="family-card-inner">
                                        <div class="family-card-top">
                                            <div class="family-card-icon">
                                                <i
                                                    :class="isFamilyCardReject ? 'fa-solid fa-ban' : 'fa-solid fa-gift'"></i>
                                            </div>
                                            <div class="family-card-title">
                                                {{ isFamilyCardReject ? '申请已拒绝' : (isFamilyCardApply ? '亲属卡申请' : '亲属卡')
                                                }}
                                            </div>
                                        </div>
                                        <div class="family-card-content">
                                            <div class="family-card-text">{{ familyCardData.text ||
                                                '送我一张亲属卡好不好？以后你来管家~'
                                                }}
                                            </div>
                                            <div class="family-card-footer">
                                                <div class="family-card-no">**** **** **** {{ isFamilyCardApply ? '8888'
                                                    :
                                                    '6666' }}</div>
                                                <!-- Claimed Badge -->
                                                <div v-if="msg.isClaimed || msg.status === 'claimed'"
                                                    class="mt-2 text-xs text-[#d4af37] font-bold flex items-center justify-end gap-1">
                                                    <i class="fa-solid fa-check-circle"></i> {{ isFamilyCardApply ?
                                                        '已生效' : '已领取' }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <!-- Image -->
                        <div v-else-if="msg.type === 'image' || isImageMsg(msg)" class="msg-image bg-transparent"
                            @contextmenu.prevent="emitContextMenu">
                            <img :src="getImageSrc(msg)" class="max-w-[150px] max-h-[150px] rounded-lg cursor-pointer"
                                @click="previewImage(getImageSrc(msg))" @error="handleImageError">
                        </div>

                        <!-- Voice -->
                        <div v-else-if="msg.type === 'voice'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="flex items-center gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                                <div class="h-10 rounded-lg flex items-center px-4 cursor-pointer relative shadow-sm min-w-[80px]"
                                    :class="[
                                        msg.role === 'user' ? 'bg-[#2e2e2e] text-white flex-row-reverse' : 'bg-black text-[#d4af37]',
                                        msg.isPlaying ? 'voice-playing-effect' : ''
                                    ]"
                                    :style="{ width: Math.max(80, 40 + getDuration(msg) * 5) + 'px', maxWidth: '200px' }"
                                    @click="toggleVoice" @contextmenu.prevent="emitContextMenu">

                                    <!-- Wave Animation -->
                                    <div class="voice-wave"
                                        :class="[msg.isPlaying ? 'playing' : '', msg.role === 'user' ? 'wave-right' : 'wave-left']">
                                        <div class="bar bar1"
                                            :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'"></div>
                                        <div class="bar bar2"
                                            :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'"></div>
                                        <div class="bar bar3"
                                            :class="msg.role === 'user' ? 'bg-white' : 'bg-[#d4af37]'"></div>
                                    </div>
                                    <!-- Arrow -->
                                    <div class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                        :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#2e2e2e]' : 'left-[-6px] border-r-[6px] border-r-black'">
                                    </div>
                                    <span class="text-[10px] font-bold opacity-70"
                                        :class="msg.role === 'user' ? 'mr-0 ml-1' : 'ml-1 mr-0'">{{ getDuration(msg)
                                        }}"</span>
                                </div>
                                <div v-if="msg.role === 'ai' && !msg.isPlayed" class="w-2 h-2 bg-red-500 rounded-full">
                                </div>
                            </div>
                            <!-- Transcript -->
                            <div v-if="localShowTranscript" class="mt-2 max-w-full animate-fade-in-down">
                                <div class="bg-white border border-gray-200 p-3 rounded-lg text-[14.5px] text-gray-800 font-songti leading-relaxed shadow-sm whitespace-pre-wrap relative overflow-hidden"
                                    :class="msg.role === 'user' ? 'mr-0 ml-auto' : ''" style="max-width: 280px;">
                                    {{ msg.content }}
                                </div>
                            </div>
                        </div>

                        <!-- HTML Card -->
                        <div v-else-if="msg.type === 'html'" class="w-full mt-1" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <SafeHtmlCard :content="getHtmlContent(msg.content)" />
                        </div>



                        <!-- Text Bubble -->
                        <div v-else v-show="cleanedContent" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                            class="px-3 py-2 text-[15px] leading-relaxed break-words shadow-sm relative transition-all"
                            :class="[
                                msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left',
                            ]" :style="{
                                fontSize: (chatData?.bubbleSize || 15) + 'px',
                                ...(computedBubbleStyle || {})
                            }">
                            <!-- Arrow -->
                            <div v-if="shouldShowArrow"
                                class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#374151]' : 'left-[-6px] border-r-[6px] border-r-[#2a2520]'">
                            </div>

                            <!-- Quote -->
                            <div v-if="msg.quote"
                                class="mb-1.5 pb-1.5 border-b border-white/10 opacity-70 text-[11px] leading-tight flex flex-col gap-0.5">
                                <div class="font-bold">{{ msg.quote.role === 'user' ? '我' : (chatData.name || '对方') }}
                                </div>
                                <div class="truncate max-w-[200px]">{{ msg.quote.content }}</div>
                            </div>

                            <!-- Content -->
                            <span v-html="formattedContent"></span>
                        </div>

                        <!-- Bubble Timestamp -->
                        <div v-if="msg.timestamp" class="text-[10px] text-gray-400 mt-0.5 px-1">
                            {{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                                hour: '2-digit', minute: '2-digit'
                            }) }}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Family Card Claim Modal -->
    <FamilyCardClaimModal ref="familyCardModal" @confirm="handleCardClaim" />
    <!-- Family Card Detail Modal -->
    <FamilyCardDetailModal ref="familyDetailModal" :userName="chatData.userName || '我'" />
</template>

<script setup>
import { computed, ref } from 'vue'
import { marked } from 'marked'
import { useStickerStore } from '../../../stores/stickerStore'
import { useChatStore } from '../../../stores/chatStore'
import { useWalletStore } from '../../../stores/walletStore'
import SafeHtmlCard from '../../../components/SafeHtmlCard.vue'
import MomentShareCard from '../../../components/MomentShareCard.vue'
import FamilyCardClaimModal from '../FamilyCardClaimModal.vue'
import FamilyCardDetailModal from '../FamilyCardDetailModal.vue'

const props = defineProps({
    msg: Object,
    prevMsg: Object,
    chatData: Object,
    isMultiSelectMode: Boolean,
    isSelected: Boolean,
    shakingAvatars: {
        type: Object, // Set behaves like object in props passing usually
        default: () => new Set()
    }
})

const emit = defineEmits([
    'click-avatar', 'dblclick-avatar', 'context-menu',
    'toggle-select', 'click-pay', 'play-voice'
])

const stickerStore = useStickerStore()
const chatStore = useChatStore()
const walletStore = useWalletStore()
const localShowDetail = ref(false)
const localShowTranscript = ref(false)
const familyCardModal = ref(null)
const familyDetailModal = ref(null)
const isPressing = ref(false)
const pressTimer = ref(null)

// Handle Family Card Click (Open Modal)
const handleFamilyCardClick = () => {
    console.log('[Family Card Click]', {
        type: props.msg.type,
        isApply: isFamilyCardApply.value,
        isReject: isFamilyCardReject.value,
        status: props.msg.status,
        isClaimed: props.msg.isClaimed
    })

    // 拒绝卡不可点击
    if (isFamilyCardReject.value) {
        console.log('[Family Card] Reject card clicked, ignoring')
        return
    }

    // 已领取/已生效的卡片 (无论是申请还是赠送) -> 打开详情弹窗
    if (props.msg.isClaimed || props.msg.status === 'claimed') {
        console.log('[Family Card] Opening detail modal for claimed card')
        const card = walletStore.familyCards.find(c => c.ownerId === props.chatData.id)
        if (card) {
            familyDetailModal.value?.open({
                cardName: card.remark || '亲属卡',
                ownerName: card.ownerName || props.chatData.name,
                number: card.number,
                theme: card.theme,
                amount: card.amount
            })
        } else {
            chatStore.triggerToast('未找到钱包中的卡片记录', 'warn')
        }
        return
    }

    // 申请卡待确认点击 - 打开详情模态框（查看提交的申请）
    if (isFamilyCardApply.value) {
        console.log('[Family Card] Apply card clicked, opening view modal')
        const { text } = familyCardData.value
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: 0,
            note: text || '送我一张亲属卡好不好？',
            fromCharId: props.chatData?.id,
            isApply: true,
            status: 'waiting'
        }, '亲属卡申请')
        return
    }

    // 未领取的普通卡：打开领取模态框
    if (!isFamilyCardApply.value && !isFamilyCardReject.value && props.msg.role === 'ai') {
        const { amount, text } = familyCardData.value
        console.log('[Family Card] Opening claim modal', { amount, text })
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: parseFloat(amount) || 0,
            note: text || '拿去买糖吃~',
            fromCharId: props.chatData?.id
        }, text || '亲属卡')
    }
}

// Handle modal confirm
const handleCardClaim = (data) => {
    const cardOwnerName = props.chatData?.name || '对方'

    // Add to wallet with user's customization
    walletStore.addFamilyCard({
        ownerId: data.fromCharId,
        ownerName: cardOwnerName,
        amount: data.amount,
        remark: data.cardName || '亲属卡',
        number: data.number,
        theme: data.theme
    })

    // Update message state in store (This specific card message)
    chatStore.updateMessage(props.chatData.id, props.msg.id, {
        isClaimed: true,
        claimTime: Date.now(),
        status: 'claimed'
    })

    // Update the original "Apply Card" message status if found in history
    const msgs = chatStore.currentChat?.msgs || []
    const applyMsg = [...msgs].reverse().find(m =>
        m.role === 'user' &&
        (typeof m.content === 'string' && m.content.includes('FAMILY_CARD_APPLY')) &&
        m.timestamp < props.msg.timestamp
    )

    if (applyMsg) {
        chatStore.updateMessage(props.chatData.id, applyMsg.id, {
            status: 'claimed',
            claimedCardName: data.cardName || '亲属卡'
        })
    }

    // Add a system notification message (Matching Red Packet logic)
    chatStore.addMessage(props.chatData.id, {
        role: 'system',
        content: `你已领取了${cardOwnerName}的亲属卡「${data.cardName || '亲属卡'}」`
    })

    console.log(`[Family Card] Successfully claimed card from ${cardOwnerName}`)
}

// --- Computeds & Helpers ---

const shouldShowTimeDivider = computed(() => {
    if (!props.prevMsg) return true
    const diff = props.msg.timestamp - props.prevMsg.timestamp
    return diff > 5 * 60 * 1000
})

const isPayCard = computed(() => {
    if (!props.msg) return false
    const content = ensureString(props.msg.content)
    return props.msg.type === 'redpacket' ||
        props.msg.type === 'transfer' ||
        (typeof content === 'string' && (content.includes('[红包]') || content.includes('[转账]')))
})

const cleanedContent = computed(() => getCleanContent(props.msg.content))

const formattedTime = computed(() => {
    return formatTime(props.msg.timestamp)
})

// Check if message should be displayed
const isValidMessage = computed(() => {
    // 1. If it's a family card (using robust check), always show
    if (isFamilyCard.value) return true

    // 2. If it's an image, always show
    if (isImageMsg(props.msg.content)) return true

    // 3. If content is being streamed (from AI), always show to prevent flickering
    if (props.msg.isStreaming) return true

    // 4. Otherwise, only show if cleaned content is not empty
    const clean = getCleanContent(ensureString(props.msg.content))
    return clean && clean.length > 0
})

const formattedContent = computed(() => formatMessageContent(props.msg))

const isFamilyCard = computed(() => {
    // Priority: use message type (set by store)
    if (props.msg.type === 'family_card') return true

    // Recovery: Map ALL AI-generated HTML to Family Card
    if (props.msg.type === 'html' && props.msg.role === 'ai') return true

    // EXTREME Fallback: just check for the keyword. 
    const content = ensureString(props.msg.content).toUpperCase()
    if (content.includes('FAMILY_CARD')) return true

    return false
})

const isFamilyCardApply = computed(() => {
    const content = ensureString(props.msg.content)
    return /\\?\[\s*FAMILY_CARD_APPLY/i.test(content)
})

const isFamilyCardReject = computed(() => {
    const c = ensureString(props.msg.content)
    // Regular check OR HTML JSON check
    return /\\?\[\s*FAMILY_CARD_REJECT/i.test(c) || (c.includes('type":"html"') && c.includes('拒绝'))
})

const familyCardData = computed(() => {
    const content = ensureString(props.msg.content)

    // Recovery for HTML JSON Garbage
    if ((props.msg.type === 'html' && props.msg.role === 'ai') || (content.includes('"type":"html"') && content.includes('亲属卡'))) {
        if (content.includes('拒绝')) {
            return { amount: '0', text: '对方拒绝了您的申请', isReject: true }
        }
        return { amount: '5200', text: '这是您的零花钱，请收好~', isReject: false }
    }

    // 预处理：有时候AI会把卡片放在代码块里，或者转义，先简单清理一下转义符
    const cleanContent = content.replace(/\\\[/g, '[').replace(/\\\]/g, ']')

    // 辅助正则：允许中文冒号，允许冒号周围有空格
    const colonRegex = '[:：]\\s*'

    // Pattern 1: 标准卡片 [FAMILY_CARD:金额:文案]
    const match = cleanContent.match(new RegExp(`\\[FAMILY_CARD\\s*${colonRegex}([\\d\\.]+)\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (match) return { amount: match[1], text: match[2].trim(), isReject: false }

    // Pattern 2: 申请卡 [FAMILY_CARD_APPLY:文案]
    const applyMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD_APPLY\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (applyMatch) return { amount: '0', text: applyMatch[1].trim(), isReject: false }

    // Pattern 3: 拒绝卡 [FAMILY_CARD_REJECT:文案]
    const rejectMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD_REJECT\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (rejectMatch) return { amount: '0', text: rejectMatch[1].trim(), isReject: true }

    // Pattern 5: 异常鲁棒性处理 [FAMILY_CARD:备注] (没有金额的情况)
    const noteOnlyMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD\\s*${colonRegex}([^\\d\\s][\\s\\S]*?)\\]`, 'i'))
    if (noteOnlyMatch) return { amount: '5200', text: noteOnlyMatch[1].trim(), isReject: false }

    // 兜底：虽然检测到了标签但没提取到内容，给一个默认值防止空白
    return { amount: '5200', text: '送给你的亲属卡', isReject: false }
})

const getUserName = computed(() => {
    return props.chatData.userName || '用户'
})


function getCleanContent(contentRaw) {
    if (!contentRaw) return '';
    const content = ensureString(contentRaw);
    if (content.length > 300) {
        if (content.includes('data:image/') || content.includes('blob:')) return '';
        if (!content.includes('[INNER_VOICE]')) return content.trim();
    }
    let clean = content.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '');
    clean = clean.replace(/\{[\s\n]*"(?:着装|环境|status|心声|行为|mind|outfit|scene|action|thoughts|mood|state)"[\s\S]*?\}/gi, '');
    // Remove manual labels identifying thoughts/action if AI leaks them
    clean = clean.replace(/^(心声|行为|内心情绪|当前环境|当前着装|STATUS|ACTION|THOUGHTS)[:：].*?$/gim, '');

    // CLEAN FAMILY CARD TAGS (Robust regex)
    const colonRegexStr = '[:：]\\s*';
    clean = clean.replace(new RegExp(`\\\\?\\[\\s*FAMILY_CARD(?:_APPLY|_REJECT)?\\s*${colonRegexStr}[\\s\\S]*?\\]`, 'gi'), '');

    // Aggressive CSS filter (AI Only)
    if (props.msg.role === 'ai') {
        // Filter 0: Remove JSON dumps / truncated JSON
        if (clean.trim().startsWith('{') && (
            (clean.includes('"index":') && clean.includes('"message":')) ||
            (clean.includes('"type":"html"')) ||
            (clean.includes('padding:') && clean.includes('margin:'))
        )) return '';

        // Filter 1: Code blocks with braces
        if (clean.includes('{') && clean.includes('}') && (clean.includes('padding:') || clean.includes('margin:') || clean.includes('border:'))) {
            clean = clean.replace(/\{[\s\S]*?(padding:|margin:|border:)[\s\S]*?\}/gi, '');
        }
    }

    // Filter 2: Naked CSS properties - EXTREME MODE
    const toxicKeywords = [
        'border-radius', 'box-shadow', 'background', 'background-image', 'linear-gradient', 'isplay: flex', 'gap',
        'min-width', 'max-width', 'min-height', 'z-index', 'overflow', 'position: relative', 'position: absolute',
        'padding', 'margin', 'display: flex', 'justify-content', 'align-items',
        'color:', 'font-size', 'border', 'font-weight', 'text-align', 'line-height',
        'right:', 'left:', 'top:', 'bottom:', 'width:', 'height:', 'filter:', 'blur', 'opacity'
    ];

    if (props.msg.role === 'ai' && toxicKeywords.some(k => clean.toLowerCase().includes(k))) {
        if (clean.includes(';') || clean.includes(':')) return '';
    }

    // Filter 3: Garbage punctuation strings
    if (/^["'>}<{\[\]]+$/.test(clean.trim())) return '';

    clean = clean.trim();
    clean = clean.replace(/\[(领取红包|RECEIVE_RED_PACKET)\]/gi, '').trim();
    return clean;
}

const mixedText = computed(() => {
    if (!isFamilyCard.value) return '';
    const content = ensureString(props.msg.content)
    // Remove family card tags using the SAME robust regex
    const colonRegexStr = '[:：]\\s*';
    let text = content.replace(new RegExp(`\\\\?\\[\\s*FAMILY_CARD(?:_APPLY|_REJECT)?\\s*${colonRegexStr}[\\s\\S]*?\\]`, 'gi'), '');

    // Also run standard cleanup (to remove inner voice, css, etc.)
    return getCleanContent(text);
})

const avatarSrc = computed(() => {
    return props.msg.role === 'user'
        ? (props.chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me')
        : (props.chatData?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${props.chatData?.name || 'AI'}`)
})

const frameSrc = computed(() => {
    return props.msg.role === 'user' ? props.chatData?.userAvatarFrame?.url : props.chatData?.avatarFrame?.url
})

const avatarInnerStyle = computed(() => {
    const frame = props.msg.role === 'user' ? props.chatData?.userAvatarFrame : props.chatData?.avatarFrame
    if (frame) {
        return {
            inset: ((1 - (frame.scale || 1)) / 2 * 100) + '%',
            transform: `translate(${frame.offsetX || 0}px, ${frame.offsetY || 0}px)`
        }
    }
    return { inset: '0', transform: 'none' }
})

const computedBubbleStyle = computed(() => {
    if (!props.chatData?.bubbleCss) return {}
    const raw = props.chatData.bubbleCss
    if (raw.includes('|||')) {
        const parts = raw.split('|||')
        const styleStr = props.msg.role === 'user' ? (parts[1] || '') : parts[0]
        return parseBubbleCss(styleStr)
    }
    return parseBubbleCss(raw)
})

const shouldShowArrow = computed(() => {
    return false // 全局禁用箭头
})

// --- Methods (Ported) ---

function ensureString(val) {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || JSON.stringify(val);
    return String(val || '');
}


function formatTimelineTime(timestamp) {
    const now = new Date()
    const date = new Date(timestamp)
    const isToday = now.toDateString() === date.toDateString()
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString()
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (isToday) return timeStr
    if (isYesterday) return `昨天 ${timeStr}`

    const isThisYear = now.getFullYear() === date.getFullYear()
    if (isThisYear) return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${timeStr}`
}

function isImageMsg(msg) {
    if (!msg) return false
    if (msg.type === 'image') return true
    const content = ensureString(msg.content)
    if (!content.trim()) return false
    if (content.includes('blob:') || content.includes('data:image/')) return true
    const clean = getCleanContent(content).trim()
    if (clean.startsWith('http')) {
        const urlPart = clean.split('?')[0].toLowerCase()
        if (urlPart.endsWith('.jpg') || urlPart.endsWith('.png') || urlPart.endsWith('.gif') || urlPart.endsWith('.jpeg')) return true
    }
    return /\[(?:图片|IMAGE|表情包|STICKER)[:：].*?\]/i.test(clean)
}

function getImageSrc(msg) {
    const content = ensureString(msg.content).trim()
    if (content.startsWith('data:image/')) return content
    const clean = getCleanContent(content).trim()
    if (clean.includes('data:image/')) {
        const m = clean.match(/data:image\/[^\]\s]+/)
        if (m) return m[0]
    }
    if (clean.startsWith('http') || clean.startsWith('blob:')) return clean
    const match = clean.match(/\[(?:图片|IMAGE|表情包|STICKER)[:：](.*?)\]/i)
    if (match) {
        const c = match[1].trim()
        if (c.startsWith('http') || c.startsWith('blob:') || c.startsWith('data:')) return c

        // Sticker Lookup
        const charStickers = props.chatData?.emojis || []
        const charMatch = charStickers.find(s => s.name === c)
        if (charMatch) return charMatch.url
        const globalStickers = stickerStore.getStickers('global')
        const globalMatch = globalStickers.find(s => s.name === c)
        if (globalMatch) return globalMatch.url
        return `https://api.dicebear.com/7.x/initials/svg?seed=${c}`
    }
    return clean
}

function formatMessageContent(msg) {
    if (!msg) return ''
    const textRaw = ensureString(msg.content)

    // 0. Performance: Don't parse massive image strings or blob URLs as markdown
    if (textRaw.length > 500 && (textRaw.includes('data:image/') || textRaw.includes('blob:'))) {
        return '';
    }

    // 1. Clean Internal System Tags (Fix for visual leakage)
    let text = getCleanContent(textRaw)
        .replace(/\[Image Reference ID:.*?\]/g, '') // Remove ID tags
        .replace(/Here is the original image:/gi, '') // Remove AI parroting
        .trim();

    // 2. Render [DRAW:...] as loading indicator
    if (msg.isDrawing !== false && text.toLowerCase().includes('[draw:')) {
        text = text.replace(/\[DRAW:\s*([\s\S]*?)\]/gi, (match, prompt) => {
            const truncated = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt
            return `<div class="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 my-1">
                <i class="fa-solid fa-spinner fa-spin text-blue-500"></i>
                <span class="text-sm text-blue-700">正在绘制: ${truncated}</span>
            </div>`
        })
    }

    text = text.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：].*?\]/gi, '') // Remove image tags if any left

    // Sticker inline replacer (Standardized)
    text = text.replace(/\[(.*?)\]/g, (match, name) => {
        const n = name.trim()
        // Skip specialized tags we might have missed or are recursive
        // Also skip if it starts with DRAW: to avoid double processing if regex missed
        if (n.toUpperCase().startsWith('DRAW:') || n === 'INNER_VOICE' || n === '/INNER_VOICE') return match;

        const charStickers = props.chatData?.emojis || []
        const cm = charStickers.find(s => s.name === n)
        if (cm) return `<img src="${cm.url}" class="w-16 h-16 inline-block mx-1 align-middle" alt="${n}" />`
        const gm = stickerStore.getStickers('global').find(s => s.name === n)
        if (gm) return `<img src="${gm.url}" class="w-16 h-16 inline-block mx-1 align-middle" alt="${n}" />`
        return match
    })

    try { return marked.parse(text) } catch (e) { return text }
}

function getDuration(msg) {
    if (msg.duration) return msg.duration
    return Math.min(60, Math.max(1, Math.ceil(ensureString(msg.content).length / 3)))
}

function getPayTitle(msg) {
    const content = ensureString(msg.content)
    if (msg.type === 'transfer' || content.includes('[转账]')) return `¥${msg.amount || '520.00'}`
    return msg.note || '恭喜发财，大吉大利'
}

function getPayDesc(msg) {
    const content = ensureString(msg.content)
    if (msg.type === 'transfer' || content.includes('[转账]')) return msg.note || '转账给您'
    return '领取红包'
}

function getPayStatusText(msg) {
    if (msg.isRejected) return '已拒收'
    const content = ensureString(msg.content)
    if (msg.isClaimed || msg.status === 'received') {
        return (msg.type === 'transfer' || content.includes('[转账]')) ? '已收款' : '已领取'
    }
    if (msg.type === 'transfer' || content.includes('[转账]')) return '微信转账'
    return '微信红包'
}

function parseBubbleCss(cssString) {
    if (!cssString || typeof cssString !== 'string') return {}
    const style = {}
    cssString.split(';').forEach(rule => {
        const trimmed = rule.trim()
        if (!trimmed) return
        const parts = trimmed.split(':')
        if (parts.length >= 2) {
            const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase())
            const value = parts.slice(1).join(':').trim()
            if (key && value) style[key] = value
        }
    })
    return style
}

function handleImageError(e) {
    e.target.src = '/broken-image.png'
    e.target.onerror = null
}

function previewImage(src) {
    // We could emit or just open. Original used window.open
    window.open(src, '_blank')
}

function toggleVoice() {
    localShowTranscript.value = !localShowTranscript.value
    // Trigger play in parent
    emit('play-voice', props.msg)
}

function emitContextMenu(event) {
    emit('context-menu', { msg: props.msg, event })
}

// Long Press Logic
let longPressTimer = null
function startLongPress(event) {
    longPressTimer = setTimeout(() => {
        const touch = event.touches ? event.touches[0] : event;
        emitContextMenu(touch)
    }, 500)
}
function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

// Helper for SafeHtmlCard (Super Salvage Version)
function getHtmlContent(content) {
    if (!content) return ''
    try {
        let cleaned = content.trim()

        // 1. Pre-cleanup: Remove markdown backticks
        cleaned = cleaned.replace(/^```(?:html|json)?\n?|```$/gi, '').trim()

        // 2. Powerful Regex to handle JSON-wrapped HTML with unescaped stuff
        // Look for the "html" key and capture everything until the final closure or common JSON delimiters
        const jsonHtmlRegex = /"html"\s*:\s*"([\s\S]*?)"\s*(?:\}\s*$|,\s*"[^"]*"\s*:)/i;
        let match = cleaned.match(jsonHtmlRegex);

        // If not matched at end, try a looser match that just looks for "html": "..."
        if (!match) match = cleaned.match(/"html"\s*:\s*"([\s\S]*?)"\s*(?:\}|$)/i);

        if (match) {
            let body = match[1];

            // DEEP UNESCAPE: Crucial for JS scripts to work inside JSON strings
            if (body.includes('\\"')) body = body.replace(/\\"/g, '"');
            if (body.includes('\\n')) body = body.replace(/\\n/g, '\n');
            if (body.includes('\\t')) body = body.replace(/\\t/g, '\t');
            if (body.includes('\\/')) body = body.replace(/\\\//g, '/');
            if (body.includes('\\r')) body = body.replace(/\\r/g, '\r');

            if (body.includes('<') && body.includes('>')) return body.trim();
        }

        // 3. Fallback: Naked Tag Extraction (The "Tag-to-Tag" method)
        const firstTag = cleaned.indexOf('<');
        const lastTag = cleaned.lastIndexOf('>');
        if (firstTag !== -1 && lastTag !== -1 && lastTag > firstTag) {
            let extracted = cleaned.substring(firstTag, lastTag + 1);
            if (extracted.includes('\\"')) extracted = extracted.replace(/\\"/g, '"');
            if (extracted.includes('\\n')) extracted = extracted.replace(/\\n/g, '\n');
            return extracted;
        }

    } catch (e) {
        console.error('[ChatMessageItem] Super Salvage global error:', e)
    }
    return content
}

</script>

<style scoped>
/* Reuse styles from ChatWindow */
.chat-bubble-right {
    background: radial-gradient(circle at top right, #374151 0%, #1f2937 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    color: #e5e7eb;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
    font-family: 'Noto Serif SC', serif;
    font-weight: 400;
    letter-spacing: 0.5px;
    border-radius: 12px 2px 12px 12px;
}

.chat-bubble-left {
    background: radial-gradient(circle at top left, #2a2520 0%, #0e0e10 100%);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-top: 1px solid rgba(212, 175, 55, 0.4);
    color: #e6dcc0;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
    font-family: 'Noto Serif SC', serif;
    font-weight: 400;
    letter-spacing: 0.5px;
    border-radius: 2px 12px 12px 12px;
}

.voice-wave {
    display: flex;
    align-items: center;
    gap: 3px;
}

.bar {
    width: 3px;
    height: 10px;
    border-radius: 99px;
    animation: none;
}

.voice-playing-effect .bar {
    animation: sound-wave 1s infinite ease-in-out;
}

.voice-playing-effect .bar1 {
    animation-delay: 0s;
}

.voice-playing-effect .bar2 {
    animation-delay: 0.2s;
}

.voice-playing-effect .bar3 {
    animation-delay: 0.4s;
}

@keyframes sound-wave {

    0%,
    100% {
        height: 6px;
    }

    50% {
        height: 16px;
    }
}

.pay-card {
    width: 230px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    transition: transform 0.1s;
}

.pay-card:active {
    transform: scale(0.98);
}

.pay-card.received,
.pay-card.rejected {
    opacity: 0.6;
}

.pay-top {
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.pay-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 18px;
}

.pay-title {
    font-size: 15px;
    color: white;
    margin-bottom: 2px;
}

.pay-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
}

.pay-bottom {
    padding: 8px 12px;
    font-size: 11px;
    color: #999;
}

/* Family Card Black Gold Design - Credit Card Form Factor */
.family-card-wrapper {
    margin-top: 8px;
    width: 280px;
    perspective: 1000px;
}

.family-card-main {
    aspect-ratio: 1.58 / 1;
    background: linear-gradient(135deg, #2c2c2e 0%, #151517 100%);
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.6);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.family-card-clickable {
    cursor: pointer;
    transition: all 0.2s ease;
}

.family-card-clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.7);
    border-color: rgba(212, 175, 55, 0.6);
}

.family-card-clickable:active {
    transform: translateY(0);
}

.family-card-chip {
    position: absolute;
    top: 40px;
    left: 16px;
    width: 32px;
    height: 24px;
    background: linear-gradient(135deg, #d4af37 0%, #907320 100%);
    border-radius: 4px;
    opacity: 0.6;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
}

.family-card-logo {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 20px;
    color: rgba(212, 175, 55, 0.4);
}

.family-card-inner {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 14px;
}

.family-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
}

.family-card-icon {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1c1c1e;
    font-size: 11px;
}

.family-card-title {
    font-size: 13px;
    font-weight: 500;
    color: #d4af37;
    letter-spacing: 0.5px;
}

.family-card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-top: 32px;
    text-align: center;
}

.family-card-text {
    font-size: 14px;
    color: #ffffff;
    line-height: 1.4;
    font-family: "Songti SC", serif;
    margin-bottom: 12px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    text-align: center;
    word-wrap: break-word;
    word-break: break-word;
    max-width: 100%;
    padding: 0 12px;
}

.family-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: auto;
}

.family-card-hint {
    margin-top: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    font-style: italic;
}

.family-card-amount {
    font-size: 11px;
    color: #d4af37;
    font-weight: bold;
}

.family-card-status {
    font-size: 10px;
    color: rgba(212, 175, 55, 0.6);
    font-style: italic;
}

.family-card-reject-text {
    font-size: 11px;
    color: #ff6b6b;
    font-weight: bold;
}

.family-card-no {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    font-family: 'Courier New', Courier, monospace;
    letter-spacing: 1.5px;
}

.font-songti {
    font-family: "Songti SC", serif;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-fade-in-down {
    animation: fadeInDown 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
