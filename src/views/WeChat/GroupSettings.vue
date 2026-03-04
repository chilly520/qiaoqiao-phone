<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore, getRandomAvatar } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWorldBookStore } from '../../stores/worldBookStore'
import AvatarCropper from '../../components/AvatarCropper.vue'
import GroupAnnouncementModal from './modals/GroupAnnouncementModal.vue'
import GroupRankModal from './modals/GroupRankModal.vue'
import { compressImage } from '../../utils/imageUtils'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const worldBookStore = useWorldBookStore()

const fileInput = ref(null)
const myFileInput = ref(null)
const bgUploadInput = ref(null)

const chatIdParam = computed(() => String(route.params.chatId || 'new'))
const isCreateMode = computed(() => chatIdParam.value === 'new')

const existingChat = computed(() => {
  if (isCreateMode.value) return null
  return chatStore.chats[chatIdParam.value] || null
})

const tokenStats = computed(() => {
  if (isCreateMode.value) return { total: 0, totalContext: 0 }
  return chatStore.getTokenBreakdown(chatIdParam.value) || {
    total: 0,
    totalContext: 0
  }
})

const userProfile = computed(() => settingsStore.personalization?.userProfile || {})

const state = reactive({
  saving: false,
  showAvatarCropper: false,
  showInviteModal: false,
  showAiModal: false,
  showAiResultModal: false,
  aiLoading: false,
  aiRequirement: '',
  aiCount: 6,
  aiGenerated: [],
  selectedInviteIds: new Set(),
  selectedAiIds: new Set(),
  showMemberManageModal: false,
  manageTargetId: null,
  activeTab: 'basic',
  showSummaryDetail: false,
  showMemoryLibModal: false,
  showAnnouncementModal: false,
  showRankModal: false
})

// Memory Library States
const showMemoryModal = ref(false)
const currentMemoryTheme = ref('diary')
const editingIndex = ref(-1)
const editingContent = ref('')
const isEditMode = ref(false)
const selectedIndices = ref(new Set())

const memoryThemes = [
  { id: 'diary', name: '日记风', icon: 'fa-book', activeGradient: 'from-amber-400 to-orange-500' },
  { id: 'newspaper', name: '报纸风', icon: 'fa-newspaper', activeGradient: 'from-gray-700 to-gray-900' },
  { id: 'postage', name: '邮票风', icon: 'fa-stamp', activeGradient: 'from-red-500 to-pink-600' },
  { id: 'poster', name: '海报风', icon: 'fa-image', activeGradient: 'from-purple-500 to-indigo-600' }
]

const form = reactive({
  avatar: '',
  name: '',
  groupNo: '',
  announcement: '',
  participants: [],
  // Settings
  myAvatar: '',
  myNickname: '',
  myPersona: '',
  myRole: 'owner',
  myCustomTitle: '',
  groupPrompt: '',
  worldBookLinks: [],
  timeAware: true,
  timeSyncMode: 'system',
  virtualTime: '',
  allowInvite: true,
  autoInvite: false,
  welcomeMessage: '',
  proactiveEnabled: false,
  proactiveIntervalMinutes: 60,
  contextMemoryCount: 20,
  contextDisplayCount: 50,
  autoSummaryEvery: 30,
  autoSummary: false,
  autoTTS: false,
  voiceSpeed: 1,
  patEnabled: true,
  patAction: '',
  patSuffix: '',
  bubblePreset: 'default',
  bubbleBlur: 0,
  bubbleOpacity: 1,
  bubbleTheme: 'light',
  bgTheme: 'light',
  bgUrl: '',
  bgBlur: 0,
  bgOpacity: 1,
  bubbleSize: 15,
  bubbleCss: '',
  summaryPrompt: '请用客观中性的语气总结以下对话的主要内容、关键信息和双方达成的共识。',
  contextLimit: 20,
  displayLimit: 50,
  summaryLimit: 30,
  levelTitles: ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说']
})

const contacts = computed(() => {
  const list = Array.isArray(chatStore.contactList) ? chatStore.contactList : []
  // Combine form.participants and existingChat.value?.participants to ensure all current members are filtered
  const existingIdArray = [
    'user',
    ...(form.participants || []).map(p => String(p.id)),
    ...(existingChat.value?.participants || []).map(p => String(p.id))
  ]
  const existingIds = new Set(existingIdArray)

  // Only show individual friends for inviting to a group, filter out anyone already in the group
  return list.filter(c => !c.isGroup && !existingIds.has(String(c.id)))
})

const participantsView = computed(() => {
  const result = []
  // Include ME
  result.push({
    id: 'user',
    name: (form.myNickname || '我') + (form.myCustomTitle ? ` [${form.myCustomTitle}]` : ''),
    avatar: form.myAvatar,
    role: form.myRole || 'member',
    isMe: true,
    gender: userProfile.value?.gender || '未知'
  })

  // Normalize participants to ensure we have all required fields
  const list = Array.isArray(form.participants) ? form.participants : []
  list.forEach(p => {
    // Skip if id is 'user' to avoid duplicate
    if (p.id === 'user') return
    result.push({
      ...p,
      name: p.nickname || p.name || '未命名',
      nickname: p.nickname || p.name || '未命名',
      role: p.role || 'member',
      isMe: false
    })
  })
  return result
})

const manageTarget = computed(() => {
  if (state.manageTargetId === 'user') {
    return {
      id: 'user',
      name: '我',
      nickname: form.myNickname || '',
      avatar: form.myAvatar,
      role: form.myRole || 'member',
      gender: userProfile.value.gender || '无',
      persona: form.myPersona || '',
      customTitle: form.myCustomTitle || '',
      muteUntil: form.muteUntil || 0
    }
  }
  const found = form.participants.find(p => p.id === state.manageTargetId)
  if (!found) return null

  // Try to find the actual chat to get gender/persona
  const actualChat = chatStore.chats[found.id]
  return {
    ...found,
    gender: actualChat?.bio?.gender || found.bio?.gender || found.gender || '未知',
    persona: actualChat?.prompt || found.prompt || found.persona || '暂无详细背景设定'
  }
})

const myRole = computed(() => form.myRole || 'member')
const canIManage = computed(() => myRole.value === 'owner' || myRole.value === 'admin')

const isFriend = (pid) => {
  if (pid === 'user') return true
  const c = chatStore.chats[pid]
  // A friend is someone who is in the chat list and not a group
  return c && !c.isGroup && !c.isArchived && c.inChatList
}

function handleAddFriendFromGroup() {
  const target = manageTarget.value
  if (!target || target.id === 'user') return

  chatStore.triggerConfirm('添加好友', `确定要向 ${target.name} 发送好友申请吗？`, () => {
    // In this app, we can just "force" add them or simulate a request
    // For now, let's just add them to the chat list as a friend
    chatStore.updateCharacter(target.id, { inChatList: true, isGroup: false })
    chatStore.triggerToast('已添加为好友', 'success')
  })
}

function deriveGroupNoFromId(chatId) {
  const digits = String(chatId || '').replace(/\D/g, '').slice(-8)
  return digits ? `G${digits}` : `G${Date.now().toString().slice(-8)}`
}

function hydrateFromChat(chat) {
  const gp = chat?.groupProfile || {}
  const gs = chat?.groupSettings || {}
  form.avatar = gp.avatar || chat.avatar || getRandomAvatar()
  form.name = gp.name || chat.name || '未命名群聊'
  form.groupNo = gp.groupNo || deriveGroupNoFromId(chat.id)
  form.announcement = gp.announcement || ''
  form.participants = Array.isArray(chat.participants) ? [...chat.participants] : []

  form.myAvatar = gs.myAvatar ?? chat.userAvatar ?? (settingsStore.personalization?.userProfile?.avatar) ?? ''
  form.myNickname = gs.myNickname ?? ''
  form.myPersona = gs.myPersona ?? chat.userPersona ?? ''
  form.myRole = gs.myRole ?? 'owner'
  form.myCustomTitle = gs.myCustomTitle ?? ''

  form.groupPrompt = gs.groupPrompt ?? ''
  form.worldBookLinks = Array.isArray(gs.worldBookLinks) ? [...gs.worldBookLinks] : (Array.isArray(chat.worldBookLinks) ? [...chat.worldBookLinks] : [])
  form.timeAware = gs.timeAware ?? (chat.timeAware !== false)
  form.timeSyncMode = gs.timeSyncMode ?? chat.timeSyncMode ?? 'system'
  form.virtualTime = gs.virtualTime ?? chat.virtualTime ?? ''
  form.allowInvite = gs.allowInvite ?? true
  form.autoInvite = gs.autoInvite ?? false
  form.welcomeMessage = gs.welcomeMessage ?? ''

  form.proactiveEnabled = !!gs.proactive?.enabled
  form.proactiveIntervalMinutes = Number(gs.proactive?.intervalMinutes ?? 60)

  form.contextMemoryCount = Number(gs.memory?.contextMemoryCount ?? chat.contextLimit ?? 20)
  form.contextDisplayCount = Number(gs.memory?.contextDisplayCount ?? 50)
  form.autoSummaryEvery = Number(gs.memory?.autoSummaryEvery ?? 30)

  form.autoSummary = gs.autoSummary ?? !!chat.autoSummary
  form.autoTTS = gs.autoTTS ?? !!chat.autoTTS

  form.patEnabled = gs.pat?.enabled ?? true
  form.patAction = gs.pat?.action ?? chat.patAction ?? ''
  form.patSuffix = gs.pat?.suffix ?? chat.patSuffix ?? ''

  form.bubblePreset = gs.bubbleBg?.preset ?? 'default'
  form.bubbleBlur = Number(gs.bubbleBg?.blur ?? 0)
  form.bubbleOpacity = Number(gs.bubbleBg?.opacity ?? 1)
  form.bubbleTheme = gs.bubbleBg?.theme ?? 'light'

  form.bgTheme = chat.bgTheme || 'light'
  form.bgUrl = chat.bgUrl || ''
  form.bgBlur = chat.bgBlur || 0
  form.bgOpacity = chat.bgOpacity ?? 1
  form.bubbleSize = chat.bubbleSize || 15
  form.bubbleCss = chat.bubbleCss || ''
  form.summaryPrompt = gs.memory?.summaryPrompt || '请用客观中性的语气总结以下对话的主要内容、关键信息和双方达成的共识。'
  form.levelTitles = Array.isArray(gs.levelTitles) ? [...gs.levelTitles] : ['潜水', '冒泡', '吐槽', '活跃', '话痨', '传说']
}

