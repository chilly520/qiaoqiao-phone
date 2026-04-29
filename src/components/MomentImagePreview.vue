<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
    show: Boolean,
    images: {
        type: Array,
        default: () => []
    },
    initialIndex: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['close'])

const currentIndex = ref(0)
const prevIndex = ref(0)
const touchStartX = ref(0)
const touchStartY = ref(0)
const isSwiping = ref(false)

// Sync index with initialIndex when showing
watch(() => props.show, (val) => {
    if (val) {
        currentIndex.value = props.initialIndex
        prevIndex.value = props.initialIndex
        document.body.style.overflow = 'hidden' // Prevent scroll
    } else {
        document.body.style.overflow = ''
    }
})

watch(currentIndex, (newVal, oldVal) => {
    prevIndex.value = oldVal
})

const handleClose = () => {
    emit('close')
}

const prevImage = () => {
    if (currentIndex.value > 0) {
        currentIndex.value--
    }
}

const nextImage = () => {
    if (currentIndex.value < props.images.length - 1) {
        currentIndex.value++
    }
}

// Touch handling for swipe
const handleTouchStart = (e) => {
    touchStartX.value = e.touches[0].clientX
    touchStartY.value = e.touches[0].clientY
    isSwiping.value = false
}

const handleTouchMove = (e) => {
    const deltaX = e.touches[0].clientX - touchStartX.value
    const deltaY = e.touches[0].clientY - touchStartY.value
    
    // If horizontal move is greater than vertical, we are swiping
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwiping.value = true
        // Prevent default only when swiping horizontally to avoid blocking vertical close swipe if we wanted to implement one
    }
}

const handleTouchEnd = (e) => {
    if (!isSwiping.value) return
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.value
    if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            prevImage()
        } else {
            nextImage()
        }
    }
    isSwiping.value = false
}

// Keyboard support
const handleKeydown = (e) => {
    if (!props.show) return
    if (e.key === 'Escape') handleClose()
    if (e.key === 'ArrowLeft') prevImage()
    if (e.key === 'ArrowRight') nextImage()
}

onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
})
</script>

<template>
    <Transition name="fade">
        <div v-if="show" class="fixed inset-0 z-[2000] bg-black flex flex-col" @click="handleClose">
            <!-- Header/Status -->
            <div class="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-10 bg-gradient-to-b from-black/50 to-transparent">
                <span class="text-white text-base font-medium">{{ currentIndex + 1 }} / {{ images.length }}</span>
                <button class="w-10 h-10 flex items-center justify-center text-white text-2xl" @click.stop="handleClose">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Image Container -->
            <div 
                class="flex-1 flex items-center justify-center relative overflow-hidden"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
            >
                <Transition :name="currentIndex > prevIndex ? 'slide-left' : 'slide-right'" mode="out-in">
                    <div :key="currentIndex" class="w-full h-full flex items-center justify-center p-2">
                        <img 
                            :src="images[currentIndex]" 
                            class="max-w-full max-h-full object-contain shadow-2xl select-none"
                            @click.stop
                        >
                    </div>
                </Transition>

                <!-- Navigation Arrows (Desktop) -->
                <button 
                    v-if="currentIndex > 0" 
                    class="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                    @click.stop="prevImage"
                >
                    <i class="fa-solid fa-chevron-left text-xl"></i>
                </button>
                <button 
                    v-if="currentIndex < images.length - 1" 
                    class="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                    @click.stop="nextImage"
                >
                    <i class="fa-solid fa-chevron-right text-xl"></i>
                </button>
            </div>

            <!-- Footer/Actions -->
            <div class="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-center px-6 bg-gradient-to-t from-black/50 to-transparent">
                <!-- Add more actions here if needed like save or share -->
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
    transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
    opacity: 0;
}

/* Custom transitions could be added here for the images if needed, 
   but simple object-contain is usually best for performance */
</style>
