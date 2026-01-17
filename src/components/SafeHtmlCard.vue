<template>
  <div class="safe-html-card" :style="{ height: height + 'px', width: width + 'px' }">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none overflow-hidden"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
      allowtransparency="true" @load="adjustHeight"></iframe>
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
const height = ref(40)
const width = ref(300) // Added width tracking
const resizeObserver = ref(null)

const fullContent = computed(() => {
  const content = props.content || ''

  const bootstrap = `
    <style id="base-styles">
      html, body {
        margin: 0 !important;
        padding: 50px !important; /* Massive breathing room for animations */
        border: 0 !important;
        width: auto !important;
        display: inline-block !important;
        box-sizing: border-box !important;
        overflow: visible !important; /* Allow animations to bleed into the padded zone */
        background: transparent !important;
        -webkit-tap-highlight-color: transparent;
      }
      
      * {
        box-sizing: border-box !important;
      }

      /* Visual Feedback for buttons */
      [style*="cursor: pointer"], button, .button, a {
        transition: transform 0.1s ease, opacity 0.1s ease !important;
        user-select: none !important;
      }
      [style*="cursor: pointer"]:active, button:active, .button:active, a:active {
        transform: scale(0.95) !important;
        opacity: 0.8 !important;
      }
    </style>
    <script id="base-script">
      // Redirect alerts and modals to parent
      window.alert = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: msg }, '*');
      };
      window.confirm = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: 'Confirm requested: ' + msg }, '*');
        return true; // Auto-confirm
      };
      window.prompt = function(msg) {
        window.parent.postMessage({ type: 'CHAT_ALERT', text: 'Prompt requested: ' + msg }, '*');
        return '';
      };
      
      // The Bridge: ALLOW cards to send messages back to the chat
      window.sendToChat = function(text) {
        if (!text) return;
        window.parent.postMessage({ type: 'CHAT_SEND', text: text }, '*');
      };

      document.body.style.opacity = '1';
    <\/script>
  `

  if (content.trim().toLowerCase().startsWith('<!doctype') || content.trim().toLowerCase().startsWith('<html')) {
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

const adjustHeight = () => {
  const iframe = iframeRef.value
  if (iframe && iframe.contentWindow && iframe.contentWindow.document.body) {
    const doc = iframe.contentWindow.document
    const body = doc.body

    // Restore context menu pass-through
    const passEvent = (e) => {
        const rect = iframe.getBoundingClientRect()
        const evt = new (e.constructor)(e.type, {
            ...e,
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + (e.clientX || (e.touches?.[0]?.clientX) || 0),
            clientY: rect.top + (e.clientY || (e.touches?.[0]?.clientY) || 0)
        })
        iframe.dispatchEvent(evt)
    }

    doc.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        passEvent(e)
    })

    // Bridge touches for long-press recognition
    doc.addEventListener('mousedown', passEvent)
    doc.addEventListener('touchstart', passEvent)
    doc.addEventListener('mouseup', passEvent)
    doc.addEventListener('touchend', passEvent)

    const updateSize = () => {
      // Trace both height and width
      const rect = body.getBoundingClientRect()
      
      // We SUBTRACT the padding from display but let the container be large enough
      // Actually, if we want to show the overflow, the iframe MUST be large enough.
      // So we keep the height/width as is but maybe add negative margins to the container?
      // Better: Keep height/width but ensure the iframe doesn't clip.
      
      if (rect.height > 0) height.value = rect.height
      if (rect.width > 0) {
          width.value = Math.min(rect.width, window.innerWidth * 0.95)
      }
    }

    updateSize()
    setTimeout(updateSize, 300)
    setTimeout(updateSize, 1000)

    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(updateSize)
      resizeObserver.value.observe(body)
    }
  }
}

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})

watch(() => props.content, (val) => {
  // Re-adjust height after content update
  console.log('[SafeHtmlCard] Content updated by parent:', val ? val.substring(0, 50) + '...' : 'empty');
})

// Log initial content
console.log('[SafeHtmlCard] Initial content:', props.content ? props.content.substring(0, 50) + '...' : 'empty');
</script>

<style scoped>
.safe-html-card {
  display: inline-block;
  vertical-align: top;
  transition: height 0.2s ease, width 0.2s ease;
  background: transparent;
  padding: 0;
  max-width: 100%;
  overflow: visible !important;
  
  /* Use negative margins to perfectly offset the 50px internal padding.
     This makes the 'logical' box of the card match the actual content,
     while the iframe itself extends 50px outwards in every direction to show overflow. */
  margin: -50px !important;
  pointer-events: none;
}

.safe-html-card iframe {
  border: none !important;
  background: transparent !important;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  display: block;
}

/* 响应式调整 */
@media (max-width: 480px) {
  .safe-html-card {
    padding: 0;
    border-radius: 0;
    box-shadow: none;
  }
}

/* 禁用 iframe 的默认样式 */
.safe-html-card iframe {
  border-radius: 0;
  background: transparent;
  width: 100%;
  height: 100%;
}
</style>
