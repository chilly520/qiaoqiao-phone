<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWeiboStore } from '../stores/weiboStore'
import { useChatStore } from '../stores/chatStore'
import { useWorldBookStore } from '../stores/worldBookStore'

const router = useRouter()
import { useSettingsStore } from '../stores/settingsStore'

const weiboStore = useWeiboStore()
const chatStore = useChatStore()
const worldBookStore = useWorldBookStore()
const settingsStore = useSettingsStore()

onMounted(async () => {
  await weiboStore.initStore()
  // Ensure chat/worldbook data is loaded for bindings
  if (worldBookStore.books.length === 0) worldBookStore.loadEntries()
  // Chat store usually auto-inits but we can ensure contacts are ready

  // Ensure initial posts exist if empty
  if (weiboStore.posts.length === 0) {
    weiboStore.addPost({
      author: 'Chilly',
      avatar: '/avatars/小猫星星眼.jpg',
      content: '今天天气真好，想出去玩！☀️ #日常 #心情',
      images: [],
      stats: { share: 12, comment: 3, like: 156 },
      comments: [
        {
          author: '吃瓜少女',
          avatar: '/avatars/小猫吃草莓.jpg',
          content: '捉住Chilly！今天也太可爱了吧！🥰',
          time: Date.now() - 3600000,
          likes: 52,
          isVip: true,
          isLiked: false
        },
        {
          author: '熬夜冠军',
          avatar: '/avatars/小猫坏笑.jpg',
          content: '带我一个！带我一个！🙋‍♂️',
          time: Date.now() - 1800000,
          likes: 28,
          isVip: false,
          isLiked: false
        },
        {
          author: '热心市民',
          avatar: '/avatars/小猫喝茶.jpg',
          content: '这种天气就适合野餐呀 🍱',
          time: Date.now() - 900000,
          likes: 15,
          isVip: false,
          isLiked: true
        }
      ]
    })
  }

  // 仅当第一条帖子没有评论时，才注入演示评论（避免每次覆写用户数据）
  if (weiboStore.posts.length > 0) {
    const firstPost = weiboStore.posts[0]
    if (!firstPost.comments || firstPost.comments.length === 0) {
      firstPost.comments = [
        {
          id: 'demo_c1',
          author: '吃瓜少女',
          avatar: '/avatars/小猫吃草莓.jpg',
          content: '捉住Chilly！今天也太可爱了吧！🥰',
          time: Date.now() - 3600000,
          likes: 52,
          isVip: true,
          isLiked: false,
          replies: [
            { author: 'Chilly', content: '嘿嘿，被发现了！🐱', isVip: true, isAuthor: true },
            { author: '路人甲', content: '羡慕前排！', isVip: false }
          ]
        },
        {
          id: 'demo_c2',
          author: '表情包大户',
          avatar: '/avatars/小猫坏笑.jpg',
          content: '',
          sticker: 'https://api.iconify.design/noto:cat-face-with-wry-smile.svg',
          time: Date.now() - 1800000,
          likes: 28,
          isVip: false,
          isLiked: false
        },
        {
          id: 'demo_c3',
          author: '摄影师',
          avatar: '/avatars/小猫开心.jpg',
          content: '上次拍的照片还没发呢！',
          image: 'https://picsum.photos/seed/pic_comment/300/200',
          time: Date.now() - 900000,
          likes: 45,
          isVip: true,
          isLiked: true
        }
      ]
      if (firstPost.stats && firstPost.stats.comment < 3) firstPost.stats.comment = 3
      weiboStore.saveData()
    }
  }
})

// --- State ---
const activeView = ref('home')
const activeSearchSub = ref('hot')
const showPostModal = ref(false)
const isRefreshing = ref(false)
const isPulling = ref(false)
const pullDistance = ref(0)

const showSettingsModal = ref(false)
const showShareModal = ref(false)
const selectedPostToShare = ref(null)
const activeCommentPostId = ref(null) // ID of the post with expanded comments

// 转发相关状态
const showRepostModal = ref(false)
const repostTargetPost = ref(null)
const repostCommentText = ref('')

// 分享面板搜索过滤
const shareContactSearch = ref('')

// 最近联系人（根据私信对话记录排序）
const sortedShareContacts = computed(() => {
  const allContacts = Object.entries(chatStore.chats || {}).map(([id, chat]) => ({
    id,
    name: chat.remark || chat.name,
    avatar: chat.avatar,
    // 最近联系时间：从私信对话中取最后一条消息时间
    lastActive: weiboStore.getDMChatMessages(chat.name || chat.re)?.length > 0
      ? Math.max(...weiboStore.getDMChatMessages(chat.name || chat.re).map(m => m.time || 0))
      : 0
  }))
  // 按搜索关键词过滤
  if (shareContactSearch.value.trim()) {
    const term = shareContactSearch.value.toLowerCase()
    return allContacts.filter(c =>
      c.name.toLowerCase().includes(term)
    )
  }
  // 有最近对话的排前面
  return allContacts.sort((a, b) => b.lastActive - a.lastActive)
})

const postText = ref('')
const searchText = ref('Chilly')
const commentInputText = ref('')
const activeReplyCommentId = ref(null) // ID of comment being replied to (if null, top level)
const activeReplyUser = ref(null) // User object being replied to

function setReplyTarget(post, comment, replyUser = null) {
  // 存储评论的 id 而非对象引用，避免刷新后引用失效
  activeReplyCommentId.value = comment ? (comment.id || comment) : null
  activeReplyUser.value = replyUser || (comment ? { name: comment.author } : null)

  // Focus input (simulate)
  const input = document.querySelector(`.post-${post.id}-comment-input`)
  if (input) input.focus()
}

function sendComment(postId) {
  if (!commentInputText.value.trim()) return

  const post = weiboStore.posts.find(p => p.id === postId)
  if (!post) return

  // If replying to a comment (Threading)
  if (activeReplyCommentId.value) {
    // 通过 id 或对象引用查找父评论（兼容新旧数据）
    const targetId = typeof activeReplyCommentId.value === 'string'
      ? activeReplyCommentId.value
      : activeReplyCommentId.value?.id
    let parentComment = null

    if (targetId) {
      parentComment = post.comments.find(c => c.id === targetId)
    }
    // 回退：如果通过 id 找不到，尝试用引用匹配
    if (!parentComment && typeof activeReplyCommentId.value === 'object') {
      parentComment = post.comments.find(c => c === activeReplyCommentId.value)
    }

    if (!parentComment) {
      // 最终回退：使用第一条评论
      parentComment = post.comments[0]
    }
    if (!parentComment.replies) parentComment.replies = []

    let content = commentInputText.value
    // If replying to a nested user, valid practice is to not prefix in the content, but UI shows "Reply X"
    // But strictly mimic Weibo:
    if (activeReplyUser.value && activeReplyUser.value.name !== parentComment.author) {
      content = `回复@${activeReplyUser.value.name}:${content}`
    }

    parentComment.replies.push({
      author: 'Chilly',
      isAuthor: true,
      isVip: true, // You are VIP
      content: content
    })
  } else {
    // Top level comment
    post.comments.unshift({
      author: 'Chilly',
      avatar: '/avatars/小猫星星眼.jpg',
      content: commentInputText.value,
      time: Date.now(),
      likes: 0,
      isVip: true,
      isLiked: false,
      replies: []
    })
    if (post.stats) post.stats.comment++
  }

  commentInputText.value = ''
  activeReplyCommentId.value = null
  activeReplyUser.value = null
  chatStore.triggerToast('评论成功', 'success')
}

const topicDetail = ref({ title: '', bannerTitle: '' })
const dmChat = ref({ name: '' })
// User Profile is now from store
const userProfile = computed(() => weiboStore.user)

// Settings Form State
const settingsForm = ref({})
const settingsTab = ref('profile') // profile, binding, data

// Temp state for other views
const viewedUserProfile = ref({ name: '', avatar: '' })

const profileActiveTab = ref('all')
// 搜索历史使用 store 中的持久化数据（不再硬编码）
const activeSearchResultTab = ref('posts')

const dmInputText = ref('')
const dmMessagesContainer = ref(null)
// 使用 store 中的持久化私信对话消息（不再用本地 ref）
// 切换联系人时从 store 加载对应聊天记录

const currentDMMessages = computed(() => {
  return weiboStore.getDMChatMessages(dmChat.value.name) || []
})

function sendDMMessage() {
  if (!dmInputText.value.trim()) return
  const name = dmChat.value.name
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  // 通过 store 持久化发送消息
  weiboStore.addDMChatMessage(name, {
    content: dmInputText.value,
    isMine: true,
    time: Date.now(),
    timeStr
  })
  dmInputText.value = ''
  scrollToBottom()
  // 使用 AI 生成回复（自动带上最近聊天记录作为上下文）
  setTimeout(async () => {
    const recentMsgs = weiboStore.getDMChatMessages(name).slice(-6) // 取最近6条作为上下文
    const reply = await weiboStore.generateDMChatReply(name, recentMsgs)
    if (reply) {
      const replyTime = new Date()
      const senderDM = weiboStore.dmMessages.find(d => d.sender === name)
      weiboStore.addDMChatMessage(name, {
        content: reply,
        isMine: false,
        avatar: senderDM?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + name,
        time: Date.now(),
        timeStr: `${replyTime.getHours().toString().padStart(2, '0')}:${replyTime.getMinutes().toString().padStart(2, '0')}`
      })
      scrollToBottom()
    }
  }, 1000 + Math.random() * 2000)
}

function scrollToBottom() {
  setTimeout(() => {
    if (dmMessagesContainer.value) {
      dmMessagesContainer.value.scrollTop = dmMessagesContainer.value.scrollHeight
    }
  }, 100)
}

// --- Navigation Methods ---

// 下拉刷新
async function handleRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  // 模拟刷新：重新加载 store 数据 + 触发一次 AI 生成
  await weiboStore.initStore()
  setTimeout(() => {
    isRefreshing.value = false
    chatStore.triggerToast('刷新完成', 'success')
  }, 800)
}

// 触摸事件处理（下拉检测）
let touchStartY = 0

function onTouchStart(e) {
  touchStartY = e.touches[0].clientY
  const feedEl = document.querySelector('.feed')
  if (feedEl && feedEl.scrollTop <= 0) {
    isPulling.value = true
  }
}

function onTouchMove(e) {
  if (!isPulling.value || isRefreshing.value) return
  const deltaY = e.touches[0].clientY - touchStartY
  if (deltaY > 0) {
    const feedEl = document.querySelector('.feed')
    if (feedEl && feedEl.scrollTop <= 0) {
      pullDistance.value = Math.min(deltaY * 0.5, 80)
      e.preventDefault()
    }
  }
}

function onTouchEnd() {
  if (pullDistance.value > 50 && !isRefreshing.value) {
    handleRefresh()
  }
  isPulling.value = false
  pullDistance.value = 0
}

function switchView(viewName) {
  activeView.value = viewName
}

function switchSearchSub(subName) {
  activeSearchSub.value = subName
}

function goBack() {
  router.back()
}

function exitApp() {
  router.push('/')
}

// --- Topic Detail ---
function enterTopicDetail(title) {
  topicDetail.value = {
    title: title,
    bannerTitle: `#${title}#`
  }
  switchView('topic-detail')
}

function hideTopicDetail() {
  switchView('search')
}

// --- User Profile ---
function enterUserProfile(name, avatar) {
  viewedUserProfile.value = { name, avatar }
  switchView('user-profile')
}

function hideUserProfile() {
  // Simple history logic: go back to search or previous. 
  // For simplicity matching the prototype:
  switchView('search')
}

// --- DM Chat ---
function enterDMChat(name) {
  dmChat.value = { name }
  switchView('dm-chat')
}

function hideDMChat() {
  switchView('msg')
}

// --- Post Modal ---
function openPostModal(prefill = '') {
  postText.value = prefill
  showPostModal.value = true
}

function closePostModal() {
  showPostModal.value = false
}



// --- Share Logic ---
const showShareContactList = ref(false)

function openShareModal(post) {
  selectedPostToShare.value = post
  showShareContactList.value = false
  showShareModal.value = true
}

function sharePostTo(contactId) {
  if (!selectedPostToShare.value) return
  const post = selectedPostToShare.value
  const chatName = chatStore.chats[contactId]?.name || '好友'
  const cardContent = JSON.stringify({
    postId: post.id,
    author: post.author,
    avatar: post.avatar,
    content: post.content,
    image: post.images && post.images.length > 0 ? post.images[0] : null,
    summary: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '')
  })
  chatStore.addMessage(contactId, {
    role: 'user',
    type: 'weibo_card',
    content: cardContent
  })
  chatStore.triggerToast(`已分享给 ${chatName}`, 'success')
  closeShareModal()
  if (post.stats) post.stats.share++
}

async function shareToMoments() {
  if (!selectedPostToShare.value) return
  const post = selectedPostToShare.value
  const momentsStore = window.useMomentsStore?.()
  if (momentsStore) {
    await momentsStore.addMoment({
      authorId: 'user',
      content: post.content,
      images: post.images || []
    })
    chatStore.triggerToast('已分享到朋友圈', 'success')
  } else {
    chatStore.triggerToast('朋友圈模块未加载', 'warning')
  }
  closeShareModal()
  if (post.stats) post.stats.share++
}

async function copyShareLink() {
  if (!selectedPostToShare.value) return
  const post = selectedPostToShare.value
  const link = `${window.location.origin}/weibo/post/${post.id}`
  let success = false
  try {
    await navigator.clipboard.writeText(link)
    success = true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = link
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    success = true
  }
  if (success) {
    chatStore.triggerToast('链接已复制到剪贴板', 'success')
    if (post.stats) post.stats.share++
  }
  closeShareModal()
}

function generateShareImage() {
  if (!selectedPostToShare.value) return
  const post = selectedPostToShare.value
  chatStore.triggerToast('截图分享功能开发中', 'info')
  // 即使功能未完成，分享操作已触发，应计入统计
  if (post.stats) post.stats.share++
  closeShareModal()
}

function showContactList() {
  showShareContactList.value = true
}

function backToShareOptions() {
  showShareContactList.value = false
}

function closeShareModal() {
  showShareModal.value = false
  showShareContactList.value = false
  selectedPostToShare.value = null
}

// --- 转发功能 ---
function openRepostModal(post) {
  repostTargetPost.value = post
  repostCommentText.value = ''
  showRepostModal.value = true
}

function closeRepostModal() {
  showRepostModal.value = false
  repostTargetPost.value = null
  repostCommentText.value = ''
}

