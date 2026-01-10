<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore, getRandomAvatar } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import ChatWindow from './ChatWindow.vue'

const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const userProfile = computed(() => settingsStore.personalization.userProfile)

// State
const currentTab = ref('chat') // 'chat', 'contacts', 'discover', 'me'
const showAddMenu = ref(false)
const expandFriends = ref(true)
const expandNPC = ref(false)
const showAddFriendModal = ref(false)
const newFriendName = ref('')

// Context Menu State
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuTarget = ref(null) // { type: 'chat'|'contact', id: '...' }
const contextMenuOptions = ref([]) // [{ label: '...', action: '...' }]
// Confirm Modal State
const showConfirmModal = ref(false)
const confirmCallback = ref(null)
const confirmMessage = ref('')

// Toast State
const showToast = ref(false)
const toastMessage = ref('')

const triggerToast = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => {
        showToast.value = false
    }, 2000)
}

// Profile Edit Modal State
const showProfileEdit = ref(false)
const profileForm = ref({
    name: '',
    wechatId: '',
    avatar: ''
})
const profileFileInput = ref(null)

const openProfileEdit = () => {
    profileForm.value = { ...userProfile.value }
    showProfileEdit.value = true
}

const saveProfile = () => {
    settingsStore.updateUserProfile(profileForm.value)
    showProfileEdit.value = false
    triggerToast('修改成功')
}

const triggerProfileAvatarUpload = () => {
    profileFileInput.value.click()
}

const handleProfileAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
            profileForm.value.avatar = ev.target.result
        }
        reader.readAsDataURL(file)
    }
}

// Long Press Helper
const promptProfileAvatarUrl = () => {
    const url = prompt('请输入头像URL')
    if (url) profileForm.value.avatar = url
}

// Long Press Helper
let longPressTimer = null
const startLongPress = (type, item, event) => {
    longPressTimer = setTimeout(() => {
        openContextMenu(type, item, event)
    }, 500) // 500ms for long press
}
const clearLongPress = () => {
    if (longPressTimer) clearTimeout(longPressTimer)
}

const openContextMenu = (type, item, event) => {
    event.preventDefault() // Prevent native menu
    showContextMenu.value = true
    // Calculate position
    // If touch event, use touches[0]
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    
    // Boundary check (keep within screen)
    let x = clientX
    let y = clientY
    // Add simple offset
    
    contextMenuPos.value = { x, y }
    contextMenuTarget.value = { type, id: item.id }
    
    if (type === 'chat') {
        const isPinned = item.isPinned
        contextMenuOptions.value = [
            { label: isPinned ? '取消置顶' : '置顶', action: 'pin', icon: 'fa-thumbtack' },
            { label: '删除聊天记录', action: 'clear', icon: 'fa-trash-can' }
        ]
    } else if (type === 'contact') {
        contextMenuOptions.value = [
            { label: '删除好友', action: 'delete', icon: 'fa-user-xmark', danger: true }
        ]
    }
}

const handleContextAction = (option) => {
    const { type, id } = contextMenuTarget.value
    if (option.action === 'pin') {
        chatStore.pinChat(id)
    } else if (option.action === 'clear') {
        chatStore.clearHistory(id)
        triggerToast('已清除')
    } else if (option.action === 'delete') {
        confirmMessage.value = '确定要删除该好友吗？将同时删除所有记录。'
        showConfirmModal.value = true
        confirmCallback.value = () => {
             chatStore.deleteChat(id)
             showConfirmModal.value = false
        }
    }
    showContextMenu.value = false
}

const confirmAction = () => {
    if (confirmCallback.value) confirmCallback.value()
}

const toggleAddMenu = () => {
    showAddMenu.value = !showAddMenu.value
}

const handleAddAction = (action) => {
    showAddMenu.value = false
    if (action === 'group') {
        alert('群聊功能开发中...')
    } else if (action === 'friend') {
        newFriendName.value = ''
        showAddFriendModal.value = true
    }
}

