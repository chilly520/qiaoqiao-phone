<template>
  <div 
    class="offline-stage flex flex-col h-screen font-sans overflow-hidden relative"
    :class="{ 'night-mode': settingsStore.offlineMode.themeMode === 'night' }"
  >
    <div class="absolute inset-0 z-0 overflow-hidden">
      <div
        class="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-[1.02]"
        :style="backgroundImageStyle"
      />
      <!-- 遮罩层 -->
      <div 
        class="absolute inset-0 transition-all duration-300"
        :style="overlayStyle"
      />
      <!-- 模糊层 -->
      <div 
        class="absolute inset-0 transition-all duration-300"
        :style="blurStyle"
      />
    </div>

    <div class="sticky top-0 px-5 pt-5 pb-3 shrink-0 offline-top-shell" style="z-index: 50;">
      <div class="max-w-[520px] mx-auto">
        <div class="flex items-center justify-between gap-3">
          <button @click="emit('back')" class="offline-lite-icon-btn">
            <i class="fa-solid fa-arrow-left text-[15px]"></i>
          </button>

          <div class="flex items-center gap-3">
            <!-- 切换到线上模式按钮 -->
            <button 
              @click="switchToOnlineMode"
              class="offline-lite-icon-btn relative"
              title="切换到线上模式">
              <i class="fa-solid fa-comments text-[14px] text-sky-500"></i>
              <!-- 小红点和呼吸灯 -->
              <div v-if="hasUnreadOnlineMessages" 
                class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white/80 shadow-sm animate-breathing-dot">
              </div>
            </button>

            <button @click="openInnerVoice" class="offline-lite-icon-btn">
              <i class="fa-solid fa-heart text-[14px]"></i>
            </button>

            <div class="relative" @click.stop>
              <button @click="toggleSettingsMenu" class="offline-lite-icon-btn">
                <i class="fa-solid fa-ellipsis text-[14px]"></i>
              </button>
              <div v-if="showSettingsMenu" class="absolute right-0 top-full mt-3 w-60 offline-menu-panel animate-slideUp">
                <button @click="toggleAutoRead(); toggleSettingsMenu()" class="offline-menu-item">
                  <span class="flex items-center gap-3">
                    <i class="fa-solid fa-volume-high text-[12px] text-amber-500"></i>
                    <span class="flex flex-col items-start">
                      <span>自动朗读</span>
                      <span class="menu-desc">更像线下旁白阅读</span>
                    </span>
                  </span>
                  <span class="text-[11px]" :class="autoRead ? 'text-rose-500' : 'text-slate-400'">
                    {{ autoRead ? '已开启' : '已关闭' }}
                  </span>
                </button>
                <button @click="openBackgroundModal(); toggleSettingsMenu()" class="offline-menu-item border-t border-slate-200/90">
                  <span class="flex items-center gap-3">
                    <i class="fa-regular fa-image text-[12px] text-sky-500"></i>
                    <span class="flex flex-col items-start">
                      <span>更换背景</span>
                      <span class="menu-desc">替换当前场景底图</span>
                    </span>
                  </span>
                  <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                </button>
                <button @click="toggleAIBackground(); toggleSettingsMenu()" class="offline-menu-item border-t border-slate-200/90">
                  <span class="flex items-center gap-3">
                    <i class="fa-solid fa-wand-magic-sparkles text-[12px] text-violet-500"></i>
                    <span class="flex flex-col items-start">
                      <span>AI 场景生成</span>
                      <span class="menu-desc">根据剧情自动切换背景</span>
                    </span>
                  </span>
                  <div :class="['w-9 h-5 rounded-full transition-all relative', settingsStore.offlineMode.enableAIBackground ? 'bg-rose-300' : 'bg-slate-200']">
                    <div :class="['absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm', settingsStore.offlineMode.enableAIBackground ? 'left-[18px]' : 'left-0.5']"></div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="scene-header-card">
          <h1 class="scene-heading">{{ sceneDisplayTitle }}</h1>
          <div class="scene-meta-row">
            <span class="scene-meta-item">
              <i class="fa-regular fa-calendar-days"></i>
              <span>{{ currentDateLabel }}</span>
            </span>
            <span class="scene-meta-item">
              <i class="fa-regular fa-clock"></i>
              <span>{{ currentTime }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div ref="msgContainer" class="offline-scroll flex-1 overflow-y-auto px-5 pt-1 pb-6 flex flex-col gap-1 relative" style="z-index: 30;" @scroll="handleScroll">
      
      <!-- 加载更早的记录 -->
      <div v-if="hasMoreMessages" class="w-full flex justify-center py-2 animate-fadeIn relative z-10">
        <button @click="loadMoreMessages" class="offline-load-more">
          <i class="fa-solid fa-clock-rotate-left mr-2"></i>更早的剧情
        </button>
      </div>

      <div class="w-full max-w-[520px] mx-auto flex flex-col gap-1 relative z-10">
        <template v-for="(msg, index) in filteredDisplayMsgs" :key="msg.id">
          <!-- 区间选择虚线 (多选模式下显示在消息之间) -->
          <div v-if="isMultiSelectMode && index > 0" 
              class="relative h-6 flex items-center justify-center cursor-pointer group select-range-divider"
              @click="selectRangeToIndex(index)">
              <div class="w-full border-t border-dashed border-white/40 group-hover:border-amber-300/70 transition-colors"></div>
              <div class="absolute bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white/80 group-hover:text-amber-300 transition-colors">
                  <i class="fa-solid fa-check-double mr-1"></i>选到这
              </div>
          </div>
          <div :id="'msg-' + msg.id" class="w-full relative z-10">
            <div class="message-item w-full flex items-stretch mb-2" :class="{ 'pl-10': isMultiSelectMode }">
              
              <!-- 多选复选框 -->
              <div v-if="isMultiSelectMode" class="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                  <button 
                      @click="toggleMessageSelection(msg.id)"
                      class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                      :class="selectedMsgIds.has(msg.id) 
                          ? 'bg-amber-500 border-amber-500' 
                          : 'border-white/50 bg-black/20 hover:border-amber-300'">
                      <i v-if="selectedMsgIds.has(msg.id)" class="fa-solid fa-check text-white text-xs"></i>
                  </button>
              </div>
          

              <!-- 内容区 - 正居中 -->
              <div class="w-full text-left">
                
                <!-- 消息内容 -->
                <div class="w-full"
                    @contextmenu.prevent="handleContextMenu(msg, $event)"
                    @touchstart="startLongPress(msg, $event)"
                    @touchmove="handleTouchMove"
                    @touchend="cancelLongPress"
                    @touchcancel="cancelLongPress">
                  <div class="w-full relative group">
                    <TheaterMessageRenderer
                      v-if="isOfflineTextMessage(msg)"
                      :msg="msg"
                      :chatData="chatData"
                      :suppressInitialAvatar="shouldSuppressInitialAvatar(index)"
                    />
                    <ChatMessageItem 
                      v-else
                      class="offline-special-message"
                      :msg="msg" 
                      :prevMsg="filteredDisplayMsgs[index - 1]" 
                      :chatData="chatData"
                      :forceOffline="true"
                      @click-pay="handlePayClick"
                    />
                    <button v-if="hasInnerVoiceBlockInMsg(msg) && !isMultiSelectMode" 
                      @click.stop="openInnerVoiceFromMsg(msg)"
                      class="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 hover:text-pink-500 z-10"
                      title="点击查看心声">
                      <i class="fa-solid fa-heart-pulse animate-pulse text-lg drop-shadow-md"></i>
                    </button>
                  </div>
                </div>

                <!-- (Redundant Action Button Removed as requested) -->
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 鎵撳瓧涓?-->
      <div v-if="chatStore.isTyping" class="flex flex-col items-center gap-3 w-full animate-pulse mb-4">
        <div class="flex items-center gap-1.5 bg-white/40 px-4 py-2 rounded-full border border-white/50 backdrop-blur-md">
          <div class="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
          <div class="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          <div class="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
        </div>
      </div>
    </div>

    <!-- 底部输入区 -->
    <div v-if="!isMultiSelectMode" class="relative z-[40] px-4 pb-3 pt-1 offline-input-dock">
      <div class="max-w-[520px] mx-auto">
      <OfflineChatInputBar 
        ref="inputBarRef"
        :chatData="chatData"
        :isTyping="chatStore.isTyping"
        :musicVisible="musicStore.isListeningTogether"
        :searchEnabled="true"
        :showScrollToBottom="showScrollToBottom"
        @send="handleSendMessage"
        @generate="generateAIResponse"
        @stop-generate="chatStore.stopGeneration"
        @scrollToBottom="scrollToBottom(false)"
        @togglePanel="togglePanel"
        @toggleEmoji="toggleEmoji"
        @toggleMusic="toggleMusic"
        @toggleSearch="toggleSearch"
        @toggle-offline-mode="toggleOfflineMode"
        @regenerate="regenerateAIResponse"
      />
      </div>
    </div>

    <!-- 多选操作栏 -->
    <div v-if="isMultiSelectMode"
        class="relative z-[40] h-[60px] bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-8">
        <button @click="exitMultiSelectMode"
            class="flex flex-col items-center justify-center text-white/80 hover:text-white transition-colors">
            <i class="fa-solid fa-xmark text-lg"></i>
            <span class="text-[10px] mt-0.5">取消</span>
        </button>

        <div class="flex gap-10">
            <button @click="selectToBottom"
                class="flex flex-col items-center justify-center text-white/80 hover:text-amber-300 transition-colors"
                :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                <i class="fa-solid fa-arrow-down text-lg"></i>
                <span class="text-[10px] mt-0.5">选到底部</span>
            </button>
            <button @click="favoriteSelectedMessages"
                class="flex flex-col items-center justify-center text-white/80 hover:text-amber-300 transition-colors"
                :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                <i class="fa-regular fa-star text-lg"></i>
                <span class="text-[10px] mt-0.5">收藏</span>
            </button>
            <button @click="deleteSelectedMessages"
                class="flex flex-col items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                :class="{ 'opacity-30': selectedMsgIds.size === 0 }">
                <i class="fa-regular fa-trash-can text-lg"></i>
                <span class="text-[10px] mt-0.5">删除</span>
            </button>
        </div>
        <div class="w-8"></div> <!-- Spacer -->
    </div>

    <!-- 通用弹窗/功能区 (提高层级防止被背景遮挡) -->
    <div class="relative z-[60]">
      <ChatInnerVoiceCard :visible="showInnerVoiceCard" :chat-id="chatStore.currentChatId" :initial-msg-id="currentInnerVoiceMsgId" :chat-data="chatData" @close="closeInnerVoice" />
      <BackgroundUploadModal 
        :visible="showBackgroundModal" 
        :initial-settings="{
          themeMode: settingsStore.offlineMode.themeMode || 'day',
          opacity: settingsStore.offlineMode.opacity ?? 1,
          blur: settingsStore.offlineMode.blur ?? 0,
          customBackground: settingsStore.offlineMode.customBackground
        }"
        @close="showBackgroundModal = false" 
        @confirm="handleBackgroundConfirm" 
      />
      <ChatActionPanel v-if="showActionPanel" :show="showActionPanel" @close="showActionPanel = false" @action="handleActionPanelAction" />
      <EmojiPicker v-if="showEmojiPicker" @select-emoji="handleEmojiSelect" @select-sticker="handleStickerSelect" />
    </div>
    
    <!-- 支付类弹窗 (Red Packet / Transfer) -->
    <div v-if="showSendModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showSendModal = false"></div>
      <div class="relative bg-white w-full max-w-[340px] rounded-[32px] overflow-hidden shadow-2xl animate-slideUp">
        <div :class="sendType === 'redpacket' ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'" class="h-16 flex items-center justify-center text-white font-bold">
          {{ sendType === 'redpacket' ? '发红包' : '转账' }}
        </div>
        <div class="p-6 space-y-4">
          <input v-model="sendAmount" type="number" placeholder="¥ 0.00" class="w-full px-4 py-4 bg-gray-50 rounded-2xl text-center text-2xl font-bold focus:outline-none" />
          <input v-model="sendNote" type="text" placeholder="留言..." class="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm focus:outline-none" />
          <button @click="confirmSend" class="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold shadow-lg active:scale-95 transition-all">确认发送</button>
        </div>
      </div>
    </div>

    <!-- UI 宸ュ叿 -->
    <ChatRedPacketModal 
      v-if="showRedPacketModal" 
      :visible="showRedPacketModal"
      :packet="currentPayMsg"
      :chatData="chatData"
      :isOpening="isOpeningPay"
      :showResult="showPayResult"
      :resultAmount="currentPayResult"
      @close="showRedPacketModal = false"
      @open="openRedPacket"
      @reject="showRedPacketModal = false"
    />
    <ChatTransferModal v-if="showTransferModal" @close="showTransferModal = false" />
    <MusicPlayer />
    <MissionSchedulerModal v-if="showMissionScheduler" @close="showMissionScheduler = false" />
    <FamilyCardActionModal v-model:visible="showFamilyCardModal" @action="handleFamilyCardAction" />
    <FamilyCardSendModal v-model:visible="showFamilyCardSendModal" :chatId="chatData?.id" @toast="showToast" />
    <FamilyCardApplyModal v-model:visible="showFamilyCardApplyModal" :chatId="chatData?.id" @toast="showToast" />
    <DiceModal v-if="showDiceModal" @close="showDiceModal = false" />
    <TarotModal v-if="showTarotModal" @close="showTarotModal = false" />
    <BackpackModal v-if="showBackpackModal" @close="showBackpackModal = false" />

    <!-- 鍓ф湰缂栬緫 -->
    <div v-if="showEditModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fadeIn">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="showEditModal = false"></div>
      <div class="relative w-full max-w-lg bg-white rounded-[40px] overflow-hidden shadow-2xl p-8">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-black text-gray-900">修改篇章</h3>
          <button @click="showEditModal = false"><i class="fa-solid fa-xmark text-xl text-gray-400"></i></button>
        </div>
        <textarea v-model="editingContent" class="w-full h-64 bg-gray-50 rounded-3xl p-6 text-gray-700 focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all text-lg leading-relaxed mb-6"></textarea>
        <button @click="confirmEdit" class="w-full py-5 rounded-3xl bg-gray-900 text-white font-black text-lg shadow-xl active:scale-95">确定</button>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="showContextMenu" class="fixed inset-0 z-[100] flex items-center justify-center"
        @click="closeContextMenu" @touchstart.stop="closeContextMenu">
      <div class="absolute inset-0 bg-black/20"></div>
      <div class="relative bg-[#2b2b2b] text-white rounded-xl shadow-2xl py-2 w-[160px] border border-[#333] transition-opacity duration-200"
          :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px', position: 'fixed' }"
          @click.stop @touchstart.stop>
        <div class="flex flex-col select-none">
          <div class="ctx-item" @click.stop="handleMenuAction('edit')"
              @touchstart.stop.prevent="handleMenuAction('edit')"><i class="fa-solid fa-pen w-5"></i> 编辑</div>
          <div class="ctx-item" @click.stop="handleMenuAction('history')"
              @touchstart.stop.prevent="handleMenuAction('history')"><i class="fa-solid fa-clock-rotate-left w-5"></i> 编辑历史</div>
          <div class="ctx-item" @click.stop="handleMenuAction('copy')"
              @touchstart.stop.prevent="handleMenuAction('copy')"><i class="fa-regular fa-copy w-5"></i> 复制</div>
          <div class="ctx-item" @click.stop="handleMenuAction('quote')"
              @touchstart.stop.prevent="handleMenuAction('quote')"><i class="fa-solid fa-quote-left w-5"></i> 引用</div>
          <div class="ctx-item" @click.stop="handleMenuAction('recall')"
              @touchstart.stop.prevent="handleMenuAction('recall')"><i class="fa-solid fa-rotate-left w-5"></i> 撤回</div>
          <div class="ctx-item" @click.stop="handleMenuAction('fav')"
              @touchstart.stop.prevent="handleMenuAction('fav')"><i class="fa-regular fa-star w-5"></i> 收藏</div>
          <div class="ctx-item" @click.stop="handleMenuAction('listen')"
              @touchstart.stop.prevent="handleMenuAction('listen')"><i class="fa-solid fa-volume-high w-5"></i> 听音</div>
          <div class="ctx-divider my-1 border-t border-white/10"></div>
          <div class="ctx-item" @click.stop="handleMenuAction('multi')"
              @touchstart.stop.prevent="handleMenuAction('multi')"><i class="fa-solid fa-list-check w-5"></i> 多选</div>
          <div class="ctx-item text-red-400" @click.stop="handleMenuAction('delete')"
              @touchstart.stop.prevent="handleMenuAction('delete')"><i class="fa-solid fa-trash w-5"></i> 删除</div>
        </div>
      </div>
    </div>

    <!-- History Modal -->
    <ChatHistoryModal v-model="showHistoryModal" :targetMsgId="historyTargetId" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMusicStore } from '../../stores/musicStore'
