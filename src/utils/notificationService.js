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
  sendNotification(title, options = {}) {
    if (!this.hasPermission()) {
      console.log('Notification permission not granted')
      return null
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.jpg',
        badge: '/pwa-192x192.jpg',
        ...options
      })

      // Close notification after 5 seconds
      setTimeout(() => {
        notification.close()
      }, options.duration || 5000)

      return notification
    } catch (error) {
      console.error('Failed to send notification:', error)
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
        // Check if sw.js exists before registering
        const response = await fetch('/sw.js', { method: 'HEAD' })
        if (response.ok) {
          const registration = await navigator.serviceWorker.register('/sw.js')
          console.log('ServiceWorker registration successful with scope:', registration.scope)
          return registration
        } else {
          console.log('ServiceWorker file not found, skipping registration')
          return null
        }
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
