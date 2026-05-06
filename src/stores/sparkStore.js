import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const SPARK_CONFIG = {
    levels: [
        { days: 1, name: '初燃', icon: '🔥', color: '#FF6B35' },
        { days: 3, name: '微火', icon: '🔥', color: '#FF8C42' },
        { days: 7, name: '火花', icon: '💥', color: '#FFA500' },
        { days: 14, name: '烈焰', icon: '🔥', color: '#FF4500' },
        { days: 30, name: '炽焰', icon: '⚡', color: '#FFD700' },
        { days: 60, name: '燎原', icon: '🌟', color: '#FF1493' },
        { days: 100, name: '永恒', icon: '💫', color: '#9400D3' },
        { days: 180, name: '传奇', icon: '👑', color: '#4B0082' },
        { days: 365, name: '神话', icon: '🌈', color: '#00CED1' }
    ],
    achievements: [
        { id: 'first_spark', name: '初见火花', desc: '获得第一个火花', icon: '🎆', condition: (days) => days >= 1, reward: '初火徽章' },
        { id: 'week_streak', name: '一周不断', desc: '连续7天保持火花', icon: '📅', condition: (days) => days >= 7, reward: '周常达人' },
        { id: 'month_burn', name: '月度燃烧', desc: '连续30天保持火花', icon: '🌙', condition: (days) => days >= 30, reward: '月火勋章' },
        { id: 'century_flame', name: '百日庆典', desc: '连续100天保持火花', icon: '💯', condition: (days) => days >= 100, reward: '世纪之火' },
        { id: 'half_year', name: '半载相伴', desc: '连续180天保持火花', icon: '🎭', condition: (days) => days >= 180, reward: '半年之约' },
        { id: 'year_legend', name: '年度传说', desc: '连续365天保持火花', icon: '🏆', condition: (days) => days >= 365, reward: '年度传奇' },
        { id: 'chat_100', name: '百聊成金', desc: '累计聊天100次', icon: '💬', condition: (_, total) => total >= 100, reward: '话痨称号' },
        { id: 'chat_500', name: '五百知音', desc: '累计聊天500次', icon: '💌', condition: (_, total) => total >= 500, reward: '知音徽章' },
        { id: 'chat_1000', name: '千言万语', desc: '累计聊天1000次', icon: '📝', condition: (_, total) => total >= 1000, reward: '千语之星' },
        { id: 'chat_5000', name: '五千挚友', desc: '累计聊天5000次', icon: '🤝', condition: (_, total) => total >= 5000, reward: '挚友之证' }
    ],
    titles: [
        { id: 'title_fire_newbie', name: '初火使者', icon: '🔥', unlockDays: 1, rarity: 'common' },
        { id: 'title_weekly_warrior', name: '周常战士', icon: '⚔️', unlockDays: 7, rarity: 'rare' },
        { id: 'title_month_master', name: '月火大师', icon: '🎖️', unlockDays: 30, rarity: 'epic' },
        { id: 'title_century_guard', name: '世纪守护者', icon: '🛡️', unlockDays: 100, rarity: 'legendary' },
        { id: 'title_year_sage', name: '年度贤者', icon: '📜', unlockDays: 365, rarity: 'mythic' },
        { id: 'title_chat_king', name: '聊天之王', icon: '👑', unlockTotalChats: 1000, rarity: 'legendary' },
        { id: 'title_soulmate', name: '灵魂伴侣', icon: '💕', unlockDays: 180, unlockTotalChats: 2000, rarity: 'mythic' }
    ]
}

function getTodayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadSparkData(charId) {
    try {
        const data = localStorage.getItem(`spark_${charId}`)
        return data ? JSON.parse(data) : null
    } catch {
        return null
    }
}

function saveSparkData(charId, data) {
    try {
        localStorage.setItem(`spark_${charId}`, JSON.stringify(data))
    } catch (e) {
        console.error('[SparkStore] Save failed:', e)
    }
}

