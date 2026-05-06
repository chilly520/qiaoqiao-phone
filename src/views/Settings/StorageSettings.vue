<script setup>
import { ref, computed, onMounted, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { storeToRefs } from 'pinia'
import localforage from 'localforage'

const router = useRouter()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const { compressQuality } = storeToRefs(settingsStore)

// Error boundary: catch any unhandled errors in this component
onErrorCaptured((error, instance, info) => {
    console.error('[StorageSettings] Component error caught:', error, info)
    // Prevent crash by returning false (don't propagate)
    return false
})

const goBack = () => {
    router.back()
}

// Stats
const totalLimit = ref(5 * 1024 * 1024) // Default 5MB for LocalStorage
const usedSpace = ref(0)
const quotaMode = ref('loading') // 'loading', 'ls', or 'system'
const hasError = ref(false) // Error state flag
const breakdown = ref({
    logs: 0,
    chats: 0,
    moments: 0,
    images: 0,
    other: 0,
    system: 0, // IndexedDB / System storage
    gallery: 0,
    indexedDB: 0  // Explicit IndexedDB usage
})

// Mock helper to estimate string size in bytes
// SAFETY: Use string length as fallback to prevent "Invalid string length" error
const getSize = (str) => {
    if (!str) return 0

    try {
        // For small strings (< 10MB), use Blob for accurate size
        if (str.length < 10 * 1024 * 1024) {
            return new Blob([str]).size
        }
        // For large strings, use UTF-8 estimation (1-4 bytes per char)
        // This prevents "Invalid string length" error from Blob constructor
        let size = 0
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i)
            if (code < 0x80) size += 1           // ASCII: 1 byte
            else if (code < 0x800) size += 2     // 2-byte UTF-8
            else if (code < 0xD800 || code >= 0xE000) size += 3  // 3-byte UTF-8
            else { size += 4; i++ }             // 4-byte surrogate pair
        }
        return size
    } catch (e) {
        console.warn('[Storage] getSize failed, using string length:', e)
        return str.length * 2  // Rough estimate: assume 2 bytes per char
    }
}

