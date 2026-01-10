<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
    isOpen: Boolean,
    imageUrl: String // Data URL of the uploaded image
})

const emit = defineEmits(['close', 'confirm'])

const canvasRef = ref(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imgElement = new Image()

// Config
const CANVAS_SIZE = 300
const CROP_SIZE = 200

// Initialize
watch(() => props.imageUrl, (newUrl) => {
    if (newUrl) {
        imgElement.src = newUrl
        imgElement.onload = () => {
             // Reset state
             scale.value = 1
             offset.value = { x: 0, y: 0 }
             draw()
        }
    }
})

// Draw loop
const draw = () => {
    if (!canvasRef.value) return
    const ctx = canvasRef.value.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    
    // Background
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    
    // Save context
    ctx.save()
    
    // Center of canvas
    ctx.translate(CANVAS_SIZE/2, CANVAS_SIZE/2)
    ctx.scale(scale.value, scale.value)
    ctx.translate(offset.value.x, offset.value.y)
    
    // Draw Image centered
    ctx.drawImage(imgElement, -imgElement.width/2, -imgElement.height/2)
    
    ctx.restore()
    
    // Draw Mask
    // Darken outside the crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    
    // Top
    ctx.fillRect(0, 0, CANVAS_SIZE, (CANVAS_SIZE - CROP_SIZE)/2)
    // Bottom
    ctx.fillRect(0, (CANVAS_SIZE + CROP_SIZE)/2, CANVAS_SIZE, (CANVAS_SIZE - CROP_SIZE)/2)
    // Left
    ctx.fillRect(0, (CANVAS_SIZE - CROP_SIZE)/2, (CANVAS_SIZE - CROP_SIZE)/2, CROP_SIZE)
    // Right
    ctx.fillRect((CANVAS_SIZE + CROP_SIZE)/2, (CANVAS_SIZE - CROP_SIZE)/2, (CANVAS_SIZE - CROP_SIZE)/2, CROP_SIZE)
    
    // Draw Border
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.strokeRect((CANVAS_SIZE - CROP_SIZE)/2, (CANVAS_SIZE - CROP_SIZE)/2, CROP_SIZE, CROP_SIZE)
}

// Interaction
const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    scale.value *= delta
    draw()
}

const handleMouseDown = (e) => {
    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
}

const handleMouseMove = (e) => {
    if (!isDragging.value) return
    const dx = (e.clientX - dragStart.value.x) / scale.value
    const dy = (e.clientY - dragStart.value.y) / scale.value
    
    offset.value.x += dx
    offset.value.y += dy
    
    dragStart.value = { x: e.clientX, y: e.clientY }
    draw()
}

const handleMouseUp = () => {
    isDragging.value = false
}

// Mobile Touch
const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
        isDragging.value = true
        dragStart.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
}
const handleTouchMove = (e) => {
     if (isDragging.value && e.touches.length === 1) {
        const dx = (e.touches[0].clientX - dragStart.value.x) / scale.value
        const dy = (e.touches[0].clientY - dragStart.value.y) / scale.value
        offset.value.x += dx
        offset.value.y += dy
        dragStart.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        draw()
        e.preventDefault()
     }
}
const handleTouchEnd = () => { isDragging.value = false }


// Slider Zoom
const onSliderChange = (e) => {
    scale.value = parseFloat(e.target.value)
    draw()
}

const confirm = () => {
    // Render the final cropped image to a temp canvas
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = CROP_SIZE
    tempCanvas.height = CROP_SIZE
    const ctx = tempCanvas.getContext('2d')

    // Fill white background just in case
    // ctx.fillStyle = '#fff'
    // ctx.fillRect(0,0, CROP_SIZE, CROP_SIZE)
    
    // Calculate transform to draw exactly what's visible in the window
    // The view window top-left in Canvas coordinates is (CANVAS_SIZE - CROP_SIZE)/2
    
    // We basically repeat the draw transform but shifted
    ctx.save()
    
    // Move origin to center of crop
    ctx.translate(CROP_SIZE/2, CROP_SIZE/2)
    ctx.scale(scale.value, scale.value)
    ctx.translate(offset.value.x, offset.value.y)
    
    ctx.drawImage(imgElement, -imgElement.width/2, -imgElement.height/2)
    
    ctx.restore()
    
    const dataUrl = tempCanvas.toDataURL('image/png')
    emit('confirm', dataUrl)
    emit('close')
}

</script>

<template>
<div v-if="isOpen" class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div class="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 class="font-bold text-gray-800">裁剪/缩放图标</h3>
            <button @click="$emit('close')" class="text-gray-400"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div class="p-4 flex flex-col items-center bg-gray-50">
            <!-- Canvas Container -->
            <div 
                class="relative shadow-lg cursor-move touch-none"
                @wheel="handleWheel"
                @mousedown="handleMouseDown"
                @mousemove="handleMouseMove"
                @mouseup="handleMouseUp"
                @mouseleave="handleMouseUp"
                @touchstart="handleTouchStart"
                @touchmove="handleTouchMove"
                @touchend="handleTouchEnd"
            >
                <canvas 
                    ref="canvasRef" 
                    :width="CANVAS_SIZE" 
                    :height="CANVAS_SIZE"
                    class="rounded-lg bg-white block"
                ></canvas>
            </div>
            
            <div class="mt-4 w-full flex items-center gap-3">
                <i class="fa-solid fa-minus text-gray-400 text-xs"></i>
                <input 
                    type="range" 
                    min="0.1" 
                    max="5" 
                    step="0.1" 
                    :value="scale" 
                    @input="onSliderChange"
                    class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                />
                <i class="fa-solid fa-plus text-gray-400 text-xs"></i>
            </div>
             <p class="text-xs text-gray-400 mt-2">拖动图片移动，滑块缩放</p>
        </div>
        
        <div class="p-4 border-t border-gray-100 grid grid-cols-2 gap-3">
             <button @click="$emit('close')" class="py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm">取消</button>
             <button @click="confirm" class="py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm">确认使用</button>
        </div>
    </div>
</div>
</template>

<style scoped>
/* Custom Slider Style */
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  margin-top: -4px;
}
input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
}
</style>
