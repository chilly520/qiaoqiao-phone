<template>
  <div class="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center" @click.self="handleCancel">
    <div class="bg-white w-[90%] max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-lg">裁剪头像</h3>
        <button @click="handleCancel" class="text-gray-500 hover:text-gray-700">
          <i class="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      <!-- Cropping Area -->
      <div class="flex-1 p-4 bg-gray-50">
        <div 
          ref="containerRef"
          class="relative w-full aspect-square max-h-[50vh] overflow-hidden bg-white rounded-lg shadow-md border border-gray-200"
        >
          <!-- Original Image - Now movable and scalable -->
          <img
            ref="imageRef"
            :src="imageSrc"
            class="absolute cursor-move"
            :style="imageStyle"
            @load="handleImageLoad"
            @mousedown="handleImageMouseDown($event)"
            @touchstart="handleImageTouchStart($event)"
            @wheel="handleWheel($event)"
          />

          <!-- Fixed Cropping Frame -->
          <div
            class="absolute border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            :style="{ width: `${cropSize}px`, height: `${cropSize}px` }"
          >
            <div class="absolute inset-0 border-2 border-transparent hover:border-white/50 transition-colors"></div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="p-4 border-t bg-white">
        <div class="flex justify-center gap-2 mb-4">
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            @click="resetCrop"
          >
            <i class="fa-solid fa-rotate-left"></i> 重置
          </button>
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            @click="rotateImage"
          >
            <i class="fa-solid fa-rotate-right"></i> 旋转
          </button>
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            @click="zoomIn"
          >
            <i class="fa-solid fa-search-plus"></i> 放大
          </button>
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            @click="zoomOut"
          >
            <i class="fa-solid fa-search-minus"></i> 缩小
          </button>
        </div>
        <div class="flex gap-2">
          <button
            class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            @click="handleCancel"
          >
            取消
          </button>
          <button
            class="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors shadow-md"
            @click="handleCrop"
          >
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  imageSrc: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['crop', 'cancel'])

// Image and Cropping State
const imageRef = ref(null)
const containerRef = ref(null)

const imageWidth = ref(0)
const imageHeight = ref(0)
const imageRotation = ref(0)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

// Fixed crop size (square)
const cropSize = 200

// Mouse/Touch State
const isDragging = ref(false)
const lastX = ref(0)
const lastY = ref(0)

// Image Style
const imageStyle = computed(() => {
  return {
    width: `${imageWidth.value * scale.value}px`,
    height: `${imageHeight.value * scale.value}px`,
    transform: `translate(-50%, -50%) translate(${translateX.value}px, ${translateY.value}px) rotate(${imageRotation.value}deg)`,
    left: '50%',
    top: '50%'
  }
})

// Image Load Handler
const handleImageLoad = () => {
  if (!imageRef.value) return
  
  // Get original image dimensions
  const img = imageRef.value
  imageWidth.value = img.naturalWidth
  imageHeight.value = img.naturalHeight
  
  // Calculate initial scale to fit image within container
  const containerEl = img.parentElement
  const containerWidth = containerEl.offsetWidth
  const containerHeight = containerEl.offsetHeight
  
  // Start with scale that fits the image in the container
  const containerSize = Math.min(containerWidth, containerHeight)
  const maxImageDimension = Math.max(imageWidth.value, imageHeight.value)
  scale.value = containerSize / maxImageDimension
  
  // Reset position and rotation
  translateX.value = 0
  translateY.value = 0
  imageRotation.value = 0
}

// Handle Image Mouse Down for dragging
const handleImageMouseDown = (e) => {
  e.preventDefault()
  isDragging.value = true
  lastX.value = e.clientX
  lastY.value = e.clientY
  
  document.addEventListener('mousemove', handleImageMouseMove)
  document.addEventListener('mouseup', handleImageMouseUp)
}

