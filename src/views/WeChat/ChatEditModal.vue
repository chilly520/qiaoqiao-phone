<template>
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="close">
        <div class="bg-white rounded-2xl w-[90%] max-w-lg shadow-2xl flex flex-col max-h-[85vh] animate-scale-in">
            <!-- Header -->
            <div class="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 class="font-bold text-gray-800">编辑消息</h3>
                <button @click="close"
                    class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50" ref="listInfo" id="edit-msg-list">
                <!-- Dynamic Blocks -->
                <div v-for="(block, idx) in blocks" :key="idx"
                    class="bg-white p-3 rounded-xl border border-gray-200 relative group shadow-sm hover:shadow-md transition-shadow">
                    <!-- Remove Button -->
                    <button v-if="blocks.length > 1" @click="removeBlock(idx)"
                        class="absolute top-2 right-2 text-gray-300 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors z-10">
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <!-- Controls -->
                    <div class="flex gap-2 mb-2 pr-8">
                        <!-- Role Select -->
                        <select v-model="block.role"
                            class="text-xs py-1 h-8 w-20 bg-gray-50 border border-gray-200 rounded px-2 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none">
                            <option value="user">我</option>
                            <option value="ai">AI</option>
                            <option value="system">系统</option>
                        </select>
                        <!-- Type Select -->
                        <select v-model="block.type"
                            class="text-xs py-1 h-8 flex-1 bg-gray-50 border border-gray-200 rounded px-2 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none">
                            <option value="text">文本</option>
                            <option value="image">图片/表情包 URL</option>
                            <option value="voice">语音条</option>
                            <option value="html">HTML 卡片</option>
                            <option value="redpacket">红包</option>
                            <option value="transfer">转账</option>
                            <option value="family_card">亲属卡</option>
                        </select>
                    </div>

                    <!-- Content Input -->
                    <textarea v-model="block.content"
                        class="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-y placeholder-gray-400 font-mono leading-relaxed"
                        placeholder="请输入消息内容..."></textarea>
                </div>

                <!-- Add Button -->
                <button @click="addBlock"
                    class="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-green-500 hover:text-green-600 hover:bg-green-50 flex items-center justify-center gap-2 transition-all font-medium">
                    <i class="fa-solid fa-plus"></i> 添加拆分消息
                </button>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-gray-100 flex gap-3 bg-white rounded-b-2xl">
                <button @click="close"
                    class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
                <button @click="save"
                    class="flex-1 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 shadow-md shadow-green-500/20 transition-all active:scale-95">保存修改</button>
            </div>
        </div>
    </div>

    <!-- Toast (Independent of Modal Visibility) -->
    <div v-if="toastVisible"
        class="fixed top-10 left-1/2 -translate-x-1/2 bg-black/75 text-white px-4 py-2 rounded-lg shadow-lg z-[100] text-sm font-medium animate-fade-in pointer-events-none backdrop-blur-sm">
        <i class="fa-solid fa-circle-check text-green-400 mr-2"></i> {{ toastMessage }}
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '../../stores/chatStore'

const props = defineProps(['modelValue', 'targetMsgId'])
const emit = defineEmits(['update:modelValue', 'save'])

const chatStore = useChatStore()
const blocks = ref([])
const originalMsg = ref(null)

const visible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
})

watch(() => props.modelValue, (val) => {
    if (val && props.targetMsgId) {
        init()
    }
})

const init = () => {
    // Find Message
    const msgs = chatStore.currentChat.msgs || []
    const msg = msgs.find(m => m.id === props.targetMsgId)
    originalMsg.value = msg

    if (msg) {
        // Init block
        blocks.value = [{
            role: msg.role,
            type: normalizeType(msg.type),
            content: normalizeContent(msg)
        }]
    } else {
        blocks.value = []
    }
}

const normalizeType = (type) => {
    if (['redpacket', 'transfer', 'image', 'voice', 'html', 'family_card'].includes(type)) return type
    return 'text'
}

