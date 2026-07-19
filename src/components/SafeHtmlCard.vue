<template>
  <div class="safe-html-card" :style="cardStyle">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
      allowtransparency="true" :scrolling="allowScroll ? 'auto' : 'no'" @load="onLoad"></iframe>
    <!-- v1.10.168: 加载骨架,避免 iframe CDN 加载期间留空一块 -->
    <div v-if="!loaded" class="card-skeleton">
      <div class="skeleton-line w-3/4"></div>
      <div class="skeleton-line w-1/2"></div>
      <div class="skeleton-line w-5/6"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  }
})

const iframeRef = ref(null)
const height = ref(280)
const width = ref(null)
const overflowRight = ref(0)
const overflowBottom = ref(0)
const resizeObserver = ref(null)
const isFullPage = ref(false)
const loaded = ref(false)

function cleanAiHtmlErrors(html) {
  if (!html || typeof html !== 'string') return html
  let c = html
  c = c.replace(/<\s+img\b/gi, '<img')
  c = c.replace(/src\s*=\s*['"]`([^`]+)`['"]/gi, "src=\"$1\"")
  c = c.replace(/src\s*=\s*`([^`]+)`/gi, 'src="$1"')
  c = c.replace(/<\s+(\/?)(a|div|span|p|br|hr|b|i|u|strong|em|button|label|input|script|style|iframe|img)\b/gi, '<$1$2')
  return c
}

const fullContent = computed(() => {
  const rawContent = props.content || ''
  const content = cleanAiHtmlErrors(rawContent)

  const bootstrap = `
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
      * { box-sizing: border-box !important; }
      html, body {
        margin: 0 !important;
        padding: 10px !important;
        border: 0 !important;
        width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        display: block !important;
        box-sizing: border-box !important;
        overflow-wrap: break-word !important;
        word-wrap: break-word !important;
        background: transparent !important;
        overflow: visible !important;
        position: relative !important;
      }
      body { padding-bottom: 30px !important; padding-right: 20px !important; }
      img { max-width: 100% !important; height: auto !important; }
      [style*="cursor: pointer"], button, .button, a {
        transition: transform 0.1s ease, opacity 0.1s ease !important;
        user-select: none !important;
        cursor: pointer !important;
      }
      [style*="cursor: pointer"]:active, button:active, .button:active, a:active {
        transform: scale(0.95) !important;
        opacity: 0.8 !important;
      }
    </style>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <script id="base-script">
      window.alert = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: msg }, '*');
      };
      window.confirm = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: 'Confirm requested: ' + msg }, '*');
        return true;
      };
      window.prompt = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: 'Prompt requested: ' + msg }, '*');
        return '';
      };
      window.sendToChat = function(text) {
        if (!text) return;
        window.parent.postMessage({ type: 'CHAT_SEND', text: text }, '*');
      };
      document.addEventListener('DOMContentLoaded', () => {
         const interactives = document.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"], .button, .menu-item, button, a[href="#"], [role="button"]');
         interactives.forEach(el => {
            const isStructural = /^(H[1-6]|SUMMARY|DETAILS|NAV|FOOTER)$/i.test(el.tagName);
            if (!el.onclick && !isStructural) {
               const text = (el.innerText || el.textContent || '').trim();
               const alwaysAction = el.tagName === 'BUTTON' || el.classList.contains('chat-button') || el.getAttribute('role') === 'button';
               const isMenuFormat = /^\[\s*.*\s*\]$/.test(text);
               if (text && (isMenuFormat || alwaysAction || el.classList.contains('menu-item'))) {
                  el.onclick = (e) => {
                     e.stopPropagation();
                     const cleanText = text.replace(/^\[\s*|\s*\]$/g, '').trim();
                     if (cleanText) window.sendToChat(cleanText);
                  };
               }
            }
         });
         if (document.body) document.body.style.opacity = '1';
      });
    <\/script>
  `

  if (content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html')) {
    isFullPage.value = true
    let processed = content
    if (!/charset=["']?UTF-8["']?/i.test(processed)) {
      if (/<head>/i.test(processed)) {
        processed = processed.replace(/<head>/i, '<head><meta charset="UTF-8">')
      } else if (/<html.*?>/i.test(processed)) {
        processed = processed.replace(/(<html.*?>)/i, '$1<head><meta charset="UTF-8"></head>')
      }
    }
    if (/<\/head>/i.test(processed)) {
      processed = processed.replace(/<\/head>/i, bootstrap + '</head>')
    } else if (/<head>/i.test(processed)) {
      processed = processed.replace(/<head>/i, '<head>' + bootstrap)
    } else {
      processed = bootstrap + processed
    }
    return processed
  }

  return `
    <!DOCTYPE html>
    <html style="background: transparent !important;">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${bootstrap}
      </head>
      <body style="background: transparent !important;">
        ${content}
      </body>
    </html>
  `
})

const allowScroll = computed(() => isFullPage.value)

const cardStyle = computed(() => {
  const base = {
    height: (isFullPage.value ? Math.max(height.value, 400) : height.value) + overflowBottom.value + 'px',
    maxWidth: '100%'
  }
  if (isFullPage.value) {
    base.width = '100%'
  } else if (width.value) {
    base.width = Math.min(width.value + overflowRight.value, 420) + 'px'
    base.maxWidth = '100%'
  } else {
    base.width = '100%'
  }
  return base
})

function getElementBounds(root) {
  let maxRight = 0
  let maxBottom = 0
  const all = root.querySelectorAll('*')
  for (const el of all) {
    try {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      if (style.position === 'absolute' || style.position === 'fixed') {
        if (rect.right > maxRight) maxRight = rect.right
        if (rect.bottom > maxBottom) maxBottom = rect.bottom
      }
    } catch (e) {}
  }
  return { maxRight, maxBottom }
}

function adjustHeight() {
  const iframe = iframeRef.value
  if (!iframe || !iframe.contentWindow?.document?.body) return
  try {
    const doc = iframe.contentWindow.document
    const body = doc.body
    const htmlEl = doc.documentElement

    const passEvent = (e) => {
      if (!e) return
      try {
        const rect = iframe.getBoundingClientRect()
        let x = 0, y = 0
        if (typeof e.clientX === 'number') { x = e.clientX; y = e.clientY }
        else if (e.touches?.length > 0) { x = e.touches[0].clientX || 0; y = e.touches[0].clientY || 0 }
        else if (e.changedTouches?.length > 0) { x = e.changedTouches[0].clientX || 0; y = e.changedTouches[0].clientY || 0 }
        const evt = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : (e.type === 'touchend' ? 'mouseup' : e.type), {
          bubbles: true, cancelable: true, view: window,
          clientX: rect.left + x, clientY: rect.top + y,
          detail: e.detail || 0, button: e.button || 0, buttons: e.buttons || 0,
          ctrlKey: !!e.ctrlKey, shiftKey: !!e.shiftKey, altKey: !!e.altKey, metaKey: !!e.metaKey
        })
        iframe.dispatchEvent(evt)
      } catch (err) {}
    }

    doc.addEventListener('contextmenu', (e) => { e.preventDefault(); passEvent(e) })
    doc.addEventListener('mousedown', passEvent)
    doc.addEventListener('touchstart', passEvent)
    doc.addEventListener('mouseup', passEvent)
    doc.addEventListener('touchend', passEvent)

    const updateSize = () => {
      const bodyRect = body.getBoundingClientRect()
      const baseScrollH = Math.max(body.scrollHeight, htmlEl.scrollHeight, 280)
      const baseOffsetH = Math.max(body.offsetHeight || 0, htmlEl.offsetHeight || 0, 280)
      const newHeight = Math.max(baseScrollH, isFullPage.value ? baseOffsetH : 0, 280)
      if (newHeight > 0) height.value = newHeight

      if (!isFullPage.value) {
        const iframeWidth = iframe.clientWidth || 300
        const contentScrollWidth = Math.max(body.scrollWidth, htmlEl.scrollWidth, 280)
        if (contentScrollWidth > iframeWidth + 5) {
          const parentWidth = iframe.parentElement ? iframe.parentElement.clientWidth - 4 : 400
          width.value = Math.min(contentScrollWidth, Math.max(parentWidth, 280), 420)
        }
      }

      try {
        const bounds = getElementBounds(body)
        const bodyBR = body.getBoundingClientRect()
        const extraRight = Math.max(0, Math.ceil(bounds.maxRight - bodyBR.right + 8))
        const extraBottom = Math.max(0, Math.ceil(bounds.maxBottom - bodyBR.bottom + 8))
        overflowRight.value = Math.min(extraRight, 60)
        overflowBottom.value = Math.min(extraBottom, 80)
      } catch (e) {}
    }

    updateSize()

    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(updateSize)
      resizeObserver.value.observe(body)
      if (htmlEl) resizeObserver.value.observe(htmlEl)
    }
  } catch (e) {}
}

function onLoad() {
  loaded.value = true
  adjustHeight()
  setTimeout(adjustHeight, 50)
  setTimeout(adjustHeight, 200)
  setTimeout(adjustHeight, 600)
  setTimeout(adjustHeight, 1200)
  setTimeout(adjustHeight, 2500)
  setTimeout(adjustHeight, 4000)
}

onMounted(() => {
  nextTick(() => {
    setTimeout(adjustHeight, 300)
  })
})

onUnmounted(() => {
  if (resizeObserver.value) resizeObserver.value.disconnect()
})

watch(() => props.content, () => {
  loaded.value = false
  overflowRight.value = 0
  overflowBottom.value = 0
  width.value = null
  height.value = 280
  nextTick(() => adjustHeight())
})
</script>

<style scoped>
.safe-html-card {
  display: inline-block;
  vertical-align: top;
  transition: height 0.2s ease, width 0.2s ease;
  background: transparent;
  padding: 0;
  max-width: 100%;
  overflow: visible;
  -ms-overflow-style: none;
  scrollbar-width: none;
  position: relative;
}
.safe-html-card::-webkit-scrollbar { display: none !important; }
.safe-html-card iframe {
  border: none !important;
  background: transparent !important;
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
  overflow: visible !important;
}
@media (max-width: 480px) {
  .safe-html-card { padding: 0; border-radius: 0; box-shadow: none; }
}

/* v1.10.168: 加载骨架,避免 iframe CDN 加载期间留空一块 */
.card-skeleton {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  background: rgba(245, 245, 245, 0.6);
  border-radius: inherit;
  pointer-events: none;
}
.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