const calculateStorage = async () => {
    try {
        // Reset error state
        hasError.value = false
        quotaMode.value = 'calculating'  // Show calculating state

        let lsTotal = 0
        let details = {
            logs: 0,
            chats: 0,
            moments: 0,
            images: 0,
            other: 0,
            system: 0,
            gallery: 0,
            indexedDB: 0
        }

        // 1. Calculate LocalStorage usage (safe, always works)
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage[key]
                    if (!value) continue
                    const size = getSize(value) + key.length
                    lsTotal += size

                    if (key === 'qiaoqiao_logs' || key.includes('log')) details.logs += size
                    else if (key.includes('chat') || key === 'qiaoqiao_chat_store' || key === 'qiaoqiao_chats') details.chats += size
                    else if (key.includes('moment')) details.moments += size
                    else if (key.includes('image') || key.includes('avatar')) details.images += size
                    else details.other += size
                }
            }
        } catch (lsErr) {
            console.warn('[Storage] Failed to calculate LocalStorage:', lsErr)
        }

        // 2. Estimate IndexedDB usage WITHOUT loading all data (safe approach)
        let idbTotal = 0

        try {
            // Only check metadata size (not individual messages - too expensive!)
            const metadata = await localforage.getItem('qiaoqiao_chats_metadata')
            if (metadata) {
                const metaSize = getSize(JSON.stringify(metadata))
                details.chats += metaSize
                idbTotal += metaSize
            }
            
            // Quick estimate: count message keys and assume average size
            // This avoids loading 966MB of data into memory!
            if (typeof localforage.keys === 'function') {
                const keys = await localforage.keys()
                let msgKeyCount = 0
                let hasV2Data = false
                
                for (const key of keys) {
                    if (key.startsWith('qiaoqiao_chat_msgs_')) {
                        msgKeyCount++
                    } else if (key === 'qiaoqiao_chats_v2') {
                        hasV2Data = true
                    }
                }
                
                // Estimate: assume average 50KB per chat's messages (conservative)
                // This is much safer than loading actual data!
                if (msgKeyCount > 0) {
                    const estimatedMsgsSize = msgKeyCount * 50 * 1024  // 50KB per chat
                    details.chats += estimatedMsgsSize
                    idbTotal += estimatedMsgsSize
                }
                
                // Check V2 data size (but with safety limit)
                if (hasV2Data) {
                    try {
                        const v2Data = await localforage.getItem('qiaoqiao_chats_v2')
                        if (v2Data) {
                            const v2Str = JSON.stringify(v2Data)
                            // Safety limit: don't process if >10MB
                            if (v2Str.length < 10 * 1024 * 1024) {
                                const v2Size = getSize(v2Str)
                                details.chats += v2Size
                                idbTotal += v2Size
                            } else {
                                // If V2 data is huge, just note it
                                console.warn('[Storage] V2 data is very large (>10MB), using estimate')
                                details.chats += 10 * 1024 * 1024  // Assume 10MB
                                idbTotal += 10 * 1024 * 1024
                            }
                        }
                    } catch (v2Err) {
                        console.warn('[Storage] Failed to read V2 data:', v2Err)
                    }
                }
            }
            
            // Gallery and Moments (usually small, safe to load, but add protection)
            try {
                const gallery = await localforage.getItem('galleryData')
                if (gallery) {
                    const galleryStr = JSON.stringify(gallery)
                    if (galleryStr.length < 5 * 1024 * 1024) {  // Safety: <5MB
                        const gallerySize = getSize(galleryStr)
                        details.gallery = gallerySize
                        idbTotal += gallerySize
                    } else {
                        console.warn('[Storage] Gallery data too large, using estimate')
                        details.gallery = 2 * 1024 * 1024  // Assume 2MB
                        idbTotal += details.gallery
                    }
                }
            } catch (galleryErr) {
                console.warn('[Storage] Failed to read gallery:', galleryErr)
            }

            try {
                const moments = await localforage.getItem('qiaoqiao_moments')
                if (moments) {
                    const momentStr = JSON.stringify(moments)
                    if (momentStr.length < 5 * 1024 * 1024) {  // Safety: <5MB
                        const momentSize = getSize(momentStr)
                        details.moments += momentSize
                        idbTotal += momentSize
                    } else {
                        console.warn('[Storage] Moments data too large, using estimate')
                        details.moments += 1 * 1024 * 1024  // Assume 1MB
                        idbTotal += details.moments
                    }
                }
            } catch (momentsErr) {
                console.warn('[Storage] Failed to read moments:', momentsErr)
            }
            
            details.indexedDB = idbTotal
            
        } catch (idbError) {
            console.warn('[Storage] Failed to calculate IndexedDB details (using fallback):', idbError)
            // Fallback: use a reasonable estimate based on what we know
            details.indexedDB = lsTotal * 100  // Rough guess: IDB is usually 100x LS
            idbTotal = details.indexedDB
        }

        // 3. Determine storage mode (stable logic)
        if (details.indexedDB > 0) {
            usedSpace.value = details.indexedDB + lsTotal
            totalLimit.value = 280 * 1024 * 1024 * 1024
            quotaMode.value = 'system'
            details.system = Math.max(0, details.indexedDB - details.chats - details.gallery - details.moments)
        } else if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate()
                usedSpace.value = estimate.usage || (lsTotal + details.gallery + details.chats)
                totalLimit.value = estimate.quota || (500 * 1024 * 1024)
                quotaMode.value = 'system'
                details.system = Math.max(0, usedSpace.value - lsTotal - details.gallery - details.chats - details.moments)
            } catch (e) {
                usedSpace.value = lsTotal + details.gallery + details.chats
                totalLimit.value = 5 * 1024 * 1024
                quotaMode.value = 'ls'
            }
        } else {
            usedSpace.value = lsTotal + details.gallery + details.chats
            totalLimit.value = 5 * 1024 * 1024
            quotaMode.value = 'ls'
        }

        breakdown.value = details
        console.log('[Storage] Calculation complete - Mode:', quotaMode.value, 'Used:', formatSize(usedSpace.value), 'Limit:', formatSize(totalLimit.value))
        
    } catch (error) {
        console.error('[Storage] CRITICAL: calculateStorage failed completely!', error)

        // EMERGENCY FALLBACK: Show minimal info to prevent crash
        hasError.value = true
        usedSpace.value = 0
        totalLimit.value = 5 * 1024 * 1024
        quotaMode.value = 'error'  // Error state
        breakdown.value = {
            logs: 0,
            chats: 0,
            moments: 0,
            images: 0,
            other: 0,
            system: 0,
            gallery: 0,
            indexedDB: 0
        }

        // Don't show toast for every error to avoid spam
        console.warn('[Storage] Storage calculation failed, showing fallback data')
    }
}