function handleRepost(post) {
  if (!repostCommentText.value.trim()) {
    // 直接转发（无评论文案）
    weiboStore.repost(post.id)
    chatStore.triggerToast('转发成功', 'success')
  } else {
    // 带评论转发
    weiboStore.repost(post.id, repostCommentText.value)
    chatStore.triggerToast('转发成功', 'success')
    repostCommentText.value = ''
  }
  closeRepostModal()
}

const myPostsCount = computed(() => weiboStore.posts.filter(p => p.authorId === 'me').length)

const filteredMyPosts = computed(() => {
  const posts = weiboStore.posts.filter(p => p.authorId === 'me')
  if (profileActiveTab.value === 'original') return posts
  if (profileActiveTab.value === 'video') return posts.filter(p => p.content.includes('视频') || (p.images && p.images.length > 0))
  return posts
})

const searchResults = computed(() => {
  if (!searchText.value.trim()) return []
  const term = searchText.value.toLowerCase()
  return weiboStore.posts.filter(p =>
    p.content.toLowerCase().includes(term) ||
    p.author.toLowerCase().includes(term)
  )
})

const searchResultUsers = computed(() => {
  if (!searchText.value.trim()) return []
  const term = searchText.value.toLowerCase()
  const uniqueAuthors = new Set()
  const users = []
  weiboStore.posts.forEach(p => {
    if (!uniqueAuthors.has(p.author) && p.author.toLowerCase().includes(term)) {
      uniqueAuthors.add(p.author)
      users.push({
        name: p.author,
        avatar: p.avatar,
        bio: '微博达人',
        fans: '10万+',
        isVip: p.isVip
      })
    }
  })
  const mockUsers = [
    { name: '数码快报', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechDaily', bio: '科技资讯第一线', fans: '120万', isVip: true },
    { name: '日常碎片收集', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daily', bio: '记录生活中的小确幸', fans: '5.2万', isVip: false },
  ]
  mockUsers.forEach(u => {
    if (!uniqueAuthors.has(u.name) && u.name.toLowerCase().includes(term)) {
      users.push(u)
      uniqueAuthors.add(u.name)
    }
  })
  return users
})

const searchResultTopics = computed(() => {
  if (!searchText.value.trim()) return []
  const term = searchText.value.toLowerCase()
  const mockTopics = [
    { title: 'Chilly的手机', image: 'https://picsum.photos/seed/topic1/100/100', reading: '1.2亿', discussion: '50万' },
    { title: 'Antigravity生态', image: 'https://picsum.photos/seed/topic2/100/100', reading: '8500万', discussion: '12万' },
    { title: '日常碎片', image: 'https://picsum.photos/seed/topic3/100/100', reading: '3200万', discussion: '8万' },
    { title: 'Chilly的假期', image: 'https://picsum.photos/seed/topic4/100/100', reading: '6800万', discussion: '15万' },
  ]
  return mockTopics.filter(t => t.title.toLowerCase().includes(term))
})

const emptyStateText = computed(() => {
  if (profileActiveTab.value === 'video') return '还没有发布过视频微博哦~'
  if (profileActiveTab.value === 'original') return '还没有发布过原创微博哦~'
  return '还没有发布过微博哦，去记录生活吧~'
})

const viewedUserPosts = computed(() => {
  return weiboStore.posts.filter(p => p.author === viewedUserProfile.value.name)
})

const viewedUserPostCount = computed(() => viewedUserPosts.value.length)

// 生成稳定的随机数（基于用户名hash），避免每次渲染都变
function stableRandom(name, min, max) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash |= 0
  }
  const seed = Math.abs(hash) % 10000 / 10000
  return (min + seed * (max - min)).toFixed(1)
}

const viewedUserFollowing = computed(() => stableRandom(viewedUserProfile.value.name || 'x', 0.5, 2.5))
const viewedUserFans = computed(() => stableRandom(viewedUserProfile.value.name || 'y', 5, 15))

function performSearch() {
  if (!searchText.value.trim()) return
  weiboStore.addSearchHistory(searchText.value)
  switchView('search-results')
}

function clearSearchHistory() {
  weiboStore.clearSearchHistory()
}

function searchFromHistory(term) {
  searchText.value = term
  performSearch()
}

function openSearchResults() {
  switchView('search-results')
  // Autofocus logic could go here if needed
}

function hideSearchResults() {
  switchView('search')
}

// --- Settings ---
function openSettings() {
  // Clone current store data to form
  settingsForm.value = JSON.parse(JSON.stringify({
    ...weiboStore.user,
    ...weiboStore.settings,
    timerFrequency: weiboStore.settings.timerFrequency || 30
  }))
  showSettingsModal.value = true
}

function saveSettings() {
  // Split form back into user and settings
  const { name, avatar, bio, region, following, fans, verified, verifyType, vipLevel, ...settingsRest } = settingsForm.value

  weiboStore.updateUserProfile({ name, avatar, bio, region, following, fans, verified, verifyType, vipLevel })

  // Clean up settings update (boundWorldBooks etc are handled directly usually, but if form has them:)
  weiboStore.updateSettings({
    timerEnabled: settingsRest.timerEnabled,
    timerFrequency: settingsRest.timerFrequency
    // arrays are usually handled by specific toggles, but here we sync if changed
  })

  showSettingsModal.value = false
}

function closeSettings() {
  showSettingsModal.value = false
}

// Settings Helpers
const fileInput = ref(null)
function triggerAvatarUpload() {
  fileInput.value.click()
}
function handleAvatarFile(e) {
  const file = e.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      settingsForm.value.avatar = ev.target.result
    }
    reader.readAsDataURL(file)
  }
}

// Binding Helpers
function isCharBound(id) {
  return weiboStore.settings.boundCharacters.includes(id)
}
function toggleCharBind(id) {
  weiboStore.toggleCharacterBinding(id)
}
function isBookBound(id) {
  return weiboStore.settings.boundWorldBooks.includes(id)
}
function toggleBookBind(id) {
  weiboStore.toggleWorldBook(id)
}

function clearCharPosts() {
  const charId = settingsForm.value.selectedCharToClear
  if (charId) {
    weiboStore.clearPostsByChar(charId)
    chatStore.triggerToast('已清空该角色的微博', 'success')
  }
}
function clearAll() {
  chatStore.triggerConfirm('清空内容', '确定要清空所有内容吗？不可恢复。', () => {
    weiboStore.clearAllPosts()
    chatStore.triggerToast('已清空所有内容', 'success')
  })
}

// --- Following ---
function openFollowing() {
  switchView('following')
}

function hideFollowing() {
  switchView('me')
}

// --- Listeners (Event Delegation replacement) ---
// In Vue we use @click on elements directly. 
// For delegated clicks (like "any avatar"), we can use a helper or bind specifically.
// Given the static nature of the prototype, we will bind directly where possible.

function onAvatarClick(name, avatarSrc) {
  enterUserProfile(name, avatarSrc)
}

