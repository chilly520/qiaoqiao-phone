<script setup>
import { computed, ref, onMounted, getCurrentInstance } from 'vue'
import { useMusicStore } from '../stores/musicStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useChatStore } from '../stores/chatStore'

const musicStore = useMusicStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

// Computeds for UI
const currentSong = computed(() => musicStore.currentSong)
const isPlaying = computed(() => musicStore.isPlaying)
const playerVisible = computed(() => musicStore.playerVisible)
const progressPercent = computed(() => {
    if (!musicStore.duration) return 0
    return (musicStore.currentTime / musicStore.duration) * 100
})
const timeDisplay = computed(() => {
    const cur = formatTime(musicStore.currentTime)
    const tot = formatTime(musicStore.duration)
    return `${cur} / ${tot}`
})

const chatData = computed(() => {
    const current = chatStore.currentChat || {}
    return {
        userAvatar: current.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me',
        charAvatar: current.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${current.name || 'AI'}`
    }
})

// Modals
const showSearchModal = ref(false)
const showPlaylistModal = ref(false)

// Search State
const searchQuery = ref('')
const searchSource = ref('all')
const searchResults = ref([])
const isSearching = ref(false)
const hasSearched = ref(false)
const urlImportInput = ref('')

// UI Helpers
const formatTime = (s) => {
    if (isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sc = Math.floor(s % 60)
    return `${m}:${sc < 10 ? '0' : ''}${sc}`
}

// Handlers
const handleProgressClick = (e) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    if (musicStore.duration) {
        musicStore.seek(percent * musicStore.duration)
    }
}

const openSearch = () => {
    isSearching.value = false
    hasSearched.value = false
    searchResults.value = []
    searchQuery.value = ''
    showSearchModal.value = true
}

const executeSearch = async () => {
    if (!searchQuery.value.trim()) return
    isSearching.value = true
    hasSearched.value = true
    
    let name = searchQuery.value
    let singer = ''
    if (name.includes('-')) {
        const parts = name.split('-')
        singer = parts[0].trim()
        name = parts[1].trim()
    }
    
    // Pass searchSource to store
    searchResults.value = await musicStore.searchMusic(name, singer, searchSource.value)
    isSearching.value = false
}

const addSearchResult = async (song) => {
    const fullSong = await musicStore.getSongUrl(song)
    if (fullSong) {
        musicStore.addSong(fullSong)
        showSearchModal.value = false
        // Auto play if it's the only song or just added
        if (musicStore.playlist.length === 1 || !musicStore.isPlaying) {
             musicStore.loadSong(musicStore.playlist.length - 1)
        }
    } else {
        alert('无法获取播放链接 (可能需要VIP)')
    }
}

const importUrlSong = () => {
    if (!urlImportInput.value) return
    const song = {
        id: 'url_' + Date.now(),
        song: 'URL Import',
        singer: 'Unknown',
        source: 'url',
        url: urlImportInput.value,
        cover: 'https://via.placeholder.com/150'
    }
    musicStore.addSong(song)
    urlImportInput.value = ''
    alert('已导入链接')
    if (musicStore.playlist.length === 1) musicStore.loadSong(0)
}

const handleImageError = (e) => {
    e.target.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=music'
    e.target.onerror = null
}
</script>

<template>
  <div>
    <!-- Full Player -->
    <div v-if="playerVisible && !musicStore.isMinimized" class="music-player active" :class="{ 'together-mode': musicStore.isListeningTogether }">
        <!-- Header -->
        <div class="player-header">
            <button class="header-btn" title="最小化" @click="musicStore.toggleMinimize">
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="listening-time" v-if="musicStore.isListeningTogether">
                正在和 {{ musicStore.togetherPartner?.name || 'TA' }} 一起听歌 {{ musicStore.togetherDurationMinutes }} 分钟
            </div>
            <div class="listening-time" v-else>音乐播放器</div>
            <button class="header-btn" title="关闭" @click="musicStore.stopTogether(); musicStore.pause(); musicStore.togglePlayer()">
                <i class="fa-solid fa-power-off"></i>
            </button>
        </div>

        <!-- Avatars Section (Listen Together Specific) -->
        <div v-if="musicStore.isListeningTogether" class="together-avatars">
            <div class="avatar-group">
                <img :src="chatData.userAvatar" class="avatar user-avatar" @error="handleImageError">
                <div class="connection-line">
                    <div class="beat-line"></div>
                </div>
                <img :src="musicStore.togetherPartner?.avatar || chatData.charAvatar" class="avatar partner-avatar" @error="handleImageError">
                <div class="heart-indicator"><i class="fa-solid fa-heart"></i></div>
            </div>
        </div>

        <!-- Avatars (Normal Mode) -->
        <div v-else class="avatars-section">
            <div class="avatar-wrapper">
                <img :src="chatData.userAvatar" class="avatar" @error="handleImageError">
                <div class="heart-bubble"><i class="fa-solid fa-heart text-pink-500"></i></div>
                <img :src="chatData.charAvatar" class="avatar" @error="handleImageError">
            </div>
        </div>

        <!-- Sound Wave -->
        <div class="sound-wave" :class="{active: isPlaying}">
            <div class="wave-bar" v-for="i in 16" :key="i"></div>
        </div>

        <!-- Disc -->
        <div class="disc-section">
            <div class="disc-container">
                <!-- Vinyl Records Background (Stacked visual) -->
                <div class="vinyl-stack" v-if="musicStore.isListeningTogether"></div>
                
                <div class="disc" :class="{spinning: isPlaying}">
                    <div class="vinyl-overlay"></div>
                    <img :src="currentSong?.cover || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + (currentSong?.song || 'music')" class="album-cover" @error="handleImageError">
                    <div class="disc-center">
                        <div class="center-hole"></div>
                    </div>
                </div>

                <!-- Stylus Arm (唱针) -->
                <div class="stylus-arm" :class="{playing: isPlaying}">
                    <div class="arm-base"></div>
                    <div class="arm-shaft"></div>
                    <div class="arm-head"></div>
                </div>
            </div>
        </div>

        <!-- Info -->
        <div class="song-info">
            <div class="song-title">{{ currentSong?.song || '未播放' }}</div>
            <div class="song-artist">{{ currentSong?.singer || '---' }}</div>
        </div>

        <!-- Lyrics -->
        <div class="lyrics-section" @click="openSearch">
            <div class="lyrics-container">
                <div class="lyrics-text active" :class="{ 'has-lyric': musicStore.activeLyricText !== '♪ 暂无歌词' }">
                    {{ musicStore.activeLyricText }}
                </div>
                <div v-if="musicStore.nextLyricText" class="lyrics-text next">
                    {{ musicStore.nextLyricText }}
                </div>
            </div>
        </div>

        <!-- Progress -->
        <div class="progress-section">
            <div class="progress-bar" @click="handleProgressClick">
                <div class="progress-fill" :style="{width: progressPercent + '%'}"></div>
            </div>
            <div class="time-display">
                <span>{{ formatTime(musicStore.currentTime) }}</span>
                <span>{{ formatTime(musicStore.duration) }}</span>
            </div>
        </div>

        <!-- Controls -->
        <div class="controls">
            <button class="control-btn" @click="musicStore.prev"><i class="fa-solid fa-backward-step"></i></button>
            <button class="control-btn play-pause" @click="musicStore.togglePlay">
                <i class="fa-solid" :class="isPlaying ? 'fa-circle-pause' : 'fa-circle-play'"></i>
            </button>
            <button class="control-btn" @click="musicStore.next"><i class="fa-solid fa-forward-step"></i></button>
        </div>

        <!-- Toolbar -->
        <div class="toolbar">
            <button class="toolbar-btn" :class="{active: musicStore.repeatMode !== 'off'}" @click="musicStore.switchMode('repeat')" title="循环模式">
                <i class="fa-solid" :class="musicStore.repeatMode === 'one' ? 'fa-repeat-1' : 'fa-repeat'"></i>
            </button>
            <button class="toolbar-btn" @click="showSearchModal = true" title="搜索"><i class="fa-solid fa-magnifying-glass"></i></button>
            <button class="toolbar-btn" @click="showPlaylistModal = true" title="列表"><i class="fa-solid fa-list-ul"></i></button>
            <button class="toolbar-btn" :class="{active: musicStore.isShuffling}" @click="musicStore.switchMode('shuffle')" title="随机播放">
                <i class="fa-solid fa-shuffle"></i>
            </button>
        </div>
    </div>

    <!-- Minimized Capsule (Dynamic Island style) -->
    <div v-if="playerVisible && musicStore.isMinimized" class="music-capsule" @click="musicStore.toggleMinimize">
        <div class="capsule-content">
            <div class="capsule-disc" :class="{spinning: isPlaying}">
                <img :src="currentSong?.cover || 'https://api.dicebear.com/7.x/shapes/svg?seed=music'" @error="handleImageError">
            </div>
            <div class="capsule-info">
                <div class="capsule-title">{{ currentSong?.song || '未播放' }}</div>
                <div class="capsule-lyrics">{{ musicStore.activeLyricText }}</div>
            </div>
            <div class="capsule-controls">
                <button class="capsule-btn" @click.stop="musicStore.togglePlay">
                    <i class="fa-solid" :class="isPlaying ? 'fa-pause' : 'fa-play'"></i>
                </button>
                <button class="capsule-btn" @click.stop="musicStore.next">
                    <i class="fa-solid fa-forward"></i>
                </button>
            </div>
        </div>
        <div class="capsule-progress" :style="{width: progressPercent + '%'}"></div>
    </div>

    <!-- Search Modal -->
    <div v-if="showSearchModal" class="modal-overlay show" @click.self="showSearchModal = false">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">点歌台</div>
                <button class="modal-close" @click="showSearchModal = false">×</button>
            </div>
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass search-icon-inner"></i>
                    <input v-model="searchQuery" @keyup.enter="executeSearch" type="text" placeholder="搜索歌曲、歌手..." class="search-input-modern">
                    <button @click="executeSearch" class="search-submit-icon" :disabled="isSearching">
                        <i class="fa-solid" :class="isSearching ? 'fa-spinner fa-spin' : 'fa-arrow-right'"></i>
                    </button>
                </div>

                <!-- Modern Source Chips -->
                <div class="source-chips">
                    <div 
                        v-for="opt in [{id:'all', label:'全站'}, {id:'netease', label:'网易云'}, {id:'tencent', label:'QQ音乐'}]" 
                        :key="opt.id"
                        class="source-chip"
                        :class="{ active: searchSource === opt.id }"
                        @click="searchSource = opt.id"
                    >
                        {{ opt.label }}
                    </div>
                </div>
            </div>

            <!-- Modern URL Import -->
            <div class="import-wrapper-modern">
                <div class="import-label">或导入外链播放</div>
                <div class="import-input-group">
                    <input v-model="urlImportInput" type="text" placeholder="粘贴 MP3 链接..." class="import-input-field">
                    <button @click="importUrlSong" class="import-submit-btn">导入</button>
                </div>
            </div>

                <div v-if="isSearching" class="text-center text-gray-400 py-4 text-xs">搜索中...</div>
                <div v-else class="search-results">
                    <div v-if="searchResults.length === 0 && !hasSearched" class="text-center text-gray-500 py-10 text-xs">
                        输入关键词开始搜索
                    </div>
                    <div v-else-if="searchResults.length === 0" class="text-center text-gray-500 py-10 text-xs">
                        未找到相关歌曲
                    </div>
                    <div 
                        v-for="song in searchResults" 
                        :key="song.id" 
                        class="search-item"
                        @click="addSearchResult(song)"
                    >
                        <img :src="song.cover || 'https://via.placeholder.com/40'" class="search-item-cover">
                        <div class="search-item-info">
                            <div class="search-item-title">{{ song.song }}</div>
                            <div class="search-item-artist">
                                {{ song.singer }} 
                                <span class="source-tag">{{ song.source }}</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-plus text-[#ccaa66]"></i>
                    </div>
                </div>
        </div>
    </div>

    <!-- Playlist Modal -->
    <div v-if="showPlaylistModal" class="modal-overlay show" @click.self="showPlaylistModal = false">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">播放列表</div>
                <button class="modal-close" @click="showPlaylistModal = false">×</button>
            </div>
            <div class="playlist-items">
                <div v-if="musicStore.playlist.length === 0" class="playlist-empty">暂无歌曲</div>
                <div v-for="(song, index) in musicStore.playlist" :key="index" 
                     class="playlist-item" 
                     :class="{ active: index === musicStore.currentIndex }"
                     @click="musicStore.loadSong(index)"
                >
                    <div class="playlist-idx">{{ index + 1 }}</div>
                    <div class="playlist-info">
                        <div class="playlist-song">{{ song.song }}</div>
                        <div class="playlist-singer">{{ song.singer }}</div>
                    </div>
                    <button class="playlist-remove" @click.stop="musicStore.removeSong(index)">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>

  </div>
</template>

<style scoped>
/* Ported CSS from HTML */
.music-player {
    background: linear-gradient(165deg, rgba(20, 20, 20, 0.96), rgba(35, 35, 35, 0.92));
    backdrop-filter: blur(40px) saturate(180%);
    border-radius: 24px;
    padding: 10px 12px 14px;
    width: 76%;
    max-width: 270px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 1px rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(204, 170, 102, 0.15);
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20002;
    animation: playerAppear 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    max-height: 94vh;
}

@keyframes playerAppear {
    from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    padding: 0 4px;
}
.listening-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.header-btn {
    background: none; border: none; padding: 4px; cursor: pointer; color: rgba(255, 255, 255, 0.4); font-size: 14px;
    transition: all 0.2s;
}
.header-btn:hover { color: #ccaa66; transform: scale(1.1); }

/* Avatars */
.avatars-section {
    display: flex; flex-direction: column; justify-content: center; align-items: center; 
    margin-bottom: 8px; position: relative; height: 80px; padding-top: 5px;
}
.avatar-wrapper {
    position: relative; display: flex; align-items: center; z-index: 10;
}
.avatar {
    width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid rgba(204, 170, 102, 0.7);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.6), 0 0 12px rgba(204, 170, 102, 0.15); 
    object-fit: cover; z-index: 10;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    background: #2a2a2a;
}
.avatar:first-child { margin-right: -12px; }
.avatar:last-child { margin-left: -12px; }
.avatar:hover { 
    transform: scale(1.15) translateY(-5px); 
    z-index: 15; 
    border-color: #f0c75a; 
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(212, 175, 55, 0.4); 
}

.heart-bubble {
    width: 28px; height: 28px; z-index: 12; display: flex; align-items: center; justify-content: center;
    background: rgba(20, 20, 20, 0.95); backdrop-filter: blur(10px);
    border-radius: 50%; border: 1px solid rgba(255, 100, 100, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
    animation: heartPulse 2.5s ease-in-out infinite; font-size: 12px;
    color: #ff5252;
}
@keyframes heartPulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 1px rgba(255,82,82,0.3)); }
    50% { transform: scale(1.12); filter: drop-shadow(0 0 6px rgba(255,82,82,0.6)); }
}

/* Disc */
.disc-section { display: flex; justify-content: center; margin-bottom: 12px; position: relative; }
.disc-container { width: 110px; height: 110px; position: relative; }
.disc {
    width: 100%; height: 100%; border-radius: 50%; 
    background: radial-gradient(circle, #2a2a2a 0%, #171717 65%, #050505 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 12px 40px rgba(0,0,0,0.85), inset 0 0 30px rgba(0,0,0,0.7);
    border: 3.5px solid #0a0a0a;
    position: relative;
    z-index: 5;
    overflow: hidden;
}
.vinyl-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-radial-gradient(circle at center, transparent 0, transparent 4px, rgba(255,255,255,0.02) 4.5px);
    z-index: 6;
}
.disc.spinning { animation: spin 10s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.disc-center { 
    width: 28px; height: 28px; 
    background: linear-gradient(135deg, #e5c05c, #ccaa66); 
    border-radius: 50%; position: absolute; z-index: 10;
    box-shadow: 0 2px 6px rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
}
.center-hole { width: 5px; height: 5px; background: #000; border-radius: 50%; }
.album-cover { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; opacity: 0.9; filter: contrast(1.05) brightness(0.9); }

/* Stylus Arm */
.stylus-arm {
    position: absolute;
    top: -5px;
    right: -12px;
    width: 70px;
    height: 90px;
    z-index: 20;
    transform-origin: 58px 12px;
    transform: rotate(-32deg);
    transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1);
    pointer-events: none;
}
.stylus-arm.playing {
    transform: rotate(-3deg);
}
.arm-base {
    position: absolute;
    right: 5px;
    top: 5px;
    width: 18px;
    height: 18px;
    background: linear-gradient(135deg, #444, #222);
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.6);
    border: 1px solid rgba(255,255,255,0.05);
}
.arm-shaft {
    position: absolute;
    right: 12px;
    top: 14px;
    width: 3.5px;
    height: 70px;
    background: linear-gradient(to right, #333, #777, #333);
    border-radius: 2px;
    transform: rotate(4deg);
    box-shadow: 1px 1px 3px rgba(0,0,0,0.4);
}
.arm-head {
    position: absolute;
    left: 18px;
    bottom: 2px;
    width: 10px;
    height: 15px;
    background: linear-gradient(135deg, #d4af37, #b8860b);
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    border: 0.5px solid rgba(0,0,0,0.2);
}

/* Info */
.song-info { text-align: center; margin-bottom: 8px; padding: 0 4px; }
.song-title { font-size: 14px; font-weight: 700; color: #ccaa66; margin-bottom: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.song-artist { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 500; }

/* Lyrics */
.lyrics-section {
    background: rgba(204, 170, 102, 0.04);
    backdrop-filter: blur(5px);
    border-radius: 12px; padding: 5px 10px; margin-bottom: 12px; min-height: 36px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    border: 1px solid rgba(204, 170, 102, 0.12);
    box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.02);
    transition: all 0.3s ease;
}
.lyrics-section:hover { background: rgba(204, 170, 102, 0.08); border-color: rgba(204, 170, 102, 0.25); }
.lyrics-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    width: 100%;
}
.lyrics-text { 
    font-size: 11px; color: rgba(204, 170, 102, 0.5); font-weight: 500; text-align: center; 
    line-height: 1.2; letter-spacing: 0.3px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.lyrics-text.active {
    font-size: 12px;
    color: #ffd87d;
    font-weight: 700;
}
.lyrics-text.next {
    font-size: 9px;
    color: rgba(204, 170, 102, 0.25);
    font-weight: 400;
}
.lyrics-text.has-lyric { text-shadow: 0 0 6px rgba(204, 170, 102, 0.2); }

/* Progress */
.progress-section { margin-bottom: 10px; padding: 0 2px; }
.progress-bar { width: 100%; height: 3px; background: rgba(255,255,255,0.06); border-radius: 3px; cursor: pointer; position: relative; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #d4af37, #f0c75a); width: 0%; box-shadow: 0 0 8px rgba(212,175,55,0.4); border-radius: 3px; }
.time-display { display: flex; justify-content: space-between; font-size: 8.5px; color: rgba(255,255,255,0.25); margin-top: 4px; font-weight: 600; font-family: 'Outfit', sans-serif; }

/* Controls */
.controls { display: flex; justify-content: center; align-items: center; gap: 16px; margin-bottom: 10px; }
.control-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.85); font-size: 18px; transition: all 0.2s; padding: 4px; }
.control-btn:hover { color: #ccaa66; transform: scale(1.1); }
.control-btn.play-pause { font-size: 34px; color: #ccaa66; }
.control-btn.play-pause:hover { transform: scale(1.08); filter: brightness(1.2); }

/* Toolbar */
.toolbar { display: flex; justify-content: space-around; padding: 8px 0 4px; border-top: 1px solid rgba(255, 255, 255, 0.05); }
.toolbar-btn { background: none; border: none; padding: 5px 8px; cursor: pointer; color: rgba(255,255,255,0.3); font-size: 13px; transition: all 0.2s; }
.toolbar-btn:hover { color: rgba(255,255,255,0.6); }
.toolbar-btn.active { color: #d4af37; text-shadow: 0 0 10px rgba(212,175,55,0.3); }

/* Modal Commons */
.modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: flex-end; justify-content: center; z-index: 30000; backdrop-filter: blur(12px) contrast(0.9);
    animation: modalFadeIn 0.3s ease-out;
}
@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
    background: linear-gradient(180deg, #1e1e1e, #121212);
    border-radius: 28px 28px 0 0; padding: 20px 18px 30px; width: 100%; max-width: 320px; max-height: 85vh;
    border: 1px solid rgba(204, 170, 102, 0.15); border-bottom: none;
    box-shadow: 0 -20px 60px rgba(0,0,0,0.8);
    transform: translateY(0);
    animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modalSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.modal-header { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
.modal-title { color: #ccaa66; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
.modal-close { background: rgba(255,255,255,0.05); border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 18px; color: #888; cursor: pointer; display: flex; align-items: center; justify-content: center; }

/* Search Styles */
.search-container { margin-bottom: 16px; }
.search-input-wrapper {
    position: relative; display: flex; align-items: center; 
    background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px; padding: 3px 3px 3px 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.search-input-wrapper:focus-within {
    border-color: rgba(204, 170, 102, 0.4);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 0 0 20px rgba(204, 170, 102, 0.05);
}
.search-icon-inner { color: rgba(204, 170, 102, 0.4); font-size: 13px; }
.search-input-modern {
    flex: 1; background: none; border: none; padding: 9px; color: #fff; font-size: 13px; outline: none;
}
.search-submit-icon {
    width: 32px; height: 32px; border-radius: 11px; background: linear-gradient(135deg, #ccaa66, #d4af37);
    border: none; color: #1a1a1a; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; font-size: 12px;
}
.search-submit-icon:hover { transform: scale(1.05); filter: brightness(1.1); }

.source-chips { display: flex; gap: 6px; margin-top: 10px; justify-content: center; }
.source-chip {
    padding: 5px 12px; border-radius: 16px; font-size: 10px; font-weight: 600;
    color: rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.05);
    border: 1px solid transparent; cursor: pointer; transition: all 0.3s;
}
.source-chip.active {
    background: rgba(204, 170, 102, 0.15); border-color: rgba(204, 170, 102, 0.25);
    color: #ccaa66;
}

/* Import Styles */
.import-wrapper-modern {
    margin-bottom: 16px; padding: 10px 12px; border-radius: 14px;
    background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(255, 255, 255, 0.08);
}
.import-label { font-size: 9px; color: rgba(255, 255, 255, 0.2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.import-input-group { display: flex; gap: 6px; }
.import-input-field {
    flex: 1; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px; padding: 7px 10px; color: #aaa; font-size: 11px; outline: none;
}
.import-submit-btn {
    padding: 0 10px; background: rgba(204, 170, 102, 0.1); border: 1px solid rgba(204, 170, 102, 0.2);
    border-radius: 10px; color: #ccaa66; font-size: 11px; cursor: pointer; transition: all 0.2s; font-weight: 600;
}
.import-submit-btn:hover { background: rgba(204, 170, 102, 0.2); }

.search-results {
    overflow-y: auto;
    max-height: 45vh;
    padding: 2px;
}

.search-item { display: flex; gap: 10px; align-items: center; padding: 9px 6px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; border-radius: 10px; transition: background 0.2s; }
.search-item:hover { background: rgba(255, 255, 255, 0.03); }
.search-item-cover { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.search-item-info { flex: 1; min-width: 0; }
.search-item-title { color: #eee; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-item-artist { color: #777; font-size: 11px; display: flex; align-items: center; }
.source-tag {
    font-size: 9px; margin-left: 6px; padding: 1px 5px; border-radius: 5px;
    background: rgba(204, 170, 102, 0.1); color: #ccaa66; border: 1px solid rgba(204,170,102,0.15);
}

/* Sound Wave */
.sound-wave {
    position: absolute; bottom: 4px; left: 0; width: 100%; height: 22px;
    display: none; align-items: flex-end; gap: 3px; 
    justify-content: center; z-index: 1; 
    pointer-events: none; transition: opacity 0.5s ease;
}
.sound-wave.active { display: flex; opacity: 0.35; }
.wave-bar { 
    width: 2.5px; background: linear-gradient(to top, #d4af37, #ffffff); 
    border-radius: 2px; animation: wave 1.2s ease-in-out infinite; 
    height: 4px;
}
.wave-bar:nth-child(even) { animation-duration: 0.8s; animation-delay: 0.15s; }
.wave-bar:nth-child(3n) { animation-duration: 1.4s; animation-delay: 0.3s; }

@keyframes wave { 
    0%, 100% { height: 4px; opacity: 0.4; } 
    50% { height: 18px; opacity: 1; } 
}

/* Together Mode Styles */
.together-mode {
    background: linear-gradient(135deg, #050505 0%, #151515 100%);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.07);
    border-color: rgba(212, 175, 55, 0.2);
}

.together-avatars {
    width: 100%;
    height: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 6px;
    position: relative;
}

.avatar-group {
    display: flex;
    align-items: center;
    gap: 24px;
    position: relative;
}

.avatar-group .avatar {
    width: 40px;
    height: 40px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 6px 18px rgba(0,0,0,0.7);
}

.connection-line {
    position: absolute;
    left: 40px;
    right: 40px;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
}

.heart-indicator {
    top: -12px;
    font-size: 14px;
    text-shadow: 0 0 12px rgba(255, 77, 79, 0.6);
}

.together-mode .disc-section {
    margin-bottom: 20px;
}

.together-mode .disc {
    width: 130px;
    height: 130px;
    border: 5px solid #000;
    box-shadow: 0 20px 60px rgba(0,0,0,1), 0 0 25px rgba(212,175,55,0.15);
}

.together-mode .song-title {
    color: #fff;
    font-size: 16px;
    text-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
}

.vinyl-stack {
    position: absolute;
    inset: -12px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212, 175, 55, 0.03) 0%, transparent 70%);
    border: 1px solid rgba(212, 175, 55, 0.05);
    z-index: 1;
    animation: vinylStackPulse 3s infinite ease-in-out;
}
@keyframes vinylStackPulse {
    0%, 100% { transform: scale(1); opacity: 0.15; }
    50% { transform: scale(1.1); opacity: 0.35; }
}

/* Playlist Specific Styles */
.playlist-items {
    max-height: 50vh;
    overflow-y: auto;
    padding-right: 4px;
}
.playlist-items::-webkit-scrollbar { width: 4px; }
.playlist-items::-webkit-scrollbar-thumb { background: rgba(204, 170, 102, 0.2); border-radius: 10px; }

.playlist-empty {
    text-align: center;
    padding: 30px 0;
    color: rgba(255, 255, 255, 0.2);
    font-size: 13px;
}

.playlist-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
}
.playlist-item:hover {
    background: rgba(255, 255, 255, 0.05);
}
.playlist-item.active {
    background: rgba(204, 170, 102, 0.08);
    border-color: rgba(204, 170, 102, 0.2);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.playlist-idx {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    width: 16px;
    font-weight: 700;
}
.playlist-item.active .playlist-idx { color: #ccaa66; }

.playlist-info { flex: 1; min-width: 0; }
.playlist-song {
    font-size: 13px;
    color: #eee;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
}
.playlist-item.active .playlist-song { color: #f0c75a; }

.playlist-singer {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 500;
}

.playlist-remove {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.15);
    padding: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
}
.playlist-remove:hover {
    color: #ff5252;
    transform: scale(1.1);
}

@keyframes pulseLine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

/* Minimized Capsule Styles */
.music-capsule {
    position: fixed;
    bottom: 85px;
    left: 50%;
    transform: translateX(-50%);
    width: 220px;
    height: 44px;
    background: rgba(15, 15, 15, 0.9);
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 22px;
    border: 1px solid rgba(204, 170, 102, 0.2);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.03);
    z-index: 20005;
    cursor: pointer;
    overflow: hidden;
    animation: capsuleAppear 0.5s cubic-bezier(0.19, 1, 0.22, 1);
    display: flex;
    flex-direction: column;
}
@keyframes capsuleAppear {
    from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.9); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.capsule-content {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 10px;
}

.capsule-disc {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1.5px solid #ccaa66;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 2px 5px rgba(0,0,0,0.4);
}
.capsule-disc img { width: 100%; height: 100%; object-fit: cover; }
.capsule-disc.spinning { animation: spin 8s linear infinite; }

.capsule-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.capsule-title {
    font-size: 11px;
    font-weight: 700;
    color: #ccaa66;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.capsule-lyrics {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
}

.capsule-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}
.capsule-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 13px;
    padding: 4px;
    transition: all 0.2s;
}
.capsule-btn:hover { color: #ccaa66; transform: scale(1.1); }

.capsule-progress {
    height: 2px;
    background: linear-gradient(90deg, #ccaa66, #d4af37);
    transition: width 0.3s linear;
}
</style>
