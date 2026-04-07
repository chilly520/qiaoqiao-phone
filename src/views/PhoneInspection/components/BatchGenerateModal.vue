<template>
    <Transition name="fade">
        <div v-if="modelValue"
            class="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <div
                class="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-pop-in flex flex-col max-h-[80vh]">
                <!-- Header -->
                <div class="px-8 pt-8 pb-4 text-center">
                    <div
                        class="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-pink-500 text-3xl">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <h3 class="text-xl font-black text-[#8F5E6E]">智能数据生成</h3>
                    <p class="text-xs text-gray-400 mt-2">勾选想要同步/生成的应用数据喵~</p>
                </div>

                <!-- App List -->
                <div class="flex-1 overflow-y-auto px-6 py-2 custom-scrollbar">
                    <div class="space-y-2">
                        <div v-for="app in apps" :key="app.id"
                            class="flex items-center p-3 rounded-2xl border-2 transition-all cursor-pointer"
                            :class="selectedApps.includes(app.id) ? 'border-pink-200 bg-pink-50' : 'border-gray-50 bg-gray-50/50'"
                            @click="toggleApp(app.id)">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white mr-3 shadow-sm"
                                :style="{ backgroundColor: app.color }">
                                <i :class="app.icon"></i>
                            </div>
                            <div class="flex-1">
                                <div class="text-[14px] font-bold text-[#8F5E6E]">{{ app.name }}</div>
                                <div class="text-[10px] text-gray-400 capitalize">{{ app.id }} data sync</div>
                            </div>
                            <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                                :class="selectedApps.includes(app.id) ? 'bg-pink-500 border-pink-500 text-white' : 'border-gray-200'">
                                <i v-if="selectedApps.includes(app.id)" class="fa-solid fa-check text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="p-8 space-y-3">
                    <button @click="handleGenerate" :disabled="isGenerating || selectedApps.length === 0"
                        class="w-full py-4 bg-[#FC6C9C] text-white rounded-2xl font-black shadow-lg shadow-pink-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-2">
                        <i v-if="isGenerating" class="fa-solid fa-spinner fa-spin"></i>
                        <span v-if="!isGenerating">立即生成</span>
                        <span v-else>正在同步数据...</span>
                    </button>
                    <button @click="close"
                        class="w-full py-2 text-gray-400 text-xs font-bold hover:text-gray-600 transition-colors">
                        下次再说喵
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    modelValue: Boolean,
    apps: {
        type: Array,
        default: () => [
            { id: 'wechat', name: '微信', icon: 'fa-brands fa-weixin', color: '#BDECB6' },
            { id: 'calls', name: '通话', icon: 'fa-solid fa-phone', color: '#FFD1DC' },
            { id: 'messages', name: '短信', icon: 'fa-solid fa-envelope', color: '#C1E1C1' },
            { id: 'wallet', name: '钱包', icon: 'fa-solid fa-wallet', color: '#FDFD96' },
            { id: 'shopping', name: '市集', icon: 'fa-solid fa-basket-shopping', color: '#FFB7CE' },
            { id: 'photos', name: '画廊', icon: 'fa-solid fa-camera-retro', color: '#B2E2F2' },
            { id: 'backpack', name: '背包', icon: 'fa-solid fa-briefcase', color: '#FFD700' },
            { id: 'footprints', name: '足迹', icon: 'fa-solid fa-shoe-prints', color: '#AEEEEE' },
            { id: 'notes', name: '碎片', icon: 'fa-solid fa-pen-nib', color: '#C5A3FF' },
            { id: 'reminders', name: '备忘录', icon: 'fa-solid fa-check-double', color: '#98FB98' },
            { id: 'browser', name: '探索', icon: 'fa-solid fa-paper-plane', color: '#A0E7E5' },
            { id: 'history', name: '回忆', icon: 'fa-solid fa-clock-rotate-left', color: '#FFC0CB' },
            { id: 'music', name: '音符', icon: 'fa-solid fa-music', color: '#E0BBE4' },
            { id: 'calendar', name: '时光', icon: 'fa-solid fa-calendar-days', color: '#FEC8D8' },
            { id: 'meituan', name: '便当', icon: 'fa-solid fa-cookie-bite', color: '#FFE5B4' },
            { id: 'forum', name: '树洞', icon: 'fa-solid fa-comment-dots', color: '#D4F1F4' },
            { id: 'recorder', name: '留声', icon: 'fa-solid fa-microphone-lines', color: '#FFA07A' },
            { id: 'email', name: '邮件', icon: 'fa-solid fa-envelope', color: '#87CEEB' },
            { id: 'files', name: '宝库', icon: 'fa-solid fa-folder-open', color: '#B0C4DE' }
        ]
    }
})

const emit = defineEmits(['update:modelValue', 'generate'])

const selectedApps = ref([])
const isGenerating = ref(false)

// 默认全选
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        selectedApps.value = props.apps.map(a => a.id)
    }
}, { immediate: true })

function toggleApp(id) {
    const index = selectedApps.value.indexOf(id)
    if (index > -1) {
        selectedApps.value.splice(index, 1)
    } else {
        selectedApps.value.push(id)
    }
}

async function handleGenerate() {
    if (selectedApps.value.length === 0) return
    isGenerating.value = true
    try {
        await emit('generate', [...selectedApps.value])
        close()
    } finally {
        isGenerating.value = false
    }
}

function close() {
    emit('update:modelValue', false)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.animate-pop-in {
    animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop-in {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #EEE;
    border-radius: 10px;
}
</style>
