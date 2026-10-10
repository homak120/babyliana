import * as db from './db'
import { awakeWindow, lastFeedAt, ongoingFeed, targetWake } from './derive'
import { getCaregiverId } from './caregiver-id'
import { getBabyId } from './household'
import { effective } from './settings'
import { supabase } from './supabase'
import { note } from './sync'
import { timeFormat } from './timeformat'
import type { Baby, BabySettings, Moment } from './types'

// The feed alert, this end of it (D-069): the card's *make milk* prompt, sent
// to a phone that is in a pocket. `.specify/memory/feed-alert.md` is the spec.
//
// Two jobs, both run after a successful sync and neither on the write path:
//
//   1. Publish when the next alert is due, for the baby on screen. Every phone
//      does this whether or not its own switch is on — the alert is for
//      whichever devices *are* subscribed, and they may not be the one that
//      logged the feed.
//   2. Keep this install's push subscription row current, if the switch is on.
//
// **Nothing here is a log write**, so none of it goes through the outbox and
// none of it can stall sync. A failure is a line in the sync trail and a retry
// on the next sync.

/**
 * The public half of the VAPID pair — the seal the push service checks every
 * alert against. **Public by design**: it ships in the bundle whatever we do, so
 * it lives here rather than as a Vercel variable (which refuses a `VITE_` name
 * marked private). The private half is only in the edge function's secrets.
 * Rotating the pair means changing this line and re-subscribing every device.
 */
const VAPID_KEY = 'BAIdW6TS-vDYkIMcpywQdo7akb-bpnD4HO_g3_ZHXROzWioP-om7VOGQTS4UgYuX7FClTJsQHWiAGGiG3Le4Hbw'

/** `'1'` while this install has the switch on. Per device — *only here*. */
const ON_KEY = 'babyliana.alerts'
/** What this install last sent to `feed_alert`, so an unchanged answer is not re-sent. */
const PUBLISHED_KEY = 'babyliana.alert_published'
/** What this install last sent to `push_subscription`, for the same reason. */
const REGISTERED_KEY = 'babyliana.alert_registered'
/** `'0'` when this install has switched love notes off (D-070). Absent is on. */
const LOVE_KEY = 'babyliana.love_notes'

const store = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage

/**
 * When the next alert goes off, from the log — the card's rule and nothing else.
 *
 * Silent exactly when the card's wake line is: no feed yet, or one running. The
 * fire time is the target minus the prep lead, which is when `bottleDue` turns
 * true and the pill appears.
 *
 * **Both numbers are the shared settings, never constants** — the feeding cycle
 * sets the target and the prep lead sets how far ahead of it. `settings` is the
 * synced baby row's: this runs straight after a pull, and the local cache only
 * catches up with the row when the log screen reconciles, which may not have
 * happened yet. Reading the cache here would publish the old time on top of the
 * new one the other phone just published. Absent, it falls back to the cache.
 */
export function feedAlertFor(
  moments: Moment[],
  now = new Date(),
  settings?: BabySettings | null,
): { fire_at: string | null; target_at: string | null } {
  const target = ongoingFeed(moments, now)
    ? null
    : targetWake(lastFeedAt(moments), effective('cycles', settings))
  if (!target) return { fire_at: null, target_at: null }
  const fire = new Date(target.getTime() - effective('prepLeadMinutes', settings) * 60_000)
  return { fire_at: fire.toISOString(), target_at: target.toISOString() }
}

/**
 * Tell the server when this baby's next alert is due.
 *
 * Both phones do it and both get the same answer from the same synced log;
 * whichever lands last wins and agrees. `sent_for` is not in the payload, so the
 * upsert never touches the server's record of what it has already sent.
 */
export async function publishFeedAlert(): Promise<void> {
  const babyId = getBabyId()
  if (!supabase || !babyId) return
  const baby = (await db.getRow('baby', babyId)) as Baby | undefined
  const moments = await db.getMoments()
  const now = new Date()
  // The love note's window rides on the same row (D-070). The mascot's
  // thresholds are constants, not settings, so there is no row to read here.
  const awake = awakeWindow(moments, now)
  const next = {
    ...feedAlertFor(moments, now, baby?.settings),
    awake_from: awake?.from.toISOString() ?? null,
    awake_until: awake?.until.toISOString() ?? null,
  }
  const fingerprint = `${babyId}|${next.fire_at}|${next.target_at}|${next.awake_from}|${next.awake_until}`
  if (store()?.getItem(PUBLISHED_KEY) === fingerprint) return

  const { error } = await supabase
    .from('feed_alert')
    .upsert({ baby_id: babyId, ...next, updated_at: new Date().toISOString() })
  if (error) {
    note(`feed alert not published — ${error.message}`)
    return
  }
  store()?.setItem(PUBLISHED_KEY, fingerprint)
}

