<template>
    <div class="photos-app h-full bg-white flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="photos-header pt-16 pb-2 px-4 shadow-sm z-20 bg-white/80 backdrop-blur-md sticky top-0">
            <div class="flex items-center justify-between mb-4">
                <button @click="$emit('back')" class="text-blue-500 text-lg flex items-center">
                    <i class="fa-solid fa-chevron-left mr-1"></i>
                    <span>库</span>
                </button>
                <h1 class="text-xl font-bold">所有照片</h1>
                <button class="text-blue-500 font-medium">选择</button>
            </div>

            <!-- Tabs -->
            <div class="flex gap-4 text-sm font-medium border-b border-gray-100 pb-2">
                <button class="text-blue-500 px-2 py-1 bg-blue-50 rounded-md">年</button>
                <button class="text-gray-500 px-2 py-1 hover:bg-gray-50 rounded-md">月</button>
                <button class="text-gray-500 px-2 py-1 hover:bg-gray-50 rounded-md">日</button>
                <button class="text-gray-500 px-2 py-1 hover:bg-gray-50 rounded-md">所有照片</button>
            </div>
        </div>

        <!-- Photo Grid -->
        <div class="photos-grid-container flex-1 overflow-y-auto p-0.5">
            <div class="grid grid-cols-3 gap-0.5">
                <div v-for="(photo, index) in photos" :key="photo.id"
                    class="aspect-square relative group overflow-hidden bg-gray-100 cursor-pointer"
                    @click="openPhoto(index)">
                    <!-- Photo Image -->
                    <img v-if="photo.url" :src="photo.url"
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">

                    <!-- Loading/Un-generated State -->
                    <div v-else
                        class="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gray-50">
                        <i v-if="photo.isGenerating" class="fa-solid fa-spinner fa-spin text-blue-400 text-xl mb-2"></i>
                        <template v-else>
                            <i class="fa-solid fa-cloud-arrow-down text-gray-300 text-xl mb-1"></i>
                            <span class="text-[9px] text-gray-400 uppercase tracking-tighter">Click to Load</span>
                        </template>
                    </div>

                    <!-- Note indicator -->
                    <div v-if="photo.note" class="absolute bottom-1 right-1">
                        <i class="fa-solid fa-sticky-note text-[10px] text-white/70"></i>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="py-12 text-center">
                <p class="text-sm text-gray-400 font-medium">{{ photos.length }} 张照片、0 个视频</p>
                <div class="mt-2 text-[10px] text-gray-300 uppercase tracking-widest">已同步到 iCloud</div>
            </div>
        </div>

        <!-- Lightbox -->
        <transition name="scale-fade">
            <div v-if="selectedPhotoIndex !== null" class="fixed inset-0 z-[100] bg-black flex flex-col">
                <!-- Close button -->
                <button @click="selectedPhotoIndex = null"
                    class="absolute top-16 left-6 z-[110] text-white/80 p-2 hover:scale-110 active:scale-90 transition-transform">
                    <i class="fa-solid fa-xmark text-2xl drop-shadow-lg"></i>
                </button>

                <!-- Main Image -->
                <div class="flex-1 flex items-center justify-center relative p-4">
                    <img v-if="currentSelectedPhoto?.url" :src="currentSelectedPhoto.url"
                        class="max-w-full max-h-full object-contain shadow-2xl">
                    <div v-else class="text-white flex flex-col items-center">
                        <i class="fa-solid fa-spinner fa-spin text-4xl mb-4"></i>
                        <p>正在努力回想...</p>
                    </div>
                </div>

                <!-- Photo Info / Note -->
                <div v-if="currentSelectedPhoto" class="bg-black/40 backdrop-blur-xl p-6 text-white safe-bottom">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-lg">{{ currentSelectedPhoto.location || '未知地点' }}</h3>
                            <p class="text-xs opacity-60">{{ currentSelectedPhoto.date || '拍摄于不久前' }}</p>
                        </div>
                        <button class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                            <i class="fa-solid fa-info"></i>
                        </button>
                    </div>

                    <!-- Secret Note -->
                    <div v-if="currentSelectedPhoto.note"
                        class="mt-4 p-3 bg-white/5 border border-white/10 rounded-xl animate-fade-in">
                        <div class="flex items-center gap-2 mb-1 opacity-50">
                            <i class="fa-solid fa-pen-nib text-[10px]"></i>
                            <span class="text-[10px] uppercase font-bold tracking-widest">心语备忘</span>
                        </div>
                        <p class="text-sm italic text-blue-100">"{{ currentSelectedPhoto.note }}"</p>
                    </div>
                </div>

                <!-- Bottom Actions -->
                <div class="flex justify-around items-center py-4 border-t border-white/10 text-blue-400 text-xl">
                    <i class="fa-solid fa-share-nodes"></i>
                    <i class="fa-regular fa-heart"></i>
                    <i class="fa-regular fa-trash-can"></i>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { generateImage } from '@/utils/aiService'

const props = defineProps({
    photosData: Object
})

const emit = defineEmits(['back', 'update-photo'])

const selectedPhotoIndex = ref(null)

const photos = computed(() => {
    return props.photosData?.photos || []
})

const currentSelectedPhoto = computed(() => {
    if (selectedPhotoIndex.value === null) return null
    return photos.value[selectedPhotoIndex.value]
})

async function openPhoto(index) {
    selectedPhotoIndex.value = index
    const photo = photos.value[index]

    // If no URL, generate it
    if (!photo.url && !photo.isGenerating) {
        photo.isGenerating = true
        try {
            const prompt = `Japanese anime style masterpiece, ${photo.aiPrompt || 'a daily life moment'}, soft lighting, beautiful, detailed`
            const url = await generateImage(prompt)

            // Update local state and notify parent (if needed to persist to store)
            photo.url = url
            photo.generated = true
            emit('update-photo', { index, url })
        } catch (e) {
            console.error('Failed to generate photo:', e)
        } finally {
            photo.isGenerating = false
        }
    }
}
</script>

<style scoped>
.photos-app {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.photos-grid-container::-webkit-scrollbar {
    display: none;
}

.safe-bottom {
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
}

/* Animations */
.scale-fade-enter-active,
.scale-fade-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.scale-fade-enter-from,
.scale-fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
}

.animate-fade-in {
    animation: fade-in 0.6s ease-out;
}

@keyframes fade-in {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