const normalizeContent = (msg) => {
    // For red packets and transfers, show RAW content with ID for debugging
    if (msg.type === 'redpacket' || msg.type === 'transfer') {
        // Show the full format: [红包:金额:备注:ID] or original content
        return msg.content || `[${msg.type}:${msg.amount}:${msg.note}:${msg.paymentId || 'NO-ID'}]`
    }

    if (msg.type === 'voice') return msg.text || ''

    let content = msg.content || ''

    // Auto-extract HTML from JSON card format
    if (msg.type === 'html' && content.trim().startsWith('{')) {
        try {
            const data = JSON.parse(content)
            if (data.html) return data.html
        } catch (e) {
            // ignore
        }
    }

    // Remove ONLY the Inner Voice block (non-greedy)
    content = content.replace(/\[INNER_VOICE\][\s\S]*?(\[\/INNER_VOICE\]|$)/gi, '').trim()

    return content
}

const addBlock = () => {
    blocks.value.push({ role: 'ai', type: 'text', content: '' })
    nextTick(() => {
        const list = document.getElementById('edit-msg-list')
        if (list) list.scrollTop = list.scrollHeight
    })
}

const removeBlock = (idx) => {
    blocks.value.splice(idx, 1)
}

const close = () => {
    visible.value = false
}

const save = () => {
    if (blocks.value.length === 0) return

    // Construct new messages
    const newMsgs = blocks.value.map(b => {
        const base = {
            role: b.role,
            type: 'text',
            content: b.content,
            timestamp: Date.now()
        }

        if (b.type === 'image') {
            base.type = 'image'
            // Check emoji format
            // (Stub: Keeping simple URL storage for now)
        } else if (b.type === 'voice') {
            base.type = 'voice'
            base.text = b.content
            base.content = 'Voice'
        } else if (b.type === 'html') {
            base.type = 'html'
            // For HTML, content is likely the JSON string or raw HTML
            // Ensure we save it correctly as content
            base.content = b.content
        } else if (b.type === 'redpacket') {
            base.type = 'redpacket'
            base.content = '红包'
            base.note = b.content || '恭喜发财'
            base.amount = '88.88'
        } else if (b.type === 'transfer') {
            base.type = 'transfer'
            base.content = '转账'
            base.note = b.content || '转账'
            base.amount = '520.00'
        } else if (b.type === 'family_card') {
            base.type = 'family_card'

            // If already formatted, use as is
            if (b.content && b.content.trim().startsWith('[FAMILY_CARD')) {
                base.content = b.content
            } else {
                let amt = '5200'
                let note = b.content || '亲属卡'

                const match = b.content ? b.content.match(/^(\d+)(.*)/) : null
                if (match) {
                    amt = match[1]
                    note = match[2].trim() || '亲属卡'
                }
                base.content = `[FAMILY_CARD:${amt}:${note}]`
            }
        }

        return base
    })

    // Save Logic
    // If single block and editing same msg, preserve ID and History
    if (newMsgs.length === 1 && originalMsg.value) {
        const m = newMsgs[0]
        m.id = originalMsg.value.id

        // History Logic
        if (originalMsg.value.content !== m.content || originalMsg.value.type !== m.type) {
            m.history = originalMsg.value.history || []
            m.history.unshift({
                content: originalMsg.value.content, // Simplification: Saving content string only
                // If complex type, might need to save more. For now, matching Legacy text-based history.
                timestamp: Date.now(),
                role: originalMsg.value.role
            })
        } else {
            m.history = originalMsg.value.history
        }

        // Replace in store
        const msgs = chatStore.currentChat.msgs
        const idx = msgs.findIndex(msg => msg.id === props.targetMsgId)
        if (idx !== -1) {
            msgs.splice(idx, 1, m)
            chatStore.saveChats()
        }
    } else {
        // Multi-block replace (Splitting)
        // Need to generate IDs for new blocks
        newMsgs.forEach(m => m.id = crypto.randomUUID())

        const msgs = chatStore.currentChat.msgs
        const idx = msgs.findIndex(msg => msg.id === props.targetMsgId)
        if (idx !== -1) {
            msgs.splice(idx, 1, ...newMsgs)
            chatStore.saveChats()
        }
    }


    close()
    showToast('消息已保存')
}

// Toast Logic
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer = null

const showToast = (msg) => {
    toastMessage.value = msg
    toastVisible.value = true

    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        toastVisible.value = false
    }, 2000)
}
</script>

<style scoped>
.animate-scale-in {
    animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
    from {
        transform: scale(0.95);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>

<style scoped>
/* Toast Animation */
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translate(-50%, 10px);
    }

    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}
</style>
