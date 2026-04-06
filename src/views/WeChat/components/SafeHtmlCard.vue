<template>
  <iframe
    v-if="isInteractive"
    :srcdoc="sanitizedContent"
    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
    class="safe-html-iframe w-full overflow-hidden rounded-xl border border-amber-100 shadow-sm bg-white"
    :style="iframeStyle"
    ref="iframeRef"
  />
  <div
    v-else
    class="safe-html-container w-full overflow-hidden rounded-xl border border-amber-100 shadow-sm bg-white"
    v-html="sanitizedContent"
  />
</template>

<script setup>
import { computed, ref, onMounted, nextTick } from 'vue'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const iframeRef = ref(null)

const sanitizedContent = computed(() => {
  if (!props.content) return ''
  return typeof props.content === 'string' ? props.content : JSON.stringify(props.content)
})

const isInteractive = computed(() => {
  const c = sanitizedContent.value
  if (!c) return false
  return /<script[\s>]/i.test(c) || /on\w+\s*=/i.test(c) || /<!DOCTYPE/i.test(c) || /<html[\s>]/i.test(c)
})

const iframeStyle = computed(() => ({
  minHeight: isInteractive.value ? '280px' : undefined,
  border: 'none',
  width: '100%'
}))

function autoResize() {
  const iframe = iframeRef.value
  if (!iframe || !iframe.contentDocument?.body) return
  try {
    const height = Math.max(
      iframe.contentDocument.body.scrollHeight,
      iframe.contentDocument.documentElement.scrollHeight,
      280
    )
    iframe.style.height = height + 'px'
  } catch (e) {}
}

onMounted(async () => {
  await nextTick()
  autoResize()
  const iframe = iframeRef.value
  if (!iframe) return
  iframe.addEventListener('load', () => {
    setTimeout(autoResize, 100)
    setTimeout(autoResize, 500)
  })
})
</script>

<style>
.safe-html-container {
  max-width: 100%;
  position: relative;
}
.safe-html-container img {
  max-width: 100%;
  height: auto;
}
.safe-html-container table {
  width: 100%;
  border-collapse: collapse;
}
.safe-html-iframe {
  display: block;
}
</style>
