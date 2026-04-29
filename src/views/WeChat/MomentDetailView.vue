<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMomentsStore } from '../../stores/momentsStore'
import { useChatStore } from '../../stores/chatStore'
import MomentItem from '../../components/MomentItem.vue'

const route = useRoute()
const router = useRouter()
const momentsStore = useMomentsStore()
const chatStore = useChatStore()

const momentId = route.params.id
const moment = ref(null)

onMounted(() => {
    moment.value = momentsStore.moments.find(m => m.id === momentId) || null
})

const goBack = () => {
    router.back()
}

const handleEdit = (momentData) => {
    goBack()
}

const handleDelete = () => {
    momentsStore.deleteMoment(momentId)
    chatStore.triggerToast('已删除', 'success')
    goBack()
}

const handleToggleTop = () => {
    const isPinned = momentsStore.toggleTopMoment(momentId)
    chatStore.triggerToast(isPinned ? '已置顶' : '已取消置顶', 'success')
}

const handlePreviewImages = (data) => {
    if (moment.value) {
        moment.value.previewImages = data.images
        moment.value.previewIndex = data.index
    }
}

</script>

<template>
    <div class="moment-detail-view w-full h-full bg-white flex flex-col">
        <div class="h-[50px] flex items-center justify-between px-4 border-b border-gray-100 shrink-0 sticky top-0 bg-white/95 backdrop-blur z-20">
            <div class="flex items-center">
                <i class="fa-solid fa-chevron-left text-xl cursor-pointer p-2 -ml-2 text-gray-700" @click="goBack"></i>
                <span class="font-bold text-lg text-gray-800 ml-2">动态详情</span>
            </div>
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-share-from-square text-lg text-gray-500 cursor-pointer" @click="chatStore.triggerToast('分享功能开发中', 'info')"></i>
                <i class="fa-solid fa-ellipsis text-lg text-gray-500 cursor-pointer" @click="chatStore.triggerToast('更多操作开发中', 'info')"></i>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar bg-white">
            <div v-if="moment" class="detail-actions px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div class="flex items-center gap-4 text-xs text-gray-500">
                    <span><i class="fa-solid fa-heart mr-1"></i>{{ (moment.likes || []).length }}</span>
                    <span><i class="fa-solid fa-comment mr-1"></i>{{ (moment.comments || []).length }}</span>
                </div>
                <div class="flex items-center gap-3">
                    <button class="detail-btn" @click="handleToggleTop">
                        <i class="fa-solid fa-thumbtack mr-1"></i>置顶
                    </button>
                    <button class="detail-btn" @click="handleEdit(moment)">
                        <i class="fa-solid fa-pen mr-1"></i>编辑
                    </button>
                    <button class="detail-btn text-red-500" @click="handleDelete">
                        <i class="fa-solid fa-trash mr-1"></i>删除
                    </button>
                </div>
            </div>

            <div v-if="moment">
                <MomentItem
                    :moment="moment"
                    :is-detail="true"
                    @back="goBack"
                    @edit="handleEdit"
                    @show-profile="(id) => router.push(`/moments/profile/${id}`)"
                    @preview-images="handlePreviewImages"
                />
            </div>
            <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fa-regular fa-face-frown text-4xl mb-3"></i>
                <p>该动态已被删除或不存在</p>
                <button class="mt-4 px-6 py-2 bg-blue-500 text-white rounded-full text-sm" @click="goBack">返回</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
    display: none;
}

.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.detail-actions {
    background: linear-gradient(to bottom, #f9fafb, #ffffff);
}

.detail-btn {
    display: flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #6b7280;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.detail-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.detail-btn:active {
    transform: scale(0.95);
}

.detail-btn.text-red-500 {
    border-color: #fecaca;
    color: #ef4444;
}

.detail-btn.text-red-500:hover {
    background: #fef2f2;
    border-color: #fca5a5;
}
</style>