import { useCallStore } from '../../stores/callStore'
import { useWalletStore } from '../../stores/walletStore'
import { useWorldLoopStore } from '../../stores/worldLoopStore'
import { useRouter } from 'vue-router'
import ChatMessageItem from './components/ChatMessageItem.vue'
import TheaterMessageRenderer from './components/TheaterMessageRenderer.vue'
import { useStickerStore } from '../../stores/stickerStore'
import OfflineChatInputBar from './components/OfflineChatInputBar.vue'
import ChatInnerVoiceCard from './modals/ChatInnerVoiceCard.vue'
import BackgroundUploadModal from './modals/BackgroundUploadModal.vue'
import ChatActionPanel from './ChatActionPanel.vue'
import EmojiPicker from './EmojiPicker.vue'
import ChatRedPacketModal from './modals/ChatRedPacketModal.vue'
import ChatTransferModal from './modals/ChatTransferModal.vue'
import FamilyCardActionModal from './modals/FamilyCardActionModal.vue'
import FamilyCardSendModal from './modals/FamilyCardSendModal.vue'
import FamilyCardApplyModal from './modals/FamilyCardApplyModal.vue'
import DiceModal from './modals/DiceModal.vue'
import TarotModal from './modals/TarotModal.vue'
import BackpackModal from './modals/BackpackModal.vue'
import MusicPlayer from '../../components/MusicPlayer.vue'
import MissionSchedulerModal from './modals/MissionSchedulerModal.vue'
import ChatHistoryModal from './ChatHistoryModal.vue'
import {
  ensureMessageString,
  extractInnerVoiceData,
  extractLatestOfflineScene,
  hasInnerVoice as hasInnerVoiceBlock,
  isOfflineTextMessage,
  parseOfflineSegments,
  shouldShowInOfflineMode
} from '../../utils/chatMessageDisplay'
import { generateImage } from '../../utils/aiService'

