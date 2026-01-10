<template>
  <div class="safe-html-card w-full" :style="{ height: height + 'px' }">
    <iframe 
      ref="iframeRef"
      :srcdoc="fullContent"
      class="w-full h-full border-none overflow-hidden"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      @load="adjustHeight"
    ></iframe>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  }
})

const iframeRef = ref(null)
const height = ref(100) // Default start height
const resizeObserver = ref(null)

// Inject some basic styles to make it look good inside iframe
// and ensure we can measure height correctly
const fullContent = computed(() => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: transparent;
          }
          /* Scrollbar hiding */
          ::-webkit-scrollbar { display: none; }
        </style>
      </head>
      <body>
        ${props.content}
      </body>
    </html>
  `
})

const adjustHeight = () => {
  const iframe = iframeRef.value
  if (iframe && iframe.contentWindow && iframe.contentWindow.document.body) {
    const doc = iframe.contentWindow.document
    // Get height
    const newHeight = doc.body.scrollHeight
    if (newHeight > 0) {
        height.value = newHeight + 20 // specific padding buffer
    }

    // Observe changes inside iframe
    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(() => {
         const updatedHeight = doc.body.scrollHeight
         if (updatedHeight > 0) height.value = updatedHeight
      })
      resizeObserver.value.observe(doc.body)
    }
  }
}

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})

watch(() => props.content, () => {
   // Content changed, iframe will reload, @load changes will trigger
})
</script>

<style scoped>
.safe-html-card {
  transition: height 0.2s ease;
}
</style>
