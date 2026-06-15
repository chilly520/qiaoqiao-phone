<template>
    <Transition name="fade">
        <div v-if="show"
            class="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            @click="$emit('close')">
            <div class="w-full max-w-[500px] bg-[#f8f9fa] rounded-t-[32px] flex flex-col max-h-[85vh] animate-slide-up shadow-2xl"
                @click.stop :class="isDark ? 'bg-[#0f172a] text-white' : 'bg-[#f8f9fa] text-gray-800'">
                <!-- Header -->
                <div class="sticky top-0 p-6 flex flex-col gap-4 bg-inherit rounded-t-[32px] border-b"
                    :class="isDark ? 'border-white/10' : 'border-gray-100'">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-black">选择音色 (Doubao)</h2>
                        <button @click="$emit('close')"
                            class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <!-- Search Bar -->
                    <div class="relative">
                        <i
                            class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input :value="searchQuery" @input="$emit('update:searchQuery', $event.target.value)"
                            type="text" placeholder="搜索发声人名称或 ID..."
                            class="w-full pl-11 pr-4 py-3 rounded-2xl border-none outline-none text-sm transition-all shadow-sm"
                            :class="isDark ? 'bg-white/5 focus:bg-white/10 text-white' : 'bg-white focus:shadow-md'">
                    </div>
                </div>

                <!-- List container with specific height/scroll -->
                <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
                    <div v-for="v in filteredVoices" :key="v.id" @click="$emit('select', v.id)"
                        class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                        :class="[
                            currentSpeaker === v.id
                                ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                                : (isDark ? 'hover:bg-white/5 border border-transparent' : 'hover:bg-white border border-transparent hover:border-gray-100')
                        ]">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm">{{ v.name }}</span>
                            <span class="text-[10px] opacity-40 font-mono">{{ v.id }}</span>
                        </div>
                        <div v-if="currentSpeaker === v.id"
                            class="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-check text-white text-[10px]"></i>
                        </div>
                    </div>
                    <div v-if="!filteredVoices || filteredVoices.length === 0" class="py-12 text-center opacity-40 italic text-sm">
                        未找到相关音色
                    </div>
                </div>

                <div class="h-8 shrink-0"></div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
defineProps({
    show: { type: Boolean, default: false },
    isDark: { type: Boolean, default: false },
    searchQuery: { type: String, default: '' },
    filteredVoices: { type: Array, default: () => [] },
    currentSpeaker: { type: String, default: '' }
})

defineEmits(['close', 'select', 'update:searchQuery'])
</script>
