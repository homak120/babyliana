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

// Love notes from Liana (D-070): playful, in her voice, to whoever holds the
// phone by their caregiver name. `{name}` is that name, capitalised; `{baby}` is
// hers. Warm and nothing else — no line asks for anything, mentions being
// hungry or alone, or has a view about how anyone is doing. That is the tone
// rule (CLAUDE.md) holding for words the way it holds for the mascot's art.
//
// **No line says she is awake or just woke.** *Awake* is derived from the
// clock, not observed, so such a line can be false. The owner had those taken
// out (D-070).
//
// The last ten are in baby language, at the owner's ask.
//
// Here rather than in the edge function so changing a line is an app deploy,
// not a trip to the Supabase dashboard.
const LOVE_LINES = [
  '{name}, I love you! ❤️🥰',
  'Hi {name}! Just thinking about you. 💭💕',
  'Hey {name}, guess what? I love you! 🤭❤️',
  '{name}, you\'re my favourite person. Don\'t tell anyone. 🤫💖',
  'I love you to the moon and back, {name}. 🌙✨',
  '{name}, your voice is my favourite song. 🎶💗',
  'Just wanted to say: I love you, {name}. 💌',
  'Psst, {name}… I love you. 🤫💕',
  '{name}, I\'m small, but my love for you is big. 👶💞',
  'You\'re my best snuggle buddy, {name}. 🧸🤗',
  'Every day with you is my favourite day, {name}. ☀️💛',
  '{name}, I made a new face today. It\'s the I-love-you face. 😊💕',
  'Hello from your little {baby}! Love you lots, {name}. 👋👶❤️',
  '{name}, you\'re my whole world. 🌍💖',
  'Wiggle wiggle — that\'s baby for “I love you, {name}.” 🐛💕',
  '{name}, I saved my best smile for you. 😁💝',
  'Tiny hands, big hugs. Love you, {name}! 🤲🤗',
  '{name}, your heartbeat is my favourite sound. 💓🎵',
  'First thing on my mind, always: you, {name}. 💭❤️',
  '{name}, I feel safe when you hold me. 🫶🥰',
  'I love you more than milk, {name}. Okay… almost as much. 🍼😜',
  '{name}, I\'m so happy you\'re mine. 😊💞',
  'Blowing you a bubble kiss, {name}! 🫧😘',
  '{name}, yours is my favourite face to look at. 👀💖',
  'Coo coo! That means I love you, {name}. 🐦❤️',
  'Eyes open, toes wiggling, heart full. Love you, {name}! 👣💗',
  '{name}, you\'re my favourite place to fall asleep. 😴💕',
  'Knock knock. Who\'s there? {baby}, who loves you, {name}! 🚪😄❤️',
  '{name}, when you smile I smile too. 😊😊',
  'Sending you the biggest little hug, {name}. 🤗💝',
  'Goo goo ga ga, {name}! (That means I love you.) 👶❤️',
  'Ba ba ba… {name}! Wuv you! 🥰',
  '{name}! Ma-ma-ma-mwah! 💋😘',
  'Agoo! Agoo! Big wuv for {name}! 🤗💖',
  'Bbbbbbt! That\'s a raspberry kiss for {name}. 😝💦',
  'Da da da da… {name}, wuv you wots! 💕💕',
  'Ooh! Aah! Eee! {name} is my favouwite. 🤩💗',
  'Gaa! {name}, huggy huggy pwease! 🥺🤗',
  'Bluh bluh bwah… translation: I wuv you, {name}. 🍼❤️',
  'Coo-coo-ga! Kissy kissy for {name}! 😘😘',
]

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function loveNote(data) {
  const line = LOVE_LINES[Math.floor(Math.random() * LOVE_LINES.length)]
  return line
    .replaceAll('{name}', capitalise(String(data.name || '').trim()))
    .replaceAll('{baby}', data.baby || 'baby')
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  if (data.kind === 'love') {
    event.waitUntil(
      self.registration.showNotification(data.baby || 'BabyLiana', {
        body: loveNote(data),
        tag: 'love-note',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url: '/' },
      }),
    )
    return
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