export const useSparkStore = defineStore('spark', () => {
    const sparks = ref({})
    const equippedTitles = ref({})

    function initSpark(charId) {
        if (!sparks.value[charId]) {
            const saved = loadSparkData(charId)
            if (saved) {
                sparks.value[charId] = saved
                checkStreak(charId)
            } else {
                sparks.value[charId] = {
                    streak: 0,
                    maxStreak: 0,
                    lastChatDate: null,
                    totalChats: 0,
                    achievements: [],
                    unlockedTitles: [],
                    history: []
                }
            }
        }
        return sparks.value[charId]
    }

    function recordChat(charId) {
        const spark = initSpark(charId)
        const today = getTodayKey()

        if (spark.lastChatDate === today) {
            return false
        }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

        if (spark.lastChatDate === yesterdayKey) {
            spark.streak++
        } else if (spark.lastChatDate !== today) {
            spark.streak = 1
        }

        spark.lastChatDate = today
        spark.totalChats++
        spark.maxStreak = Math.max(spark.maxStreak, spark.streak)

        if (!spark.history.includes(today)) {
            spark.history.push(today)
            if (spark.history.length > 400) spark.history = spark.history.slice(-366)
        }

        checkAchievements(charId, spark)
        saveSparkData(charId, spark)

        console.log(`[SparkStore] ${charId} - Day ${spark.streak}, Total: ${spark.totalChats}`)
        return true
    }

    function checkStreak(charId) {
        const spark = sparks.value[charId]
        if (!spark || !spark.lastChatDate) return

        const today = getTodayKey()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

        if (spark.lastChatDate !== today && spark.lastChatDate !== yesterdayKey) {
            spark.streak = 0
            saveSparkData(charId, spark)
        }
    }

    function checkAchievements(charId, spark) {
        SPARK_CONFIG.achievements.forEach(ach => {
            if (!spark.achievements.includes(ach.id)) {
                if (ach.condition(spark.streak, spark.totalChats)) {
                    spark.achievements.push(ach.id)
                    console.log(`[SparkStore] Achievement unlocked: ${ach.name}!`)
                }
            }
        })

        SPARK_CONFIG.titles.forEach(title => {
            if (!spark.unlockedTitles.includes(title.id)) {
                let unlocked = true
                if (title.unlockDays && spark.streak < title.unlockDays) unlocked = false
                if (title.unlockTotalChats && spark.totalChats < title.unlockTotalChats) unlocked = false
                if (unlocked) {
                    spark.unlockedTitles.push(title.id)
                    console.log(`[SparkStore] Title unlocked: ${title.name}!`)
                }
            }
        })
    }

    function getSparkLevel(streak) {
        let level = SPARK_CONFIG.levels[0]
        for (const lv of SPARK_CONFIG.levels) {
            if (streak >= lv.days) level = lv
        }
        return level
    }

    function getSparkInfo(charId) {
        const spark = sparks.value[charId]
        if (!spark) return null

        const level = getSparkLevel(spark.streak)
        const nextLevel = SPARK_CONFIG.levels.find(l => l.days > spark.streak)

        return {
            ...spark,
            level,
            nextLevel,
            progressToNext: nextLevel ? ((spark.streak - level.days) / (nextLevel.days - level.days) * 100) : 100,
            achievements: spark.achievements.map(id => SPARK_CONFIG.achievements.find(a => a.id === id)).filter(Boolean),
            titles: spark.unlockedTitles.map(id => SPARK_CONFIG.titles.find(t => t.id === id)).filter(Boolean),
            isEquipped: (titleId) => equippedTitles.value[charId] === titleId
        }
    }

    function equipTitle(charId, titleId) {
        const spark = sparks.value[charId]
        if (!spark || !spark.unlockedTitles.includes(titleId)) return false

        if (equippedTitles.value[charId] === titleId) {
            equippedTitles.value[charId] = null
        } else {
            equippedTitles.value[charId] = titleId
        }

        try {
            localStorage.setItem('spark_equipped_titles', JSON.stringify(equippedTitles.value))
        } catch (e) {}
        return true
    }

    function loadEquippedTitles() {
        try {
            const saved = localStorage.getItem('spark_equipped_titles')
            if (saved) equippedTitles.value = JSON.parse(saved)
        } catch (e) {}
    }

    function getSparkIcon(charId, size = 'md') {
        const info = getSparkInfo(charId)
        if (!info) return null

        const sizes = { sm: 16, md: 20, lg: 28, xl: 36 }
        const iconSize = sizes[size] || sizes.md

        const hasStreak = info.streak > 0

        return {
            icon: hasStreak ? info.level.icon : '🔥',
            color: hasStreak ? info.level.color : '#CCCCCC',
            size: iconSize,
            streak: info.streak,
            levelName: info.level.name,
            pulse: hasStreak && info.streak >= 7,
            isActive: hasStreak
        }
    }

    function getAllSparks() {
        Object.keys(sparks.value).forEach(checkStreak)
        return Object.fromEntries(
            Object.entries(sparks.value).map(([id, s]) => [id, getSparkInfo(id)])
        )
    }

    loadEquippedTitles()

    return {
        sparks,
        equippedTitles,
        initSpark,
        recordChat,
        checkStreak,
        getSparkInfo,
        getSparkIcon,
        getSparkLevel,
        equipTitle,
        getAllSparks,
        SPARK_CONFIG
    }
})
