<template>
    <div v-if="show"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="w-[90%] max-w-[360px] h-[85%] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            :class="isDark ? 'bg-[#0f172a]' : 'bg-white'" @click.stop>
            <!-- Header with Theme Switcher -->
            <div class="p-4 border-b" :class="isDark
                ? 'border-[#334155] bg-gradient-to-r from-purple-900/50 to-pink-900/50'
                : 'border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50'">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-bold flex items-center gap-2 text-lg"
                        :class="isDark ? 'text-white' : 'text-gray-800'">
                        <i class="fa-solid fa-brain text-purple-500"></i> 记忆管理库
                    </span>
                    <button @click="$emit('close')" class="transition-colors"
                        :class="isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Theme Selector -->
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button v-for="theme in themes" :key="theme.id" @click="$emit('update:currentTheme', theme.id)"
                        class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0"
                        :class="currentTheme === theme.id
                            ? 'bg-gradient-to-r ' + theme.activeGradient + ' text-white shadow-md scale-105'
                            : (isDark ? 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')">
                        <i :class="theme.icon"></i> {{ theme.name }}
                    </button>
                </div>
            </div>

            <!-- Memory List with Dynamic Theme -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3" :class="themeBackground">
                <div v-if="!memories || memories.length === 0" class="text-center text-gray-400 py-12 text-sm">
                    <i class="fa-solid fa-box-open text-4xl mb-3 opacity-30"></i>
                    <div>暂无记忆</div>
                </div>

                <div v-for="(mem, index) in memories" :key="index" class="relative transition-all duration-300"
                    :class="{ 'pl-8': isEditMode }">
                    <!-- Checkbox (Only in Edit Mode) -->
                    <div v-if="isEditMode" class="absolute left-0 top-3">
                        <input type="checkbox"
                            class="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition-transform hover:scale-110"
                            :checked="selectedIndices.has(index)" @change="$emit('toggle-select', index)">
                    </div>

                    <!-- Memory Card with Theme -->
                    <div :class="themeCardClass" class="transition-all duration-300 hover:shadow-lg">
                        <!-- Editing Mode -->
                        <div v-if="editingIndex === index">
                            <textarea :value="editingContent" @input="$emit('update:editingContent', $event.target.value)"
                                class="w-full border-2 border-purple-300 rounded-lg p-3 text-sm h-32 mb-2 focus:ring-2 focus:ring-purple-400 outline-none font-serif"
                                :class="isDark ? 'bg-gray-700 text-white border-purple-600 focus:ring-purple-500' : ''"></textarea>
                            <div class="flex justify-end gap-2">
                                <button class="text-xs px-4 py-1.5 rounded-lg transition-colors"
                                    :class="isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                                    @click="$emit('cancel-edit')">取消</button>
                                <button
                                    class="text-xs px-4 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-md"
                                    @click="$emit('save-edit', index)">保存</button>
                            </div>
                        </div>

                        <!-- Display Mode -->
                        <div v-else>
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex items-center gap-2">
                                    <span :class="themeNumberClass">
                                        {{ themeNumberPrefix((memories?.length || 0) - index) }}
                                    </span>
                                    <span :class="themeBadgeClass">{{ themeLabel }}</span>
                                </div>
                                <div class="flex gap-2">
                                    <button class="text-blue-500 hover:text-blue-600 transition-colors p-1"
                                        @click="$emit('start-edit', index, mem)" title="编辑">
                                        <i class="fa-solid fa-pen text-sm"></i>
                                    </button>
                                    <button class="text-red-500 hover:text-red-600 transition-colors p-1"
                                        @click="$emit('delete', index)" title="删除">
                                        <i class="fa-solid fa-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <div :class="themeContentClass">
                                {{ typeof mem === 'object' ? (mem.content || JSON.stringify(mem)) : mem }}
                            </div>
                            <div v-if="typeof mem === 'object' && mem.range" :class="themeMetaClass">
                                <i class="fa-solid fa-clock mr-1"></i>
                                {{ mem.range }} · {{ formatTimestamp(mem.timestamp) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer with Edit Mode Toggle -->
            <div class="p-3 border-t flex justify-between items-center gap-2"
                :class="isDark ? 'bg-[#0f172a] border-[#334155]' : 'bg-white border-gray-200'">
                <button @click="$emit('toggle-edit-mode')"
                    class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2"
                    :class="isEditMode
                        ? 'bg-purple-500 text-white shadow-md'
                        : (isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')">
                    <i class="fa-solid" :class="isEditMode ? 'fa-check' : 'fa-edit'"></i>
                    {{ isEditMode ? '完成' : '编辑' }}
                </button>

                <div v-if="isEditMode" class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                        :class="isDark ? 'text-gray-400' : 'text-gray-600'">
                        <input type="checkbox" :checked="isAllSelected" @change="$emit('toggle-select-all')"
                            class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                        全选
                    </label>
                    <button
                        class="text-xs px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5"
                        :class="selectedIndices.size > 0 && !isSummarizing
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-md'
                            : (isDark ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')"
                        @click="$emit('batch-summarize')" :disabled="selectedIndices.size === 0 || isSummarizing">
                        <i class="fa-solid fa-wand-magic-sparkles text-xs" :class="{ 'animate-spin': isSummarizing }"></i>
                        {{ isSummarizing ? '总结中...' : `总结 (${selectedIndices.size})` }}
                    </button>
                    <button
                        class="text-xs px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5"
                        :class="selectedIndices.size > 0
                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                            : (isDark ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed')"
                        @click="$emit('batch-delete')" :disabled="selectedIndices.size === 0">
                        <i class="fa-solid fa-trash"></i>
                        删除 ({{ selectedIndices.size }})
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
    show: { type: Boolean, default: false },
    isDark: { type: Boolean, default: false },
    memories: { type: Array, default: () => [] },
    themes: { type: Array, default: () => [] },
    currentTheme: { type: String, default: '' },
    isEditMode: { type: Boolean, default: false },
    selectedIndices: { type: Set, default: () => new Set() },
    isAllSelected: { type: Boolean, default: false },
    isSummarizing: { type: Boolean, default: false },
    editingIndex: { type: Number, default: -1 },
    editingContent: { type: String, default: '' },
    // 由父组件传入的 computed theme style 字符串
    themeBackground: { type: String, default: '' },
    themeCardClass: { type: String, default: '' },
    themeNumberClass: { type: String, default: '' },
    themeBadgeClass: { type: String, default: '' },
    themeContentClass: { type: String, default: '' },
    themeMetaClass: { type: String, default: '' },
    themeLabel: { type: String, default: '' }
})

const emit = defineEmits([
    'close',
    'update:currentTheme',
    'update:editingContent',
    'toggle-edit-mode',
    'toggle-select',
    'toggle-select-all',
    'start-edit',
    'cancel-edit',
    'save-edit',
    'delete',
    'batch-summarize',
    'batch-delete'
])

// 工具函数：时间戳格式化
function formatTimestamp(ts) {
    return new Date(ts).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// 数字前缀（如 1, 2, 3 ... 或 一, 二, 三 ... 由父组件决定样式）
function themeNumberPrefix(n) {
    return n
}
</script>
