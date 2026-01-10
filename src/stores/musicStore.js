
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from './settingsStore'
import { useLoggerStore } from './loggerStore'

export const useMusicStore = defineStore('music', () => {
  const logger = useLoggerStore()
  
  // State
  const playlist = ref([])
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const isShuffling = ref(false)
  const repeatMode = ref('off') // 'off', 'one', 'all'
  const playerVisible = ref(false)
  
  // Audio Element (managed globally or within store context to persist across routes if needed)
  // Ideally, use a dedicated Audio object
  const audio = new Audio()
  
  // Current Song Info
  const currentSong = computed(() => playlist.value[currentIndex.value] || null)
  const duration = ref(0)
  const currentTime = ref(0)
  const currentLyrics = ref('♪ ...')

  // Init from LocalStorage
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('musicPlaylist')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.playlist) playlist.value = data.playlist
        if (typeof data.currentIndex === 'number') currentIndex.value = data.currentIndex
      }
    } catch (e) {
      console.error('Failed to load playlist', e)
    }
  }

  const saveToStorage = () => {
    localStorage.setItem('musicPlaylist', JSON.stringify({
      playlist: playlist.value,
      currentIndex: currentIndex.value,
      timestamp: Date.now()
    }))
  }

  // Actions
  const togglePlayer = () => {
    playerVisible.value = !playerVisible.value
  }

  const play = async () => {
    if (playlist.value.length === 0) return
    try {
       await audio.play()
       isPlaying.value = true
    } catch (e) {
       console.error('Play error', e)
       isPlaying.value = false
    }
  }

  const pause = () => {
    audio.pause()
    isPlaying.value = false
  }

  const togglePlay = () => {
    if (isPlaying.value) pause()
    else play()
  }

  const loadSong = async (index, autoPlay = true) => {
    if (!playlist.value[index]) return
    
    currentIndex.value = index
    const song = playlist.value[index]
    
    // Set Source
    audio.src = song.url
    
    // Fetch Lyrics
    if (song.id && song.source && song.source !== 'url' && song.source !== 'local') {
        currentLyrics.value = '♪ 正在加载歌词...'
        getLyrics(song.id, song.source).then(lyric => {
            currentLyrics.value = lyric
        })
    } else {
        currentLyrics.value = `♪ ${song.song} - ${song.singer}`
    }

    if (autoPlay) {
      play()
    }
    saveToStorage()
  }

  const next = () => {
    if (playlist.value.length === 0) return
    let nextIndex
    if (isShuffling.value) {
        nextIndex = Math.floor(Math.random() * playlist.value.length)
    } else {
        nextIndex = (currentIndex.value + 1) % playlist.value.length
    }
    loadSong(nextIndex)
  }

  const prev = () => {
    if (playlist.value.length === 0) return
    let prevIndex = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    loadSong(prevIndex)
  }

  const switchMode = (mode) => {
      // shuffle, repeat
      if (mode === 'shuffle') isShuffling.value = !isShuffling.value
      if (mode === 'repeat') {
          const modes = ['off', 'one', 'all']
          const idx = modes.indexOf(repeatMode.value)
          repeatMode.value = modes[(idx + 1) % modes.length]
      }
  }

  // API Interactions
  const Http_Get = (url) => {
    return fetch(url).then(res => res.json())
  }

  const searchMusic = async (name, singer, source = 'netease') => {
      name = name.replace(/\s/g, "")
      let results = []
      
      let url = ''
      if (source === 'tencent') {
          url = `/v2/music/tencent?word=${name}`
      } else {
          // Default to Netease
          url = `/v2/music/netease?word=${name}`
          if (singer) url += `-${singer}`
      }
      
      try {
        const res = await Http_Get(url)
        if (res?.data) {
            // Check if data is array (typical for search)
            const list = Array.isArray(res.data) ? res.data : [res.data]
            
            list.forEach(d => {
                if (d.id) {
                    // For Tencent, we MUST use the integer ID, not mid/vid
                    // For Netease, id is also standard
                    results.push({ 
                        id: d.id, 
                        song: d.song, 
                        singer: d.singer || (d.singer_list ? d.singer_list[0]?.name : ''), 
                        cover: d.cover, 
                        source: source === 'tencent' ? 'QQ音乐' : '网易云', 
                        // Store internal source key for getSongUrl
                        _sourceKey: source 
                    })
                }
            })
        }
      } catch(e) {
          logger.addLog('ERROR', 'Search Music Fail', e.message)
      }
      return results
  }
  const getSongUrl = async (songInfo) => {
      let sourceKey = songInfo._sourceKey
      if (!sourceKey) {
          if (songInfo.source === 'QQ音乐') sourceKey = 'tencent'
          else sourceKey = 'netease'
      }

      let url = ''
      if (sourceKey === 'tencent') {
           url = `/v2/music/tencent?id=${songInfo.id}`
      } else if (sourceKey === 'netease') {
           url = `/v2/music/netease?id=${songInfo.id}`
      } else {
           return { ...songInfo } 
      }

      try {
        const res = await Http_Get(url)
        const data = res?.data || {}
        if (data.url) {
            return { ...songInfo, url: data.url }
        }
      } catch (e) {
        console.error(e)
      }
      return null
  }

  const getLyrics = async (id, source) => {
      const sourceKey = (source === 'QQ音乐' || source === 'tencent') ? 'tencent' : 'netease'
      
      // Try different types: 'lyric' is often default, but integer types (1, 2, 3) are sometimes required
      const types = ['lyric', '1', '2', '3']
      
      for (const t of types) {
          const url = `/api-music/v2/music/${sourceKey}?id=${id}&type=${t}`
          try {
            const res = await Http_Get(url)
            // Some APIs might return success with different structure or specific content
            if (res?.code === 200 || res?.status === 'success' || (res?.data && !res.code)) {
                const data = res.data || res
                let lyric = ''
                
                if (typeof data === 'string') lyric = data
                else if (typeof data.lyric === 'string') lyric = data.lyric
                else if (typeof data.lrc === 'string') lyric = data.lrc
                else if (data.data && typeof data.data.lyric === 'string') lyric = data.data.lyric
                
                if (lyric && lyric.trim().length > 5) {
                    // Remove all bracketed timestamps [00:00.00] or [00:00:00]
                    const cleanedLyric = lyric
                        .replace(/\[\d{2,}:\d{2}(?:\.\d{1,3})?\]/g, '')
                        .replace(/\[\d{2}:\d{2}:\d{2}\]/g, '')
                        .replace(/\n+/g, ' ')
                        .trim()
                    
                    if (cleanedLyric.length > 2) return cleanedLyric
                }
            }
          } catch(e) {
              console.warn(`Fetch lyrics type ${t} failed`, e)
          }
          await new Promise(r => setTimeout(r, 150))
      }
      
      return '♪ 暂无歌词'
  }
  
  const addSong = (songData) => {
      playlist.value.push(songData)
      saveToStorage()
  }

  const removeSong = (index) => {
      playlist.value.splice(index, 1)
      if (currentIndex.value >= index && currentIndex.value > 0) {
          currentIndex.value--
      }
      saveToStorage()
  }

  // Setup Audio Listeners
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
    duration.value = audio.duration
  })
  
  audio.addEventListener('ended', () => {
      if (repeatMode.value === 'one') {
          audio.currentTime = 0
          play()
      } else if (repeatMode.value === 'all' || (playlist.value.length > 0 && currentIndex.value < playlist.value.length - 1)) {
          next()
      } else {
          isPlaying.value = false
      }
  })
  
  audio.addEventListener('error', (e) => {
      console.error('Audio Error', e)
      isPlaying.value = false
      currentLyrics.value = '♪ 播放出错，请尝试下一首'
  })

  // Initialize
  loadFromStorage()

  return {
      playlist,
      currentIndex,
      isPlaying,
      isShuffling,
      repeatMode,
      playerVisible,
      currentSong,
      duration,
      currentTime,
      currentLyrics,
      
      togglePlayer,
      play,
      pause,
      togglePlay,
      next,
      prev,
      loadSong,
      searchMusic,
      getSongUrl,
      addSong,
      removeSong,
      switchMode
  }
})
