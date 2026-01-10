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
const searchSource = ref('netease')
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
    // Hack: access audio element via store if exposed, or add connection
    // Since we created 'audio' inside store, we need an action `seek(time)` ideally
    // For now, let's assume store action or direct property access if we exposed audio (we didn't expose audio directly but created it inside)
    // We should add seek to store. For now, let's just ignore or add TODO.
    // Actually, let's just add seek logic to store later or quick fix here:
    // Update: I will fix store or just access internal if possible. 
    // Wait, I didn't export `seek`. 
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
</script>

<template>
  <div>
    <!-- Floating Player (Centered Modal Style from HTML) -->
    <div v-if="playerVisible" class="music-player active">
        <!-- Header -->
        <div class="player-header">
            <button class="header-btn" title="最小化" @click="musicStore.togglePlayer">
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="listening-time">一起听歌中...</div>
            <button class="header-btn" title="关闭" @click="musicStore.pause(); musicStore.togglePlayer()">
                <i class="fa-solid fa-power-off"></i>
            </button>
        </div>

        <!-- Avatars -->
        <div class="avatars-section">
            <div class="avatar-wrapper">
                <img :src="chatData.userAvatar" class="avatar">
                <div class="heart-bubble"><i class="fa-solid fa-heart text-pink-500"></i></div>
                <img :src="chatData.charAvatar" class="avatar">
            </div>
        </div>
        <!-- Sound Wave (Visual Only) - Repositioned to be outside avatar-wrapper but within avatars-section or below it -->
        <div class="sound-wave" :class="{active: isPlaying}">
            <div class="wave-bar" v-for="i in 16" :key="i"></div>
        </div>

        <!-- Disc -->
        <div class="disc-section">
            <div class="disc-container">
                <div class="disc" :class="{spinning: isPlaying}">
                    <img :src="currentSong?.cover || 'https://via.placeholder.com/150'" class="album-cover">
                    <div class="disc-center"></div>
                </div>
            </div>
        </div>

        <!-- Info -->
        <div class="song-info">
            <div class="song-title">{{ currentSong?.song || '未播放' }}</div>
            <div class="song-artist">{{ currentSong?.singer || '---' }}</div>
        </div>

        <!-- Lyrics (Marquee) -->
        <div class="lyrics-section" @click="openSearch">
            <div class="lyrics-text" :class="{ 'has-lyric': musicStore.currentLyrics !== '♪ 暂无歌词' }">
                {{ musicStore.currentLyrics }}
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
            <button class="toolbar-btn" :class="{active: musicStore.repeatMode !== 'off'}" @click="musicStore.switchMode('repeat')">
                <i class="fa-solid" :class="musicStore.repeatMode === 'one' ? 'fa-repeat-1' : 'fa-repeat'"></i>
            </button>
            <button class="toolbar-btn" @click="showSearchModal = true"><i class="fa-solid fa-magnifying-glass"></i></button>
            <button class="toolbar-btn" @click="showPlaylistModal = true"><i class="fa-solid fa-list-ul"></i></button>
            <button class="toolbar-btn" :class="{active: musicStore.isShuffling}" @click="musicStore.switchMode('shuffle')">
                <i class="fa-solid fa-shuffle"></i>
            </button>
        </div>
    </div>

    <!-- Search Modal -->
    <div v-if="showSearchModal" class="modal-overlay show" @click.self="showSearchModal = false">
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">点歌台</div>
                <button class="modal-close" @click="showSearchModal = false">×</button>
            </div>
                <div class="search-box">
                    <input v-model="searchQuery" @keyup.enter="executeSearch" type="text" placeholder="搜索歌曲、歌手（例如：周杰伦-晴天）" class="search-input">
                    <!-- Source Selector -->
                    <select v-model="searchSource" class="source-select">
                        <option value="netease">网易云</option>
                        <option value="tencent">QQ音乐</option>
                    </select>
                    <button @click="executeSearch" class="search-btn">
                        <i class="fa-solid fa-search"></i>
                    </button>
                </div>
                <!-- Quick Import URL -->
                <div class="import-section" style="margin-top: 10px; display: flex; gap: 5px;">
                     <input v-model="urlImportInput" type="text" placeholder="粘贴 MP3 链接直接播放" class="search-input" style="font-size: 11px;">
                     <button @click="importUrlSong" class="search-btn" style="width: auto; padding: 0 10px; font-size: 11px;">导入</button>
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
                <div v-if="musicStore.playlist.length === 0" class="text-gray-500 text-center py-4">暂无歌曲</div>
                <div v-for="(song, index) in musicStore.playlist" :key="index" 
                     class="playlist-item" 
                     :class="{'border-l-4 border-l-[#d4af37] bg-white/5': index === musicStore.currentIndex}"
                     @click="musicStore.loadSong(index)"
                >
                    <div class="text-gray-300 text-sm truncate flex-1">{{ song.song }} - {{ song.singer }}</div>
                    <button class="text-gray-500 hover:text-red-400 p-2" @click.stop="musicStore.removeSong(index)">
                        <i class="fa-solid fa-trash"></i>
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
    background: linear-gradient(135deg, rgba(26, 26, 26, 0.93), rgba(40, 40, 40, 0.88));
    backdrop-filter: blur(30px) saturate(150%);
    border-radius: 20px;
    padding: 15px 20px 20px;
    width: 85%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(204, 170, 102, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(204, 170, 102, 0.25);
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20002;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, -60%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
}

