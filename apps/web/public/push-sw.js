/* eslint-disable */
/**
 * Handlers de Web Push. El service worker generado por vite-plugin-pwa
 * (Workbox) lo carga con importScripts('push-sw.js') (ver vite.config.ts).
 * Muestra la notificación del cupón nuevo y, al tocarla, abre el cupón.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }
  const title = data.title || 'Mi Ciudad'
  const options = {
    body: data.body || 'Hay un cupón nuevo para vos',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.couponId || 'msp-coupon',
    data: { url: data.url || '/#/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rel = (event.notification.data && event.notification.data.url) || '/#/'
  const target = new URL(rel.replace(/^\//, ''), self.registration.scope).href
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(target)
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})
