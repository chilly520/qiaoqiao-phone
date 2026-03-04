<template>
    <div class="chat-container bg-gray-50 flex flex-col h-full overflow-hidden">
        <!-- 客服列表模式 -->
        <div v-if="!activeChatId" class="flex-1 overflow-y-auto pb-10 animate-fade-in text-gray-800">
            <div class="p-4 pt-10 bg-white border-b sticky top-0 z-20">
                <h2 class="text-xl font-black">客服消息</h2>
            </div>

            <div class="p-4 space-y-3">
                <!-- 官方客服固定项 -->
                <div @click="enterChat('platform')"
                    class="bg-white p-4 rounded-3xl shadow-sm border border-transparent hover:border-orange-200 flex items-center gap-4 active:scale-95 transition-all">
                    <div class="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <h4 class="font-bold text-sm">官方客服小蜜</h4>
                            <span class="text-[10px] text-gray-300">刚刚</span>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-1 line-clamp-1">亲，有什么可以帮您的吗？</p>
                    </div>
                </div>

                <!-- 店铺客服动态列表 -->
                <div v-for="(msgs, shopId) in store.chatMessages" :key="shopId" @click="enterChat(shopId)"
                    class="bg-white p-4 rounded-3xl shadow-sm border border-transparent hover:border-gray-200 flex items-center gap-4 active:scale-95 transition-all">
                    <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">🏬</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <h4 class="font-bold text-sm">{{ shopId }}</h4>
                            <span class="text-[10px] text-gray-300">{{ formatTime(msgs[msgs.length - 1].timestamp)
                            }}</span>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-1 line-clamp-1 italic">{{ msgs[msgs.length - 1].content
                            }}
                        </p>
                    </div>
                </div>

                <div v-if="Object.keys(store.chatMessages).length === 0" class="py-20 text-center text-gray-300">
                    <p class="text-4xl mb-2">📩</p>
                    <p class="text-xs">暂无联系过的店铺客服</p>
                </div>
            </div>
        </div>

        <!-- 具体聊天模式 -->
        <div v-else class="chat-view-detail flex-1 flex flex-col bg-white overflow-hidden animate-slide-in-right">
            <!-- 聊天头部 -->
            <div class="p-4 pt-10 border-b flex items-center gap-3 bg-white z-20">
                <button @click="exitChatDetail"
                    class="text-2xl text-gray-400 active:scale-75 transition-transform px-1">‹</button>
                <div class="flex-1">
                    <h3 class="font-black text-sm text-gray-800">{{ activeChatId === 'platform' ? '官方客服小蜜' :
                        activeChatId }}</h3>
                    <div class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        <span class="text-[8px] text-gray-400 font-bold uppercase">AI 助手在线</span>
                    </div>
                </div>
            </div>

            <!-- 消息列表 -->
            <div class="flex-1 p-4 overflow-y-auto space-y-6 bg-gray-50/50" ref="messageContainer">
                <div v-for="msg in currentMessages" :key="msg.id"
                    :class="['flex gap-3', msg.type === 'user' ? 'flex-row-reverse' : '']">

                    <img :src="msg.type === 'user' ? store.currentUser.avatar : (msg.sender?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${activeChatId}`)"
                        class="w-10 h-10 rounded-2xl bg-white shadow-sm object-cover border border-gray-100">

                    <div :class="['max-w-[75%] flex flex-col', msg.type === 'user' ? 'items-end' : 'items-start']">
                        <!-- 消息内容 -->
                        <div v-if="!isRecommend(msg.content)" :class="[
                            'px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed',
                            msg.type === 'user'
                                ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-tr-none'
                                : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                        ]">
                            {{ msg.content }}
                        </div>

                        <!-- 推荐商品卡片 -->
                        <div v-else
                            class="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm w-48 active:scale-95 transition-transform"
                            @click="openProduct(msg.content)">
                            <img :src="getRecommendProd(msg.content)?.image" class="w-full h-32 object-cover">
                            <div class="p-2">
                                <p class="text-xs font-bold line-clamp-1">{{ getRecommendProd(msg.content)?.title }}</p>
                                <p class="text-xs text-red-500 mt-1 font-black">¥{{ getRecommendProd(msg.content)?.price
                                }}</p>
                            </div>
                            <div class="p-2 border-t text-[10px] text-orange-500 text-center font-bold">查看详情</div>
                        </div>

                        <span class="text-[8px] text-gray-300 mt-1 font-mono uppercase">{{ formatTime(msg.timestamp)
                        }}</span>
                    </div>
                </div>

                <div v-if="store.loading" class="flex gap-3 animate-pulse">
                    <div class="w-10 h-10 bg-gray-200 rounded-2xl"></div>
                    <div
                        class="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-gray-100 flex items-center justify-center min-w-[40px]">
                        <div class="flex gap-1">
                            <div class="w-1 h-1 bg-gray-300 rounded-full animate-bounce"></div>
                            <div class="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0.2s">
                            </div>
                            <div class="w-1 h-1 bg-gray-300 rounded-full animate-bounce" style="animation-delay: 0.4s">
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 底部撑开间距 -->
                <div class="h-4"></div>
            </div>

            <!-- 输入框容器：独立定位，避开外部影响 -->
            <div
                class="chat-input-area p-4 bg-white border-t flex items-end gap-2 shadow-[0_-5px_30px_rgba(0,0,0,0.05)] pb-safe z-50">
                <!-- AI 召唤按钮 -->
                <button @click="store.triggerAIReply(activeChatId)"
                    class="w-11 h-11 bg-orange-50 text-orange-500 border border-orange-200 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-transform flex-none">
                    ✨
                </button>
                <div class="flex-1 bg-gray-100 rounded-2xl px-4 py-1.5 flex items-center min-h-[44px]">
                    <textarea v-model="inputText" placeholder="咨询客服..." @keyup.enter.exact="handleSendMessage"
                        class="flex-1 bg-transparent text-sm py-2 focus:outline-none resize-none overflow-hidden"
                        rows="1"></textarea>
                </div>
                <button @click="handleSendMessage"
                    class="w-11 h-11 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-90 transition-transform flex-none">
                    🚀
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useShoppingStore } from '@/stores/shoppingStore'

