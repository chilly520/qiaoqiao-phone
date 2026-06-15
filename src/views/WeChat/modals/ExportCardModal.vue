<template>
    <div v-if="show"
        class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="bg-white w-[85%] max-w-[320px] rounded-2xl overflow-hidden shadow-2xl p-6 animate-scale-up"
            @click.stop>
            <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">导出角色卡</h3>

            <div class="space-y-3 mb-6">
                <!-- Include Memory -->
                <div class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none"
                    @click="$emit('update:includeMemory', !includeMemory)">
                    <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                        :class="includeMemory ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300'">
                        <i v-if="includeMemory" class="fa-solid fa-check text-white text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-700">包含记忆库</div>
                        <div class="text-[10px] text-gray-400">保留角色已有的长期记忆</div>
                    </div>
                </div>

                <!-- Include History -->
                <div class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none"
                    @click="$emit('update:includeHistory', !includeHistory)">
                    <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                        :class="includeHistory ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'">
                        <i v-if="includeHistory" class="fa-solid fa-check text-white text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-700">包含聊天记录</div>
                        <div class="text-[10px]" :class="sizeWarning ? 'text-red-500 font-bold' : 'text-gray-400'">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                            预估大小: {{ estimatedSize }}
                        </div>
                    </div>
                </div>

                <!-- Exclude Images -->
                <div v-if="includeHistory" class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none ml-4 animate-slide-in"
                    @click="$emit('update:excludeImages', !excludeImages)">
                    <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                        :class="excludeImages ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'">
                        <i v-if="excludeImages" class="fa-solid fa-check text-white text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-700">排除图片</div>
                        <div class="text-[10px] text-gray-400">仅导出文字内容，显著减小文件体积</div>
                    </div>
                </div>
            </div>

            <div v-if="sizeWarning" class="mb-4 p-2 bg-red-50 rounded-lg border border-red-100 text-[10px] text-red-600">
                <i class="fa-solid fa-circle-exclamation mr-1"></i>
                检测到超大历史记录，导出可能会导致浏览器崩溃或导出失败。建议先进行"图片压缩"或只导出基础信息。
            </div>

            <div class="flex gap-3">
                <button
                    class="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
                    @click="$emit('close')">取消</button>
                <button
                    class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                    @click="$emit('export')">导出</button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    includeMemory: { type: Boolean, default: true },
    includeHistory: { type: Boolean, default: false },
    excludeImages: { type: Boolean, default: false },
    sizeWarning: { type: Boolean, default: false },
    estimatedSize: { type: String, default: '0 KB' }
})

defineEmits([
    'close',
    'export',
    'update:includeMemory',
    'update:includeHistory',
    'update:excludeImages'
])
</script>
