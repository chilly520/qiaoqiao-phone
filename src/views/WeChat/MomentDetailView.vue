<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMomentsStore } from '../../stores/momentsStore'
import MomentItem from '../../components/MomentItem.vue'

const route = useRoute()
const router = useRouter()
const momentsStore = useMomentsStore()

const momentId = route.params.id
const moment = computed(() => {
    return momentsStore.moments.find(m => m.id === momentId)
})

const goBack = () => {
    router.back()
}

// Redirect if not found
onMounted(() => {
    if (!moment.value) {
        // Option: fetch from server if async, but here implies local store
        // If not found, maybe deleted or invalid link
    }
})

const handleEditMoment = () => {
    // Only support edit in the main view for now, or redirect?
    // For simplicity, disable edit in detail view or implement basic routing logic
}

</script>

<template>
    <div class="moment-detail-view w-full h-full bg-white flex flex-col">
        <!-- Header -->
        <div class="h-[50px] flex items-center px-4 border-b border-gray-100 shrink-0 sticky top-0 bg-white/95 backdrop-blur z-20">
            <i class="fa-solid fa-chevron-left text-xl cursor-pointer p-2 -ml-2 text-gray-700" @click="goBack"></i>
            <span class="font-bold text-lg text-gray-800 ml-2">动态详情</span>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto no-scrollbar bg-white">
            <div v-if="moment">
                <MomentItem 
                    :moment="moment" 
                    @back="goBack" 
                    @show-profile="(id) => router.push(`/moments/profile/${id}`)"
                />
            </div>
            <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fa-regular fa-face-frown text-4xl mb-3"></i>
                <p>该动态已被删除或不存在</p>
            </div>
        </div>
    </div>
</template>
