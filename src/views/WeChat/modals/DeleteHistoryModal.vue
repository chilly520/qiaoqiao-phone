<template>
    <div v-if="show"
        class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('cancel')">
        <div class="bg-white w-[85%] max-w-[320px] rounded-2xl overflow-hidden shadow-2xl p-6 animate-scale-up"
            @click.stop>
            <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">确认清除聊天记录</h3>

            <div class="space-y-3 mb-6">
                <div class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none"
                    @click="$emit('update:includeMemory', !includeMemory)">
                    <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                        :class="includeMemory ? 'bg-red-500 border-red-500' : 'bg-white border-gray-300'">
                        <i v-if="includeMemory" class="fa-solid fa-check text-white text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-700">清空记忆管理库</div>
                        <div class="text-[10px] text-gray-400 text-red-500">
                            <i class="fa-solid fa-triangle-exclamation mr-1"></i>此操作不可恢复
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-3">
                <button @click="$emit('cancel')"
                    class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 transition-colors">
                    取消
                </button>
                <button @click="$emit('confirm')"
                    class="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold active:bg-red-600 transition-colors shadow-md">
                    确认删除
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    includeMemory: { type: Boolean, default: false }
})

defineEmits(['cancel', 'confirm', 'update:includeMemory'])
</script>