// ---------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------

/**
 * Whether this install can take alerts, and if not, the one thing to say.
 *
 * `install` is the common one: iOS only gives Web Push to an app added to the
 * home screen, so in a Safari tab the honest answer is "add it first".
 */
export type AlertSupport = 'ok' | 'install' | 'unsupported' | 'blocked' | 'unconfigured'

const standalone = () =>
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches)
  || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function alertSupport(): AlertSupport {
  if (!supabase) return 'unconfigured'
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!capable) return standalone() ? 'unsupported' : 'install'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ok'
}

export const alertsOn = (): boolean =>
  store()?.getItem(ON_KEY) === '1'
  && typeof Notification !== 'undefined'
  && Notification.permission === 'granted'

/** The VAPID key as the bytes `subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/**
 * Turn alerts on for this install. Returns null on success, or a sentence.
 *
 * Must be called from a tap — iOS refuses the permission prompt otherwise.
 * The local switch is set as soon as the phone has a subscription; the row
 * follows, and if it cannot go now `refreshSubscription` sends it after the
 * next sync.
 */
export async function turnAlertsOn(): Promise<string | null> {
  if (alertSupport() !== 'ok') return 'alerts are not available here'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return 'notifications are blocked for this app — allow them in the phone’s settings'
  }
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (!existing) {
      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_KEY),
      })
    }
  } catch (e) {
    return `could not turn alerts on — ${e instanceof Error ? e.message : String(e)}`
  }
  store()?.setItem(ON_KEY, '1')
  store()?.removeItem(REGISTERED_KEY)
  await refreshSubscription()
  return null
}

/** Turn them off: forget the subscription on the phone and on the server. */
export async function turnAlertsOff(): Promise<void> {
  store()?.removeItem(ON_KEY)
  store()?.removeItem(REGISTERED_KEY)
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    // Best effort. A row left behind points at an endpoint that no longer
    // exists, and the sender deletes it the first time the push service says so.
    await supabase?.from('push_subscription').delete().eq('endpoint', endpoint)
  } catch (e) {
    note(`turning alerts off — ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Keep this install's row saying the right thing: which baby, which clock.
 *
 * Run after every successful sync. It is cheap when nothing changed, and it is
 * what carries a baby switch (D-060), a clock-format change, a row that could
 * not be written while offline, or a push service that rotated the endpoint.
 */
export async function refreshSubscription(): Promise<void> {
  if (store()?.getItem(ON_KEY) !== '1') return
  const babyId = getBabyId()
  if (!supabase || !babyId || !('serviceWorker' in navigator)) return

  // Permission withdrawn in the phone's settings: the switch is off now,
  // whatever this install last believed.
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    store()?.removeItem(ON_KEY)
    store()?.removeItem(REGISTERED_KEY)
    return
  }

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) {
    store()?.removeItem(ON_KEY)
    store()?.removeItem(REGISTERED_KEY)
    return
  }
  const keys = sub.toJSON().keys ?? {}
  if (!keys.p256dh || !keys.auth) return

  const row = {
    endpoint: sub.endpoint,
    baby_id: babyId,
    p256dh: keys.p256dh,
    auth: keys.auth,
    clock: timeFormat(),
    // Who a love note is addressed to, and whose day it counts in (D-070).
    caregiver_id: getCaregiverId(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    love: loveOn(),
    updated_at: new Date().toISOString(),
  }
  const fingerprint =
    `${row.endpoint}|${row.baby_id}|${row.clock}|${row.caregiver_id}|${row.tz}|${row.love}`
  if (store()?.getItem(REGISTERED_KEY) === fingerprint) return

  const { error } = await supabase.from('push_subscription').upsert(row)
  if (error) {
    note(`alert subscription not saved — ${error.message}`)
    return
  }
  store()?.setItem(REGISTERED_KEY, fingerprint)
}

/**
 * Love notes from Liana (D-070) — this install's switch.
 *
 * On unless switched off: they only ever reach a device that has already turned
 * alerts on and allowed notifications, so the opt-in has happened. The switch is
 * the way out, and it goes to the server on the next sync like everything else
 * on the subscription row.
 */
export const loveOn = (): boolean => store()?.getItem(LOVE_KEY) !== '0'

export async function setLove(on: boolean): Promise<void> {
  store()?.setItem(LOVE_KEY, on ? '1' : '0')
  await refreshSubscription()
}

/** Both jobs, in the order that matters least. Called after a successful sync. */
export async function afterSync(): Promise<void> {
  try {
    await publishFeedAlert()
    await refreshSubscription()
  } catch (e) {
    note(`feed alert — ${e instanceof Error ? e.message : String(e)}`)
  }
}
