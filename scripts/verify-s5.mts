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
  endAgo, endNow, formatDuration, minutesAfter, minutesAgo, resolveEnd, stepFor,
  END_AGO_OFFSETS, END_OFFSETS,
  withHourMinute, wrapHour, wrapMinute, HOLD_ACCELERATE_AFTER,
  atHourMinute, countUp, dayDate, dayWord, daysBack, onDay, toMinute,
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

// Far enough ahead to only mean last night: at 08:00, 20:00 is twelve hours off.
const lastEvening = withHourMinute(20, 0, t(8, 0))
check('a time far ahead of now is read as yesterday',
  lastEvening.getDate() === 2, show(lastEvening))

// --- the end-time shortcuts (D-048) ------------------------------------------
check('two forward offsets, not five', END_OFFSETS.join(',') === '30,60', END_OFFSETS.join(','))
check('and three counted back from now', END_AGO_OFFSETS.join(',') === '5,10,15',
  END_AGO_OFFSETS.join(','))

// The ordinary case: a feed begun twenty minutes ago that finished five ago.
const began = new Date(2026, 8, 3, 15, 50)
const ago5 = endAgo(began, 5, t(16, 10))
check('"5 min ago" is five minutes before now, not before the start',
  ago5.getHours() === 16 && ago5.getMinutes() === 5, show(ago5))

// The trap: on a start of *now*, five minutes ago is behind it, and rolling it
// forward a day is exactly the fault D-047 removed.
const clamped = endAgo(t(16, 10), 5, t(16, 10))
check('and never lands before the start', clamped.getTime() === t(16, 10).getTime(), show(clamped))
check('so it reads as nothing elapsed, not as a day',
  formatDuration(t(16, 10), clamped) === '0 min', formatDuration(t(16, 10), clamped))

// And never past what the date arrows can express (D-046).
const capped = endAgo(new Date(2026, 7, 28, 9, 0), 5, t(16, 10))
check('nor more than a day after the start',
  capped.getDate() === 29 && capped.getMonth() === 7, show(capped))

// --- seconds, and the day they used to cost (D-047) --------------------------
// Nothing in this app shows a second, but `new Date()` carries them and every
// other route to a time zeroes them. "Now" then landed a few seconds before a
// start that was also now, which reads as crossing midnight.
const withSecs = new Date(2026, 8, 3, 16, 1, 37, 250)
check('a comparison drops the seconds', toMinute(withSecs).getSeconds() === 0
  && toMinute(withSecs).getMilliseconds() === 0, show(toMinute(withSecs)))
check('and keeps the minute it was in', toMinute(withSecs).getMinutes() === 1, show(toMinute(withSecs)))
// Stored instants keep theirs: they are what orders two moments logged in the
// same minute, and `ongoingFeed` asks which is latest. Truncating on the way in
// made that a coin toss, and took `verify-feed` and `verify-sleep` down.
check('but a stored instant keeps them', minutesAgo(20, withSecs).getSeconds() === 37,
  String(minutesAgo(20, withSecs).getSeconds()))

// The same minute is not "before": this is the comparison that used to push a
// whole entry into tomorrow.
const sameMin = resolveEnd(withSecs, new Date(2026, 8, 3, 16, 1, 0))
check('an end on the start\'s own minute stays on the day',
  sameMin.getDate() === 3, show(sameMin))
check('and one genuinely before it still crosses midnight',
  resolveEnd(withSecs, new Date(2026, 8, 3, 2, 0)).getDate() === 4,
  show(resolveEnd(withSecs, new Date(2026, 8, 3, 2, 0))))

const sameMinute = endNow(withSecs, new Date(2026, 8, 3, 16, 1, 50))
check('ending now on a start of now is the same minute, not the next day',
  sameMinute.getDate() === 3 && sameMinute.getHours() === 16 && sameMinute.getMinutes() === 1,
  show(sameMinute))

// The pill still means *now* where that is a real answer: a feed begun last
// night and ended this afternoon is sixteen hours, and says so.
const later = endNow(new Date(2026, 8, 2, 23, 30), new Date(2026, 8, 3, 16, 3))
check('but a backdated start still ends at the real clock time',
  later.getDate() === 3 && later.getHours() === 16, show(later))

// --- the making-milk count (D-045) ------------------------------------------
// Seconds while they are the thing moving, and not once they are not.
check('under a minute is seconds alone', countUp(41_000) === '41s', countUp(41_000))
check('zero is still a number', countUp(0) === '0s', countUp(0))
check('minutes carry padded seconds', countUp(250_000) === '4m 10s', countUp(250_000))
check('the minute rolls at sixty', countUp(60_000) === '1m 00s', countUp(60_000))
check('past an hour the seconds go', countUp(3_845_000) === '1h 04m', countUp(3_845_000))
check('a clock nudged backwards does not read negative',
  countUp(-5_000) === '0s', countUp(-5_000))

