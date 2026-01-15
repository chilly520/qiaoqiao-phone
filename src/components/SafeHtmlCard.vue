<template>
  <div class="safe-html-card w-full" :style="{ height: height + 'px' }">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none overflow-hidden"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals" @load="adjustHeight"></iframe>
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
const height = ref(100)
const resizeObserver = ref(null)

const fullContent = computed(() => {
  const content = props.content || ''

  const bootstrap = `
    <style id="base-styles">
      :root { all: initial; } /* 彻底切断任何潜在的基础属性继承 */
      html, body { 
        margin: 0 !important; 
        padding: 0 !important; 
        border: 0 !important;
        overflow: hidden !important; 
        width: 100% !important; 
        background: transparent !important; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        color: inherit;
        box-sizing: border-box !important;
      }
      * { box-sizing: border-box !important; }
      ::-webkit-scrollbar { display: none !important; }
    </style>
    <script id="base-script">
      window.alert = function(msg) {
        console.log('[HTML Card Alert]:', msg);
        const div = document.createElement('div');
        div.id = 'custom-alert-bubble';
        div.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(135, 206, 235, 0.75); color:#005a87; padding:15px 25px; border-radius:15px; z-index:999999; font-size:14px; text-align:center; box-shadow:0 10px 30px rgba(135, 206, 235, 0.3); min-width:160px; backdrop-filter:blur(10px); line-height:1.6; border: 1px solid rgba(255,255,255,0.4); font-weight:bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; animation: card-fade-in 0.3s ease;";
        div.innerHTML = String(msg).replace(/\\n/g, '<br>');
        document.body.appendChild(div);
        setTimeout(() => {
          div.style.opacity = '0';
          div.style.transition = 'opacity 0.5s ease';
          setTimeout(() => div.remove(), 500);
        }, 3000);
      };
      const style = document.createElement('style');
      style.innerHTML = "@keyframes card-fade-in { from { opacity:0; transform:translate(-50%, -40%); } to { opacity:1; transform:translate(-50%, -50%); } }";
      document.head.appendChild(style);
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
    <html>
      <head>
        <meta charset="UTF-8">
        ${bootstrap}
      </head>
      <body>
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
    const html = doc.documentElement

    doc.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const rect = iframe.getBoundingClientRect()
      const evt = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + e.clientX,
        clientY: rect.top + e.clientY
      })
      iframe.dispatchEvent(evt)
    })

    const updateHeight = () => {
      const newHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      )
      if (newHeight > 0) {
        height.value = newHeight + 10
      }
    }

    updateHeight()

    if (!resizeObserver.value) {
      resizeObserver.value = new ResizeObserver(updateHeight)
      resizeObserver.value.observe(body)
    }
  }
}

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})

watch(() => props.content, () => {
  // Re-adjust height after content update
})
</script>

<style scoped>
.safe-html-card {
  transition: height 0.2s ease;
  /* 开启浏览器原生的渲染隔离，防止 layout 和 paint 影响外部 */
  contain: paint layout;
  overflow: hidden;
}
</style>
