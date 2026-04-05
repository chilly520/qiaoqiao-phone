import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  plugins: [
    vue()
  ],
  server: {
    host: true,
    proxy: {
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
    minify: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia')) return 'vue-vendor'
            if (id.includes('localforage')) return 'storage-vendor'
            if (id.includes('lodash') || id.includes('axios')) return 'common-vendor'
            return 'vendor'
          }
          if (id.includes('src/stores/chatStore')) return 'chat-store'
          if (id.includes('src/views/WeChat/OfflineModeChatWindow')) return 'offline-chat'
          if (id.includes('src/views/WeChat/ChatWindow')) return 'chat-window'
          if (id.includes('src/views/WeChat/components/ChatMessageItem')) return 'chat-item'
          if (id.includes('src/views/WeChat')) return 'wechat-views'
          if (id.includes('src/views/LoveSpace')) return 'love-views'
          if (id.includes('src/utils')) return 'utils'
        }
      }
    }
  }
}))