const store = useShoppingStore()
const activeChatId = ref(store.activeShopId || null)
const inputText = ref('')
const messageContainer = ref(null)

const emit = defineEmits(['show-product', 'toggle-dock'])

const enterChat = (id) => {
    activeChatId.value = id
    store.activeShopId = id
    emit('toggle-dock', false) // 隐藏 Dock
}

const exitChatDetail = () => {
    activeChatId.value = null
    store.activeShopId = null
    emit('toggle-dock', true) // 显示 Dock
}

const currentMessages = computed(() => {
    return store.chatMessages[activeChatId.value] || []
})

const isRecommend = (content) => content && String(content).includes('[COMMAND:RECOMMEND:')
const getRecommendId = (content) => content.match(/RECOMMEND:([^\]]+)/)?.[1]
const getRecommendProd = (content) => {
    const id = getRecommendId(content)
    return store.products.find(p => p.id === id)
}
const openProduct = (content) => {
    const prod = getRecommendProd(content)
    if (prod) emit('show-product', prod)
}

const scrollToBottom = async () => {
    await nextTick()
    if (messageContainer.value) {
        messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
}

watch(activeChatId, (val) => { if (val) scrollToBottom() })
watch(currentMessages, () => { scrollToBottom() }, { deep: true })

const handleSendMessage = () => {
    const text = inputText.value.trim()
    if (!text) return
    store.sendMessage(activeChatId.value, text)
    inputText.value = ''
    scrollToBottom()
}

const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
    if (activeChatId.value) {
        scrollToBottom()
        emit('toggle-dock', true) // 初始强制更新状态
        setTimeout(() => emit('toggle-dock', false), 50)
    }
})
</script>

<style scoped>
@keyframes slide-in-right {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}

.animate-slide-in-right {
    animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

textarea {
    line-height: 1.5;
    max-height: 100px;
}

.chat-input-area {
    padding-bottom: calc(max(1rem, env(safe-area-inset-bottom)) + 2px);
}
</style>
