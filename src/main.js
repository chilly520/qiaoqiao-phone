import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useLoggerStore } from './stores/loggerStore'
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

// --- Navigation Logging ---
router.afterEach((to, from) => {
    if (from.path !== to.path) {
        logger.sys(`页面跳转: ${from.path} -> ${to.path}`, { 
            name: to.name,
            params: to.params,
            query: to.query
        })
    }
})

// Initial System Info
logger.sys('系统启动', {
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform
})

app.mount('#app')