const props = defineProps({
  initialUnreadCount: { type: Number, default: 0 }
})

const emit = defineEmits(['back', 'show-profile'])

const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const stickerStore = useStickerStore()
const musicStore = useMusicStore()
const callStore = useCallStore()
const walletStore = useWalletStore()
const worldLoopStore = useWorldLoopStore()

const DEFAULT_BACKGROUND = 'https://files.catbox.moe/e95o2s.jpg'

const sceneState = ref({
  location: '线下·未知位置',
  time: '21:30 PM',
  status: '未知'
})

const msgContainer = ref(null)
const inputBarRef = ref(null)
const showScrollToBottom = ref(false)
const showInnerVoiceCard = ref(false)
const currentInnerVoiceMsgId = ref(null)
const showBackgroundModal = ref(false)
const showEditModal = ref(false)
const editingContent = ref('')
const editingMsgId = ref(null)
const showSettingsMenu = ref(false)
const autoRead = ref(false)

// Context Menu
const showContextMenu = ref(false)
const selectedMsg = ref(null)
const menuPosition = ref({ x: 0, y: 0 })
const menuLock = ref(false)
let longPressTimer = null
let longPressPoint = null

// Multi Select & Quote
const isMultiSelectMode = ref(false)
const selectedMsgIds = ref(new Set())
const lastSelectedId = ref(null)
const currentQuote = ref(null)

