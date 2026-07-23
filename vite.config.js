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
    // 这个插件在 build 后:
    // - 删掉 type="module" (改成 classic script, 不走 CORS)
    // - 删掉 crossorigin 属性
    // - 把 native-diag.js 移到主 JS 之前 (确保能捕获主 JS 的加载错误)
    {
      name: 'fix-script-tags',
      transformIndexHtml(html) {
        // 删 type="module": IIFE 格式的 JS 不需要 module 模式
        html = html.replace(/\s+type="module"/g, '')
        // 删 crossorigin 属性
        html = html.replace(/\s+crossorigin(="[^"]*")?/g, '')
        // 把 native-diag.js 移到主 JS 之前
        if (html.includes('native-diag.js') && html.includes('assets/index-')) {
          var diagMatch = html.match(/<script src="\.\/native-diag\.js"><\/script>/)
          if (diagMatch) {
            var diagTag = diagMatch[0]
            html = html.replace(diagTag, '')
            // 插入到主 JS script 之前
            html = html.replace(
              /(<script src="\.\/assets\/index-[^"]+\.js"><\/script>)/,
              diagTag + '\n  $1'
            )
          }
        }
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
    minify: false, // 禁用混淆，防止变量提升顺序在混淆时被破坏（解决 Cannot access before initialization 报错）
    chunkSizeWarningLimit: 5000,
    // 关键: 用 IIFE 格式而不是 ES module.
    // ES module (<script type="module">) 在 file:// 下走 CORS, origin 是 null,
    // 浏览器拒绝执行 → PWA 加载失败.
    // IIFE (<script src="...">) 不走 CORS, file:// 直接能加载.
    // inlineDynamicImports: 把所有动态 import() 内联到主 bundle, IIFE 不支持代码分割.
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true
      }
    }
  }
}))