const confirmAddFriend = () => {
    if (!newFriendName.value.trim()) return
    const name = newFriendName.value
    showAddFriendModal.value = false
    
    const newChat = chatStore.createChat(name)
    chatStore.currentChatId = newChat.id
    newChat.isNew = true
}

const openChat = (chatId) => {
  chatStore.currentChatId = chatId
  // Ensure it shows in chat list when opened from contacts
  chatStore.updateCharacter(chatId, { inChatList: true })
}

const navigateToSettings = () => {
    router.push('/settings')
}

// 初始化演示数据
onMounted(() => {
  if (chatStore.chatList.length === 0) {
    chatStore.initDemoData()
  }
})



const goBack = () => {
    if (chatStore.currentChatId) {
        chatStore.currentChatId = null
    } else {
        router.push('/')
    }
}
</script>

<template>
  <div class="wechat-app w-full h-full bg-gray-100 flex flex-col relative" @click="showAddMenu = false">
    <!-- Toast -->
    <div v-if="showToast" class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm z-[100] animate-fade-in">
        {{ toastMessage }}
    </div>

    <!-- Profile Edit Modal -->
    <div v-if="showProfileEdit" class="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade-in" @click.self="showProfileEdit = false">
        <div class="bg-white w-[85%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl animate-scale-up">
            <div class="p-5">
                <div class="text-center font-bold text-gray-800 mb-6">修改个人信息</div>
                
                <div class="flex flex-col items-center gap-4 mb-6">
                    <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 relative group cursor-pointer" @click="triggerProfileAvatarUpload">
                        <img :src="profileForm.avatar" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i class="fa-solid fa-camera text-white"></i>
                        </div>
                        <input type="file" ref="profileFileInput" class="hidden" accept="image/*" @change="handleProfileAvatarChange">
                    </div>
                    <div class="flex gap-2">
                        <button class="text-xs text-blue-500" @click="profileForm.avatar = getRandomAvatar()">随机换一张</button>
                        <button class="text-xs text-blue-500" @click="promptProfileAvatarUrl">URL上传</button>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="border-b border-gray-100 py-2">
                        <label class="text-[10px] text-gray-400 block mb-1">名字</label>
                        <input v-model="profileForm.name" type="text" class="w-full text-base font-bold outline-none placeholder-gray-300 text-black" placeholder="点击设置名字">
                    </div>
                    <div class="border-b border-gray-100 py-2">
                        <label class="text-[10px] text-gray-400 block mb-1">微信号</label>
                        <input v-model="profileForm.wechatId" type="text" class="w-full text-base outline-none text-gray-600 font-mono" placeholder="点击设置微信号">
                    </div>
                </div>

                <div class="flex gap-3 mt-8">
                    <button class="flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform" @click="showProfileEdit = false">取消</button>
                    <button class="flex-1 py-3 rounded-lg bg-[#07c160] text-white font-bold active:scale-95 transition-transform" @click="saveProfile">保存</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 聊天窗口 (覆盖层) -->
    <ChatWindow 
        v-if="chatStore.currentChatId" 
        class="absolute inset-0 z-20"
        @back="chatStore.currentChatId = null"
    />

    <template v-else>
        <!-- Add Friend Modal -->
        <div v-if="showAddFriendModal" class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" @click.self="showAddFriendModal = false">
            <div class="bg-white w-[85%] max-w-[320px] rounded-lg overflow-hidden shadow-xl">
                <div class="p-6">
                    <div class="text-lg font-bold text-gray-900 mb-2">添加新朋友</div>
                    <div class="text-xs text-gray-500 mb-4">创建后还可以为Ta设置头像和人设哦</div>
                    <input 
                        type="text" 
                        v-model="newFriendName" 
                        placeholder="请输入名字" 
                        class="w-full h-10 border-b-2 border-green-500 outline-none text-base bg-transparent mb-6 placeholder-gray-300"
                        @keydown.enter="confirmAddFriend"
                        autoFocus
                    >
                    <div class="flex justify-end gap-4">
                        <button class="text-gray-500 font-medium text-sm" @click="showAddFriendModal = false">取消</button>
                        <button class="bg-[#07c160] text-white px-6 py-2 rounded font-medium text-sm active:bg-[#06ad56]" @click="confirmAddFriend">确定</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Header -->
        <div class="h-[44px] bg-gray-100 flex items-center justify-between px-4 border-b border-gray-300 z-10 shrink-0 select-none">
            <div class="flex items-center gap-1 cursor-pointer w-20" @click="goBack" v-if="currentTab === 'chat'">
                <i class="fa-solid fa-chevron-left text-black"></i>
                <span class="font-bold text-base text-black">微信</span>
            </div>
            <div v-else class="font-bold text-base flex-1 text-center relative text-black">
                <span v-if="currentTab !== 'chat'" class="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer font-normal" @click="goBack">
                    <i class="fa-solid fa-chevron-left"></i>
                </span>
                {{ currentTab === 'contacts' ? '通讯录' : (currentTab === 'discover' ? '发现' : (currentTab === 'me' ? '' : '')) }}
            </div>
            
            <div class="flex gap-4 text-base items-center w-20 justify-end" v-if="currentTab === 'chat' || currentTab === 'contacts'">
                <i class="fa-solid fa-magnifying-glass text-black"></i>
                <div class="relative flex items-center">
                    <i class="fa-solid fa-plus cursor-pointer text-black text-lg" @click.stop="toggleAddMenu"></i>
                    <!-- Add Menu Dropdown -->
                    <div v-if="showAddMenu" class="absolute top-9 right-[-8px] w-36 bg-[#4c4c4c] rounded-lg shadow-xl z-50 py-1" @click.stop>
                        <div class="px-4 py-3 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer border-b border-[#5f5f5f]" @click="handleAddAction('group')">
                            <i class="fa-solid fa-comment-dots text-white"></i>
                            <span class="text-white text-sm">发起群聊</span>
                        </div>
                        <div class="px-4 py-3 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer" @click="handleAddAction('friend')">
                            <i class="fa-solid fa-user-plus text-white"></i>
                            <span class="text-white text-sm">添加朋友</span>
                        </div>
                        <div class="absolute -top-1 right-3 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#4c4c4c]"></div>
                    </div>
                </div>
            </div>
            <div v-else class="w-20"></div>
        </div>

        <!-- MAIN CONTENT AREA -->
        <div class="flex-1 overflow-y-auto bg-white relative">
            <!-- Tabs (chatList, contacts, discover, me) ... keep original logic -->
            <div v-if="currentTab === 'chat'" class="h-full">
                <div 
                  v-for="chat in chatStore.chatList" 
                  :key="chat.id"
                  class="flex items-center px-4 py-3 border-b border-gray-100 active:bg-gray-100 transition cursor-pointer relative prevent-select"
                  :class="chat.isPinned ? 'bg-gray-50' : ''"
                  @click="openChat(chat.id)"
                  @contextmenu.prevent="openContextMenu('chat', chat, $event)"
                  @touchstart="startLongPress('chat', chat, $event)"
                  @touchend="clearLongPress"
                  @touchmove="clearLongPress"
                >
                   <div v-if="chat.isPinned" class="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500/50"></div>
                   <div class="relative w-12 h-12 mr-3">
                       <img :src="chat.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || 'AI'}`" class="w-full h-full rounded-lg object-cover bg-gray-200">
                       <div v-if="chat.unreadCount > 0" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                         {{ chat.unreadCount > 99 ? '99+' : chat.unreadCount }}
                       </div>
                   </div>
                   <div class="flex-1 min-w-0">
                       <div class="flex justify-between items-center mb-1">
                           <span class="font-medium text-gray-900 truncate">{{ chat.name }}</span>
                           <span class="text-xs text-gray-400">{{ chat.lastMsg ? new Date(chat.lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '' }}</span>
                       </div>
                       <div class="text-xs text-gray-500 truncate">
                           {{ chat.lastMsg ? chat.lastMsg.content : '暂无消息' }}
                       </div>
                   </div>
                </div>
            </div>
            <!-- ... keep other tabs same as original ... -->
             <div v-if="currentTab === 'contacts'" class="bg-[#ededed] min-h-full">
                <div class="bg-white mb-2">
                     <div class="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-bold flex justify-between items-center cursor-pointer" @click="expandFriends = !expandFriends">
                         <span>好友</span>
                         <i class="fa-solid fa-chevron-down transition-transform duration-200" :class="!expandFriends ? '-rotate-90' : ''"></i>
                     </div>
                     <div v-if="expandFriends">
                         <div v-for="chat in chatStore.chatList" :key="chat.id" class="flex items-center px-4 py-2 border-b border-gray-100 active:bg-gray-50 cursor-pointer prevent-select" @click="openChat(chat.id)">
                            <img :src="chat.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || 'AI'}`" class="w-9 h-9 rounded bg-gray-200 mr-3">
                            <span class="text-base text-gray-900">{{ chat.name }}</span>
                         </div>
                     </div>
                </div>
            </div>
            <!-- Simplified discover/me for brevity, assuming you have original source -->
            <div v-if="currentTab === 'discover'" class="bg-[#ededed] min-h-full pt-2">
                 <div class="bg-white px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50" @click="router.push('/favorites')">
                    <i class="fa-solid fa-star text-yellow-400 text-xl"></i>
                    <span class="text-base text-gray-900 flex-1">收藏</span>
                    <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                </div>
                 <div class="bg-white px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50" @click="router.push('/worldbook')">
                    <i class="fa-solid fa-book-journal-whills text-purple-500 text-xl"></i>
                    <span class="text-base text-gray-900 flex-1">世界书</span>
                    <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                </div>
            </div>
            <div v-if="currentTab === 'me'" class="bg-[#ededed] min-h-full">
                <div class="bg-white pt-12 pb-8 px-6 flex items-center gap-4 mb-2 active:bg-gray-50 transition-colors cursor-pointer" @click="openProfileEdit">
                     <div class="w-16 h-16 rounded overflow-hidden bg-gray-200 shadow-sm border border-gray-100">
                         <img :src="userProfile.avatar" class="w-full h-full object-cover">
                     </div>
                     <div class="flex-1">
                         <div class="font-bold text-xl text-gray-900 mb-1">{{ userProfile.name }}</div>
                         <div class="text-sm text-gray-500">微信号: {{ userProfile.wechatId }}</div>
                     </div>
                     <i class="fa-solid fa-qrcode text-gray-300 mr-2"></i>
                     <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                </div>
                <div class="bg-white px-4 py-3 flex items-center gap-3 mt-2 cursor-pointer active:bg-gray-50" @click="navigateToSettings">
                     <i class="fa-solid fa-gear text-blue-500 text-xl"></i>
                     <span class="text-base text-gray-900 flex-1">设置</span>
                     <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                </div>
            </div>
        </div>

        <!-- Bottom Tab Bar -->
        <div class="h-[50px] bg-[#f7f7f7] border-t border-gray-200 flex items-center justify-around text-[10px] pb-1 shrink-0 z-10">
          <div v-for="tab in ['chat', 'contacts', 'discover', 'me']" :key="tab" class="flex flex-col items-center gap-1 cursor-pointer w-full h-full justify-center" :class="currentTab === tab ? 'text-[#07c160]' : 'text-gray-500'" @click="currentTab = tab">
            <i class="text-xl" :class="[currentTab === tab ? 'fa-solid' : 'fa-regular', tab === 'chat' ? 'fa-comment' : tab === 'contacts' ? 'fa-address-book' : tab === 'discover' ? 'fa-compass' : 'fa-user']"></i>
            <span>{{ tab === 'chat' ? '微信' : tab === 'contacts' ? '通讯录' : tab === 'discover' ? '发现' : '我' }}</span>
          </div>
        </div>
    </template>
  </div>
</template>

<style scoped>
/* Optional: Hide scrollbar for cleaner look */
::-webkit-scrollbar {
    width: 0px;
    background: transparent;
}

/* Prevent default browser context menu on long press */
.prevent-select {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}

@keyframes scaleUp {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>

