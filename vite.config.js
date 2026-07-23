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
    // Android WebView 用 file:// 加载时, <script crossorigin> / <link crossorigin>
    // 会触发 CORS 检查, file:// 没有 HTTP 响应头 → 浏览器拒绝执行 → PWA 加载失败.
    // 这个插件在 build 后把 index.html 里的 crossorigin 属性全删掉.
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="[^"]*")?/g, '')
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
    chunkSizeWarningLimit: 2000
  }
}))
