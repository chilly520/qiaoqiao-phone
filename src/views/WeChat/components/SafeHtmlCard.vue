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
  let c = String(props.content || '').trim()

  // Try to clean up markdown backticks for HTML/JSON blocks
  c = c.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  // If it's a JSON string, try to extract the 'html' or 'card' field
  if (c.startsWith('{') && c.endsWith('}')) {
    try {
      const parsed = JSON.parse(c)
      if (parsed.html) c = parsed.html
      else if (parsed.card) c = parsed.card
      else if (parsed.content) c = parsed.content
    } catch (e) {
      // Not valid JSON or failed to parse, proceed with raw string
    }
  }

  // [BUG FIX] 之前 sanitizedContent 并未做任何 sanitize, 直接通过 v-html 渲染.
  // isInteractive 黑名单无法拦截 javascript: URL、<iframe>、<style> 等 XSS 向量.
  // 对非交互分支的内容做基本净化: 移除危险标签、on* 属性、javascript: URL.
  c = c
    .replace(/<\/?(?:script|iframe|object|embed|param|form|input|button|select|option|textarea|label|style|link|meta|noscript|template|base|frame|frameset|applet)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]*)/gi, '')
    .replace(/(href|src|action|formaction|data)\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, '$1="#"')
    .replace(/(href|src|action|formaction)\s*=\s*javascript:[^\s>]*/gi, '$1="#"')

  return c
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
