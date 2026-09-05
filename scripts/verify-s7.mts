// S7's done-when is "hold the phone next to the photograph and compare". This
// is that comparison, done against 8/27 from the real log — the day with the
// most variety: a feed with no diaper, a diaper with no feed, poop colours, and
// a consistency.
//
// Paper, as written:
//   8/27  01:39  43
//         04:30  50
//         05:50  41   1
//         08:20  46   2 (olive)
//         11:39  40   2 (yellow)
//         14:17       1
//         14:40  50   2 (G→Y liquid)
//         17:45  60   1
//         20:24       1
//         21:01  55
import type { Moment } from '../src/types.ts'
import {
  chronological, dateCell, daysWithEntries, diaperCell, initialOf, milkCell, otherCell, timeCell,
} from '../src/day/cells.ts'
import { ongoingSleep, sleepDuration } from '../src/derive.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

let n = 0
const ev = (e: Partial<Moment['events'][number]>) => ({
  id: `e${n++}`, timeslot_id: 't', type: 'feed', note: null,
  recorded_at: '', updated_at: '', updated_by: null,
  volume_ml: null, source: null, pee: null, poop: null,
  poop_colour: null, poop_consistency: null, grams: null, celsius: null,
  supplement_name: null, amount: null, severity: null, ...e,
}) as Moment['events'][number]

const at = (h: number, m: number, day = 27) =>
  new Date(2026, 7, day, h, m).toISOString()

const mom = (occurred: string, events: Moment['events'], note: string | null = null): Moment => ({
  timeslot: {
    id: `t${n++}`, baby_id: 'b', logged_by: 'dev', occurred_at: occurred,
    ended_at: null, recorded_at: occurred, updated_at: occurred, updated_by: null, note,
  },
  events,
})

const feed = (v: number | null, src: string | null = null) =>
  ev({ type: 'feed', volume_ml: v, source: src as never })
const diaper = (o: Partial<Moment['events'][number]>) => ev({ type: 'diaper', ...o })

const day = chronological([
  mom(at(1, 39), [feed(43)]),
  mom(at(4, 30), [feed(50)]),
  mom(at(5, 50), [feed(41), diaper({ pee: true })]),
  mom(at(8, 20), [feed(46), diaper({ poop: true, poop_colour: 'other' })], 'olive'),
  mom(at(11, 39), [feed(40), diaper({ poop: true, poop_colour: 'yellow' })]),
  mom(at(14, 17), [diaper({ pee: true })]),
  mom(at(14, 40), [feed(50), diaper({ poop: true, poop_colour: 'green', poop_consistency: 'liquid' })], 'green→yellow'),
  mom(at(17, 45), [feed(60), diaper({ pee: true })]),
  mom(at(20, 24), [diaper({ pee: true })]),
  mom(at(21, 1), [feed(55)]),
])

// --- the date column, which is the paper's own trick ------------------------
check('the date prints on the first row of the day', dateCell(day[0], undefined) === '8/27')
check('and is inherited by every row below it',
  day.slice(1).every((m, i) => dateCell(m, day[i]) === null))

const nextDay = mom(at(0, 10, 28), [feed(60)])
check('a new day prints its date again', dateCell(nextDay, day[9]) === '8/28')

// --- the milk column --------------------------------------------------------
check('a single volume prints bare', milkCell(day[0].events)!.parts.join(' + ') === '43')
check('a source is marked in brackets',
  milkCell([feed(45, 'breast_milk')])!.parts.join(' + ') === '45(B)')
check('a split feed joins with a plus, as the paper writes it',
  milkCell([feed(25, 'breast_milk'), feed(45, 'formula')])!.parts.join(' + ') === '25(B) + 45(F)')
check('an unlabelled split too',
  milkCell([feed(30), feed(30)])!.parts.join(' + ') === '30 + 30')
check('an unknown volume prints ? and is flagged for the accent colour',
  milkCell([feed(null)])!.parts[0] === '?' && milkCell([feed(null)])!.unknown)

// the distinction the whole model turns on
check('NO feed is null, not an empty string — a blank cell and a ? differ',
  milkCell(day[5].events) === null)
check('and a ? is not null', milkCell([feed(null)]) !== null)

// --- the pee/poop column ----------------------------------------------------
check('a pee', diaperCell(day[2].events) === 'pee')
check('a poop with colour', diaperCell(day[4].events) === 'poop (yellow)')
check('a colour of "other" prints nothing — the note carries what was written',
  diaperCell(day[3].events) === 'poop', String(diaperCell(day[3].events)))
check('a poop with colour and consistency',
  diaperCell(day[6].events) === 'poop (green liquid)', String(diaperCell(day[6].events)))
check('both in one change joins with a middot',
  diaperCell([diaper({ pee: true, poop: true })]) === 'pee · poop')
check('no change is null, like the milk column',
  diaperCell(day[0].events) === null)

// --- time and periods -------------------------------------------------------
check('an instant prints HH:MM', timeCell(day[0]) === '01:39')
const period: Moment = JSON.parse(JSON.stringify(day[0]))
period.timeslot.occurred_at = at(19, 0)
period.timeslot.ended_at = at(21, 30)
check('a period prints both ends', timeCell(period) === '19:00–21:30')

// --- the rest ---------------------------------------------------------------
// Sleep has its own cell now — it reads as a state, not as an event that
// happened, and takes its own icon.
check('the other cell carries the secondary types',
  otherCell([ev({ type: 'spit_up' })]) === 'spit up')
check('and leaves sleep alone', otherCell([ev({ type: 'sleep' })]) === null)

// --- sleep ------------------------------------------------------------------
const sleepy = (occurred: string, endedAt: string | null): Moment => {
  const m = mom(occurred, [ev({ type: 'sleep' })])
  m.timeslot.ended_at = endedAt
  return m
}
const t20 = at(20, 0), t22 = at(22, 30), t23 = at(23, 0)

check('an open sleep on the latest timeslot is running',
  ongoingSleep([sleepy(t20, null)], new Date(t23)) !== null)
check('a closed one is not', ongoingSleep([sleepy(t20, t22)], new Date(t23)) === null)

// The rule the owner stated: the *last* timeslot. Anything logged after a sleep
// means she woke, so an old open sleep must not read as still running — on the
// real log that showed a bar reporting "30h 58m".
check('a sleep with something logged after it is over',
  ongoingSleep([sleepy(t20, null), mom(t22, [feed(60)])], new Date(t23)) === null)
check('a sleep starting in the future is ignored',
  ongoingSleep([sleepy(at(23, 30), null)], new Date(t23)) === null)

check('a duration reads in hours and minutes', sleepDuration(t20, t22) === '2h 30m')
check('and drops the hours under one', sleepDuration(t20, at(20, 45)) === '45m')
check('the date strip lists each day once, newest first',
  daysWithEntries([...day, nextDay]).length === 2)
check('an unnamed device shows no initial rather than a UUID', initialOf(null) === null)
check('a named one shows its first letter', initialOf('mona') === 'M')

// --- the whole day, as a page ----------------------------------------------
const rendered = day.map((m, i) => [
  dateCell(m, day[i - 1]) ?? '', timeCell(m),
  milkCell(m.events)?.parts.join(' + ') ?? '', diaperCell(m.events) ?? '',
])
console.log('\n  8/27 as the app renders it:')
for (const r of rendered) {
  console.log(`    ${r[0].padEnd(5)} ${r[1].padEnd(6)} ${r[2].padEnd(7)} ${r[3]}`)
}
check('every row on the page carries something',
  rendered.every((r) => r[2] !== '' || r[3] !== ''))

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
