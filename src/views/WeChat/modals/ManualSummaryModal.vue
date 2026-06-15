<template>
    <div v-if="show"
        class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="bg-white w-[85%] max-w-[320px] rounded-2xl overflow-hidden shadow-2xl p-6 animate-scale-up"
            @click.stop>
            <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">手动触发总结</h3>
            <p class="text-xs text-gray-500 mb-4">输入要总结的消息范围（如 <b>1-50</b>），留空则总结全部未总结消息。</p>
            <input :value="range" @input="$emit('update:range', $event.target.value)" type="text"
                class="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                placeholder="如: 1-50（留空总结全部）">
            <div class="flex gap-3">
                <button @click="$emit('close')"
                    class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 transition-colors">
                    取消
                </button>
                <button @click="$emit('execute')"
                    class="flex-1 py-3 rounded-xl bg-purple-500 text-white font-bold active:bg-purple-600 transition-colors shadow-md">
                    开始总结
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    range: { type: String, default: '' }
})

defineEmits(['close', 'execute', 'update:range'])
</script>
