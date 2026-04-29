<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMomentsStore } from '../../stores/momentsStore'

const emit = defineEmits(['back', 'jump'])

const momentsStore = useMomentsStore()
const activeTab = ref('all')
const hoveredItem = ref(null)

const filteredNotifications = computed(() => {
    const list = momentsStore.notifications
    if (activeTab.value === 'all') return list
    return list.filter(n => n.type === activeTab.value)
})

const unreadCount = computed(() => momentsStore.notifications.filter(n => !n.isRead).length)

const formatTime = (ts) => {
    const now = Date.now()
    const diff = (now - ts) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
    return new Date(ts).toLocaleDateString()
}

const markSingleRead = (item) => {
    item.isRead = true
}

const clearAllNotifications = () => {
    if (filteredNotifications.value.length === 0) return
    momentsStore.notifications.length = 0
}

const removeNotification = (id) => {
    const idx = momentsStore.notifications.findIndex(n => n.id === id)
    if (idx !== -1) {
        momentsStore.notifications.splice(idx, 1)
    }
}

onMounted(() => {
    momentsStore.markNotificationsRead()
})
</script>

<template>
    <div class="h-full bg-white flex flex-col animate-slide-in-right">
        <!-- Navbar -->
        <div class="h-12 bg-[#ededed] border-b border-[#dcdcdc] flex items-center px-4 shrink-0 relative">
            <button
                class="w-8 h-8 flex items-center justify-center -ml-2 active:bg-gray-200 rounded-full transition-colors"
                @click="emit('back')">
                <i class="fa-solid fa-chevron-left text-black text-lg"></i>
            </button>
            <span class="absolute left-1/2 -translate-x-1/2 font-medium text-base">消息</span>
            <button
                v-if="momentsStore.notifications.length > 0"
                class="w-8 h-8 flex items-center justify-center active:bg-gray-200 rounded-full transition-colors text-red-500 text-xs font-medium"
                @click="clearAllNotifications">
                清空
            </button>
            <div v-else class="w-8"></div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-100 shrink-0">
            <div class="tab-item" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
                <i class="fa-solid fa-bell"></i> 全部
                <span class="tab-badge" v-if="unreadCount > 0 && activeTab === 'all'">{{ unreadCount }}</span>
            </div>
            <div class="tab-item" :class="{ active: activeTab === 'like' }" @click="activeTab = 'like'">
                <i class="fa-solid fa-heart"></i> 赞
            </div>
            <div class="tab-item" :class="{ active: activeTab === 'comment' }" @click="activeTab = 'comment'">
                <i class="fa-solid fa-comment-dots"></i> 评论
            </div>
            <div class="tab-item" :class="{ active: activeTab === 'mention' }" @click="activeTab = 'mention'">
                <i class="fa-solid fa-at"></i> @我
            </div>
        </div>

        <!-- Notification List -->
        <div class="flex-1 overflow-y-auto">
            <div v-if="filteredNotifications.length === 0"
                class="flex flex-col items-center justify-center h-48 text-gray-400">
                <i class="fa-regular fa-bell-slash text-4xl mb-3"></i>
                <span>{{ activeTab === 'all' ? '暂无新消息' : `暂无${activeTab === 'like' ? '点赞' : activeTab === 'comment' ? '评论' : '@'}消息` }}</span>
            </div>

            <div v-for="item in filteredNotifications" :key="item.id"
                class="notification-item"
                :class="{ 'is-read': item.isRead }"
                @mouseenter="hoveredItem = item.id"
                @mouseleave="hoveredItem = null">
                <!-- Swipe Delete Button -->
                <div class="delete-btn" @click="removeNotification(item.id)">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <div class="notification-content"
                    @click="markSingleRead(item); emit('jump', item.momentId)">
                    <!-- Type Indicator Dot -->
                    <div class="type-dot" :class="'dot-' + item.type" v-if="!item.isRead"></div>
                    <!-- Avatar -->
                    <div class="w-10 h-10 rounded-lg overflow-hidden shrink-0 mr-3 bg-gray-100 relative">
                        <img :src="item.actorAvatar" class="w-full h-full object-cover">
                        <!-- Type Icon Badge -->
                        <div class="type-badge" :class="'badge-' + item.type">
                            <i v-if="item.type === 'like'" class="fa-solid fa-heart text-[8px]"></i>
                            <i v-else-if="item.type === 'comment'" class="fa-solid fa-comment text-[8px]"></i>
                            <i v-else class="fa-solid fa-at text-[8px]"></i>
                        </div>
                    </div>
                    <!-- Content -->
                    <div class="flex-1 min-w-0 flex flex-col justify-center min-h-[40px]">
                        <div class="flex items-center gap-1 mb-0.5">
                            <span class="actor-name">{{ item.actorName }}</span>
                            <span class="action-text">
                                <template v-if="item.type === 'like'">赞了你的动态</template>
                                <template v-else-if="item.type === 'comment'">评论了你的动态</template>
                                <template v-else-if="item.type === 'mention'">@了你</template>
                                <template v-else>{{ item.actionText || '与你互动' }}</template>
                            </span>
                        </div>
                        <div v-if="item.type === 'comment'" class="comment-preview text-sm text-gray-600 leading-snug mt-1">
                            "{{ item.content.substring(0, 50) }}{{ item.content.length > 50 ? '...' : '' }}"
                        </div>
                        <div class="time-text">{{ formatTime(item.timestamp) }}</div>
                    </div>
                    <!-- Thumbnail -->
                    <div class="w-14 h-14 bg-gray-100 ml-3 shrink-0 overflow-hidden rounded" v-if="item.momentImage">
                        <img :src="item.momentImage" class="w-full h-full object-cover">
                    </div>
                    <div class="w-14 h-14 bg-gray-100 ml-3 shrink-0 flex items-center justify-center text-xs text-gray-400 rounded"
                        v-else>
                        <i class="fa-regular fa-image"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-slide-in-right {
    animation: slideInRight 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
}

@keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
}

.tab-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 0;
    font-size: 13px;
    color: #999;
    cursor: pointer;
    position: relative;
    transition: color 0.2s;
}

.tab-item.active {
    color: #576b95;
    font-weight: 600;
}

.tab-item.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 2px;
    background: #576b95;
    border-radius: 1px;
}

.tab-badge {
    background: #ff3b30;
    color: white;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
    font-weight: 600;
}

.notification-item {
    display: flex;
    align-items: stretch;
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid #f5f5f5;
    transition: background 0.15s;
}

.notification-item:active {
    background: #f0f0f0;
}

.notification-item.is-read {
    background: #fafafa;
}

.delete-btn {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 64px;
    background: #ff3b30;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
}

.notification-content:hover .delete-btn,
.notification-content:active .delete-btn {
    opacity: 1;
}

.notification-content {
    flex: 1;
    display: flex;
    align-items: flex-start;
    padding: 12px 16px;
    min-height: 64px;
    cursor: pointer;
    position: relative;
    z-index: 1;
}

.type-dot {
    position: absolute;
    top: 16px;
    left: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.dot-like { background: #ff3b30; }
.dot-comment { background: #34c759; }
.dot-mention { background: #007aff; }
.dot-default { background: #999; }

.type-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border: 2px solid white;
}

.badge-like { background: #ff3b30; }
.badge-comment { background: #34c759; }
.badge-mention { background: #007aff; }
.badge-default { background: #999; }

.actor-name {
    color: #576b95;
    font-weight: 600;
    font-size: 14px;
}

.action-text {
    color: #333;
    font-size: 13px;
}

.comment-preview {
    padding: 4px 8px;
    background: #f7f7f7;
    border-radius: 4px;
    margin-top: 6px;
    display: inline-block;
}

.time-text {
    font-size: 11px;
    color: #bbb;
    margin-top: 4px;
}
</style>
