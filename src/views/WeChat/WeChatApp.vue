<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore, getRandomAvatar } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useMomentsStore } from '../../stores/momentsStore'
import ChatWindow from './ChatWindow.vue'
import MomentsView from './MomentsView.vue'
import { useWorldLoopStore } from '../../stores/worldLoopStore'
import WorldLoopCreateModal from './modals/WorldLoopCreateModal.vue'
import PendingRequestsModal from './modals/PendingRequestsModal.vue'
import { compressImage } from '../../utils/imageUtils'

const worldLoopStore = useWorldLoopStore()
const expandLoopContacts = ref(true)
const expandGroupChats = ref(true)

const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const momentsStore = useMomentsStore()

const userProfile = computed(() => settingsStore.personalization.userProfile)

const ensureString = (val) => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        return val.map(part => {
            if (typeof part === 'string') return part;
            if (part && typeof part === 'object') {
                return part.text || part.content || '';
            }
            return '';
        }).join('');
    }
    if (val && typeof val === 'object') {
        return val.text || val.content || JSON.stringify(val);
    }
    return String(val || '');
}

// Search State
const searchQuery = ref('')
const showSearch = ref(false)

const filteredChatList = computed(() => {
    let list = chatStore.chatList
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        list = list.filter(chat => {
            // 搜索原名、备注名和显示名
            const nameMatch = (chat.name || '').toLowerCase().includes(q)
            const remarkMatch = (chat.remark || '').toLowerCase().includes(q)
            const displayNameMatch = (chat.displayName || '').toLowerCase().includes(q)
            const content = ensureString(chat.lastMsg?.content)
            const contentMatch = content.toLowerCase().includes(q)
            return nameMatch || remarkMatch || displayNameMatch || contentMatch
        })
    }
    return list
})

// State
const currentTab = ref('chat') // 'chat', 'contacts', 'discover', 'me'
const showMoments = ref(false)
const momentsInitialProfileId = ref(null) // New: for direct profile jumping
const showAddMenu = ref(false)
const expandFriends = ref(true)
const expandNPC = ref(false)
const showAddFriendModal = ref(false)
const showPendingRequestsModal = ref(false)
const showCreateLoopModal = ref(false)
const showBackgroundSettings = ref(false)
const newFriendName = ref('')

// Background Settings from Store
const backgroundSettings = computed(() => {
    const defaultBgs = {
        chat: { url: '', localUrl: '' },
        contacts: { url: '', localUrl: '' },
        discover: { url: '', localUrl: '' },
        me: { url: '', localUrl: '' }
    }
    const saved = settingsStore.personalization.wechatBackgrounds || {}
    return {
        chat: { ...defaultBgs.chat, ...(saved.chat || {}) },
        contacts: { ...defaultBgs.contacts, ...(saved.contacts || {}) },
        discover: { ...defaultBgs.discover, ...(saved.discover || {}) },
        me: { ...defaultBgs.me, ...(saved.me || {}) }
    }
})

