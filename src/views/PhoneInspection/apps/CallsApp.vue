<template>
    <div class="calls-app flex flex-col h-full bg-white relative text-gray-900">
        <!-- Header -->
        <div class="pt-16 pb-4 px-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div class="flex items-center justify-between mb-2">
                <button @click="$emit('back')" class="text-blue-500 font-bold active:scale-95">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="flex gap-4">
                    <button class="text-black font-black border-b-2 border-black pb-1 text-sm">所有通话</button>
                    <button class="text-gray-400 font-bold text-sm">未接来电</button>
                </div>
                <button class="text-blue-500 font-bold text-sm">编辑</button>
            </div>
            <h1 class="text-3xl font-black mt-4 tracking-tight">最近项目</h1>
        </div>

        <!-- Calls List -->
        <div class="flex-1 overflow-y-auto">
            <div v-for="(call, index) in history" :key="index"
                class="flex items-center px-6 py-4 border-b border-gray-50 active:bg-gray-50 cursor-pointer group"
                @click="selectedCall = call">
                <div class="mr-4 text-gray-200 group-active:text-blue-200 transition-colors">
                    <i class="fa-solid fa-phone" :class="{ 'text-red-500': call.type === 'missed' }"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center px-1">
                        <span class="font-black text-[17px] truncate"
                            :class="{ 'text-red-400': call.type === 'missed' }">
                            {{ call.name }}
                        </span>
                        <span class="text-xs text-gray-400 font-bold ml-2">{{ call.time }}</span>
                    </div>
                    <div class="text-[12px] text-gray-400 font-bold px-1 mt-0.5">
                        {{ call.type === 'incoming' ? '呼入通话' : call.type === 'outgoing' ? '呼出通话' : '未接来电' }}
                        <span v-if="call.duration !== '0'">· {{ call.duration }}</span>
                    </div>
                </div>
                <button class="ml-4 text-blue-500/20 group-hover:text-blue-500 transition-colors">
                    <i class="fa-solid fa-circle-info text-xl"></i>
                </button>
            </div>

            <!-- Empty State -->
            <div v-if="history.length === 0" class="py-20 text-center text-gray-400">
                <i class="fa-solid fa-phone-slash text-6xl opacity-10 mb-4 text-pink-300"></i>
                <p>暂无通话记录</p>
            </div>
        </div>

        <!-- Detail Overlay -->
        <Transition name="slide-up">
            <div v-if="selectedCall" class="fixed inset-0 z-[100] bg-[#F2F2F7] flex flex-col overflow-hidden">
                <div
                    class="pt-16 pb-4 px-4 bg-white/80 backdrop-blur-md flex items-center justify-between border-b border-gray-200">
                    <button @click="selectedCall = null" class="text-blue-500 font-bold px-2">取消</button>
                    <span class="font-black text-gray-800">通话详情</span>
                    <div class="w-12"></div>
                </div>

                <div class="flex-1 overflow-y-auto p-6">
                    <div
                        class="bg-white rounded-[32px] p-8 flex flex-col items-center shadow-sm border border-gray-100 mb-6">
                        <div
                            class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-4xl mb-4 shadow-inner">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <h2 class="text-2xl font-black text-gray-800 mb-1">{{ selectedCall.name }}</h2>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Mobile • 中国</p>

                        <div class="flex gap-4 mt-8 w-full">
                            <a :href="'tel:' + (selectedCall.phone || '10086')"
                                class="flex-1 bg-blue-500 text-white p-4 rounded-2xl flex flex-col items-center font-black">
                                <i class="fa-solid fa-phone mb-1"></i>
                                <span class="text-[10px]">呼叫</span>
                            </a>
                            <div
                                class="flex-1 bg-blue-500 text-white p-4 rounded-2xl flex flex-col items-center font-black">
                                <i class="fa-solid fa-message mb-1"></i>
                                <span class="text-[10px]">信息</span>
                            </div>
                            <div
                                class="flex-1 bg-blue-500 text-white p-4 rounded-2xl flex flex-col items-center font-black">
                                <i class="fa-solid fa-video mb-1"></i>
                                <span class="text-[10px]">视频</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">通话历史</h3>
                        <div class="flex justify-between items-center py-3 border-b border-gray-50">
                            <div class="flex flex-col">
                                <span class="text-sm font-black">{{ selectedCall.time }}</span>
                                <span class="text-[11px] text-gray-400 font-bold">{{ selectedCall.type === 'missed' ?
                                    '未接' : '已接通' }}</span>
                            </div>
                            <span class="text-sm font-bold text-gray-400">{{ selectedCall.duration }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- Bottom Nav (Standard iOS Style) -->
        <div class="flex justify-around items-center py-4 border-t border-gray-100 bg-white/90 backdrop-blur-md pb-10">
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-regular fa-star text-xl"></i>
                <span class="text-[10px] font-bold mt-1">个人收藏</span>
            </div>
            <div class="flex flex-col items-center text-blue-500">
                <i class="fa-solid fa-clock text-xl"></i>
                <span class="text-[10px] font-bold mt-1">最近项目</span>
            </div>
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-regular fa-user-circle text-xl"></i>
                <span class="text-[10px] font-bold mt-1">通讯录</span>
            </div>
            <div class="flex flex-col items-center text-gray-400">
                <i class="fa-solid fa-th text-xl"></i>
                <span class="text-[10px] font-bold mt-1">拨号键盘</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    callsData: Object
})

const emit = defineEmits(['back'])

const selectedCall = ref(null)

const history = computed(() => {
    return props.callsData?.history || []
})
</script>

<style scoped>
.calls-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from {
    transform: translateY(100%);
}

.slide-up-leave-to {
    transform: translateY(100%);
}
</style>
