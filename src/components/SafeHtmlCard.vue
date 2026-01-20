<template>
  <div class="safe-html-card" :style="{ height: height + 'px', width: width + 'px' }">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none overflow-hidden"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
      allowtransparency="true" scrolling="no" @load="adjustHeight"></iframe>
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
const width = ref(290) // Fixed safe width for mobile cards
const resizeObserver = ref(null)

const fullContent = computed(() => {
  const content = props.content || ''

  const bootstrap = `
    <style id="base-styles">
      html, body {
        margin: 0 !important;
        padding: 12px !important; 
        border: 0 !important;
        width: 100% !important;
        height: auto !important;
        display: block !important; /* Fix narrow strip issue: verify block layout */
        box-sizing: border-box !important;
        overflow-wrap: break-word !important;
        word-wrap: break-word !important;
        background: transparent !important;
        -webkit-tap-highlight-color: transparent;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      
      html::-webkit-scrollbar, body::-webkit-scrollbar {
        display: none !important;
      }
      
      * {
        box-sizing: border-box !important;
        max-width: 100% !important;
      }

      /* Visual Feedback for buttons */
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

      // Auto-Wire Static Menus: Make elements interactive ONLY if they look like intentional menu items
      document.addEventListener('DOMContentLoaded', () => {
         // MORE AGGRESSIVE: Include all generic buttons and links-that-act-like-buttons
         const interactives = document.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"], .button, .menu-item, button, a[href="#"], [role="button"]');
         interactives.forEach(el => {
            // Only auto-wire if:
            // 1. No existing onclick property
            // 2. Not a structural element (summary, details, header)
            // 3. Has non-empty text
            const isStructural = /^(H[1-6]|SUMMARY|DETAILS|NAV|FOOTER)$/i.test(el.tagName);
            if (!el.onclick && !isStructural) {
               const text = (el.innerText || el.textContent || '').trim();
               // If it's a button tag, we always assume it's actionable
               const alwaysAction = el.tagName === 'BUTTON' || el.classList.contains('chat-button') || el.getAttribute('role') === 'button';
               const isMenuFormat = /^\[\s*.*\s*\]$/.test(text); 
               
               if (text && (isMenuFormat || alwaysAction || el.classList.contains('menu-item'))) {
                  el.onclick = (e) => {
                     e.stopPropagation();
                     // Clean text: removing brackets if they exist
                     const cleanText = text.replace(/^\[\s*|\s*\]$/g, '').trim(); 
                     if (cleanText) window.sendToChat(cleanText);
                  };
               }
            }
         });
      });

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

    // Restore context menu pass-through with high robustness
    const passEvent = (e) => {
      if (!e) return;
      try {
        const rect = iframe.getBoundingClientRect()

        // Extract coordinates safely from various event types
        let x = 0, y = 0
        if (typeof e.clientX === 'number') {
          x = e.clientX
          y = e.clientY
        } else if (e.touches && e.touches.length > 0) {
          x = e.touches[0].clientX || 0
          y = e.touches[0].clientY || 0
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          x = e.changedTouches[0].clientX || 0
          y = e.changedTouches[0].clientY || 0
        }

        // Always use MouseEvent/PointerEvent for the bridge to ensure clientX/Y 
        // are available for parent components like ChatMessageItem/ChatWindow.
        // Using MouseEvent is the most compatible way to proxy interaction events.
        const evt = new MouseEvent(e.type === 'touchstart' ? 'mousedown' :
          (e.type === 'touchend' ? 'mouseup' : e.type), {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: rect.left + x,
          clientY: rect.top + y,
          detail: e.detail || 0,
          button: e.button || 0,
          buttons: e.buttons || 0,
          ctrlKey: !!e.ctrlKey,
          shiftKey: !!e.shiftKey,
          altKey: !!e.altKey,
          metaKey: !!e.metaKey
        })

        iframe.dispatchEvent(evt)
      } catch (err) {
        console.warn('[SafeHtmlCard] Event bridge failed:', err)
      }
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
      // Trace the actual content dimensions
      // Use scrollHeight/Width to catch full content even if body is flexed
      const newHeight = body.scrollHeight
      const newWidth = body.scrollWidth

      if (newHeight > 0) height.value = newHeight + 2
      // FIX: Do not auto-shrink width. Keep it fixed/stable to allow text to wrap naturally without collapsing.
      // width.value = ... 
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
  overflow: hidden;
  /* Keep the card contained */
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.safe-html-card::-webkit-scrollbar {
  display: none !important;
}

.safe-html-card iframe {
  border: none !important;
  background: transparent !important;
  width: 100%;
  height: 100%;
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
