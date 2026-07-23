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
    },
    // 注入诊断脚本: build 后在 </body> 前加 classic script,
    // 5 秒后检测 Vue 是否挂载, 没挂载就显示错误信息.
    // 之前写在 index.html 里被 Vite build 吃掉了, 改用插件确保保留.
    {
      name: 'inject-diagnostics',
      transformIndexHtml(html) {
        const diag = `<script>(function(){
          window.setTimeout(function(){
            var app=document.getElementById('app');
            if(!app||app.children.length===0){
              var s=document.getElementById('native-splash');
              if(s){s.innerHTML='<div style="text-align:center;padding:20px;font-family:-apple-system,sans-serif;color:#475569">'+
              '<div style="font-size:48px;margin-bottom:16px">❄️</div>'+
              '<div style="font-size:16px;font-weight:600;color:#ef4444;margin-bottom:8px">加载失败</div>'+
              '<div style="font-size:11px;opacity:0.7;word-break:break-all;padding:0 16px">JS 可能加载失败，请截图发给开发者</div>'+
              '</div>';console.error('DIAG: Vue not mounted after 5s');}
            }
          },5000);
        })();</script>`
        return html.replace('</body>', diag + '\n</body>')
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