function triggerAvatarUpload() {
  fileInput.value?.click()
}

async function handleAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = await compressImage(file)
  if (url) form.avatar = url
}

function promptAvatarUrl() {
  chatStore.triggerPrompt('输入群头像URL', '请粘贴网络图片的直链地址', form.avatar, '', (url) => {
    if (url) form.avatar = url
  })
}

function triggerMyAvatarUpload() {
  myFileInput.value?.click()
}

async function handleMyAvatarChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = await compressImage(file)
  if (url) form.myAvatar = url
}

function promptMyAvatarUrl() {
  chatStore.triggerPrompt('输入个人群头像URL', '请输入图片的超链接地址', form.myAvatar, '', (url) => {
    if (url) form.myAvatar = url
  })
}

function triggerBgUpload() {
  bgUploadInput.value?.click()
}

async function handleBgUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const url = await compressImage(file)
  if (url) form.bgUrl = url
}

function promptBgUrl() {
  chatStore.triggerPrompt('输入背景 URL', '请粘贴网络图片的直链地址', form.bgUrl, '', (url) => {
    if (url) form.bgUrl = url
  })
}

function handleSetAdmin() {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  const newRole = target.role === 'admin' ? 'member' : 'admin'
  const idx = form.participants.findIndex(p => p.id === target.id)
  if (idx !== -1) {
    form.participants[idx].role = newRole
    chatStore.triggerToast(newRole === 'admin' ? '已设为管理' : '已撤销管理', 'success')
  }
}

function handleSetTitle() {
  const target = manageTarget.value
  if (!target) return
  const current = target.id === 'user' ? form.myCustomTitle : target.customTitle
  chatStore.triggerPrompt('修改头衔', '设置成员在本群的专属头衔', current || '', '', (t) => {
    if (target.id === 'user') {
      form.myCustomTitle = t || ''
    } else {
      const idx = form.participants.findIndex(p => p.id === target.id)
      if (idx !== -1) form.participants[idx].customTitle = t || ''
    }
  })
}

function handleTransferOwner() {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  chatStore.triggerConfirm('移交群主', `确定要将群主移交给 ${target.name} 吗？你将降级为管理员。`, () => {
    // Logic: My role becomes manager, target becomes owner
    form.myRole = 'admin'
    const idx = form.participants.findIndex(p => p.id === target.id)
    if (idx !== -1) form.participants[idx].role = 'owner'
    state.showMemberManageModal = false
    chatStore.triggerToast('群主移交成功', 'success')
  })
}

function handleMute() {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  chatStore.triggerPrompt('禁言时长 (分钟)', '输入 0 以解除禁言', '10', '', (mins) => {
    const val = parseInt(mins)
    if (isNaN(val)) return
    const until = val === 0 ? 0 : Date.now() + val * 60000
    const idx = form.participants.findIndex(p => p.id === target.id)
    if (idx !== -1) {
      form.participants[idx].muteUntil = until
      chatStore.triggerToast(val === 0 ? '禁言已解除' : `已禁言 ${val} 分钟`, 'info')
    }
  })
}

function togglePrivateMemoryIntero(e) {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  const checked = e.target.checked
  const idx = form.participants.findIndex(p => p.id === target.id)
  if (idx !== -1) {
    if (form.participants[idx].privateMemoryIntero === undefined) {
      // Setup reactively if missed
      form.participants[idx] = { ...form.participants[idx], privateMemoryIntero: checked, privateMemoryLimit: 20 }
    } else {
      form.participants[idx].privateMemoryIntero = checked
    }
    chatStore.triggerToast(checked ? '已开启该成员私聊互通' : '已关闭私聊互通', 'info')
  }
}

function updatePrivateMemoryLimit(e) {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  const val = parseInt(e.target.value) || 20
  const idx = form.participants.findIndex(p => p.id === target.id)
  if (idx !== -1) {
    form.participants[idx].privateMemoryLimit = val
  }
}

const showManualSummaryModal = ref(false)
const manualSummaryRange = ref('')

function triggerManualSummary() {
  const chatId = existingChat.value?.id
  if (!chatId) {
    chatStore.triggerToast('请先创建或保存群聊', 'error')
    return
  }
  showManualSummaryModal.value = true
  manualSummaryRange.value = ''
}

async function executeManualSummary() {
  const rangeInput = manualSummaryRange.value.trim()
  const rangeRegex = /^(\d+)-(\d+)$/
  const match = String(rangeInput).match(rangeRegex)

  let options = {}
  if (match) {
    options.startIndex = parseInt(match[1]) - 1
    options.endIndex = parseInt(match[2])
  }

  showManualSummaryModal.value = false

  try {
    chatStore.triggerToast('生成总结中...', 'info')
    await chatStore.summarizeHistory(existingChat.value?.id, options)
  } catch (e) {
    console.error(e)
    chatStore.triggerToast('总结请求发生错误', 'error')
  }
}

// AI Member Generation Logic
function openAiGenerate() {
  state.showAiModal = true
}

async function executeAiGenerate() {
  if (state.aiLoading) return
  state.aiLoading = true
  try {
    const result = await chatStore.generateGroupMembers(state.aiRequirement, { count: state.aiCount, groupTheme: form.name })
    if (result.error) {
      chatStore.triggerToast(result.error, 'error')
    } else if (result.members && Array.isArray(result.members)) {
      state.aiGenerated = result.members
      state.selectedAiIds = new Set(result.members.map(m => m.id))
      state.showAiModal = false
      state.showAiResultModal = true
    }
  } catch (e) {
    console.error(e)
    chatStore.triggerToast('生成发生错误', 'error')
  } finally {
    state.aiLoading = false
  }
}

function toggleAiSelect(id) {
  if (state.selectedAiIds.has(id)) state.selectedAiIds.delete(id)
  else state.selectedAiIds.add(id)
}


const memories = computed(() => {
  if (!existingChat.value) return []
  return existingChat.value.memory || []
})

// --- Memory Modal Themes Support ---
const getThemeBackground = () => {
  const theme = currentMemoryTheme.value;
  if (theme === 'diary') return 'bg-amber-50/30'
  if (theme === 'newspaper') return 'bg-gray-100/50'
  if (theme === 'postage') return 'bg-red-50/30'
  if (theme === 'poster') return 'bg-indigo-50/20'
  return ''
}
const getThemeCardClass = () => {
  const theme = currentMemoryTheme.value;
  const isDark = settingsStore.personalization.theme === 'dark'
  let base = 'p-4 rounded-xl shadow-sm border '
  if (theme === 'diary') return base + (isDark ? 'bg-amber-900/20 border-amber-700/30 text-amber-100' : 'bg-white border-amber-100 text-gray-800')
  if (theme === 'newspaper') return base + (isDark ? 'bg-gray-800 border-gray-600 text-gray-100 font-serif' : 'bg-white border-gray-300 text-gray-900 font-serif')
  if (theme === 'postage') return base + (isDark ? 'bg-red-900/10 border-red-800/20 text-red-100 border-dashed border-2' : 'bg-white border-red-200 text-gray-800 border-dashed border-2')
  if (theme === 'poster') return base + (isDark ? 'bg-indigo-900/20 border-indigo-700/30 text-indigo-100' : 'bg-white border-indigo-100 text-gray-800')
  return base + (isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100')
}
const getThemeBadgeClass = () => {
  const theme = currentMemoryTheme.value;
  let base = 'text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider '
  if (theme === 'diary') return base + 'bg-amber-500/10 text-amber-600'
  if (theme === 'newspaper') return base + 'bg-black text-white'
  if (theme === 'postage') return base + 'bg-red-500/10 text-red-500'
  if (theme === 'poster') return base + 'bg-indigo-500/10 text-indigo-500'
  return base + 'bg-gray-100 text-gray-500'
}
const getThemeNumberClass = () => {
  const theme = currentMemoryTheme.value;
  let base = 'w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold '
  if (theme === 'diary') return base + 'bg-amber-100 text-amber-600'
  if (theme === 'newspaper') return base + 'bg-gray-900 text-white rounded-none'
  if (theme === 'postage') return base + 'bg-red-500 text-white rotate-12'
  if (theme === 'poster') return base + 'bg-indigo-500 text-white'
  return base + 'bg-gray-100 text-gray-500'
}


// --- Memory Actions ---
const startEdit = (index, mem) => {
  editingIndex.value = index
  editingContent.value = typeof mem === 'object' ? mem.content : mem
}

const cancelEdit = () => {
  editingIndex.value = -1
  editingContent.value = ''
}

const saveEdit = async (index) => {
  if (!existingChat.value) return
  const newMemories = [...memories.value]
  if (typeof newMemories[index] === 'object') {
    newMemories[index] = { ...newMemories[index], content: editingContent.value, timestamp: Date.now() }
  } else {
    newMemories[index] = editingContent.value
  }
  await chatStore.updateCharacter(existingChat.value.id, { memory: newMemories })
  editingIndex.value = -1
  chatStore.triggerToast('记忆已更新', 'success')
}

const deleteMemory = async (index) => {
  if (!existingChat.value) return
  chatStore.triggerConfirm('删除记忆', '确定要删除这条记忆吗？', async () => {
    const newMemories = memories.value.filter((_, i) => i !== index)
    await chatStore.updateCharacter(existingChat.value.id, { memory: newMemories })
    chatStore.triggerToast('已删除', 'info')
  })
}

const toggleSelection = (index) => {
  if (selectedIndices.value.has(index)) {
    selectedIndices.value.delete(index)
  } else {
    selectedIndices.value.add(index)
  }
}

function openMemoryLib() {
  const chatId = existingChat.value?.id
  if (!chatId) {
    chatStore.triggerToast('请先创建或保存群聊', 'error')
    return
  }
  showMemoryModal.value = true
}



function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIndices.value.clear()
  } else {
    memories.value.forEach((_, i) => selectedIndices.value.add(i))
  }
}

