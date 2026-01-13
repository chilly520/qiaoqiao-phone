<template>
    <div class="h-full flex flex-col bg-[#1e1e1e] text-gray-300 font-sans">
        <!-- Header -->
        <div
            class="flex-shrink-0 h-10 bg-[#252526] border-b border-[#3e3e42] flex items-center justify-between px-3 select-none">
            <div class="flex items-center gap-3">
                <button @click="router.back()"
                    class="w-7 h-7 flex items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors">
                    <i class="fa-solid fa-chevron-left text-xs"></i>
                </button>
                <div class="font-bold text-sm text-white flex items-center gap-2">
                    <i class="fa-solid fa-terminal text-blue-400"></i> 系统控制台
                </div>
            </div>
            <div class="flex gap-2">
                <button @click="exportLogs"
                    class="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-blue-400"
                    title="导出日志">
                    <i class="fa-solid fa-download text-xs"></i>
                </button>
                <button @click="clearLogs"
                    class="w-6 h-6 rounded hover:bg-white/10 flex items-center justify-center text-red-400"
                    title="清空日志">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-[#3e3e42] bg-[#2d2d30]">
            <button v-for="tab in ['logs', 'context']" :key="tab" @click="currentTab = tab"
                class="flex-1 py-2 text-xs font-bold transition-colors border-b-2"
                :class="currentTab === tab ? 'text-blue-400 border-blue-400 bg-white/5' : 'text-gray-500 border-transparent hover:bg-white/5'">
                <i class="fa-solid mr-1" :class="tab === 'logs' ? 'fa-list' : 'fa-code'"></i>
                {{ tab === 'logs' ? '系统日志' : '即时上下文' }}
            </button>
        </div>

        <!-- Tab Content: Logs -->
        <div v-if="currentTab === 'logs'" class="flex-1 flex flex-col min-h-0">
            <!-- Filter Bar -->
            <div class="flex-shrink-0 p-2 bg-[#2d2d30] border-b border-[#3e3e42] flex gap-2 items-center">
                <select v-model="filterLevel"
                    class="bg-[#3c3c3c] text-ccc border border-[#555] rounded px-2 py-0.5 text-xs outline-none">
                    <option value="">全部级别</option>
                    <option value="error">ERROR</option>
                    <option value="warn">WARNING</option>
                    <option value="info">INFO</option>
                    <option value="debug">DEBUG</option>
                    <option value="ai">AI</option>
                    <option value="sys">SYS</option>
                </select>
                <input v-model="filterKeyword" type="text" placeholder="搜索日志..."
                    class="flex-1 bg-[#3c3c3c] text-ccc border border-[#555] rounded px-2 py-0.5 text-xs outline-none">
                <button @click="loggerStore.autoScroll = !loggerStore.autoScroll"
                    class="text-[10px] px-2 py-1 rounded transition-colors"
                    :class="loggerStore.autoScroll ? 'bg-[#0e639c] text-white' : 'bg-[#3c3c3c] text-gray-400'">
                    自动滚动: {{ loggerStore.autoScroll ? 'ON' : 'OFF' }}
                </button>
            </div>

            <!-- Log List -->
            <div ref="logsContainer"
                class="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-2 custom-scrollbar bg-[#1e1e1e]">
                <div v-for="log in filteredLogs" :key="log.id"
                    class="break-words leading-relaxed border-b border-gray-800 pb-2">
                    <!-- Log Header Line -->
                    <div class="flex items-start gap-2">
                        <span class="opacity-50 select-none whitespace-nowrap">{{ log.time }}</span>

                        <!-- Badge Type -->
                        <span
                            class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider select-none min-w-[50px] text-center"
                            :class="getBadgeClass(log.type)">
                            {{ log.type }}
                        </span>

                        <span class="text-gray-300 font-medium flex-1">{{ log.title }}</span>
                    </div>

                    <!-- Expandable Detail Trigger -->
                    <div v-if="log.detail" class="mt-1 ml-[70px]">
                        <button @click="toggleLog(log.id)"
                            class="text-[10px] flex items-center gap-1 hover:text-white transition-colors select-none opacity-60 hover:opacity-100"
                            :class="isExpanded(log.id) ? 'text-blue-400' : 'text-gray-500'">
                            <i class="fa-solid fa-play text-[8px] transition-transform"
                                :class="{ 'rotate-90': isExpanded(log.id) }"></i>
                            [{{ isExpanded(log.id) ? '收起详情' : '查看详情 / Raw Data' }}]
                        </button>

                        <!-- Detail Content -->
                        <div v-if="isExpanded(log.id)"
                            class="mt-2 p-2 bg-black/30 rounded border border-gray-700/50 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap select-text">
                            {{ formatDetail(log.detail) }}
                        </div>
                    </div>
                </div>

                <div v-if="filteredLogs.length === 0" class="text-center text-gray-600 mt-10 select-none">
                    无日志数据
                </div>
            </div>
        </div>

        <!-- Tab Content: Context -->
        <div v-else class="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
            <div class="p-2 border-b border-[#3e3e42] bg-[#2d2d30] flex justify-between items-center select-none">
                <span class="text-xs text-gray-500">最近一次 API 请求上下文详情</span>
                <button class="text-xs bg-green-700 text-white px-2 py-0.5 rounded hover:bg-green-600"
                    @click="forceReview">
                    刷新
                </button>
            </div>
            <div
                class="flex-1 overflow-y-auto p-4 text-xs font-mono text-gray-300 select-text whitespace-pre-wrap custom-scrollbar">
                <div v-if="contextData">
                    <!-- Params -->
                    <div class="mb-4 p-2 bg-black/20 rounded border border-gray-700">
                        <div class="text-gray-500 font-bold mb-1 pb-1 border-b border-gray-700">Request Meta</div>
                        <div class="text-green-400 truncate">{{ contextParams }}</div>
                    </div>

                    <!-- Messages -->
                    <div v-for="(msg, idx) in contextMessages" :key="idx"
                        class="mb-4 p-3 rounded border border-gray-700" :class="getRoleClass(msg.role)">
                        <div class="font-bold mb-2 uppercase flex justify-between items-center text-[10px] opacity-70">
                            <span><i class="fa-solid mr-1" :class="getRoleIcon(msg.role)"></i> [{{ idx }}] {{ msg.role
                            }}</span>
                            <span class="font-mono">Len: {{ getLength(msg.content) }}</span>
                        </div>
                        <div class="opacity-90 leading-relaxed">{{ formatPayloadContent(msg.content) }}</div>
                    </div>
                </div>
                <div v-else class="text-center text-gray-600 mt-20 select-none">
                    暂无上下文数据<br>请先进行一次 AI 对话
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLoggerStore } from '../../stores/loggerStore'

