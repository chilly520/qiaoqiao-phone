<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

const props = defineProps({
    show: Boolean,
    images: {
        type: Array,
        default: () => []
    },
    initialIndex: {
        type: Number,
        default: 0
    },
    src: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['close'])

const images = computed(() => {
    if (props.images && props.images.length > 0) return props.images
    if (props.src) return [props.src]
    return []
})

const currentIndex = ref(0)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const lastTouchDistance = ref(0)
const lastTouchX = ref(0)
const lastTouchY = ref(0)
const lastTapTime = ref(0)
const startX = ref(0)
const startY = ref(0)
const startTranslateX = ref(0)
const startTranslateY = ref(0)
const isSwipeTransitioning = ref(false)

const currentImage = computed(() => images.value[currentIndex.value] || '')

watch(() => props.show, (val) => {
    if (val) {
        currentIndex.value = props.initialIndex || 0
        resetTransform()
        document.body.style.overflow = 'hidden'
    } else {
        document.body.style.overflow = ''
        resetTransform()
    }
})

watch(() => props.initialIndex, (val) => {
    if (props.show) {
        currentIndex.value = val
        resetTransform()
    }
})

const resetTransform = () => {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
}

const handleClose = () => {
    if (scale.value > 1) {
        resetTransform()
        return
    }
    emit('close')
}

const prevImage = () => {
    if (currentIndex.value > 0) {
        isSwipeTransitioning.value = true
        currentIndex.value--
        resetTransform()
        setTimeout(() => { isSwipeTransitioning.value = false }, 300)
    }
}

const nextImage = () => {
    if (currentIndex.value < images.value.length - 1) {
        isSwipeTransitioning.value = true
        currentIndex.value++
        resetTransform()
        setTimeout(() => { isSwipeTransitioning.value = false }, 300)
    }
}

const getDistance = (touches) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
}

const getTouchCenter = (touches) => {
    if (touches.length < 2) return { x: 0, y: 0 }
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    }
}

const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
        lastTouchDistance.value = getDistance(e.touches)
        isDragging.value = false
    } else if (e.touches.length === 1) {
        const now = Date.now()
        if (now - lastTapTime.value < 300) {
            if (scale.value > 1) {
                resetTransform()
            } else {
                scale.value = 2
            }
            lastTapTime.value = 0
            return
        }
        lastTapTime.value = now
        
        if (scale.value > 1) {
            isDragging.value = true
            lastTouchX.value = e.touches[0].clientX
            lastTouchY.value = e.touches[0].clientY
            startTranslateX.value = translateX.value
            startTranslateY.value = translateY.value
        } else {
            startX.value = e.touches[0].clientX
            startY.value = e.touches[0].clientY
            isDragging.value = false
        }
    }
}

const handleTouchMove = (e) => {
    e.preventDefault()
    
    if (e.touches.length === 2) {
        const distance = getDistance(e.touches)
        if (lastTouchDistance.value > 0) {
            const scaleFactor = distance / lastTouchDistance.value
            const newScale = scale.value * scaleFactor
            scale.value = Math.min(Math.max(newScale, 1), 4)
        }
        lastTouchDistance.value = distance
    } else if (e.touches.length === 1 && isDragging.value && scale.value > 1) {
        const dx = e.touches[0].clientX - lastTouchX.value
        const dy = e.touches[0].clientY - lastTouchY.value
        translateX.value = startTranslateX.value + dx
        translateY.value = startTranslateY.value + dy
    }
}

const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
        if (scale.value <= 1 && !isDragging.value) {
            const deltaX = e.changedTouches[0].clientX - startX.value
            if (Math.abs(deltaX) > 80 && Math.abs(e.changedTouches[0].clientY - startY.value) < 100) {
                if (deltaX > 0) {
                    prevImage()
                } else {
                    nextImage()
                }
            }
        }
        
        if (scale.value < 1) {
            scale.value = 1
        }
        if (scale.value === 1) {
            translateX.value = 0
            translateY.value = 0
        }
        
        isDragging.value = false
        lastTouchDistance.value = 0
    } else if (e.touches.length === 1) {
        lastTouchDistance.value = 0
    }
}

const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = scale.value * delta
    scale.value = Math.min(Math.max(newScale, 1), 4)
    if (scale.value === 1) {
        translateX.value = 0
        translateY.value = 0
    }
}