function onTopicClick(title) {
  // Remove # if present for the title display, but keep consistent
  const cleanTitle = title.replace(/#/g, '')
  enterTopicDetail(cleanTitle)
}

function likePost(postId) {
  weiboStore.toggleLike(postId)
}

const activePostDetail = ref(null)

function openPostDetail(post) {
  activePostDetail.value = post
  document.body.style.overflow = 'hidden'
}

function closePostDetail() {
  activePostDetail.value = null
  document.body.style.overflow = ''
}

function toggleComments(postId) {
  if (activeCommentPostId.value === postId) {
    activeCommentPostId.value = null
  } else {
    activeCommentPostId.value = postId
  }
}

function likeComment(postId, commentIndex) {
  const post = weiboStore.posts.find(p => p.id === postId)
  if (post && post.comments && post.comments[commentIndex]) {
    const c = post.comments[commentIndex]
    if (!c.isLiked) {
      c.likes++
      c.isLiked = true
    } else {
      c.likes--
      c.isLiked = false
    }
  }
}

function deleteComment(postId, commentIndex) {
  const post = weiboStore.posts.find(p => p.id === postId)
  if (post && post.comments) {
    chatStore.triggerConfirm('删除评论', '确定删除这条评论吗？', () => {
      post.comments.splice(commentIndex, 1)
      if (post.stats) post.stats.comment--
      chatStore.triggerToast('评论已删除', 'success')
    })
  }
}

// --- AI Generator Logic (Using Store Methods) ---

async function handleGenerateEffect(targetPostId = null) {
  if (weiboStore.posts.length === 0) return chatStore.triggerToast('先发一条微博吧！', 'warning')

  // Pick a random post to comment on (prioritize recent ones)
  let targetPost = weiboStore.posts[0]
  if (targetPostId) {
    const found = weiboStore.posts.find(p => p.id === targetPostId)
    if (found) targetPost = found
  }

  // Visual Feedback: Spin the icon
  const btnIcon = document.querySelector('.fa-wand-magic-sparkles')
  if (btnIcon) btnIcon.classList.add('fa-spin')

  try {
    // 1. Generate Content via AI
    await weiboStore.generateComments(targetPost.id, 3)
  } catch (e) {
    console.error(e)
    chatStore.triggerToast('生成神评失败，请稍后再试', 'error')
  } finally {
    if (btnIcon) btnIcon.classList.remove('fa-spin')
  }
}

async function handleGenerateHotSearch() {
  const btnIcon = document.querySelector('.fa-fire-sparkles')
  if (btnIcon) btnIcon.classList.add('fa-spin')
  
  try {
    await weiboStore.generateHotSearch()
  } catch (e) {
    console.error(e)
    chatStore.triggerToast('生成热搜失败，请稍后再试', 'error')
  } finally {
    if (btnIcon) btnIcon.classList.remove('fa-spin')
  }
}

async function handleGenerateDM(dmName) {
  const btnIcon = document.querySelector('.msg-generate-btn .fa-wand-magic')
  if (btnIcon) btnIcon.classList.add('fa-spin')
  
  try {
    await weiboStore.generateDM(dmName)
  } catch (e) {
    console.error(e)
    chatStore.triggerToast('生成消息失败，请稍后再试', 'error')
  } finally {
    if (btnIcon) btnIcon.classList.remove('fa-spin')
  }
}


</script>

<template>
  <div class="weibo-app">
    <!-- View: Home -->
    <div v-show="activeView === 'home'" class="page-view active">
      <header>
        <div class="header-top">
          <div style="width: 60px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 14px;"
            @click="exitApp">
            <i class="fa-solid fa-chevron-left"></i> 返回
          </div>
          <div class="header-title">微博</div>
          <button class="ai-header-btn" @click="handleGenerateEffect">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI微博
          </button>
        </div>
        <div class="search-bar" @click="openSearchResults">
          <i class="fa-solid fa-search"></i>
          <span>大家都在搜：Chilly的手机上线了</span>
        </div>
        <div class="nav-tabs">
          <span>关注</span>
          <span class="active">推荐</span>
        </div>
      </header>
      <main class="feed" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
        <!-- 下拉刷新指示器 -->
        <div class="pull-refresh-indicator" :class="{ active: isRefreshing, pulling: pullDistance > 0 }"
          :style="{ transform: `translateY(${isRefreshing ? 40 : pullDistance}px)`, opacity: isRefreshing ? 1 : Math.min(pullDistance / 50, 1) }">
          <i class="fa-solid fa-rotate" :class="{ 'fa-spin': isRefreshing }" style="color: #ff8200; font-size: 18px;"></i>
          <span v-if="!isRefreshing">下拉刷新</span>
          <span v-else>正在刷新...</span>
        </div>
        <article v-for="post in weiboStore.posts" :key="post.id" class="post-card">
          <div class="post-header">
            <div class="user-info" @click="onAvatarClick(post.author, post.avatar)">
              <div class="avatar-container" style="position: relative; display: inline-block;">
                <img :src="post.avatar" class="user-avatar">
                <!-- Verification Badge for Post Author (ME) -->
                <img v-if="post.authorId === 'me' && userProfile.verified && userProfile.verifyType === '微博个人认证'"
                  src="/icons/weibo_verify_individual.png" class="verify-badge-img-small">
                <img
                  v-if="post.authorId === 'me' && userProfile.verified && (userProfile.verifyType === '微博官方认证' || userProfile.verifyType === '微博机构认证')"
                  src="/icons/weibo_verify_org.png" class="verify-badge-img-small">
                <!-- Simulation for specific other users if needed, or generic VIP logic -->
              </div>
              <div>
                <div class="user-name"
                  :class="{ 'vip-name': (post.authorId === 'me' && userProfile.vipLevel > 0) || (post.authorId !== 'me' && post.isVip) }">
                  {{ post.author }}
                  <!-- VIP Crown for Current User -->
                  <span v-if="post.authorId === 'me' && userProfile.vipLevel > 0" class="vip-crown"
                    :class="'level-' + userProfile.vipLevel">
                    <i class="fa-solid fa-crown"></i>
                    <span class="vip-level-num">{{ userProfile.vipLevel }}</span>
                  </span>
                  <!-- Static/Simulation VIP for Others -->
                  <span v-if="post.isVip && post.authorId !== 'me'" class="vip-crown level-5">
                    <i class="fa-solid fa-crown"></i>
                    <span class="vip-level-num">5</span>
                  </span>
                </div>
                <div class="user-meta">{{ post.time }} · {{ post.device || 'Weibo Client' }}</div>
              </div>
            </div>
            <div class="follow-btn" v-if="post.authorId !== 'me'">+ 关注</div>
          </div>
          <!-- Post Content (Click to Detail) -->
          <div class="post-content" @click="openPostDetail(post)">{{ post.content }}</div>
          <div class="post-images" :class="'grid-' + (post.images ? post.images.length : 0)"
            v-if="post.images && post.images.length" @click="openPostDetail(post)">
            <img v-for="(img, idx) in post.images" :key="idx" :src="img">
          </div>
          <!-- 转发卡片：展示被转发的原帖 -->
          <div class="post-repost-card" v-if="post.repostFrom" @click="openPostDetail(weiboStore.posts.find(p => p.id === post.repostFrom.id))">
            <div class="post-repost-author">{{ post.repostFrom.author }}</div>
            <div class="post-repost-content">{{ post.repostFrom.content }}</div>
            <div class="post-repost-images" v-if="post.repostFrom.images && post.repostFrom.images.length">
              <img v-for="(img, rIdx) in post.repostFrom.images.slice(0, 3)" :key="'r'+rIdx" :src="img">
            </div>
          </div>

          <div class="post-actions" v-if="post.stats">
            <div class="action-item" @click.stop="openShareModal(post)"><i class="fa-solid fa-share-nodes"></i> {{
              weiboStore.formatNumber(post.stats.share) }}</div>
            <div class="action-item" @click.stop="openRepostModal(post)"><i class="fa-solid fa-retweet"></i> 转发</div>
            <div class="action-item" @click.stop="toggleComments(post.id)"
              :class="{ 'active-action': activeCommentPostId === post.id }">
              <i class="fa-solid fa-comment-dots"></i> {{ weiboStore.formatNumber(post.stats.comment) }}
            </div>
            <div class="action-item" :class="{ 'liked': post.isLiked }" @click.stop="likePost(post.id)"><i
                class="fa-solid fa-heart"></i> {{ weiboStore.formatNumber(post.stats.like) }}</div>
          </div>

          <!-- Comment Section (Homepage Preview) -->
          <div class="comment-section" v-if="activeCommentPostId === post.id" style="padding-bottom:10px;">
            <div class="comment-list" v-if="post.comments && post.comments.length > 0">
              <!-- Limit to 3 items -->
              <div class="comment-item" v-for="(comment, cIdx) in post.comments.slice(0, 3)" :key="cIdx">
                <img :src="comment.avatar" class="comment-avatar">
                <div class="comment-body">
                  <div class="comment-user" :class="{ 'vip-name': comment.isVip }">
                    {{ comment.author }}
                    <span v-if="comment.isVip" class="vip-crown level-3"><i class="fa-solid fa-crown"></i></span>
                  </div>
                  <div class="comment-content-container">
                    <div class="comment-text" v-if="comment.content">{{ comment.content }}</div>
                    <img v-if="comment.sticker" :src="comment.sticker" class="sticker-img">
                    <div v-if="comment.image" class="comment-img-wrapper">
                      <img :src="comment.image" class="comment-block-img">
                      <div class="img-tag">图片</div>
                    </div>
                  </div>

                  <!-- Replies -->
                  <div class="replies-container" v-if="comment.replies && comment.replies.length">
                    <div class="reply-item" v-for="(reply, rIdx) in comment.replies" :key="rIdx"
                      @click="openPostDetail(post)">
                      <span class="reply-user" :class="{ 'vip-name': reply.isVip }">
                        {{ reply.author }}
                        <span v-if="reply.isAuthor" class="author-tag">作者</span>
                      </span>
                      <span class="reply-text">：{{ reply.content }}</span>
                    </div>
                  </div>

                  <div class="comment-footer">
                    <span class="comment-time">刚刚</span>
                    <div class="comment-actions">
                      <span @click.stop="openPostDetail(post)" class="reply-btn">
                        <i class="fa-regular fa-comment-dots"></i>
                      </span>
                      <span @click.stop="likeComment(post.id, cIdx)" :class="{ 'liked': comment.isLiked }">
                        <i class="fa-regular fa-thumbs-up" v-if="!comment.isLiked"></i>
                        <i class="fa-solid fa-thumbs-up" v-else></i>
                        {{ comment.likes || 0 }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- View More Button -->
              <div class="view-more-comments" v-if="post.comments.length > 3" @click="openPostDetail(post)">
                查看全部 {{ post.comments.length }} 条评论 >
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>

    <!-- Post Detail Modal (Full Screen) -->
    <div class="post-detail-overlay" v-if="activePostDetail">
      <div class="detail-header">
        <div class="back-btn" @click="closePostDetail"><i class="fa-solid fa-chevron-left"></i> 返回</div>
        <div class="detail-title">微博正文</div>
        <div class="detail-menu"><i class="fa-solid fa-ellipsis"></i></div>
      </div>
      <div class="detail-content">
        <!-- Re-render Post Content -->
        <div class="post-item detail-view-item">
          <div class="post-header">
            <div class="user-info">
              <div class="avatar-wrapper">
                <img :src="activePostDetail.avatar" class="user-avatar">
                <span class="verified-badge orange-v" v-if="activePostDetail.isVip"><i class="fa-solid fa-v"></i></span>
              </div>
              <div>
                <div class="user-name" :class="{ 'vip-name': activePostDetail.isVip }">
                  {{ activePostDetail.author }}
                  <span v-if="activePostDetail.isVip" class="vip-crown level-7">
                    <i class="fa-solid fa-crown"></i><span class="vip-num">7</span>
                  </span>
                </div>
                <div class="user-meta">{{ activePostDetail.time }} · iPhone 16 Pro Max</div>
              </div>
            </div>
            <div class="follow-btn" v-if="activePostDetail.authorId !== 'me'">+ 关注</div>
          </div>
          <div class="post-content">{{ activePostDetail.content }}</div>
          <div class="post-images" :class="'grid-' + (activePostDetail.images ? activePostDetail.images.length : 0)"
            v-if="activePostDetail.images && activePostDetail.images.length">
            <img v-for="(img, idx) in activePostDetail.images" :key="idx" :src="img">
          </div>

          <!-- Full Post Actions -->
          <div class="post-actions" v-if="activePostDetail.stats"
            style="margin-top:10px; border-bottom:1px solid #f0f0f0; padding-bottom:10px;">
            <div class="action-item" @click.stop="openShareModal(activePostDetail)"><i class="fa-solid fa-share-nodes"></i> {{
              weiboStore.formatNumber(activePostDetail.stats.share) }}</div>
            <div class="action-item" @click.stop="openRepostModal(activePostDetail)"><i class="fa-solid fa-retweet"></i> 转发</div>
            <div class="action-item"><i class="fa-solid fa-comment-dots"></i> {{
              weiboStore.formatNumber(activePostDetail.stats.comment) }}</div>
            <div class="action-item" :class="{ 'liked': activePostDetail.isLiked }"
              @click="likePost(activePostDetail.id)"><i class="fa-solid fa-heart"></i> {{
                weiboStore.formatNumber(activePostDetail.stats.like) }}</div>
          </div>

          <!-- Mention Bar -->
          <div class="mention-bar" @click="handleGenerateEffect(activePostDetail.id)">
            <i class="fa-solid fa-wand-magic-sparkles mention-icon"></i> 召唤 · 生成热议
          </div>

          <!-- Full Comment List -->
          <div class="comment-section show-all">
            <div class="comment-header-row">评论 {{ activePostDetail.comments ? activePostDetail.comments.length : 0 }}
            </div>
            <div class="comment-list" v-if="activePostDetail.comments && activePostDetail.comments.length > 0">
              <div class="comment-item" v-for="(comment, cIdx) in activePostDetail.comments" :key="cIdx">
                <img :src="comment.avatar" class="comment-avatar">
                <div class="comment-body">
                  <div class="comment-user" :class="{ 'vip-name': comment.isVip }">
                    {{ comment.author }}
                    <span v-if="comment.isVip" class="vip-crown level-3"><i class="fa-solid fa-crown"></i></span>
                  </div>
                  <div class="comment-content-container">
                    <div class="comment-text" v-if="comment.content">{{ comment.content }}</div>
                    <img v-if="comment.sticker" :src="comment.sticker" class="sticker-img">
                    <div v-if="comment.image" class="comment-img-wrapper">
                      <img :src="comment.image" class="comment-block-img">
                    </div>
                  </div>
                  <!-- Replies -->
                  <div class="replies-container" v-if="comment.replies && comment.replies.length">
                    <div class="reply-item" v-for="(reply, rIdx) in comment.replies" :key="rIdx"
                      @click="setReplyTarget(activePostDetail, comment, reply)">
                      <span class="reply-user" :class="{ 'vip-name': reply.isVip }">{{ reply.author }}</span>
                      <span class="reply-text">：{{ reply.content }}</span>
                    </div>
                  </div>
                  <div class="comment-footer">
                    <span class="comment-time">刚刚</span>
                    <div class="comment-actions">
                      <span @click="setReplyTarget(activePostDetail, comment)" class="reply-btn"><i
                          class="fa-regular fa-comment-dots"></i></span>
                      <span @click="likeComment(activePostDetail.id, cIdx)"><i class="fa-regular fa-thumbs-up"></i> {{
                        comment.likes }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Detail Input (Not Sticky) -->
      <div class="comment-input-area detail-input">
        <input type="text" v-model="commentInputText"
          :placeholder="activeReplyUser ? `回复@${activeReplyUser.name}:` : '发布你的评论...'"
          @keyup.enter="sendComment(activePostDetail.id)">
        <div class="send-comment-btn" @click="sendComment(activePostDetail.id)"
          :class="{ active: commentInputText.length > 0 }">发送</div>
      </div>
    </div>

    <!-- View: Hot Search (Trending) -->
    <div v-show="activeView === 'search'" class="page-view active">
      <header>
        <div class="header-top">
          <div style="width: 60px;"></div>
          <div class="header-title">热搜广场</div>
          <button class="ai-header-btn" @click="handleGenerateHotSearch">
            <i class="fa-solid fa-fire-sparkles"></i> AI热议
          </button>
        </div>
        <div class="search-bar" @click="openSearchResults">
          <i class="fa-solid fa-fire" style="color: #ff8200"></i>
          <span>搜热搜、找趣事</span>
        </div>
        <div class="nav-tabs">
          <span :class="{ active: activeSearchSub === 'hot' }" @click="switchSearchSub('hot')">热搜榜</span>
          <span :class="{ active: activeSearchSub === 'topic' }" @click="switchSearchSub('topic')">超话</span>
          <span :class="{ active: activeSearchSub === 'ent' }" @click="switchSearchSub('ent')">文娱榜</span>
        </div>
      </header>

      <div v-show="activeSearchSub === 'hot'" class="search-sub-view active">
        <main class="hot-list">
          <div class="hot-item" @click="onTopicClick('Chilly的手机正式上线')">
            <span class="hot-rank top">1</span>
            <span class="hot-title">Chilly的手机正式上线</span>
            <span class="hot-tag bao">爆</span>
            <span class="hot-meta">450万</span>
          </div>
          <div class="hot-item" @click="onTopicClick('如何评价 Antigravity 的 UI 设计')">
            <span class="hot-rank top">2</span>
            <span class="hot-title">如何评价 Antigravity 的 UI 设计</span>
            <span class="hot-tag xin">新</span>
            <span class="hot-meta">320万</span>
          </div>
          <div class="hot-item" @click="onTopicClick('大熊猫成功接机Chilly')">
            <span class="hot-rank top">3</span>
            <span class="hot-title">大熊猫成功接机Chilly</span>
            <span class="hot-tag re">热</span>
            <span class="hot-meta">280万</span>
          </div>
          <div class="hot-item" @click="onTopicClick('成都今日气温回升')">
            <span class="hot-rank">4</span>
            <span class="hot-title">成都今日气温回升</span>
            <span class="hot-tag xin">新</span>
            <span class="hot-meta">150万</span>
          </div>
        </main>

        <!-- Hot Search Square -->
        <section class="hot-square">
          <div style="padding: 15px 15px 5px; font-weight: bold; color: var(--wb-text-main); font-size: 15px;">
            <i class="fa-solid fa-shapes" style="color: var(--wb-orange); margin-right: 5px;"></i> 热搜广场
          </div>

          <article class="post-card" style="margin-top: 5px;">
            <div class="post-header">
              <div class="user-info"
                @click="onAvatarClick('数码快报', 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechDaily')">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=TechDaily" class="user-avatar">
                <div>
                  <div class="user-name">数码快报</div>
                  <div class="user-meta">刚刚 · 来自 微博视频号</div>
                </div>
              </div>
            </div>
            <div class="post-content">
              <a href="#" class="post-tag">#Chilly的手机正式上线#</a> 终于等到了！这一代系统流畅度简直无敌，尤其是那个 AI
              语音助手，聪明得不像话。测评视频已出，大家快来围观！
            </div>
            <div class="post-images grid-1">
              <div style="position:relative;">
                <img src="https://picsum.photos/seed/tech/800/450" style="filter: brightness(0.9);">
                <i class="fa-solid fa-play"
                  style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:40px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);"></i>
              </div>
            </div>
            <div class="post-actions">
              <div class="action-item"><i class="fa-solid fa-share-nodes"></i> 8k</div>
              <div class="action-item"><i class="fa-solid fa-comment-dots"></i> 1.5k</div>
              <div class="action-item"><i class="fa-solid fa-heart"></i> 12k</div>
            </div>
          </article>
        </section>
      </div>

      <div v-show="activeSearchSub === 'topic'" class="search-sub-view active">
        <main class="topic-list">
          <div class="topic-item" @click="onTopicClick('Chilly的手机')">
            <img src="https://picsum.photos/seed/topic1/100/100" class="topic-avatar">
            <div class="topic-info">
              <h4>#Chilly的手机#</h4>
              <p>1.2亿阅读 · 50万讨论</p>
            </div>
          </div>
          <div class="topic-item" @click="onTopicClick('Antigravity生态')">
            <img src="https://picsum.photos/seed/topic2/100/100" class="topic-avatar">
            <div class="topic-info">
              <h4>#Antigravity生态#</h4>
              <p>8500万阅读 · 12万讨论</p>
            </div>
          </div>
        </main>
      </div>

      <div v-show="activeSearchSub === 'ent'" class="search-sub-view active">
        <main class="hot-list">
          <div class="hot-item" @click="onTopicClick('某知名影星新戏开机')">
            <span class="hot-rank top">1</span>
            <span class="hot-title">某知名影星新戏开机</span>
            <span class="hot-tag re">热</span>
            <span class="hot-meta">220万</span>
          </div>
          <div class="hot-item" @click="onTopicClick('年度最佳单曲奖项公布')">
            <span class="hot-rank top">2</span>
            <span class="hot-title">年度最佳单曲奖项公布</span>
            <span class="hot-tag xin">新</span>
            <span class="hot-meta">180万</span>
          </div>
          <div class="hot-item" @click="onTopicClick('综艺《Chilly的假期》路透')">
            <span class="hot-rank top">3</span>
            <span class="hot-title">综艺《Chilly的假期》路透</span>
            <span class="hot-tag jian">荐</span>
            <span class="hot-meta">150万</span>
          </div>
        </main>
      </div>
    </div>

    <!-- View: Search Results -->
    <div v-show="activeView === 'search-results'" class="page-view active">
      <div class="topic-detail-header">
        <i class="fa-solid fa-chevron-left back-btn" @click="hideSearchResults"></i>
        <div
          style="flex: 1; background: #f2f2f2; border-radius: 20px; padding: 5px 15px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-search" style="color: #999;"></i>
          <input type="text" v-model="searchText" @keyup.enter="performSearch"
            style="border: none; background: transparent; outline: none; width: 100%;" placeholder="输入关键词搜索">
          <button v-if="searchText" class="search-go-btn" @click="performSearch">搜索</button>
        </div>
      </div>
      <main class="feed">
        <div v-if="!searchText" class="search-history-section">
          <div class="search-history-header">
            <span><i class="fa-solid fa-clock-rotate-left"></i> 搜索历史</span>
            <span class="search-clear-btn" @click="clearSearchHistory"><i class="fa-solid fa-trash-can"></i> 清空</span>
          </div>
          <div class="search-history-list">
            <div class="search-history-item" v-for="(term, idx) in weiboStore.searchHistory" :key="idx"
              @click="searchFromHistory(term)">
              <i class="fa-solid fa-clock-rotate-left history-icon"></i>
              <span>{{ term }}</span>
            </div>
          </div>
        </div>
        <template v-else>
          <div class="search-sub-tabs">
            <span class="search-sub-tab" :class="{ active: activeSearchResultTab === 'posts' }" @click="activeSearchResultTab = 'posts'">微博</span>
            <span class="search-sub-tab" :class="{ active: activeSearchResultTab === 'users' }" @click="activeSearchResultTab = 'users'">用户</span>
            <span class="search-sub-tab" :class="{ active: activeSearchResultTab === 'topics' }" @click="activeSearchResultTab = 'topics'">话题</span>
          </div>
          <div v-show="activeSearchResultTab === 'posts'" class="search-tab-content">
            <div style="padding: 12px 15px 5px; color: var(--wb-text-sub); font-size: 13px;">
              <i class="fa-solid fa-search" style="margin-right: 4px;"></i> "{{ searchText }}" 的相关微博
            </div>
            <article v-for="post in searchResults" :key="post.id" class="post-card">
              <div class="post-header">
                <div class="user-info" @click="onAvatarClick(post.author, post.avatar)">
                  <img :src="post.avatar" class="user-avatar">
                  <div>
                    <div class="user-name" :class="{ 'vip-name': post.isVip }">{{ post.author }}</div>
                    <div class="user-meta">{{ post.time }} · {{ post.device || 'Weibo Client' }}</div>
                  </div>
                </div>
              </div>
              <div class="post-content" @click="openPostDetail(post)">{{ post.content }}</div>
              <div class="post-images" :class="'grid-' + (post.images ? post.images.length : 0)" v-if="post.images && post.images.length" @click="openPostDetail(post)">
                <img v-for="(img, idx) in post.images" :key="idx" :src="img">
              </div>
              <div class="post-actions" v-if="post.stats">
                <div class="action-item" @click.stop="openShareModal(post)"><i class="fa-solid fa-share-nodes"></i> {{ weiboStore.formatNumber(post.stats.share) }}</div>
                <div class="action-item" @click.stop="openRepostModal(post)"><i class="fa-solid fa-retweet"></i> 转发</div>
                <div class="action-item"><i class="fa-solid fa-comment-dots"></i> {{ weiboStore.formatNumber(post.stats.comment) }}</div>
                <div class="action-item" :class="{ 'liked': post.isLiked }" @click.stop="likePost(post.id)"><i class="fa-solid fa-heart"></i> {{ weiboStore.formatNumber(post.stats.like) }}</div>
              </div>
            </article>
            <div v-if="searchResults.length === 0" class="search-empty-state">
              <i class="fa-regular fa-face-frown text-3xl mb-3"></i>
              <p>没有找到与 "{{ searchText }}" 相关的微博</p>
            </div>
          </div>
          <div v-show="activeSearchResultTab === 'users'" class="search-tab-content">
            <div style="padding: 12px 15px 5px; color: var(--wb-text-sub); font-size: 13px;">
              <i class="fa-solid fa-users" style="margin-right: 4px;"></i> "{{ searchText }}" 的相关用户
            </div>
            <div v-for="user in searchResultUsers" :key="user.name" class="search-user-result" @click="enterUserProfile(user.name, user.avatar)">
              <img :src="user.avatar" class="search-user-avatar">
              <div class="search-user-info">
                <div class="search-user-name" :class="{ 'vip-name': user.isVip }">{{ user.name }}</div>
                <div class="search-user-meta">{{ user.bio || '暂无简介' }} · {{ user.fans }} 粉丝</div>
              </div>
              <button class="search-follow-btn"><i class="fa-solid fa-plus"></i> 关注</button>
            </div>
            <div v-if="searchResultUsers.length === 0" class="search-empty-state">
              <i class="fa-solid fa-user-slash text-3xl mb-3"></i>
              <p>没有找到与 "{{ searchText }}" 相关的用户</p>
            </div>
          </div>
          <div v-show="activeSearchResultTab === 'topics'" class="search-tab-content">
            <div style="padding: 12px 15px 5px; color: var(--wb-text-sub); font-size: 13px;">
              <i class="fa-solid fa-hashtag" style="margin-right: 4px;"></i> "{{ searchText }}" 的相关话题
            </div>
            <div v-for="topic in searchResultTopics" :key="topic.title" class="search-topic-result" @click="enterTopicDetail(topic.title)">
              <img :src="topic.image" class="search-topic-avatar">
              <div class="search-topic-info">
                <div class="search-topic-name">#{{ topic.title }}#</div>
                <div class="search-topic-meta">{{ topic.reading }} 阅读 · {{ topic.discussion }} 讨论</div>
              </div>
            </div>
            <div v-if="searchResultTopics.length === 0" class="search-empty-state">
              <i class="fa-solid fa-hashtag text-3xl mb-3"></i>
              <p>没有找到与 "{{ searchText }}" 相关的话题</p>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- View: Messages (DMs) -->
    <div v-show="activeView === 'msg'" class="page-view active">
      <header
        style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-bottom: 1px solid var(--wb-divider);">
        <div style="width: 80px;"></div>
        <div style="font-weight: bold;">消息</div>
        <button class="ai-header-btn msg-generate-btn" @click="handleGenerateDM('系统通知')">
          <i class="fa-solid fa-wand-magic"></i> 生成回复
        </button>
      </header>
      <main class="msg-list">
        <div class="msg-item" @click="enterDMChat('系统通知')">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Friend1" class="user-avatar">
          <div class="msg-content">
            <div class="msg-top">
              <span class="msg-user">系统通知</span>
              <span class="msg-time">下午 2:30</span>
            </div>
            <div class="msg-text">您的账号被评为今日“最有才华博主”！</div>
          </div>
        </div>
        <div class="msg-item" @click="enterDMChat('小助手')">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Friend2" class="user-avatar">
          <div class="msg-content">
            <div class="msg-top">
              <span class="msg-user">小助手</span>
              <span class="msg-time">昨天</span>
            </div>
            <div class="msg-text">你有一条新的博文待审核，请点击查看详细信息。</div>
          </div>
        </div>
      </main>
    </div>

    <!-- View: Profile (Me) -->
    <div v-show="activeView === 'me'" class="page-view active">
      <div class="profile-header">
        <div class="profile-bg"></div>
        <div class="profile-top-bar" @click="openSettings">
          <i class="fa-solid fa-gear"></i>
        </div>
        <div class="profile-main">
          <div class="avatar-wrapper">
            <img :src="userProfile.avatar" class="profile-avatar">
            <img v-if="userProfile.verified && userProfile.verifyType === '微博个人认证'"
              src="/icons/weibo_verify_individual.png" class="verify-badge-avatar-img">
            <img
              v-if="userProfile.verified && (userProfile.verifyType === '微博官方认证' || userProfile.verifyType === '微博机构认证')"
              src="/icons/weibo_verify_org.png" class="verify-badge-avatar-img">
          </div>
          <div class="profile-name" :class="{ 'vip-name': userProfile.vipLevel > 0 }">
            {{ userProfile.name }}
            <span v-if="userProfile.vipLevel > 0" class="vip-crown" :class="'level-' + userProfile.vipLevel">
              <i class="fa-solid fa-crown"></i>
              <span class="vip-level-num">{{ userProfile.vipLevel }}</span>
            </span>
          </div>
          <div class="profile-id">{{ userProfile.bio }}</div>
          <div class="profile-stats">
            <div class="stat-item"><span class="stat-num">{{ myPostsCount }}</span><span class="stat-label">微博</span></div>
            <div class="stat-item" @click="openFollowing"><span class="stat-num">{{
              weiboStore.formatNumber(userProfile.following) }}</span><span class="stat-label">关注</span></div>
            <div class="stat-item"><span class="stat-num">{{ weiboStore.formatNumber(userProfile.fans) }}</span><span
                class="stat-label">粉丝</span></div>
          </div>
        </div>
      </div>
      <div class="profile-tabs">
        <div class="profile-tab" :class="{ active: profileActiveTab === 'all' }" @click="profileActiveTab = 'all'">
          <i class="fa-solid fa-list"></i> 全部
        </div>
        <div class="profile-tab" :class="{ active: profileActiveTab === 'original' }" @click="profileActiveTab = 'original'">
          <i class="fa-solid fa-pen-nib"></i> 原创
        </div>
        <div class="profile-tab" :class="{ active: profileActiveTab === 'video' }" @click="profileActiveTab = 'video'">
          <i class="fa-solid fa-video"></i> 视频
        </div>
      </div>
      <div class="my-posts-container">
        <article v-for="post in filteredMyPosts" :key="post.id" class="post-card">
          <div class="post-header">
            <div class="user-info">
              <div class="avatar-container" style="position: relative; display: inline-block;">
                <img :src="post.avatar" class="user-avatar">
              </div>
              <div>
                <div class="user-name" :class="{ 'vip-name': userProfile.vipLevel > 0 }">{{ post.author }}
                  <span v-if="userProfile.vipLevel > 0" class="vip-crown" :class="'level-' + userProfile.vipLevel">
                    <i class="fa-solid fa-crown"></i>
                    <span class="vip-level-num">{{ userProfile.vipLevel }}</span>
                  </span>
                </div>
                <div class="user-meta">{{ post.time }} · {{ post.device || 'iPhone 16 Pro Max' }}</div>
              </div>
            </div>
          </div>
          <div class="post-content" @click="openPostDetail(post)">{{ post.content }}</div>
          <div class="post-images" :class="'grid-' + (post.images ? post.images.length : 0)" v-if="post.images && post.images.length" @click="openPostDetail(post)">
            <img v-for="(img, idx) in post.images" :key="idx" :src="img">
          </div>
          <div class="post-actions" v-if="post.stats">
            <div class="action-item" @click.stop="openShareModal(post)"><i class="fa-solid fa-share-nodes"></i> {{ weiboStore.formatNumber(post.stats.share) }}</div>
            <div class="action-item" @click.stop="openRepostModal(post)"><i class="fa-solid fa-retweet"></i> 转发</div>
            <div class="action-item"><i class="fa-solid fa-comment-dots"></i> {{ weiboStore.formatNumber(post.stats.comment) }}</div>
            <div class="action-item" :class="{ 'liked': post.isLiked }" @click.stop="likePost(post.id)"><i class="fa-solid fa-heart"></i> {{ weiboStore.formatNumber(post.stats.like) }}</div>
          </div>
        </article>
        <div v-if="filteredMyPosts.length === 0" class="profile-empty-state">
          <i class="fa-solid fa-feather-pointed text-3xl mb-3"></i>
          <p>{{ emptyStateText }}</p>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div class="share-modal-overlay" v-if="showShareModal" @click.self="closeShareModal">
      <div class="share-sheet">
        <template v-if="!showShareContactList">
          <div class="share-header">分享微博</div>
          <div class="share-preview">
            <div class="share-preview-avatar">
              <img :src="selectedPostToShare?.avatar" class="share-preview-avatar-img">
            </div>
            <div class="share-preview-content">
              <div class="share-preview-author">{{ selectedPostToShare?.author }}</div>
              <div class="share-preview-text">{{ selectedPostToShare?.content?.substring(0, 60) }}...</div>
            </div>
          </div>
          <div class="share-options">
            <div class="share-option" @click="showContactList">
              <div class="share-option-icon" style="background: linear-gradient(135deg, #4cd964, #2ecc71);">
                <i class="fa-solid fa-paper-plane"></i>
              </div>
              <span>分享给好友</span>
            </div>
            <div class="share-option" @click="shareToMoments">
              <div class="share-option-icon" style="background: linear-gradient(135deg, #34c759, #30b350);">
                <i class="fa-solid fa-circle-nodes"></i>
              </div>
              <span>朋友圈</span>
            </div>
            <div class="share-option" @click="copyShareLink">
              <div class="share-option-icon" style="background: linear-gradient(135deg, #5ac8fa, #007aff);">
                <i class="fa-solid fa-link"></i>
              </div>
              <span>复制链接</span>
            </div>
            <div class="share-option" @click="generateShareImage">
              <div class="share-option-icon" style="background: linear-gradient(135deg, #ff9500, #ff3b30);">
                <i class="fa-solid fa-image"></i>
              </div>
              <span>生成海报</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="share-header share-header-back">
            <div class="share-back-btn" @click="backToShareOptions">
              <i class="fa-solid fa-chevron-left"></i>
            </div>
            <span>选择好友</span>
            <div style="width: 24px;"></div>
          </div>
          <!-- 联系人搜索框 -->
          <div class="share-contact-search">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" v-model="shareContactSearch" placeholder="搜索联系人..." class="share-search-input">
            <i v-if="shareContactSearch" class="fa-solid fa-xmark clear-icon" @click="shareContactSearch = ''"></i>
          </div>
          <!-- 最近联系人标记 + 列表 -->
          <div class="share-targets" :class="{ 'has-recent': !shareContactSearch }">
            <template v-if="!shareContactSearch && sortedShareContacts.length > 0 && sortedShareContacts[0].lastActive > 0">
              <div class="recent-label"><i class="fa-solid fa-clock"></i> 最近联系</div>
            </template>
            <div class="share-target-item"
              v-for="contact in sortedShareContacts"
              :key="contact.id"
              @click="sharePostTo(contact.id)"
              :class="{ 'is-recent': !shareContactSearch && contact.lastActive > 0 }">
              <img :src="contact.avatar" class="share-avatar">
              <span class="share-name">{{ contact.name }}</span>
              <span class="recent-dot" v-if="!shareContactSearch && contact.lastActive > 0"></span>
            </div>
            <div v-if="sortedShareContacts.length === 0" class="share-empty-contacts">
              <i class="fa-solid fa-user-group" style="font-size: 32px; color: #ddd; margin-bottom: 8px;"></i>
              <p>没有找到联系人</p>
            </div>
          </div>
        </template>
        <div class="share-cancel" @click="closeShareModal">取消</div>
      </div>
    </div>

    <!-- Post Modal -->
    <div class="post-modal" :class="{ active: showPostModal }">
      <div class="modal-header">
        <span @click="closePostModal" style="cursor: pointer; color: #666;">取消</span>
        <span style="font-weight: bold;">发微博</span>
        <button class="send-btn" :class="{ ready: postText.trim().length > 0 }">发布</button>
      </div>
      <div class="modal-content">
        <textarea class="post-textarea" v-model="postText" placeholder="分享新鲜事..."></textarea>
        <div class="post-toolbar">
          <div class="tool-item"><i class="fa-solid fa-image" style="color: #4cd964;"></i></div>
          <div class="tool-item ai"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
          <div class="tool-item"><i class="fa-solid fa-at" style="color: #5ac8fa;"></i></div>
          <div class="tool-item"><i class="fa-solid fa-hashtag" style="color: #ff9500;"></i></div>
          <div class="tool-item"><i class="fa-solid fa-face-smile" style="color: #ffcc00;"></i></div>
        </div>
        <div class="post-options">
          <div class="option-chip"><i class="fa-solid fa-location-dot" style="color: #4d73a1;"></i><span>添加地点</span>
          </div>
          <div class="option-chip"><i class="fa-solid fa-mobile-screen-button"></i><input type="text"
              placeholder="机型: iPhone 16 Pro Max"></div>
        </div>
      </div>
    </div>

    <!-- Repost Modal (转发弹窗) -->
    <div class="repost-modal-overlay" v-if="showRepostModal" @click.self="closeRepostModal">
      <div class="repost-sheet slideUp">
        <div class="repost-header">
          <span @click="closeRepostModal" style="cursor: pointer; color: #999; font-size: 14px;">取消</span>
          <span style="font-weight: bold; font-size: 17px;">转发微博</span>
          <button class="repost-send-btn" :class="{ active: true }" @click="handleRepost(repostTargetPost)">发送</button>
        </div>
        <!-- 原帖预览 -->
        <div class="repost-original-card" v-if="repostTargetPost">
          <div class="repost-original-header">
            <img :src="repostTargetPost.avatar" class="repost-avatar">
            <span class="repost-author">{{ repostTargetPost.author }}</span>
            <span class="repost-time">{{ repostTargetPost.time }}</span>
          </div>
          <div class="repost-original-content">{{ repostTargetPost.content }}</div>
          <div class="repost-original-images" v-if="repostTargetPost.images && repostTargetPost.images.length">
            <img v-for="(img, idx) in repostTargetPost.images.slice(0, 3)" :key="idx" :src="img" class="repost-thumb-img">
          </div>
        </div>
        <!-- 转发评论文本框 -->
        <div class="repost-input-area">
          <textarea class="repost-textarea" v-model="repostCommentText" placeholder="说说分享心得..." maxlength="200"></textarea>
          <div class="repost-input-footer">
            <span class="char-count" :class="{ warn: repostCommentText.length > 180 }">{{ repostCommentText.length }}/200</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <div class="nav-item" :class="{ active: activeView === 'home' }" @click="switchView('home')">
        <i class="fa-solid fa-house"></i>
        <span>微博</span>
      </div>
      <div class="nav-item" :class="{ active: activeView.includes('search') || activeView === 'topic-detail' }"
        @click="switchView('search')">
        <i class="fa-solid fa-magnifying-glass"></i>
        <span>热搜</span>
      </div>
      <div class="nav-item" @click="openPostModal('')">
        <div class="post-btn"><i class="fa-solid fa-plus"></i></div>
      </div>
      <div class="nav-item" :class="{ active: activeView === 'msg' || activeView === 'dm-chat' }"
        @click="switchView('msg')">
        <i class="fa-solid fa-paper-plane"></i>
        <span>消息</span>
      </div>
      <div class="nav-item"
        :class="{ active: activeView === 'me' || activeView === 'following' || activeView === 'user-profile' }"
        @click="switchView('me')">
        <i class="fa-solid fa-user"></i>
        <span>我</span>
      </div>
    </nav>

    <!-- Sub Views Managed as overlays or full pages but within context -->

    <!-- View: Topic Detail -->
    <div v-show="activeView === 'topic-detail'" class="page-view active">
      <div class="topic-detail-header">
        <i class="fa-solid fa-chevron-left back-btn" @click="hideTopicDetail"></i>
        <div style="font-weight: bold; font-size: 17px;">{{ topicDetail.title }}</div>
      </div>
      <div class="topic-info-banner">
        <h2>{{ topicDetail.bannerTitle }}</h2>
        <div class="topic-info-stats">
          <span>1.5亿 阅读</span>
          <span>85.4万 讨论</span>
        </div>
      </div>
      <main class="feed">
        <article class="post-card">
          <div class="post-header">
            <div class="user-info"
              @click="onAvatarClick('讨论达人A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Discussion1')">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Discussion1" class="user-avatar">
              <div>
                <div class="user-name">讨论达人A</div>
                <div class="user-meta">2分钟前 · 广东</div>
              </div>
            </div>
          </div>
          <div class="post-content">这就是大家都在讨论的话题吗？我觉得非常有意义，希望后续能有更多进展！</div>
        </article>
      </main>
    </div>

    <!-- View: Following List -->
    <div v-show="activeView === 'following'" class="page-view active">
      <div class="topic-detail-header">
        <i class="fa-solid fa-chevron-left back-btn" @click="hideFollowing"></i>
        <div style="font-weight: bold; font-size: 17px;">关注列表</div>
      </div>
      <main class="following-list">
        <div class="follow-item"
          @click="onAvatarClick('数码快报', 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechDaily')">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=TechDaily">
          <div class="follow-info">
            <h4>数码快报</h4>
            <p>数码领域的全能选手</p>
          </div>
          <div class="follow-status-btn">已关注</div>
        </div>
        <div class="follow-item"
          @click="onAvatarClick('讨论达人A', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Discussion1')">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Discussion1">
          <div class="follow-info">
            <h4>讨论达人A</h4>
            <p>热爱分享，热爱生活</p>
          </div>
          <div class="follow-status-btn">已关注</div>
        </div>
      </main>
    </div>

    <!-- View: User Profile (Generic) -->
    <div v-show="activeView === 'user-profile'" class="page-view active">
      <div class="topic-detail-header" style="position: absolute; background: transparent; border: none; color: white;">
        <i class="fa-solid fa-chevron-left back-btn" @click="hideUserProfile"></i>
      </div>
      <div class="profile-header">
        <div class="profile-bg" style="background: linear-gradient(to bottom, #4d73a1, #5ac8fa);"></div>
        <div class="profile-main">
          <img :src="viewedUserProfile.avatar" class="profile-avatar">
          <div class="profile-name">{{ viewedUserProfile.name }}</div>
          <div class="profile-id">微博达人 · 热爱生活</div>
          <div class="user-profile-actions">
            <button class="btn-follow">+ 关注</button>
            <button class="btn-chat" @click="enterDMChat(viewedUserProfile.name)">私信</button>
          </div>
          <div class="profile-stats">
            <div class="stat-item"><span class="stat-num">{{ viewedUserPostCount }}</span><span class="stat-label">微博</span></div>
            <div class="stat-item"><span class="stat-num">{{ viewedUserFollowing }}k</span><span class="stat-label">关注</span></div>
            <div class="stat-item"><span class="stat-num">{{ viewedUserFans }}k</span><span class="stat-label">粉丝</span></div>
          </div>
        </div>
      </div>
      <div class="viewed-user-posts">
        <div class="user-posts-header">
          <i class="fa-solid fa-feather-pointed"></i> Ta的微博
        </div>
        <article v-for="post in viewedUserPosts" :key="post.id" class="post-card">
          <div class="post-header">
            <div class="user-info">
              <img :src="post.avatar" class="user-avatar">
              <div>
                <div class="user-name" :class="{ 'vip-name': post.isVip }">{{ post.author }}
                  <span v-if="post.isVip" class="vip-crown level-5"><i class="fa-solid fa-crown"></i></span>
                </div>
                <div class="user-meta">{{ post.time }} · {{ post.device || 'Weibo Client' }}</div>
              </div>
            </div>
          </div>
          <div class="post-content" @click="openPostDetail(post)">{{ post.content }}</div>
          <div class="post-images" :class="'grid-' + (post.images ? post.images.length : 0)" v-if="post.images && post.images.length" @click="openPostDetail(post)">
            <img v-for="(img, idx) in post.images" :key="idx" :src="img">
          </div>
          <div class="post-actions" v-if="post.stats">
            <div class="action-item" @click.stop="openShareModal(post)"><i class="fa-solid fa-share-nodes"></i> {{ weiboStore.formatNumber(post.stats.share) }}</div>
            <div class="action-item" @click.stop="openRepostModal(post)"><i class="fa-solid fa-retweet"></i> 转发</div>
            <div class="action-item"><i class="fa-solid fa-comment-dots"></i> {{ weiboStore.formatNumber(post.stats.comment) }}</div>
            <div class="action-item" :class="{ 'liked': post.isLiked }" @click.stop="likePost(post.id)"><i class="fa-solid fa-heart"></i> {{ weiboStore.formatNumber(post.stats.like) }}</div>
          </div>
        </article>
        <div v-if="viewedUserPosts.length === 0" class="profile-empty-state">
          <i class="fa-solid fa-wind text-3xl mb-3"></i>
          <p>暂无微博</p>
        </div>
      </div>
    </div>

    <!-- View: DM Chat Window -->
    <div v-show="activeView === 'dm-chat'" class="page-view active">
      <div class="chat-window">
        <div class="chat-header">
          <i class="fa-solid fa-chevron-left back-btn" @click="hideDMChat"></i>
          <div style="font-weight: bold; font-size: 17px;">{{ dmChat.name }}</div>
        </div>
        <div class="chat-messages" ref="dmMessagesContainer">
          <div v-for="(dm, idx) in currentDMMessages" :key="idx" class="bubble" :class="dm.isMine ? 'sent' : 'received'">
            <div class="bubble-avatar" v-if="!dm.isMine">
              <img :src="dm.avatar" class="bubble-avatar-img">
            </div>
            <div class="bubble-content">
              {{ dm.content }}
              <div class="bubble-time">{{ dm.timeStr }}</div>
            </div>
          </div>
          <div v-if="currentDMMessages.length === 0" class="chat-empty">
            <i class="fa-regular fa-comments text-3xl mb-2"></i>
            <p>开始你们的对话吧</p>
          </div>
        </div>
        <div class="chat-footer">
          <i class="fa-solid fa-microphone" style="font-size: 20px; color: #666; cursor: pointer;"></i>
          <input type="text" class="chat-input" v-model="dmInputText" placeholder="输入消息..." @keyup.enter="sendDMMessage">
          <i class="fa-solid fa-face-smile" style="font-size: 20px; color: #666; cursor: pointer;"></i>
          <button class="dm-send-btn" :class="{ active: dmInputText.trim().length > 0 }" @click="sendDMMessage">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div class="settings-modal" :class="{ active: showSettingsModal }">
      <div class="settings-header">
        <span style="font-weight: bold; font-size: 17px;">设置</span>
        <i class="fa-solid fa-xmark" @click="closeSettings" style="font-size: 20px; color: #999; cursor: pointer;"></i>
      </div>

      <div class="settings-tabs">
        <div class="tab-item" :class="{ active: settingsTab === 'profile' }" @click="settingsTab = 'profile'">
          基本信息
        </div>
        <div class="tab-item" :class="{ active: settingsTab === 'binding' }" @click="settingsTab = 'binding'">
          绑定与数据
        </div>
      </div>

      <div class="settings-content" v-if="settingsTab === 'profile'">
        <div class="settings-group">
          <div class="avatar-edit" @click="triggerAvatarUpload">
            <img :src="settingsForm.avatar" class="edit-avatar">
            <div class="edit-overlay"><i class="fa-solid fa-camera"></i></div>
            <input type="file" ref="fileInput" @change="handleAvatarFile" style="display:none" accept="image/*">
          </div>

          <div class="form-row">
            <label>微博名</label>
            <input type="text" v-model="settingsForm.name" placeholder="设置你的微博名">
          </div>
          <div class="form-row">
            <label>头像URL</label>
            <input type="text" v-model="settingsForm.avatar" placeholder="或者输入图片链接">
          </div>
          <div class="form-row">
            <label>个人简介</label>
            <input type="text" v-model="settingsForm.bio" placeholder="虚拟网友眼中的我">
          </div>
          <div class="form-row">
            <label>地区</label>
            <input type="text" v-model="settingsForm.region" placeholder="虚拟网友眼中我的所在地">
          </div>
        </div>

        <div class="settings-group">
          <div class="form-row split">
            <div class="split-item">
              <label>初始关注</label>
              <input type="number" v-model="settingsForm.following">
            </div>
            <div class="split-item">
              <label>初始粉丝</label>
              <input type="number" v-model="settingsForm.fans">
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="form-row switch-row">
            <label>认证身份 (公众人物)</label>
            <label class="switch">
              <input type="checkbox" v-model="settingsForm.verified">
              <span class="slider round"></span>
            </label>
          </div>
          <div class="cert-options" v-if="settingsForm.verified">
            <div class="cert-chip" :class="{ active: settingsForm.verifyType === '微博个人认证' }"
              @click="settingsForm.verifyType = '微博个人认证'">个人认证</div>
            <div class="cert-chip" :class="{ active: settingsForm.verifyType === '微博官方认证' }"
              @click="settingsForm.verifyType = '微博官方认证'">官方认证</div>
            <div class="cert-chip" :class="{ active: settingsForm.verifyType === '微博机构认证' }"
              @click="settingsForm.verifyType = '微博机构认证'">机构认证</div>
          </div>
        </div>

        <!-- VIP Level -->
        <div class="settings-group">
          <div class="form-row">
            <label>VIP等级</label>
            <div class="vip-selector">
              <span v-for="level in 7" :key="level" class="vip-level-btn"
                :class="{ active: settingsForm.vipLevel >= level }" @click="settingsForm.vipLevel = level">
                {{ level }}
              </span>
              <span class="vip-level-btn none" :class="{ active: settingsForm.vipLevel === 0 }"
                @click="settingsForm.vipLevel = 0">
                无
              </span>
            </div>
          </div>
          <div class="vip-preview" v-if="settingsForm.vipLevel > 0">
            <span class="vip-crown" :class="'level-' + settingsForm.vipLevel">
              <i class="fa-solid fa-crown"></i>
            </span>
            <span style="color: #ff8200; font-weight: bold;">{{ settingsForm.name || '用户名' }}</span>
            <span style="color: #999; font-size: 12px; margin-left: 8px;">VIP{{ settingsForm.vipLevel }} 预览</span>
          </div>
        </div>
      </div>

      <!-- Share to Chat Modal -->
      <div class="share-modal-overlay" v-if="showShareModal" @click.self="showShareModal = false">
        <div class="share-sheet">
          <div class="share-header">分享给好友</div>
          <div class="share-targets">
            <!-- Reuse chatStore contacts -->
            <div class="share-target-item" v-for="contact in chatStore.contactList" :key="contact.id"
              @click="sharePostTo(contact.id)">
              <img :src="contact.avatar" class="share-avatar">
              <span class="share-name">{{ contact.name }}</span>
            </div>
          </div>
          <div class="share-cancel" @click="showShareModal = false">取消</div>
        </div>
      </div>

      <div class="settings-content" v-if="settingsTab === 'binding'">
        <!-- World Book Binding -->
        <div class="settings-group">
          <div class="group-title"><i class="fa-solid fa-book"></i> 世界书绑定 (文风/设定)</div>
          <div class="binding-list">
            <div class="binding-item" v-for="book in worldBookStore.books" :key="book.id"
              :class="{ active: isBookBound(book.id) }" @click="toggleBookBind(book.id)">
              <i class="fa-solid fa-book-journal-whills"></i>
              <span>{{ book.name }}</span>
              <i class="fa-solid fa-check checkmark" v-if="isBookBound(book.id)"></i>
            </div>
            <div v-if="worldBookStore.books.length === 0" style="color: #999; font-size: 13px; padding: 10px;">
              暂无世界书，请去世界书APP创建
            </div>
          </div>
        </div>

        <!-- Character Binding -->
        <div class="settings-group">
          <div class="group-title"><i class="fa-solid fa-users"></i> 角色绑定 (允许发博)</div>
          <div class="char-grid">
            <div class="char-select-item" v-for="char in chatStore.contactList" :key="char.id"
              :class="{ active: isCharBound(char.id) }" @click="toggleCharBind(char.id)">
              <img :src="char.avatar" class="char-avatar-mini">
              <span class="char-name-mini">{{ char.name }}</span>
              <div class="select-tick" v-if="isCharBound(char.id)"><i class="fa-solid fa-check"></i></div>
            </div>
          </div>
        </div>

        <!-- Automation -->
        <div class="settings-group">
          <div class="form-row switch-row">
            <label><i class="fa-solid fa-clock"></i> 定时发微博</label>
            <label class="switch">
              <input type="checkbox" v-model="settingsForm.timerEnabled">
              <span class="slider round"></span>
            </label>
          </div>
          <div class="info-tip" v-if="settingsForm.timerEnabled">
            <div style="margin-bottom:8px;">系统将自动让已绑定的角色发布生活动态</div>
            <div class="form-row" style="background:none; padding:10px 0 0; border:none; justify-content: flex-start;">
              <label style="width:auto; font-size:12px; color:#888; font-weight:normal;">频率(分钟):</label>
              <input type="number" v-model="settingsForm.timerFrequency" class="freq-input" placeholder="30">
            </div>
          </div>
        </div>

        <!-- Data Management -->
        <div class="settings-group warning">
          <div class="group-title" style="color: #e6162d;"><i class="fa-solid fa-triangle-exclamation"></i> 数据管理</div>

          <div class="form-row">
            <label>清空特定角色微博</label>
            <select v-model="settingsForm.selectedCharToClear"
              style="flex: 1; padding: 5px; margin-left: 10px; border-radius: 5px; border: 1px solid #ddd;">
              <option value="" disabled>选择角色</option>
              <option v-for="char in chatStore.contactList" :key="char.id" :value="char.id">{{ char.name }}</option>
              <option value="me">我自己 (Chilly)</option>
            </select>
            <button @click="clearCharPosts" class="btn-mini-danger">清空</button>
          </div>

          <button class="btn-block-danger" @click="clearAll">
            <i class="fa-solid fa-trash-can"></i> 清空所有微博内容
          </button>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn-cancel" @click="closeSettings">取消</button>
        <button class="btn-save" @click="saveSettings">保存设置</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.weibo-app {
  --wb-orange: #ff8200;
  --wb-red: #e6162d;
  --wb-bg: #f2f2f2;
  --wb-card-bg: #ffffff;
  --wb-text-main: #333333;
  --wb-text-sub: #939393;
  --wb-link: #4d73a1;
  --wb-divider: #efefef;
  --glass: rgba(255, 255, 255, 0.9);

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--wb-bg);
  color: var(--wb-text-main);
  line-height: 1.5;
  height: 100vh;
  overflow-y: auto;
  position: relative;
  width: 100%;
}



/* Reusing scoped specific styles mostly */
header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 8px 15px;
}

