import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useLoggerStore } from './stores/loggerStore'
import { notificationService } from './utils/notificationService'
import './style.css'
import '@fortawesome/fontawesome-free/css/all.css'
import './assets/themes.css' // 主题系统

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const logger = useLoggerStore()

// --- Global Error Handling ---
window.onerror = (message, source, lineno, colno, error) => {
    logger.error('JS Runtime Error', { message, source, lineno, colno, stack: error?.stack })
    return false
}

window.onunhandledrejection = (event) => {
    logger.error('Promise Rejection', { reason: event.reason })
}

app.config.errorHandler = (err, vm, info) => {
    logger.error('Vue Error', { error: err.message, stack: err.stack, info })
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

app.mount('#app')

// Initialize Notification Service
const initNotificationService = async () => {
    try {
        // Register Service Worker for PWA functionality
        if (notificationService.isServiceWorkerSupported()) {
            await notificationService.registerServiceWorker()
            logger.sys('Service Worker 注册成功')
        }
        
        // Request notification permission
        const hasPermission = await notificationService.requestPermission()
        logger.sys(`通知权限: ${hasPermission ? '已授予' : '已拒绝'}`)
    } catch (error) {
        logger.error('通知服务初始化失败', { error: error.message })
    }
}

initNotificationService()

// Provide notification service globally for easy access
app.provide('notificationService', notificationService)
