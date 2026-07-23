import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useLoggerStore } from './stores/loggerStore'
import { notificationService } from './utils/notificationService'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.css'
import './assets/handwriting.css' // v1.10.231: 本地化手写体 (替代 v1.10.205 删除的 Google Fonts), 修复 Android WebView 字体 fallback
import './assets/themes.css' // 主题系统

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const logger = useLoggerStore(pinia)

window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message)
    // Filter out benign browser extension errors or ResizeObserver noise
    if (msg.includes('Receiving end does not exist') ||
        msg.includes('message port closed') ||
        msg.includes('ResizeObserver')) {
        return true // Silence the error
    }
    logger.error('JS Runtime Error', { message, source, lineno, colno, stack: error?.stack })
    return false
}

window.onunhandledrejection = (event) => {
    // Extract meaningful info from the rejection reason
    let reason = event.reason

    // Filter out benign browser extension errors
    // "Receiving end does not exist" is a common Chrome Extension communication error
    // "The message port closed before a response was received" is another one
    const msg = reason?.message || String(reason)
    if (msg.includes('Receiving end does not exist') || msg.includes('message port closed') || msg.includes('ResizeObserver')) {
        event.preventDefault(); // Prevent browser console error output
        return
    }

    if (reason instanceof Error) {
        reason = {
            message: reason.message,
            stack: reason.stack,
            name: reason.name
        }
    }
    logger.error('Promise Rejection', { reason })
}

app.config.errorHandler = (err, vm, info) => {
    logger.error('Vue Error', { error: err.message, stack: err.stack, info })
}
// Suppress Vue Warnings (Yellow Box)
app.config.warnHandler = (msg, vm, trace) => {
    // Ignore warnings
}

// --- Navigation Logging (Disabled for noise reduction) ---
// router.afterEach((to, from) => {
//     if (from.path !== to.path) {
//         logger.sys(`页面跳转: ${from.path} -> ${to.path}`, { 
//             name: to.name,
//             params: to.params,
//             query: to.query
//         })
//     }
// })

// Initial System Info (Disabled for noise reduction)
// logger.sys('系统启动', {
//     userAgent: navigator.userAgent,
//     screen: `${window.screen.width}x${window.screen.height}`,
//     platform: navigator.platform
// })

// try-catch 包裹 mount: 如果 Vue 挂载时报错 (比如路由初始化失败),
// 显示错误信息而不是一直转圈.
try {
    app.mount('#app')
} catch (e) {
    console.error('Vue mount failed:', e)
    var splash = document.getElementById('native-splash')
    if (splash) {
        splash.innerHTML = '<div style="text-align:center;padding:20px;font-family:-apple-system,sans-serif;color:#475569">' +
            '<div style="font-size:48px;margin-bottom:16px">❄️</div>' +
            '<div style="font-size:16px;font-weight:600;color:#ef4444;margin-bottom:8px">启动失败</div>' +
            '<div style="font-size:11px;opacity:0.7;word-break:break-all;padding:0 16px">' +
            (e && e.message ? e.message : String(e)) + '</div></div>'
    }
}

// Initialize Notification Service (v1.10.120: 仅注册SW用于PWA离线缓存,不再启动时请求通知权限)
const initNotificationService = async () => {
    try {
        // 在 native APP 里 (WebViewAssetLoader origin) 跳过 SW 注册.
        // appassets.androidplatform.net 不是真实域名, /sw.js 请求 DNS 失败会 hang,
        // 可能阻塞浏览器网络队列. native APP 不需要 SW 离线缓存 (资源已在 APK 内).
        if (window.ChillyNative) {
            console.log('Native app detected, skipping Service Worker registration')
            return
        }
        // Register Service Worker for PWA offline cache
        if (notificationService.isServiceWorkerSupported()) {
            await notificationService.registerServiceWorker()
            logger.sys('Service Worker 注册成功')
        }
    } catch (error) {
        logger.error('Service Worker 注册失败', { error: error.message })
    }
}

initNotificationService()

// Provide notification service globally for easy access
app.provide('notificationService', notificationService)
