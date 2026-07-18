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
const width = ref(290)
const resizeObserver = ref(null)
const isFullPage = ref(false)
// v1.10.168: 加载状态,onLoad 触发后才显示内容、隐藏骨架
const loaded = ref(false)

const fullContent = computed(() => {
  const content = props.content || ''

  const bootstrap = `
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
      * { box-sizing: border-box !important; }
      html, body {
        margin: 0 !important;
        padding: 12px !important;
        border: 0 !important;
        width: 100% !important;
        min-width: 280px !important;
        height: auto !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        box-sizing: border-box !important;
        overflow-wrap: break-word !important;
        word-wrap: break-word !important;
        background: transparent !important;
      }
      * { box-sizing: border-box !important; max-width: 100% !important; }
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
        ${bootstrap}
      </head>
      <body style="background: transparent !important;">
        ${content}
      </body>
    </html>
  `
})

const allowScroll = computed(() => isFullPage.value)

const cardStyle = computed(() => ({
  height: isFullPage.value ? Math.max(height.value, 400) + 'px' : height.value + 'px',
  width: isFullPage.value ? '100%' : width.value + 'px',
  maxWidth: '100%'
}))

function adjustHeight() {
  const iframe = iframeRef.value
  if (!iframe || !iframe.contentWindow?.document?.body) return
  try {
    const doc = iframe.contentWindow.document
    const body = doc.body

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
      const newHeight = Math.max(
        body.scrollHeight,
        doc.documentElement.scrollHeight,
        isFullPage.value ? body.offsetHeight || doc.documentElement.offsetHeight : 0,
        280
      )
      if (newHeight > 0) height.value = newHeight + 4
    }

    updateSize()

    // v1.10.168: ResizeObserver 提前设置(首次 adjustHeight 就 observe),
    // 这样 tailwind CDN 异步加载导致 body 高度变化时能自动捕获,不用等下次重试
    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(updateSize)
      resizeObserver.value.observe(body)
    }
  } catch (e) {}
}

function onLoad() {
  // v1.10.168: onLoad 立即标记加载完成 + 立即 adjustHeight(不等 100ms),
  // 让 ResizeObserver 尽早 observe,捕获 CDN 加载导致的高度变化
  loaded.value = true
  adjustHeight()
  // CDN(tailwindcss/font-awesome)异步加载,分阶段重试测量高度
  setTimeout(adjustHeight, 50)
  setTimeout(adjustHeight, 200)
  setTimeout(adjustHeight, 600)
  setTimeout(adjustHeight, 1200)
  setTimeout(adjustHeight, 2500)
  setTimeout(adjustHeight, 4000)
}

onMounted(() => {
  // v1.10.168: 组件挂载后也尝试一次,应对 iframe 已缓存 srcdoc 不触发 load 的边界情况
  nextTick(() => {
    setTimeout(adjustHeight, 300)
  })
})

onUnmounted(() => {
  if (resizeObserver.value) resizeObserver.value.disconnect()
})

watch(() => props.content, () => {
  // v1.10.168: content 变化时重置加载状态,显示骨架;iframe 会重新 load
  loaded.value = false
  nextTick(() => adjustHeight())
})
</script>

<style scoped>
.safe-html-card {
  display: inline-block;
  vertical-align: top;
  transition: height 0.2s ease;
  background: transparent;
  padding: 0;
  max-width: 100%;
  overflow: hidden;
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