function batchDeleteMemory() {
  if (selectedIndices.value.size === 0) return
  const chat = existingChat.value
  if (!chat || !Array.isArray(chat.memory)) return

  const indicesToDelete = Array.from(selectedIndices.value).sort((a, b) => b - a)
  indicesToDelete.forEach(idx => {
    if (idx >= 0 && idx < chat.memory.length) {
      chat.memory.splice(idx, 1)
    }
  })
  chatStore.saveChats()
  selectedIndices.value.clear()
  isEditMode.value = false
  chatStore.triggerToast('已删除', 'success')
}

const isAllSelected = computed(() => {
  return memories.value.length > 0 && selectedIndices.value.size === memories.value.length
})



function getThemeNumberPrefix(num) {
  const themes = {
    diary: `No.${num}`,
    newspaper: `#${num}`,
    postage: `※${num}`,
    poster: `◆${num}`
  }
  return themes[currentMemoryTheme.value] || `No.${num}`
}

function getThemeLabel() {
  const themes = {
    diary: '日记',
    newspaper: '新闻',
    postage: '邮票',
    poster: '海报'
  }
  return themes[currentMemoryTheme.value] || '记忆'
}

function getThemeContentClass() {
  const themes = {
    diary: 'text-sm text-gray-700 leading-relaxed font-serif',
    newspaper: 'text-sm text-gray-700 leading-relaxed font-sans',
    postage: 'text-sm text-gray-700 leading-relaxed italic',
    poster: 'text-sm text-gray-700 leading-relaxed font-mono'
  }
  return themes[currentMemoryTheme.value] || 'text-sm text-gray-700 leading-relaxed'
}

function getThemeMetaClass() {
  const themes = {
    diary: 'text-[10px] text-gray-500 mt-2 italic',
    newspaper: 'text-[10px] text-gray-500 mt-2',
    postage: 'text-[10px] text-gray-500 mt-2 italic font-lighter',
    poster: 'text-[10px] text-gray-500 mt-2 font-mono'
  }
  return themes[currentMemoryTheme.value] || 'text-[10px] text-gray-500 mt-2'
}

function initCreateDefaults() {
  form.avatar = getRandomAvatar()
  form.name = ''
  form.groupNo = deriveGroupNoFromId('')
  form.announcement = ''
  form.participants = []
  form.myAvatar = (settingsStore.personalization?.userProfile?.avatar) ?? ''
  form.myNickname = ''
  form.myPersona = ''
  form.groupPrompt = ''
  form.worldBookLinks = []
  form.timeAware = true
}

function openChatInWeChat(chatId) {
  chatStore.currentChatId = chatId
  chatStore.updateCharacter(chatId, { inChatList: true })
  router.push('/wechat')
}

function toggleInvite(id) {
  const set = state.selectedInviteIds
  if (set.has(id)) set.delete(id)
  else set.add(id)
}

function confirmInvite() {
  const set = state.selectedInviteIds
  if (set.size === 0) {
    state.showInviteModal = false
    return
  }
  const existingIds = new Set((form.participants || []).map(p => p.id))
  const toAdd = contacts.value
    .filter(c => set.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.remark || c.name || '未命名',
      avatar: c.avatar || `https://api.dicebear.com/7.x/open-peeps/svg?seed=${encodeURIComponent(c.name || c.id)}`,
      roleId: c.roleId || null,
      role: 'member'
    }))
    .filter(p => !existingIds.has(p.id))
  form.participants = [...(form.participants || []), ...toAdd]
  state.selectedInviteIds = new Set()
  state.showInviteModal = false
}

function confirmAiMembers() {
  const picked = new Set(state.selectedAiIds)
  const existingIdArray = [
    'user',
    ...(form.participants || []).map(p => String(p.id))
  ]
  const existingIds = new Set(existingIdArray)

  const toAdd = state.aiGenerated
    .filter(m => picked.has(m.id))
    .filter(m => !existingIds.has(String(m.id)))

  form.participants = [...(form.participants || []), ...toAdd]

  state.showAiResultModal = false
  state.aiGenerated = []
  state.selectedAiIds = new Set()
  chatStore.triggerToast(`成功导入 ${toAdd.length} 名成员`, 'success')
}

// Group Management Callbacks
function clearGroupMessages() {
  const chatId = chatIdParam.value
  if (!chatId || isCreateMode.value) return

  chatStore.triggerConfirm('清空记录', '确定要清空此群的所有聊天记录吗？此操作不可撤销。', () => {
    chatStore.clearHistory(chatId)
    chatStore.triggerToast('记录已清空', 'success')
  })
}

function resetGroupAll() {
  const chatId = chatIdParam.value
  if (!chatId || isCreateMode.value) return

  chatStore.triggerConfirm('解散群聊', '确定要解散此群吗？此操作不可逆。', () => {
    chatStore.dissolveGroup(chatId)
    chatStore.triggerToast('群聊已解散', 'info')
    router.push('/wechat')
  })
}

function quitGroup() {
  const chatId = chatIdParam.value
  if (!chatId || isCreateMode.value) return

  chatStore.triggerConfirm('退出群聊', '确定要退出该群聊吗？', () => {
    chatStore.exitGroup(chatId)
    chatStore.triggerToast('已退出群聊', 'info')
    router.push('/wechat')
  })
}

function removeParticipant(pid) {
  if (pid === 'user') return
  form.participants = (form.participants || []).filter(p => p.id !== pid)
}

function openMemberManage(pid) {
  state.manageTargetId = pid
  state.showMemberManageModal = true
}

function handleSetNickname() {
  const target = manageTarget.value
  if (!target) return
  chatStore.triggerPrompt('设置群昵称', `为 ${target.name} 设置在本群的昵称`, target.nickname || target.name, '', (n) => {
    if (target.id === 'user') {
      form.myNickname = n || ''
    } else {
      const idx = form.participants.findIndex(p => p.id === target.id)
      if (idx !== -1) form.participants[idx].nickname = n || ''
    }
  })
}

function handleSetPersona() {
  const target = manageTarget.value
  if (!target) return
  if (target.id === 'user') {
    chatStore.triggerPrompt('设置我的群人设', '你在本群扮演的角色设定', form.myPersona, 'textarea', (n) => {
      form.myPersona = n || ''
    })
    return
  }
  chatStore.triggerPrompt('设置背景设定', `为 ${target.name} 设置人设背景`, target.persona, 'textarea', (n) => {
    const idx = form.participants.findIndex(p => p.id === target.id)
    if (idx !== -1) {
      form.participants[idx].prompt = n || ''
      // Also update the found object directly for immediate UI feedback if needed, 
      // but form.participants is what matters for saving.
      if (chatStore.chats[target.id]) {
        chatStore.updateCharacter(target.id, { prompt: n || '' })
      }
    }
  })
}

function handleSetGender() {
  const target = manageTarget.value
  if (!target || target.id === 'user') return
  chatStore.triggerPrompt('设置性别', `修改 ${target.name} 的性别`, target.gender, 'text', (n) => {
    const idx = form.participants.findIndex(p => p.id === target.id)
    if (idx !== -1) {
      if (!form.participants[idx].bio) form.participants[idx].bio = {}
      form.participants[idx].bio.gender = n || '未知'
      if (chatStore.chats[target.id]) {
        chatStore.updateCharacter(target.id, { bio: { ...chatStore.chats[target.id].bio, gender: n || '未知' } })
      }
    }
  })
}

function goToMoments(id) {
  if (!id) return
  router.push(`/moments/profile/${id}`)
  state.showMemberManageModal = false
}

async function saveAll() {
  if (!String(form.name || '').trim()) {
    chatStore.triggerToast('请先填写群名', 'info')
    return
  }
  state.saving = true
  try {
    let chatId = chatIdParam.value
    if (isCreateMode.value) {
      const created = chatStore.createGroupChat({
        name: form.name.trim(),
        avatar: form.avatar || getRandomAvatar(),
        participants: form.participants || [],
        groupProfile: {
          avatar: form.avatar || getRandomAvatar(),
          name: form.name.trim(),
          groupNo: form.groupNo || deriveGroupNoFromId(''),
          announcement: form.announcement || ''
        }
      })
      chatId = created.id
    } else {
      chatStore.updateGroupProfile(chatId, {
        avatar: form.avatar,
        name: form.name.trim(),
        groupNo: form.groupNo,
        announcement: form.announcement
      })
      chatStore.updateGroupParticipants(chatId, form.participants || [])
    }

    chatStore.updateGroupSettings(chatId, {
      myAvatar: form.myAvatar,
      myNickname: form.myNickname,
      myPersona: form.myPersona,
      myRole: form.myRole,
      myCustomTitle: form.myCustomTitle,
      levelTitles: [...form.levelTitles],
      groupPrompt: form.groupPrompt,
      worldBookLinks: form.worldBookLinks,
      timeAware: !!form.timeAware,
      timeSyncMode: form.timeSyncMode || 'system',
      virtualTime: form.virtualTime || '',
      allowInvite: !!form.allowInvite,
      autoInvite: !!form.autoInvite,
      welcomeMessage: form.welcomeMessage,
      autoSummary: !!form.autoSummary,
      autoTTS: !!form.autoTTS,
      proactive: { enabled: !!form.proactiveEnabled, intervalMinutes: Number(form.proactiveIntervalMinutes || 60) },
      memory: {
        contextMemoryCount: Number(form.contextMemoryCount || 20),
        contextDisplayCount: Number(form.contextDisplayCount || 50),
        autoSummaryEvery: Number(form.autoSummaryEvery || 30),
        summaryPrompt: form.summaryPrompt
      },
      pat: { enabled: !!form.patEnabled, action: form.patAction, suffix: form.patSuffix },
      bubbleBg: { preset: form.bubblePreset, blur: Number(form.bubbleBlur || 0), opacity: Number(form.bubbleOpacity || 1), theme: form.bubbleTheme }
    })

    // Sync top-level chat properties
    chatStore.updateCharacter(chatId, {
      autoSummary: !!form.autoSummary,
      autoTTS: !!form.autoTTS,
      bgTheme: form.bgTheme,
      bgUrl: form.bgUrl,
      bgBlur: form.bgBlur,
      bgOpacity: form.bgOpacity,
      bubbleSize: form.bubbleSize,
      bubbleCss: form.bubbleCss,
      summaryPrompt: form.summaryPrompt,
      summaryLimit: Number(form.autoSummaryEvery || 30),
      contextLimit: Number(form.contextMemoryCount || 20),
      displayLimit: Number(form.contextDisplayCount || 50)
    })

    chatStore.triggerToast('已保存', 'success')
    openChatInWeChat(chatId)
  } finally {
    state.saving = false
  }
}

