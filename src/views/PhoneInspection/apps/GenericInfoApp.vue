<template>
    <div class="generic-info-app flex flex-col h-full bg-[#FAFAFA]">
        <!-- Header -->
        <div
            class="app-header px-4 pt-14 pb-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
            <button @click="$emit('back')" class="text-xl text-[#8F5E6E]">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="font-bold text-[18px] text-[#8F5E6E]">{{ appTitle }}</span>
            <div class="w-8"></div>
        </div>

        <!-- App Content Based on Type -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">

            <!-- Type 1: Browser (Search Style) -->
            <template v-if="appId === 'browser'">
                <div
                    class="browser-address-bar bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm mb-4 border border-gray-100">
                    <i class="fa-solid fa-lock text-green-400 text-xs"></i>
                    <span
                        class="text-xs text-gray-400 overflow-hidden truncate">https://www.google.com/search?q=...</span>
                </div>
                <div class="section-title text-[12px] font-black text-gray-400 px-1 mb-2">历史记录</div>
                <div v-for="(item, idx) in listData" :key="idx"
                    class="bg-white rounded-xl p-3 mb-2 flex items-center justify-between border border-gray-50 shadow-sm animate-slide-in cursor-pointer active:scale-95 transition-transform"
                    @click="selectedItem = item">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid fa-clock-rotate-left text-pink-200"></i>
                        <span class="text-[14px] font-bold text-[#8F5E6E]">{{ item.title }}</span>
                    </div>
                    <i class="fa-solid fa-arrow-right text-gray-200 text-xs"></i>
                </div>
            </template>

            <!-- Type 2: Notes (Post-it Style) -->
            <template v-else-if="appId === 'notes'">
                <div class="grid grid-cols-2 gap-3">
                    <div v-for="(item, idx) in listData" :key="idx"
                        class="note-card aspect-square p-4 flex flex-col justify-between shadow-md animate-slide-in cursor-pointer active:scale-95 transition-transform"
                        :style="{ backgroundColor: idx % 2 === 0 ? '#FFF9C4' : '#E1F5FE', transform: `rotate(${idx % 2 === 0 ? '-1' : '1'}deg)` }"
                        @click="selectedItem = item">
                        <div class="font-black text-[#5D4037] text-[15px] line-clamp-2">{{ item.title }}</div>
                        <div class="text-[12px] text-[#5D4037]/60 line-clamp-3">{{ item.content }}</div>
                        <div class="text-[10px] text-[#5D4037]/40 text-right">{{ item.time }}</div>
                    </div>
                </div>
            </template>

            <!-- Type 3: Music (Player Style) -->
            <template v-else-if="appId === 'music'">
                <div
                    class="music-player-top bg-white rounded-3xl p-6 flex flex-col items-center shadow-lg border border-pink-50 mb-6">
                    <div
                        class="record-disk w-40 h-40 rounded-full border-[12px] border-black shadow-2xl relative mb-6"
                        :class="{ 'animate-spin-slow': isPlaying }">
                        <div class="absolute inset-0 rounded-full border-2 border-gray-800"></div>
                        <img :src="currentSongCover" class="w-full h-full object-cover rounded-full opacity-80">
                        <div
                            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#F7F7F7] rounded-full border-4 border-black">
                        </div>
                    </div>
                    <h3 class="text-lg font-black text-[#8F5E6E] mb-1">{{ isPlaying ? '正在播放' : '已暂停' }}</h3>
                    <p class="text-xs text-pink-300 font-bold mb-4">{{ currentSongTitle }} - {{ currentSongArtist }}</p>
                    
                    <!-- Progress Bar -->
                    <div class="w-full h-1 bg-pink-100 rounded-full mb-6 relative cursor-pointer" @click="seekMusic">
                        <div class="absolute top-0 left-0 h-full bg-pink-400 rounded-full transition-all" :style="{ width: progress + '%' }"></div>
                        <div
                            class="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-3 bg-white border-2 border-pink-400 rounded-full shadow transition-all"
                            :style="{ left: progress + '%' }">
                        </div>
                    </div>
                    
                    <!-- Controls -->
                    <div class="flex items-center gap-8 text-2xl text-pink-400">
                        <i class="fa-solid fa-backward-step cursor-pointer active:scale-90 transition-transform" @click="prevSong"></i>
                        <i 
                            :class="isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'"
                            class="text-4xl cursor-pointer active:scale-90 transition-transform"
                            @click="togglePlay"
                        ></i>
                        <i class="fa-solid fa-forward-step cursor-pointer active:scale-90 transition-transform" @click="nextSong"></i>
                    </div>
                    
                    <!-- Hidden Audio Element -->
                    <audio ref="audioPlayer" :src="currentAudioUrl" @timeupdate="updateProgress" @ended="nextSong" @loadedmetadata="onAudioLoaded"></audio>
                </div>
                
                <!-- Playlist -->
                <div class="section-title text-[12px] font-black text-gray-400 px-1 mb-3">最近收听</div>
                <div v-for="(item, idx) in listData" :key="idx"
                    class="bg-white/60 p-4 rounded-2xl flex items-center justify-between mb-2 cursor-pointer active:scale-95 transition-transform"
                    :class="{ 'ring-2 ring-pink-300': currentSongIndex === idx }"
                    @click="playSong(idx)">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center text-pink-400">
                            <i v-if="currentSongIndex === idx && isPlaying" class="fa-solid fa-volume-high animate-pulse"></i>
                            <i v-else class="fa-solid fa-music"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-[#8F5E6E]">{{ item.title }}</span>
                            <span class="text-xs text-gray-400">{{ item.detail }}</span>
                        </div>
                    </div>
                    <span class="text-xs text-gray-300">{{ item.time || '' }}</span>
                </div>
            </template>

            <!-- Type 4: Calendar (Grid Style) -->
            <template v-else-if="appId === 'calendar'">
                <div class="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mb-6">
                    <div class="flex justify-between items-center mb-6 px-1">
                        <span class="font-black text-[#8F5E6E] text-lg">2026年3月</span>
                        <div class="flex gap-4 text-pink-300">
                            <i class="fa-solid fa-chevron-left"></i>
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>
                    <div class="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-black text-gray-300">
                        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                    </div>
                    <div class="grid grid-cols-7 gap-2 text-center">
                        <div v-for="day in 31" :key="day"
                            class="h-9 flex items-center justify-center text-sm font-bold rounded-lg relative"
                            :class="day === 7 ? 'bg-pink-400 text-white shadow-pink' : 'text-[#8F5E6E]'">
                            {{ day }}
                            <div v-if="[5, 12, 20].includes(day)"
                                class="absolute bottom-1.5 w-1 h-1 bg-pink-300 rounded-full"></div>
                        </div>
                    </div>
                </div>
                <div class="section-title text-[12px] font-black text-gray-400 px-1 mb-3">日程表</div>
                <div v-for="(item, idx) in listData" :key="idx"
                    class="bg-white rounded-2xl p-4 flex gap-4 border border-gray-50 shadow-sm mb-3 cursor-pointer active:scale-95 transition-transform"
                    @click="selectedItem = item">
                    <div class="w-1 bg-pink-100 rounded-full"></div>
                    <div class="flex-1">
                        <h4 class="font-black text-[#8F5E6E] text-[15px] mb-1">{{ item.title }}</h4>
                        <p class="text-xs text-gray-400">{{ item.detail }}</p>
                    </div>
                    <span class="text-[11px] font-black text-pink-200">{{ item.time }}</span>
                </div>
            </template>

            <!-- Type 5: Timeline (Footprints, Forum) -->
            <template v-else-if="['footprints', 'forum'].includes(appId)">
                <div v-for="(post, idx) in listData" :key="idx"
                    class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50 mb-4 animate-slide-in cursor-pointer active:scale-95 transition-transform"
                    @click="selectedItem = post">
                    <img v-if="post.image" :src="post.image" class="w-full h-40 object-cover">
                    <div class="p-4">
                        <div class="text-[11px] text-[#FC6C9C] font-black mb-1 flex items-center">
                            <i class="fa-solid fa-location-dot mr-1"></i> {{ post.location || post.category }}
                        </div>
                        <h4 class="font-black text-[#5A5A5A] text-[16px] mb-2">{{ post.title }}</h4>
                        <p class="text-[13px] text-gray-500 leading-relaxed line-clamp-2">{{ post.content ||
                            '在这里留下了珍贵的回忆喵~' }}</p>
                        <div
                            class="flex justify-between items-center mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400">
                            <span>{{ post.time || '2026-03-07' }}</span>
                            <div class="flex gap-3">
                                <span><i class="fa-regular fa-heart"></i> {{ post.likes || 0 }}</span>
                                <span><i class="fa-regular fa-comment"></i> {{ post.comments || 0 }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <!-- Type 6: Generic Lists (Messages, Recorder, Files, Reminders) -->
            <template v-else>
                <div v-for="(item, idx) in listData" :key="idx"
                    class="bg-white rounded-2xl p-4 flex items-center gap-4 animate-slide-in border border-gray-50 shadow-sm cursor-pointer active:scale-95 transition-transform"
                    @click="selectedItem = item">
                    <div
                        class="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-400 text-xl">
                        <i :class="getItemIconForOther(item)"></i>
                    </div>
                    <div class="flex-1 flex flex-col">
                        <span class="font-black text-[#8F5E6E] text-[15px]">{{ item.name || item.title || item.sender ||
                            item.fileName }}</span>
                        <span class="text-xs text-gray-400 truncate">{{ item.detail || item.content || item.duration ||
                            item.size || '正在运行中...' }}</span>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] text-gray-300">{{ item.time || '10:00' }}</span>
                        <i v-if="appId === 'recorder'" class="fa-solid fa-play text-[10px] text-pink-200"></i>
                    </div>
                </div>
            </template>

        </div>

        <!-- App-Specific Detail Overlay -->
        <Transition name="slide-up">
            <div v-if="selectedItem" class="fixed inset-0 z-[100] bg-[#F5F5F7] flex flex-col overflow-hidden">
                <!-- Header for Detail -->
                <div
                    class="pt-16 pb-3 px-4 flex items-center bg-white border-b border-gray-100 shadow-sm relative z-10">
                    <button @click="selectedItem = null"
                        class="w-10 h-10 flex items-center justify-center text-[#FD70A1] active:scale-95">
                        <i class="fa-solid fa-chevron-left text-lg"></i>
                    </button>
                    <span class="flex-1 text-center font-bold text-gray-800 truncate px-4">
                        {{ getDetailTitle }}
                    </span>
                    <div class="w-10"></div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-y-auto p-5 pb-20 bg-[#F5F5F7]">
                    <!-- 1. Notes Detail (Fragment Style) -->
                    <div v-if="appId === 'notes' || appId === 'reminders'"
                        class="bg-[#FFF9C4] rounded-2xl p-6 shadow-md border-t-8 border-[#FDD835] relative min-h-[300px]">
                        <div class="absolute top-4 right-4 text-[#FBC02D] opacity-20">
                            <i class="fa-solid fa-note-sticky text-5xl"></i>
                        </div>
                        <h2 class="text-xl font-black text-[#827717] mb-6 border-b border-[#FDD835]/30 pb-3">
                            {{ selectedItem.title }}
                        </h2>
                        <p class="text-[16px] text-[#5D4037] leading-8 whitespace-pre-wrap font-bold font-serif italic">
                            {{ selectedItem.content || selectedItem.detail }}
                        </p>
                        <div
                            class="mt-12 pt-4 border-t border-[#FDD835]/20 text-right text-[12px] text-[#9E9D24] font-black">
                            {{ selectedItem.time || '2026-03-07' }}
                        </div>
                    </div>

                    <!-- 2. Messages Detail -->
                    <div v-else-if="appId === 'messages'" class="flex flex-col h-full">
                        <div class="flex flex-col items-center mb-10">
                            <div
                                class="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-4xl mb-3 shadow-inner">
                                <i class="fa-solid fa-user"></i>
                            </div>
                            <span class="font-black text-gray-800 text-lg">{{ selectedItem.sender }}</span>
                            <div class="flex items-center gap-1 mt-1">
                                <i class="fa-solid fa-lock text-[10px] text-green-400"></i>
                                <span
                                    class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">iMessage</span>
                            </div>
                        </div>
                        <!-- Message Bubbles -->
                        <div v-if="selectedItem.sender === currentCharName || selectedItem.isMe || selectedItem.role === 'sent'" class="flex justify-end mb-4">
                            <div
                                class="bg-gradient-to-br from-green-400 to-green-500 rounded-2xl px-5 py-3 shadow-sm border border-green-300 max-w-[85%] relative animate-pop-in text-white">
                                <p class="text-[16px] leading-relaxed font-bold">{{ selectedItem.content }}</p>
                                <span class="text-[10px] text-white/60 font-black absolute bottom-[-20px] right-1">
                                    {{ selectedItem.time }}
                                </span>
                            </div>
                        </div>
                        <div v-else class="flex justify-start mb-4">
                            <div
                                class="bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100 max-w-[85%] relative animate-pop-in">
                                <p class="text-[16px] text-gray-800 leading-relaxed font-medium">{{ selectedItem.content }}</p>
                                <span class="text-[10px] text-gray-300 font-bold absolute bottom-[-20px] left-1">
                                    {{ selectedItem.time }}
                                </span>
                            </div>
                        </div>
                        <div class="mt-16 flex flex-col items-center opacity-30">
                            <div class="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
                            <div class="w-1 h-1 bg-gray-400 rounded-full mb-1"></div>
                            <div class="w-1 h-1 bg-gray-400 rounded-full"></div>
                        </div>
                    </div>

                    <!-- 3. Forum Detail -->
                    <div v-else-if="appId === 'forum'"
                        class="bg-white rounded-[32px] p-6 shadow-md border border-pink-50 min-h-[400px]">
                        <div class="flex items-center gap-4 mb-6">
                            <div
                                class="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center text-pink-400 text-xl border-2 border-white shadow-sm">
                                <i class="fa-solid fa-user-astronaut"></i>
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between">
                                    <span class="font-black text-gray-800">匿名小狸</span>
                                    <span class="text-[10px] text-gray-300">{{ selectedItem.time || '1小时前' }}</span>
                                </div>
                                <div class="text-[11px] text-pink-300 font-black mt-1"># {{ selectedItem.category }}
                                </div>
                            </div>
                        </div>
                        <h2 class="text-xl font-black text-gray-900 mb-4 leading-snug">{{ selectedItem.title }}</h2>
                        <div class="bg-gray-50/50 rounded-2xl p-5 mb-6 border border-gray-50">
                            <p class="text-[16px] text-gray-700 leading-8 font-medium italic">{{ selectedItem.content }}
                            </p>
                        </div>
                        <div class="flex items-center gap-6 pt-4 border-t border-gray-100">
                            <button
                                class="flex items-center gap-2 text-pink-400 font-black active:scale-90 transition-transform">
                                <i class="fa-solid fa-heart"></i>
                                <span class="text-sm">{{ selectedItem.likes }}</span>
                            </button>
                            <button
                                class="flex items-center gap-2 text-gray-400 font-black active:scale-90 transition-transform">
                                <i class="fa-solid fa-comment"></i>
                                <span class="text-sm">{{ selectedItem.comments }}</span>
                            </button>
                            <div class="flex-1 text-right">
                                <i class="fa-solid fa-share-nodes text-gray-200"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 4. Footprints Detail -->
                    <div v-else-if="appId === 'footprints'"
                        class="bg-white rounded-[40px] shadow-lg overflow-hidden flex flex-col max-w-[340px] mx-auto border-4 border-white">
                        <div class="h-64 relative overflow-hidden">
                            <img :src="selectedItem.image" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                            <div class="absolute bottom-4 left-6 right-6">
                                <div class="flex items-center gap-2 text-white">
                                    <i class="fa-solid fa-location-dot"></i>
                                    <span class="font-black text-sm">{{ selectedItem.location }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="p-8 relative">
                            <div
                                class="absolute -top-6 right-8 w-12 h-12 bg-[#FC6C9C] rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white">
                                <i class="fa-solid fa-camera"></i>
                            </div>
                            <h2 class="text-2xl font-black text-[#8F5E6E] mb-4 leading-tight">{{ selectedItem.title }}
                            </h2>
                            <p class="text-[15px] text-[#A66D7A] leading-7 font-bold italic">{{ selectedItem.content }}
                            </p>
                            <div
                                class="mt-10 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-300 font-black uppercase tracking-widest">
                                <span>Memento</span>
                                <span>{{ selectedItem.time }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 5. Browser/Search Detail -->
                    <div v-else-if="appId === 'browser' || appId === 'history'"
                        class="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col animate-pop-in">
                        <div class="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-100">
                            <div class="flex gap-1.5">
                                <div class="w-2 h-2 rounded-full bg-red-300"></div>
                                <div class="w-2 h-2 rounded-full bg-yellow-300"></div>
                                <div class="w-2 h-2 rounded-full bg-green-300"></div>
                            </div>
                            <div
                                class="flex-1 bg-white rounded-full h-7 px-4 flex items-center text-[11px] text-gray-400 font-medium truncate shadow-inner">
                                <i class="fa-solid fa-lock text-[9px] mr-2 text-green-300"></i>
                                {{ selectedItem.url || 'https://www.google.com/search' }}
                            </div>
                        </div>
                        <div class="p-8 overflow-y-auto">
                            <h2
                                class="text-2xl font-black text-blue-500 mb-6 leading-tight hover:underline cursor-pointer">
                                {{
                                    selectedItem.title }}</h2>
                            <div class="space-y-5">
                                <div class="h-4 bg-gray-50 rounded-full w-full"></div>
                                <div class="h-4 bg-gray-50 rounded-full w-full"></div>
                                <div class="h-4 bg-gray-50 rounded-full w-[80%]"></div>
                                <div class="h-4 bg-gray-50 rounded-full w-full"></div>
                                <div class="h-4 bg-gray-50 rounded-full w-[60%]"></div>
                            </div>
                            <div
                                class="mt-12 p-6 bg-blue-50/50 rounded-3xl border border-blue-50 flex flex-col items-center">
                                <i class="fa-solid fa-circle-notch animate-spin text-blue-300 text-2xl mb-4"></i>
                                <span class="text-xs text-blue-400 font-black">正在深度获取网页内容喵...</span>
                            </div>
                        </div>
                    </div>

                    <!-- 6. Recorder Detail -->
                    <div v-else-if="appId === 'recorder'"
                        class="bg-[#2D2D2D] rounded-[40px] p-8 shadow-2xl flex flex-col items-center min-h-[450px] text-white">
                        <div class="text-[11px] font-black opacity-40 uppercase tracking-[4px] mb-8">Voice Recording
                        </div>
                        <div class="w-full h-32 flex items-center justify-center gap-1 mb-8">
                            <div v-for="h in [20, 40, 60, 30, 80, 50, 90, 40, 70, 30, 50]" :key="h"
                                class="w-1 bg-pink-400 rounded-full animate-wave"
                                :style="{ height: h + '%', animationDelay: (h * 0.1) + 's' }"></div>
                        </div>
                        <h2 class="text-xl font-black mb-2">{{ selectedItem.title }}</h2>
                        <p class="text-[12px] opacity-40 font-bold mb-10">{{ selectedItem.time }} · {{
                            selectedItem.duration }}
                        </p>

                        <div
                            class="bg-white/5 rounded-3xl p-6 w-full mb-10 italic text-sm text-center text-pink-100/60 leading-relaxed font-serif">
                            "{{ selectedItem.content || '暂无文字转写内容喵...' }}"
                        </div>

                        <div class="flex items-center gap-10 text-3xl">
                            <i class="fa-solid fa-backward-step opacity-40"></i>
                            <div
                                class="w-16 h-16 rounded-full bg-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20 active:scale-90 transition-transform">
                                <i class="fa-solid fa-play ml-1"></i>
                            </div>
                            <i class="fa-solid fa-forward-step opacity-40"></i>
                        </div>
                    </div>

                    <!-- 7. Files Detail -->
                    <div v-else-if="appId === 'files'"
                        class="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 flex flex-col min-h-[450px]">
                        <div class="bg-gray-50 p-6 flex items-center gap-4 border-b border-gray-100">
                            <div
                                class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500 text-2xl shadow-inner-sm">
                                <i class="fa-solid fa-file-lines"></i>
                            </div>
                            <div>
                                <h3 class="font-black text-gray-800 text-lg leading-tight truncate max-w-[200px]">{{
                                    selectedItem.fileName }}</h3>
                                <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{{
                                    selectedItem.size }} · Document</p>
                            </div>
                        </div>
                        <div class="flex-1 p-8 flex flex-col">
                            <div class="space-y-4 opacity-10">
                                <div v-for="n in 8" :key="n" class="h-3 bg-gray-900 rounded-full"
                                    :style="{ width: (Math.random() * 40 + 60) + '%' }"></div>
                            </div>
                            <div
                                class="mt-auto p-6 bg-blue-50/30 rounded-[32px] border-2 border-dashed border-blue-100 flex flex-col items-center">
                                <i class="fa-solid fa-cloud-arrow-down text-blue-300 text-3xl mb-4"></i>
                                <span class="text-xs text-blue-400 font-black">正在从云端同步完整文档...</span>
                            </div>
                        </div>
                    </div>

                    <!-- 8. Default Detail View -->
                    <div v-else
                        class="bg-white rounded-[40px] p-8 shadow-xl border-2 border-pink-50 animate-pop-in min-h-[300px] flex flex-col">
                        <div class="flex items-center gap-5 mb-8">
                            <div
                                class="w-16 h-16 rounded-3xl bg-[#FFF0F4] flex items-center justify-center text-[#FD70A1] text-3xl shadow-sm">
                                <i :class="getItemIconForOther(selectedItem)"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-2xl font-black text-[#8F5E6E] leading-tight truncate">
                                    {{ selectedItem.title || selectedItem.sender || selectedItem.fileName ||
                                        selectedItem.name
                                    }}
                                </h3>
                                <p class="text-[12px] text-gray-400 font-black mt-1">
                                    {{ selectedItem.time || selectedItem.date || '现在' }}
                                    {{ selectedItem.location ? ' · ' + selectedItem.location : '' }}
                                </p>
                            </div>
                        </div>
                        <div class="bg-[#FAFAFA] rounded-[30px] p-6 mb-6 flex-1 border border-gray-50">
                            <p class="text-[16px] text-[#8F5E6E] leading-relaxed font-bold">{{ selectedItem.content ||
                                selectedItem.detail || '暂无更多详细内容喵~' }}</p>
                        </div>
                        <img v-if="selectedItem.image" :src="selectedItem.image"
                            class="w-full rounded-[24px] shadow-sm mb-4">
                        <div v-if="selectedItem.size" class="text-[11px] text-gray-300 font-black mt-2">ITEM ID: {{
                            selectedItem.id || 'GEN-01' }} · SIZE: {{ selectedItem.size }}</div>
                    </div>
                </div>

                <!-- Footer Action -->
                <div
                    class="p-6 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-center pb-12 relative z-10 shadow-up">
                    <button @click="selectedItem = null"
                        class="px-12 py-4 bg-[#FD70A1] text-white rounded-full font-black shadow-lg shadow-pink-100 active:scale-95 transition-all text-sm uppercase tracking-widest">
                        返回内容列表
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
    appId: String,
    appData: Object,
    appTitle: String,
    currentCharName: String // The name of the mobile owner (character)
})

const emit = defineEmits(['back'])

const selectedItem = ref(null)
const audioPlayer = ref(null)

// Music Player State
const currentSongIndex = ref(0)
const isPlaying = ref(false)
const progress = ref(0)
const duration = ref(0)

const getDetailTitle = computed(() => {
    if (!selectedItem.value) return ''
    const titles = {
        notes: '备忘详情',
        reminders: '待办任务',
        messages: '短信详情',
        forum: '狸猫社区',
        browser: '智能搜索',
        history: '访问记录',
        files: '文件概览',
        footprints: '足迹心事'
    }
    return titles[props.appId] || '内容详情'
})

const listData = computed(() => {
    // If we have real data from the store, use it!
    const realData = props.appData?.items || props.appData?.history || props.appData?.locations || props.appData?.posts || props.appData?.records || props.appData?.events || props.appData?.conversations
    
    if (Array.isArray(realData)) {
        // 全局排序逻辑：最新的在前面
        return [...realData].sort((a, b) => {
            const timeA = a.timestamp || (a.time ? new Date(a.time).getTime() : 0)
            const timeB = b.timestamp || (b.time ? new Date(b.time).getTime() : 0)
            return timeB - timeA
        })
    }
    
    return realData || []
})

// Music Player Computed
const currentSong = computed(() => listData.value[currentSongIndex.value] || {})
const currentSongTitle = computed(() => currentSong.value.title || '未知歌曲')
const currentSongArtist = computed(() => currentSong.value.detail || '未知歌手')
const currentAudioUrl = computed(() => {
    // 使用免费音乐API或生成音频URL
    const songName = encodeURIComponent(currentSongTitle.value)
    return `https://music.163.com/song/media/outer/url?id=${currentSongIndex.value + 190000}.mp3`
})
const currentSongCover = computed(() => `https://picsum.photos/seed/${currentSongTitle.value}/200`)

function getItemIcon(item) {
    if (props.appId === 'notes') return 'fa-regular fa-note-sticky'
    if (props.appId === 'files') return 'fa-regular fa-file'
    if (props.appId === 'browser') return 'fa-solid fa-globe'
    if (props.appId === 'reminders') return 'fa-regular fa-circle-check'
    return 'fa-solid fa-angle-right'
}

function getItemIconForOther(item) {
    if (props.appId === 'music') return 'fa-solid fa-play'
    if (props.appId === 'recorder') return 'fa-solid fa-waveform'
    if (props.appId === 'messages') return 'fa-regular fa-comment'
    if (props.appId === 'calendar') return 'fa-regular fa-calendar-star'
    return 'fa-solid fa-smile'
}

// Music Player Functions
function playSong(index) {
    currentSongIndex.value = index
    isPlaying.value = true
    setTimeout(() => {
        if (audioPlayer.value) {
            audioPlayer.value.play().catch(() => {
                console.log('Audio playback failed, using demo mode')
                isPlaying.value = false
            })
        }
    }, 100)
}

function togglePlay() {
    if (!audioPlayer.value) return
    if (isPlaying.value) {
        audioPlayer.value.pause()
        isPlaying.value = false
    } else {
        audioPlayer.value.play().catch(() => {
            console.log('Playback failed')
        })
        isPlaying.value = true
    }
}

function nextSong() {
    const nextIdx = (currentSongIndex.value + 1) % listData.value.length
    playSong(nextIdx)
}

function prevSong() {
    const prevIdx = (currentSongIndex.value - 1 + listData.value.length) % listData.value.length
    playSong(prevIdx)
}

function seekMusic(event) {
    if (!audioPlayer.value || !duration.value) return
    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    audioPlayer.value.currentTime = percent * duration.value
}

function updateProgress() {
    if (!audioPlayer.value || !duration.value) return
    progress.value = (audioPlayer.value.currentTime / duration.value) * 100
}

function onAudioLoaded() {
    if (audioPlayer.value) {
        duration.value = audioPlayer.value.duration || 0
    }
}
</script>

<style scoped>
.empty-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    color: #dfdfdf;
    font-weight: 900;
}

.animate-spin-slow {
    animation: spin 12s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

@keyframes wave {

    0%,
    100% {
        transform: scaleY(1);
    }

    50% {
        transform: scaleY(0.5);
    }
}

.animate-wave {
    animation: wave 1.2s infinite ease-in-out;
    transform-origin: center;
}

.note-card {
    border-radius: 4px;
    position: relative;
}

.note-card::before {
    content: '';
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 12px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 2px;
}

.shadow-pink {
    box-shadow: 0 4px 12px rgba(252, 108, 156, 0.4);
}

.animate-slide-in {
    animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(10px);
}

@keyframes slide-in {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
