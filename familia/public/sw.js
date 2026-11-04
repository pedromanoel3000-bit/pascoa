// Roda em segundo plano: abre o app sem internet e mostra as notificações.
const CACHE = 'nosso-lar-v3'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest'])))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/')))
  )
})

// ---------- notificações ----------
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = { body: e.data && e.data.text() }
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Nosso Lar', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/', nid: data.nid || null },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const nid = e.notification.data?.nid
  const target = new URL(e.notification.data?.url || '/', self.location.origin)
  // ?n=<id> avisa o app qual item do histórico marcar como lido.
  if (nid) target.search = '?n=' + encodeURIComponent(nid)
  const url = target.href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin)
      if (win) {
        win.postMessage({ type: 'open', hash: target.hash, nid })
        return win.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
