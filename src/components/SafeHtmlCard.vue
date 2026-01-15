<template>
  <div class="safe-html-card w-full" :style="{ height: height + 'px' }">
    <iframe ref="iframeRef" :srcdoc="fullContent" class="w-full h-full border-none overflow-hidden"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock allow-top-navigation-by-user-activation"
      allowtransparency="true"
      @load="adjustHeight"></iframe>
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
const height = ref(0)
const resizeObserver = ref(null)

const fullContent = computed(() => {
    const content = props.content || ''

    const bootstrap = `
    <style id="base-styles">
      /* 样式重置，确保HTML卡片不影响外部界面，同时保留内容的原始样式 */
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        width: 100% !important;
        height: 100% !important;
        box-sizing: border-box !important;
      }
      
      /* 重置所有元素的样式 */
      *,
      *::before,
      *::after {
        box-sizing: border-box !important;
      }
      
      /* 移除所有可能干扰原始样式的样式定义 */
      
      /* 确保内容不会溢出 */
      * {
        max-width: 100% !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      
      /* 确保iframe内容不会影响外部 */
      iframe {
        display: none !important;
      }
    </style>
    <script id="base-script">
      /* 重写alert函数，使用更美观的样式 */
      window.alert = function(msg) {
        console.log('[HTML Card Alert]:', msg);
        const div = document.createElement('div');
        div.id = 'custom-alert-bubble';
        div.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(135, 206, 235, 0.95); color:#005a87; padding:20px 30px; border-radius:12px; z-index:999999; font-size:14px; text-align:center; box-shadow:0 8px 30px rgba(135, 206, 235, 0.4); min-width:200px; backdrop-filter:blur(12px); line-height:1.6; border: 1px solid rgba(255,255,255,0.6); font-weight:500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; animation: card-fade-in 0.3s ease;";
        div.innerHTML = String(msg).replace(/\\n/g, '<br>');
        document.body.appendChild(div);
        setTimeout(() => {
          div.style.opacity = '0';
          div.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          div.style.transform = 'translate(-50%, -60%)';
          setTimeout(() => div.remove(), 500);
        }, 3000);
      };
      
      /* 防止卡片内容影响外部界面 */
      window.addEventListener('message', function(e) {
        console.log('[HTML Card Alert]:', e.data);
      });
      
      /* 确保页面加载完成后应用样式 */
      window.addEventListener('load', function() {
        document.body.style.opacity = '1';
      });
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
        height.value = newHeight
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

watch(() => props.content, (val) => {
  // Re-adjust height after content update
  console.log('[SafeHtmlCard] Content updated by parent:', val ? val.substring(0, 50) + '...' : 'empty');
})

// Log initial content
console.log('[SafeHtmlCard] Initial content:', props.content ? props.content.substring(0, 50) + '...' : 'empty');
</script>

<style scoped>
.safe-html-card {
  transition: height 0.2s ease, opacity 0.3s ease;
  /* 移除布局隔离，避免影响高度计算 */
  overflow: hidden;
  /* 移除边框和阴影，让内容完全融入界面 */
  border-radius: 0;
  box-shadow: none;
  /* 完全透明背景 */
  background: transparent;
  /* 移除内边距，让内容紧贴边缘 */
  padding: 0;
  /* 防止内容溢出 */
  max-width: 100%;
  word-wrap: break-word;
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
}
</style>
