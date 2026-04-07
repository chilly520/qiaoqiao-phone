<template>
    <div class="backpack-app flex flex-col h-full bg-[#FAFAFA] text-[#333]">
        <!-- Header -->
        <div
            class="app-header px-6 pt-16 pb-4 bg-white border-b border-gray-50 flex items-center justify-between shadow-sm sticky top-0 z-30">
            <button @click="$emit('back')"
                class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-[#FD70A1] active:scale-95 transition-transform">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="font-black text-[17px] text-gray-800 tracking-tight">次元仓库</span>
            <div class="w-10 flex justify-end">
                <i class="fa-solid fa-boxes-stacked text-gray-200"></i>
            </div>
        </div>

        <!-- Categories -->
        <div class="px-6 py-4 flex gap-3 overflow-x-auto hide-scrollbar whitespace-nowrap bg-white/50">
            <button v-for="cat in ['全部', '礼品', '美食', '日常', '收藏']" :key="cat"
                :class="['px-4 py-2 rounded-2xl text-xs font-black transition-all',
                    activeCategory === cat ? 'bg-[#FD70A1] text-white shadow-lg shadow-pink-100' : 'bg-white text-gray-400 border border-gray-100']" @click="activeCategory = cat">
                {{ cat }}
            </button>
        </div>

        <!-- Inventory Grid -->
        <div class="flex-1 overflow-y-auto px-6 py-4 pb-20">
            <div v-if="filteredItems.length === 0"
                class="empty-state flex flex-col items-center justify-center h-64 opacity-20">
                <i class="fa-solid fa-ghost text-6xl mb-4 text-[#8F5E6E]"></i>
                <p class="text-[#8F5E6E] font-black">这里空空如也喵~</p>
            </div>

            <div v-else class="grid grid-cols-3 gap-4">
                <div v-for="item in filteredItems" :key="item.id"
                    class="item-card group flex flex-col items-center bg-white rounded-3xl p-3 border border-gray-50 shadow-sm active:scale-95 active:shadow-inner transition-all relative overflow-hidden"
                    @click="selectedItem = item">
                    <div
                        class="w-full aspect-square rounded-2xl bg-[#FDF2F8] flex items-center justify-center mb-2 shadow-inner-sm relative group-hover:bg-pink-50 transition-colors">
                        <img v-if="item.icon" :src="item.icon" class="w-12 h-12 object-contain drop-shadow-md">
                        <i v-else class="fa-solid fa-gift text-3xl text-pink-200"></i>

                        <!-- Glow effect -->
                        <div
                            class="absolute inset-0 bg-gradient-to-tr from-pink-400/0 to-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        </div>
                    </div>
                    <span class="text-[11px] font-black text-gray-700 truncate w-full text-center">{{ item.name
                    }}</span>

                    <div v-if="item.count > 1"
                        class="absolute top-2 right-2 bg-[#FC6C9C] text-white text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full font-black border border-white">
                        {{ item.count }}
                    </div>

                    <!-- Category tag (subtle) -->
                    <div v-if="item.source === '购物'" class="absolute -left-1 -top-1">
                        <div
                            class="bg-orange-400 text-white text-[6px] px-1.5 py-0.5 rounded-br-lg font-black uppercase tracking-tighter shadow-sm scale-75">
                            SHOP</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Item Detail Dialog -->
        <Transition name="fade">
            <div v-if="selectedItem"
                class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
                @click="selectedItem = null">
                <div class="bg-white rounded-[40px] w-full max-w-xs p-8 shadow-2xl animate-pop-in relative overflow-hidden"
                    @click.stop>
                    <!-- Background aesthetic -->
                    <div
                        class="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50">
                    </div>

                    <div class="flex flex-col items-center relative z-10">
                        <div
                            class="w-36 h-36 bg-gradient-to-br from-[#FFF5F8] to-white rounded-[40px] flex items-center justify-center mb-6 shadow-xl border-4 border-white">
                            <img v-if="selectedItem.icon" :src="selectedItem.icon"
                                class="w-24 h-24 object-contain drop-shadow-xl">
                            <i v-else class="fa-solid fa-gift text-7xl text-pink-200"></i>
                        </div>

                        <div class="flex items-center gap-2 mb-2">
                            <span
                                class="px-3 py-1 bg-pink-50 text-pink-500 rounded-full text-[10px] font-black uppercase tracking-widest">{{
                                    selectedItem.category || '其它' }}</span>
                            <span v-if="selectedItem.source"
                                class="px-3 py-1 bg-orange-50 text-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest">{{
                                    selectedItem.source }}</span>
                        </div>

                        <h3 class="text-2xl font-black text-gray-800 mb-3 text-center leading-tight">{{
                            selectedItem.name }}</h3>
                        <p class="text-[13px] text-gray-400 text-center mb-8 leading-relaxed font-bold italic px-2">
                            "{{ selectedItem.description || '一件充满回忆与温暖的特殊法宝喵~' }}"
                        </p>

                        <div class="w-full flex gap-3">
                            <button @click="claimItem"
                                class="flex-1 py-4 bg-[#F5F5F7] text-gray-500 rounded-2xl font-black active:scale-95 transition-all text-xs border border-gray-100 shadow-inner-sm">
                                领取礼物
                            </button>
                            <button @click="selectedItem = null"
                                class="flex-1 py-4 bg-gradient-to-r from-[#FF72A1] to-[#FC6C9C] text-white rounded-2xl font-black shadow-lg shadow-pink-100 active:scale-95 transition-all text-xs">
                                确认关闭
                            </button>
                        </div>

                        <p class="mt-6 text-[9px] text-gray-300 font-black uppercase tracking-[2px]">Item
                            Identification: 0-QC-B1</p>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useBackpackStore } from '@/stores/backpackStore'
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const props = defineProps({
    backpackData: Object
})

const emit = defineEmits(['back'])

const activeCategory = ref('全部')
const selectedItem = ref(null)
const userBackpack = useBackpackStore()
const phoneInspection = usePhoneInspectionStore()

const items = computed(() => {
    const rawItems = props.backpackData?.items || []
    return [...rawItems].sort((a, b) => {
        const tA = a.timestamp || (a.time ? new Date(a.time).getTime() : 0)
        const tB = b.timestamp || (b.time ? new Date(b.time).getTime() : 0)
        return tB - tA
    })
})

const filteredItems = computed(() => {
    if (activeCategory.value === '全部') return items.value
    return items.value.filter(i => i.category === activeCategory.value)
})

function claimItem() {
    if (!selectedItem.value) return

    // 1. 添加到用户主背包
    userBackpack.addItem({
        title: selectedItem.value.name,
        description: selectedItem.value.description,
        image: selectedItem.value.icon,
        category: 'other',
        source: '角色手机'
    })

    // 2. 从角色手机背包中移除
    phoneInspection.removeBackpackItem(phoneInspection.currentCharId, selectedItem.value.id)

    phoneInspection.triggerCustomModal({
        type: 'success',
        title: '领取成功 ✨',
        message: `"${selectedItem.value.name}" 已从手机存入你的主背包喵~ 快去看看吧！`
    })
    selectedItem.value = null
}
</script>

<style scoped>
.backpack-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.item-card {
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.hide-scrollbar::-webkit-scrollbar {
    display: none;
}

.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.shadow-inner-sm {
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
}

.animate-pop-in {
    animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop-in {
    from {
        transform: scale(0.85);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
