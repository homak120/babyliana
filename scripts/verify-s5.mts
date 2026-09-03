// S5's done-when is a speed claim, which a script cannot measure. What it can
// check is that the arithmetic underneath is right — and the midnight cases are
// exactly the ones a tired person hits and would not notice going wrong.
import 'fake-indexeddb/auto'
const store = new Map<string, string>([['babyliana.device_id', '00000000-0000-4000-8000-0000000d0d0d']])
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

import {
  formatDuration, minutesAfter, minutesAgo, resolveEnd, stepFor,
  withHourMinute, wrapHour, wrapMinute, HOLD_ACCELERATE_AFTER,
} from '../src/log/time.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const t = (h: number, m = 0, day = 3) => new Date(2026, 8, day, h, m)
const show = (d: Date) => `${d.getDate()}th ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`

// --- the case the slice exists for -----------------------------------------
// standing in the kitchen at 08:00, logging the feed you gave at 04:10
const kitchen = withHourMinute(4, 10, t(8, 0))
check('backdating to 04:10 at 08:00 stays on today',
  kitchen.getDate() === 3 && kitchen.getHours() === 4 && kitchen.getMinutes() === 10, show(kitchen))

// --- midnight, which is when this is most likely to be used -----------------
const lastNight = withHourMinute(23, 45, t(0, 30))
check('typing 23:45 at 00:30 means LAST night, not tonight',
  lastNight.getDate() === 2 && lastNight.getHours() === 23, show(lastNight))

const soon = withHourMinute(9, 0, t(8, 0))
check('a time later today is read as yesterday — a moment cannot be in the future',
  soon.getDate() === 2, show(soon))

const nudge = withHourMinute(8, 0, t(8, 0))
check('nudging to the current minute does not jump a day',
  nudge.getDate() === 3, show(nudge))

const ago = minutesAgo(45, t(0, 20))
check('an offset across midnight goes to yesterday',
  ago.getDate() === 2 && ago.getHours() === 23 && ago.getMinutes() === 35, show(ago))

// --- periods ---------------------------------------------------------------
const sleepEnd = resolveEnd(t(19, 0), t(21, 30))
check('a 19:00–21:30 sleep is a same-day period',
  sleepEnd.getDate() === 3 && formatDuration(t(19, 0), sleepEnd) === '2h 30m',
  formatDuration(t(19, 0), sleepEnd))

const overnight = resolveEnd(t(23, 0), t(1, 30))
check('an end before its start crosses midnight rather than being rejected',
  overnight.getDate() === 4 && formatDuration(t(23, 0), overnight) === '2h 30m',
  `${show(overnight)} ${formatDuration(t(23,0), overnight)}`)

check('the database constraint would have refused that', t(1, 30) < t(23, 0))

check('duration under an hour reads in minutes',
  formatDuration(t(19, 0), minutesAfter(t(19, 0), 25)) === '25 min')
check('and over an hour reads in hours and minutes',
  formatDuration(t(19, 0), minutesAfter(t(19, 0), 65)) === '1h 05m',
  formatDuration(t(19, 0), minutesAfter(t(19, 0), 65)))

// --- steppers --------------------------------------------------------------
check('a stepper starts on single units', stepFor(0) === 1 && stepFor(13) === 1)
check('and accelerates to fives when held', stepFor(HOLD_ACCELERATE_AFTER) === 5)
check('hours wrap rather than stick', wrapHour(-1) === 23 && wrapHour(24) === 0)
check('minutes wrap too', wrapMinute(-1) === 59 && wrapMinute(60) === 0)

// --- does a period actually survive being stored? --------------------------
const { ensureThisDevice, logMoment, getMoments } = await import('../src/moments.ts')
await ensureThisDevice()

const sleep = await logMoment({
  occurredAt: t(19, 0),
  endedAt: resolveEnd(t(19, 0), t(21, 30)),
  entries: [{ type: 'sleep' }],
})
check('a sleep of 19:00–21:30 stores as a period', sleep.timeslot.ended_at !== null)

const back = (await getMoments()).find((x) => x.timeslot.id === sleep.timeslot.id)!
check('the period survives a reload',
  back.timeslot.ended_at === sleep.timeslot.ended_at)
check('and its duration reads back right',
  formatDuration(new Date(back.timeslot.occurred_at), new Date(back.timeslot.ended_at!)) === '2h 30m')

const point = await logMoment({ occurredAt: t(4, 10), entries: [{ type: 'feed', volume_ml: 60 }] })
check('a backdated instant stores with no end', point.timeslot.ended_at === null)
check('and keeps the time it was given',
  new Date(point.timeslot.occurred_at).getHours() === 4)

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