.search-bar {
  background: #ededed;
  border-radius: 20px;
  padding: 8px 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--wb-text-sub);
  font-size: 14px;
  margin-bottom: 8px;
  cursor: pointer;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 40px;
  font-size: 16px;
  font-weight: 500;
  color: var(--wb-text-sub);
  padding: 5px 0;
}

.nav-tabs span.active {
  color: var(--wb-text-main);
  font-weight: bold;
  position: relative;
}

.nav-tabs span.active::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 25px;
  height: 3px;
  background: var(--wb-orange);
  border-radius: 10px;
}

.page-view {
  min-height: 100vh;
  padding-bottom: 70px;
  animation: fadeIn 0.3s ease-out;
}

.page-view.active {
  display: block;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.post-card {
  background: var(--wb-card-bg);
  margin-top: 10px;
  padding: 15px;
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.user-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-weight: bold;
  font-size: 15px;
}

.user-meta {
  font-size: 11px;
  color: var(--wb-text-sub);
}

.follow-btn {
  color: var(--wb-orange);
  font-size: 13px;
  font-weight: bold;
  border: 1px solid var(--wb-orange);
  padding: 2px 10px;
  border-radius: 15px;
}

.post-content {
  font-size: 16px;
  margin-bottom: 10px;
}

.post-tag {
  color: var(--wb-link);
  text-decoration: none;
}

.post-images img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}

