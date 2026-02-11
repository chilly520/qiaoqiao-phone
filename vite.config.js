import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'


// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  esbuild: {
    charset: 'utf8',
  },
  plugins: [
    vue(),
    VitePWA({
      disable: command === 'build', // 生产构建禁用，规避 Vercel 上 esbuild Utf8Error
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: "Chilly's Phone",
        short_name: 'Chilly',
        description: "Chilly's Exclusive Phone App",
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192x192.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          },
          {
            src: 'pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.+/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
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
  }
}))
