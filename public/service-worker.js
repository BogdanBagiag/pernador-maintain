// Service Worker for PWA
const CACHE_NAME = 'pernador-maintenance-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html'
]

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.log('Cache failed:', error)
      })
  )
  self.skipWaiting()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response
        }
        return fetch(event.request).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          
          // Clone response for cache
          const responseToCache = response.clone()
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              // Ignore chrome-extension and other unsupported schemes
              if (event.request.url.startsWith('chrome-extension://') || 
                  event.request.url.startsWith('moz-extension://')) {
                return
              }
              cache.put(event.request, responseToCache).catch(err => {
                // Silently catch cache errors
                console.debug('Cache put failed:', err.message)
              })
            })
          
          return response
        })
      })
      .catch(() => {
        // Offline fallback
        return caches.match('/offline.html')
      })
  )
})

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {}
  
  try {
    // Try to parse as JSON
    data = event.data ? event.data.json() : {}
  } catch (e) {
    // If not JSON, treat as plain text
    const text = event.data ? event.data.text() : 'New notification'
    data = { title: 'Notification', body: text }
  }
  
  const title = data.title || 'Pernador Maintain'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.data || {},
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if window is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})
