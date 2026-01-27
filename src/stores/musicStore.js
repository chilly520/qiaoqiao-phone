
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
  const isMinimized = ref(false)

  // Audio Element (managed globally or within store context to persist across routes if needed)
  // Ideally, use a dedicated Audio object
  const audio = new Audio()

  // Current Song Info
  const currentSong = computed(() => playlist.value[currentIndex.value] || null)
  const duration = ref(0)
  const currentTime = ref(0)
  const currentLyrics = ref('♪ ...') // Raw text for legacy or flat display
  const parsedLyrics = ref([]) // Array of { time, text }
  const currentLyricIndex = ref(-1)

  // Listen Together State
  const isListeningTogether = ref(false)
  const togetherPartner = ref(null) // { name, avatar }
  const togetherStartTime = ref(null)
  const togetherElapsedSeconds = ref(0)
  let togetherTimer = null

  const togetherDurationMinutes = computed(() => {
    if (!isListeningTogether.value) return 0
    return Math.floor(togetherElapsedSeconds.value / 60)
  })

  // Init from LocalStorage
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('musicPlaylist')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.playlist) playlist.value = data.playlist
        if (typeof data.currentIndex === 'number') currentIndex.value = data.currentIndex
        // Restore Together state if it was active recently (within 2 hours)
        if (data.isListeningTogether && data.timestamp && (Date.now() - data.timestamp < 2 * 3600 * 1000)) {
          isListeningTogether.value = true
          togetherPartner.value = data.togetherPartner
          togetherStartTime.value = data.togetherStartTime
          togetherElapsedSeconds.value = data.togetherElapsedSeconds || 0

          // Resume timer
          if (togetherTimer) clearInterval(togetherTimer)
          togetherTimer = setInterval(() => {
            if (isPlaying.value) {
              togetherElapsedSeconds.value++
            }
          }, 1000)
        }
      }
    } catch (e) {
      console.error('Failed to load playlist', e)
    }
  }

  const saveToStorage = () => {
    localStorage.setItem('musicPlaylist', JSON.stringify({
      playlist: playlist.value,
      currentIndex: currentIndex.value,
      isListeningTogether: isListeningTogether.value,
      togetherPartner: togetherPartner.value,
      togetherStartTime: togetherStartTime.value,
      togetherElapsedSeconds: togetherElapsedSeconds.value,
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

  const seek = (time) => {
    if (!isNaN(time) && isFinite(time)) {
      audio.currentTime = time
      currentTime.value = time
    }
  }

  const prev = () => {
    if (playlist.value.length === 0) return
    let prevIndex = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length
    loadSong(prevIndex)
  }

  const startTogether = (partner) => {
    isListeningTogether.value = true
    togetherPartner.value = partner
    togetherStartTime.value = Date.now()
    togetherElapsedSeconds.value = 0

    if (togetherTimer) clearInterval(togetherTimer)
    togetherTimer = setInterval(() => {
      if (togetherStartTime.value) {
        togetherElapsedSeconds.value = Math.floor((Date.now() - togetherStartTime.value) / 1000)
      }
    }, 1000)
    saveToStorage()
  }

  const stopTogether = () => {
    isListeningTogether.value = false
    togetherPartner.value = null
    togetherStartTime.value = null
    togetherElapsedSeconds.value = 0
    if (togetherTimer) {
      clearInterval(togetherTimer)
      togetherTimer = null
    }
    saveToStorage()
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

    const searchInternal = async (targetSource) => {
      let url = ''
      if (targetSource === 'tencent') {
        url = `/v2/music/tencent?word=${name}`
      } else {
        url = `/v2/music/netease?word=${name}`
        if (singer) url += `-${singer}`
      }

      try {
        const res = await Http_Get(url)
        if (res?.data) {
          const list = Array.isArray(res.data) ? res.data : [res.data]
          return list.filter(d => d.id).map(d => ({
            id: d.id,
            song: d.song,
            singer: d.singer || (d.singer_list ? d.singer_list[0]?.name : ''),
            cover: d.cover,
            source: targetSource === 'tencent' ? 'QQ音乐' : '网易云',
            _sourceKey: targetSource
          }))
        }
      } catch (e) {
        logger.addLog('ERROR', `Search ${targetSource} Fail`, e.message)
      }
      return []
    }

    if (source === 'all') {
      const [neteaseResults, tencentResults] = await Promise.all([
        searchInternal('netease'),
        searchInternal('tencent')
      ])

      // Interleave results
      const results = []
      const max = Math.max(neteaseResults.length, tencentResults.length)
      for (let i = 0; i < max; i++) {
        if (neteaseResults[i]) results.push(neteaseResults[i])
        if (tencentResults[i]) results.push(tencentResults[i])
      }
      return results
    } else {
      return await searchInternal(source)
    }
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

  const parseLrc = (lrc) => {
    const lines = lrc.split(/\r?\n/)
    const result = []
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g

    lines.forEach(line => {
      const times = []
      let match
      while ((match = timeRegex.exec(line)) !== null) {
        const min = parseInt(match[1])
        const sec = parseInt(match[2])
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0
        times.push(min * 60 + sec + ms / 1000)
      }

      const text = line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim()
      if (text) {
        times.forEach(t => {
          result.push({ time: t, text })
        })
      }
    })

    return result.sort((a, b) => a.time - b.time)
  }

  const getLyrics = async (id, source) => {
    const sourceKey = (source === 'QQ音乐' || source === 'tencent') ? 'tencent' : 'netease'
    const types = ['lyric', '1', '2', '3']

    for (const t of types) {
      const url = `/api-music/v2/music/${sourceKey}?id=${id}&type=${t}`
      try {
        const res = await Http_Get(url)
        if (res?.code === 200 || res?.status === 'success' || (res?.data && !res.code)) {
          const data = res.data || res
          let lyric = ''

          if (typeof data === 'string') lyric = data
          else if (typeof data.lyric === 'string') lyric = data.lyric
          else if (typeof data.lrc === 'string') lyric = data.lrc
          else if (data.data && typeof data.data.lyric === 'string') lyric = data.data.lyric

          if (lyric && lyric.trim().length > 5) {
            // Check if it's LRC format (contains timestamps)
            if (/\[\d{2,}:\d{2}/.test(lyric)) {
              parsedLyrics.value = parseLrc(lyric)
              // Store first few lines as currentLyrics for display summary
              currentLyrics.value = parsedLyrics.value.slice(0, 3).map(l => l.text).join(' ') || '♪ ...'
            } else {
              // Flat text fallback
              parsedLyrics.value = []
              currentLyrics.value = lyric.replace(/\s+/g, ' ').trim()
            }
            return currentLyrics.value
          }
        }
      } catch (e) {
        console.warn(`Fetch lyrics type ${t} failed`, e)
      }
      await new Promise(r => setTimeout(r, 100))
    }

    parsedLyrics.value = []
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

  /**
   * Automatically play music from a BGM tag found in AI messages.
   * Format: <bgm>SongName - Artist</bgm> or <bgm>当前bgm:SongName - Artist</bgm>
   */
  const playFromBgmTag = async (tagContent) => {
    if (!tagContent) return

    // Clean prefix logic from studied scripts
    let cleaned = tagContent.replace(/当前bgm[:：]/i, '').replace(/\[|\]/g, '').trim()
    if (!cleaned) return

    let songName = cleaned
    let artistName = ''

    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ')
      songName = parts[0].trim()
      artistName = parts[1].trim()
    } else if (cleaned.includes('-')) {
      const parts = cleaned.split('-')
      // Many people write Singer - Song, others Song - Singer. 
      // Our searchMusic handles this by combining them in fuzzy search.
      songName = parts[1] || parts[0]
      artistName = parts[0]
    }

    useLoggerStore().addLog('AI', '检测到 BGM 指令', { tag: tagContent, search: `${songName} ${artistName}` })

    try {
      // Search across all providers
      const results = await searchMusic(songName, artistName, 'all')
      if (results && results.length > 0) {
        // Pick top result
        const topResult = results[0]
        const fullSong = await getSongUrl(topResult)

        if (fullSong && fullSong.url) {
          // Check if already in playlist
          const exists = playlist.value.findIndex(s => s.id === fullSong.id)
          if (exists !== -1) {
            loadSong(exists, true)
          } else {
            addSong(fullSong)
            loadSong(playlist.value.length - 1, true)
          }

          // Make player visible for better UX parity with the studied userscript
          playerVisible.value = true
          return true
        }
      }
    } catch (e) {
      console.warn('[MusicStore] Auto BGM play failed', e)
    }
    return false
  }

  // Setup Audio Listeners
  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime
    duration.value = audio.duration

    // Update Sync Lyrics
    if (parsedLyrics.value.length > 0) {
      let activeIdx = -1
      for (let i = 0; i < parsedLyrics.value.length; i++) {
        if (audio.currentTime >= parsedLyrics.value[i].time) {
          activeIdx = i
        } else {
          break
        }
      }
      currentLyricIndex.value = activeIdx
    }
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
    isMinimized,
    currentSong,
    duration,
    currentTime,
    currentLyrics,

    togglePlayer,
    toggleMinimize: () => { isMinimized.value = !isMinimized.value },
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
    switchMode,

    isListeningTogether,
    togetherPartner,
    togetherDurationMinutes,
    startTogether,
    stopTogether,

    parsedLyrics,
    currentLyricIndex,
    seek,
    activeLyricText: computed(() => {
      if (parsedLyrics.value.length === 0) return currentLyrics.value
      const active = parsedLyrics.value[currentLyricIndex.value]
      return active ? active.text : '♪ ...'
    }),
    nextLyricText: computed(() => {
      if (parsedLyrics.value.length === 0) return ''
      const next = parsedLyrics.value[currentLyricIndex.value + 1]
      return next ? next.text : ''
    }),
    playFromBgmTag
  }
})