.post-actions {
  display: flex;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px solid var(--wb-divider);
  color: var(--wb-text-sub);
  font-size: 13px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.action-item:hover {
  color: var(--wb-orange);
  transform: scale(1.05);
}

/* 点赞状态 — 心跳+红色 */
.action-item.liked {
  color: #fe2c55;
}

.action-item.liked i.fa-heart {
  color: #fe2c55;
  animation: heartBurst 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 点赞时的心形爆发动画 */
@keyframes heartBurst {
  0% { transform: scale(1); }
  15% { transform: scale(1.4) rotate(-5deg); }
  30% { transform: scale(1.2) rotate(3deg); }
  45% { transform: scale(1.35) rotate(-2deg); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

/* 分享按钮点击弹跳 */
.action-item:active i.fa-share-nodes {
  animation: shareBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes shareBounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.3) translateY(-3px) rotate(8deg); }
  50% { transform: scale(1.1) translateY(-1px) rotate(-3deg); }
  70% { transform: scale(1.2) translateY(-2px) rotate(2deg); }
  100% { transform: scale(1) translateY(0) rotate(0); }
}

/* 评论按钮激活时的抖动效果 */
.action-item.active-action {
  color: #ff8200;
}

.action-item.active-action i.fa-comment-dots {
  animation: commentWiggle 0.4s ease-in-out;
}

@keyframes commentWiggle {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-12deg) scale(1.15); }
  40% { transform: rotate(10deg) scale(1.1); }
  60% { transform: rotate(-6deg) scale(1.05); }
  80% { transform: rotate(3deg); }
}

