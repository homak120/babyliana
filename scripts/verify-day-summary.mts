// The read-back's page summary. Strings, checked as strings.
//
// It exists because the four-figure tag row above it was all a page said, so a
// day carrying a weight, a temperature, three supplements and four notes read
// as identical to a day carrying none of them. Every line here is something
// that used to be invisible until the table was scrolled — which is why the
// checks are about what is *said*, not about what is counted.
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

/** The line under `key`, or null — a continuation is fetched by its position. */
const line = (ms: Moment[], key: string) => summarise(ms).find((l) => l.key === key)?.text ?? null
const all = (ms: Moment[]) => summarise(ms).map((l) => `${l.key ?? '·'} ${l.text}`).join(' | ')

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

check('the milk line leads with the volume and the count',
  line(day, 'milk') === '155 mL over 4 feeds · 1 with no volume', String(line(day, 'milk')))
// D-034 retired the (B)/(F) codes for the unit and the word; the summary is not
// the place they come back.
check('the sources are named in words, not in codes',
  summarise(day)[1].text === '60 breast · 45 formula · 50 not marked',
  summarise(day)[1].text)
check('and the widest gap inside the day is named',
  summarise(day)[2].text === 'longest gap 3h 10m', summarise(day)[2].text)
check('the diaper line counts both and names the colours',
  line(day, 'diaper') === '3 wet · 2 dirty (yellow, green)', String(line(day, 'diaper')))
check('sleep is totalled and counted',
  line(day, 'sleep') === '3h 5m over 1', String(line(day, 'sleep')))
check('and everything else gets a line of its own, notes included',
  line(day, 'also') === 'weight 7 lb 4 oz · temperature 98.6°F · supplement vitamin D 1 drop · 1 note',
  String(line(day, 'also')))

// --- what is absent says nothing -------------------------------------------

const oneFeed = [at(24, 8, 0, [feed(60)])]
check('a page with only feeds has only a milk line',
  summarise(oneFeed).length === 1 && summarise(oneFeed)[0].text === '60 mL over 1 feed',
  all(oneFeed))
const unmarked = [at(24, 8, 0, [feed(60)]), at(24, 11, 0, [feed(60)])]
check('an all-unmarked day does not say "not marked" twice',
  summarise(unmarked).every((l) => !l.text.includes('not marked')), all(unmarked))
check('an empty page says nothing at all', summarise([]).length === 0)

// --- a running sleep --------------------------------------------------------

// An open sleep has no length yet. Counting it would make the total climb on
// its own while nothing was logged.
const running = [
  at(24, 9, 0, [ev({ type: 'sleep' })], new Date(2026, 8, 24, 10, 0)),
  at(24, 21, 0, [ev({ type: 'sleep' })]),
]
check('an open sleep is named, not measured',
  line(running, 'sleep') === '1h over 1 · 1 still running', String(line(running, 'sleep')))

// --- more than one day ------------------------------------------------------

// The same component draws "all days" and a picked period, so the summary has
// to survive being handed six days at once.
const week = [
  at(22, 8, 0, [feed(100, 'formula')]),
  at(23, 8, 0, [feed(100, 'formula')]),
  at(24, 8, 0, [feed(100, 'formula')]),
]
check('a range says what a day of it averages',
  line(week, 'milk') === '300 mL over 3 feeds · all formula · 100 mL a day',
  String(line(week, 'milk')))
// One source for the whole page is said on the first line rather than repeated
// underneath it as its own figure.
check('a single-source page does not print the same number twice',
  summarise(week).length === 1, all(week))
// Across days the widest gap between feeds is the night, every time. That is
// not news, so it is not printed.
check('and no gap is claimed across days',
  !summarise(week).some((l) => l.text.startsWith('longest gap')), all(week))

console.log(failures === 0 ? '\nverify-day-summary: all checks pass' : `\nverify-day-summary: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
