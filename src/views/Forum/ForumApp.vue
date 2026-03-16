<template>
  <div class="forum-app bg-[#f4f9f9] h-screen flex flex-col font-sans overflow-hidden">
    <!-- Header -->
    <header v-show="!profileSubPage" class="flex-none bg-white/90 backdrop-blur-xl border-b border-teal-100/50 px-4 pt-10 pb-3 z-30 flex items-center justify-between shadow-sm sticky top-0 h-[84px]">
      <div class="flex items-center gap-3">
        <button @click="handleBack" class="w-9 h-9 rounded-2xl bg-teal-50 hover:bg-teal-100 flex items-center justify-center text-lg active:scale-90 transition-all flex-none border border-teal-100/50 text-teal-600">
          <i :class="currentTab === 'discover' ? 'fa-solid fa-house' : 'fa-solid fa-chevron-left'"></i>
        </button>
        <div class="flex flex-col">
          <h1 class="text-[17px] font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">
            <template v-if="currentTab === 'discover'">
              <i class="fa-solid fa-seedling text-teal-500 text-sm"></i> 岛屿发现
            </template>
            <template v-else-if="currentTab === 'forum'">
              <i class="fa-solid fa-leaf text-teal-400 text-sm"></i> {{ forumStore.currentForum?.name || '未选择区服' }}
            </template>
            <template v-else-if="currentTab === 'profile'">
              <i class="fa-solid fa-address-card text-teal-500 text-sm"></i> 个人中心
            </template>
          </h1>
          <span v-if="currentTab === 'forum' && forumStore.currentForum" class="text-[10px] text-slate-400 font-medium tracking-wide">共 {{ forumStore.currentPosts?.length || 0 }} 贴 • {{ forumStore.currentUser?.name || '未知' }}</span>
        </div>
      </div>
      <button v-if="currentTab === 'forum'" @click="openSettings" class="w-9 h-9 rounded-full hover:bg-teal-50 text-slate-400 hover:text-teal-600 transition-colors flex items-center justify-center">
        <i class="fa-solid fa-sliders"></i>
      </button>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto w-full pb-[80px]" ref="mainScrollArea" @scroll="handleScroll">

      <!-- ================== DISCOVER TAB ================== -->
      <div v-if="currentTab === 'discover'" class="p-4 flex flex-col gap-4 animate-fade-in mt-2">
        <!-- New Forum Btn -->
        <button @click="showNewForumModal = true" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-400 to-emerald-400 text-white rounded-[20px] py-4 font-bold tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all">
          <i class="fa-solid fa-seedling"></i> 种下一块新岛屿 (建版块)
        </button>

        <!-- Forums List -->
        <div class="grid grid-cols-1 gap-4 mt-2">
           <div v-for="f in forumStore.forums" :key="f.id" @click="selectForum(f.id)" class="bg-white rounded-[24px] p-5 shadow-sm border border-teal-50 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
             <div class="absolute -right-10 -top-10 w-32 h-32 bg-teal-50 opacity-50 rounded-full blur-2xl group-hover:bg-teal-100 transition-colors"></div>
             <div class="relative z-10">
               <div class="flex justify-between items-start mb-2">
                 <h2 class="text-[19px] font-black text-slate-800 tracking-wide">{{ f.name }}</h2>
                 <button @click.stop="confirmRemoveForum(f.id)" class="w-8 h-8 rounded-full text-slate-300 hover:text-rose-400 hover:bg-rose-50 flex items-center justify-center transition-colors">
                   <i class="fa-regular fa-trash-can"></i>
                 </button>
               </div>
               <p class="text-sm text-slate-500 leading-relaxed mb-4 line-clamp-2 min-h-[40px]">{{ f.desc }}</p>
               <div class="flex items-center gap-2 text-[11px] text-teal-600 font-bold bg-teal-50/50 px-3 py-1.5 rounded-full w-fit max-w-full">
                 <i class="fa-solid fa-arrow-trend-up"></i>
                 <span class="truncate">热榜: {{ f.trendingTopics[0] || '暂无话题' }}</span>
               </div>
             </div>
           </div>
        </div>
        <div v-if="forumStore.forums.length === 0" class="text-center py-12 text-slate-400 flex flex-col items-center">
           <i class="fa-solid fa-tree-city text-4xl mb-3 text-slate-300"></i>
           <p class="text-sm tracking-wide">目前还没有任何岛屿<br>快去创建第一块专属小天地吧！</p>
        </div>
      </div>

      <!-- ================== FORUM TAB ================== -->
      <div v-else-if="currentTab === 'forum'" class="animate-fade-in">
        <div v-if="forumStore.currentForum" class="h-full">
          <!-- Info Board -->
          <div class="bg-gradient-to-br from-teal-400 to-emerald-500 text-white p-5 shadow-sm relative overflow-hidden transition-all duration-300 transform origin-top">
            <!-- Subtle fresh overlay pattern -->
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/clean-textile.png')] opacity-[0.08]"></div>
            <div class="absolute top-[10%] right-[-10%] w-24 h-24 bg-white/20 blur-2xl rounded-full"></div>

            <div class="relative z-10 flex flex-col">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <span class="bg-white/20 text-white px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest backdrop-blur-sm border border-white/20 mb-3 inline-block drop-shadow-sm">岛屿指南</span>
                  <p class="text-[14px] font-medium leading-relaxed opacity-95 mb-4 text-emerald-50 text-shadow-sm">{{ forumStore.currentForum.desc }}</p>
                </div>
              </div>

              <!-- Trending Topics Slider -->
              <div class="bg-white/10 backdrop-blur-md rounded-[16px] border border-white/20 p-3 shadow-inner flex items-center gap-3 overflow-hidden group">
                <div class="flex-none bg-teal-50 text-teal-500 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm">
                  <i class="fa-solid fa-hashtag text-xs"></i>
                </div>
                <div class="flex-1 overflow-hidden relative h-5">
                  <div class="flex flex-col animate-slide-up text-[13px] font-bold tracking-wide">
                    <div v-for="(topic, idx) in forumStore.currentForum.trendingTopics" :key="idx" class="h-5 leading-5 line-clamp-1 truncate text-emerald-50">
                      <span class="opacity-80 mr-1 text-[10px]">{{ idx + 1 }}</span> {{ topic }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Area -->
          <div class="bg-white p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mb-2 border-b border-slate-100">
            <div class="flex gap-2 mb-3">
              <div class="flex-1 bg-[#f8fbfb] rounded-2xl border border-teal-100 p-2 flex items-center focus-within:ring-2 focus-within:ring-teal-50 focus-within:bg-white focus-within:border-teal-300 transition-all shadow-inner">
                <i class="fa-regular fa-face-smile text-teal-300 ml-2 mr-3 text-sm"></i>
                <input v-model="directionInput" type="text" :placeholder="`最近大家都在讨论什么？`" class="w-full bg-transparent text-sm focus:outline-none text-slate-700 font-medium placeholder:font-normal placeholder:text-slate-400">
              </div>
            </div>
            
            <div class="flex gap-3">
              <button @click="handleGenerate" :disabled="forumStore.isGenerating" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-50 rounded-[16px] font-bold text-[14px] shadow-lg shadow-slate-800/20 transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:scale-100 tracking-wider">
                <i v-if="forumStore.isGenerating" class="fa-solid fa-circle-notch animate-spin text-teal-300"></i>
                <i v-else class="fa-solid fa-leaf text-teal-300 group-hover:-rotate-12 transition-transform"></i>
                {{ forumStore.isGenerating ? '岛民搬砖中...' : '刷新岛屿动态' }}
              </button>
              
              <button @click="showCustomPostModal = true" class="w-12 h-[44px] bg-teal-50 text-teal-600 rounded-[16px] flex items-center justify-center shadow-inner border border-teal-100 hover:bg-teal-100 active:scale-95 transition-all text-lg">
                <i class="fa-solid fa-pen-nib"></i>
              </button>
            </div>
            
            <div v-if="forumStore.isGenerating" class="mt-3 w-full bg-teal-50 rounded-full h-1 overflow-hidden relative">
              <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-300 to-emerald-400 w-1/3 animate-progress-fast rounded-full"></div>
            </div>
          </div>

          <!-- Post List -->
          <div v-if="forumStore.currentPosts.length > 0" class="flex flex-col bg-[#f4f9f9] min-h-[50vh] gap-3 p-3 pt-1">
            <ForumPostCard 
              v-for="post in forumStore.currentPosts" 
              :key="post.id" 
              :post="post" 
              :comment-count="forumStore.getPostComments(forumStore.currentForumId, post.id).length"
              :is-liked="forumStore.isPostLiked(post.id)"
              :show-delete="forumStore.alts.some(a => a.id === post.authorId) || forumStore.isUserStaff"
              @click="openPost(post)"
              @share="sharePostTarget = post"
              @toggle-like="forumStore.toggleLike($event)"
              @delete="confirmDeletePost($event)"
            />
            
            <div class="py-6 flex flex-col items-center justify-center gap-2 text-slate-400/80">
              <i class="fa-brands fa-pagelines text-2xl opacity-50"></i>
              <span class="text-[10px] font-bold tracking-widest text-slate-300">翻到底啦</span>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-4">
            <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
              <img src="https://api.dicebear.com/7.x/notionists/svg?seed=empty_leaf" class="w-12 h-12 opacity-50 grayscale">
            </div>
            <p class="text-sm font-medium tracking-wide">岛里静悄悄的，快去刷新动态吧~</p>
          </div>
        </div>
        <div v-else class="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-4">
          <i class="fa-solid fa-compass text-4xl text-slate-300 drop-shadow-sm"></i>
          <p class="text-sm font-medium">请先在“发现”页面挑选一个岛屿！</p>
          <button @click="currentTab = 'discover'" class="px-6 py-2 bg-teal-500 text-white rounded-full text-sm font-bold shadow-md hover:bg-teal-600 transition-colors tracking-wide">立刻前往</button>
        </div>
      </div>

      <!-- ================== PROFILE TAB ================== -->
      <div v-else-if="currentTab === 'profile'" class="p-4 flex flex-col gap-5 animate-fade-in relative">
         <!-- Profile Sub Pages -->
         <ProfileCharacters v-if="profileSubPage === 'characters'" @back="profileSubPage = null" />
         <ProfileAlts v-else-if="profileSubPage === 'alts'" @back="profileSubPage = null" @add-alt="isAddAltVisible = true" />
         <ProfileLikes v-else-if="profileSubPage === 'likes'" @back="profileSubPage = null" @view-post="goToLikedPost" />
         <ProfileMyPosts v-else-if="profileSubPage === 'myPosts'" @back="profileSubPage = null" @view-post="goToLikedPost" />
         <ProfileAdmin v-else-if="profileSubPage === 'admin'" @back="profileSubPage = null" 
                       @apply-mod="handleApplyMod" @resign-mod="handleResignMod" @unban-user="handleBanUser" @clear-all-posts="confirmClearAllPosts" />
               
         <!-- Profile Main Menu -->
         <template v-else>
           <!-- Bind Char Context -->
           <div @click="profileSubPage = 'characters'" 
                class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-[#e8f3f3] cursor-pointer hover:shadow-md transition-shadow">
              <h3 class="font-black text-slate-800 text-[16px] mb-1 flex items-center gap-2">
                <i class="fa-solid fa-link text-emerald-400 text-sm"></i> 绑定专属角色
              </h3>
              <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">你可以勾选通讯录里的好友加入进来！生成的论坛剧情、话题及吃瓜方向，将大量参考这些角色的聊天记录及人设哦~(支持多选)</p>
              <div class="flex items-center justify-between text-[12px] text-slate-500">
                <span>已绑定 {{ forumStore.boundCharIds.length }} 个角色</span>
                <i class="fa-solid fa-chevron-right text-slate-300"></i>
              </div>
           </div>
      
           <!-- My Alts Management -->
           <div @click="profileSubPage = 'alts'"
                class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-[#e8f3f3] cursor-pointer hover:shadow-md transition-shadow">
              <div class="flex justify-between items-center mb-3">
                <h3 class="font-black text-slate-800 text-[16px] flex items-center gap-2">
                  <i class="fa-solid fa-masks-theater text-indigo-400"></i> 我的马甲衣橱
                </h3>
                <span class="text-[11px] font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">{{ forumStore.alts.length }} 个</span>
              </div>
              <div class="flex items-center gap-2">
                <img :src="forumStore.currentUser.avatar" class="w-8 h-8 rounded-full border-2 border-indigo-100 shadow-sm">
                <span class="text-[13px] font-bold text-slate-600">当前：{{ forumStore.currentUser.name }}</span>
                <i class="fa-solid fa-chevron-right text-slate-300 ml-auto"></i>
              </div>
           </div>
      
           <!-- My Likes Collection -->
           <div @click="profileSubPage = 'likes'"
                class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-rose-100/50 cursor-pointer hover:shadow-md transition-shadow">
              <h3 class="font-black text-slate-800 text-[16px] mb-1 flex items-center gap-2">
                <i class="fa-solid fa-heart text-rose-400 text-sm"></i> 我的喜欢
              </h3>
              <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">收藏的美好瞬间</p>
                    
              <div v-if="forumStore.getMyLikedPosts.length > 0" class="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div v-for="likedPost in forumStore.getMyLikedPosts.slice(0, 3)" :key="likedPost.id" 
                     @click="goToLikedPost(likedPost)"
                     class="p-3 bg-rose-50/30 border border-rose-100 rounded-[16px] cursor-pointer hover:bg-rose-50 transition-all group">
                  <div class="flex items-center gap-2.5 mb-1.5">
                    <img :src="likedPost.avatar" class="w-7 h-7 rounded-full border border-rose-100 bg-white object-cover">
                    <span class="text-[12px] font-bold text-slate-600 flex-1 truncate">{{ likedPost.authorName }}</span>
                    <span class="text-[9px] text-rose-400 font-bold bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200">{{ likedPost._forumName }}</span>
                  </div>
                  <div class="text-[13px] font-bold text-slate-700 truncate group-hover:text-rose-600 transition-colors">{{ likedPost.title }}</div>
                  <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-medium">
                    <span class="flex items-center gap-1"><i class="fa-solid fa-heart text-rose-400 text-[8px]"></i> {{ likedPost.likes }}</span>
                    <span>{{ formatTime(likedPost._likedAt) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-6 text-slate-300 text-sm">
                <i class="fa-regular fa-heart text-2xl mb-2 block"></i>
                还没有喜欢的帖子哦~
              </div>
           </div>
      
           <!-- My Posts -->
           <div @click="profileSubPage = 'myPosts'"
                class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-blue-100/50 cursor-pointer hover:shadow-md transition-shadow">
              <h3 class="font-black text-slate-800 text-[16px] mb-1 flex items-center gap-2">
                <i class="fa-solid fa-file-pen text-blue-400 text-sm"></i> 我的帖子
              </h3>
              <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">使用当前马甲发布的帖子</p>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <img :src="currentAltData?.avatar" class="w-8 h-8 rounded-full border-2 border-blue-200 shadow-sm">
                  <span class="text-[13px] font-bold text-slate-600">{{ currentAltData?.name }}</span>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300"></i>
              </div>
           </div>
      
           <!-- Moderator Panel -->
           <div @click="profileSubPage = 'admin'"
                class="bg-white p-5 rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-amber-100/50 cursor-pointer hover:shadow-md transition-shadow">
              <h3 class="font-black text-slate-800 text-[16px] mb-1 flex items-center gap-2">
                <i class="fa-solid fa-shield-halved text-amber-500 text-sm"></i> 版务管理
              </h3>
              <p class="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">每个板块有独立的版主和管理员团队</p>
              <div v-if="currentModData" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <img :src="currentModData.moderatorAvatar || ''" class="w-8 h-8 rounded-full border-2 border-amber-200 shadow-sm">
                  <span class="text-[13px] font-bold text-slate-600">{{ currentModData.moderatorName || 'NPC' }}</span>
                  <span class="px-2 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black tracking-widest border border-amber-200">版主</span>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300"></i>
              </div>
           </div>
         </template>
      </div>

    </main>

    <!-- Bottom Action Navigation -->
    <div class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-[#e8f3f3] flex items-center justify-around pb-safe pt-1 z-40 shadow-[0_-15px_40px_-5px_rgba(0,0,0,0.06)] rounded-t-[20px]">
       <button @click="currentTab = 'discover'" class="flex flex-col items-center justify-center w-20 py-2 gap-1.5 transition-all outline-none" :class="currentTab === 'discover' ? 'text-teal-500 -translate-y-1' : 'text-slate-400 hover:text-slate-600'">
         <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="currentTab === 'discover' ? 'bg-teal-50' : ''">
            <i class="fa-solid fa-seedling text-[20px]"></i>
         </div>
         <span class="text-[10px] font-bold tracking-widest text-center block w-full">发现</span>
       </button>
       <button @click="currentTab = 'forum'" class="flex flex-col items-center justify-center w-20 py-2 gap-1.5 transition-all outline-none relative" :class="currentTab === 'forum' ? 'text-teal-500 -translate-y-1' : 'text-slate-400 hover:text-slate-600'">
         <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="currentTab === 'forum' ? 'bg-teal-50 shadow-inner' : ''">
            <i class="fa-brands fa-pagelines text-[20px]" :class="currentTab === 'forum' ? 'drop-shadow-sm' : ''"></i>
         </div>
         <span class="text-[10px] font-bold tracking-widest text-center block w-full">主页</span>
       </button>
       <button @click="currentTab = 'profile'" class="flex flex-col items-center justify-center w-20 py-2 gap-1.5 transition-all outline-none relative" :class="currentTab === 'profile' ? 'text-teal-500 -translate-y-1' : 'text-slate-400 hover:text-slate-600'">
         <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="currentTab === 'profile' ? 'bg-teal-50' : ''">
            <i class="fa-regular fa-face-smile-wink text-[20px]"></i>
         </div>
         <span class="text-[10px] font-bold tracking-widest text-center block w-full">我的</span>
         <!-- Alt Avatar Micro Badge -->
         <img v-if="currentTab !== 'profile'" :src="forumStore.currentUser.avatar" class="absolute right-3 top-1 w-4 h-4 rounded-full border-[1.5px] border-white shadow-sm bg-white" />
       </button>
    </div>

    <!-- =============== OVERLAYS =============== -->

    <!-- Detail Overlay -->
    <ForumPostDetail 
      v-if="selectedPost" 
      :post="selectedPost"
      :comments="forumStore.getPostComments(forumStore.currentForumId, selectedPost.id)"
      :is-generating="forumStore.isGenerating"
      :alts="forumStore.alts"
      :current-user="forumStore.currentUser"
      :current-alt-id="forumStore.currentAltId"
      :is-mod="forumStore.isUserStaff"
      :is-liked="forumStore.isPostLiked(selectedPost.id)"
      :mention-users="mentionUsers"
      @update:currentAltId="(val) => { forumStore.currentAltId = val; forumStore.saveStore(); }"
      @close="selectedPost = null"
      @generate="generateMoreComments"
      @send="handleSendComment"
      @share="sharePostTarget = selectedPost"
      @toggle-like="forumStore.toggleLike($event)"
      @toggle-pin="(id) => forumStore.togglePostPin(id)"
      @toggle-featured="(id) => forumStore.togglePostFeatured(id)"
      @toggle-hot="(id) => forumStore.togglePostHot(id)"
      @toggle-ban="(id) => forumStore.togglePostBan(id)"
      @ban-user="handleBanUser"
      @delete-comment="handleDeleteComment"
    />

    <!-- Add New Forum Modal -->
    <div v-if="showNewForumModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-fade-in">
      <div class="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col border border-white">
        <div class="border-b border-teal-50/50 p-5 flex justify-between items-center relative overflow-hidden">
           <div class="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-emerald-500/5"></div>
           <h3 class="font-bold text-slate-800 text-[17px] relative z-10">✨ 播种新岛屿</h3>
           <button @click="showNewForumModal = false" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors flex items-center justify-center bg-white border border-slate-100 shadow-sm relative z-10"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-6 flex flex-col gap-4 bg-[#f8fbfb]">
          <input v-model="newForumForm.name" type="text" placeholder="岛屿名称 (如: 周末小树洞)" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 text-[14px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all font-bold text-slate-800 shadow-sm">
          <div class="relative">
            <textarea v-model="newForumForm.desc" rows="2" placeholder="给它写个背景设定/简介，AI才能更好代入哦" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 pr-20 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all text-slate-600 shadow-sm resize-none"></textarea>
            <button @click="handleAutoDesc" :disabled="forumStore.isGeneratingDesc || !newForumForm.name.trim()" class="absolute top-2 right-2 px-2.5 py-1.5 bg-teal-50 text-teal-500 border border-teal-200 rounded-xl text-[10px] font-bold hover:bg-teal-100 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1">
              <i :class="forumStore.isGeneratingDesc ? 'fa-solid fa-circle-notch animate-spin' : 'fa-solid fa-wand-magic-sparkles'" class="text-[9px]"></i>
              AI
            </button>
          </div>
          
          <div class="flex flex-col gap-1.5 mt-1">
             <div class="flex justify-between items-center px-1">
                <label class="text-[11px] font-bold text-slate-400 tracking-wider">最近大伙儿由于什么事热闹？(一行一个)</label>
                <button @click="handleAutoTopics(newForumForm)" :disabled="forumStore.isGeneratingTopics" class="text-[11px] font-bold text-teal-500 hover:text-teal-600 flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-50">
                    <i v-if="forumStore.isGeneratingTopics" class="fa-solid fa-circle-notch animate-spin"></i>
                    <i v-else class="fa-solid fa-wand-magic-sparkles"></i>
                    AI帮我想
                </button>
             </div>
             <textarea v-model="newForumForm.topics" rows="3" placeholder="#早八人的痛苦#&#10;#分享今日彩虹#" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all text-teal-600 font-medium shadow-sm resize-none"></textarea>
          </div>
          
          <button @click="submitNewForum" :disabled="!newForumForm.name.trim()" class="w-full py-3.5 mt-2 bg-gradient-to-r from-teal-400 to-emerald-400 text-white rounded-[20px] font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50 tracking-wider text-[15px] hover:shadow-xl transition-all">确认创建 / 上岛</button>
        </div>
      </div>
    </div>

    <!-- Create Alt Modal -->
    <div v-if="isAddAltVisible" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-fade-in">
      <div class="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col border border-white">
        <div class="border-b border-indigo-50/50 p-5 flex justify-between items-center relative overflow-hidden">
           <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5"></div>
           <h3 class="font-bold text-slate-800 text-[17px] relative z-10">👗 挑选新马甲</h3>
           <button @click="isAddAltVisible = false" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors flex items-center justify-center bg-white border border-slate-100 shadow-sm relative z-10"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-6 flex flex-col gap-4 bg-[#f8f9fc]">
          
          <!-- Avatar Uploader -->
          <div class="flex justify-center mb-1 relative shrink-0">
            <div class="relative group cursor-pointer w-[88px] h-[88px]">
              <img :src="newAltForm.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${newAltForm.name || 'mint'}`" class="w-full h-full rounded-full border-4 border-white shadow-md object-cover bg-slate-50 transition-all group-hover:blur-[2px]">
              
              <label class="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <i class="fa-solid fa-camera mb-1 shadow-sm"></i>
                <span class="text-[10px] font-bold tracking-widest">上传</span>
                <input type="file" accept="image/*" class="hidden" @change="handleAvatarUpload">
              </label>
            </div>
          </div>
          <input v-model="newAltForm.avatar" type="text" placeholder="或者贴个网络图片链接 (选填)" class="w-full bg-white rounded-xl border border-indigo-100 px-3 py-2 text-[11px] focus:outline-none focus:border-indigo-400 transition-all font-medium text-slate-500 shadow-sm text-center">

          <input v-model="newAltForm.name" type="text" placeholder="取个昵称" class="w-full bg-white rounded-[16px] border border-indigo-100 px-4 py-3 text-[14px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all font-bold shadow-sm">
          <input v-model="newAltForm.role" type="text" placeholder="给自己帖个小标签 (如: 重度熬夜选手)" class="w-full bg-white rounded-[16px] border border-indigo-100 px-4 py-3 text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all text-slate-600 shadow-sm">
          
          <label class="flex items-center gap-3 p-3 mt-1 border border-rose-100 bg-rose-50/50 rounded-[16px] cursor-pointer shadow-sm relative overflow-hidden group hover:bg-rose-50 transition-colors">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-striped-brick.png')] opacity-[0.03]"></div>
            <div class="relative flex items-center justify-center">
                <input type="checkbox" v-model="newAltForm.isRealUser" class="peer sr-only">
                <div class="w-5 h-5 rounded flex items-center justify-center border-2 border-rose-200 peer-checked:bg-rose-400 peer-checked:border-rose-400 transition-colors bg-white">
                    <i class="fa-solid fa-check text-white text-[10px] opacity-0 peer-checked:opacity-100"></i>
                </div>
            </div>
            <div class="flex flex-col relative z-10">
              <span class="text-[13px] font-bold text-rose-700 tracking-wide">实名本尊防护区</span>
              <span class="text-[10px] text-rose-500/80 font-medium">勾选证明是你本人，AI绝不敢冒充你发帖或说话。</span>
            </div>
          </label>

          <button @click="submitNewAlt" :disabled="!newAltForm.name.trim()" class="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-400 to-violet-400 text-white rounded-[20px] font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 hover:shadow-xl transition-all text-[15px] tracking-wider">换上马甲</button>
        </div>
      </div>
    </div>

    <!-- Settings (Edit Current Forum) Modal -->
    <div v-if="showSettings" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-fade-in">
      <div class="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white">
        <div class="bg-slate-50 border-b border-teal-50/50 p-5 flex justify-between items-center relative overflow-hidden">
           <div class="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-emerald-500/5"></div>
           <h3 class="font-bold text-slate-800 text-[17px] relative z-10">⚙️ 岛屿管理台</h3>
           <button @click="saveSettings" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors flex items-center justify-center bg-white border border-slate-100 shadow-sm relative z-10"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div class="p-6 flex-1 overflow-y-auto flex flex-col gap-5 bg-[#f8fbfb]">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">名字</label>
            <input v-model="editForm.forumName" type="text" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 text-[14px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all font-bold text-slate-800 shadow-sm">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">背景与规则</label>
            <textarea v-model="editForm.forumDesc" rows="3" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all text-slate-600 shadow-sm resize-none"></textarea>
          </div>
          <div>
            <div class="flex justify-between items-center mb-1.5 px-1">
               <label class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">近日热榜 (一行一个)</label>
               <button @click="handleAutoTopics(editForm)" :disabled="forumStore.isGeneratingTopics" class="text-[11px] font-bold text-teal-500 hover:text-teal-600 flex items-center gap-1 active:scale-95 transition-transform disabled:opacity-50">
                   <i v-if="forumStore.isGeneratingTopics" class="fa-solid fa-circle-notch animate-spin"></i>
                   <i v-else class="fa-solid fa-wand-magic-sparkles"></i>
                   AI帮我想
               </button>
            </div>
            <textarea v-model="editForm.trendingTopics" rows="4" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3 text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all text-teal-600 font-medium shadow-sm resize-none"></textarea>
          </div>
          
          <!-- 世界书绑定 -->
          <div>
            <div class="flex items-center gap-2 mb-2 px-1">
               <label class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">世界书内容联动</label>
               <span class="text-[10px] text-amber-500 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                 <i class="fa-solid fa-star mr-1"></i>重要
               </span>
            </div>
            <div class="text-[11px] text-slate-500 mb-2 px-1 leading-relaxed">
              选中的世界书条目将作为该岛屿生成内容的核心依据，AI 在生成帖子和评论时必须严格遵守这些设定。
            </div>
            <div v-if="worldBookStore.books.length === 0" class="bg-slate-50 rounded-[16px] border border-slate-100 p-4 text-center">
              <i class="fa-solid fa-book-open text-slate-300 text-2xl mb-2"></i>
              <div class="text-[12px] text-slate-400">暂无世界书，先去创建一些设定吧</div>
            </div>
            <div v-else class="bg-white rounded-[16px] border border-teal-100 p-3 shadow-sm max-h-48 overflow-y-auto">
              <div v-for="book in worldBookStore.books" :key="book.id" class="mb-2 last:mb-0">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">{{ book.name }}</div>
                <div class="space-y-1">
                  <label v-for="entry in book.entries" :key="entry.id" 
                         class="flex items-start gap-2 p-2 rounded-xl hover:bg-teal-50/50 cursor-pointer transition-colors">
                    <input type="checkbox" 
                           :value="entry.id" 
                           v-model="editForm.worldBookEntries"
                           class="mt-0.5 w-4 h-4 rounded border-slate-300 text-teal-500 focus:ring-teal-500/20">
                    <div class="flex-1 min-w-0">
                      <div class="text-[12px] font-bold text-slate-700 truncate">{{ entry.name }}</div>
                      <div class="text-[10px] text-slate-400 truncate">{{ entry.content.substring(0, 50) }}...</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-5 bg-[#f8fbfb] border-t border-teal-50">
          <button @click="saveSettings" class="w-full py-3.5 bg-gradient-to-r from-teal-400 to-emerald-400 text-white rounded-[20px] font-bold shadow-lg shadow-teal-500/20 tracking-wider transition-all text-[15px] hover:shadow-xl focus:scale-95">保存调整</button>
        </div>
      </div>
    </div>

    <!-- Custom Post Modal -->
    <div v-if="showCustomPostModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-fade-in">
      <div class="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col border border-white">
        <div class="border-b border-teal-50/50 p-5 flex justify-between items-center">
           <h3 class="font-bold text-slate-800 text-[17px] tracking-wide">✏️ 来唠唠嗑</h3>
           <button @click="showCustomPostModal = false" class="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors flex items-center justify-center bg-white border border-slate-100 shadow-sm"><i class="fa-solid fa-arrow-down"></i></button>
        </div>
        
        <div class="p-6 flex-1 flex flex-col gap-4 bg-[#f8fbfb]">
          <input v-model="newPostForm.title" type="text" placeholder="起个吸引人的标题 (必填)" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3.5 text-[15px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-300 shadow-sm leading-tight">
          
          <div class="relative flex flex-col flex-1">
            <textarea v-model="newPostForm.content" rows="6" placeholder="想在这个岛上分享什么点点滴滴？&#10;你可以加上 [draw: 可爱的英文字母画面描述] 召唤AI配图魔法噢~" class="w-full bg-white rounded-[16px] border border-teal-100 px-4 py-3.5 text-[14px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all font-medium text-slate-600 leading-relaxed resize-none shadow-sm placeholder:text-slate-300"></textarea>
            
            <button @click="showMentionMenuNewPost = !showMentionMenuNewPost" class="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-teal-50 text-teal-500 hover:bg-teal-100 transition-colors flex items-center justify-center shadow-sm">
              <i class="fa-solid fa-at text-sm"></i>
            </button>

            <!-- Mention Popup for New Post -->
            <div v-if="showMentionMenuNewPost" class="absolute bottom-12 right-0 w-56 bg-white rounded-[20px] shadow-2xl border border-teal-50 py-2 animate-fade-in origin-bottom-right z-[70] overflow-hidden">
              <div class="px-4 py-1.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase">@ 提及</div>
              <div class="max-h-52 overflow-y-auto custom-scrollbar">
                <button v-for="user in mentionUsers" :key="user.name" @click="insertMentionNewPost(user.name)" class="flex items-center gap-2.5 px-4 py-2.5 w-full text-left hover:bg-teal-50/80 transition-colors">
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
        </div>

        <div class="p-4 flex items-center justify-between border-t border-teal-50 bg-[#f8fbfb]">
          <!-- Quick alt selector view (readonly here to save space) -->
          <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-teal-100 shadow-sm relative pr-4 group overflow-visible max-w-[140px]">
             <img :src="forumStore.currentUser.avatar" class="w-6 h-6 rounded-full object-cover shrink-0">
             <span class="text-[12px] font-bold text-slate-700 truncate tracking-wide pr-3">{{ forumStore.currentUser.name }}</span>
             <div v-if="forumStore.currentUser.isRealUser" class="absolute -right-1 -top-1 bg-rose-50 text-rose-500 rounded-full w-4 h-4 flex items-center justify-center border border-rose-200 shadow-sm" title="实名"><i class="fa-solid fa-shield-halved text-[8px]"></i></div>
          </div>

          <button @click="submitManualPost" :disabled="!newPostForm.content.trim() || !newPostForm.title.trim()" class="px-7 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-50 rounded-full font-bold shadow-lg shadow-slate-800/20 tracking-widest transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 text-[14px]">发布</button>
        </div>
      </div>
    </div>

    <!-- Back to Top Button -->
    <button v-show="showBackToTop" @click="scrollToTop" class="fixed bottom-[90px] right-4 w-12 h-12 bg-white text-teal-500 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-center border border-teal-50 hover:bg-teal-50 transition-all z-40 active:scale-95">
      <i class="fa-solid fa-arrow-up"></i>
    </button>
    
    <!-- Share to Contact Modal -->
    <div v-if="sharePostTarget" class="fixed inset-0 z-[70] flex flex-col justify-end bg-slate-900/40 backdrop-blur-[6px] animate-fade-in" @click.self="sharePostTarget = null">
      <div class="bg-white w-full rounded-t-[32px] overflow-hidden shadow-2xl flex flex-col pt-5 pb-safe relative">
        <div class="px-5 mb-4 flex justify-between items-center">
            <h3 class="font-bold text-slate-800 text-[16px]">分享帖子至...</h3>
            <button @click="sharePostTarget = null" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><i class="fa-solid fa-xmark text-sm"></i></button>
        </div>
        <div class="px-5 max-h-[50vh] overflow-y-auto mb-4 grid grid-cols-4 gap-4">
            <button v-for="c in chatList" :key="c.id" @click="confirmShareToChat(c)" class="flex flex-col items-center gap-2 group outline-none">
                <img :src="c.avatar || 'https://api.dicebear.com/7.x/notionists/svg?seed='+c.name" class="w-[52px] h-[52px] rounded-2xl object-cover bg-slate-50 border border-slate-100 group-hover:scale-[1.05] group-active:scale-95 transition-all shadow-sm group-hover:shadow-md">
                <span class="text-[11px] font-bold tracking-wide text-slate-600 line-clamp-1 w-full text-center">{{c.name}}</span>
            </button>
        </div>
        <div class="h-2"></div>
      </div>
    </div>

    <!-- Custom Toast Notification -->
    <Transition name="toast">
      <div v-if="toastMsg" class="fixed top-[100px] left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
        <div class="bg-slate-800/90 backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-2xl text-[14px] font-bold tracking-wide flex items-center gap-2 min-w-[200px] justify-center border border-white/10">
          <i :class="toastIcon" class="text-sm"></i>
          {{ toastMsg }}
        </div>
      </div>
    </Transition>

    <!-- Custom Confirm Modal -->
    <div v-if="confirmData" class="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-[6px] animate-fade-in" @click.self="confirmData.reject(); confirmData = null">
      <div class="bg-white w-full max-w-[320px] rounded-[28px] overflow-hidden shadow-2xl border border-white">
        <div class="p-6 pb-4 text-center">
          <div class="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" :class="confirmData.danger ? 'bg-red-50' : 'bg-teal-50'">
            <i :class="[confirmData.danger ? 'fa-solid fa-triangle-exclamation text-red-400' : 'fa-solid fa-circle-question text-teal-500', 'text-2xl']"></i>
          </div>
          <h3 class="font-bold text-slate-800 text-[16px] mb-2 leading-snug">{{ confirmData.title || '确认操作' }}</h3>
          <p class="text-slate-500 text-[13px] leading-relaxed font-medium">{{ confirmData.message }}</p>
        </div>
        <div class="flex border-t border-slate-100">
          <button @click="confirmData.reject(); confirmData = null" class="flex-1 py-3.5 text-[14px] font-bold text-slate-400 hover:bg-slate-50 transition-colors">取消</button>
          <button @click="confirmData.resolve(); confirmData = null" class="flex-1 py-3.5 text-[14px] font-bold border-l border-slate-100 transition-colors" :class="confirmData.danger ? 'text-red-500 hover:bg-red-50' : 'text-teal-600 hover:bg-teal-50'">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForumStore } from '@/stores/forumStore'
import { useChatStore } from '@/stores/chatStore'
import { useWorldBookStore } from '@/stores/worldBookStore'
import ForumPostCard from './components/ForumPostCard.vue'
import ForumPostDetail from './components/ForumPostDetail.vue'
import ProfileCharacters from './components/ProfileCharacters.vue'
import ProfileAlts from './components/ProfileAlts.vue'
import ProfileLikes from './components/ProfileLikes.vue'
import ProfileMyPosts from './components/ProfileMyPosts.vue'
import ProfileAdmin from './components/ProfileAdmin.vue'

const forumStore = useForumStore()
const chatStore = useChatStore()
const worldBookStore = useWorldBookStore()
const route = useRoute()
const router = useRouter()
const currentTab = ref('discover') // 'discover' | 'forum' | 'profile'
const profileSubPage = ref(null) // null | 'characters' | 'alts' | 'likes' | 'myPosts' | 'admin'

const chatList = computed(() => Object.values(chatStore.chats))

const currentModData = computed(() => {
  if (!forumStore.currentForumId) return { moderatorName: 'NPC', moderatorAvatar: '', moderatorAltId: null, bannedUsers: [] }
  return forumStore.getModeratorData(forumStore.currentForumId)
})

const mentionUsers = computed(() => {
  const list = []
  const seen = new Set()

  const add = (name, avatar, role, badge) => {
    if (!name || seen.has(name)) return
    list.push({ name, avatar, role, badge })
    seen.add(name)
  }

  // 1. Forum Staff
  if (forumStore.currentForumId) {
    const modData = forumStore.getModeratorData(forumStore.currentForumId)
    if (modData) {
      add(modData.moderatorName, modData.moderatorAvatar, '版主', '版主')
      if (modData.admins) {
        modData.admins.forEach(a => add(a.name, a.avatar, '管理员', '管理'))
      }
    }
  }

  // 2. User Alts
  if (forumStore.alts) {
    forumStore.alts.forEach(a => add(a.name, a.avatar, a.role, '我'))
  }

  // 3. Bound Characters & Contacts
  if (forumStore.boundCharIds) {
    forumStore.boundCharIds.forEach(id => {
      const char = chatStore.chats[id]
      if (char) add(char.name, char.avatar, '绑定角色', '角色')
    })
  }
  
  // Also add other characters from chat list
  chatList.value.forEach(c => add(c.name, c.avatar, '通讯录好友', '好友'))

  // 4. Commenters & Author on current post (if any)
  if (selectedPost.value) {
    const postComments = forumStore.getPostComments(forumStore.currentForumId, selectedPost.value.id)
    postComments.forEach(c => add(c.authorName, c.avatar, '', ''))
    add(selectedPost.value.authorName, selectedPost.value.avatar, '', '楼主')
  }

  return list
})

const directionInput = ref('')
const selectedPost = ref(null)
const currentAltData = computed(() => forumStore.currentUser)

const showSettings = ref(false)
const showCustomPostModal = ref(false)
const showMentionMenuNewPost = ref(false)
const showNewForumModal = ref(false)
const isAddAltVisible = ref(false)
const sharePostTarget = ref(null)
const mainScrollArea = ref(null)
const showBackToTop = ref(false)

// Custom toast & confirm state
const toastMsg = ref('')
const toastIcon = ref('fa-solid fa-check text-teal-300')
const confirmData = ref(null)
let toastTimer = null

function showToast(msg, icon = 'fa-solid fa-check text-teal-300', duration = 2000) {
  clearTimeout(toastTimer)
  toastMsg.value = msg
  toastIcon.value = icon
  toastTimer = setTimeout(() => { toastMsg.value = '' }, duration)
}

function showConfirm(message, title = '确认操作', danger = false) {
  return new Promise((resolve, reject) => {
    confirmData.value = {
      message,
      title,
      danger,
      resolve: () => { resolve(true) },
      reject: () => { resolve(false) }
    }
  })
}

const newPostForm = reactive({ title: '', content: '' })
const newForumForm = reactive({ name: '', desc: '', topics: '' })
const newAltForm = reactive({ name: '', role: '', avatar: '', isRealUser: false })

const editForm = reactive({
  forumName: '',
  forumDesc: '',
  trendingTopics: '',
  worldBookEntries: []
})

onMounted(async () => {
   await forumStore.initStore()
   
   // Handle share link navigation
   if (route.query.forum) {
       selectForum(route.query.forum)
       
       if (route.query.post) {
           nextTick(() => {
               const post = forumStore.currentPosts.find(p => p.id === route.query.post)
               if (post) {
                   openPost(post)
               }
           })
       }
       
       // Clean up URL without triggering reload
       router.replace({ path: '/forum' })
   }
})

function selectForum(id) {
    forumStore.currentForumId = id;
    forumStore.saveStore();
    currentTab.value = 'forum';
    if(mainScrollArea.value) mainScrollArea.value.scrollTop = 0;
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${d.getMonth()+1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}


async function handleAutoDesc() {
  if (!newForumForm.name.trim()) return
  const desc = await forumStore.generateForumDesc(newForumForm.name, newForumForm.desc)
  if (desc) {
    newForumForm.desc = desc
    showToast(newForumForm.desc.trim() ? '简介已润色 ✨' : '简介已生成 ✨', 'fa-solid fa-wand-magic-sparkles text-teal-300')
  }
}

function handleScroll(e) {
    showBackToTop.value = e.target.scrollTop > 400
}

function scrollToTop() {
    if(mainScrollArea.value) mainScrollArea.value.scrollTo({ top: 0, behavior: 'smooth' })
}

async function confirmRemoveForum(id) {
    const ok = await showConfirm('确认抹除这块岛屿吗？（不可恢复）', '删除岛屿', true)
    if (ok) {
        forumStore.removeForum(id);
        showToast('岛屿已删除', 'fa-solid fa-trash text-red-300')
    }
}

async function handleAutoTopics(formTarget) {
    const desc = formTarget.desc || formTarget.forumDesc || '普通的发现社区';
    const generated = await forumStore.generateTrendingTopics(desc);
    if(generated && generated.length) {
        if(formTarget.topics !== undefined) formTarget.topics = generated.join('\n');
        else formTarget.trendingTopics = generated.join('\n');
    }
}

function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    newAltForm.avatar = event.target.result;
  }
  reader.readAsDataURL(file);
}

function submitNewForum() {
    if (!newForumForm.name) return;
    const topicsArr = newForumForm.topics.split('\n').filter(t => t.trim() !== '');
    const newId = forumStore.createForum(newForumForm.name, newForumForm.desc, topicsArr.length ? topicsArr : ['#初来乍到请多关照#']);
    newForumForm.name = '';
    newForumForm.desc = '';
    newForumForm.topics = '';
    showNewForumModal.value = false;
    selectForum(newId);
}

function submitNewAlt() {
    if (!newAltForm.name) return;
    forumStore.createAlt(newAltForm.name, newAltForm.role, newAltForm.isRealUser, newAltForm.avatar.trim() !== '' ? newAltForm.avatar : null);
    newAltForm.name = '';
    newAltForm.role = '';
    newAltForm.avatar = '';
    newAltForm.isRealUser = false;
    isAddAltVisible.value = false;
}

function handleGenerate() {
  forumStore.generatePosts(directionInput.value)
  directionInput.value = ''
  scrollToTop()
}

function openPost(post) {
  selectedPost.value = post
}

function goToLikedPost(likedPost) {
  // If we have a forum ID, switch to it first
  const fid = likedPost._forumId || likedPost.forumId;
  if (fid) {
    forumStore.currentForumId = fid;
    forumStore.saveStore();
  }
  
  // Switch to forum tab and clear any subpages
  currentTab.value = 'forum';
  profileSubPage.value = null;
  
  // Find the post in the store to ensure we have the latest version/context
  const post = forumStore.findPostById(forumStore.currentForumId, likedPost.id);
  if (post) {
    selectedPost.value = post;
  } else {
    // Fallback if not found in current forum (should not happen with correct IDs)
    selectedPost.value = likedPost;
  }
}

function confirmShareToChat(chat) {
  if(!sharePostTarget.value || !forumStore.currentForumId) return;
  const post = sharePostTarget.value;
  let preview = post.content || '';
  preview = preview.replace(/!\[.*?\]\((.*?)\)/g, '').replace(/\n/g, ' ').substring(0, 50);
  
  // Custom structure tag
  const content = `[FORUM_CARD:${forumStore.currentForumId}:${post.id}:${post.title}:${preview}]`;
  
  chatStore.addMessage(chat.id, { role: 'user', content }); 
  sharePostTarget.value = null;
  
  showToast('分享成功！', 'fa-solid fa-paper-plane text-teal-300')
}

function handleSendComment(content) {
  if (!selectedPost.value) return;
  forumStore.sendComment(selectedPost.value.id, content)
}

function generateMoreComments() {
  if (!selectedPost.value) return;
  forumStore.generateMoreComments(selectedPost.value.id)
}

function openSettings() {
  if (!forumStore.currentForum) return;
  editForm.forumName = forumStore.currentForum.name
  editForm.forumDesc = forumStore.currentForum.desc
  editForm.trendingTopics = forumStore.currentForum.trendingTopics.join('\n')
  editForm.worldBookEntries = forumStore.currentForum.worldBookEntries || []
  showSettings.value = true
}

function saveSettings() {
  if (!forumStore.currentForum) return;
  const topicsArr = editForm.trendingTopics.split('\n').filter(t => t.trim() !== '')
  forumStore.editForum(forumStore.currentForumId, editForm.forumName, editForm.forumDesc, topicsArr, editForm.worldBookEntries)
  showSettings.value = false
}

function submitManualPost() {
  if (!newPostForm.content.trim() || !newPostForm.title.trim()) return
  const post = forumStore.sendPost(newPostForm.title, newPostForm.content)
  newPostForm.title = ''
  newPostForm.content = ''
  showCustomPostModal.value = false
  setTimeout(() => openPost(post), 100)
}

function insertMentionNewPost(name) {
  const mention = `@${name} `
  if (!newPostForm.content.includes(mention)) {
    newPostForm.content += (newPostForm.content.endsWith(' ') || newPostForm.content === '' ? '' : ' ') + mention
  }
  showMentionMenuNewPost.value = false
}

async function handleApplyMod() {
  const ok = await showConfirm(`以"${forumStore.currentUser.name}"的身份申请成为版主？`, '申请版主')
  if (ok) {
    forumStore.applyModerator()
    showToast('你现在是版主了 🛡️', 'fa-solid fa-shield-halved text-amber-300')
  }
}

async function handleResignMod() {
  const ok = await showConfirm('确认卸任版主吗？将由NPC接管管理权力。', '卸任版主', true)
  if (ok) {
    forumStore.resignModerator()
    showToast('已卸任，NPC版主上线', 'fa-solid fa-right-from-bracket text-slate-300')
  }
}

async function handleBanUser(userName) {
  const ok = await showConfirm(`确认封号用户"${userName}"吗？该用户将无法发帖回帖。`, '封号用户', true)
  if (ok) {
    forumStore.banUser(userName)
    showToast(`已封号：${userName}`, 'fa-solid fa-user-slash text-red-300')
  }
}

function handleDeleteComment(postId, commentId) {
  forumStore.deleteComment(postId, commentId)
  showToast('已删除评论', 'fa-solid fa-trash-can text-slate-400')
}

function confirmDeletePost(postId) {
  const ok = confirm('确定要删除这个帖子吗？删除后无法恢复。')
  if (ok) {
    forumStore.deletePost(postId)
    showToast('已删除帖子', 'fa-solid fa-trash-can text-slate-400')
    selectedPost.value = null
  }
}

async function confirmClearAllPosts() {
  const ok = await showConfirm('⚠️ 危险操作！确认要清空本版所有帖子和评论吗？此操作不可恢复！', '一键清空', true)
  if (ok) {
    forumStore.clearAllPosts()
    showToast('已清空本版所有帖子', 'fa-solid fa-trash-can text-red-400')
    profileSubPage.value = null
  }
}
function handleBack() {
  if (profileSubPage.value) {
    profileSubPage.value = null
  } else if (currentTab.value !== 'discover') {
    currentTab.value = 'discover'
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.forum-app {
  -webkit-font-smoothing: antialiased;
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideUp {
  0% { transform: translateY(0); }
  20% { transform: translateY(-100%); }
  25% { transform: translateY(-100%); }
  45% { transform: translateY(-200%); }
  50% { transform: translateY(-200%); }
  70% { transform: translateY(-300%); }
  75% { transform: translateY(-300%); }
  95% { transform: translateY(0); }
  100% { transform: translateY(0); }
}
.animate-slide-up > div {
  animation: slideUp 12s infinite cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes progressFast {
  0% { left: -30%; width: 30%; }
  50% { left: 40%; width: 50%; opacity: 0.8; }
  100% { left: 130%; width: 30%; opacity: 0.1; }
}
.animate-progress-fast {
  animation: progressFast 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.text-shadow-sm {
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
/* Custom slim scrollbar for char list */
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
/* Toast transitions */
.toast-enter-active { animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { animation: toastOut 0.2s ease-in forwards; }
@keyframes toastIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-10px); }
}
</style>