const currentBgStyle = computed(() => {
    const bg = backgroundSettings.value[currentTab.value]
    if (bg && (bg.localUrl || bg.url)) {
        return {
            backgroundImage: `url(${bg.localUrl || bg.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }
    }
    return {}
})

// Path: e:/CHILLY/phone/qiaqiao-phone/src/views/WeChat/WeChatApp.vue
// Context Menu State
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuTarget = ref(null) // { type: 'chat'|'contact'|'group', id: '...' }
const contextMenuOptions = ref([]) // [{ label: '...', action: '...' }]
const contextMenuJustOpened = ref(false) // Flag to prevent immediate close on touch release

// Local Confirm Dialog State (for delete operations)
const showConfirmDialog = ref(false)
const confirmDialogData = ref({
    title: '',
    message: '',
    action: null, // Function to execute
    isLoading: false
})

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
    chatStore.triggerToast('修改成功', 'success')
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

// Background Settings Methods
const saveBackgroundSettings = () => {
    // Now handled by settingsStore auto-save
}

const loadBackgroundSettings = () => {
    // Now handled by settingsStore on init
}

const handleBackgroundUpload = (tab, e) => {
    const file = e.target.files[0]
    if (file) {
        compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.6 })
            .then(base64 => {
                settingsStore.setWechatBackground(tab, { localUrl: base64 })
                chatStore.triggerToast('背景图已上传并压缩', 'success')
            })
            .catch(err => {
                console.error('压缩失败:', err)
                chatStore.triggerToast('图片处理失败', 'error')
            })
    }
}

const handleBackgroundUrlApply = (tab) => {
    settingsStore.setWechatBackground(tab, { url: backgroundSettings.value[tab].url })
    chatStore.triggerToast('背景设置已应用', 'success')
}

const clearBackground = (tab) => {
    settingsStore.setWechatBackground(tab, { url: '', localUrl: '' })
    chatStore.triggerToast('背景已清除', 'success')
}

// Long Press Helper
const promptProfileAvatarUrl = () => {
    chatStore.triggerPrompt('输入头像URL', '请输入图片的超链接地址', '', '', (url) => {
        if (url) profileForm.value.avatar = url
    })
}

// Long Press Helper
// Long Press Helper
let longPressTimer = null
let isLongPressTriggered = false
let startX = 0
let startY = 0

// Swipe Helper
const swipedItem = ref(null) // { type: 'chat' | 'contact', id: string }
const swipeThreshold = 50 // px
const chatSwipeOffset = ref(0) // 聊天列表滑动偏移量
const contactSwipeOffset = ref(0) // 通讯录滑动偏移量
const isSwiping = ref(false) // 是否正在滑动
const swipeStartX = ref(0) // 滑动起始 X 坐标
const maxSwipeOffsetChat = 160 // 聊天列表最大滑动距离（两个按钮宽度）
const maxSwipeOffsetContact = 80 // 通讯录最大滑动距离（一个按钮宽度）

const startLongPress = (type, item, event) => {
    isLongPressTriggered = false
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    if (clientX !== undefined && clientY !== undefined) {
        startX = clientX
        startY = clientY
    }
    longPressTimer = setTimeout(() => {
        isLongPressTriggered = true
        openContextMenu(type, item, event)
    }, 500) // 500ms for long press
}

const clearLongPress = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

const handleTouchMove = (event) => {
    if (!longPressTimer) return
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    if (clientX !== undefined && clientY !== undefined) {
        const moveX = clientX
        const moveY = clientY
        // Tolerance: 30px (more relaxed for mobile)
        if (Math.abs(moveX - startX) > 30 || Math.abs(moveY - startY) > 30) {
            clearLongPress()
        }
    }
}

// Touch Swipe Actions (Mobile)
const touchStartX = ref(0)
const touchStartY = ref(0)
const isTouchSwiping = ref(false)
const touchStartTime = ref(0)

const handleTouchStart = (type, item, event) => {
    if (event.touches && event.touches.length > 1) return // 忽略多指触摸
    const touch = event.touches[0]
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
    touchStartTime.value = Date.now()
    isTouchSwiping.value = false
    
    // 同时启动长按计时器
    startLongPress(type, item, event)
}

const handleTouchMoveSwipe = (type, item, event) => {
    if (!event.touches || event.touches.length === 0) return
    const touch = event.touches[0]
    const deltaX = touch.clientX - touchStartX.value
    const deltaY = touch.clientY - touchStartY.value
    
    // 如果水平移动大于垂直移动，且超过阈值，则认为是滑动
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        // 取消长按
        clearLongPress()
        isTouchSwiping.value = true
        
        // 执行滑动逻辑
        const maxOffset = type === 'chat' ? maxSwipeOffsetChat : maxSwipeOffsetContact
        
        if (deltaX < 0) {
            // 左滑
            const newOffset = Math.min(Math.abs(deltaX), maxOffset)
            if (type === 'chat') {
                chatSwipeOffset.value = newOffset
            } else {
                contactSwipeOffset.value = newOffset
            }
            swipedItem.value = { type, id: item.id, name: item.name }
        } else if (deltaX > 0) {
            // 右滑（回滑）
            const currentOffset = type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value
            if (currentOffset > 0) {
                const newOffset = Math.max(0, currentOffset - deltaX)
                if (type === 'chat') {
                    chatSwipeOffset.value = newOffset
                } else {
                    contactSwipeOffset.value = newOffset
                }
            }
        }
    }
}

const handleTouchEndSwipe = (type, item, event) => {
    clearLongPress()
    
    if (isTouchSwiping.value) {
        // 完成滑动
        const maxOffset = type === 'chat' ? maxSwipeOffsetChat : maxSwipeOffsetContact
        const currentOffset = type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value
        
        if (currentOffset > swipeThreshold) {
            // 超过阈值，吸附到最大位置
            if (type === 'chat') {
                chatSwipeOffset.value = maxOffset
            } else {
                contactSwipeOffset.value = maxOffset
            }
        } else {
            // 未超过阈值，弹回原位
            if (type === 'chat') {
                chatSwipeOffset.value = 0
            } else {
                contactSwipeOffset.value = 0
            }
            swipedItem.value = null
        }
    }
    
    isTouchSwiping.value = false
}

// Mouse/Touch Swipe Actions
const handleSwipeStart = (type, item, event) => {
    if (event.touches && event.touches.length > 1) return // 忽略多指触摸
    const clientX = event.touches ? event.touches[0].clientX : event.clientX

    isSwiping.value = true
    swipeStartX.value = clientX

    // 重置当前类型的偏移量
    if (type === 'chat') {
        chatSwipeOffset.value = 0
    } else {
        contactSwipeOffset.value = 0
    }

    // 临时存储当前滑动项
    swipedItem.value = { type, id: item.id, name: item.name }
}

const handleSwipeMove = (type, item, event) => {
    if (!isSwiping.value) return
    event.preventDefault() // 防止滚动

    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const deltaX = clientX - swipeStartX.value

    // 根据类型确定最大滑动距离
    const maxOffset = type === 'chat' ? maxSwipeOffsetChat : maxSwipeOffsetContact
    const currentOffset = type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value

    // 只处理左滑（向左移动，deltaX 为负）
    if (deltaX < 0) {
        // 使用缓动曲线，越往后越难滑动
        const newOffset = Math.min(Math.abs(deltaX), maxOffset)
        if (type === 'chat') {
            chatSwipeOffset.value = newOffset
        } else {
            contactSwipeOffset.value = newOffset
        }
    } else if (deltaX > 0 && currentOffset > 0) {
        // 向右滑动（回滑）
        const newOffset = Math.max(0, maxOffset - deltaX)
        if (type === 'chat') {
            chatSwipeOffset.value = newOffset
        } else {
            contactSwipeOffset.value = newOffset
        }
    }
}

const handleSwipeEnd = (type, item, event) => {
    if (!isSwiping.value) return
    isSwiping.value = false

    // 根据类型确定阈值和最大偏移量
    const maxOffset = swipedItem.value?.type === 'chat' ? maxSwipeOffsetChat : maxSwipeOffsetContact
    const currentOffset = swipedItem.value?.type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value

    // 判断是否达到滑动阈值
    if (currentOffset > swipeThreshold) {
        // 超过阈值，吸附到最大位置
        if (swipedItem.value?.type === 'chat') {
            chatSwipeOffset.value = maxOffset
        } else {
            contactSwipeOffset.value = maxOffset
        }
    } else {
        // 未超过阈值，弹回原位
        if (swipedItem.value?.type === 'chat') {
            chatSwipeOffset.value = 0
        } else {
            contactSwipeOffset.value = 0
        }
        // 如果没有达到展示状态，清除 swipedItem
        setTimeout(() => {
            const checkOffset = swipedItem.value?.type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value
            if (checkOffset === 0) {
                swipedItem.value = null
            }
        }, 300) // 等待动画结束
    }
}

const closeSwipe = () => {
    if (swipedItem.value?.type === 'chat') {
        chatSwipeOffset.value = 0
    } else {
        contactSwipeOffset.value = 0
    }
    setTimeout(() => {
        const checkOffset = swipedItem.value?.type === 'chat' ? chatSwipeOffset.value : contactSwipeOffset.value
        if (checkOffset === 0) {
            swipedItem.value = null
        }
    }, 300)
}

const handleSwipeAction = (chatId, action) => {
    if (action === 'pin') {
        chatStore.pinChat(chatId)
    } else if (action === 'clear') {
        confirmDialogData.value = {
            title: '移除聊天',
            message: '确定要在消息列表中移除该聊天吗？\n(通讯录中仍可找到)',
            action: async () => {
                try {
                    confirmDialogData.value.isLoading = true
                    await chatStore.updateCharacter(chatId, { inChatList: false })
                    await chatStore.clearHistory(chatId)
                    if (chatStore.currentChatId === chatId) {
                        chatStore.currentChatId = null
                    }
                    chatStore.triggerToast('已移除', 'success')
                    showConfirmDialog.value = false
                } catch (err) {
                    console.error('删除聊天记录失败:', err)
                    chatStore.triggerToast('删除失败', 'error')
                    showConfirmDialog.value = false
                } finally {
                    confirmDialogData.value.isLoading = false
                }
            },
            isLoading: false
        }
        showConfirmDialog.value = true
    } else if (action === 'delete') {
        confirmDialogData.value = {
            title: '删除好友',
            message: '确定要删除该好友吗？将同时删除所有记录。',
            action: async () => {
                try {
                    confirmDialogData.value.isLoading = true
                    chatStore.deleteChat(chatId)
                    chatStore.triggerToast('已删除', 'success')
                    showConfirmDialog.value = false
                } catch (err) {
                    console.error('删除好友失败:', err)
                    chatStore.triggerToast('删除失败', 'error')
                    showConfirmDialog.value = false
                } finally {
                    confirmDialogData.value.isLoading = false
                }
            },
            isLoading: false
        }
        showConfirmDialog.value = true
    }
    closeSwipe()
}

const openContextMenu = (type, item, event) => {
    event.preventDefault() // Prevent native menu
    showContextMenu.value = true
    contextMenuJustOpened.value = true

    // Clear the flag after a short delay to prevent immediate close on touch release
    setTimeout(() => {
        contextMenuJustOpened.value = false
    }, 300)

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
    } else if (type === 'group') {
        contextMenuOptions.value = [
            { label: '解散群聊', action: 'dissolve', icon: 'fa-users-slash', danger: true }
        ]
    }
}

const handleContextAction = (option) => {
    const { type, id } = contextMenuTarget.value
    if (option.action === 'pin') {
        chatStore.pinChat(id)
    } else if (option.action === 'clear') {
        // Show local confirm dialog
        confirmDialogData.value = {
            title: '移除聊天',
            message: '确定要在消息列表中移除该聊天吗？\n(通讯录中仍可找到)',
            action: async () => {
                try {
                    confirmDialogData.value.isLoading = true
                    // 从聊天列表中移除（设置 inChatList: false）
                    await chatStore.updateCharacter(id, { inChatList: false })
                    // 清空聊天记录
                    await chatStore.clearHistory(id)
                    // 如果当前正在聊这个角色，则关闭聊天窗口
                    if (chatStore.currentChatId === id) {
                        chatStore.currentChatId = null
                    }
                    chatStore.triggerToast('已移除', 'success')
                    showConfirmDialog.value = false
                } catch (err) {
                    console.error('删除聊天记录失败:', err)
                    chatStore.triggerToast('删除失败', 'error')
                    showConfirmDialog.value = false
                } finally {
                    confirmDialogData.value.isLoading = false
                }
            },
            isLoading: false
        }
        showConfirmDialog.value = true
    } else if (option.action === 'delete') {
        confirmDialogData.value = {
            title: '删除好友',
            message: '确定要删除该好友吗？将同时删除所有记录。',
            action: async () => {
                try {
                    confirmDialogData.value.isLoading = true
                    chatStore.deleteChat(id)
                    chatStore.triggerToast('已删除', 'success')
                    showConfirmDialog.value = false
                } catch (err) {
                    console.error('删除好友失败:', err)
                    chatStore.triggerToast('删除失败', 'error')
                    showConfirmDialog.value = false
                } finally {
                    confirmDialogData.value.isLoading = false
                }
            },
            isLoading: false
        }
        showConfirmDialog.value = true
    } else if (option.action === 'dissolve') {
        confirmDialogData.value = {
            title: '解散群聊',
            message: '确定要解散该群聊吗？群聊将被删除且无法恢复。',
            action: async () => {
                try {
                    confirmDialogData.value.isLoading = true
                    // Use dissolveGroup from chatStore
                    if (chatStore.dissolveGroup) {
                        chatStore.dissolveGroup(id)
                        chatStore.triggerToast('群聊已解散', 'success')
                    } else {
                        // Fallback: manually set dissolved state
                        await chatStore.updateCharacter(id, { isDissolved: true, inChatList: false })
                        chatStore.triggerToast('群聊已解散', 'success')
                    }
                    showConfirmDialog.value = false
                } catch (err) {
                    console.error('解散群聊失败:', err)
                    chatStore.triggerToast('解散失败', 'error')
                    showConfirmDialog.value = false
                } finally {
                    confirmDialogData.value.isLoading = false
                }
            },
            isLoading: false
        }
        showConfirmDialog.value = true
    }
    showContextMenu.value = false
}


const toggleAddMenu = () => {
    showAddMenu.value = !showAddMenu.value
}

const handleAddAction = (action) => {
    showAddMenu.value = false
    if (action === 'group') {
        showCreateLoopModal.value = true
    } else if (action === 'createGroupChat') {
        router.push({ name: 'wechat-group-settings', params: { chatId: 'new' } })
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

const handleCreateLoop = async (form) => {
    showCreateLoopModal.value = false
    try {
        const loop = await worldLoopStore.createLoop(form.name, form.description, form.participants)
        const chat = chatStore.createChat(form.name, {
            isGroup: true,
            loopId: loop.id,
            participants: form.participants // Initialize chat with selected participants
        })
        chatStore.currentChatId = chat.id
        chatStore.triggerToast('世界圈开启成功', 'success')

        // Push history state to show chat window
        const currentState = history.state || {}
        if (!currentState.chatOpen) {
            history.pushState({ ...currentState, chatOpen: true }, '')
        }
    } catch (err) {
        console.error('Create loop failed', err)
        chatStore.triggerToast('开启失败', 'error')
    }
}

const getPreviewText = (contentRaw) => {
    if (!contentRaw) return '暂无消息'
    const content = ensureString(contentRaw)

    // Identification patterns
    if (content.includes('"postId"')) return '[朋友圈分享]'
    if (content.includes('"type":"html"')) return '[卡片消息]'
    if (content.includes('isAnnouncement') || content.includes('发布了新群公告')) return '[群公告]'
    if (content.includes('@所有人') || content.includes('@me')) return '[有人@我]'
    if (content.includes('[红包') || content.includes('"type":"redpacket"')) return '[红包]'
    if (content.includes('[转账') || content.includes('"type":"transfer"')) return '[转账]'
    if (content.includes('FAMILY_CARD')) {
        if (content.includes('APPLY')) return '[亲属卡申请]'
        return '[亲属卡]'
    }

    // Clean Inner Voice tags and their content
    let clean = content.replace(/\[\s*INNER[\s-_]*VOICE\s*\][\s\S]*?(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|$)/gi, '')
    // Clean System tags
    clean = clean.replace(/\[System:[\s\S]+?\]/gi, '')
    // Clean DRAW tags
    clean = clean.replace(/\[DRAW:[\s\S]*?\]/gi, '[生图指令]')
    // Clean MOMENT tags
    clean = clean.replace(/\[(?:MOMENT|朋友圈)\][\s\S]*?(?:\[\/(?:MOMENT|朋友圈)\]|$)/gi, '')

    // Strip raw Inner Voice JSON blocks (without tags) — e.g. { "status": "xxx", "着装": "..." }
    clean = clean.replace(/\{[^{}]*(?:"status"|"心声"|"着装"|"状态")[^{}]*\}/gi, '')

    clean = clean.trim()

    // If nothing left, the message was entirely inner voice / metadata
    if (!clean) return '[心声]'

    return clean
}

const initialUnreadCount = ref(0)

const openChat = (chatId) => {
    // Prevent ghost click after long press
    if (isLongPressTriggered) {
        isLongPressTriggered = false
        return
    }

    // Capture unread count before it gets cleared by the store watcher
    const chat = chatStore.chats[chatId]
    initialUnreadCount.value = chat ? (chat.unreadCount || 0) : 0

    chatStore.currentChatId = chatId
    // Ensure it shows in chat list when opened from contacts
    chatStore.updateCharacter(chatId, { inChatList: true })

    // Guard: Only push if we aren't already in a chat state
    const currentState = history.state || {}
    if (!currentState.chatOpen) {
        history.pushState({ ...currentState, chatOpen: true }, '')
    }
}

const openProfileFromChat = (charId) => {
    if (charId === 'user') {
        // Go directly to Moments (My Album)
        momentsInitialProfileId.value = 'user' // This will trigger filterAuthorId = 'user' in MomentsView
        showMoments.value = true
        const currentState = history.state || {}
        if (!currentState.profileOpen) history.pushState({ ...currentState, profileOpen: true }, '')
    } else {
        // Navigate to dedicated Character Profile View (Card Info first)
        router.push({ name: 'character-info', params: { charId } })
    }
}

const handleChatBack = () => {
    console.log('[WeChatApp] handleChatBack called', {
        historyState: history.state,
        currentChatId: chatStore.currentChatId
    })

    // Directly close the chat
    console.log('[WeChatApp] Closing chat directly')
    chatStore.currentChatId = null

    // If we pushed a history state, also clean it up
    if (history.state?.chatOpen) {
        console.log('[WeChatApp] Also going back to clean history')
        history.back()
    }
}

const handlePopState = (event) => {
    const state = event.state || {}
    console.log('[WeChatApp] handlePopState', {
        state,
        showMoments: showMoments.value,
        currentChatId: chatStore.currentChatId
    })

    // 1. Check Profile/Moments Layer
    if (showMoments.value && !state.profileOpen) {
        console.log('[WeChatApp] Closing moments')
        showMoments.value = false
        momentsInitialProfileId.value = null
    }

    // 2. Check Chat Window Layer
    // Only close chat if chatOpen is explicitly missing from state
    if (chatStore.currentChatId && !state.chatOpen) {
        console.log('[WeChatApp] Closing chat window')
        chatStore.currentChatId = null
    } else {
        console.log('[WeChatApp] NOT closing chat', {
            hasChatId: !!chatStore.currentChatId,
            stateChatOpen: state.chatOpen
        })
    }
}

const navigateToSettings = () => {
    router.push('/settings')
}

const handleOpenMoments = () => {
    showMoments.value = true
    const currentState = history.state || {}
    if (!currentState.profileOpen) {
        history.pushState({ ...currentState, profileOpen: true }, '')
    }
}

// 初始化演示数据
onMounted(async () => {
    await worldLoopStore.initStore()
    window.addEventListener('popstate', handlePopState)
})

onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState)
})



const goBack = () => {
    console.log('[WeChatApp] goBack called', {
        historyState: history.state,
        showMoments: showMoments.value,
        currentChatId: chatStore.currentChatId
    })

    // 1. Check if Moments is open
    if (showMoments.value) {
        console.log('[WeChatApp] Closing moments')
        showMoments.value = false
        momentsInitialProfileId.value = null

        // Critical Fix: Pop history if we pushed it when opening moments
        if (history.state?.profileOpen) {
            history.back()
        }
        return
    }

    // 2. Check if Chat is open
    if (chatStore.currentChatId) {
        console.log('[WeChatApp] Closing chat')
        chatStore.currentChatId = null

        // Critical Fix: Pop history if we pushed it when opening chat
        if (history.state?.chatOpen) {
            history.back()
        }
        return
    }

    // 3. If no overlays, go back to previous route (Home)
    console.log('[WeChatApp] Navigating to home')
    router.push('/').catch(() => {
        window.location.href = '/'
    })
}



// --- Import Logic ---
const importFileInput = ref(null)

const triggerImport = () => {
    if (importFileInput.value) importFileInput.value.click()
}

const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (data.type !== 'qiaoqiao_character_card' || !data.character) {
            chatStore.triggerToast('无效的角色卡文件', 'info')
            return
        }

        // Create new chat
        const name = data.character.name || '导入角色'
        const newChat = chatStore.createChat(name)
        const chatId = newChat.id

        // Update character data
        const updateData = {
            ...data.character,
            // User Persona override
            userName: data.user?.name,
            userAvatar: data.user?.avatar,
            userGender: data.user?.gender,
            userPersona: data.user?.persona
        }

        // Use updateCharacter to merge
        chatStore.updateCharacter(chatId, updateData)

        const chat = chatStore.chats[chatId]

        // Restore Memory
        if (data.memory && Array.isArray(data.memory)) {
            chat.memory = data.memory
        }

        // Restore History
        if (data.msgs && Array.isArray(data.msgs) && data.msgs.length > 0) {
            // Overwrite default greeting
            chat.msgs = data.msgs
        }

        chatStore.saveChats()
        chatStore.triggerToast(`已导入: ${name}`, 'success')

    } catch (err) {
        console.error(err)
        chatStore.triggerToast('导入失败', 'error')
    } finally {
        // Reset input
        e.target.value = ''
    }
}
</script>

<template>
    <div class="wechat-app w-full h-full bg-gray-100 flex flex-col relative" @click="showAddMenu = false">
        <!-- Hidden Import Input -->
        <input type="file" ref="importFileInput" class="hidden" accept=".json" @change="handleImport">

        <!-- Chat Window Overlay -->
        <ChatWindow v-if="chatStore.currentChatId" v-show="!showMoments" class="absolute inset-0 z-50"
            @back="handleChatBack" :initial-unread-count="initialUnreadCount" @show-profile="openProfileFromChat" />

        <WorldLoopCreateModal :visible="showCreateLoopModal" :contacts="chatStore.contactList.filter(c => !c.isGroup)"
            @close="showCreateLoopModal = false" @confirm="handleCreateLoop" />

        <PendingRequestsModal :visible="showPendingRequestsModal" @close="showPendingRequestsModal = false" />

        <!-- Context Menu (Restored) -->
        <div v-if="showContextMenu" class="fixed inset-0 z-[100] flex items-center justify-center"
            @click="!contextMenuJustOpened && (showContextMenu = false)">
            <!-- Backdrop for click outside -->
            <div class="absolute inset-0 bg-black/20"></div>
            <!-- 居中显示的菜单 -->
            <div class="relative bg-[#4c4c4c] rounded-xl shadow-2xl py-2 min-w-[160px] animate-scale-up"
                @click.stop>
                <div v-for="(option, index) in contextMenuOptions" :key="index"
                    class="px-5 py-4 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer border-b border-[#5f5f5f]/50 last:border-none transition-colors"
                    @click="handleContextAction(option)">
                    <i :class="['fa-solid', option.icon, option.danger ? 'text-red-400' : 'text-white']"></i>
                    <span :class="['text-base', option.danger ? 'text-red-400' : 'text-white']">{{ option.label }}</span>
                </div>
            </div>
        </div>


        <!-- Profile Edit Modal -->
        <div v-if="showProfileEdit"
            class="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 animate-fade-in"
            @click.self="showProfileEdit = false">
            <div class="bg-white w-[85%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl animate-scale-up">
                <div class="p-5">
                    <div class="text-center font-bold text-gray-800 mb-6">修改个人信息</div>

                    <div class="flex flex-col items-center gap-4 mb-6">
                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 relative group cursor-pointer"
                            @click="triggerProfileAvatarUpload">
                            <img :src="profileForm.avatar" class="w-full h-full object-cover">
                            <div
                                class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <i class="fa-solid fa-camera text-white"></i>
                            </div>
                            <input type="file" ref="profileFileInput" class="hidden" accept="image/*"
                                @change="handleProfileAvatarChange">
                        </div>
                        <div class="flex gap-2">
                            <button class="text-xs text-blue-500"
                                @click="profileForm.avatar = getRandomAvatar()">随机换一张</button>
                            <button class="text-xs text-blue-500" @click="promptProfileAvatarUrl">URL上传</button>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="border-b border-gray-100 py-2">
                            <label class="text-[10px] text-gray-400 block mb-1">名字</label>
                            <input v-model="profileForm.name" type="text"
                                class="w-full text-base font-bold outline-none placeholder-gray-300 text-black"
                                placeholder="点击设置名字">
                        </div>
                        <div class="border-b border-gray-100 py-2">
                            <label class="text-[10px] text-gray-400 block mb-1">微信号</label>
                            <input v-model="profileForm.wechatId" type="text"
                                class="w-full text-base outline-none text-gray-600 font-mono" placeholder="点击设置微信号">
                        </div>
                    </div>

                    <div class="flex gap-3 mt-8">
                        <button
                            class="flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
                            @click="showProfileEdit = false">取消</button>
                        <button
                            class="flex-1 py-3 rounded-lg bg-[#07c160] text-white font-bold active:scale-95 transition-transform"
                            @click="saveProfile">保存</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Moments View (New) -->
        <MomentsView v-if="showMoments"
            style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: #ededed; z-index: 20000;"
            :initial-profile-id="momentsInitialProfileId" @back="goBack" />

        <!-- Main App Content (Hide when overlays are open to prevent misalignment) -->
        <template v-if="!chatStore.currentChatId && !showMoments">
            <!-- Add Friend Modal -->
            <div v-if="showAddFriendModal"
                class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
                @click.self="showAddFriendModal = false">
                <div class="bg-white w-[85%] max-w-[320px] rounded-lg overflow-hidden shadow-xl">
                    <div class="p-6">
                        <div class="text-lg font-bold text-gray-900 mb-2">添加新朋友</div>
                        <div class="text-xs text-gray-500 mb-4">创建后还可以为Ta设置头像和人设哦</div>
                        <input type="text" v-model="newFriendName" placeholder="请输入名字"
                            class="w-full h-10 border-b-2 border-green-500 outline-none text-base bg-transparent mb-6 placeholder-gray-300"
                            @keydown.enter="confirmAddFriend" autoFocus>
                        <div class="flex justify-end gap-4">
                            <button class="text-gray-500 font-medium text-sm"
                                @click="showAddFriendModal = false">取消</button>
                            <button
                                class="bg-[#07c160] text-white px-6 py-2 rounded font-medium text-sm active:bg-[#06ad56]"
                                @click="confirmAddFriend">确定</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Background Settings Modal -->
            <div v-if="showBackgroundSettings"
                class="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
                @click.self="showBackgroundSettings = false">
                <div
                    class="bg-white w-[90%] max-w-[360px] max-h-[80vh] rounded-lg overflow-hidden shadow-xl flex flex-col">
                    <div class="p-4 border-b border-gray-200">
                        <div class="text-lg font-bold text-gray-900">背景设置</div>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-6">
                        <!-- Chat Background -->
                        <div>
                            <div class="text-sm font-bold text-gray-700 mb-2">微信页面</div>
                            <div class="w-full h-24 bg-gray-100 rounded-lg mb-3 overflow-hidden border">
                                <img v-if="backgroundSettings.chat.localUrl || backgroundSettings.chat.url"
                                    :src="backgroundSettings.chat.localUrl || backgroundSettings.chat.url"
                                    class="w-full h-full object-cover">
                                <div v-else
                                    class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    预览图
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex gap-2">
                                    <input type="text" v-model="backgroundSettings.chat.url" placeholder="输入背景 URL..."
                                        class="flex-1 bg-transparent px-3 py-2 text-xs rounded-xl border outline-none focus:border-blue-500 transition-all font-mono bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400">
                                    <button @click="handleBackgroundUrlApply('chat')"
                                        class="bg-blue-500 text-white px-3 rounded-xl active:scale-95 transition-transform">
                                        <i class="fa-solid fa-check text-xs"></i>
                                    </button>
                                </div>
                                <div class="relative w-full">
                                    <button
                                        class="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center">
                                        <i class="fa-solid fa-upload mr-2"></i>上传本地背景
                                    </button>
                                    <input type="file" @change="(e) => handleBackgroundUpload('chat', e)"
                                        accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                </div>
                                <button @click="clearBackground('chat')"
                                    class="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                                    清除
                                </button>
                            </div>
                        </div>

                        <!-- Contacts Background -->
                        <div>
                            <div class="text-sm font-bold text-gray-700 mb-2">通讯录页面</div>
                            <div class="w-full h-24 bg-gray-100 rounded-lg mb-3 overflow-hidden border">
                                <img v-if="backgroundSettings.contacts.localUrl || backgroundSettings.contacts.url"
                                    :src="backgroundSettings.contacts.localUrl || backgroundSettings.contacts.url"
                                    class="w-full h-full object-cover">
                                <div v-else
                                    class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    预览图
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex gap-2">
                                    <input type="text" v-model="backgroundSettings.contacts.url"
                                        placeholder="输入背景 URL..."
                                        class="flex-1 bg-transparent px-3 py-2 text-xs rounded-xl border outline-none focus:border-blue-500 transition-all font-mono bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400">
                                    <button @click="handleBackgroundUrlApply('contacts')"
                                        class="bg-blue-500 text-white px-3 rounded-xl active:scale-95 transition-transform">
                                        <i class="fa-solid fa-check text-xs"></i>
                                    </button>
                                </div>
                                <div class="relative w-full">
                                    <button
                                        class="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center">
                                        <i class="fa-solid fa-upload mr-2"></i>上传本地背景
                                    </button>
                                    <input type="file" @change="(e) => handleBackgroundUpload('contacts', e)"
                                        accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                </div>
                                <button @click="clearBackground('contacts')"
                                    class="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                                    清除
                                </button>
                            </div>
                        </div>

                        <!-- Discover Background -->
                        <div>
                            <div class="text-sm font-bold text-gray-700 mb-2">发现页面</div>
                            <div class="w-full h-24 bg-gray-100 rounded-lg mb-3 overflow-hidden border">
                                <img v-if="backgroundSettings.discover.localUrl || backgroundSettings.discover.url"
                                    :src="backgroundSettings.discover.localUrl || backgroundSettings.discover.url"
                                    class="w-full h-full object-cover">
                                <div v-else
                                    class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    预览图
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex gap-2">
                                    <input type="text" v-model="backgroundSettings.discover.url"
                                        placeholder="输入背景 URL..."
                                        class="flex-1 bg-transparent px-3 py-2 text-xs rounded-xl border outline-none focus:border-blue-500 transition-all font-mono bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400">
                                    <button @click="handleBackgroundUrlApply('discover')"
                                        class="bg-blue-500 text-white px-3 rounded-xl active:scale-95 transition-transform">
                                        <i class="fa-solid fa-check text-xs"></i>
                                    </button>
                                </div>
                                <div class="relative w-full">
                                    <button
                                        class="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center">
                                        <i class="fa-solid fa-upload mr-2"></i>上传本地背景
                                    </button>
                                    <input type="file" @change="(e) => handleBackgroundUpload('discover', e)"
                                        accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                                </div>
                                <button @click="clearBackground('discover')"
                                    class="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                                    清除
                                </button>
                            </div>
                        </div>

                        <!-- Me Background -->
                        <div>
                            <div class="text-sm font-bold text-gray-700 mb-2">我页面</div>
                            <div class="w-full h-24 bg-gray-100 rounded-lg mb-3 overflow-hidden border">
                                <img v-if="backgroundSettings.me.localUrl || backgroundSettings.me.url"
                                    :src="backgroundSettings.me.localUrl || backgroundSettings.me.url"
                                    class="w-full h-full object-cover">
                                <div v-else
                                    class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                    预览图
                                </div>
                            </div>
                            <div class="space-y-2">
                                <div class="flex gap-2">
                                    <input type="text" v-model="backgroundSettings.me.url" placeholder="输入背景 URL..."
                                        class="flex-1 bg-transparent px-3 py-2 text-xs rounded-xl border outline-none focus:border-blue-500 transition-all font-mono bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400">
                                    <button @click="handleBackgroundUrlApply('me')"
                                        class="bg-blue-500 text-white px-3 rounded-xl active:scale-95 transition-transform">
                                        <i class="fa-solid fa-check text-xs"></i>
                                    </button>
                                </div>
                                <div class="relative w-full">
                                    <button
                                        class="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center">
                                        <i class="fa-solid fa-upload mr-2"></i>上传本地背景
                                    </button>
                                    <input type="file" @change="(e) => handleBackgroundUpload('me', e)" accept="image/*"
                                        class="absolute inset-0 opacity-0 cursor-pointer">
                                </div>
                                <button @click="clearBackground('me')"
                                    class="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">
                                    清除
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 border-t border-gray-200 flex justify-end gap-4">
                        <button class="text-gray-500 font-medium text-sm"
                            @click="showBackgroundSettings = false">取消</button>
                        <button
                            class="bg-[#07c160] text-white px-6 py-2 rounded font-medium text-sm active:bg-[#06ad56]"
                            @click="showBackgroundSettings = false">确定</button>
                    </div>
                </div>
            </div>

            <!-- Header -->
            <div
                class="h-[44px] bg-white/30 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-300 z-10 shrink-0 select-none">
                <div class="flex items-center gap-1 cursor-pointer w-20" @click="goBack" v-if="currentTab === 'chat'">
                    <i class="fa-solid fa-chevron-left text-black"></i>
                    <span class="font-bold text-base text-black">微信</span>
                </div>
                <div v-else class="font-bold text-base flex-1 text-center relative text-black">
                    <span v-if="currentTab !== 'chat'"
                        class="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer font-normal" @click="goBack">
                        <i class="fa-solid fa-chevron-left"></i>
                    </span>
                    {{ currentTab === 'contacts' ? '通讯录' : (currentTab === 'discover' ? '发现' : (currentTab === 'me' ? ''
                        : '')) }}
                </div>

                <div class="flex gap-2 text-base items-center w-32 justify-end"
                    v-if="currentTab === 'chat' || currentTab === 'contacts'">
                    <i class="fa-solid fa-file-import text-black cursor-pointer p-2" title="导入角色卡"
                        @click="triggerImport"></i>
                    <i class="fa-solid fa-magnifying-glass text-black cursor-pointer p-2"
                        @click="showSearch = !showSearch"></i>
                    <i class="fa-solid fa-gear text-black cursor-pointer p-2" title="设置背景"
                        @click="showBackgroundSettings = true"></i>
                    <div class="relative flex items-center">
                        <i class="fa-solid fa-plus cursor-pointer text-black text-lg" @click.stop="toggleAddMenu"></i>
                        <!-- Add Menu Dropdown -->
                        <div v-if="showAddMenu"
                            class="absolute top-9 right-[-8px] w-36 bg-[#4c4c4c] rounded-lg shadow-xl z-50 py-1"
                            @click.stop>
                            <div class="px-4 py-3 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer border-b border-[#5f5f5f]"
                                @click="handleAddAction('group')">
                                <i class="fa-solid fa-earth-asia text-purple-400"></i>
                                <span class="text-white text-sm font-bold">开启世界圈</span>
                            </div>
                            <div class="px-4 py-3 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer border-b border-[#5f5f5f]"
                                @click="handleAddAction('createGroupChat')">
                                <i class="fa-solid fa-users text-green-300"></i>
                                <span class="text-white text-sm font-bold">新建群聊</span>
                            </div>
                            <div class="px-4 py-3 flex items-center gap-3 active:bg-[#5f5f5f] cursor-pointer"
                                @click="handleAddAction('friend')">
                                <i class="fa-solid fa-user-plus text-white"></i>
                                <span class="text-white text-sm">添加朋友</span>
                            </div>
                            <div
                                class="absolute -top-1 right-3 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#4c4c4c]">
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="w-20"></div>
            </div>

            <!-- MAIN CONTENT AREA -->
            <div class="flex-1 overflow-y-auto relative" :style="{
                backgroundImage: currentTab === 'chat' && (backgroundSettings?.chat?.localUrl || backgroundSettings?.chat?.url) ? `url(${backgroundSettings.chat.localUrl || backgroundSettings.chat.url})` :
                    currentTab === 'contacts' && (backgroundSettings?.contacts?.localUrl || backgroundSettings?.contacts?.url) ? `url(${backgroundSettings.contacts.localUrl || backgroundSettings.contacts.url})` :
                        currentTab === 'discover' && (backgroundSettings?.discover?.localUrl || backgroundSettings?.discover?.url) ? `url(${backgroundSettings.discover.localUrl || backgroundSettings.discover.url})` :
                            currentTab === 'me' && (backgroundSettings?.me?.localUrl || backgroundSettings?.me?.url) ? `url(${backgroundSettings.me.localUrl || backgroundSettings.me.url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }">
                <!-- Tabs (chatList, contacts, discover, me) ... keep original logic -->
                <div v-if="currentTab === 'chat'" class="h-full">
                    <!-- Search Bar -->
                    <div v-if="showSearch"
                        class="bg-white/30 backdrop-blur-md px-2 pb-2 -mt-1 border-b border-gray-200">
                        <div class="bg-white/30 backdrop-blur-md rounded-lg flex items-center px-3 py-1.5">
                            <i class="fa-solid fa-magnifying-glass text-gray-400 text-sm mr-2"></i>
                            <input v-model="searchQuery" type="text" placeholder="搜索"
                                class="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder-gray-400">
                            <i v-if="searchQuery" class="fa-solid fa-xmark text-gray-400 ml-2 cursor-pointer"
                                @click="searchQuery = ''"></i>
                        </div>
                    </div>

                    <div v-for="chat in filteredChatList" :key="chat.id" class="relative overflow-hidden select-none"
                        @click="!isSwiping && openChat(chat.id)"
                        @contextmenu.prevent="openContextMenu('chat', chat, $event)"
                        @touchstart.passive="handleTouchStart('chat', chat, $event)"
                        @touchmove.passive="handleTouchMoveSwipe('chat', chat, $event)"
                        @touchend="handleTouchEndSwipe('chat', chat, $event)"
                        @mousedown="handleSwipeStart('chat', chat, $event)"
                        @mousemove="handleSwipeMove('chat', chat, $event)"
                        @mouseup="handleSwipeEnd('chat', chat, $event)"
                        @mouseleave="handleSwipeEnd('chat', chat, $event)">
                        <!-- 左滑操作按钮（背景层，固定在右侧） -->
                        <div v-if="swipedItem?.type === 'chat' && swipedItem?.id === chat.id"
                            class="absolute inset-y-0 right-0 flex items-center" :style="{ width: '160px', zIndex: 0 }">
                            <button @click.stop="handleSwipeAction(chat.id, 'pin')"
                                class="h-full bg-blue-500 text-white shadow-md active:bg-blue-600 flex items-center justify-center"
                                style="width: 80px; height: 100%;">
                                <i class="fa-solid fa-thumbtack text-2xl"></i>
                            </button>
                            <button @click.stop="handleSwipeAction(chat.id, 'clear')"
                                class="h-full bg-orange-500 text-white shadow-md active:bg-orange-600 flex items-center justify-center"
                                style="width: 80px; height: 100%;">
                                <i class="fa-solid fa-eraser text-2xl"></i>
                            </button>
                        </div>
                        <!-- 聊天内容（前景层，可滑动） -->
                        <div class="bg-white active:bg-gray-100 transition-colors cursor-pointer relative"
                            :class="chat.isPinned ? 'bg-white/30 backdrop-blur-md' : ''"
                            :style="swipedItem?.id === chat.id ? { transform: `translateX(-${chatSwipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease', zIndex: 10 } : {}">
                            <div v-if="chat.isPinned" class="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500/50">
                            </div>
                            <div class="flex items-center px-4 py-3 border-b border-gray-100 prevent-select">
                                <div class="relative w-12 h-12 mr-3">
                                    <img :src="chat.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || 'AI'}`"
                                        class="w-full h-full rounded-lg object-cover bg-gray-200">
                                    <div v-if="chat.unreadCount > 0"
                                        class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                                        {{ chat.unreadCount > 99 ? '99+' : chat.unreadCount }}
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex justify-between items-center mb-1">
                                        <div class="flex items-center gap-1.5 truncate">
                                            <span v-if="chat.isGroup"
                                                class="bg-green-500 text-white text-[8px] px-1 rounded-sm shrink-0">群组</span>
                                            <span class="font-medium text-gray-900 truncate">{{ chat.displayName || chat.name }}</span>
                                        </div>
                                        <span class="text-xs text-gray-400">{{ chat.lastMsg ? new
                                            Date(chat.lastMsg.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : '' }}</span>
                                    </div>
                                    <div class="text-xs truncate flex items-center gap-1">
                                        <span v-if="chatStore.typingStatus[chat.id]" class="text-green-500 font-bold shrink-0 animate-pulse">[对方正在输入...]</span>
                                        <template v-if="chat.lastMsg">
                                            <span :class="{
                                                'text-[#ff8f00] font-bold': (chat.lastMsg?.role !== 'user' && (chat.lastMsg?.type === 'redpacket' || chat.lastMsg?.content?.includes('[红包]') || chat.lastMsg?.type === 'transfer' || chat.lastMsg?.content?.includes('[转账]') || chat.lastMsg?.content?.includes('公告') || chat.lastMsg?.content?.includes('@'))),
                                                'text-gray-500': chat.lastMsg?.role === 'user' || !(chat.lastMsg?.type === 'redpacket' || chat.lastMsg?.content?.includes('[红包]') || chat.lastMsg?.type === 'transfer' || chat.lastMsg?.content?.includes('[转账]') || chat.lastMsg?.content?.includes('公告') || chat.lastMsg?.content?.includes('@'))
                                            }">
                                                {{ getPreviewText(chat.lastMsg.content) }}
                                            </span>
                                        </template>
                                        <span v-else class="text-gray-400 italic">暂无消息</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 通讯录 Tab -->
                <div v-if="currentTab === 'contacts'"
                    :class="{ 'bg-[#ededed]': !(backgroundSettings.contacts.localUrl || backgroundSettings.contacts.url) }"
                    class="min-h-full">
                    <!-- 消息通知入口 -->
                    <div class="bg-white/30 backdrop-blur-md mb-2 border-b border-gray-100/50">
                        <div class="flex items-center px-4 py-4 active:bg-gray-100 transition-colors cursor-pointer group"
                            @click="showPendingRequestsModal = true">
                            <div
                                class="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mr-3 relative shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                                <i class="fa-solid fa-bell text-white text-lg"></i>
                                <div v-if="chatStore.pendingRequests?.length > 0"
                                    class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border-2 border-white animate-pulse">
                                    {{ chatStore.pendingRequests.length }}
                                </div>
                            </div>
                            <div class="flex-1">
                                <span class="text-base text-gray-900 font-bold">消息通知</span>
                                <div v-if="chatStore.pendingRequests?.length > 0"
                                    class="text-[10px] text-orange-600 font-medium">
                                    新消息等待处理</div>
                                <div v-else class="text-[10px] text-gray-400">暂无新通知</div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                        </div>
                    </div>

                    <!-- 1. World Loops Section -->
                    <div class="bg-white/30 backdrop-blur-md mb-2">
                        <div class="px-4 py-2 bg-gradient-to-r from-purple-50/30 to-white/30 text-[10px] text-purple-600 font-bold flex justify-between items-center cursor-pointer border-b border-purple-100/30"
                            @click="expandLoopContacts = !expandLoopContacts">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-earth-asia text-purple-500"></i>
                                <span>我的世界圈</span>
                            </div>
                            <i class="fa-solid fa-chevron-down transition-transform duration-200"
                                :class="!expandLoopContacts ? '-rotate-90' : ''"></i>
                        </div>
                        <div v-if="expandLoopContacts">
                            <div v-for="chat in chatStore.contactList.filter(c => c.isGroup && c.loopId)" :key="chat.id"
                                class="flex items-center px-4 py-3 border-b border-gray-100/80 active:bg-gray-50/80 cursor-pointer"
                                @click="openChat(chat.id)">
                                <div class="relative w-10 h-10 mr-3">
                                    <img :src="chat.avatar || getRandomAvatar()"
                                        class="w-full h-full rounded-lg bg-gray-200 object-cover">
                                    <div
                                        class="absolute -top-1 -right-1 bg-purple-500 text-white text-[8px] px-1 rounded-sm border border-white">
                                        世界</div>
                                </div>
                                <div class="flex-1">
                                    <div class="text-base text-gray-900 font-medium">{{ chat.name }}</div>
                                    <div class="text-[10px] text-gray-400 truncate">
                                        {{ chat.participants?.length || 0 }} 名成员参与中
                                    </div>
                                </div>
                            </div>
                            <div v-if="chatStore.contactList.filter(c => c.isGroup && c.loopId).length === 0"
                                class="py-4 text-center text-xs text-gray-400">
                                暂无活跃的世界圈
                            </div>
                        </div>
                    </div>

                    <!-- 2. Standard Group Chats Section -->
                    <div class="bg-white/30 backdrop-blur-md mb-2">
                        <div class="px-4 py-2 bg-gradient-to-r from-blue-50/30 to-white/30 text-[10px] text-blue-600 font-bold flex justify-between items-center cursor-pointer border-b border-blue-100/30"
                            @click="expandGroupChats = !expandGroupChats">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-users text-blue-500"></i>
                                <span>我的群聊</span>
                            </div>
                            <i class="fa-solid fa-chevron-down transition-transform duration-200"
                                :class="!expandGroupChats ? '-rotate-90' : ''"></i>
                        </div>
                        <div v-if="expandGroupChats">
                            <div v-for="chat in chatStore.contactList.filter(c => c.isGroup && !c.loopId)"
                                :key="chat.id"
                                class="flex items-center px-4 py-3 border-b border-gray-100/80 active:bg-gray-50/80 cursor-pointer prevent-select"
                                @click="openChat(chat.id)" @contextmenu.prevent="openContextMenu('group', chat, $event)"
                                @touchstart="startLongPress('group', chat, $event)" @touchend="clearLongPress"
                                @touchmove="handleTouchMove">
                                <div class="relative w-10 h-10 mr-3">
                                    <img :src="chat.avatar || getRandomAvatar()"
                                        class="w-full h-full rounded-lg bg-gray-200 object-cover">
                                </div>
                                <div class="flex-1">
                                    <div class="text-base text-gray-900 font-medium">{{ chat.name }}</div>
                                    <div class="text-[10px] text-gray-400 truncate">
                                        {{ chat.participants?.length || 0 }} 名成员参与中
                                    </div>
                                </div>
                            </div>
                            <div v-if="chatStore.contactList.filter(c => c.isGroup && !c.loopId).length === 0"
                                class="py-4 text-center text-xs text-gray-400">
                                暂无群聊
                            </div>
                        </div>
                    </div>

                    <!-- 2. World Loop Characters (NPCs) -->
                    <div class="bg-white/30 backdrop-blur-md mb-2">
                        <div class="px-4 py-2 bg-gradient-to-r from-purple-50/30 to-white/30 text-[10px] text-purple-600 font-bold flex justify-between items-center cursor-pointer border-b border-purple-100/30"
                            @click="expandLoopContacts = !expandLoopContacts">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-user-gear text-purple-500"></i>
                                <span>剧本角色 & 群聊NPC</span>
                            </div>
                            <i class="fa-solid fa-chevron-down transition-transform duration-200"
                                :class="!expandLoopContacts ? '-rotate-90' : ''"></i>
                        </div>
                        <div v-if="expandLoopContacts">
                            <div v-for="chat in chatStore.contactList.filter(c => !c.isGroup && c.belongToLoop)"
                                :key="chat.id"
                                class="flex items-center px-4 py-3 border-b border-gray-100/80 active:bg-gray-50/80 cursor-pointer"
                                @click="openChat(chat.id)">
                                <img :src="chat.avatar || getRandomAvatar()"
                                    class="w-10 h-10 rounded-lg bg-gray-200 mr-3">
                                <div class="flex-1">
                                    <div class="text-base text-gray-900 font-medium">{{ chat.name }}</div>
                                    <div class="text-[10px] text-blue-500 bg-blue-50/30 px-1 inline-block rounded">
                                        归属: {{ worldLoopStore.loops[chat.belongToLoop]?.name || '未知世界' }}
                                    </div>
                                </div>
                            </div>
                            <div v-if="chatStore.contactList.filter(c => !c.isGroup && c.belongToLoop).length === 0 && chatStore.groupNpcs.length === 0"
                                class="py-4 text-center text-xs text-gray-400">
                                暂无剧本角色或群聊NPC
                            </div>

                            <!-- Group NPCs List -->
                            <div v-for="npc in chatStore.groupNpcs" :key="npc.id"
                                class="flex items-center px-4 py-3 border-b border-gray-100/80 active:bg-gray-50/80 cursor-pointer"
                                @click="openChat(npc.groupId)">
                                <img :src="npc.avatar || getRandomAvatar()"
                                    class="w-10 h-10 rounded-lg bg-gray-200 mr-3 object-cover">
                                <div class="flex-1">
                                    <div class="text-base text-gray-900 font-medium flex items-center gap-2">
                                        {{ npc.name }}
                                        <span class="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">NPC</span>
                                    </div>
                                    <div class="text-[10px] text-gray-400 truncate">
                                        属于群聊: {{ npc.groupName }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Standard Friends Section -->
                    <div class="bg-white/30 backdrop-blur-md mb-2">
                        <div class="px-4 py-2 bg-gray-50/30 text-[10px] text-gray-400 font-bold flex justify-between items-center cursor-pointer"
                            @click="expandFriends = !expandFriends">
                            <span>我的好友</span>
                            <i class="fa-solid fa-chevron-down transition-transform duration-200"
                                :class="!expandFriends ? '-rotate-90' : ''"></i>
                        </div>
                        <div v-if="expandFriends">
                            <div v-for="chat in chatStore.contactList.filter(c => !c.isGroup && !c.belongToLoop)"
                                :key="chat.id" class="relative overflow-hidden select-none"
                                @click="!isSwiping && openChat(chat.id)"
                                @contextmenu.prevent="openContextMenu('contact', chat, $event)"
                                @touchstart.passive="handleTouchStart('contact', chat, $event)"
                                @touchmove.passive="handleTouchMoveSwipe('contact', chat, $event)"
                                @touchend="handleTouchEndSwipe('contact', chat, $event)"
                                @mousedown="handleSwipeStart('contact', chat, $event)"
                                @mousemove="handleSwipeMove('contact', chat, $event)"
                                @mouseup="handleSwipeEnd('contact', chat, $event)"
                                @mouseleave="handleSwipeEnd('contact', chat, $event)">
                                <!-- 左滑删除按钮（背景层，固定在右侧） -->
                                <div v-if="swipedItem?.type === 'contact' && swipedItem?.id === chat.id"
                                    class="absolute inset-y-0 right-0 flex items-center"
                                    :style="{ width: '80px', zIndex: 0 }">
                                    <button @click.stop="handleSwipeAction(chat.id, 'delete')"
                                        class="h-full w-full bg-red-500 text-white shadow-md active:bg-red-600 flex items-center justify-center"
                                        style="height: 100%;">
                                        <i class="fa-solid fa-trash text-2xl"></i>
                                    </button>
                                </div>
                                <!-- 好友内容（前景层，可滑动） -->
                                <div class="bg-white active:bg-gray-50/80 transition-colors cursor-pointer relative"
                                    :style="swipedItem?.id === chat.id ? { transform: `translateX(-${contactSwipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.3s ease', zIndex: 10 } : {}">
                                    <div class="flex items-center px-4 py-3 border-b border-gray-100/80 prevent-select">
                                        <img :src="chat.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || 'AI'}`"
                                            class="w-9 h-9 rounded bg-gray-200 mr-3">
                                        <span class="text-base text-gray-900">{{ chat.name }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 发现 Tab -->
                <div v-if="currentTab === 'discover'"
                    :class="{ 'bg-[#ededed]': !(backgroundSettings.discover.localUrl || backgroundSettings.discover.url) }"
                    class="min-h-full pt-2">
                    <!-- Moments Entry -->
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50/30"
                        @click="handleOpenMoments">
                        <i class="fa-solid fa-camera-retro text-orange-400 text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">朋友圈</span>
                        <div v-if="momentsStore.unreadCount > 0" class="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50/30"
                        @click="router.push('/favorites')">
                        <i class="fa-solid fa-star text-yellow-400 text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">收藏</span>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50/30"
                        @click="router.push('/worldbook')">
                        <i class="fa-solid fa-book-journal-whills text-purple-500 text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">世界书</span>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50/30"
                        @click="router.push('/gallery')">
                        <i class="fa-solid fa-images text-blue-500 text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">图库</span>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                </div>
                <div v-if="currentTab === 'me'"
                    :class="{ 'bg-[#ededed]': !(backgroundSettings.me.localUrl || backgroundSettings.me.url) }"
                    class="min-h-full">
                    <div class="bg-white/30 backdrop-blur-md pt-12 pb-8 px-6 flex items-center gap-4 mb-2 active:bg-gray-50/30 transition-colors cursor-pointer"
                        @click="openProfileEdit">
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

                    <!-- Wallet Entry -->
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mb-2 cursor-pointer active:bg-gray-50/30"
                        @click="router.push('/wallet')">
                        <i class="fa-solid fa-wallet text-[#07c160] text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">钱包</span>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                    <div class="bg-white/30 backdrop-blur-md px-4 py-3 flex items-center gap-3 mt-2 cursor-pointer active:bg-gray-50/30"
                        @click="navigateToSettings">
                        <i class="fa-solid fa-gear text-blue-500 text-xl"></i>
                        <span class="text-base text-gray-900 flex-1">设置</span>
                        <i class="fa-solid fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                </div>
            </div>

            <!-- Bottom Tab Bar -->
            <div
                class="h-[50px] bg-white/30 backdrop-blur-md border-t border-gray-200 flex items-center justify-around text-[10px] pb-1 shrink-0 z-10">
                <div v-for="tab in ['chat', 'contacts', 'discover', 'me']" :key="tab"
                    class="flex flex-col items-center gap-1 cursor-pointer w-full h-full justify-center"
                    :class="currentTab === tab ? 'text-[#07c160]' : 'text-gray-500'" @click="currentTab = tab">
                    <i class="text-xl"
                        :class="[currentTab === tab ? 'fa-solid' : 'fa-regular', tab === 'chat' ? 'fa-comment' : tab === 'contacts' ? 'fa-address-book' : tab === 'discover' ? 'fa-compass' : 'fa-user']"></i>
                    <span>{{ tab === 'chat' ? '微信' : tab === 'contacts' ? '通讯录' : tab === 'discover' ? '发现' : '我'
                        }}</span>
                </div>
            </div>

            <!-- Local Confirm Dialog (for delete/clear operations) -->
            <div v-if="showConfirmDialog"
                class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
                    <h3 class="text-lg font-bold text-gray-900 mb-3 text-center">{{ confirmDialogData.title }}</h3>
                    <p class="text-gray-600 text-center mb-6 whitespace-pre-wrap">{{ confirmDialogData.message }}</p>
                    <div class="flex gap-3">
                        <button @click="showConfirmDialog = false"
                            class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 transition-colors"
                            :disabled="confirmDialogData.isLoading">
                            取消
                        </button>
                        <button @click="confirmDialogData.action"
                            class="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold active:bg-red-600 transition-colors shadow-md"
                            :disabled="confirmDialogData.isLoading"
                            :class="{ 'opacity-50 cursor-not-allowed': confirmDialogData.isLoading }">
                            {{ confirmDialogData.isLoading ? '处理中...' : '确定' }}
                        </button>
                    </div>
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
/* Prevent default browser context menu on long press */
.prevent-select {
    -webkit-touch-callout: none;
    /* iOS Safari */
    -webkit-user-select: none;
    /* Safari */
    -khtml-user-select: none;
    /* Konqueror HTML */
    -moz-user-select: none;
    /* Old versions of Firefox */
    -ms-user-select: none;
    /* Internet Explorer/Edge */
    user-select: none;
    /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
}

@keyframes scaleUp {
    from {
        transform: scale(0.9);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