/* 点赞数字滚动效果 */
.action-item.liked + .action-item span,
.action-item.liked span {
  font-weight: 600;
}

/* 点赞时的心形粒子爆发（伪元素实现） */
.action-item.liked::before,
.action-item.liked::after {
  content: '❤';
  position: absolute;
  font-size: 10px;
  color: #fe2c55;
  pointer-events: none;
  opacity: 0;
}

.action-item.liked::before {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  animation: floatUp1 0.7s ease-out forwards;
}

.action-item.liked::after {
  bottom: -5px;
  left: 55%;
  animation: floatUp2 0.6s ease-out 0.1s forwards;
}

@keyframes floatUp1 {
  0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(0.8); }
  100% { opacity: 0; transform: translateX(-60%) translateY(-25px) scale(1.3) rotate(15deg); }
}

@keyframes floatUp2 {
  0% { opacity: 1; transform: translateY(0) scale(0.8); }
  100% { opacity: 0; transform: translateX(10px) translateY(-18px) scale(1.1) rotate(-12deg); }
}

/* ===== 下拉刷新 ===== */
.pull-refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
  font-size: 13px;
  color: #999;
}

.pull-refresh-indicator.active {
  height: 40px !important;
  opacity: 1 !important;
}

.pull-refresh-indicator.pulling {
  height: 40px;
}

main.feed {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS 惯性滚动 */
}

/* Hot List */
.hot-list {
  background: white;
  padding: 0 15px;
}

/* 热搜数字滚动效果（每次热搜更新时触发） */
.hot-meta {
  display: inline-block;
  transition: all 0.4s ease-out;
}

.hot-item {
  position: relative;
}

.hot-item .hot-meta.animate-in {
  animation: countUp 0.5s ease-out;
}

@keyframes countUp {
  0% { opacity: 0; transform: translateY(8px); }
  60% { transform: translateY(-2px); }
  100% { opacity: 1; transform: translateY(0); }
}

.hot-item {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid var(--wb-divider);
  gap: 15px;
  cursor: pointer;
}

.hot-rank {
  font-size: 16px;
  font-weight: bold;
  color: #ffb11a;
  width: 24px;
  text-align: center;
}

.hot-rank.top {
  color: #fe2d46;
}

.hot-title {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
}

.hot-tag {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  color: white;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.hot-tag.hot {
  background: #ff4d4f;
}

.hot-tag.bao {
  background: linear-gradient(135deg, #ff3b30, #ff6b6b);
  box-shadow: 0 1px 3px rgba(255, 59, 48, 0.4);
}

.hot-tag.xin {
  background: linear-gradient(135deg, #ff9500, #ffb11a);
  box-shadow: 0 1px 3px rgba(255, 149, 0, 0.4);
}

.hot-tag.re {
  background: linear-gradient(135deg, #fe2d46, #ff6b6b);
  box-shadow: 0 1px 3px rgba(254, 45, 70, 0.3);
}

.hot-tag.jian {
  background: #5ac8fa;
}

.hot-tag.zhi {
  background: #34c759;
}

.hot-meta {
  font-size: 11px;
  color: var(--wb-text-sub);
  margin-left: 5px;
}

/* Nav */
nav.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--glass);
  backdrop-filter: blur(25px);
  display: flex;
  justify-content: space-around;
  height: 60px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 200;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--wb-text-main);
  font-size: 10px;
  width: 20%;
  cursor: pointer;
}

.nav-item i {
  font-size: 22px;
  margin-bottom: 2px;
}

.nav-item.active {
  color: var(--wb-orange);
}

.post-btn {
  width: 44px;
  height: 44px;
  background: var(--wb-orange);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  margin-top: -10px;
  box-shadow: 0 4px 12px rgba(255, 130, 0, 0.4);
}

/* AI Button */
.ai-header-btn {
  background: linear-gradient(135deg, #a855f7, #ec4899);
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3);
  white-space: nowrap;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 12px 15px 0;
}

.header-title {
  font-weight: bold;
  font-size: 17px;
  flex: 1;
  text-align: center;
}

/* Modals */
.post-modal {
  position: fixed;
  top: 28px;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 2000;
  display: none;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.post-modal.active {
  display: flex;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid var(--wb-divider);
  flex-shrink: 0;
}

.modal-content {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  overflow-x: hidden;
}

.post-textarea {
  width: 100%;
  height: 200px;
  border: none;
  outline: none;
  font-size: 17px;
  resize: none;
  font-family: inherit;
  padding-bottom: 10px;
}

.post-toolbar {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 10px 0;
  color: #666;
  border-top: 1px solid #f2f2f2;
}

.post-options {
  margin-top: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.option-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f2f2f2;
  border-radius: 20px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}

.option-chip input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  width: 100px;
  color: #333;
}

.send-btn {
  background: var(--wb-orange);
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  opacity: 0.5;
}

.send-btn.ready {
  opacity: 1;
}

/* ===== 转发弹窗 ===== */
.repost-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2001;
  display: flex;
  align-items: flex-end;
}