// 切换消息选择状态
const toggleMessageSelection = (msgId) => {
    const newSet = new Set(selectedMsgIds.value)
    if (newSet.has(msgId)) {
        newSet.delete(msgId)
        if (lastSelectedId.value === msgId) {
            if (newSet.size === 0) lastSelectedId.value = null
        }
    } else {
        newSet.add(msgId)
        lastSelectedId.value = msgId
    }
    selectedMsgIds.value = newSet
}

// 选择从第一个勾选的消息到指定索引的所有消息（用于虚线区间选择）
const selectRangeToIndex = (endIndex) => {
    if (selectedMsgIds.value.size === 0) {
        // 如果没有选中任何消息，只选择当前虚线位置的消息
        const msg = filteredDisplayMsgs.value[endIndex]
        if (msg) {
            selectedMsgIds.value = new Set([msg.id])
            lastSelectedId.value = msg.id
        }
        return
    }

    const visibleMsgs = filteredDisplayMsgs.value
    
    // 找到第一个选中的消息索引
    let startIndex = -1
    for (let i = 0; i < visibleMsgs.length; i++) {
        if (selectedMsgIds.value.has(visibleMsgs[i].id)) {
            startIndex = i
            break
        }
    }
    
    if (startIndex === -1) return
    
    // 确保 startIndex <= endIndex
    const fromIndex = Math.min(startIndex, endIndex)
    const toIndex = Math.max(startIndex, endIndex)
    
    // 选择区间内的所有消息
    const newSet = new Set(selectedMsgIds.value)
    for (let i = fromIndex; i <= toIndex; i++) {
        if (visibleMsgs[i]) {
            newSet.add(visibleMsgs[i].id)
        }
    }
    selectedMsgIds.value = newSet
}

// 选择到底部
const selectToBottom = () => {
    if (selectedMsgIds.value.size === 0) return
    const visibleMsgs = filteredDisplayMsgs.value
    let minIdx = -1
    for (let i = 0; i < visibleMsgs.length; i++) {
        if (selectedMsgIds.value.has(visibleMsgs[i].id)) {
            minIdx = i
            break
        }
    }
    if (minIdx === -1) return
    const newSet = new Set(selectedMsgIds.value)
    for (let i = minIdx; i < visibleMsgs.length; i++) {
        newSet.add(visibleMsgs[i].id)
    }
    selectedMsgIds.value = newSet
}

// 退出多选模式
const exitMultiSelectMode = () => {
    isMultiSelectMode.value = false
    selectedMsgIds.value = new Set()
    lastSelectedId.value = null
}

// 收藏选中的消息
const favoriteSelectedMessages = () => {
    if (selectedMsgIds.value.size === 0) return
    
    const chatId = chatStore.currentChatId
    if (!chatId) return
    
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]')
    let addedCount = 0
    
    selectedMsgIds.value.forEach(msgId => {
        const msg = chatStore.currentChat?.msgs?.find(m => m.id === msgId)
        if (msg) {
            const exists = favorites.some(f => f.id === msg.id && f.chatId === chatId)
            if (!exists) {
                favorites.push({
                    ...msg,
                    chatId: chatId,
                    chatName: chatData.value?.name || '未知聊天',
                    favoritedAt: new Date().toISOString()
                })
                addedCount++
            }
        }
    })
    
    localStorage.setItem('favorites', JSON.stringify(favorites))
    showToast(`已收藏 ${addedCount} 条消息`, 'success')
    exitMultiSelectMode()
}

// 删除选中的消息
const deleteSelectedMessages = () => {
    if (selectedMsgIds.value.size === 0) return
    
    const chatId = chatStore.currentChatId
    if (!chatId) return
    
    selectedMsgIds.value.forEach(msgId => {
        chatStore.deleteMessage(chatId, msgId)
    })
    
    showToast(`已删除 ${selectedMsgIds.value.size} 条消息`, 'info')
    exitMultiSelectMode()
}

// History Modal
const showHistoryModal = ref(false)
const historyTargetId = ref(null)

const showActionPanel = ref(false)
const showEmojiPicker = ref(false)
const showSendModal = ref(false)
const sendType = ref('redpacket')
const sendAmount = ref('8.88')
const sendNote = ref('')
const showRedPacketModal = ref(false)
const showTransferModal = ref(false)
const showFamilyCardModal = ref(false)
const showFamilyCardSendModal = ref(false)
const showFamilyCardApplyModal = ref(false)
const showDiceModal = ref(false)
const showTarotModal = ref(false)
const showBackpackModal = ref(false)
const showMissionScheduler = ref(false)

const chatData = computed(() => chatStore.currentChat)
const msgs = computed(() => chatStore.currentChat?.msgs || [])

// 分页逻辑 - 与线上模式保持一致
const displayedMsgs = computed(() => {
  if (!chatStore.currentChatId) return []
  return chatStore.getDisplayedMessages(chatStore.currentChatId).filter(m => !m.hidden)
})
const filteredDisplayMsgs = computed(() => (displayedMsgs.value || []).filter(msg => isMsgVisible(msg)))

const hasMoreMessages = computed(() => {
  if (!chatStore.currentChatId) return false
  return chatStore.hasMoreMessages(chatStore.currentChatId)
})

const loadMoreMessages = () => {
  if (!chatStore.currentChatId) return
  chatStore.loadMoreMessages(chatStore.currentChatId)
}

// 检测是否有未读的线上消息（用于线下模式显示提示）
const hasUnreadOnlineMessages = computed(() => {
  if (!chatData.value?.msgs) return false
  const lastReadOnlineMsgId = localStorage.getItem(`lastReadOnline_${chatData.value?.id}`)
  const onlineMsgs = chatData.value.msgs.filter(m => m.mode === 'online' && m.role === 'ai')
  if (onlineMsgs.length === 0) return false
  if (!lastReadOnlineMsgId) return true
  const lastUnread = onlineMsgs.find(m => m.id === lastReadOnlineMsgId)
  if (!lastUnread) return true
  // 检查是否有更新的线上消息
  const lastUnreadIndex = onlineMsgs.findIndex(m => m.id === lastReadOnlineMsgId)
  return lastUnreadIndex < onlineMsgs.length - 1
})

// 切换到线上模式并标记已读
const switchToOnlineMode = () => {
  if (chatData.value?.loopId) {
    // 标记最后一条线上消息为已读
    const onlineMsgs = chatData.value.msgs?.filter(m => m.mode === 'online' && m.role === 'ai')
    if (onlineMsgs && onlineMsgs.length > 0) {
      const lastMsg = onlineMsgs[onlineMsgs.length - 1]
      localStorage.setItem(`lastReadOnline_${chatData.value.id}`, lastMsg.id)
    }
    // 切换到线上模式
    worldLoopStore.toggleMode(chatData.value.loopId)
  }
}

const currentTime = ref('12:00')
const currentDateLabel = ref('')
const currentHour = ref(12)
let clockTimer = null

