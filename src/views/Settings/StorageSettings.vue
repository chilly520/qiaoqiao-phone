<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const { compressQuality } = storeToRefs(settingsStore)

const goBack = () => {
    router.back()
}

// Stats
const totalLimit = 5 * 1024 * 1024 // 5MB limit
const usedSpace = ref(0)
const breakdown = ref({
    logs: 0,
    chats: 0,
    moments: 0,
    images: 0,
    other: 0
})

// Mock helper to estimate string size in bytes
const getSize = (str) => str ? new Blob([str]).size : 0

const calculateStorage = () => {
    let total = 0
    let details = {
        logs: 0,
        chats: 0, // Will include chatStore state if persisted, or we approximate from memory
        moments: 0,
        images: 0,
        other: 0
    }

    // 1. Calculate LocalStorage usage
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            const size = getSize(localStorage[key]) + key.length
            total += size

            // Categorize
            if (key === 'qiaoqiao_logs' || key.includes('log')) details.logs += size
            else if (key.includes('chat') || key === 'qiaoqiao_chat_store') details.chats += size
            else if (key.includes('moment')) details.moments += size
            else if (key.includes('image') || key.includes('avatar')) details.images += size
            else details.other += size
        }
    }

    // Checking in-memory if not fully persisted yet (User requested "Source code looks like this", implying original logic)
    // We'll trust whatever is in LS + generic buckets for now to match visual.
    // If chatStore is empty in LS, we might want to manually add it for display?
    // Let's stick to strict LS for accuracy, but categorize strictly.

    // Explicitly check for our known keys if they exist under 'other'
    // 'qiaoqiao_settings' -> other/config

    usedSpace.value = total
    breakdown.value = details
}

onMounted(() => {
    calculateStorage()
})

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const usedPercent = computed(() => {
    return Math.min(((usedSpace.value / totalLimit) * 100), 100).toFixed(1)
})

// Actions
const updateCompressQuality = () => {
    settingsStore.setCompressQuality(compressQuality.value)
}



// Image Compression Logic
const compressImages = async () => {
    chatStore.triggerConfirm('图片压缩', '这将重新压缩所有现有的聊天图片，可能会略微降低清晰度以节省空间。\n确定要继续吗？', async () => {
        chatStore.triggerToast('正在压缩图片，请稍候...', 'info')
        let count = 0
        let savedSize = 0

        // Process
        const chats = chatStore.chats
        for (const chatId in chats) {
            const msgs = chats[chatId].msgs || []
            for (const msg of msgs) {
                // Check for image content
                const imgMatch = msg.content && typeof msg.content === 'string' && msg.content.match(/^\[图片:(data:image\/[^;]+;base64,[^\]]+)\]$/)

                if (imgMatch) {
                    try {
                        const originalBase64 = imgMatch[1]
                        // Re-compress using a helper (we'll inline a simple one or use utils if available)
                        // Using simple canvas re-draw here for "retroactive" compression
                        const newBase64 = await reCompressBase64(originalBase64, compressQuality.value)

                        if (newBase64.length < originalBase64.length) {
                            savedSize += (originalBase64.length - newBase64.length)
                            msg.content = `[图片:${newBase64}]`
                            count++
                        }
                    } catch (e) {
                        console.error('Compression failed for msg', msg.id, e)
                    }
                }
            }
        }

        chatStore.saveChats()
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
    chatStore.triggerConfirm('深度清理', '确定要删除所有聊天图片吗？\n文字记录将被保留，图片将变为[已清理]。\n此操作不可撤销！', () => {
        let count = 0
        let savedSize = 0

        const chats = chatStore.chats
        for (const chatId in chats) {
            const msgs = chats[chatId].msgs || []
            for (const msg of msgs) {
                // Check for image content or raw Base64 blocks
                if (msg.content && typeof msg.content === 'string') {
                    if (msg.content.includes('[图片:data:image')) {
                        const oldLen = msg.content.length
                        msg.content = '[图片已清理]' // Replace with placeholder
                        savedSize += oldLen
                        count++
                    }
                }
            }
        }

        chatStore.saveChats()
        calculateStorage()
        chatStore.triggerToast(`清理完成！删除了 ${count} 张图片，释放了 ${formatSize(savedSize)}`, 'success')
    })
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
                            {{ formatSize(usedSpace) }} / ~5MB ({{ usedPercent }}%)
                        </span>
                    </div>
                    <!-- Bar -->
                    <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
                        <div class="h-full bg-green-500 rounded-full transition-all duration-500"
                            :style="{ width: usedPercent + '%' }"></div>
                    </div>

                    <!-- Breakdown List -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">系统日志</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.logs) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">聊天记录</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.chats) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">朋友圈</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.moments) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                            <span class="text-gray-600">图片/头像</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.images) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm pb-1">
                            <span class="text-gray-600">其他配置</span>
                            <span class="text-gray-400">{{ formatSize(breakdown.other) }}</span>
                        </div>
                    </div>
                </div>
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
    @apply accent-[#E5E7EB];
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