.repost-sheet {
  width: 100%;
  max-height: 80vh;
  background: white;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.repost-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 15px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.repost-send-btn {
  padding: 5px 16px;
  border-radius: 16px;
  background: #ff8200;
  color: white;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.repost-send-btn:hover { opacity: 0.85; }

/* 原帖预览卡片 */
.repost-original-card {
  margin: 12px 15px;
  padding: 10px 12px;
  background: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 8px;
}

.repost-original-header {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

.repost-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.repost-author {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.repost-time {
  font-size: 11px;
  color: #999;
  margin-left: auto;
}

.repost-original-content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  word-break: break-all;
}

.repost-original-images {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  overflow: hidden;
}

.repost-thumb-img {
  width: 70px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

/* 转发输入区 */
.repost-input-area {
  padding: 10px 15px 15px;
}

.repost-textarea {
  width: 100%;
  min-height: 60px;
  max-height: 120px;
  border: none;
  outline: none;
  font-size: 15px;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}

.repost-input-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 5px;
}

.char-count {
  font-size: 11px;
  color: #ccc;
}

.char-count.warn { color: #ff8200; }

/* 转发微博卡片（信息流中展示） */
.post-repost-card {
  margin-top: 8px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  position: relative;
}

.post-repost-card::before {
  content: '';
  position: absolute;
  left: 24px;
  top: -6px;
  width: 10px;
  height: 10px;
  background: #fafafa;
  border-left: 1px solid #f0f0f0;
  border-top: 1px solid #f0f0f0;
  transform: rotate(45deg);
}

.post-repost-author {
  font-size: 13px;
  font-weight: 600;
  color: #576b95;
  margin-bottom: 4px;
}

.post-repost-content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  word-break: break-all;
}

.post-repost-images {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.post-repost-images img {
  width: 90px;
  height: 65px;
  object-fit: cover;
  border-radius: 4px;
}

.search-sub-view {
  display: none;
}

.search-sub-view.active {
  display: block;
}

.topic-item {
  display: flex;
  align-items: center;
  padding: 15px;
  gap: 12px;
  border-bottom: 1px solid var(--wb-divider);
  cursor: pointer;
}

.topic-avatar {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  object-fit: cover;
}

.topic-detail-header {
  background: white;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  position: sticky;
  top: 0;
  z-index: 110;
  border-bottom: 1px solid var(--wb-divider);
}

.back-btn {
  font-size: 20px;
  color: var(--wb-text-main);
  cursor: pointer;
}

.topic-info-banner {
  background: white;
  padding: 20px 15px;
  margin-bottom: 10px;
}

.topic-info-banner h2 {
  font-size: 20px;
  margin-bottom: 8px;
  color: var(--wb-orange);
}

.topic-info-stats {
  font-size: 13px;
  color: var(--wb-text-sub);
  display: flex;
  gap: 20px;
}

/* Settings Modal */
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f2f2f2;
  z-index: 1100;
  display: none;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-modal.active {
  display: flex;
}

.settings-header {
  background: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--wb-divider);
  position: sticky;
  top: 0;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px 0;
}

.settings-section {
  background: white;
  margin-bottom: 15px;
  padding: 0 15px;
}

.form-group {
  display: flex;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #f9f9f9;
}

.form-label {
  width: 90px;
  font-size: 15px;
  color: #333;
}

.form-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  text-align: right;
  color: #666;
}

.cert-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 0 15px;
}

.cert-btn {
  border: 1px solid #ddd;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

.cert-btn.active {
  background: #fff0e0;
  color: var(--wb-orange);
  border-color: var(--wb-orange);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 15px;
  background: white;
}

.action-sub-btn {
  background: #f8f8f8;
  border: 1px solid #eeeeee;
  padding: 12px 5px;
  border-radius: 8px;
  text-align: center;
  font-size: 12px;
  color: #555;
  cursor: pointer;
}

.footer-btns {
  padding: 20px 15px;
  display: flex;
  gap: 15px;
}

.footer-btns button {
  flex: 1;
  padding: 12px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  border: none;
}

.btn-cancel {
  background: #e0e0e0;
  color: #666;
}

.btn-save {
  background: var(--wb-orange);
  color: white;
}

/* Following List */
.following-list {
  background: white;
}

.follow-item {
  display: flex;
  align-items: center;
  padding: 15px;
  gap: 12px;
  border-bottom: 1px solid var(--wb-divider);
  cursor: pointer;
}

.follow-item img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.follow-info {
  flex: 1;
}

.follow-info h4 {
  font-size: 15px;
  font-weight: bold;
}

.follow-info p {
  font-size: 12px;
  color: var(--wb-text-sub);
  margin-top: 2px;
}

.follow-status-btn {
  border: 1px solid #ddd;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 13px;
  color: #999;
}

/* User Profile */
.user-profile-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  width: 100%;
  padding: 0 40px;
}

.user-profile-actions button {
  flex: 1;
  padding: 8px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  border: 1px solid var(--wb-orange);
}

.btn-follow {
  background: var(--wb-orange);
  color: white;
}

.btn-chat {
  background: white;
  color: var(--wb-orange);
}

.profile-header {
  background: white;
  padding: 20px;
  position: relative;
  border-bottom: 1px solid var(--wb-divider);
}

.profile-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: linear-gradient(to bottom, #ff8200, #ffb200);
  z-index: 0;
}

.profile-top-bar {
  position: absolute;
  top: 15px;
  right: 20px;
  z-index: 10;
  color: white;
  font-size: 20px;
  cursor: pointer;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.profile-main {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 60px;
}

.profile-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.profile-name {
  font-size: 22px;
  margin-top: 12px;
  font-weight: bold;
  color: var(--wb-text-main);
}

.profile-id {
  font-size: 13px;
  color: var(--wb-text-sub);
  margin-bottom: 5px;
}

.profile-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin: 20px 0 10px;
  width: 100%;
}

.stat-item {
  text-align: center;
  cursor: pointer;
}

.stat-num {
  font-weight: bold;
  font-size: 18px;
  display: block;
  color: var(--wb-text-main);
}

.stat-label {
  font-size: 12px;
  color: var(--wb-text-sub);
}

/* Chat Window */
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2f2f2;
}

.chat-header {
  background: white;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  border-bottom: 1px solid var(--wb-divider);
}

.chat-messages {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.4;
  position: relative;
}

.bubble.received {
  align-self: flex-start;
  background: white;
  color: #333;
  border-bottom-left-radius: 4px;
}

.bubble.sent {
  align-self: flex-end;
  background: var(--wb-orange);
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-footer {
  background: white;
  padding: 10px 15px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--wb-divider);
}

.chat-input {
  flex: 1;
  background: #f5f5f5;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  outline: none;
  font-size: 15px;
}

/* Messages List */
.msg-list {
  background: white;
}

.msg-item {
  display: flex;
  padding: 15px;
  gap: 12px;
  border-bottom: 1px solid var(--wb-divider);
  cursor: pointer;
}

.msg-content {
  flex: 1;
}

.msg-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.msg-user {
  font-weight: bold;
  font-size: 15px;
}

.msg-time {
  font-size: 11px;
  color: var(--wb-text-sub);
}

.msg-text {
  font-size: 13px;
  color: var(--wb-text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 250px;
}


/* Modern Settings Design */
.settings-modal {
  /* ... existing placement styles assumed preserved in parent ... */
  background: #f5f5f7;
  /* iOS System Gray */
}

.settings-header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.1);
  padding: 15px 20px;
}

.settings-tabs {
  background: white;
  padding: 5px 15px 0;
  display: flex;
  gap: 20px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.05);
}

.tab-item {
  padding: 12px 10px;
  font-size: 15px;
  font-weight: 500;
  color: #8daabf;
  position: relative;
  transition: all 0.3s;
}

.tab-item.active {
  color: #333;
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: var(--wb-orange);
  border-radius: 3px;
}

.settings-content {
  padding: 20px;
  padding-bottom: 100px;
  background: #f5f5f7;
  height: calc(100% - 110px);
  overflow-y: auto;
}

.settings-group {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.settings-group.warning {
  border: 1px solid rgba(230, 22, 45, 0.15);
  background: #fffafa;
}

.group-title {
  padding: 15px 20px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #5b6c7f;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-title i {
  color: #ff8200;
  font-size: 13px;
}


/* Avatar */
.avatar-edit {
  width: 90px;
  height: 90px;
  margin: 25px auto 10px;
  position: relative;
  transition: transform 0.2s;
}

.avatar-edit:active {
  transform: scale(0.95);
}

.edit-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.edit-overlay {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: #333;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  font-size: 13px;
}

/* Form Rows */
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.05);
  background: white;
}

.form-row:last-child {
  border-bottom: none;
}