const scenePeriodLabel = computed(() => {
  if (currentHour.value < 6) return '深夜'
  if (currentHour.value < 11) return '清晨'
  if (currentHour.value < 14) return '午前'
  if (currentHour.value < 18) return '午后'
  if (currentHour.value < 21) return '傍晚'
  return '夜晚'
})

const sceneStatusLabel = computed(() => (
  sceneState.value.status && sceneState.value.status !== '未知'
    ? sceneState.value.status
    : '线下叙事模式'
))

const sceneDisplayTitle = computed(() => `${sceneState.value.location} · ${scenePeriodLabel.value}`)

// 背景图片样式
const backgroundImageStyle = computed(() => {
  const bg = settingsStore.offlineMode.customBackground || DEFAULT_BACKGROUND
  const opacity = settingsStore.offlineMode.opacity ?? (settingsStore.offlineMode.customBackground ? 1 : 0.22)
  return {
    backgroundImage: `url(${bg})`,
    opacity: opacity
  }
})

// 遮罩层样式
const overlayStyle = computed(() => {
  const isNight = settingsStore.offlineMode.themeMode === 'night'
  const isCustomBg = !!settingsStore.offlineMode.customBackground
  
  if (isCustomBg) {
    // 自定义背景：根据主题模式调整遮罩
    return {
      backgroundColor: isNight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)'
    }
  } else {
    // 默认背景：日间模式使用白色渐变，夜间模式使用深色渐变
    if (isNight) {
      return {
        background: 'linear-gradient(180deg, rgba(10,10,20,0.95), rgba(15,15,30,0.98) 24%, rgba(20,20,40,0.99) 100%)'
      }
    } else {
      return {
        background: 'linear-gradient(180deg, rgba(244,246,249,0.92), rgba(244,246,249,0.96) 24%, rgba(241,244,247,0.98) 100%)'
      }
    }
  }
})

// 模糊层样式
const blurStyle = computed(() => {
  const blur = settingsStore.offlineMode.blur ?? 0
  const isCustomBg = !!settingsStore.offlineMode.customBackground
  
  if (isCustomBg) {
    return {
      backdropFilter: `blur(${blur}px)`,
      WebkitBackdropFilter: `blur(${blur}px)`
    }
  } else {
    // 默认背景固定使用 10px 模糊
    return {
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    }
  }
})

const updateTime = () => {
  const now = new Date()
  currentHour.value = now.getHours()
  currentTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  currentDateLabel.value = `${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`
}
updateTime()

const toggleAutoRead = () => {
  autoRead.value = !autoRead.value
  if (!autoRead.value && window.speechSynthesis) window.speechSynthesis.cancel()
}

const toggleSettingsMenu = () => { showSettingsMenu.value = !showSettingsMenu.value }
const openBackgroundModal = () => { showBackgroundModal.value = true }
const toggleAIBackground = () => { settingsStore.toggleAIBackground() }
const openInnerVoice = () => { showInnerVoiceCard.value = true }
const closeInnerVoice = () => { showInnerVoiceCard.value = false }
const toggleOfflineMode = () => {
  // 标记线上消息为已读（从线下切换到线上时）
  if (chatData.value?.id) {
    const onlineMsgs = chatData.value.msgs?.filter(m => m.mode === 'online' && m.role === 'ai')
    if (onlineMsgs && onlineMsgs.length > 0) {
      const lastMsg = onlineMsgs[onlineMsgs.length - 1]
      localStorage.setItem(`lastReadOnline_${chatData.value.id}`, lastMsg.id)
      console.log('[OfflineModeChatWindow] Marked online messages as read:', lastMsg.id)
    }
  }
  settingsStore.toggleOfflineMode()
}

const isUserNearBottom = ref(true)

const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  showScrollToBottom.value = distanceFromBottom > 300
  // 记录用户是否在底部附近（100px内）
  isUserNearBottom.value = distanceFromBottom < 100
}

const scrollToBottom = (instant = false) => {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTo({
        top: msgContainer.value.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
      })
    }
  })
}

const isMsgVisible = (msg) => {
  // 线下模式消息过滤逻辑
  if (!msg) return false
  if (msg.hidden) return false
  
  // 确定消息的归属模式（老旧消息没有 mode 标识时，通过内容启发推断）
  let mode = msg.mode;
  if (!mode) {
      const rawContent = ensureString(msg.content);
      mode = rawContent.includes('[OFFLINE]') ? 'offline' : 'online';
  }

  // 关键：严格过滤掉明确标记为线上模式的消息
  if (mode === 'online') return false
  
  // 过滤掉朋友圈相关消息（朋友圈应该在朋友圈界面显示，不在聊天界面）
  if (msg.type === 'moment_card' || msg.type === 'moment') return false
  const content = ensureString(msg.content)
  if (content.includes('[MOMENT_SHARE') || content.includes('[分享朋友圈')) return false
  
  // 在 offline mode 中，只要通过了 mode === 'offline' 校验就可以显示
  // 但对于某些特殊的没有 mode 标记的历史 AI 消息，这里保留简单的 shouldShowInOfflineMode 退路
  if (msg.role === 'ai' || msg.role === 'assistant') {
    if (msg.mode === 'offline') return true
    return shouldShowInOfflineMode(msg)
  }
  
  // 用户发出的、或者系统提示（此时其 mode 已确认是 offline）必定显示
  return true
}

const shouldShowHeader = (msg, index) => {
  if (index === 0) return true
  const prevMsg = filteredDisplayMsgs.value[index - 1]
  if (!prevMsg) return true
  return msg.role !== prevMsg.role || (msg.timestamp - prevMsg.timestamp) > 300000
}

const ensureString = (val) => {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? v : (v.text || '')).join('')
  return String(val || '')
}

const looksLikeMojibake = (value) => {
  const text = ensureString(value).trim()
  if (!text) return false
  // 检测常见的乱码字符模式 ()
  return /[\ufffd]/.test(text)
}

const hasInnerVoiceBlockInMsg = (msg) => hasInnerVoiceBlock(msg?.content, msg)

const updateSceneState = () => {
  const latestScene = extractLatestOfflineScene(filteredDisplayMsgs.value)
  if (latestScene?.location && !looksLikeMojibake(latestScene.location)) {
    sceneState.value.location = latestScene.location
  } else {
    sceneState.value.location = '线下·未知位置'
  }

  for (let index = filteredDisplayMsgs.value.length - 1; index >= 0; index -= 1) {
    const msg = filteredDisplayMsgs.value[index]
    const innerVoice = extractInnerVoiceData(msg?.content, msg)
    const status = innerVoice?.status || innerVoice?.state
    if (typeof status === 'string' && status.trim() && !looksLikeMojibake(status)) {
      sceneState.value.status = status.trim()
      return
    }
  }

  sceneState.value.status = '未知'
}

