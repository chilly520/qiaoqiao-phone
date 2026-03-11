<template>
  <div class="fixed inset-0 z-50 bg-[#f4f9f9] flex flex-col font-sans slide-up">
    <!-- Header -->
    <header class="flex-none bg-white/90 backdrop-blur-xl border-b border-teal-100/50 flex items-center justify-between px-4 pt-10 pb-3 shadow-sm z-10 sticky top-0 h-[84px]">
      <button @click="$emit('close')" class="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-50/50 hover:bg-teal-100 active:bg-teal-200 transition-colors">
        <i class="fa-solid fa-arrow-left text-teal-600"></i>
      </button>
      <h2 class="text-[16px] font-bold text-slate-800 line-clamp-1 flex-1 text-center px-4 tracking-wide">帖子详情</h2>
      <!-- Mod Actions Toggle -->
      <button v-if="isMod" @click="showModMenu = !showModMenu" class="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 transition-colors relative">
        <i class="fa-solid fa-shield-halved text-amber-600 text-sm"></i>
        <div class="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-white"></div>
      </button>
      <div v-else class="w-9"></div>
    </header>

    <!-- Mod Action Dropdown -->
    <div v-if="showModMenu && isMod" class="absolute top-[90px] right-3 z-30 bg-white rounded-2xl shadow-2xl border border-amber-100 p-3 w-56 animate-fade-in">
      <div class="text-[10px] font-bold text-amber-500 tracking-widest uppercase mb-2 px-1">🛡️ 版主操作</div>
      <button @click="$emit('toggle-pin', post.id); showModMenu = false" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors" :class="post.isPinned ? 'bg-amber-50 text-amber-600' : 'hover:bg-slate-50 text-slate-600'">
        <i class="fa-solid fa-thumbtack text-xs"></i>
        {{ post.isPinned ? '取消置顶' : '置顶帖子' }}
      </button>
      <button @click="$emit('toggle-featured', post.id); showModMenu = false" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors" :class="post.isFeatured ? 'bg-teal-50 text-teal-600' : 'hover:bg-slate-50 text-slate-600'">
        <i class="fa-solid fa-gem text-xs"></i>
        {{ post.isFeatured ? '取消加精' : '加精帖子' }}
      </button>
      <button @click="$emit('toggle-hot', post.id); showModMenu = false" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors" :class="post.isHot ? 'bg-orange-50 text-orange-600' : 'hover:bg-slate-50 text-slate-600'">
        <i class="fa-solid fa-fire text-xs"></i>
        {{ post.isHot ? '取消爆' : '标记为爆' }}
      </button>
      <div class="border-t border-slate-100 my-1.5"></div>
      <button @click="$emit('toggle-ban', post.id); showModMenu = false" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-colors" :class="post.isBanned ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500 hover:bg-red-100'">
        <i :class="post.isBanned ? 'fa-solid fa-lock-open' : 'fa-solid fa-ban'" class="text-xs"></i>
        {{ post.isBanned ? '解封帖子' : '封禁帖子' }}
      </button>
      <button @click="$emit('ban-user', post.authorName); showModMenu = false" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-bold text-red-400 hover:bg-red-50 transition-colors">
        <i class="fa-solid fa-user-slash text-xs"></i>
        封号楼主 ({{ post.authorName }})
      </button>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto w-full pb-[100px]" ref="detailScrollArea" @scroll="handleScroll">
      <!-- Post Tags -->
      <div v-if="post.isPinned || post.isFeatured || post.isHot || post.isBanned" class="flex flex-wrap gap-1.5 px-5 pt-3">
        <span v-if="post.isPinned" class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[11px] font-black tracking-widest shadow-sm">
          <i class="fa-solid fa-thumbtack text-[9px]"></i> 置顶
        </span>
        <span v-if="post.isFeatured" class="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[11px] font-black tracking-widest shadow-sm">
          <i class="fa-solid fa-gem text-[9px]"></i> 加精
        </span>
        <span v-if="post.isHot" class="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-50 to-red-50 text-red-500 border border-red-200 rounded-full text-[11px] font-black tracking-widest animate-pulse shadow-sm">
          <i class="fa-solid fa-fire text-[9px]"></i> 爆
        </span>
        <span v-if="post.isBanned" class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 border border-red-300 rounded-full text-[11px] font-black tracking-widest shadow-sm">
          <i class="fa-solid fa-ban text-[9px]"></i> 帖子已被版主封禁
        </span>
      </div>

      <!-- Main Post -->
      <div class="p-5 bg-white mb-2 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border-b border-teal-50">
        <div class="flex items-center gap-3 mb-4">
          <img :src="post.avatar" alt="avatar" class="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 ring-2 ring-teal-50 shadow-sm object-cover">
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-bold text-slate-800 text-[15px]">{{ post.authorName }}</span>
              <span class="px-2 py-[2px] bg-gradient-to-r from-teal-500 to-emerald-400 text-white text-[9px] rounded-md font-bold tracking-widest shadow-sm">楼主</span>
            </div>
            <div class="text-[11px] text-slate-400 font-medium tracking-wide">{{ formatTime(post.timestamp) }}</div>
          </div>
        </div>
        <h1 class="text-xl font-black mb-3 leading-tight tracking-wide"
            :class="[
              post.isFeatured ? 'text-teal-700' : post.isHot ? 'text-orange-700' : post.isBanned ? 'text-red-400 line-through' : 'text-slate-800'
            ]">{{ post.title }}</h1>
        <div class="text-[15px] text-slate-600 leading-relaxed whitespace-pre-wrap markdown-content mb-5 tracking-wide" v-html="renderMarkdown(post.content)"></div>
        <!-- Stats Action Row -->
        <div class="border-t border-slate-100 pt-3 flex justify-between items-center text-slate-400 font-medium text-[13px]">
          <div class="flex gap-5">
            <button class="flex items-center gap-1.5 transition-all active:scale-90" :class="isLiked ? 'text-rose-500' : 'hover:text-rose-400'" @click="$emit('toggle-like', post.id)">
              <i :class="isLiked ? 'fa-solid fa-heart animate-like-pop' : 'fa-regular fa-heart'"></i> {{ post.likes }} 喜欢
            </button>
            <button class="flex items-center gap-1.5 hover:text-teal-500 transition-colors" @click="focusInput">
              <i class="fa-regular fa-comment"></i> {{ comments.length }} 评论
            </button>
          </div>
          <button @click="$emit('share')" class="flex items-center gap-1.5 hover:text-teal-500 transition-colors">
            <i class="fa-solid fa-share-nodes"></i> 分享
          </button>
        </div>
      </div>

      <!-- Ban Notice -->
      <div v-if="post.isBanned" class="mx-5 my-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
        <i class="fa-solid fa-lock text-red-400 text-2xl mb-2"></i>
        <p class="text-red-600 font-bold text-sm">此帖已被版主封禁</p>
        <p class="text-red-400 text-xs mt-1">评论区已关闭，禁止回复</p>
      </div>

      <!-- Comments Section -->
      <div class="bg-white p-5 shadow-inner min-h-[500px]">
        <h3 class="font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 text-[15px] tracking-wide flex items-center gap-2">
          <i class="fa-regular fa-comments text-teal-400"></i> 全部留言 <span class="text-slate-400 text-xs font-normal">({{ comments.length }})</span>
        </h3>
        
        <div v-if="comments.length > 0" class="flex flex-col gap-5">
          <div v-for="(comment, idx) in comments" :key="comment.id" class="flex gap-3 animate-fade-in group pb-2">
            <img :src="comment.avatar" alt="avatar" class="w-9 h-9 rounded-full border border-slate-100 shadow-sm mt-1 flex-none object-cover bg-slate-50">
            <div class="flex-1 flex flex-col min-w-0">
              <div class="flex justify-between items-start mb-0.5">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-[14px]" :class="comment.isMod ? 'text-amber-600' : comment.isAdmin ? 'text-indigo-600' : 'text-slate-700'">{{ comment.authorName }}</span>
                  <span v-if="comment.isMod" class="px-1.5 py-[1px] bg-amber-50 text-amber-500 border border-amber-200 rounded text-[8px] font-black tracking-widest">版主</span>
                  <span v-if="comment.isAdmin" class="px-1.5 py-[1px] bg-indigo-50 text-indigo-500 border border-indigo-200 rounded text-[8px] font-black tracking-widest">管理</span>
                  <span v-if="comment.authorName === post.authorName" class="px-1.5 py-[1px] bg-teal-50 text-teal-500 border border-teal-200 rounded text-[8px] font-black tracking-widest">楼主</span>
                </div>
                <span class="text-[10px] text-slate-300 font-bold bg-slate-50 px-1.5 rounded-sm">#{{ idx + 2 }}</span> 
              </div>
              <div class="text-[14px] text-slate-600 leading-relaxed break-words markdown-content" v-html="renderMarkdown(comment.content)"></div>
              <div class="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
                <span class="tracking-wide">{{ formatTime(comment.timestamp) }}</span>
                <div class="flex items-center gap-2">
                  <!-- Mod: Ban user from comment -->
                  <button v-if="isMod && !comment.isMod && !comment.isAdmin" @click="$emit('ban-user', comment.authorName)" class="hover:bg-red-50 hover:text-red-500 px-2 py-1 rounded-full text-slate-300 transition-colors opacity-0 group-hover:opacity-100 text-[10px]">
                    <i class="fa-solid fa-user-slash"></i>
                  </button>
                  <button v-if="!post.isBanned" @click="replyTo(comment)" class="hover:bg-teal-50 hover:text-teal-600 px-3 py-1 rounded-full text-slate-400 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100">回复</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="py-10 text-center text-slate-400 text-sm tracking-wide">
           还没有人留言，快来抢沙发吧~
        </div>

        <div v-if="isGenerating" class="w-full py-8 flex flex-col items-center justify-center gap-3 text-teal-500/80 animate-pulse">
          <i class="fa-solid fa-seedling animate-bounce text-2xl drop-shadow-sm"></i>
          <span class="text-xs tracking-widest font-bold">岛民们正在火速赶来...</span>
        </div>

        <div v-if="!post.isBanned" class="mt-8 flex justify-center">
          <button @click="generateMoreComments" :disabled="isGenerating" class="px-7 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-600 font-bold rounded-full text-[13px] transition-all shadow-sm flex items-center gap-2 group border border-teal-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed tracking-wider">
            <i class="fa-solid fa-wand-magic-sparkles group-hover:rotate-12 transition-transform"></i> 
            {{ isGenerating ? '召唤中...' : '召唤更多网友留言' }}
          </button>
        </div>
        <div class="h-24"></div> <!-- bottom padding -->
      </div>
    </div>

    <!-- Bottom Input (hidden when banned) -->
    <div v-if="!post.isBanned" class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-teal-50 p-3 pb-safe shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.06)] z-20 rounded-t-[20px]">
      <div class="flex items-end gap-2 max-w-2xl mx-auto relative px-1">
        <!-- 切换马甲按钮 -->
        <button @click="showAltMenu = !showAltMenu" class="w-10 h-10 rounded-full overflow-hidden flex-none border-[1.5px] border-transparent hover:border-teal-200 transition-colors ring-2 ring-slate-50 shadow-sm relative group bg-white">
          <img :src="currentUser.avatar" alt="alt" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-black/30 hidden group-hover:flex items-center justify-center">
            <i class="fa-solid fa-users text-white text-[10px]"></i>
          </div>
        </button>
        <div class="flex-1 bg-slate-50 rounded-2xl flex items-center px-4 py-2 border border-slate-100 focus-within:ring-2 focus-within:ring-teal-100 focus-within:bg-white focus-within:border-teal-300 transition-all overflow-hidden min-h-[44px] max-h-32">
           <textarea ref="replyInput" v-model="newCommentContent" rows="1" placeholder="说点什么吧..." class="w-full bg-transparent text-[14px] resize-none focus:outline-none text-slate-700 py-1" @input="resizeTextarea" @keydown.enter.prevent="sendComment"></textarea>
           <button @click="showMentionMenu = !showMentionMenu" class="ml-1 w-8 h-8 rounded-full text-slate-300 hover:text-teal-500 hover:bg-teal-50 transition-colors flex items-center justify-center flex-none" :class="showMentionMenu ? 'text-teal-500 bg-teal-50' : ''">
             <i class="fa-solid fa-at text-sm"></i>
           </button>
           <button class="ml-1 w-8 h-8 rounded-full text-slate-300 hover:text-teal-500 hover:bg-teal-50 transition-colors flex items-center justify-center flex-none">
             <i class="fa-regular fa-face-smile"></i>
           </button>
        </div>
        <button @click="sendComment" :disabled="!newCommentContent.trim() || isGenerating" class="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-400 text-white flex-none flex items-center justify-center shadow-lg shadow-teal-500/30 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-md transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed">
          <i class="fa-solid fa-paper-plane text-[15px] ml-0.5 mt-0.5"></i>
        </button>
      </div>
      
      <!-- Alt Accounts Menu -->
      <div v-if="showAltMenu" class="absolute bottom-full left-4 mb-3 w-52 bg-white/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-teal-50 pt-3 pb-2 animate-fade-in origin-bottom-left flex flex-col z-30 overflow-hidden">
        <div class="px-4 py-1 text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">切换发言身份</div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar">
          <button v-for="user in alts" :key="user.id" @click="currentAltIdLocal = user.id; showAltMenu = false" class="flex items-center gap-3 px-4 py-3 hover:bg-teal-50/50 transition-colors text-left group border-l-[3px]" :class="currentAltIdLocal === user.id ? 'border-teal-400 bg-teal-50/30' : 'border-transparent'">
             <img :src="user.avatar" class="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 object-cover">
             <div class="flex flex-col flex-1 min-w-0 gap-0.5">
                <span class="text-[14px] font-bold text-slate-800 line-clamp-1 group-hover:text-teal-600 transition-colors truncate">{{ user.name }}</span>
                <span class="text-[10px] text-slate-400 font-medium truncate">{{ user.role }}</span>
             </div>
             <i v-if="currentAltIdLocal === user.id" class="fa-solid fa-circle-check text-teal-400 text-[15px] drop-shadow-sm"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Banned Input Blocker -->
    <div v-else class="fixed bottom-0 left-0 right-0 bg-red-50/95 backdrop-blur-xl border-t border-red-200 p-4 pb-safe z-20 rounded-t-[20px] text-center">
      <div class="flex items-center justify-center gap-2 text-red-500 font-bold text-sm">
        <i class="fa-solid fa-lock"></i>
        <span>评论区已封禁，暂不接受回复</span>
      </div>

      <!-- @ Mention Popup -->
      <div v-if="showMentionMenu" class="absolute bottom-full left-12 mb-3 w-56 bg-white/95 backdrop-blur-xl rounded-[20px] shadow-2xl border border-teal-50 py-2 animate-fade-in origin-bottom-left z-30 overflow-hidden">
        <div class="px-4 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase">@ 提及</div>
        <div class="max-h-52 overflow-y-auto custom-scrollbar">
          <button v-for="user in mentionUsers" :key="user.name" @click="insertMention(user.name)" class="flex items-center gap-2.5 px-4 py-2.5 w-full text-left hover:bg-teal-50/80 transition-colors">
            <img :src="user.avatar" class="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 object-cover">
            <div class="flex-1 min-w-0">
              <span class="text-[13px] font-bold text-slate-700 truncate block">{{ user.name }}</span>
              <span class="text-[9px] text-slate-400 font-medium">{{ user.role || '' }}</span>
            </div>
            <span v-if="user.badge" class="text-[8px] px-1.5 py-0.5 rounded font-bold" :class="user.badge === '版主' ? 'bg-amber-50 text-amber-500 border border-amber-200' : user.badge === '管理' ? 'bg-indigo-50 text-indigo-500 border border-indigo-200' : user.badge === '角色' ? 'bg-violet-50 text-violet-500 border border-violet-200' : 'bg-teal-50 text-teal-500 border border-teal-200'">{{ user.badge }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Back to Top Button -->
    <button v-show="showBackToTop" @click="scrollToTop" class="fixed bottom-[110px] right-4 w-11 h-11 bg-white text-teal-500 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center border border-teal-50 hover:bg-teal-50 transition-all z-40 active:scale-90">
      <i class="fa-solid fa-arrow-up text-sm"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  post: Object,
  comments: Array,
  isGenerating: Boolean,
  alts: Array,
  currentUser: Object,
  currentAltId: String,
  isMod: Boolean,
  isLiked: Boolean,
  mentionUsers: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'generate', 'send', 'share', 'update:currentAltId', 'toggle-pin', 'toggle-featured', 'toggle-hot', 'toggle-ban', 'ban-user', 'toggle-like'])