// Handle Image Touch Start for dragging
const handleImageTouchStart = (e) => {
  e.preventDefault()
  if (e.touches.length === 1) {
    isDragging.value = true
    lastX.value = e.touches[0].clientX
    lastY.value = e.touches[0].clientY
    
    document.addEventListener('touchmove', handleImageTouchMove)
    document.addEventListener('touchend', handleImageTouchEnd)
  }
}

// Handle Image Mouse Move for dragging
const handleImageMouseMove = (e) => {
  if (!isDragging.value) return
  
  const deltaX = e.clientX - lastX.value
  const deltaY = e.clientY - lastY.value
  
  translateX.value += deltaX
  translateY.value += deltaY
  
  lastX.value = e.clientX
  lastY.value = e.clientY
}

// Handle Image Touch Move for dragging
const handleImageTouchMove = (e) => {
  if (!isDragging.value || e.touches.length !== 1) return
  
  const deltaX = e.touches[0].clientX - lastX.value
  const deltaY = e.touches[0].clientY - lastY.value
  
  translateX.value += deltaX
  translateY.value += deltaY
  
  lastX.value = e.touches[0].clientX
  lastY.value = e.touches[0].clientY
}

// Handle Image Mouse Up for dragging
const handleImageMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleImageMouseMove)
  document.removeEventListener('mouseup', handleImageMouseUp)
}

// Handle Image Touch End for dragging
const handleImageTouchEnd = () => {
  isDragging.value = false
  document.removeEventListener('touchmove', handleImageTouchMove)
  document.removeEventListener('touchend', handleImageTouchEnd)
}

// Handle Wheel for zooming
const handleWheel = (e) => {
  e.preventDefault()
  
  // Calculate zoom factor based on wheel delta
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.1, Math.min(10, scale.value * zoomFactor))
  
  scale.value = newScale
}

// Zoom In
const zoomIn = () => {
  scale.value = Math.min(10, scale.value * 1.1)
}

// Zoom Out
const zoomOut = () => {
  scale.value = Math.max(0.1, scale.value * 0.9)
}

// Crop Image
const handleCrop = () => {
  if (!imageRef.value) return
  
  const img = imageRef.value
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  // Set canvas size to crop size (square)
  canvas.width = cropSize
  canvas.height = cropSize
  
  // Calculate the center of the container
  const containerEl = img.parentElement
  const containerCenterX = containerEl.offsetWidth / 2
  const containerCenterY = containerEl.offsetHeight / 2
  
  // Calculate the top-left corner of the crop area
  const cropLeft = containerCenterX - cropSize / 2
  const cropTop = containerCenterY - cropSize / 2
  
  // Calculate the image's position relative to the container
  const imageLeft = containerCenterX - (imageWidth.value * scale.value) / 2 + translateX.value
  const imageTop = containerCenterY - (imageHeight.value * scale.value) / 2 + translateY.value
  
  // Calculate the area to crop from the original image
  const sourceX = (cropLeft - imageLeft) / scale.value
  const sourceY = (cropTop - imageTop) / scale.value
  const sourceWidth = cropSize / scale.value
  const sourceHeight = cropSize / scale.value
  
  // Draw the cropped image
  ctx.save()
  
  // Translate to center of canvas for rotation
  ctx.translate(cropSize / 2, cropSize / 2)
  
  // Apply rotation
  ctx.rotate((imageRotation.value * Math.PI) / 180)
  
  // Translate back
  ctx.translate(-cropSize / 2, -cropSize / 2)
  
  // Draw the cropped image
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    cropSize,
    cropSize
  )
  
  ctx.restore()
  
  // Convert canvas to data URL
  const croppedImage = canvas.toDataURL('image/jpeg', 0.8)
  
  // Emit cropped image
  emit('crop', croppedImage)
}

// Cancel Cropping
const handleCancel = () => {
  emit('cancel')
}

// Reset Crop
const resetCrop = () => {
  handleImageLoad()
}

// Rotate Image
const rotateImage = () => {
  imageRotation.value = (imageRotation.value + 90) % 360
}
</script>

<style scoped>
/* Additional styles if needed */
</style>