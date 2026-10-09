// Push handling for the feed alert (D-069), pulled into the generated service
// worker by `workbox.importScripts` in vite.config.ts.
//
// The server sends facts — which baby, when the target is, the phone's clock
// format — and the words are made here, so the time is printed in this phone's
// timezone and format like every other time in the app (D-041).
//
// The title is the card's own: *make milk*, the same prompt, the same instant.

function clockText(iso, clock) {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  if (clock === '12h') {
    return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  const hh = String(at.getHours()).padStart(2, '0')
  const mm = String(at.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const time = clockText(data.targetAt, data.clock)
  const body = [data.baby, time && `next feed by ${time}`].filter(Boolean).join(' · ')

  // iOS requires every push to show something, so there is no silent branch.
  // One tag: a newer alert replaces an older one rather than stacking.
  event.waitUntil(
    self.registration.showNotification('make milk', {
      body,
      tag: 'feed-alert',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list[0]
      return open ? open.focus() : self.clients.openWindow('/')
    }),
  )
})
