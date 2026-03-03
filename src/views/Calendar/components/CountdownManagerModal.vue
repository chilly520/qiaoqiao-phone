<template>
    <div class="modal-overlay" @click.self="close">
        <div class="modal-container">
            <div class="modal-header">
                <h3>⏰ 倒计时管理</h3>
                <button class="close-btn" @click="close">&times;</button>
            </div>

            <div class="modal-body p-4">
                <div v-if="countdowns.length === 0" class="empty-state">
                    <div class="empty-icon">⏳</div>
                    <p>暂无倒计时/纪念日记录</p>
                </div>

                <div v-else class="countdown-list">
                    <div v-for="item in sortedCountdowns" :key="item.id" class="countdown-card"
                        :style="{ borderLeftColor: item.color || '#ff9eb5' }">
                        <div class="countdown-info">
                            <div class="cd-header">
                                <span class="cd-title">{{ item.title }}</span>
                                <span v-if="item.isRecurring" class="cd-badge">每年重复</span>
                            </div>
                            <div class="cd-meta">
                                目标日: {{ item.targetDate }}
                                <span v-if="item.note" class="cd-note">· {{ item.note }}</span>
                            </div>
                        </div>
                        <div class="countdown-status">
                            <template v-if="getDaysLeft(item.targetDate, item.isRecurring) > 0">
                                <span class="cd-label">还有</span>
                                <span class="cd-days text-pink-500">{{ getDaysLeft(item.targetDate, item.isRecurring)
                                    }}</span>
                                <span class="cd-label">天</span>
                            </template>
                            <template v-else-if="getDaysLeft(item.targetDate, item.isRecurring) < 0">
                                <span class="cd-label">已过</span>
                                <span class="cd-days text-gray-500">{{ Math.abs(getDaysLeft(item.targetDate,
                                    item.isRecurring)) }}</span>
                                <span class="cd-label">天</span>
                            </template>
                            <template v-else>
                                <span class="cd-days text-pink-500">就是今天</span>
                            </template>
                        </div>
                        <button class="delete-btn" @click.stop="deleteCountdown(item.id)">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn-primary w-full" @click="openCreateModal">
                    <i class="fa-solid fa-plus mr-2"></i> 新建倒计时
                </button>
            </div>
        </div>

        <!-- 嵌套的创建弹窗 -->
        <CountdownModal v-if="showCreate" @close="showCreate = false" @save="handleSave" />
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useCalendarStore } from '../../../stores/calendarStore'
import CountdownModal from './CountdownModal.vue'

const emit = defineEmits(['close'])
const calendarStore = useCalendarStore()

const showCreate = ref(false)

const countdowns = computed(() => calendarStore.countdowns || [])

const sortedCountdowns = computed(() => {
    return [...countdowns.value].sort((a, b) => {
        return getDaysLeft(a.targetDate, a.isRecurring) - getDaysLeft(b.targetDate, b.isRecurring)
    })
})

function getDaysLeft(targetDateStr, isRecurring) {
    const target = new Date(targetDateStr)
    target.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (isRecurring) {
        const currentYear = today.getFullYear()
        target.setFullYear(currentYear)
        if (target < today) {
            target.setFullYear(currentYear + 1)
        }
    }

    const diffTime = target - today
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function deleteCountdown(id) {
    if (confirm('确定要删除这个倒计时吗？')) {
        calendarStore.countdowns = calendarStore.countdowns.filter(c => c.id !== id)
        // 持久化保存
        if (calendarStore.saveToStorage) calendarStore.saveToStorage() // 或者手动存
    }
}

function openCreateModal() {
    showCreate.value = true
}

function handleSave(data) {
    calendarStore.addCountdown(data)
    showCreate.value = false
}

function close() {
    emit('close')
}
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(90, 90, 122, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-container {
    background: white;
    border-radius: 20px;
    width: 90%;
    max-width: 400px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(90, 90, 122, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, rgba(255, 183, 197, 0.2), rgba(197, 201, 255, 0.2));
    border-bottom: 1px solid rgba(139, 122, 168, 0.1);
}

.modal-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: #5a5a7a;
    margin: 0;
}

.close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(139, 122, 168, 0.1);
    color: #8b7aa8;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.modal-body {
    overflow-y: auto;
    flex: 1;
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #9a8fb8;
}

.empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
}

.countdown-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: #fdfdfd;
    border: 1px solid #eee;
    border-left-width: 4px;
    border-radius: 12px;
    margin-bottom: 12px;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.countdown-info {
    flex: 1;
    overflow: hidden;
}

.cd-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}

.cd-title {
    font-weight: 600;
    color: #374151;
    font-size: 15px;
}

.cd-badge {
    font-size: 10px;
    background: #f3f4f6;
    color: #6b7280;
    padding: 2px 6px;
    border-radius: 4px;
}

.cd-meta {
    font-size: 11px;
    color: #9ca3af;
}

.cd-note {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.countdown-status {
    text-align: right;
    min-width: 60px;
    padding-right: 28px;
    /* space for delete btn */
}

.cd-label {
    font-size: 11px;
    color: #9ca3af;
    margin: 0 2px;
}

.cd-days {
    font-size: 20px;
    font-weight: bold;
}

.delete-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #d1d5db;
    background: transparent;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 8px;
    transition: color 0.2s;
}

.delete-btn:hover {
    color: #ef4444;
}

.modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(139, 122, 168, 0.1);
    background: white;
}

.btn-primary {
    padding: 12px 24px;
    border-radius: 12px;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
    color: white;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(255, 183, 197, 0.4);
}
</style>