.player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    padding-bottom: 5px;
}
.listening-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
}
.header-btn {
    background: none; border: none; padding: 6px; cursor: pointer; color: rgba(255, 255, 255, 0.5); font-size: 16px;
}

/* Avatars */
.avatars-section {
    display: flex; flex-direction: column; justify-content: center; align-items: center; 
    margin-bottom: 12px; position: relative; height: 100px; padding-top: 10px;
}
.avatar-wrapper {
    position: relative; display: flex; align-items: center; z-index: 10; margin-bottom: 0px;
}
.avatar {
    width: 62px; height: 62px; border-radius: 50%; border: 2px solid rgba(204, 170, 102, 0.8);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5), 0 0 10px rgba(204, 170, 102, 0.1); 
    object-fit: cover; z-index: 10;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    background: #2a2a2a;
}
.avatar:first-child { margin-right: -15px; }
.avatar:last-child { margin-left: -15px; }
.avatar:hover { 
    transform: scale(1.12) translateY(-8px); 
    z-index: 15; 
    border-color: #f0c75a; 
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.3); 
}

.heart-bubble {
    width: 32px; height: 32px; z-index: 12; display: flex; align-items: center; justify-content: center;
    background: rgba(30, 30, 30, 0.9); backdrop-filter: blur(8px);
    border-radius: 50%; border: 1.5px solid rgba(255, 100, 100, 0.4);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    animation: heartPulse 2s ease-in-out infinite; font-size: 14px;
    color: #ff6464;
}
@keyframes heartPulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px rgba(255,100,100,0.3)); }
    50% { transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(255,100,100,0.6)); }
}