const handleMouseDown = (e) => {
    if (scale.value > 1) {
        isDragging.value = true
        lastTouchX.value = e.clientX
        lastTouchY.value = e.clientY
        startTranslateX.value = translateX.value
        startTranslateY.value = translateY.value
    } else {
        startX.value = e.clientX
        startY.value = e.clientY
        isDragging.value = false
    }
}

const handleMouseMove = (e) => {
    if (!isDragging.value) return
    if (scale.value > 1) {
        const dx = e.clientX - lastTouchX.value
        const dy = e.clientY - lastTouchY.value
        translateX.value = startTranslateX.value + dx
        translateY.value = startTranslateY.value + dy
    }
}

const handleMouseUp = (e) => {
    if (scale.value <= 1 && !isDragging.value && e.clientX !== undefined) {
        const deltaX = e.clientX - startX.value
        if (Math.abs(deltaX) > 80) {
            if (deltaX > 0) {
                prevImage()
            } else {
                nextImage()
            }
        }
    }
    
    if (scale.value === 1) {
        translateX.value = 0
        translateY.value = 0
    }
    isDragging.value = false
}

const saveImage = async () => {
    try {
        const src = currentImage.value
        if (src.startsWith('data:image')) {
            const link = document.createElement('a')
            link.href = src
            link.download = `image_${Date.now()}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } else {
            const response = await fetch(src)
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `image_${Date.now()}.jpg`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }
    } catch (err) {
        window.open(currentImage.value, '_blank')
    }
}

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
    <Teleport to="body">
        <Transition name="fade">
            <div v-if="show && currentImage" class="fixed inset-0 z-[20100] bg-black" @click.self="handleClose">
                <div class="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
                    <span v-if="images.length > 1" class="text-white text-sm font-medium">{{ currentIndex + 1 }} / {{ images.length }}</span>
                    <span v-else class="w-0"></span>
                    <button class="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white text-2xl" @click.stop="handleClose">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div 
                    class="w-full h-full flex items-center justify-center overflow-hidden select-none"
                    @touchstart="handleTouchStart"
                    @touchmove="handleTouchMove"
                    @touchend="handleTouchEnd"
                    @wheel="handleWheel"
                    @mousedown="handleMouseDown"
                    @mousemove="handleMouseMove"
                    @mouseup="handleMouseUp"
                    @mouseleave="handleMouseUp"
                >
                    <Transition :name="currentIndex > (isSwipeTransitioning ? currentIndex - 1 : currentIndex) ? 'slide-left' : 'slide-right'" mode="out-in">
                        <div 
                            :key="currentIndex" 
                            class="flex items-center justify-center w-full h-full p-4"
                        >
                            <img 
                                :src="currentImage" 
                                class="max-w-full max-h-full object-contain"
                                :style="{
                                    transform: `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`,
                                    transition: isDragging || lastTouchDistance > 0 ? 'none' : 'transform 0.2s ease-out'
                                }"
                                @click.stop
                                draggable="false"
                            >
                        </div>
                    </Transition>

                    <button 
                        v-if="images.length > 1 && currentIndex > 0 && scale === 1" 
                        class="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors"
                        @click.stop="prevImage"
                    >
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <button 
                        v-if="images.length > 1 && currentIndex < images.length - 1 && scale === 1" 
                        class="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center bg-black/30 hover:bg-black/50 text-white rounded-full transition-colors"
                        @click.stop="nextImage"
                    >
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="absolute bottom-0 left-0 right-0 h-24 flex items-center justify-end px-6 bg-gradient-to-t from-black/60 to-transparent z-10">
                    <button 
                        class="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full transition-colors"
                        @click.stop="saveImage"
                        title="保存图片"
                    >
                        <i class="fa-solid fa-download text-lg"></i>
                    </button>
                </div>

                <div v-if="images.length > 1 && scale === 1" class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                    <span 
                        v-for="(img, idx) in images" 
                        :key="idx"
                        class="w-1.5 h-1.5 rounded-full transition-all"
                        :class="idx === currentIndex ? 'bg-white w-4' : 'bg-white/40'"
                    ></span>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
    transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
    opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
    transition: all 0.25s ease-out;
}

.slide-left-enter-from {
    opacity: 0;
    transform: translateX(30px);
}
.slide-left-leave-to {
    opacity: 0;
    transform: translateX(-30px);
}

.slide-right-enter-from {
    opacity: 0;
    transform: translateX(-30px);
}
.slide-right-leave-to {
    opacity: 0;
    transform: translateX(30px);
}
</style>