const newCommentContent = ref('')
const replyInput = ref(null)
const showAltMenu = ref(false)
const showModMenu = ref(false)
const showMentionMenu = ref(false)
const detailScrollArea = ref(null)
const showBackToTop = ref(false)

const currentAltIdLocal = computed({
  get: () => props.currentAltId,
  set: (val) => emit('update:currentAltId', val)
})

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function insertMention(name) {
  const mention = `@${name} `
  if (!newCommentContent.value.includes(mention)) {
    newCommentContent.value += (newCommentContent.value.endsWith(' ') || newCommentContent.value === '' ? '' : ' ') + mention
  }
  showMentionMenu.value = false
  if (replyInput.value) replyInput.value.focus()
}

function renderMarkdown(text) {
  if (!text) return ''
  let html = typeof marked.parse === 'function' ? marked.parse(text) : marked(text)
  html = html.replace(/<img /g, '<img class="rounded-2xl shadow-sm border border-slate-100 max-w-full my-3" ')
  return html
}

function resizeTextarea() {
  if (replyInput.value) {
    replyInput.value.style.height = 'auto'
    replyInput.value.style.height = (replyInput.value.scrollHeight > 120 ? 120 : replyInput.value.scrollHeight) + 'px'
  }
}

function focusInput() {
  if (replyInput.value) replyInput.value.focus()
}

function replyTo(comment) {
  newCommentContent.value = `回复 @${comment.authorName} : `
  focusInput()
}

function handleScroll(e) {
  showBackToTop.value = e.target.scrollTop > 300
}

function scrollToTop() {
  if (detailScrollArea.value) {
    detailScrollArea.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function generateMoreComments() {
  emit('generate')
}

function sendComment() {
  if (!newCommentContent.value.trim() || props.isGenerating) return;
  emit('send', newCommentContent.value)
  newCommentContent.value = ''
  nextTick(resizeTextarea)
}
</script>

<style scoped>
.slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

:deep(.markdown-content p) {
  margin-bottom: 0.5em;
}
:deep(.markdown-content p:last-child) {
  margin-bottom: 0;
}
:deep(.markdown-content strong) {
  color: #0f172a;
  font-weight: 800;
}
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
@keyframes likePop {
  0% { transform: scale(1); }
  30% { transform: scale(1.4); }
  50% { transform: scale(0.9); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.animate-like-pop {
  animation: likePop 0.4s ease-out;
}
</style>