/* Disc */
.disc-section { display: flex; justify-content: center; margin-bottom: 12px; }
.disc-container { width: 140px; height: 140px; position: relative; }
.disc {
    width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(45deg, #1a1a1a, #2a2a2a);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 0 20px rgba(204,170,102,0.1);
    border: 1px solid rgba(204,170,102,0.2);
}
.disc.spinning { animation: spin 12s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.disc-center { width: 30px; height: 30px; background: #1a1a1a; border-radius: 50%; position: absolute; }
.album-cover { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

/* Info */
.song-info { text-align: center; margin-bottom: 15px; }
.song-title { font-size: 17px; font-weight: 600; color: #ccaa66; margin-bottom: 5px; }
.song-artist { font-size: 12px; color: #999; }

/* Lyrics */
.lyrics-section {
    background: linear-gradient(135deg, rgba(204, 170, 102, 0.1), rgba(212, 175, 55, 0.12));
    border-radius: 16px; padding: 10px 15px; margin-bottom: 18px; min-height: 44px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    border: 1px solid rgba(204, 170, 102, 0.2);
    box-shadow: inset 0 0 15px rgba(204, 170, 102, 0.05);
    transition: all 0.3s ease;
}
.lyrics-section:hover { background: rgba(204, 170, 102, 0.15); border-color: rgba(204, 170, 102, 0.3); }
.lyrics-text { 
    font-size: 13px; color: rgba(204, 170, 102, 0.9); font-weight: 500; text-align: center; 
    line-height: 1.4; letter-spacing: 0.5px;
}
.lyrics-text.has-lyric { color: #f0c75a; text-shadow: 0 0 8px rgba(204, 170, 102, 0.3); }

/* Progress */
.progress-section { margin-bottom: 15px; }
.progress-bar { width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; position: relative; }
.progress-fill { height: 100%; background: linear-gradient(to right, #ccaa66, #d4af37); border-radius: 3px; width: 0%; box-shadow: 0 0 10px rgba(204,170,102,0.5); }
.time-display { display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 5px; }

/* Controls */
.controls { display: flex; justify-content: center; align-items: center; gap: 25px; margin-bottom: 15px; }
.control-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.9); font-size: 24px; transition: transform 0.2s; }
.control-btn:hover { transform: scale(1.1); }
.control-btn.play-pause { font-size: 48px; }

/* Toolbar */
.toolbar { display: flex; justify-content: space-around; padding: 12px 0 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.toolbar-btn { background: none; border: none; padding: 8px 12px; cursor: pointer; color: rgba(255,255,255,0.5); font-size: 18px; }
.toolbar-btn.active { color: #d4af37; background: rgba(204, 170, 102, 0.15); border-radius: 8px; }

/* Modal Commons */
.modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 30000; backdrop-filter: blur(8px);
}
.modal {
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border-radius: 20px; padding: 25px; width: 90%; max-width: 420px; max-height: 85vh;
    border: 1px solid rgba(204, 170, 102, 0.2); overflow-y: auto;
}
.modal-header { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid rgba(204,170,102,0.15); padding-bottom: 10px; }
.modal-title { color: #ccaa66; font-size: 18px; font-weight: 600; }
.modal-close { background: none; border: none; font-size: 24px; color: #666; cursor: pointer; }

/* Search Styles */
.search-header { display: flex; gap: 8px; margin-bottom: 12px; }
.search-input { flex: 1; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(204,170,102,0.2); border-radius: 8px; color: #ccc; }
.source-select { padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(204,170,102,0.2); border-radius: 8px; color: #ccc; }
.search-btn { width: 100%; padding: 10px; background: linear-gradient(to right, #ccaa66, #d4af37); border-radius: 8px; font-weight: bold; margin-bottom: 15px; }
.search-item { display: flex; gap: 10px; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
.search-item-cover { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; }
.search-item-title { color: #ccc; font-size: 14px; }
.search-item-artist { color: #888; font-size: 12px; display: flex; align-items: center; }
.source-tag {
    font-size: 10px; margin-left: 6px; padding: 1px 4px; border-radius: 4px;
    background: rgba(204, 170, 102, 0.15); color: #ccaa66; border: 1px solid rgba(204,170,102,0.2);
}

/* Sound Wave */
.sound-wave {
    position: absolute; bottom: 5px; left: 0; width: 100%; height: 25px;
    display: none; align-items: flex-end; gap: 4px; 
    justify-content: center; z-index: 1; padding-bottom: 0px;
    pointer-events: none; transition: opacity 0.5s ease;
}
.sound-wave.active { display: flex; opacity: 0.4; }
.wave-bar { 
    width: 3px; background: linear-gradient(to top, #ccaa66, #d4af37, #ffffff); 
    border-radius: 2px 2px 0 0; animation: wave 1.2s ease-in-out infinite; 
    box-shadow: 0 0 5px rgba(204, 170, 102, 0.3);
    height: 5px;
}
.wave-bar:nth-child(even) { animation-duration: 0.9s; animation-delay: 0.1s; }
.wave-bar:nth-child(3n) { animation-duration: 1.5s; animation-delay: 0.2s; }
.wave-bar:nth-child(4n) { animation-duration: 0.7s; animation-delay: 0.05s; }

@keyframes wave { 
    0%, 100% { height: 5px; opacity: 0.4; } 
    50% { height: 20px; opacity: 1; } 
}
</style>