// --- the date field, which is what the inference above became a default for --
// (D-043)
const pinned = atHourMinute(23, 45, t(0, 30, 2))
check('an explicit day is not second-guessed — 23:45 on the 2nd stays there',
  pinned.getDate() === 2 && pinned.getHours() === 23, show(pinned))

// The date is always shown, never only the word (the date-fields handoff):
// "yesterday" alone asks the reader to know what today is, which at 4am is the
// thing they are least sure of.
check('today carries its date', dayWord(t(12, 0), t(15, 0)) === 'today · 09/03',
  dayWord(t(12, 0), t(15, 0)))
check('and so does the day before',
  dayWord(t(12, 0, 2), t(15, 0)) === 'yesterday · 09/02', dayWord(t(12, 0, 2), t(15, 0)))
check('further back takes a weekday instead of a word',
  dayWord(t(12, 0, 1), t(15, 0)) === 'Tue · 09/01', dayWord(t(12, 0, 1), t(15, 0)))
check('the date alone is padded, as the day separators print it',
  dayDate(t(12, 0, 1)) === '09/01', dayDate(t(12, 0, 1)))
check('days back counts whole days, not elapsed hours',
  daysBack(t(23, 59, 2), t(0, 1, 3)) === 1, String(daysBack(t(23, 59, 2), t(0, 1, 3))))

// Ten days back is the coverage run: the photographs start on 8/26.
const far = onDay(t(9, 0), null, -8)
check('stepping back reaches the photographed days',
  far.start.getMonth() === 7 && far.start.getDate() === 26 && far.start.getHours() === 9,
  show(far.start))

// The case a naive re-anchor breaks: a sleep that crosses midnight.
const night = onDay(t(23, 0, 2), t(7, 0, 3), -1)
check('a period crossing midnight keeps its length when the day moves',
  night.start.getDate() === 1 && night.end!.getDate() === 2
  && night.end!.getTime() - night.start.getTime() === 8 * 3_600_000,
  `${show(night.start)} → ${show(night.end!)}`)

const nudge = withHourMinute(8, 0, t(8, 0))
check('nudging to the current minute does not jump a day',
  nudge.getDate() === 3, show(nudge))

// The bug the owner hit: a sleep logged at 09:40, minute nudged twice, landed on
// yesterday. One minute of tolerance meant any forward correction moved the day.
const forward = withHourMinute(9, 42, t(9, 40))
check('nudging a couple of minutes forward stays on today',
  forward.getDate() === 3 && forward.getHours() === 9 && forward.getMinutes() === 42, show(forward))

const anHourOn = withHourMinute(9, 0, t(8, 0))
check('and so does an hour ahead — visible and fixable, unlike a 23-hour jump',
  anHourOn.getDate() === 3, show(anHourOn))

// The second bug: editing an older moment anchored to today, so changing its
// minute dragged it forward by however many days had passed.
const old = t(4, 10, 1)
const edited = withHourMinute(4, 15, t(9, 40), old)
check('editing an older moment keeps its own day',
  edited.getDate() === 1 && edited.getHours() === 4 && edited.getMinutes() === 15, show(edited))

const oldLate = withHourMinute(23, 30, t(9, 40), old)
check('and a late time on an older moment does not fall back a day either',
  oldLate.getDate() === 1 && oldLate.getHours() === 23, show(oldLate))

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

// --- "now" as an end time ---------------------------------------------------
// Adding an end time defaults to the clock, not to a guessed length, and the
// pill beside it says the same thing a second time for a feed that has run on.
const endedNow = endNow(t(19, 0), t(19, 25))
check('an end time added at 19:25 is 19:25, not a guess',
  endedNow.getDate() === 3 && formatDuration(t(19, 0), endedNow) === '25 min', show(endedNow))

const wokeAt = endNow(new Date(2026, 8, 2, 23, 0), t(7, 0))
check('ending a sleep begun last night at 23:00 lands on this morning',
  wokeAt.getDate() === 3 && wokeAt.getHours() === 7, show(wokeAt))

const oldMoment = endNow(new Date(2026, 7, 30, 21, 0), t(7, 0))
check('and a moment from days ago ends on its OWN day, not today',
  oldMoment.getMonth() === 7 && oldMoment.getDate() === 31 && oldMoment.getHours() === 7,
  show(oldMoment))

const ahead = endNow(t(19, 30), t(19, 25))
check('a start typed slightly ahead clamps rather than inventing a 23h period',
  ahead.getTime() === t(19, 30).getTime(), show(ahead))

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
const { createThisDevice, logMoment, getMoments } = await import('../src/moments.ts')
await createThisDevice('Test')

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
