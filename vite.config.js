import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  // 顶层 base 优先: 让 build 产物用相对路径 (./assets/xxx.js),
  // 这样 PWA 既能在 https://qiaqiao-phone.pages.dev 跑,
  // 也能在 Android WebView 加载 file:///android_asset/index.html 时跑.
  base: './',
  plugins: [
    vue(),
    // Android WebView 用 file:// 加载时:
    // 1. <script type="module"> 走 CORS, file:// origin 是 null → 拒绝执行
    // 2. <script crossorigin> / <link crossorigin> 触发 CORS → 拒绝执行
    // 这个插件在 build 后 (IIFE 格式下):
    // - 删掉 type="module" (改成 classic script, 不走 CORS)
    // - 删掉 crossorigin 属性
    // - 把 native-diag.js 移到主 JS 之前 (确保能捕获主 JS 的加载错误)
    // 仅在 build 阶段生效: dev 模式下 Vite 用原生 ESM, 必须保留 type="module"
    // 当前 build 是 ES 格式 (云端 Web 部署), 此插件不做任何修改
    {
      name: 'fix-script-tags',
      apply: 'build',
      transformIndexHtml(html) {
        // 临时禁用: 切到 ES 格式后, 保留 type="module" 以让浏览器正确加载
        return html
      }
    }
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api-music': {
        target: 'https://v2.api.music.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-music/, '')
      },
      '/v2/music': {
        target: 'https://v2.api.music.io',
        changeOrigin: true
      },
      '/api': {
        target: 'https://api.github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/v2': {
        target: 'https://api.vkeys.cn',
        changeOrigin: true,
        secure: false
      },
      '/doubao': {
        target: 'https://www.doubao.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/doubao/, '')
      },
      '/volc': {
        target: 'https://translate.volcengine.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/volc/, '')
      },
      '/volc-paid': {
        target: 'https://api.volcengineapi.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/volc-paid/, '')
      },
      '/ws-doubao': {
        target: 'wss://www.doubao.com',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/ws-doubao/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    target: 'esnext',
    // base 在 config 顶层设置 (见文件头部).
    minify: false, // 临时关闭 minify, 排查 stack overflow
    sourcemap: false, // 关闭 sourcemap, 减小产物体积和内存压力
    chunkSizeWarningLimit: 5000,
    // 关键: 用 IIFE 格式而不是 ES module.
    // ES module (<script type="module">) 在 file:// 下走 CORS, origin 是 null,
    // 浏览器拒绝执行 → PWA 加载失败.
    // IIFE (<script src="...">) 不走 CORS, file:// 直接能加载.
    // inlineDynamicImports: 把所有动态 import() 内联到主 bundle, IIFE 不支持代码分割.
    // 临时关闭 IIFE: Node 25 + Windows + inlineDynamicImports=true 触发 STATUS_STACK_BUFFER_OVERRUN
    // TODO: 等 native APP 那边也用 ES module (WebViewAssetLoader origin) 后, 这里改回 iife
    // 强制分块: 把大文件 (chatStore, jsonUtils, aiService) 拆成独立 chunk, 避免单个 chunk 过大
    rollupOptions: {
      output: {
        format: 'es',
        inlineDynamicImports: false,
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            if (id.includes('tone') || id.includes('marked') || id.includes('localforage')) {
              return 'utils-vendor'
            }
            if (id.includes('@fortawesome')) {
              return 'fontawesome-vendor'
            }
            return 'vendor'
          }
          if (id.includes('src/stores/chatStore') || id.includes('src/utils/aiService') || id.includes('src/utils/jsonUtils')) {
            return 'chat-core'
          }
          if (id.includes('src/views/WeChat')) {
            return 'wechat'
          }
          if (id.includes('src/views')) {
            return 'views'
          }
          if (id.includes('src/stores')) {
            return 'stores'
          }
          if (id.includes('src/utils')) {
            return 'utils'
          }
        }
      }
    }
  }
}))
