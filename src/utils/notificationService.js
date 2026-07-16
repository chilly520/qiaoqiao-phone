// v1.10.120: Notification Service - 前台通知 + Service Worker注册
// Web Push 相关功能已移除,保留SW注册(用于PWA离线缓存)和前台Notification API
// 发送通知仅在应用前台打开时可见,不再支持App完全关闭时的后台推送

class NotificationService {
  constructor() {
    this.permission = null
    this.isSupported = 'Notification' in window
  }

  // Request notification permission (仅在用户主动操作时调用,不再启动时自动请求)
  async requestPermission() {
    if (!this.isSupported) {
      console.log('Notifications are not supported in this browser')
      return false
    }

    const permission = await Notification.requestPermission()
    this.permission = permission
    return permission === 'granted'
  }

  // Check if notification permission is granted
  hasPermission() {
    if (!this.isSupported) return false
    return Notification.permission === 'granted'
  }

  // Send a notification (前台通知,App打开时可见)
  async sendNotification(title, options = {}) {
    if (!this.hasPermission()) {
      console.log('Notification permission not granted')
      return null
    }

    const notificationOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: options.tag || 'chat-notification',
      renotify: true,
      ...options
    };

    // Try Service Worker registration first (More reliable for mobile)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notificationOptions);
          console.log('[NotificationService] Sent via ServiceWorker');
          return true;
        }
      } catch (e) {
        console.warn('[NotificationService] SW notification failed, falling back:', e);
      }
    }

    // Fallback to standard Notification API
    try {
      const notification = new Notification(title, notificationOptions)

      // Close notification after duration
      setTimeout(() => {
        notification.close()
      }, options.duration || 5000)

      return notification
    } catch (error) {
      console.error('Failed to send notification via fallback:', error)
      return null
    }
  }

  // Schedule a notification (simple implementation)
  scheduleNotification(title, options = {}) {
    if (!this.hasPermission()) {
      console.log('Notification permission not granted')
      return null
    }

    const delay = options.delay || 0
    return setTimeout(() => {
      this.sendNotification(title, options)
    }, delay)
  }

  // Register service worker for PWA offline cache
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // v1.10.158: bump v=29 强制 SW 重新检测(情侣空间相册生图支持形象图暗号)
        const registration = await navigator.serviceWorker.register('/sw.js?v=29', { scope: '/' })
        console.log('ServiceWorker registration successful with scope:', registration.scope)

        // 如果有等待中的新 SW，立即激活它（替换旧版本）
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        // 监听后续 SW 更新，自动激活
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新 SW 已安装且当前有旧 SW 在控制页面，通知新 SW 跳过等待
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
              // 新 SW 激活后,通知所有客户端强制 reload
              if (newWorker.state === 'activated') {
                navigator.serviceWorker.controller?.postMessage({ type: 'CLIENTS_RELOAD' })
              }
            })
          }
        })

        return registration
      } catch (error) {
        console.error('ServiceWorker registration failed:', error)
        return null
      }
    }
    return null
  }

  // Check if service worker is supported
  isServiceWorkerSupported() {
    return 'serviceWorker' in navigator
  }
}

export const notificationService = new NotificationService()