const globalBgStyle = computed(() => {
  const bg = settingsStore.personalization?.globalBg
  return bg ? { backgroundImage: `url(${bg})`, opacity: settingsStore.personalization?.wallpaperOverlayOpacity ?? 0.5 } : {}
})

// 完整气泡预设 (from ChatDetailSettings)
const presetBubbles = [
  {
    name: '乌金·沉浸',
    css: `background: radial-gradient(circle at top left, #2a2520 0%, #0e0e10 100%); border: 1px solid rgba(212, 175, 55, 0.2); border-top: 1px solid rgba(212, 175, 55, 0.4); color: #e6dcc0; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6); font-family: 'Noto Serif SC', serif; font-weight: 300; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); border-radius: 2px 12px 12px 12px; ||| background: radial-gradient(circle at top right, #374151 0%, #1f2937 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-top: 1px solid rgba(255, 255, 255, 0.2); color: #e5e7eb; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4); font-family: 'Noto Serif SC', serif; font-weight: 300; letter-spacing: 0.5px; border-radius: 12px 2px 12px 12px;`
  },
  {
    name: '信笺·对话',
    css: `background: #f7f5f0; border: 1px solid rgba(140, 126, 99, 0.3); color: #2c2c2c; box-shadow: 2px 2px 0 rgba(212, 175, 55, 0.2); font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; border-radius: 4px; padding: 10px 14px; letter-spacing: 1px; ||| background: #e5e7eb; border: 1px solid rgba(156, 163, 175, 0.3); color: #1f2937; box-shadow: -2px 2px 0 rgba(107, 114, 128, 0.1); font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; border-radius: 4px; padding: 10px 14px; letter-spacing: 1px;`
  },
  {
    name: '极致·琉璃',
    css: `background: rgba(30, 30, 35, 0.75); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.15); border-left: 2px solid #d4af37; color: #ffffff; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); font-family: system-ui, -apple-system, 'Microsoft YaHei', sans-serif; font-weight: 400; letter-spacing: 1px; border-radius: 8px; --no-arrow: true; ||| background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); border-right: 2px solid #e5e7eb; color: #ffffff; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); font-family: system-ui, -apple-system, 'Microsoft YaHei', sans-serif; font-weight: 400; letter-spacing: 1px; border-radius: 8px; --no-arrow: true;`
  },
  {
    name: '软萌·甜心',
    css: `background: #fff0f5; color: #8b4789; border: 2px dashed #ffb7c5; border-radius: 20px; box-shadow: 0 4px 12px rgba(255,183,197,0.4); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: #f0f8ff; color: #6868a8; border: 2px dashed #add8e6; border-radius: 20px; box-shadow: 0 4px 12px rgba(173,216,230,0.4); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
  },
  {
    name: '梦幻·睡眠',
    css: `background: linear-gradient(135deg, #e3f2fd 0%, #fff0f5 100%); color: #4a5a7b; border: 2px solid rgba(173, 216, 230, 0.4); border-radius: 18px; box-shadow: 0 3px 10px rgba(100, 149, 237, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff0f5 0%, #ffe6f0 100%); color: #765681; border: 2px solid rgba(255, 192, 203, 0.4); border-radius: 18px; box-shadow: 0 3px 10px rgba(255, 182, 193, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
  },
  {
    name: '星星·小美好',
    css: `background: linear-gradient(135deg, #fffacd 0%, #fff8dc 100%); color: #766045; border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 20px; box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff8dc 0%, #ffe4b5 100%); color: #8a6c57; border: 2px solid rgba(255, 222, 173, 0.4); border-radius: 20px; box-shadow: 0 4px 12px rgba(255, 228, 181, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
  },
  {
    name: '粉心·甜蜜',
    css: `background: linear-gradient(135deg, #ffe6f0 0%, #fff0f8 100%); color: #a6447d; border: 2px solid rgba(255, 182, 193, 0.5); border-radius: 22px; box-shadow: 0 5px 15px rgba(255, 105, 180, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff0f8 0%, #ffe6f5 100%); color: #bf5e8e; border: 2px solid rgba(255, 192, 203, 0.5); border-radius: 22px; box-shadow: 0 5px 15px rgba(255, 182, 193, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
  },
  {
    name: '云朵·梦境',
    css: `background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); color: #4d80b3; border: 2px solid rgba(135, 206, 250, 0.4); border-radius: 24px; box-shadow: 0 4px 14px rgba(135, 206, 235, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #e6f3ff 0%, #d4ebff 100%); color: #3d70a3; border: 2px solid rgba(173, 216, 230, 0.4); border-radius: 24px; box-shadow: 0 4px 14px rgba(176, 224, 230, 0.3); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
  },
  {
    name: '赛博·霓虹',
    css: `background: rgba(5, 20, 30, 0.9); border: 1px solid #00f3ff; color: #00f3ff; box-shadow: 0 0 10px rgba(0, 243, 255, 0.3), inset 0 0 5px rgba(0, 243, 255, 0.1); border-radius: 4px; letter-spacing: 1px; font-family: 'Consolas', 'Monaco', monospace; font-weight: bold; ||| background: rgba(30, 5, 20, 0.9); border: 1px solid #ff0055; color: #ff0055; box-shadow: 0 0 10px rgba(255, 0, 85, 0.3), inset 0 0 5px rgba(255, 0, 85, 0.1); border-radius: 4px; letter-spacing: 1px; font-family: 'Consolas', 'Monaco', monospace; font-weight: bold;`
  },
  {
    name: '水墨·丹青',
    css: `background: #fdfbf7; border-left: 4px solid #2b2b2b; color: #333; font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; letter-spacing: 1px; box-shadow: 2px 2px 8px rgba(0,0,0,0.1); border-radius: 2px; padding: 10px 15px; ||| background: #f2f2f2; border-right: 4px solid #8b0000; color: #333; font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; letter-spacing: 1px; box-shadow: -2px 2px 8px rgba(0,0,0,0.1); border-radius: 2px; padding: 10px 15px;`
  },
  {
    name: '极简·磨砂',
    css: `background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.6); color: #1f2937; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); font-family: system-ui, -apple-system, sans-serif; font-weight: 500; letter-spacing: 0.5px; ||| background: rgba(59, 130, 246, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); font-family: system-ui, -apple-system, sans-serif; font-weight: 500; letter-spacing: 0.5px;`
  }
]

function onPresetChange(event) {
  const presetName = event.target.value
  if (!presetName) {
    form.bubbleCss = ''
    return
  }
  const preset = presetBubbles.find(p => p.name === presetName)
  if (preset) {
    form.bubbleCss = preset.css
  }
}

function parsePreviewBubbleCss(cssString, role) {
  if (!cssString || typeof cssString !== 'string') {
    if (role === 'user') return { backgroundColor: '#95ec69', color: 'black', borderRadius: '4px' }
    return { backgroundColor: '#ffffff', color: 'black', borderRadius: '4px' }
  }

  let targetCss = cssString
  if (cssString.includes('|||')) {
    const parts = cssString.split('|||')
    targetCss = role === 'user' ? (parts[1] || '') : parts[0]
  }

  const style = {}
  targetCss.split(';').forEach(rule => {
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

function handleExportGroup() {
  const chatId = existingChat.value?.id
  if (!chatId) {
    chatStore.triggerToast('请先保存群聊配置', 'error')
    return
  }

  const exportData = {
    type: 'qiaoqiao_group_config',
    groupName: form.name,
    groupNo: form.groupNo,
    settings: {
      groupPrompt: form.groupPrompt,
      contextMemoryCount: form.contextMemoryCount,
      contextDisplayCount: form.contextDisplayCount,
      autoSummaryEvery: form.autoSummaryEvery,
      summaryPrompt: form.summaryPrompt,
      bubblePreset: form.bubblePreset,
      bubbleBlur: form.bubbleBlur,
      bubbleOpacity: form.bubbleOpacity,
      bgUrl: form.bgUrl,
      bgBlur: form.bgBlur,
      bgOpacity: form.bgOpacity,
      autoTTS: form.autoTTS,
      patEnabled: form.patEnabled,
      patAction: form.patAction,
      patSuffix: form.patSuffix
    }
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${form.name}_config_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  chatStore.triggerToast('配置已导出', 'success')
}

function handleResetConfig() {
  chatStore.triggerConfirm('重置配置', '确定要重置所有聊天配置吗？', () => {
    form.bubblePreset = 'default'
    form.bubbleBlur = 0
    form.bubbleOpacity = 1
    form.bgUrl = ''
    form.bgBlur = 0
    form.bgOpacity = 1
    form.autoTTS = false
    form.voiceSpeed = 1
    form.patEnabled = true
    form.autoSummary = false
    form.contextMemoryCount = 20
    form.contextDisplayCount = 50
    chatStore.triggerToast('配置已重置', 'success')
  })
}

onMounted(() => {
  if (existingChat.value) {
    hydrateFromChat(existingChat.value)
  } else {
    initCreateDefaults()
  }
})
</script>

<template>
  <div class="absolute inset-0 z-[9999] flex flex-col pt-[28px] bg-[#f2f2f2] text-gray-800">
    <div class="absolute inset-0 bg-cover bg-center -z-10" :style="globalBgStyle"></div>

    <!-- Header -->
    <div class="h-[50px] sticky top-0 flex items-center justify-between px-2 z-10 bg-white/95 border-b border-gray-200">
      <button class="w-10 h-full flex items-center justify-center text-gray-800" @click="router.back()">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <span class="font-bold text-gray-800">{{ isCreateMode ? '新建群聊' : '群聊设置' }}</span>
      <button @click="saveAll" class="ml-auto text-green-600 font-bold text-sm bg-green-100 px-3 py-1 rounded mr-2"
        :class="state.saving ? 'opacity-60 pointer-events-none' : ''">
        {{ state.saving ? '保存中' : '保存' }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-24">
      <!-- 1. 群聊基础信息 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">群聊基础</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="flex flex-col items-center gap-2 shrink-0">
              <div
                class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 cursor-pointer border border-white shadow-sm"
                @click="triggerAvatarUpload">
                <img :src="form.avatar" class="w-full h-full object-cover" />
              </div>
              <div class="flex gap-1">
                <button class="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                  @click.stop="triggerAvatarUpload">本地</button>
                <button class="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                  @click.stop="promptAvatarUrl">URL</button>
              </div>
              <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleAvatarChange" />
            </div>
            <div class="flex-1 min-w-0">
              <input v-model="form.name"
                class="w-full bg-transparent border-b border-gray-100 text-base font-bold outline-none py-1 focus:border-green-500 transition-colors"
                placeholder="群聊名称" />
              <div class="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>群号：<span class="font-mono tracking-tighter">{{ form.groupNo }}</span></span>
                <span>成员：{{ participantsView.length }}</span>
              </div>
            </div>
          </div>
          <div>
            <div class="text-[11px] text-gray-400 mb-1 flex items-center justify-between">
              <span class="flex items-center gap-1.5"><i class="fa-solid fa-bullhorn text-amber-500"></i> 群公告</span>
              <span v-if="isCreateMode" class="text-[9px] text-amber-600 bg-amber-50 px-1 rounded">创建后可查看历史</span>
            </div>
            <textarea v-if="isCreateMode" v-model="form.announcement"
              class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none h-20 focus:bg-white transition-all shadow-inner"
              placeholder="发布你的第一条群公告吧..."></textarea>
            <button v-else
              class="w-full py-3 rounded-xl bg-amber-50 text-amber-600 font-medium text-sm border border-amber-100 active:bg-amber-100 transition-all flex items-center justify-center gap-2"
              @click="state.showAnnouncementModal = true">
              <i class="fa-solid fa-newspaper"></i> 查看和管理群公告
            </button>
          </div>
        </div>
      </section>

      <!-- 2. 群成员 -->
      <section class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-bold text-gray-500">群成员</h3>
          <div class="flex gap-2">
            <button class="text-[10px] px-2 py-0.5 rounded-lg bg-white/60 text-gray-600 border border-gray-100"
              @click="state.showInviteModal = true">邀请</button>
            <button class="text-[10px] px-2 py-0.5 rounded-lg bg-green-50 text-green-600 border border-green-100"
              @click="openAiGenerate">AI生成</button>
          </div>
        </div>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 shadow-sm">
          <div class="grid grid-cols-5 gap-y-5 gap-x-2">
            <div v-for="p in participantsView" :key="p.id" class="flex flex-col items-center group relative">
              <div v-if="p.role === 'owner' || p.role === 'admin'"
                class="absolute -top-1 -right-1 z-10 text-[8px] px-1 rounded-[2px] text-white font-bold transform scale-90"
                :class="p.role === 'owner' ? 'bg-[#f7b500]' : 'bg-[#07c160]'">
                {{ p.role === 'owner' ? '主' : '管' }}
              </div>
              <div
                class="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 cursor-pointer active:scale-95 transition-transform border border-white shadow-sm"
                @click="openMemberManage(p.id)">
                <img :src="p.avatar" class="w-full h-full object-cover" />
              </div>
              <div class="text-[9px] mt-1.5 truncate w-full text-center text-gray-600 font-medium">{{ p.name }}</div>
            </div>
            <button class="flex flex-col items-center" @click="state.showInviteModal = true">
              <div
                class="w-12 h-12 rounded-xl bg-gray-50/50 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors">
                <i class="fa-solid fa-plus"></i>
              </div>
              <div class="text-[9px] mt-1.5 text-gray-400">添加</div>
            </button>
          </div>
        </div>
      </section>

      <!-- 3. 我的人设 (Group Specific) -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">我在本群</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div class="flex items-center gap-4">
            <div class="flex flex-col items-center gap-2 shrink-0">
              <div
                class="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 cursor-pointer border border-white shadow-sm"
                @click="triggerMyAvatarUpload">
                <img :src="form.myAvatar" class="w-full h-full object-cover" />
              </div>
              <div class="flex gap-1">
                <button class="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                  @click.stop="triggerMyAvatarUpload">本地</button>
                <button class="text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                  @click.stop="promptMyAvatarUrl">URL</button>
              </div>
              <input type="file" ref="myFileInput" class="hidden" accept="image/*" @change="handleMyAvatarChange" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] text-gray-400 mb-0.5 font-bold">我在本群的昵称</div>
              <input v-model="form.myNickname"
                class="w-full bg-transparent border-b border-gray-100 text-sm font-bold outline-none py-0.5 focus:border-green-500 transition-colors"
                placeholder="设置昵称..." />
            </div>
          </div>
          <div>
            <div class="text-[11px] text-gray-400 mb-1">本群专属人设</div>
            <textarea v-model="form.myPersona"
              class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none h-16 focus:bg-white transition-all shadow-inner"
              placeholder="例如：偶尔冒泡的吃瓜群众 / 处理事务的群管..."></textarea>
          </div>
        </div>
      </section>

      <!-- 4. 群聊规则与 AI -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">群聊规则与互动</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div>
            <div class="text-[11px] text-gray-400 mb-1">群聊氛围设定 (给 AI 的 Prompt)</div>
            <textarea v-model="form.groupPrompt"
              class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none h-24 focus:bg-white transition-all shadow-inner"
              placeholder="例如：这是一个二次元讨论群，大家说话喜欢带(x)或者(划掉)，氛围很和谐..."></textarea>
          </div>

          <div>
            <div class="text-[11px] text-gray-400 mb-1">入群欢迎词 / 系统提示</div>
            <textarea v-model="form.welcomeMessage"
              class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none h-16 focus:bg-white transition-all shadow-inner"
              placeholder="新成员加入时的固定欢迎语，不填则由 AI 发挥"></textarea>
          </div>

          <!-- 时间感知 -->
          <div class="toggle-row">
            <div class="flex flex-col">
              <span class="text-sm font-medium">时间感知</span>
              <span class="text-[10px] text-gray-400">AI 将感知当前时间并融入对话</span>
            </div>
            <input type="checkbox" v-model="form.timeAware" class="accent-green-600 scale-110" />
          </div>
          <div v-if="form.timeAware"
            class="space-y-3 p-3 bg-green-50/30 rounded-xl border border-green-100 animate-fade-in">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.timeSyncMode" value="system" class="accent-green-500">
                <span class="text-xs text-gray-700">系统同步</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.timeSyncMode" value="manual" class="accent-green-500">
                <span class="text-xs text-gray-700">虚拟设定</span>
              </label>
            </div>
            <div v-if="form.timeSyncMode === 'manual'">
              <input v-model="form.virtualTime" type="text"
                class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white"
                placeholder="虚拟时间 (如: 乾隆三十年)" />
              <div class="text-[10px] text-gray-400 mt-1">基准时间设定后，系统将模拟其时间的流逝</div>
            </div>
            <div v-else class="text-xs text-green-600 bg-green-50/50 p-2 rounded border border-green-100/50">
              <i class="fa-solid fa-clock-rotate-left mr-1"></i> 已启用实时同步：当前 AI 将时刻感知您的物理时间
            </div>
          </div>

          <div class="toggle-row">
            <span class="text-sm font-medium">允许成员邀请朋友</span>
            <input type="checkbox" v-model="form.allowInvite" class="accent-green-600 scale-110" />
          </div>

          <div class="toggle-row">
            <div class="flex flex-col">
              <span class="text-sm font-medium">AI 自动邀请新成员</span>
              <span class="text-[10px] text-gray-400">AI 将根据群聊氛围不定期拉入新角色</span>
            </div>
            <input type="checkbox" v-model="form.autoInvite" class="accent-green-600 scale-110" />
          </div>

          <div class="toggle-row">
            <span class="text-sm font-medium">主动开启话题</span>
            <input type="checkbox" v-model="form.proactiveEnabled" class="accent-green-600 scale-110" />
          </div>
          <div v-if="form.proactiveEnabled" class="flex items-center justify-between px-2 animate-fade-in">
            <span class="text-xs text-gray-500">发言频率 (分钟)</span>
            <input v-model.number="form.proactiveIntervalMinutes" type="number"
              class="w-20 bg-white/50 border border-gray-200 rounded-lg px-3 py-1 text-xs outline-none text-right" />
          </div>
        </div>
      </section>

      <!-- 5. 记忆与 AI 增强 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">记忆与总结</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div class="grid grid-cols-3 gap-2 text-center mb-3">
            <div class="glass-panel p-2 rounded-lg border bg-white/50 border-gray-200">
              <div class="text-[10px] text-gray-500">总聊天数</div>
              <div class="font-mono text-blue-600 text-base font-bold">{{ existingChat?.msgs?.length || 0 }}</div>
            </div>
            <div class="glass-panel p-2 rounded-lg border bg-white/50 border-gray-200">
              <div class="text-[10px] text-gray-500">总Token</div>
              <div class="font-mono text-orange-600 text-base font-bold">{{ tokenStats?.total || 0 }}</div>
            </div>
            <div class="glass-panel p-2 rounded-lg border bg-white/50 border-gray-200">
              <div class="text-[10px] text-gray-500">上下文</div>
              <div class="font-mono text-purple-600 text-base font-bold">{{ tokenStats?.totalContext || 0 }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-2">
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 ml-1">上下文记忆 (条)</label>
              <input v-model.number="form.contextMemoryCount" type="number"
                class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white"
                placeholder="默认 20" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-gray-400 ml-1">上下文显示 (条)</label>
              <input v-model.number="form.contextDisplayCount" type="number"
                class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white"
                placeholder="默认 50" />
            </div>
            <div class="space-y-1 col-span-2">
              <label class="text-[10px] text-gray-400 ml-1">自动总结条数</label>
              <input v-model.number="form.autoSummaryEvery" type="number"
                class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white"
                placeholder="每隔多少条触发 (默认 30)" />
            </div>
          </div>

          <div class="p-3 rounded-xl border space-y-3 transition-colors duration-300 shadow-sm"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/50 border-gray-100'">
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-sm font-medium"
                  :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">自动总结 (Auto
                  Summary)</span>
                <span class="text-[10px] text-gray-400">节省 Token 并维持长效记忆</span>
              </div>
              <input type="checkbox" v-model="form.autoSummary" class="accent-green-600 scale-110 cursor-pointer" />
            </div>

            <div class="pt-2 border-t"
              :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
              <label class="text-[10px] mb-1 block"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">总结提示词
                (Prompt)</label>
              <textarea v-model="form.summaryPrompt"
                class="w-full rounded-xl px-3 py-2 text-xs outline-none resize-none h-24 transition-all shadow-inner font-serif"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white focus:bg-black/30' : 'bg-white/80 border-gray-100 text-gray-800 focus:bg-white'"
                placeholder="自定义总结提示词..."></textarea>

              <div class="flex gap-2 mt-3">
                <button @click="triggerManualSummary"
                  class="flex-1 py-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center active:scale-95"
                  :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-900/20 text-blue-400 border-blue-900/30 hover:bg-blue-900/40' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'">
                  <i class="fa-solid fa-brain mr-1.5 text-sm"></i>手动总结
                </button>
                <button @click="showMemoryModal = true"
                  class="flex-1 py-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center active:scale-95"
                  :class="settingsStore.personalization.theme === 'dark' ? 'bg-purple-900/20 text-purple-400 border-purple-900/30 hover:bg-purple-900/40' : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100'">
                  <i class="fa-solid fa-database mr-1.5 text-sm"></i>记忆管理库
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. 互动增强 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">互动增强</h3>
        <div class="rounded-2xl p-4 border space-y-4 shadow-sm transition-all duration-300"
          :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/70 backdrop-blur-md border-white/40'">
          <div class="toggle-row">
            <div class="flex flex-col">
              <span class="text-sm font-medium"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">启用拍一拍互动</span>
              <span class="text-[10px] text-gray-400">双击头像触发互动反馈</span>
            </div>
            <input type="checkbox" v-model="form.patEnabled" class="accent-green-600 scale-110 cursor-pointer" />
          </div>
          <div v-if="form.patEnabled" class="grid grid-cols-2 gap-2 animate-fade-in pt-1">
            <input v-model="form.patAction"
              class="rounded-xl px-3 py-2 text-xs outline-none transition-all duration-300"
              :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white focus:bg-black/40' : 'bg-white/50 border-gray-100 focus:bg-white'"
              placeholder="动作: 拍了拍" />
            <input v-model="form.patSuffix"
              class="rounded-xl px-3 py-2 text-xs outline-none transition-all duration-300"
              :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10 text-white focus:bg-black/40' : 'bg-white/50 border-gray-100 focus:bg-white'"
              placeholder="后缀: 的屁股" />
          </div>
        </div>
      </section>

      <!-- 6. 视觉个性化 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">视觉个性化</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-5 shadow-sm">
          <!-- Bubble Preview -->
          <div class="p-4 rounded-2xl border overflow-hidden relative"
            :class="form.bgTheme === 'dark' ? 'bg-[#1e293b] border-[#334155]' : 'bg-gray-50 border-gray-200/50'">

            <div v-if="form.bgUrl" class="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none"
              :style="{ backgroundImage: `url(${form.bgUrl})`, filter: `blur(${form.bgBlur}px)`, opacity: form.bgOpacity }">
            </div>

            <div class="text-[10px] text-gray-400 mb-3 ml-1 uppercase tracking-widest font-bold relative z-10 block">
              气泡预览</div>
            <div class="flex flex-col gap-4 relative z-10">
              <div class="flex items-start gap-2">
                <img v-if="form.avatar" :src="form.avatar" class="w-8 h-8 rounded-lg object-cover shrink-0" />
                <div v-else class="w-8 h-8 rounded-lg bg-gray-300 shrink-0"></div>
                <div class="p-3 text-xs shadow-sm max-w-[80%]"
                  :style="{ fontSize: form.bubbleSize + 'px', ...parsePreviewBubbleCss(form.bubbleCss, 'ai') }">
                  这是群聊气泡的预览效果
                </div>
              </div>
              <div class="flex items-start flex-row-reverse gap-2">
                <img v-if="form.myAvatar" :src="form.myAvatar" class="w-8 h-8 rounded-lg object-cover shrink-0" />
                <div v-else class="w-8 h-8 rounded-lg bg-green-200 shrink-0"></div>
                <div class="p-3 text-xs shadow-sm max-w-[80%]"
                  :style="{ fontSize: form.bubbleSize + 'px', ...parsePreviewBubbleCss(form.bubbleCss, 'user') }">
                  我的测试消息效果
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="text-[11px] text-gray-400 mb-3 block font-bold">气泡预设</div>
            <select @change="onPresetChange"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white border-gray-200">
              <option value="">默认样式</option>
              <option v-for="preset in presetBubbles" :key="preset.name" :value="preset.name">
                {{ preset.name }}
              </option>
            </select>
          </div>

          <input v-model="form.bubbleCss" type="text"
            class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-green-500 transition-all font-mono"
            placeholder="气泡 CSS (实时预览)" />

          <div class="flex items-center gap-2 mb-2 mt-4">
            <span class="text-xs text-gray-500 font-bold ml-1">字体大小</span>
            <input v-model="form.bubbleSize" type="range" min="12" max="30" step="1"
              class="flex-1 h-1 bg-gray-300 rounded-lg accent-green-500">
            <span class="text-xs w-6 text-right text-gray-800">{{ form.bubbleSize }}</span>
          </div>


          <div class="pt-4 border-t border-gray-100">
            <div class="text-[11px] text-gray-400 mb-3 block font-bold">聊天背景故事 (URL)</div>
            <div class="flex gap-2">
              <input v-model="form.bgUrl"
                class="flex-1 bg-white/60 border border-gray-100 rounded-xl px-4 py-2 text-xs outline-none focus:bg-white transition-all shadow-sm"
                placeholder="https://..." />
              <button class="bg-gray-100 text-gray-600 px-3 py-1 rounded-xl text-[10px]"
                @click="promptBgUrl">设置</button>
              <button class="bg-blue-50 text-blue-500 px-3 py-1 rounded-xl text-[10px]"
                @click="triggerBgUpload">相册</button>
              <button class="bg-red-50 text-red-500 px-3 py-1 rounded-xl text-[10px]"
                @click="form.bgUrl = ''">清除</button>
            </div>
            <input type="file" ref="bgUploadInput" class="hidden" accept="image/*" @change="handleBgUpload">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="flex justify-between text-[10px] text-gray-400 mb-1"><span>背景模糊</span><span>{{ form.bgBlur
              }}px</span></div>
              <input type="range" v-model.number="form.bgBlur" min="0" max="20"
                class="w-full h-1 bg-gray-200 rounded-lg accent-green-600" />
            </div>
            <div>
              <div class="flex justify-between text-[10px] text-gray-400 mb-1"><span>背景透明度</span><span>{{ form.bgOpacity
              }}</span></div>
              <input type="range" v-model.number="form.bgOpacity" min="0" max="1" step="0.1"
                class="w-full h-1 bg-gray-200 rounded-lg accent-green-600" />
            </div>
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg border border-gray-100">
            <span class="text-xs font-medium text-gray-500">背景底色主题</span>
            <div class="flex bg-gray-200 rounded-md p-0.5">
              <button @click="form.bgTheme = 'light'" class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                :class="form.bgTheme === 'light' ? 'bg-white text-gray-800' : 'text-gray-500 hover:text-gray-700'">浅色</button>
              <button @click="form.bgTheme = 'dark'" class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                :class="form.bgTheme === 'dark' ? 'bg-[#2e2e2e] text-white' : 'text-gray-500 hover:text-gray-700'">深色</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. 语音 (TTS) -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">语音 (TTS)</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">启用语音朗读</span>
            <input type="checkbox" v-model="form.autoTTS" class="accent-green-600 scale-110" />
          </div>
          <div v-if="form.autoTTS" class="space-y-3 animate-fade-in">
            <div>
              <label class="text-xs text-gray-500 block mb-1">语速</label>
              <div class="flex items-center gap-2">
                <input type="range" v-model.number="form.voiceSpeed" min="0.5" max="2" step="0.1"
                  class="flex-1 h-1 bg-gray-200 rounded-lg accent-green-600" />
                <span class="text-xs text-gray-500 w-8 text-right">{{ form.voiceSpeed || 1 }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 8. 群成员等级设置 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">群成员等级称号 (1-6级)</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-4 shadow-sm">
          <div class="grid grid-cols-2 gap-3">
            <div v-for="(title, idx) in form.levelTitles" :key="idx" class="flex flex-col gap-1">
              <label class="text-[10px] text-gray-400 font-bold ml-1 uppercase">Level {{ idx + 1 }}</label>
              <input v-model="form.levelTitles[idx]" type="text"
                class="w-full bg-white/50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-green-500 transition-all font-medium"
                :placeholder="`等级 ${idx + 1} 称号`" />
            </div>
          </div>
          <p class="text-[10px] text-gray-400 mt-2 px-1">
            普通成员将根据活跃值获得对应等级。活跃值越高，越靠近等级 6（传说）。
          </p>
          <button
            class="w-full mt-1 bg-amber-50/50 text-amber-600 hover:bg-amber-100/50 transition-all font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5"
            @click="state.showRankModal = true">
            <i class="fa-solid fa-ranking-star"></i> 查看当前活跃榜单
          </button>
        </div>
      </section>

      <!-- 8. 数据与管理 -->
      <section class="space-y-2">
        <h3 class="text-xs font-bold text-gray-500 ml-1">数据与管理</h3>
        <div class="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 space-y-3 shadow-sm">
          <button
            class="w-full py-3 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm border border-blue-100 active:bg-blue-100 transition-all flex items-center justify-center gap-2"
            @click="handleExportGroup">
            <i class="fa-solid fa-file-export"></i> 导出群聊配置
          </button>
          <button
            class="w-full py-3 rounded-xl bg-amber-50 text-amber-600 font-medium text-sm border border-amber-100 active:bg-amber-100 transition-all flex items-center justify-center gap-2"
            @click="state.showRankModal = true">
            <i class="fa-solid fa-ranking-star"></i> 查看活跃排行榜
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="py-3 rounded-xl bg-orange-50 text-orange-600 font-medium text-sm border border-orange-100 active:bg-orange-100 transition-all"
              @click="handleResetConfig">
              <i class="fa-solid fa-rotate-left mr-1"></i> 重置配置
            </button>
            <button
              class="py-3 rounded-xl bg-white/50 text-gray-600 font-medium text-sm border border-gray-100 active:bg-gray-100 transition-all"
              @click="saveAll">
              <i class="fa-solid fa-save mr-1"></i> 保存设置
            </button>
          </div>
        </div>
      </section>

      <!-- Danger Zone -->
      <div v-if="!isCreateMode" class="pt-6 space-y-4">
        <button @click="clearGroupMessages"
          class="w-full py-4 rounded-2xl bg-white/40 text-gray-600 text-sm font-medium border border-gray-100 active:bg-gray-200 transition-all">清空聊天记录</button>
        <button v-if="myRole === 'owner'" @click="resetGroupAll"
          class="w-full py-4 rounded-2xl bg-orange-50 text-orange-600 text-sm font-medium border border-orange-100 active:bg-orange-100 transition-all">解散并归档群聊</button>
        <button @click="quitGroup"
          class="w-full py-4 rounded-2xl bg-red-50 text-red-600 text-sm font-bold border border-red-100 active:bg-red-100 transition-all">退出群聊</button>
      </div>
    </div>

    <!-- Modals -->
    <AvatarCropper v-if="state.showAvatarCropper" :src="form.avatar" @close="state.showAvatarCropper = false"
      @cropped="handleAvatarCropped" />

    <!-- Invite Modal -->
    <div v-if="state.showInviteModal"
      class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4"
      @click="state.showInviteModal = false">
      <div
        class="bg-white w-full max-w-[360px] p-6 rounded-3xl space-y-4 animate-scale-in max-h-[85vh] flex flex-col shadow-2xl"
        @click.stop>
        <div class="flex justify-between items-center pb-3 border-b border-gray-100 shrink-0">
          <h3 class="font-bold text-gray-900 text-lg">邀请成员</h3>
          <button @click="state.showInviteModal = false" class="text-gray-400 hover:text-gray-600">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <!-- Friends Section -->
        <div class="space-y-3">
          <div class="text-xs font-bold text-gray-500 uppercase tracking-widest">📱 好友</div>
          <div v-if="contacts.length === 0" class="text-xs text-gray-400 py-3 text-center">暂无好友</div>
          <div v-else class="space-y-2 max-h-[40vh] overflow-y-auto">
            <label v-for="contact in contacts" :key="contact.id"
              class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
              <input type="checkbox" :checked="state.selectedInviteIds.has(contact.id)"
                @change="toggleInvite(contact.id)" class="accent-green-600 scale-125" />
              <img :src="contact.avatar" class="w-10 h-10 rounded-lg object-cover" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">{{ contact.remark || contact.name }}</div>
                <div class="text-[10px] text-gray-400">{{ contact.id }}</div>
              </div>
            </label>
          </div>
        </div>

        <div class="flex gap-2 pt-4 border-t border-gray-100">
          <button @click="state.showInviteModal = false"
            class="flex-1 py-3 rounded-xl bg-gray-50 text-gray-600 font-medium text-sm hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button @click="confirmInvite"
            class="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors">
            邀请 ({{ state.selectedInviteIds.size }})
          </button>
        </div>
      </div>
    </div>



    <!-- Member Manage Modal -->
    <div v-if="state.showMemberManageModal"
      class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      @click="state.showMemberManageModal = false">
      <div
        class="bg-white w-[90%] max-w-[400px] p-6 rounded-3xl space-y-5 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        @click.stop>
        <div class="flex flex-col items-center gap-4 pb-6 border-b border-gray-50">
          <div class="relative">
            <img :src="manageTarget?.avatar"
              class="w-20 h-20 rounded-2xl object-cover shadow-md border-4 border-white" />
            <div v-if="manageTarget?.role === 'owner'"
              class="absolute -top-2 -right-2 bg-amber-400 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
              群主</div>
          </div>
          <div class="text-center">
            <div class="font-bold text-xl text-gray-900 flex items-center justify-center gap-2 flex-wrap">
              {{ manageTarget?.nickname || manageTarget?.name }}
              <span v-if="manageTarget?.customTitle"
                class="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded text-[11px] font-bold">{{
                  manageTarget?.customTitle }}</span>
              <span v-if="manageTarget?.isMuted"
                class="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[11px] font-bold border border-red-100 flex items-center gap-1">
                <i class="fa-solid fa-microphone-slash text-[10px]"></i>禁言中
              </span>
              <span @click="handleSetGender" class="cursor-pointer hover:scale-110 transition-transform">
                <i v-if="manageTarget?.gender === '男'" class="fa-solid fa-mars text-blue-500 text-sm"></i>
                <i v-else-if="manageTarget?.gender === '女'" class="fa-solid fa-venus text-pink-500 text-sm"></i>
                <i v-else class="fa-solid fa-genderless text-gray-400 text-sm"></i>
              </span>
            </div>
            <div class="text-[12px] text-gray-500 mt-2 tracking-wide font-mono">微信号: {{ manageTarget?.wechatId ||
              manageTarget?.id }}</div>

            <div class="flex items-center justify-center gap-4 mt-3 text-[11px] text-gray-500">
              <div class="flex items-center gap-1">
                <i class="fa-regular fa-calendar-days text-gray-400"></i>
                入群时间: {{ manageTarget?.joinTime || '更早以前' }}
              </div>
              <div class="flex items-center gap-1 cursor-pointer hover:text-blue-500 transition-colors"
                @click="goToMoments(manageTarget?.id)">
                <i class="fa-regular fa-images text-blue-400"></i> 朋友圈
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2 px-1">
              <div class="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">背景人设 & 定位</div>
              <button @click="handleSetPersona"
                class="text-[10px] text-blue-500 flex items-center gap-1 hover:underline">
                <i class="fa-solid fa-pen-to-square"></i>编辑
              </button>
            </div>
            <div @click="handleSetPersona"
              class="p-3 bg-gray-50 rounded-2xl text-xs text-gray-600 italic leading-relaxed shadow-inner cursor-pointer hover:bg-gray-100 transition-colors">
              {{ manageTarget?.persona || '这个成员很神秘，还没有设定背景...' }}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button @click="handleSetNickname" class="manage-btn"><i class="fa-solid fa-signature"></i>设置昵称</button>
            <button @click="handleSetTitle" class="manage-btn"><i class="fa-solid fa-crown"></i>专属头衔</button>

            <button v-if="manageTarget?.id !== 'user' && !isFriend(manageTarget?.id)" @click="handleAddFriendFromGroup"
              class="manage-btn text-blue-600">
              <i class="fa-solid fa-user-plus"></i>加为好友
            </button>

            <template v-if="myRole === 'owner' && manageTarget?.id !== 'user'">
              <button @click="handleSetAdmin" class="manage-btn"
                :class="manageTarget?.role === 'admin' ? 'bg-green-100/50 border-green-200 text-green-700' : ''">
                <i class="fa-solid fa-user-shield"
                  :class="manageTarget?.role === 'admin' ? 'text-green-500' : ''"></i>{{
                    manageTarget?.role === 'admin'
                      ? '撤销管理' : '设为管理' }}
              </button>
              <button @click="handleTransferOwner" class="manage-btn text-amber-600"><i
                  class="fa-solid fa-exchange"></i>移交群主</button>
            </template>

            <button v-if="canIManage && manageTarget?.id !== 'user'" @click="handleMute" class="manage-btn"
              :class="manageTarget?.muteUntil > Date.now() ? 'bg-red-50 border-red-100 text-red-600' : ''">
              <i class="fa-solid fa-comment-slash"
                :class="manageTarget?.muteUntil > Date.now() ? 'text-red-500' : ''"></i>
              {{ manageTarget?.muteUntil > Date.now() ? '解除禁言' : '禁言管理' }}
            </button>

            <button v-if="canIManage && manageTarget?.id !== 'user'"
              @click="removeParticipant(manageTarget?.id); state.showMemberManageModal = false"
              class="manage-btn text-red-500"><i class="fa-solid fa-user-minus"></i>踢出该群</button>
          </div>

          <!-- Private Memory Interop Block -->
          <div v-if="manageTarget?.id !== 'user'" class="p-3 bg-purple-50/30 rounded-2xl border border-purple-100 mt-3">
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-purple-700">私聊记忆互通</span>
                <span class="text-[10px] text-gray-500">将角色与你的私聊记录引入群内上下文</span>
              </div>
              <input type="checkbox" :checked="manageTarget?.privateMemoryIntero" @change="togglePrivateMemoryIntero"
                class="accent-purple-600 scale-110" />
            </div>
            <div v-if="manageTarget?.privateMemoryIntero"
              class="flex items-center gap-2 mt-3 pt-3 border-t border-purple-100/50">
              <span class="text-[10px] text-gray-500">调用近期单聊消息条数:</span>
              <input type="number" :value="manageTarget?.privateMemoryLimit ?? 20" @change="updatePrivateMemoryLimit"
                class="w-16 bg-white border border-purple-200 rounded-lg text-center text-xs py-1 outline-none focus:border-purple-400 font-bold text-purple-600" />
            </div>
          </div>

        </div>

        <button @click="state.showMemberManageModal = false"
          class="w-full py-4 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors">取消关闭</button>
      </div>
    </div>

    <!-- Group Announcement Modal -->
    <GroupAnnouncementModal v-if="state.showAnnouncementModal" :visible="state.showAnnouncementModal"
      @close="state.showAnnouncementModal = false" :chatData="existingChat" />

    <!-- Manual Summary Modal -->
    <div v-if="showManualSummaryModal"
      class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      @click="showManualSummaryModal = false">
      <div class="bg-white w-full max-w-[320px] rounded-3xl overflow-hidden shadow-2xl p-6 animate-scale-in"
        @click.stop>
        <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">手动触发总结</h3>
        <p class="text-xs text-gray-500 mb-4 leading-relaxed text-center bg-gray-50 p-3 rounded-xl">输入要总结的消息范围（如 <b
            class="text-purple-600">1-50</b>），留空则总结全部未总结消息。</p>
        <input v-model="manualSummaryRange" type="text"
          class="w-full border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all text-center mb-5 font-mono shadow-inner"
          placeholder="如: 1-50（留空则全部）">
        <div class="flex gap-3">
          <button @click="showManualSummaryModal = false"
            class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform">
            取消
          </button>
          <button @click="executeManualSummary"
            class="flex-1 py-3 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-200 font-bold active:scale-95 transition-transform">
            开始总结
          </button>
        </div>
      </div>
    </div>

    <!-- AI Member Generator Modal -->
    <div v-if="state.showAiModal"
      class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      @click="state.showAiModal = false">
      <div class="bg-white w-full max-w-[340px] rounded-3xl overflow-hidden shadow-2xl p-6 animate-scale-in"
        @click.stop>
        <div class="flex flex-col items-center gap-3 mb-6">
          <div
            class="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-3xl shadow-lg">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <h3 class="text-xl font-bold text-gray-900">AI 批量生成成员</h3>
          <p class="text-xs text-gray-500 text-center leading-relaxed">基于当前群聊主题，AI 将为你构思并注入一批自带背景与人设的新面孔。</p>
        </div>

        <div class="space-y-4">
          <div class="space-y-1">
            <label class="text-[10px] text-gray-400 ml-1 font-bold uppercase tracking-tighter">生成数量</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="c in [3, 6, 9, 12]" :key="c" @click="state.aiCount = c"
                class="px-4 py-1.5 rounded-lg text-xs font-bold border transition-all"
                :class="state.aiCount === c ? 'bg-green-500 text-white border-green-500 shadow-md scale-105' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'">
                {{ c }}个
              </button>
              <div class="flex items-center gap-1.5 ml-auto">
                <span class="text-[10px] text-gray-400">自定义:</span>
                <input type="number" v-model.number="state.aiCount" min="1" max="50"
                  class="w-14 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:bg-white focus:border-green-400 outline-none text-center" />
              </div>
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-[10px] text-gray-400 ml-1 font-bold uppercase tracking-tighter">特别要求 (可选)</label>
            <textarea v-model="state.aiRequirement"
              class="w-full bg-gray-50 border-2 border-gray-50 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all h-24 resize-none shadow-inner"
              placeholder="如: 全是反派、都是大学生、性格都比较高冷..."></textarea>
          </div>
        </div>

        <div class="flex gap-3 mt-8">
          <button @click="state.showAiModal = false"
            class="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform">
            取消
          </button>
          <button @click="executeAiGenerate"
            class="flex-[2] py-3.5 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-200 font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
            :disabled="state.aiLoading">
            <i v-if="state.aiLoading" class="fa-solid fa-circle-notch fa-spin"></i>
            {{ state.aiLoading ? '思考与绘图中...' : '立即注入灵感' }}
          </button>
        </div>
      </div>
    </div>

    <!-- AI Generation Result Modal -->
    <div v-if="state.showAiResultModal"
      class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
      <div
        class="bg-gray-50 w-full max-w-[360px] h-[80vh] rounded-[32px] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
        <div class="p-6 bg-white border-b border-gray-100 shrink-0">
          <h3 class="text-xl font-black text-gray-900 leading-tight">灵感已就位</h3>
          <p class="text-[11px] text-gray-400 mt-1 uppercase tracking-widest">请勾选你想加入群聊的成员</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div v-for="m in state.aiGenerated" :key="m.id"
            class="bg-white p-3 rounded-2xl flex items-center gap-3 border transition-all cursor-pointer shadow-sm hover:shadow-md"
            :class="state.selectedAiIds.has(m.id) ? 'border-green-400 ring-2 ring-green-100' : 'border-white'"
            @click="toggleAiSelect(m.id)">

            <div class="relative">
              <img :src="m.avatar" class="w-12 h-12 rounded-xl object-cover shadow-sm bg-gray-100" />
              <div v-if="state.selectedAiIds.has(m.id)"
                class="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm animate-bounce-short">
                <i class="fa-solid fa-check"></i>
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-gray-800 text-sm truncate">{{ m.name }}</span>
                <span class="px-1.5 py-0.5 rounded-md bg-gray-100 text-[9px] text-gray-500 font-bold uppercase">{{
                  m.bio?.gender || '无' }}</span>
              </div>
              <div class="text-[10px] text-gray-400 truncate mt-0.5">{{ m.prompt || '暂无人设描述' }}</div>
            </div>
          </div>
        </div>

        <div class="p-6 bg-white border-t border-gray-100 flex gap-3">
          <button @click="state.showAiResultModal = false; state.aiGenerated = []"
            class="flex-1 py-3.5 rounded-2xl bg-gray-50 text-gray-500 font-bold active:scale-95 transition-transform">
            放弃
          </button>
          <button @click="confirmAiMembers"
            class="flex-[2] py-3.5 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-100 font-bold active:scale-95 transition-transform">
            确定引入 ({{ state.selectedAiIds.size }}人)
          </button>
        </div>
      </div>
    </div>

    <!-- Memory Library Modal (Themed) -->
    <div v-if="showMemoryModal"
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      @click="showMemoryModal = false">
      <div
        class="w-[90%] max-w-[360px] h-[85%] rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300"
        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'" @click.stop>
        <!-- Header with Theme Switcher -->
        <div class="p-4 border-b transition-all duration-300" :class="settingsStore.personalization.theme === 'dark'
          ? 'border-[#334155] bg-gradient-to-r from-purple-900/50 to-pink-900/50'
          : 'border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50'">
          <div class="flex justify-between items-center mb-3">
            <span class="font-bold flex items-center gap-2 text-lg transition-all duration-300"
              :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">
              <i class="fa-solid fa-brain text-purple-500"></i> 记忆管理库
            </span>
            <button @click="showMemoryModal = false" class="transition-colors"
              :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>

          <!-- Theme Selector -->
          <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button v-for="theme in memoryThemes" :key="theme.id" @click="currentMemoryTheme = theme.id"
              class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0"
              :class="currentMemoryTheme === theme.id
                ? 'bg-gradient-to-r ' + theme.activeGradient + ' text-white shadow-md scale-105'
                : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')">
              <i :class="theme.icon"></i> {{ theme.name }}
            </button>
          </div>
        </div>

        <!-- Memory List with Dynamic Theme -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3" :class="getThemeBackground()">
          <div v-if="memories.length === 0" class="text-center text-gray-400 py-12 text-sm">
            <i class="fa-solid fa-box-open text-4xl mb-3 opacity-30"></i>
            <div>暂无记忆</div>
          </div>

          <div v-for="(mem, index) in memories" :key="index" class="relative transition-all duration-300"
            :class="{ 'pl-8': isEditMode }">
            <!-- Checkbox (Only in Edit Mode) -->
            <div v-if="isEditMode" class="absolute left-0 top-3">
              <input type="checkbox"
                class="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition-transform hover:scale-110"
                :checked="selectedIndices.has(index)" @change="toggleSelection(index)">
            </div>

            <!-- Memory Card with Theme -->
            <div :class="getThemeCardClass()" class="transition-all duration-300 hover:shadow-lg">
              <!-- Editing Mode -->
              <div v-if="editingIndex === index">
                <textarea v-model="editingContent"
                  class="w-full border-2 border-purple-300 rounded-lg p-3 text-sm h-32 mb-2 focus:ring-2 focus:ring-purple-400 outline-none font-serif"
                  :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-700 text-white border-purple-600 focus:ring-purple-500' : 'bg-white'"></textarea>
                <div class="flex justify-end gap-2">
                  <button class="text-xs px-4 py-1.5 rounded-lg transition-colors"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    @click="cancelEdit">取消</button>
                  <button
                    class="text-xs px-4 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-md"
                    @click="saveEdit(index)">保存</button>
                </div>
              </div>

              <!-- Display Mode -->
              <div v-else>
                <div class="flex justify-between items-start mb-2">
                  <div class="flex items-center gap-2">
                    <!-- Themed Number Badge -->
                    <span :class="getThemeNumberClass()">
                      {{ getThemeNumberPrefix(memories.length - index) }}
                    </span>
                    <span :class="getThemeBadgeClass()">{{ getThemeLabel() }}</span>
                  </div>
                  <div class="flex gap-2">
                    <button class="text-blue-500 hover:text-blue-600 transition-colors p-1"
                      @click="startEdit(index, mem)" title="编辑">
                      <i class="fa-solid fa-pen text-sm"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-600 transition-colors p-1" @click="deleteMemory(index)"
                      title="删除">
                      <i class="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>
                <div :class="getThemeContentClass()">
                  {{ typeof mem === 'object' ? (mem.content || JSON.stringify(mem)) : mem }}
                </div>
                <div v-if="typeof mem === 'object' && mem.range" :class="getThemeMetaClass()">
                  <i class="fa-solid fa-clock mr-1"></i>
                  {{ mem.range }} · {{ mem.timestamp ? new Date(mem.timestamp).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer with Edit Mode Toggle -->
        <div class="p-3 border-t flex justify-between items-center gap-2 transition-all duration-300"
          :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a] border-[#334155]' : 'bg-white border-gray-200'">
          <!-- Edit Mode Toggle -->
          <button @click="isEditMode = !isEditMode"
            class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2"
            :class="isEditMode
              ? 'bg-purple-500 text-white shadow-md'
              : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')">
            <i class="fa-solid" :class="isEditMode ? 'fa-check' : 'fa-edit'"></i>
            {{ isEditMode ? '完成' : '编辑' }}
          </button>

          <!-- Batch Delete (Only in Edit Mode) -->
          <div v-if="isEditMode" class="flex items-center gap-2">
            <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none"
              :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
              全选
            </label>
            <button class="text-xs px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5"
              :class="selectedIndices.size > 0
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed')" @click="batchDeleteMemory" :disabled="selectedIndices.size === 0">
              <i class="fa-solid fa-trash"></i>
              删除 ({{ selectedIndices.size }})
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Group Rank Modal -->
    <GroupRankModal :visible="state.showRankModal" :chatId="chatIdParam || chatId"
      @close="state.showRankModal = false" />
  </div>
</template>

<style scoped>
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.manage-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
  background-color: #f9fafb;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #4b5563;
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  border: 1px solid #f3f4f6;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  width: 100%;
}

.manage-btn:active {
  background-color: #f3f4f6;
}

.manage-btn i {
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>