onMounted(async () => {
    try {
        await calculateStorage()
    } catch (err) {
        console.error('[Storage] onMounted error:', err)
        hasError.value = true
        quotaMode.value = 'error'
    }
})

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const usedPercent = computed(() => {
    return Math.min(((usedSpace.value / totalLimit.value) * 100), 100).toFixed(1)
})

// Actions
const updateCompressQuality = () => {
    settingsStore.setCompressQuality(compressQuality.value)
}



// Image Compression Logic
const compressImages = async () => {
    chatStore.triggerConfirm('图片压缩', '这将重新压缩所有现有的聊天图片，可能会略微降低清晰度以节省空间。\n确定要继续吗？', async () => {
        chatStore.triggerToast('正在压缩图片，请稍候...', 'info')
        await new Promise(r => setTimeout(r, 50)) // Allow UI to render the toast
        let count = 0
        let savedSize = 0
        let loopCounter = 0

        // Process
        const chats = chatStore.chats
        for (const chatId in chats) {
            const msgs = chats[chatId].msgs || []
            for (const msg of msgs) {
                if (loopCounter++ % 100 === 0) await new Promise(r => setTimeout(r, 0)) // Yield event loop
                if (msg.content && typeof msg.content === 'string') {
                    // Match all [图片:...] tags
                    const imgRegex = /\[图片:([^\]]+)\]/g
                    let match
                    let newContent = msg.content
                    let msgModified = false

                    // Reset regex index for safety
                    imgRegex.lastIndex = 0

                    // In-place collection of matches to avoid indexing issues during replacement
                    const foundImages = []
                    while ((match = imgRegex.exec(msg.content)) !== null) {
                        foundImages.push({ full: match[0], url: match[1] })
                    }

                    for (const imgInfo of foundImages) {
                        const originalUrl = imgInfo.url
                        // Handle both Base64 and remote URLs
                        if (originalUrl.startsWith('data:image') || originalUrl.includes('pollinations') || originalUrl.includes('image')) {
                            try {
                                const newBase64 = await reCompressBase64FromUrl(originalUrl, compressQuality.value)
                                if (newBase64 && newBase64.length < originalUrl.length) {
                                    savedSize += (originalUrl.length - newBase64.length)
                                    // Use split/join for safe global replace of this specific string
                                    newContent = newContent.split(imgInfo.full).join(`[图片:${newBase64}]`)
                                    msgModified = true
                                    count++
                                }
                            } catch (e) {
                                console.error('Compression failed for img in msg', msg.id, e)
                            }
                        }
                    }

                    if (msgModified) {
                        msg.content = newContent
                    }
                }
            }
        }

        await chatStore.saveChats(true)
        calculateStorage()
        chatStore.triggerToast(`压缩完成！处理了 ${count} 张图片，释放了 ${formatSize(savedSize)}`, 'success')
    })
}