.form-row label {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.form-row input[type="text"],
.form-row input[type="number"] {
  text-align: right;
  font-size: 15px;
  color: #5d6c7a;
  background: transparent;
  width: 60%;
}

.form-row input::placeholder {
  color: #c0c4cc;
}

/* Stats Split */
.form-row.split {
  padding: 20px;
  gap: 20px;
}

.split-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f9fbfd;
  border-radius: 12px;
  padding: 15px;
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.split-item label {
  font-size: 12px;
  color: #8daabf;
  margin-bottom: 4px;
}

.split-item input {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #333;
  width: 100%;
}

/* Switches */
.switch-row {
  padding-right: 20px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 30px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e9e9ea;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked+.slider {
  background-color: #34c759;
  /* iOS Green for switches usually, or keep orange */
}

input:checked+.slider {
  background-color: var(--wb-orange);
}

/* Keeping Orange per brand */
input:checked+.slider:before {
  transform: translateX(20px);
}

/* Chips */
.cert-options {
  padding: 0 20px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.cert-chip {
  font-size: 13px;
  padding: 6px 14px;
  background: #f5f5f7;
  color: #666;
  border-radius: 20px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.cert-chip.active {
  background: #fff0d6;
  color: var(--wb-orange);
  border-color: var(--wb-orange);
  font-weight: 500;
}

/* Binding Lists */
.binding-list {
  padding: 0 15px 15px;
}

.binding-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  margin-bottom: 8px;
  background: #fafbfc;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;
}

.binding-item:hover {
  background: #f5f7fa;
}

.binding-item.active {
  background: #fff8f0;
  border-color: #ff8200;
  box-shadow: 0 2px 8px rgba(255, 130, 0, 0.12);
}

.binding-item i:first-child {
  color: #a0aec0;
  transition: color 0.3s;
}

.binding-item.active i:first-child {
  color: #ff8200;
}

.checkmark {
  margin-left: auto;
  color: #ff8200;
  font-size: 14px;
}

/* Char Grid */
.char-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  padding: 15px 20px 25px;
}

.char-select-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: all 0.3s ease;
  cursor: pointer;
}

.char-select-item img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.char-select-item.active img {
  border-color: #ff8200;
  box-shadow: 0 3px 10px rgba(255, 130, 0, 0.25);
  transform: scale(1.05);
}

.char-select-item span {
  margin-top: 8px;
  font-size: 11px;
  color: #888;
  transition: all 0.2s;
}

.char-select-item.active span {
  color: #333;
  font-weight: 600;
}

.select-tick {
  position: absolute;
  top: -2px;
  right: 2px;
  background: linear-gradient(135deg, #ff8200 0%, #ff5b29 100%);
  color: white;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* Freq Input */
.freq-input {
  /* Using standard input style but smaller */
  background: #f0f0f5 !important;
  text-align: center !important;
  width: 50px !important;
  color: #333 !important;
  padding: 4px 0;
  border-radius: 6px;
  margin-left: 10px;
}

/* Footer */
.settings-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 15px 20px 25px;
  /* Extra bottom padding for home bar */
  display: flex;
  gap: 15px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 200;
}

.btn-cancel,
.btn-save {
  flex: 1;
  height: 44px;
  border-radius: 22px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: #f0f0f5;
  color: #666;
}

.btn-save {
  background: linear-gradient(90deg, #ff8200 0%, #ff5b29 100%);
  color: white;
  box-shadow: 0 4px 10px rgba(255, 91, 41, 0.3);
}

/* Info Tips */
.info-tip {
  margin: 0 20px 20px;
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
  color: #5b6c7f;
  font-size: 12px;
  line-height: 1.6;
  border-left: 3px solid #4da6ff;
}

/* Danger Zone */
.btn-mini-danger {
  padding: 6px 14px;
  background: #fff5f5;
  color: #e6162d;
  border-radius: 14px;
  font-weight: 500;
  border: 1px solid rgba(230, 22, 45, 0.1);
  transition: all 0.2s;
}

.btn-mini-danger:hover {
  background: #ffe5e5;
}

.btn-block-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #e6162d;
  background: white;
  width: 100%;
  padding: 14px;
  font-weight: 600;
  font-size: 15px;
  margin-top: 10px;
  border-radius: 12px;
  border: 1.5px solid rgba(230, 22, 45, 0.15);
  box-shadow: 0 1px 3px rgba(230, 22, 45, 0.08);
  transition: all 0.2s;
}

.btn-block-danger:hover {
  background: #fffafa;
  border-color: rgba(230, 22, 45, 0.25);
}




/* Verification Badges - Authentic Weibo Style */
.verify-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: middle;
  font-family: Arial, sans-serif;
  font-weight: bold;
  font-size: 10px;
  color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.verify-badge.personal {
  background: linear-gradient(180deg, #ffb800 0%, #ff8c00 100%);
}

.verify-badge.org {
  background: linear-gradient(180deg, #5ac8fa 0%, #2087e6 100%);
}

/* Verification Badge Below Avatar */
.avatar-wrapper {
  position: relative;
  display: inline-block;
}

.verify-badge-avatar {
  position: absolute;
  bottom: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-family: Arial, sans-serif;
  font-weight: bold;
  font-size: 12px;
  color: white;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.verify-badge-avatar.personal {
  background: linear-gradient(180deg, #ffb800 0%, #ff8c00 100%);
}

.verify-badge-avatar.org {
  background: linear-gradient(180deg, #5ac8fa 0%, #2087e6 100%);
}

/* VIP Name Color */
.vip-name {
  color: #ff8200 !important;
}

/* VIP Crown Styles */
.vip-crown {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  position: relative;
  /* For absolute positioning of number */
  vertical-align: text-bottom;
}

.vip-crown i {
  font-size: 14px;
  /* Base size */
}

/* VIP Level Colors - Low levels (1-3): Brown/Bronze */
.vip-crown.level-1 i,
.vip-crown.level-2 i,
.vip-crown.level-3 i {
  color: #c9a961;
}

/* VIP Level Colors - Mid levels (4-5): Gold */
.vip-crown.level-4 i,
.vip-crown.level-5 i {
  color: #ffb800;
  filter: drop-shadow(0 1px 1px rgba(255, 184, 0, 0.3));
}

/* VIP Level Colors - High levels (6-7): Red/Premium */
.vip-crown.level-6 i,
.vip-crown.level-7 i {
  color: #ff5722;
  filter: drop-shadow(0 1px 2px rgba(255, 87, 34, 0.4));
}

/* VIP Selector in Settings */
.vip-selector {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.vip-level-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  background: #f5f5f5;
  color: #999;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.vip-level-btn.active {
  background: linear-gradient(135deg, #ffb800 0%, #ff8c00 100%);
  color: white;
  border-color: #fff;
  box-shadow: 0 2px 6px rgba(255, 140, 0, 0.3);
}

/* Comment Section Styles */
.comment-section {
  background-color: #f8f8f8;
  border-top: 1px solid #f0f0f0;
  padding: 0 12px 12px 12px;
  margin-top: -5px;
  /* Pull closer to actions */
  animation: fade-in 0.3s ease;
}

.comment-list {
  display: flex;
  flex-direction: column;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #eef0f2;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-body {
  flex: 1;
  font-size: 13px;
}

.comment-user {
  color: #eb7350;
  /* Weibo Orange */
  margin-bottom: 4px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.comment-user.vip-name {
  color: #ff8200;
}

.comment-text {
  color: #333;
  line-height: 1.5;
  margin-bottom: 6px;
}

.comment-footer {
  display: flex;
  justify-content: space-between;
  color: #939393;
  font-size: 11px;
}

.comment-actions {
  display: flex;
  gap: 15px;
}

.delete-btn {
  cursor: pointer;
  color: #5d7da0;
  /* Link Blue */
}

.delete-btn:hover {
  text-decoration: underline;
}

.comment-actions span {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
}

.comment-actions span.liked {
  color: #ff8200;
}

.empty-comments {
  padding: 30px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.active-action {
  color: var(--wb-orange) !important;
}


.vip-level-btn.none {
  width: auto;
  padding: 0 10px;
  border-radius: 14px;
}

.vip-level-btn.none.active {
  background: #e0e0e0;
  color: #666;
  box-shadow: none;
}

.vip-preview {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: #fefefe;
  border-top: 1px solid #f5f5f5;
  margin-top: 10px;
}


/* Image Verification Badge */
.verify-badge-avatar-img {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid white;
  /* Optional: adds a whitespace separating it from avatar */
  z-index: 5;
}

.verify-badge-img-small {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  z-index: 2;
}



.vip-level-num {
  position: absolute;
  bottom: -1px;
  right: -1px;
  font-size: 8px;
  font-family: 'Arial', sans-serif;
  font-style: italic;
  font-weight: 900;
  color: white;
  line-height: 1;
  text-shadow:
    1px 0 0 #ff8200,
    -1px 0 0 #ff8200,
    0 1px 0 #ff8200,
    0 -1px 0 #ff8200;
  transform: scale(1);
  z-index: 2;
}

/* Share Modal Styles */
.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: fade-in 0.2s;
}

.share-sheet {
  background: #f8f8f8;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding-bottom: env(safe-area-inset-bottom);
}

.share-header {
  padding: 15px;
  text-align: center;
  font-size: 14px;
  color: #999;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.share-targets {
  padding: 20px;
  display: flex;
  gap: 20px;
  overflow-x: auto;
  background: white;
  margin-bottom: 8px;
  /* Gap before cancel */
}

/* Hide scrollbar for cleaner look */
.share-targets::-webkit-scrollbar {
  display: none;
}

.share-target-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 60px;
  flex-shrink: 0;
}

.share-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.share-name {
  font-size: 12px;
  color: #333;
  width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 分享面板增强：搜索 + 最近联系人 ===== */
.share-contact-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 15px 5px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 20px;
}

.search-icon { font-size: 13px; color: #999; }

.share-search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #333;
}

.clear-icon {
  cursor: pointer;
  font-size: 12px;
  color: #ccc;
  padding: 2px;
}

.clear-icon:hover { color: #999; }

.recent-label {
  width: 100%;
  padding: 8px 0 4px;
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 5px;
  border-bottom: none;
}

.share-targets.has-recent {
  flex-wrap: wrap; /* 让列表可以换行显示 */
  justify-content: flex-start;
}

.share-target-item.is-recent {
  position: relative;
}

.recent-dot {
  position: absolute;
  top: 2px;
  right: calc(50% - 28px);
  width: 8px;
  height: 8px;
  background: #ff8200;
  border-radius: 50%;
  border: 1.5px solid white;
}

.share-empty-contacts {
  width: 100%;
  padding: 40px 15px;
  text-align: center;
  color: #bbb;
  font-size: 13px;
}

.share-cancel {
  background: white;
  padding: 16px;
  text-align: center;
  font-size: 16px;
  color: #333;
  cursor: pointer;
}

.share-cancel:active {
  background: #f0f0f0;
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

/* Comment Content Enhancements */
.comment-content-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}

.sticker-img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  display: block;
}

.comment-img-wrapper {
  position: relative;
  display: inline-block;
  border-radius: 8px;
  overflow: hidden;
  max-width: 60%;
}

.comment-block-img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  display: block;
  object-fit: cover;
  background: #f0f0f0;
}

.img-tag {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

/* Update Comment User Color from Orange to Blue/Black */
.comment-user {
  color: #333;
  /* Dark Gray */
  font-weight: 600;
  font-size: 14px;
}

/* Reply Thread Styles */
.replies-container {
  background: #f0f0f0;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 6px;
  font-size: 13px;
}

.reply-item {
  line-height: 1.6;
  margin-bottom: 2px;
}

.reply-user {
  color: #507daf;
  /* Weibo Blue */
}

.reply-user.vip-name {
  color: #ff8200;
}

.author-tag {
  display: inline-block;
  font-size: 9px;
  transform: scale(0.9);
  background: #ff8200;
  color: white;
  padding: 0 4px;
  border-radius: 4px;
  margin-left: 2px;
  vertical-align: 1px;
}

.reply-text {
  color: #333;
}

.reply-more {
  color: #507daf;
  font-size: 12px;
  margin-top: 4px;
  cursor: pointer;
}

/* Comment Input Area */
/* Comment Input Area */
.comment-input-area {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  /* Add horizontal padding */
  border-top: 1px solid #f0f0f0;
  margin-top: 0;
  /* Remove top margin to stick flush */
  background: #f8f8f8;
  position: sticky;
  bottom: 0;
  z-index: 10;
  /* Ensure it stays on top */
}

/* Ensure content isn't hidden behind sticky input */
.comment-list {
  padding-bottom: 20px;
}

.comment-input-area input {
  flex: 1;
  background: white;
  border: 1px solid #ddd;
  border-radius: 18px;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.comment-input-area input:focus {
  border-color: #ff8200;
  box-shadow: 0 0 0 2px rgba(255, 130, 0, 0.1);
}

.send-comment-btn {
  font-size: 14px;
  font-weight: 600;
  color: #999;
  cursor: not-allowed;
  padding: 0 5px;
  transition: color 0.2s;
}

.send-comment-btn.active {
  color: #ff8200;
  cursor: pointer;
}

.reply-btn {
  margin-right: -5px;
  /* Adjust spacing */
}

/* Post Detail Overlay */
.post-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  animation: slide-up 0.3s ease-out;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  padding-top: 40px;
  /* Add space for Status Bar */
  background: white;
  border-bottom: 1px solid #f0f0f0;
  font-size: 16px;
  font-weight: bold;
}

.back-btn {
  cursor: pointer;
  font-weight: normal;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 20px;
}

.detail-view-item {
  box-shadow: none !important;
  /* Remove card shadow in detail view */
  border-bottom: none;
}

.comment-section.show-all {
  margin-top: 0;
  padding-bottom: 60px;
  /* Space for input */
}

.comment-header-row {
  padding: 15px 0 10px;
  font-weight: bold;
  font-size: 15px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 10px;
}

/* View More Link */
.view-more-comments {
  color: #507daf;
  font-size: 14px;
  padding: 10px 0;
  text-align: left;
  cursor: pointer;
}

/* Detail Input - Make it sticky only in detail view */
.comment-input-area.detail-input {
  position: static;
  background: white;
  border-top: 1px solid #eee;
  padding: 10px 15px;
  z-index: 100;
}

.post-detail-overlay .comment-input-area.detail-input {
  position: sticky;
  bottom: 0;
}

/* Mention Bar Styles */
.mention-bar {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  /* Use similar padding to list items */
  border-bottom: 1px solid #f0f0f0;
  /* Separator */
  color: #507daf;
  /* Weibo Blue */
  font-size: 14px;
  cursor: pointer;
  background: white;
}

.mention-icon {
  margin-right: 8px;
  font-size: 16px;
}

/* Night Mode Overrides */
.dark-mode {
  background: #0f172a !important;
  color: #f1f5f9;
}

.dark-mode .weibo-header,
.dark-mode .nav-tabs,
.dark-mode .profile-header,
.dark-mode .topic-detail-header,
.dark-mode .topic-info-banner,
.dark-mode .settings-header,
.dark-mode .settings-section,
.dark-mode .action-grid,
.dark-mode .post-detail-overlay,
.dark-mode .detail-header,
.dark-mode .comment-input-area.detail-input,
.dark-mode .mention-bar,
.dark-mode .chat-header,
.dark-mode .chat-footer,
.dark-mode .msg-list,
.dark-mode .following-list {
  background: #1e293b !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #f1f5f9 !important;
}

.dark-mode .post-card,
.dark-mode .topic-item,
.dark-mode .follow-item,
.dark-mode .msg-item,
.dark-mode .settings-group,
.dark-mode .form-row,
.dark-mode .bubble.received,
.dark-mode .split-item,
.dark-mode .cert-btn {
  background: #1e293b !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #f1f5f9 !important;
}

.dark-mode .post-textarea,
.dark-mode .form-input,
.dark-mode .chat-input,
.dark-mode .search-bar input {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #f1f5f9 !important;
}

.dark-mode .wb-text-sub,
.dark-mode .post-time,
.dark-mode .post-client,
.dark-mode .comment-time,
.dark-mode .msg-time,
.dark-mode .msg-text,
.dark-mode .form-label,
.dark-mode .group-title,
.dark-mode .stat-label,
.dark-mode .profile-id {
  color: #94a3b8 !important;
}

.dark-mode .divider,
.dark-mode .modal-header,
.dark-mode .post-toolbar,
.dark-mode .comment-header-row {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.dark-mode .btn-cancel {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #94a3b8 !important;
}

.dark-mode .option-chip {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #cbd5e1 !important;
}

.dark-mode .bubble.received {
  background: #334155 !important;
  color: #f1f5f9 !important;
}

.dark-mode .chat-window {
  background: #0f172a !important;
}

.dark-mode .topic-info-stats {
  color: #94a3b8 !important;
}

.dark-mode .slider {
  background: rgba(255, 255, 255, 0.1) !important;
}

.dark-mode .action-sub-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #cbd5e1 !important;
}

.dark-mode ::-webkit-scrollbar-track {
  background: #0f172a;
}

.dark-mode ::-webkit-scrollbar-thumb {
  background: #334155;
  border-color: #0f172a;
}

.profile-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid var(--wb-divider);
  padding: 0 15px;
}

.profile-tab {
  flex: 1;
  text-align: center;
  padding: 14px 0;
  font-size: 14px;
  color: var(--wb-text-sub);
  cursor: pointer;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-bottom: 2px solid transparent;
}

.profile-tab.active {
  color: var(--wb-text-main);
  font-weight: 600;
  border-bottom-color: var(--wb-orange);
}

.profile-tab i {
  font-size: 13px;
}

.my-posts-container {
  min-height: 300px;
}

.profile-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
  background: white;
  margin-top: 10px;
  border-radius: 8px;
}

.search-history-section {
  padding: 15px;
  background: white;
  margin-top: 10px;
}

.search-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-text-main);
}

.search-clear-btn {
  font-size: 12px;
  color: #999;
  cursor: pointer;
  font-weight: 400;
}

.search-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.search-history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f2f2f2;
  border-radius: 20px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  transition: background 0.2s;
}

.search-history-item:active {
  background: #e8e8e8;
}

.search-history-item .history-icon {
  font-size: 12px;
  color: #999;
}

.search-go-btn {
  background: var(--wb-orange);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}

.search-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;
  background: white;
  margin-top: 10px;
  border-radius: 8px;
}

.share-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.share-preview-avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f0f0;
}

.share-preview-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.share-preview-content {
  flex: 1;
  min-width: 0;
}

.share-preview-author {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.share-preview-text {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.share-options {
  padding: 20px 15px;
  background: white;
  display: flex;
  justify-content: space-around;
  gap: 10px;
}

.share-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 12px;
  transition: background 0.2s;
  min-width: 64px;
}

.share-option:active {
  background: #f0f0f0;
}

.share-option-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.share-option span {
  font-size: 11px;
  color: #333;
  text-align: center;
  white-space: nowrap;
}

.share-header-back {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  border-bottom: none;
}

.share-back-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007aff;
  font-size: 16px;
  cursor: pointer;
}

.share-targets {
  padding: 20px;
  display: flex;
  gap: 20px;
  overflow-x: auto;
  background: white;
  margin-bottom: 8px;
}

.share-targets::-webkit-scrollbar {
  display: none;
}

.share-target-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 60px;
  flex-shrink: 0;
}

.share-name {
  font-size: 12px;
  color: #333;
  width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dm-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #e0e0e0;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.dm-send-btn.active {
  background: var(--wb-orange);
}

.dm-send-btn:active {
  transform: scale(0.9);
}

.bubble-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.bubble-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bubble-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bubble-time {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 2px;
  text-align: right;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #ccc;
  font-size: 14px;
}

.search-sub-tabs {
  display: flex;
  background: white;
  padding: 0 15px;
  border-bottom: 1px solid var(--wb-divider);
}

.search-sub-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 14px;
  color: var(--wb-text-sub);
  cursor: pointer;
  transition: color 0.2s;
  border-bottom: 2px solid transparent;
}

.search-sub-tab.active {
  color: var(--wb-text-main);
  font-weight: 600;
  border-bottom-color: var(--wb-orange);
}

.search-tab-content {
  background: var(--wb-bg);
  min-height: 300px;
}

.search-user-result {
  display: flex;
  align-items: center;
  padding: 15px;
  gap: 12px;
  background: white;
  border-bottom: 1px solid var(--wb-divider);
  cursor: pointer;
}

.search-user-result:last-child {
  border-bottom: none;
}

.search-user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.search-user-info {
  flex: 1;
  min-width: 0;
}

.search-user-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--wb-text-main);
}

.search-user-meta {
  font-size: 12px;
  color: var(--wb-text-sub);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-follow-btn {
  padding: 6px 16px;
  border: 1px solid var(--wb-orange);
  color: var(--wb-orange);
  background: transparent;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}

.search-follow-btn:active {
  background: var(--wb-orange);
  color: white;
}

.search-topic-result {
  display: flex;
  align-items: center;
  padding: 15px;
  gap: 12px;
  background: white;
  border-bottom: 1px solid var(--wb-divider);
  cursor: pointer;
}

.search-topic-result:last-child {
  border-bottom: none;
}

.search-topic-avatar {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}

.search-topic-info {
  flex: 1;
}

.search-topic-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--wb-orange);
  margin-bottom: 4px;
}

.search-topic-meta {
  font-size: 12px;
  color: var(--wb-text-sub);
}

.viewed-user-posts {
  background: var(--wb-bg);
  min-height: 200px;
}

.user-posts-header {
  padding: 15px;
  font-weight: 600;
  font-size: 15px;
  color: var(--wb-text-main);
  background: white;
  border-bottom: 1px solid var(--wb-divider);
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-posts-header i {
  color: var(--wb-orange);
}

.user-profile-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 15px;
}

.btn-follow {
  padding: 8px 24px;
  background: var(--wb-orange);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-follow:active {
  opacity: 0.8;
}

.btn-chat {
  padding: 8px 24px;
  background: white;
  color: var(--wb-orange);
  border: 1px solid var(--wb-orange);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-chat:active {
  background: #f0f0f0;
}
</style>
