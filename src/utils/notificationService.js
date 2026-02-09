// Notification Service for handling push notifications and background tasks

class NotificationService {
  constructor() {
    this.permission = null
    this.isSupported = 'Notification' in window
  }

  // Request notification permission
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

  // Send a notification
  async sendNotification(title, options = {}) {
    if (!this.hasPermission()) {
      console.log('Notification permission not granted')
      return null
    }

    const notificationOptions = {
      icon: '/pwa-192x192.jpg',
      badge: '/pwa-192x192.jpg',
      vibrate: [200, 100, 200],
      tag: options.tag || 'chat-notification',
      renotify: true,
      ...options
    };

    // Try Service Worker registration first (More reliable for mobile/background)
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

  // Register service worker for background tasks
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Skip HEAD request and directly try to register
        // This avoids the potential ERR_ABORTED error
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('ServiceWorker registration successful with scope:', registration.scope)
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
