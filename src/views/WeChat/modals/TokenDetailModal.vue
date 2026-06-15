<template>
    <div v-if="show"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="w-[90%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl"
            :class="isDark ? 'bg-[#1e293b]' : 'bg-white'" @click.stop>
            <div class="p-3 flex justify-between items-center border-b"
                :class="isDark ? 'bg-[#334155] border-[#475569]' : 'bg-gray-100 border-gray-200'">
                <span class="font-bold" :class="isDark ? 'text-white' : 'text-gray-800'">Token 统计详情</span>
                <button @click="$emit('close')"
                    :class="isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="p-4 space-y-3 text-sm">
                <div class="flex justify-between items-center mb-2 pb-2 border-b"
                    :class="isDark ? 'border-gray-700' : 'border-gray-100'">
                    <span class="font-bold" :class="isDark ? 'text-white' : 'text-gray-700'">总计 (Total Context)</span>
                    <span class="font-bold text-purple-600 font-mono">{{ tokenCounts?.total || 0 }}</span>
                </div>

                <div class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    <div v-for="(label, key) in labels" :key="key">
                        <div class="flex justify-between items-center text-gray-600 cursor-pointer p-2 rounded transition-colors"
                            :class="isDark ? 'text-gray-300 hover:bg-white/10' : 'hover:bg-gray-50'"
                            @click="$emit('toggle', key)">
                            <span class="font-medium border-b border-dashed transition-colors"
                                :class="isDark ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-500'">{{ label }}</span>
                            <span class="font-mono px-1.5 rounded text-xs"
                                :class="isDark ? 'text-gray-400 bg-gray-700' : 'text-gray-500 bg-gray-100'">{{ tokenCounts[key] || 0 }}</span>
                        </div>

                        <div v-if="expandedKey === key"
                            class="mt-1 p-2 rounded text-[10px] whitespace-pre-wrap font-mono break-all max-h-[200px] overflow-y-auto shadow-inner"
                            :class="isDark ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-50 text-gray-500 border border-gray-100'">
                            {{ previewData[key] || '（无内容）' }}
                        </div>
                    </div>
                </div>

                <div class="mt-4 text-[10px] text-center border-t pt-2"
                    :class="isDark ? 'text-gray-500 border-gray-700' : 'text-gray-400'">
                    * 点击条目可查看实际发送给 AI 的文本内容<br>
                    * 估算值：1 中文 ≈ 1 Token, 3 英文 ≈ 1 Token
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    show: { type: Boolean, default: false },
    isDark: { type: Boolean, default: false },
    tokenCounts: { type: Object, default: () => ({}) },
    labels: { type: Object, default: () => ({}) },
    previewData: { type: Object, default: () => ({}) },
    expandedKey: { type: String, default: null }
})

defineEmits(['close', 'toggle'])
</script>