const shouldSuppressInitialAvatar = (index) => {
  const currentMsg = filteredDisplayMsgs.value[index]
  const prevMsg = filteredDisplayMsgs.value[index - 1]

  if (!currentMsg || !prevMsg) return false
  if (!isOfflineTextMessage(currentMsg) || !isOfflineTextMessage(prevMsg)) return false
  if (currentMsg.role !== prevMsg.role) return false

  const prevSegments = parseOfflineSegments(prevMsg.content)
  const currentSegments = parseOfflineSegments(currentMsg.content)
  if (!prevSegments.length || !currentSegments.length) return false

  const prevAllDialogue = prevSegments.every((segment) => segment.type === 'dialogue')
  const currentStartsWithDialogue = currentSegments[0]?.type === 'dialogue'

  return prevAllDialogue && currentStartsWithDialogue
}



const handleSendMessage = (msg) => {
  console.log('[handleSendMessage] Sending message with mode: offline', { content: msg.content })
  chatStore.addMessage(chatStore.currentChatId, {
    role: 'user',
    content: msg.content,
    mode: 'offline',
    timestamp: Date.now()
  })
  nextTick(() => scrollToBottom())
}

// 处理红包/转账点击
const currentPayMsg = ref(null)
const currentPayResult = ref(null)
const isOpeningPay = ref(false)
const showPayResult = ref(false)

const handlePayClick = (msg) => {
  currentPayMsg.value = msg
  const content = ensureString(msg.content)
  const isRedPacket = msg.type === 'redpacket' || content.includes('[红包]')
  const hasMyClaim = msg.claims?.some(c => c.id === 'user')
  
  // 私聊红包逻辑：如果是对方发的且未领取，显示开红包界面
  if (isRedPacket) {
    // 私聊中，如果对方发的红包，且未领取，则显示开红包
    if (msg.role === 'ai' && !hasMyClaim && !msg.isClaimed) {
      showPayResult.value = false
    } else {
      // 已领取或自己发的，显示详情
      showPayResult.value = true
    }
    showRedPacketModal.value = true
  } else {
    // 转账
    showTransferModal.value = true
  }
}

const openRedPacket = async () => {
  if (!currentPayMsg.value) return
  isOpeningPay.value = true
  
  // 模拟开红包动画
  setTimeout(() => {
    isOpeningPay.value = false
    showPayResult.value = true
    
    // 更新消息状态为已领取
    const msg = currentPayMsg.value
    if (!msg.claims) msg.claims = []
    msg.claims.push({
      id: 'user',
      name: '我',
      amount: msg.amount || 0.01,
      timestamp: Date.now()
    })
    msg.isClaimed = true
    chatStore.saveChats()
    
    currentPayResult.value = msg.amount || 0.01
  }, 800)
}

const generateAIResponse = () => { chatStore.sendMessageToAI(chatStore.currentChatId, { mode: 'offline' }) }

const togglePanel = () => { showActionPanel.value = !showActionPanel.value }
const toggleEmoji = () => { showEmojiPicker.value = !showEmojiPicker.value }
const toggleMusic = () => { 
  musicStore.isListeningTogether = !musicStore.isListeningTogether
  musicStore.playerVisible = musicStore.isListeningTogether
}
const toggleSearch = () => { /* Logic */ }
const regenerateAIResponse = () => { 
  const chat = chatStore.chats[chatStore.currentChatId]
  if (!chat || !chat.msgs || !chat.msgs.length) return
  const msgs = chat.msgs
  const lastMsg = msgs[msgs.length - 1]
  if (lastMsg.role === 'ai') {
      let count = 0
      for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'ai') count++
          else break
      }
      chat.msgs.splice(msgs.length - count, count)
      chatStore.saveChats()
  }
  chatStore.sendMessageToAI(chatStore.currentChatId, { mode: 'offline' }) 
}

const handleActionPanelAction = (action) => {
  showActionPanel.value = false
  switch(action) {
    case 'redpacket': sendType.value = 'redpacket'; showSendModal.value = true; break
    case 'transfer': sendType.value = 'transfer'; showSendModal.value = true; break
    case 'dice': showDiceModal.value = true; break
    case 'tarot': showTarotModal.value = true; break
    case 'backpack': showBackpackModal.value = true; break
    case 'family-card': showFamilyCardModal.value = true; break
    case 'timer': showMissionScheduler.value = true; break
    case 'lovespace': router.push('/couple'); break
  }
}

const handleEmojiSelect = (emoji) => {
  const textarea = document.querySelector('textarea')
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    textarea.value = text.substring(0, start) + emoji + text.substring(end)
    textarea.focus()
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length
  }
  showEmojiPicker.value = false
}

const handleStickerSelect = (sticker) => {
  chatStore.addMessage(chatStore.currentChatId, {
    role: 'user',
    type: 'sticker',
    content: sticker.name,
    sticker: sticker,
    mode: 'offline'
  })
  showEmojiPicker.value = false
}

const handleFamilyCardAction = (action) => {
  showFamilyCardModal.value = false
  if (action === 'send') showFamilyCardSendModal.value = true
  else if (action === 'apply') showFamilyCardApplyModal.value = true
}

const showToast = (msg) => {
  // Simple toast implementation
  const toast = document.createElement('div')
  toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg z-[9999] animate-fadeIn'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.remove()
  }, 2000)
}

const confirmSend = () => {
  const amount = parseFloat(sendAmount.value)
  if (!amount || amount <= 0) return
  const isRP = sendType.value === 'redpacket'
  chatStore.addMessage(chatStore.currentChatId, {
    role: 'user',
    type: sendType.value,
    content: `${isRP ? '红包' : '转账'}${amount}元${sendNote.value ? ' - ' + sendNote.value : ''}`,
    mode: 'offline',
    amount,
    note: sendNote.value,
    timestamp: Date.now()
  })
  showSendModal.value = false
  scrollToBottom(true)
}

// Context Menu Functions
const handleContextMenu = (msg, event) => {
  if (!event) {
    menuPosition.value = { x: window.innerWidth / 2 - 70, y: window.innerHeight / 2 - 230 }
    selectedMsg.value = msg
    showContextMenu.value = true
    return
  }
  let x = event.clientX || (event.touches && event.touches.length > 0 ? event.touches[0].clientX : 0)
  let y = event.clientY || (event.touches && event.touches.length > 0 ? event.touches[0].clientY : 0)
  const menuWidth = 140
  const menuHeight = 460
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
  if (y + menuHeight > window.innerHeight) {
    y = y - menuHeight
    if (y < 10) y = 10
  }
  menuPosition.value = { x, y }
  selectedMsg.value = msg
  showContextMenu.value = true
  menuLock.value = true
  setTimeout(() => { menuLock.value = false }, 400)
  if (navigator.vibrate) navigator.vibrate(50)
}

const startLongPress = (msg, event) => {
  if (!(event.touches && event.touches.length > 0)) return
  const touch = event.touches[0]
  longPressPoint = { x: touch.clientX || 0, y: touch.clientY || 0 }
  const capturedEvent = { clientX: touch.clientX || 0, clientY: touch.clientY || 0 }
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    handleContextMenu(msg, capturedEvent)
    menuLock.value = true
    setTimeout(() => { menuLock.value = false }, 500)
    longPressTimer = null
    longPressPoint = null
  }, 650)
}