// Helper to re-compress
const reCompressBase64 = (base64, quality) => {
    return new Promise((resolve) => {
        const img = new Image()
        img.src = base64
        img.onload = () => {
            const canvas = document.createElement('canvas')
            // Cap max width to 600 if it was larger (force downsize)
            let width = img.width
            let height = img.height
            const MAX_SIDE = 600

            if (width > height) {
                if (width > MAX_SIDE) {
                    height *= MAX_SIDE / width
                    width = MAX_SIDE
                }
            } else {
                if (height > MAX_SIDE) {
                    width *= MAX_SIDE / height
                    height = MAX_SIDE
                }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.onerror = () => resolve(base64) // Fallback
    })
}

const cleanAllImages = () => {
    chatStore.triggerConfirm('深度清理', '确定要删除所有聊天图片和图库图片吗？\n文字记录将被保留，图片将变为 [已清理]。\n图库中的图片也将被清空！\n此操作不可撤销！', async () => {
        chatStore.triggerToast('正在清理图片，请稍候...', 'info')
        await new Promise(r => setTimeout(r, 50)) // Allow UI to render the toast
        let count = 0
        let savedSize = 0
        let loopCounter = 0

        // 1. Clean Chat Messages
        const chats = chatStore.chats
        for (const chatId in chats) {
            const msgs = chats[chatId].msgs || []
            for (const msg of msgs) {
                if (loopCounter++ % 1000 === 0) await new Promise(r => setTimeout(r, 0)) // Yield event loop
                
                // [FIX] Primary: Clear msg.image field
                if (msg.image && typeof msg.image === 'string' && 
                    (msg.image.startsWith('data:image') || msg.image.length > 1000)) {
                    savedSize += msg.image.length
                    msg.image = null
                    if (msg.type === 'image') {
                        msg.content = '[图片已清理]'
                    }
                    count++
                }
                
                // Also clear legacy format: [图片:data:image...] in content
                if (msg.content && typeof msg.content === 'string') {
                    if (msg.content.includes('[图片:data:image')) {
                        const oldLen = msg.content.length
                        msg.content = '[图片已清理]'
                        savedSize += oldLen
                        count++
                    }
                }
            }
        }

        // 2. Clean Gallery Data (IndexedDB)
        try {
            const gallery = await localforage.getItem('galleryData')
            if (gallery && gallery.images) {
                const gallerySize = getSize(JSON.stringify(gallery))
                savedSize += gallerySize
                count += gallery.images.length
                gallery.images = [] // Clear all images
                await localforage.setItem('galleryData', gallery)
            }
        } catch (e) {
            console.warn('[Storage] Failed to clear gallery:', e)
        }

        await chatStore.saveChats(true)
        calculateStorage()
        chatStore.triggerToast(`清理完成！删除了 ${count} 张图片，释放了 ${formatSize(savedSize)}`, 'success')
    })
}

// 压缩 AI 生图（包括朋友圈、论坛、相册等）
const compressAIImages = async () => {
    chatStore.triggerConfirm('AI 图片压缩', '这将压缩所有 AI 生成的图片（朋友圈、论坛、相册、情侣空间等），可能略微降低清晰度以节省空间。\n确定要继续吗？', async () => {
        chatStore.triggerToast('正在压缩 AI 图片，请稍候...', 'info')
        await new Promise(r => setTimeout(r, 50)) // Allow UI to render the toast
        let count = 0
        let savedSize = 0
        let loopCounter = 0

        try {
            // 1. 压缩聊天中的 AI 生图（最主要占用空间）
            const chats = chatStore.chats
            for (const chatId in chats) {
                const msgs = chats[chatId].msgs || []
                for (const msg of msgs) {
                    if (loopCounter++ % 100 === 0) await new Promise(r => setTimeout(r, 0)) // Yield event loop
                    // 处理 AI 生成的图片（包括 URL 和 base64 格式）
                    if (msg.image && typeof msg.image === 'string' && (msg.image.startsWith('http') || msg.image.startsWith('data:image'))) {
                        try {
                            const compressed = await reCompressBase64FromUrl(msg.image, compressQuality.value)
                            if (compressed && compressed.length > 0 && compressed.length < msg.image.length) {
                                savedSize += (msg.image.length - compressed.length)
                                msg.image = compressed
                                count++
                            } else if (compressed && compressed.length >= msg.image.length) {
                                // 压缩后更大或相同，不保存
                                console.log('Image compression skipped (no size reduction)')
                            }
                            // If compressed is null, skip silently
                        } catch (e) {
                            console.warn('Chat AI image compression error:', e.message)
                        }
                    }
                }
            }

            // 2. 压缩朋友圈图片
            const momentsStore = (await import('../../stores/momentsStore.js')).useMomentsStore()
            const allMoments = momentsStore.moments || []
            for (const moment of allMoments) {
                if (loopCounter++ % 100 === 0) await new Promise(r => setTimeout(r, 0))
                if (moment.images && Array.isArray(moment.images)) {
                    for (let i = 0; i < moment.images.length; i++) {
                        const imgUrl = moment.images[i]
                        if (imgUrl && typeof imgUrl === 'string' && (imgUrl.includes('pollinations') || imgUrl.startsWith('data:image'))) {
                            try {
                                const compressed = await reCompressBase64FromUrl(imgUrl, compressQuality.value)
                                if (compressed && compressed.length < imgUrl.length) {
                                    savedSize += (imgUrl.length - compressed.length)
                                    moment.images[i] = compressed
                                    count++
                                }
                            } catch (e) {
                                console.error('Moments image compression failed:', e)
                            }
                        }
                    }
                }
            }

            // 3. 压缩论坛帖子图片
            const forumStore = (await import('../../stores/forumStore.js')).useForumStore()
            const forumData = forumStore.forumData || {}
            for (const forumKey in forumData) {
                const posts = forumData[forumKey]?.posts || []
                for (const post of posts) {
                    if (loopCounter++ % 100 === 0) await new Promise(r => setTimeout(r, 0))
                    if (post.image && typeof post.image === 'string' && (post.image.includes('pollinations') || post.image.startsWith('data:image'))) {
                        try {
                            const compressed = await reCompressBase64FromUrl(post.image, compressQuality.value)
                            if (compressed && compressed.length < post.image.length) {
                                savedSize += (post.image.length - compressed.length)
                                post.image = compressed
                                count++
                            }
                        } catch (e) {
                            console.error('Forum image compression failed:', e)
                        }
                    }
                }
            }

            // 4. 压缩相册照片（查手机 & 情侣空间）
            // 查手机
            for (const charId in chats) {
                const char = chats[charId]
                const photos = char.phoneData?.apps?.photos?.photos || []
                for (const photo of photos) {
                    if (loopCounter++ % 50 === 0) await new Promise(r => setTimeout(r, 0))
                    if (photo.url && typeof photo.url === 'string' && (photo.url.includes('pollinations') || photo.url.startsWith('data:image'))) {
                        try {
                            const compressed = await reCompressBase64FromUrl(photo.url, compressQuality.value)
                            if (compressed && compressed.length < photo.url.length) {
                                savedSize += (photo.url.length - compressed.length)
                                photo.url = compressed
                                count++
                            }
                        } catch (e) {
                            console.error('Photos app compression failed:', e)
                        }
                    }
                }
            }

            // 情侣空间
            const loveSpaceStore = (await import('../../stores/loveSpaceStore.js')).useLoveSpaceStore()
            const spaces = loveSpaceStore.spaces || {}
            for (const sId in spaces) {
                const space = spaces[sId]
                // Album
                const album = space.album || []
                for (const photo of album) {
                    if (loopCounter++ % 50 === 0) await new Promise(r => setTimeout(r, 0))
                    const imgUrl = photo.url || photo.imageUrl || photo.image
                    if (imgUrl && typeof imgUrl === 'string' && (imgUrl.includes('pollinations') || imgUrl.startsWith('data:image'))) {
                        try {
                            const compressed = await reCompressBase64FromUrl(imgUrl, compressQuality.value)
                            if (compressed && compressed.length < imgUrl.length) {
                                savedSize += (imgUrl.length - compressed.length)
                                if (photo.url) photo.url = compressed
                                else if (photo.imageUrl) photo.imageUrl = compressed
                                else photo.image = compressed
                                count++
                            }
                        } catch (e) {
                            console.error('LoveSpace album compression failed:', e)
                        }
                    }
                }
                // Footprints (if any images in future)
                // Letters (if any images in future)
            }

            // 写入持久化
            await chatStore.saveChats()
            if (loveSpaceStore.saveToStorage) await loveSpaceStore.saveToStorage()

            calculateStorage()
            chatStore.triggerToast(`压缩完成！处理了 ${count} 张 AI 图片，释放了 ${formatSize(savedSize)}`, 'success')
        } catch (e) {
            console.error('AI Image compression failed:', e)
            chatStore.triggerToast('压缩失败，请重试', 'error')
        }
    })
}

// Helper: Compress from URL (fetch then compress)
const reCompressBase64FromUrl = async (url, quality) => {
    // If it's already base64, compress directly
    if (url.startsWith('data:image')) {
        return await reCompressBase64(url, quality)
    }
    
    // For remote URLs, try to fetch but allow failure
    try {
        const response = await fetch(url)
        if (!response.ok) {
            console.log(`Fetch failed for ${url}: ${response.status}`)
            return null // Return null to skip
        }
        
        const blob = await response.blob()
        const reader = new FileReader()
        return new Promise((resolve) => {
            reader.onload = () => {
                reCompressBase64(reader.result, quality)
                    .then(resolve)
                    .catch(() => resolve(null)) // Fail gracefully
            }
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
        })
    } catch (e) {
        console.log(`Image fetch skipped: ${e.message}`)
        return null // Skip on network error
    }
}

const clearLogs = () => {
    localStorage.removeItem('qiaoqiao_logs')
    chatStore.triggerToast('系统日志已清理', 'success')
    calculateStorage()
}

const clearChats = () => {
    chatStore.triggerConfirm('清空记录', '确定要清空所有聊天记录吗？', () => {
        chatStore.clearAllChats()
        calculateStorage()
        chatStore.triggerToast('聊天记录已清空', 'success')
    })
}
</script>

<template>
    <div class="storage-settings w-full h-full bg-gray-50 flex flex-col">
        <!-- Header -->
        <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
                <i class="fa-solid fa-chevron-left text-lg"></i>
                <span class="font-bold text-xl">存储空间</span>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-6">

            <!-- Usage Section -->
            <div>
                <h3 class="text-sm font-bold text-blue-500 mb-2 px-1">空间使用情况</h3>
                <div class="bg-white p-5 rounded-2xl shadow-sm">
                    <!-- Progress Header -->
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium text-gray-600">已用</span>
                        <span class="text-xs text-gray-500 font-bold">
                            {{ formatSize(usedSpace) }} / {{ formatSize(totalLimit) }} ({{ usedPercent }}%)
                        </span>
                    </div>
                    <!-- Bar -->
                    <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
                        <div class="h-full bg-green-500 rounded-full transition-all duration-500"
                            :style="{ width: usedPercent + '%' }"></div>
                    </div>

                    <!-- Breakdown List -->
                    <div class="space-y-4">
                        <div v-if="breakdown.logs > 0" class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">系统日志</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.logs) }}</span>
                        </div>
                        <div v-if="breakdown.chats > 0 || breakdown.system > 0" class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">聊天/生图缓存 (IndexedDB)</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.chats + breakdown.system) }}</span>
                        </div>
                        <div v-if="breakdown.gallery > 0" class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">图库照片 (IndexedDB)</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.gallery) }}</span>
                        </div>
                        <div v-if="breakdown.moments > 0" class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">朋友圈数据</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.moments) }}</span>
                        </div>
                        <div v-if="breakdown.images > 0" class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">自定义图片 (LS)</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.images) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm pb-1">
                            <span class="text-gray-600">页面配置/预设 (LS)</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.other) }}</span>
                        </div>
                    </div>
                </div>
                <p class="mt-3 text-[10px] text-gray-400 px-1 leading-relaxed">
                    * 数据已迁移至 IndexedDB 高容量存储，5MB 的 LocalStorage 限制已解除。当前浏览器为您分配的理论总空间为 {{ formatSize(totalLimit) }}。
                </p>
            </div>

            <!-- Compression Section -->
            <div>
                <h3 class="text-sm font-bold text-blue-500 mb-2 px-1">图片压缩设置</h3>
                <div class="bg-white p-5 rounded-2xl shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-base font-bold text-gray-800">聊天图片压缩质量</span>
                        <span class="text-base font-bold text-gray-800">{{ Math.round(compressQuality * 100) }}%</span>
                    </div>

                    <div class="mb-1">
                        <input type="range" v-model="compressQuality" min="0.1" max="1" step="0.1"
                            @change="updateCompressQuality"
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-300"
                            style="accent-color: #d1d5db;">
                        <!-- Note: accent-color might be browser specific, using generic gray/gold via css if needed or default -->
                    </div>

                    <div class="flex justify-between text-xs text-gray-400 mb-4">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                    </div>

                    <p class="text-xs text-gray-400 mb-4">调整聊天图片的压缩质量，影响图片清晰度和占用空间。</p>

                    <button @click="compressImages"
                        class="w-full bg-blue-400 text-white py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-compress"></i> 开始压缩所有聊天图片
                    </button>

                    <button @click="compressAIImages"
                        class="w-full mt-3 bg-purple-400 text-white py-3 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> 压缩所有 AI 生图 (朋友圈/论坛/相册)
                    </button>
                </div>
            </div>

            <!-- Deep Clean Section -->
            <div>
                <h3 class="text-sm font-bold text-blue-500 mb-2 px-1">深度清理 (瘦身)</h3>

                <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
                    <button @click="clearLogs"
                        class="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition border-b border-gray-100">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-terminal text-blue-500"></i>
                            <span class="text-sm text-gray-700 font-medium">清空系统日志</span>
                        </div>
                        <span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">推荐</span>
                    </button>

                    <button @click="cleanAllImages"
                        class="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition">
                        <div class="flex items-center gap-3">
                            <i class="fa-regular fa-image text-orange-500"></i>
                            <span class="text-sm text-gray-700 font-medium">仅清理所有图片</span>
                        </div>
                        <span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">保留文字</span>
                    </button>
                </div>

                <button @click="clearChats"
                    class="w-full flex items-center justify-between p-4 bg-red-500 text-white rounded-xl shadow-md active:scale-95 transition">
                    <div class="flex items-center gap-3">
                        <i class="fa-regular fa-comments"></i>
                        <span class="text-sm font-bold">清空所有聊天记录</span>
                    </div>
                    <span class="text-xs bg-white/20 text-white px-2 py-1 rounded">保留角色</span>
                </button>
            </div>

        </div>
    </div>
</template>

<style scoped>
/* Custom Slider Style to match screenshot 'gold/beige' thumb if possible, otherwise default */
input[type=range] {
    accent-color: #E5E7EB;
    /* Gray track feel */
}

/* Webkit thumb override for specificity if needed */
input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 18px;
    width: 18px;
    border-radius: 50%;
    background: #d1a968;
    /* Goldish color from screenshot */
    cursor: pointer;
    margin-top: -6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

input[type=range]::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: #E5E7EB;
    border-radius: 3px;
}
</style>
