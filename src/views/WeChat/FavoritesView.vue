<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '../../stores/favoritesStore'

const router = useRouter()
const favoritesStore = useFavoritesStore()

const goBack = () => {
    router.back()
}

const favorites = computed(() => favoritesStore.favorites)

const formatDate = (ts) => {
    return new Date(ts).toLocaleString()
}

const getPreview = (item) => {
    if (item.type === 'image') return '[图片]'
    if (item.type === 'redpacket') return '[红包]'
    if (item.type === 'transfer') return '[转账]'
    return item.content
}

const openDetail = (item) => {
    router.push(`/favorites/${item.id}`)
}

const deleteItem = (id) => {
    if(confirm('确认删除?')) {
        favoritesStore.removeFavorite(id)
    }
}
</script>

<template>
    <div class="h-full bg-gray-100 flex flex-col">
        <!-- Header -->
        <div class="h-[44px] bg-white flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
             <div class="flex items-center gap-1 cursor-pointer w-20" @click="goBack">
                <i class="fa-solid fa-chevron-left text-black"></i>
                <span class="font-bold text-base text-black">返回</span>
            </div>
            <div class="font-bold text-base">我的收藏</div>
            <div class="w-20 flex justify-end">
                <i class="fa-solid fa-magnifying-glass text-black"></i>
            </div>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
             <div v-if="favorites.length === 0" class="text-center text-gray-400 mt-20">
                 暂无收藏内容
             </div>

             <div v-for="item in favorites" :key="item.id" 
                  class="bg-white p-4 rounded-lg shadow-sm active:bg-gray-50 transition-colors"
                  @click="openDetail(item)"
             >
                 <div class="flex items-center gap-2 mb-2">
                     <div class="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center text-xs text-gray-500 font-bold">
                         {{ item.author[0] }}
                     </div>
                     <span class="text-xs text-gray-500">{{ item.author }}</span>
                     <span class="text-xs text-gray-300 ml-auto">{{ formatDate(item.savedAt) }}</span>
                 </div>
                 
                 <div class="text-sm text-gray-800 line-clamp-3">
                     {{ getPreview(item) }}
                 </div>
                 
                 <div class="mt-2 text-xs text-blue-500 flex justify-end gap-3">
                     <span @click.stop="deleteItem(item.id)">删除</span>
                 </div>
             </div>
        </div>
    </div>
</template>