const router = useRouter()
const loggerStore = useLoggerStore()
const currentTab = ref('logs')
const filterLevel = ref('')
const filterKeyword = ref('')
const logsContainer = ref(null)
const expandedLogs = ref(new Set())

// Actions
const clearLogs = () => loggerStore.clearLogs()
const exportLogs = () => loggerStore.exportLogs()
const forceReview = () => { /* Triggered automatically by Vue reactivity */ }

const toggleLog = (id) => {
    if (expandedLogs.value.has(id)) {
        expandedLogs.value.delete(id)
    } else {
        expandedLogs.value.add(id)
    }
}

const isExpanded = (id) => expandedLogs.value.has(id)

// Filtering
const filteredLogs = computed(() => {
    return loggerStore.logs.filter(log => {
        if (filterLevel.value && log.type.toLowerCase() !== filterLevel.value.toLowerCase()) return false
        if (filterKeyword.value) {
            const kw = filterKeyword.value.toLowerCase()
            return (log.title && log.title.toLowerCase().includes(kw)) ||
                (log.detail && String(log.detail).toLowerCase().includes(kw))
        }
        return true
    })
})

// Auto Scroll Logic
const scrollToBottom = () => {
    nextTick(() => {
        if (logsContainer.value) {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight
        }
    })
}

// Scroll on new logs
watch(() => loggerStore.logs.length, () => {
    if (loggerStore.autoScroll && currentTab.value === 'logs') {
        scrollToBottom()
    }
})

// Scroll on mount (Initial Load)
onMounted(() => {
    scrollToBottom()
})

// Scroll when switching back to logs tab
watch(currentTab, (newVal) => {
    if (newVal === 'logs') {
        scrollToBottom()
    }
})

// Formatting
const getBadgeClass = (type) => {
    if (!type) return 'bg-gray-700 text-gray-300'
    const t = type.toUpperCase()
    if (t === 'ERROR') return 'bg-red-900/40 text-red-400 border border-red-900/50'
    if (t === 'WARN') return 'bg-yellow-900/40 text-yellow-500 border border-yellow-900/50'
    if (t === 'INFO') return 'bg-blue-900/40 text-blue-400 border border-blue-900/50'
    if (t === 'AI') return 'bg-purple-900/40 text-purple-400 border border-purple-900/50'
    if (t === 'DEBUG') return 'bg-gray-800 text-gray-500 border border-gray-700'
    if (t === 'SYS') return 'bg-green-900/40 text-green-400 border border-green-900/50'
    return 'bg-gray-800 text-gray-300'
}

const formatDetail = (detail) => {
    if (typeof detail === 'object') return JSON.stringify(detail, null, 2)
    return detail
}

// Context Logic
const contextData = computed(() => {
    const log = loggerStore.lastContext
    if (!log || !log.detail) return null
    try {
        return typeof log.detail === 'string' ? JSON.parse(log.detail) : log.detail
    } catch { return null }
})

const contextParams = computed(() => {
    if (!contextData.value) return ''
    // Try to get from root, payload (OpenAI), or requestBody (Summarize log)
    const d = contextData.value.payload || contextData.value.requestBody || contextData.value
    const { model, temperature, max_tokens } = d
    return JSON.stringify({
        model,
        temperature,
        max_tokens,
        provider: contextData.value.provider || d.provider
    }, null, 2)
})

const contextMessages = computed(() => {
    const d = contextData.value?.payload || contextData.value?.requestBody || contextData.value
    if (d?.messages) return d.messages
    if (d?.contents) {
        // Map Gemini contents to standard role/content for display
        return d.contents.map(c => ({
            role: c.role === 'model' ? 'assistant' : c.role,
            content: c.parts?.[0]?.text || '[Complex Message]'
        }))
    }
    return []
})

const getRoleClass = (role) => {
    if (role === 'system') return 'bg-red-900/10 border-red-900/30 text-red-200'
    if (role === 'user') return 'bg-green-900/10 border-green-900/30 text-green-200'
    if (role === 'assistant' || role === 'model') return 'bg-blue-900/10 border-blue-900/30 text-blue-200'
    return 'bg-gray-800/50'
}

const getRoleIcon = (role) => {
    if (role === 'system') return 'fa-gear'
    if (role === 'user') return 'fa-user'
    if (role === 'assistant' || role === 'model') return 'fa-robot'
    return 'fa-circle-question'
}

const getLength = (content) => {
    if (typeof content === 'string') return content.length
    if (Array.isArray(content)) return content.reduce((acc, part) => acc + (part.text?.length || 0), 0)
    return 0
}

const formatPayloadContent = (content) => {
    if (typeof content === 'string') return content
    return JSON.stringify(content, null, 2)
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
}
</style>
