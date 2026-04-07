import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  plugins: [
    vue()
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
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000
  }
}))