const handleTouchMove = (event) => {
  if (!longPressPoint || !event.touches || event.touches.length === 0) return
  const touch = event.touches[0]
  const dx = Math.abs((touch.clientX || 0) - longPressPoint.x)
  const dy = Math.abs((touch.clientY || 0) - longPressPoint.y)
  if (dx > 30 || dy > 30) cancelLongPress()
}

const cancelLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  longPressPoint = null
}

const closeContextMenu = () => {
  if (menuLock.value) return
  showContextMenu.value = false
  selectedMsg.value = null
}

const handleMenuAction = (action) => {
  if (!selectedMsg.value) return
  const chatId = chatStore.currentChatId
  const msgs = chatStore.chats[chatId]?.msgs || []
  const idx = msgs.findIndex(m => m.id === selectedMsg.value.id)
  
  switch (action) {
    case 'copy':
      navigator.clipboard.writeText(ensureString(selectedMsg.value.content))
      break
    case 'edit':
      editingContent.value = selectedMsg.value.content
      editingMsgId.value = selectedMsg.value.id
      showEditModal.value = true
      break
    case 'delete':
      chatStore.deleteMessage(chatId, selectedMsg.value.id)
      break
    case 'history':
      historyTargetId.value = selectedMsg.value.id
      showHistoryModal.value = true
      break
    case 'quote':
      currentQuote.value = {
        id: selectedMsg.value.id,
        content: ensureString(selectedMsg.value.content),
        role: selectedMsg.value.role
      }
      nextTick(() => {
        const el = document.querySelector('textarea')
        if (el) el.focus()
      })
      break
    case 'recall':
      if (idx !== -1) {
        const senderName = msgs[idx].role === 'user' ? '你' : (chatData.value?.name || '对方')
        const recallMsg = {
          ...msgs[idx],
          type: 'system',
          content: `${senderName}撤回了一条消息`,
          isRecallTip: true,
          realContent: msgs[idx].content
        }
        msgs.splice(idx, 1, recallMsg)
        chatStore.saveChats()
      }
      break
    case 'fav':
      const favorites = JSON.parse(localStorage.getItem('favorites') || '[]')
      favorites.push({
        id: selectedMsg.value.id,
        content: selectedMsg.value.content,
        role: selectedMsg.value.role,
        timestamp: selectedMsg.value.timestamp,
        chatId: chatId,
        chatName: chatData.value?.name || '未知聊天'
      })
      localStorage.setItem('favorites', JSON.stringify(favorites))
      showToast('已收藏')
      break
    case 'listen':
      // TTS 听音功能
      const utterance = new SpeechSynthesisUtterance(ensureString(selectedMsg.value.content))
      utterance.lang = 'zh-CN'
      speechSynthesis.speak(utterance)
      break
    case 'multi':
      isMultiSelectMode.value = true
      selectedMsgIds.value.add(selectedMsg.value.id)
      break
  }
  showContextMenu.value = false
}

const confirmEdit = () => {
  if (editingMsgId.value) chatStore.updateMessage(chatStore.currentChatId, editingMsgId.value, { content: editingContent.value })
  showEditModal.value = false
}

const handleBackgroundConfirm = (result) => {
  const config = {
    themeMode: result.themeMode || 'day',
    opacity: result.opacity ?? 1,
    blur: result.blur ?? 0
  }
  
  if (result.type === 'reset') {
    config.customBackground = null
  } else if (result.type === 'url' || result.type === 'local' || result.type === 'update') {
    // 支持新上传、本地上传和仅更新参数的情况
    config.customBackground = result.data || result.url
  }
  
  settingsStore.setOfflineModeConfig(config)
  showBackgroundModal.value = false
}

const openInnerVoiceFromMsg = (msg) => {
  currentInnerVoiceMsgId.value = msg.id
  showInnerVoiceCard.value = true
}

const hasInnerVoice = (msg) => hasInnerVoiceBlock(msg?.content, msg)

watch(
  filteredDisplayMsgs,
  async () => {
    updateSceneState()
    // 只有当用户已经在底部附近时才自动滚动，避免用户往上滑动查看历史时被强制拉回底部
    if (isUserNearBottom.value) {
      scrollToBottom()
    }
    
    // 检测【场景：...】指令并生成背景图
    if (settingsStore.offlineMode.enableAIBackground) {
      const lastMsg = filteredDisplayMsgs.value[filteredDisplayMsgs.value.length - 1]
      if (lastMsg && lastMsg.role === 'ai') {
        const content = ensureMessageString(lastMsg.content)
        // 匹配【场景：英文描述】格式
        const sceneMatch = content.match(/【场景：\s*([^】]+)】/)
        if (sceneMatch) {
          const scenePrompt = sceneMatch[1].trim()
          if (scenePrompt) {
            try {
              console.log('[OfflineMode] 检测到场景指令，生成背景图:', scenePrompt)
              const imageUrl = await generateImage(scenePrompt, { width: 1024, height: 1024 })
              if (imageUrl) {
                settingsStore.offlineMode.customBackground = imageUrl
                console.log('[OfflineMode] 背景图已更新:', imageUrl)
              }
            } catch (e) {
              console.error('[OfflineMode] 生成背景图失败:', e)
            }
          }
        }
      }
    }
  },
  { deep: true }
)

onMounted(() => {
  clockTimer = window.setInterval(updateTime, 1000)
  updateSceneState()
  scrollToBottom(true)
})

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
})
</script>

<style scoped>
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.animate-fadeIn { animation: fadeIn 0.4s ease-out backwards; }
.animate-slideUp { animation: slideUp 0.3s ease-out; }

/* 呼吸灯动画 - 用于未读消息小红点 */
@keyframes breathing-dot {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
    box-shadow: 0 0 6px 3px rgba(239, 68, 68, 0.5);
  }
}

.animate-breathing-dot {
  animation: breathing-dot 1.5s ease-in-out infinite;
}

.offline-stage {
  color: #1f2937;
}

.offline-top-shell {
  background: linear-gradient(180deg, rgba(244, 246, 249, 0.88), rgba(244, 246, 249, 0.68), rgba(244, 246, 249, 0));
}

.offline-lite-icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #708094;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(220, 226, 235, 0.92);
  box-shadow: 0 8px 18px rgba(147, 163, 184, 0.1);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.offline-lite-icon-btn:active {
  transform: scale(0.96);
}

.scene-header-card {
  margin-top: 14px;
}

.scene-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #8a97a8;
  margin-bottom: 6px;
}

.scene-heading {
  margin: 0;
  color: #21354d;
  font-size: clamp(22px, 4vw, 28px);
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.01em;
}

.scene-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
}

.scene-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6f7f93;
  font-size: 12px;
  font-weight: 600;
}

