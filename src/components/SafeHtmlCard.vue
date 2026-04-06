<template>
  <div class="safe-html-card" :style="cardStyle">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
      allowtransparency="true" :scrolling="allowScroll ? 'auto' : 'no'" @load="onLoad"></iframe>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch, nextTick } from 'vue'

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
    setTimeout(updateSize, 300)
    setTimeout(updateSize, 1000)

    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(updateSize)
      resizeObserver.value.observe(body)
    }
  } catch (e) {}
}

function onLoad() {
  setTimeout(adjustHeight, 100)
  setTimeout(adjustHeight, 500)
  setTimeout(adjustHeight, 1500)
}

onUnmounted(() => {
  if (resizeObserver.value) resizeObserver.value.disconnect()
})

watch(() => props.content, () => {
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
</style>
