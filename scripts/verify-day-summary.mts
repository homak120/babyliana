// The read-back's page summary. Bubbles, checked as what they say.
//
// It exists because the four-figure tag row above it was all a page said, so a
// day carrying a weight, a temperature, three supplements and four notes read
// as identical to a day carrying none of them. Every bubble here is something
// that used to be invisible until the table was scrolled — which is why the
// checks are about what is *said*, not about what is counted.
//
// The other half of the contract is that it never repeats the tag row: the
// total and the feed count are already up there, so a group that would only
// have said them again must be absent.
import { summarise } from '../src/day/summary.ts'
import type { LogEvent, Moment } from '../src/types.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

let seq = 0
const ev = (e: Partial<LogEvent> & { type: LogEvent['type'] }): LogEvent => ({
  id: `e${seq++}`, timeslot_id: 't', note: null,
  recorded_at: '', updated_at: '', updated_by: null,
  volume_ml: null, source: null, pee: null, poop: null,
  poop_colour: null, poop_consistency: null, pounds: null, fahrenheit: null,
  supplement_name: null, amount: null, severity: null,
  ...e,
})

const at = (day: number, h: number, m: number, events: LogEvent[], endedAt?: Date, note?: string): Moment => ({
  timeslot: {
    id: `t${seq++}`, baby_id: 'b', logged_by: 'd',
    occurred_at: new Date(2026, 8, day, h, m).toISOString(),
    ended_at: endedAt ? endedAt.toISOString() : null,
    recorded_at: '', updated_at: '', updated_by: null, note: note ?? null,
  },
  events,
})

const feed = (ml: number | null, source: LogEvent['source'] = null) =>
  ev({ type: 'feed', volume_ml: ml, source })
const diaper = (pee: boolean, poop: boolean, colour: LogEvent['poop_colour'] = null) =>
  ev({ type: 'diaper', pee, poop, poop_colour: colour })

/** What the row under `key` says, flattened, or null when there is no such row. */
const line = (ms: Moment[], key: string) => {
  const g = summarise(ms).find((x) => x.key === key)
  return g ? g.bubbles.map((b) => b.text).join(' · ') : null
}
/** Every row, for a failure message worth reading. */
const all = (ms: Moment[]) =>
  summarise(ms).map((g) => `${g.key} ${g.bubbles.map((b) => b.text).join(' · ')}`).join(' | ')
/** The tone on one bubble, which is how a kind is told from another at a glance. */
const toneOf = (ms: Moment[], key: string, text: string) =>
  summarise(ms).find((g) => g.key === key)?.bubbles.find((b) => b.text === text)?.tone ?? null

// --- a full day -------------------------------------------------------------

const day = [
  at(24, 2, 0, [feed(60, 'breast_milk'), diaper(true, false)]),
  at(24, 5, 10, [feed(45, 'formula')]),
  at(24, 8, 20, [feed(50), diaper(true, true, 'yellow')]),
  at(24, 11, 0, [feed(null)]),
  at(24, 13, 0, [diaper(true, true, 'green')]),
  at(24, 20, 0, [ev({ type: 'sleep' })], new Date(2026, 8, 24, 23, 5)),
  at(24, 23, 30, [ev({ type: 'weight', pounds: 7.25 })], undefined, 'after the bath'),
  at(24, 23, 40, [ev({ type: 'temperature', fahrenheit: 98.6 })]),
  at(24, 23, 50, [ev({ type: 'supplement', supplement_name: 'vitamin D', amount: '1 drop' })]),
]

// D-034 retired the (B)/(F) codes for the unit and the word; the summary is not
// the place they come back.
check('the milk row is the split and the rhythm, in words not codes',
  line(day, 'milk') === '60 breast · 45 formula · 50 not marked · longest gap 3h 10m',
  String(line(day, 'milk')))
// The total and the feed count are the tag row's job. Saying them again here is
// the duplication this row was rebuilt to remove.
check('and it never repeats the tag row',
  !String(line(day, 'milk')).includes('155'), String(line(day, 'milk')))
check('breast and formula carry the colours they already have elsewhere',
  toneOf(day, 'milk', '60 breast') === 'lilac' && toneOf(day, 'milk', '45 formula') === 'amber',
  `${toneOf(day, 'milk', '60 breast')}/${toneOf(day, 'milk', '45 formula')}`)
check('the colours recorded get a row of their own',
  line(day, 'poop') === 'yellow · green', String(line(day, 'poop')))
check('sleep is totalled and counted',
  line(day, 'sleep') === '3h 5m · 1 sleep', String(line(day, 'sleep')))
check('and everything else is a bubble carrying its value alone',
  line(day, 'also') === '7 lb 4 oz · 98.6°F · vitamin D 1 drop · 1 note',
  String(line(day, 'also')))
// The type word is the icon's job now — "weight 7 lb 4 oz" says it twice.
check('each of those names its own icon',
  summarise(day).find((g) => g.key === 'also')!.bubbles
    .filter((b) => b.icon).length === 4,
  all(day))

// --- what is absent says nothing -------------------------------------------

// One unmarked feed is entirely described by the tag row, so there is nothing
// for this block to add and it is absent rather than empty.
const oneFeed = [at(24, 8, 0, [feed(60)])]
check('a page the tag row already describes adds nothing',
  summarise(oneFeed).length === 0, all(oneFeed))
const unmarked = [at(24, 8, 0, [feed(60)]), at(24, 11, 0, [feed(60)])]
check('an all-unmarked page does not say "not marked" at all',
  !all(unmarked).includes('not marked'), all(unmarked))
check('an empty page says nothing at all', summarise([]).length === 0)

// --- a running sleep --------------------------------------------------------

// An open sleep has no length yet. Counting it would make the total climb on
// its own while nothing was logged.
const running = [
  at(24, 9, 0, [ev({ type: 'sleep' })], new Date(2026, 8, 24, 10, 0)),
  at(24, 21, 0, [ev({ type: 'sleep' })]),
]
check('an open sleep is named, not measured',
  line(running, 'sleep') === '1h · 1 sleep · 1 still running', String(line(running, 'sleep')))

// --- more than one day ------------------------------------------------------

// The same component draws "all days" and a picked period, so the summary has
// to survive being handed six days at once.
const week = [
  at(22, 8, 0, [feed(100, 'formula')]),
  at(23, 8, 0, [feed(100, 'formula')]),
  at(24, 8, 0, [feed(100, 'formula')]),
]
check('a range says what a day of it averages',
  line(week, 'milk') === 'all formula · 100 mL a day', String(line(week, 'milk')))
// One source for the whole page is one bubble, not three saying the same thing.
check('a single-source page says it once',
  toneOf(week, 'milk', 'all formula') === 'amber', all(week))
// Across days the widest gap between feeds is the night, every time. That is
// not news, so it is not printed.
check('and no gap is claimed across days',
  !all(week).includes('longest gap'), all(week))

console.log(failures === 0 ? '\nverify-day-summary: all checks pass' : `\nverify-day-summary: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