.offline-input-dock {
  background: linear-gradient(180deg, rgba(244, 246, 249, 0), rgba(244, 246, 249, 0.82) 28%, rgba(244, 246, 249, 0.96));
}

.offline-menu-panel {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(226, 232, 240, 0.96);
  border-radius: 22px;
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 50px rgba(148, 163, 184, 0.18);
  padding: 6px 0;
}

.offline-menu-item {
  width: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #334155;
  font-size: 12px;
  transition: background 0.18s ease;
}

.offline-menu-item:hover {
  background: rgba(241, 245, 249, 0.9);
}

.menu-desc {
  font-size: 10px;
  color: #94a3b8;
}

.offline-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
}

.offline-load-more {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid rgba(222, 229, 239, 0.95);
  background: rgba(255, 255, 255, 0.9);
  color: #708094;
  font-size: 11px;
  box-shadow: 0 8px 18px rgba(148, 163, 184, 0.1);
}

.offline-special-message {
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(228, 233, 240, 0.92);
  box-shadow: 0 10px 24px rgba(148, 163, 184, 0.08);
  overflow: hidden;
}

/* --- 鍥炲綊鍘熷绾噣鐗?(Original Style) --- */
.centered-story-render {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:deep(.origin-node) {
  width: 100%;
  color: white;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  line-height: 1.8;
}

/* 鍦烘櫙鏍囩 銆?..銆?*/
:deep(.node-scene) {
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.2em;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  align-self: center;
  margin: 10px 0;
}

/* 旁白 "..." */
:deep(.node-narration) {
  text-align: center;
  font-style: italic;
  font-family: "KaiTi", serif;
  color: rgba(255, 255, 255, 0.6);
  padding: 12px 0;
}

/* 动作 (行为或心理描写) */
:deep(.node-action) {
  color: rgba(255, 255, 255, 0.7); /* 取消紫色，改用柔和的白色透明度 */
  font-size: 15px;
  text-align: center;
  font-weight: normal;
  margin: 5px 0;
}

:deep(.node-speech) {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 8px 0;
}

:deep(.node-avatar) {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  flex-shrink: 0;
}

:deep(.node-speech.right) {
  flex-direction: row-reverse;
  text-align: right;
}

:deep(.node-name) {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 2px;
}

:deep(.node-text) {
  font-size: 17px;
  color: white;
  white-space: pre-wrap;
}

:deep(.node-inline-sticker) {
  display: inline-block;
  height: 60px;
  vertical-align: middle;
}

:deep(.origin-centered-sticker), :deep(.origin-centered-card) {
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 10px 0;
}

:deep(.origin-centered-sticker img) {
  max-width: 160px;
  border-radius: 8px;
}

.speech-content {
  flex: 1;
  color: #1a1a1a;
  font-size: 16px;
  line-height: 1.6;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05), inset 0 0 10px rgba(255,255,255,0.4);
  position: relative;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

:deep(.dialogue-left .dialogue-bubble) {
  border-top-left-radius: 4px;
}

:deep(.dialogue-right .dialogue-bubble) {
  background: rgba(255, 182, 193, 0.25);
  border-top-right-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
.ai-custom-html-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0;
  overflow-x: auto;
}
.ai-custom-html-container > div {
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

:deep(.dialogue-left .dialogue-bubble) {
  padding-right: 20px;
}

:deep(.dialogue-right .dialogue-bubble) {
  padding-left: 20px;
}

:deep(.scene-line) {
  width: 100%;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  padding: 15px 0;
}

.centered-story-render {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  gap: 6px;
}

:deep(.theater-sticker-wrap) {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 15px 0;
}
:deep(.theater-sticker) {
  max-width: 150px;
  max-height: 150px;
  border-radius: 12px;
  object-fit: contain;
  filter: drop-shadow(0 4px 15px rgba(0,0,0,0.3));
  pointer-events: none;
  animation: slideUp 0.4s ease-out;
}

/* Context Menu Styles */
.ctx-item {
  padding: 14px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 15px;
  transition: background 0.15s;
  color: #e0e0e0;
}
.ctx-item:hover {
  background: rgba(255,255,255,0.08);
}
.ctx-item:active {
  background: rgba(255,255,255,0.15);
}
.ctx-divider {
  border-top: 1px solid rgba(255,255,255,0.1);
  margin: 4px 0;
}

/* ==================== 夜间模式样式 ==================== */
.night-mode :deep(.node-speech-content),
.night-mode :deep(.dialogue-bubble) {
  color: #ffffff !important;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.night-mode :deep(.node-narration) {
  color: rgba(255, 255, 255, 0.7);
}

.night-mode :deep(.node-action) {
  color: rgba(255, 255, 255, 0.8);
}

.night-mode :deep(.node-name) {
  color: rgba(255, 255, 255, 0.5);
}

.night-mode :deep(.node-scene) {
  color: rgba(255, 255, 255, 0.95);
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

/* 夜间模式 - 顶部区域暗色 */
.night-mode .offline-top-shell {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.7), rgba(15, 23, 42, 0));
}

.night-mode .offline-lite-icon-btn {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(71, 85, 105, 0.6);
  color: #94a3b8;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.3);
}

.night-mode .scene-heading {
  color: #e2e8f0;
}

.night-mode .scene-kicker {
  color: #64748b;
}

.night-mode .scene-meta-item {
  color: #94a3b8;
}

/* 夜间模式 - 底部输入区域暗色 */
.night-mode .offline-input-dock {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0), rgba(15, 23, 42, 0.85) 28%, rgba(15, 23, 42, 0.98));
}

.night-mode .offline-menu-panel {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(71, 85, 105, 0.6);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
}

.night-mode .offline-menu-item {
  color: #cbd5e1;
}

.night-mode .offline-menu-item:hover {
  background: rgba(51, 65, 85, 0.6);
}

.night-mode .menu-desc {
  color: #64748b;
}

.night-mode .offline-load-more {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(71, 85, 105, 0.6);
  color: #94a3b8;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.3);
}

/* 日间模式样式（覆盖默认白色文字） */
:deep(.node-speech-content),
:deep(.dialogue-bubble) {
  color: #1a1a2e;
  text-shadow: none;
}

:deep(.node-narration) {
  color: rgba(0, 0, 0, 0.5);
}

:deep(.node-action) {
  color: rgba(0, 0, 0, 0.6);
}

:deep(.node-name) {
  color: rgba(0, 0, 0, 0.4);
}

:deep(.node-scene) {
  color: rgba(0, 0, 0, 0.8);
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

/* 多选虚线区间选择样式 */
.select-range-divider {
  transition: all 0.2s ease;
}

.select-range-divider:hover {
  background: rgba(251, 191, 36, 0.1);
}

/* 多选复选框动画 */
.message-item button {
  transition: all 0.2s ease;
}

.message-item button:active {
  transform: scale(0.9);
}
</style>
