// The feed alert (D-069). Delivery is a phone test — a real push service, a real
// lock screen. What a script can check is the two things that would be silently
// wrong: that the alert time is the card's prompt time and nothing else, and
// that the built service worker actually carries the push handler.
import { readFileSync } from 'node:fs'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

const { feedAlertFor } = await import('../src/alerts.ts')
const { bottleDue, targetWake, lastFeedAt } = await import('../src/derive.ts')
const { write, resetSettings } = await import('../src/settings.ts')
import type { Moment } from '../src/types.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

let n = 0
const moment = (at: Date, type: 'feed' | 'diaper', endedAt: Date | null = at): Moment => {
  const id = `t${++n}`
  return {
    timeslot: {
      id, baby_id: 'b', logged_by: 'c', occurred_at: at.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : null,
      recorded_at: at.toISOString(), updated_at: at.toISOString(), updated_by: null, note: null,
    },
    events: [{ id: `e${n}`, timeslot_id: id, type, volume_ml: type === 'feed' ? 60 : null,
      source: type === 'feed' ? 'formula' : null } as never],
  } as Moment
}

const at = (h: number, m = 0) => { const d = new Date(2026, 9, 8, h, m); return d }
const mins = (iso: string | null, from: Date) =>
  iso === null ? null : Math.round((new Date(iso).getTime() - from.getTime()) / 60_000)

// --- silent when the card is silent ----------------------------------------
check('no feed logged — nothing is due', feedAlertFor([], at(12)).fire_at === null)
check('a diaper alone is not a feed', feedAlertFor([moment(at(11), 'diaper')], at(12)).fire_at === null)

const running = moment(at(11, 50), 'feed', null)
check('a feed still running — nothing is due, as the wake line hides',
  feedAlertFor([moment(at(8), 'feed'), running], at(12)).fire_at === null)

// --- the card's instant ------------------------------------------------------
const day = [moment(at(14), 'feed')]
const d = feedAlertFor(day, at(14, 30))
check('a day feed targets three hours on', mins(d.target_at, at(14)) === 180, String(d.target_at))
check('and alerts fifteen minutes before it', mins(d.fire_at, at(14)) === 165, String(d.fire_at))

const night = [moment(at(23), 'feed')]
check('a night feed targets four hours on', mins(feedAlertFor(night, at(23, 30)).target_at, at(23)) === 240)

// The whole claim of the spec: the alert fires exactly when the pill appears.
const target = targetWake(lastFeedAt(day))
const fire = new Date(d.fire_at!)
check('the pill is not up a minute before the alert', !bottleDue(target, new Date(fire.getTime() - 60_000)))
check('and is up at the alert', bottleDue(target, fire))

// --- it follows the shared settings ------------------------------------------
write('prepLeadMinutes', 30)
check('a longer lead moves the alert earlier',
  mins(feedAlertFor(day, at(14, 30)).fire_at, at(14)) === 150)
write('prepLeadMinutes', 0)
check('a zero lead alerts at the target', mins(feedAlertFor(day, at(14, 30)).fire_at, at(14)) === 180)
write('cycles', [
  { id: 'day', from: 360, to: 1320, gap: 150 },
  { id: 'night', from: 1320, to: 360, gap: 240 },
])
check('a shorter cycle moves the target', mins(feedAlertFor(day, at(14, 30)).target_at, at(14)) === 150)
store.clear()
resetSettings()

// --- the synced row wins over a cache that has not caught up -----------------
// Right after a pull the row can carry a lead the other phone just changed while
// this phone's cache still holds the old one. Publishing from the cache would
// overwrite the right time with the wrong one.
write('prepLeadMinutes', 15)
check('a lead on the synced row is used before the cache catches up',
  mins(feedAlertFor(day, at(14, 30), { prepLeadMinutes: 40 }).fire_at, at(14)) === 140)
check('and so is a cycle on the row',
  mins(feedAlertFor(day, at(14, 30), {
    cycles: [{ id: 'day', from: 360, to: 1320, gap: 120 }, { id: 'night', from: 1320, to: 360, gap: 240 }],
  }).target_at, at(14)) === 120)
check('a row with no lead leaves the local one standing',
  mins(feedAlertFor(day, at(14, 30), {}).fire_at, at(14)) === 165)
check('junk on the row is not read as an instruction',
  mins(feedAlertFor(day, at(14, 30), { prepLeadMinutes: -5 }).fire_at, at(14)) === 165)
store.clear()
resetSettings()

// --- logging a feed moves it -------------------------------------------------
const later = [...day, moment(at(16, 40), 'feed')]
check('a newer feed replaces the pending alert',
  mins(feedAlertFor(later, at(17)).fire_at, at(16, 40)) === 165)

// --- the built worker carries the handlers -----------------------------------
let sw = ''
try { sw = readFileSync('dist/sw.js', 'utf8') } catch { /* checked below */ }
check('the built service worker imports the push handler',
  sw.includes('push-sw.js'), sw ? 'importScripts missing' : 'dist/sw.js not found — run the build first')
let push = ''
try { push = readFileSync('dist/push-sw.js', 'utf8') } catch { /* checked below */ }
check('and the handler is deployed beside it',
  push.includes("addEventListener('push'") && push.includes("addEventListener('notificationclick'"))
check('its title is the card’s own words', push.includes("'make milk'"))

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
if (failures) process.exit(1)
