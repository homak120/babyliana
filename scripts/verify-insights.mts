// The insights screen turns a week of moments into figures somebody may act on,
// so the arithmetic is worth checking directly rather than by looking at bars.
//
// The watch-list rules get the most attention here. They are the part that
// asserts something about the baby rather than merely counting, which D-032
// allowed deliberately and narrowly — a rule that fires on the wrong day, or
// silently stops firing, is the failure that matters.
import { buildInsights, hm, type Span } from '../src/report/insights.ts'
import type { LogEvent, Moment } from '../src/types.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// --- fixtures ---------------------------------------------------------------

let seq = 0
const ev = (e: Partial<LogEvent> & { type: LogEvent['type'] }): LogEvent => ({
  id: `e${seq++}`, timeslot_id: 't', note: null,
  recorded_at: '', updated_at: '', updated_by: null,
  volume_ml: null, source: null, pee: null, poop: null,
  poop_colour: null, poop_consistency: null, grams: null, celsius: null,
  supplement_name: null, amount: null, severity: null,
  ...e,
})

/** A moment on 2026-09-<day> at local <h>:<m>. */
const at = (day: number, h: number, m: number, events: LogEvent[], endedAt?: Date): Moment => ({
  timeslot: {
    id: `t${seq++}`, baby_id: 'b', logged_by: 'd',
    occurred_at: new Date(2026, 8, day, h, m).toISOString(),
    ended_at: endedAt ? endedAt.toISOString() : null,
    recorded_at: '', updated_at: '', updated_by: null, note: null,
  },
  events,
})

const feed = (ml: number | null = 60) => ev({ type: 'feed', volume_ml: ml, source: 'unknown' })
const pee = () => ev({ type: 'diaper', pee: true, poop: false })
const poop = (colour: LogEvent['poop_colour'] = null) =>
  ev({ type: 'diaper', pee: false, poop: true, poop_colour: colour })
const sleep = () => ev({ type: 'sleep' })

// "Now" is fixed so the projection and the since-poop clock are deterministic.
const NOW = new Date(2026, 8, 10, 12, 0) // 9/10, midday — exactly half the day

const build = (ms: Moment[], span: Span = 7) => buildInsights(ms, span, NOW)

// --- hm ---------------------------------------------------------------------

check('hm drops trailing zero minutes', hm(120) === '2h', hm(120))
check('hm keeps minutes when there are some', hm(80) === '1h 20m', hm(80))
check('hm under an hour', hm(45) === '45m', hm(45))
check('hm has no answer for nothing', hm(null) === '—' && hm(0) === '—')

// --- day grouping and averages ---------------------------------------------

const week: Moment[] = []
for (let d = 4; d <= 9; d++) {
  // Six complete days, 8 feeds of 60 mL and 7 pees each.
  for (let i = 0; i < 8; i++) week.push(at(d, 2 + i * 2, 0, [feed(60)]))
  for (let i = 0; i < 7; i++) week.push(at(d, 3 + i * 2, 0, [pee()]))
}
// Today, half over, with 240 mL logged so far.
week.push(at(10, 2, 0, [feed(60)]), at(10, 5, 0, [feed(60)]),
          at(10, 8, 0, [feed(60)]), at(10, 11, 0, [feed(60)]))

const w = build(week)

check('averages use complete days only, not the half-finished one',
  w.avgMl === 480, String(w.avgMl))
check('today is identified as today', w.today !== null && w.today.isToday === true)
check('today shows what is actually logged so far', w.todayMl === 240, String(w.todayMl))
check('the span keeps only the last 7 days', w.days.length === 7, String(w.days.length))
check('feeds per day averages over complete days', w.avgFeeds === 8, String(w.avgFeeds))
check('average per feed divides the two averages', w.perFeedMl === 60, String(w.perFeedMl))

// At exactly midday the elapsed fraction is 0.5, so 240 mL projects to 480 —
// which is the average, so the delta is zero and no pace flag fires.
check('projection scales today by the fraction of the day elapsed',
  w.paceMl === 480, String(w.paceMl))
check('a projection in line with the average has a zero delta',
  w.paceDelta === 0, String(w.paceDelta))

// --- the 0.2 floor ----------------------------------------------------------

const earlyNow = new Date(2026, 8, 10, 1, 0) // 01:00 — 4.2% of the day
const early = buildInsights([...week.filter((m) => !m.timeslot.occurred_at.startsWith('2026-09-10')),
  at(10, 0, 30, [feed(60)])], 7, earlyNow)
// Without the floor, 60 mL at 01:00 would project to ~1440 mL.
check('the small hours cannot produce a runaway projection',
  early.paceMl === 300, String(early.paceMl))

// --- feed gaps --------------------------------------------------------------

const gapDay = [
  at(6, 8, 0, [feed()]),
  at(6, 13, 30, [feed()]), // 5h 30m gap
  at(6, 15, 0, [feed()]),
]
const g = build(gapDay)
check('the longest within-day feed gap is found',
  g.worstGapMins === 330, String(g.worstGapMins))
check('the gap is attributed to its own day', g.worstGapDay === '9/6', g.worstGapDay)
check('a 5h+ gap raises a flag', g.flags.some((f) => f.key === 'gap'))
check('the gap flag names the duration and the day',
  g.flags.some((f) => f.text === '5h 30m between feeds on 9/6'),
  JSON.stringify(g.flags.map((f) => f.text)))

const tightDay = [at(6, 8, 0, [feed()]), at(6, 11, 0, [feed()]), at(6, 14, 0, [feed()])]
check('a 3h rhythm raises no gap flag',
  !build(tightDay).flags.some((f) => f.key === 'gap'))

// --- the 6-a-day wet rule ---------------------------------------------------

const dryDay = [at(6, 8, 0, [feed()]), ...Array.from({ length: 4 }, (_, i) => at(6, 9 + i, 0, [pee()]))]
const dry = build(dryDay)
check('a complete day under 6 wet raises a flag',
  dry.flags.some((f) => f.text === '9/6: 4 wet diapers, below the 6-a-day mark'),
  JSON.stringify(dry.flags.map((f) => f.text)))

const wetDay = [at(6, 8, 0, [feed()]), ...Array.from({ length: 6 }, (_, i) => at(6, 9 + i, 0, [pee()]))]
check('exactly 6 wet is at the mark, not under it',
  !build(wetDay).flags.some((f) => f.key.startsWith('pee')))

// Today is still filling up; flagging it before it is over would fire every
// morning on every day.
const dryToday = [at(10, 8, 0, [pee()])]
check('today is never flagged for wet count',
  !build(dryToday).flags.some((f) => f.key.startsWith('pee')),
  JSON.stringify(build(dryToday).flags.map((f) => f.text)))

// --- since last poop --------------------------------------------------------

const poops = [at(9, 6, 0, [poop('yellow')]), at(8, 6, 0, [poop()])]
const p = build(poops)
check('since-poop measures from the most recent one, not the first',
  p.sincePoopMins === 30 * 60, String(p.sincePoopMins))
check('30h without a poop raises a flag',
  p.flags.some((f) => f.text === 'no poop for 30h'),
  JSON.stringify(p.flags.map((f) => f.text)))

const recentPoop = build([at(10, 6, 0, [poop()])])
check('a poop this morning raises nothing',
  !recentPoop.flags.some((f) => f.key === 'poop'))
check('exactly 24h does not fire; the rule is "more than"',
  !build([at(9, 12, 0, [poop()])]).flags.some((f) => f.key === 'poop'))

// --- the pace flag ----------------------------------------------------------

const slowToday = [
  ...week.filter((m) => !m.timeslot.occurred_at.startsWith('2026-09-10')),
  at(10, 8, 0, [feed(60)]), // 60 mL by midday projects to 120 against a 480 average
]
const slow = build(slowToday)
check('a day tracking well under average raises a flag',
  slow.flags.some((f) => f.text === 'today is tracking 75% under the 480 mL average'),
  JSON.stringify(slow.flags.map((f) => f.text)))

// --- sleep ------------------------------------------------------------------

const naps = [
  at(8, 13, 0, [sleep()], new Date(2026, 8, 8, 14, 30)), // 90m
  at(8, 20, 0, [sleep()], new Date(2026, 8, 8, 21, 30)), // 90m
  at(9, 13, 0, [sleep()], new Date(2026, 8, 9, 14, 0)),  // 60m
]
const s = build(naps)
check('sleep totals count every finished sleep', s.sleepCount === 3, String(s.sleepCount))
check('the longest stretch is the longest single sleep',
  s.longestSleepMins === 90, String(s.longestSleepMins))
check('sleep averages over complete days', s.avgSleepMins === 120, String(s.avgSleepMins))

// An open sleep has no length yet. Counting it would make the average climb on
// its own while nothing was being logged.
const openSleep = build([at(10, 9, 0, [sleep()])])
check('an open sleep contributes no duration', openSleep.avgSleepMins === 0)
check('an open sleep is not counted as a finished one', openSleep.sleepCount === 0)
check('a range with only an open sleep still reports none logged',
  openSleep.hasSleep === false)

// --- the heatmap ------------------------------------------------------------

const heatDay = build([
  at(9, 3, 0, [feed()]),
  at(9, 7, 0, [pee()]),
  at(9, 11, 0, [poop()]),
])
const row = heatDay.heat.find((r) => r.label === '9/9')!
check('a feed colours its hour', row.cells[3].kind === 'feed', String(row.cells[3].kind))
check('a pee colours its hour', row.cells[7].kind === 'pee', String(row.cells[7].kind))
check('a poop colours its hour', row.cells[11].kind === 'poop', String(row.cells[11].kind))
check('an empty hour stays empty', row.cells[0].kind === null)
check('a row is 24 hours wide', row.cells.length === 24, String(row.cells.length))

// Priority is feed > poop > pee > sleep, so an hour holding all of them is a
// feed and nothing else.
const busy = build([at(9, 5, 0, [feed(), poop(), pee(), sleep()])])
check('feed outranks everything else in one hour',
  busy.heat[0].cells[5].kind === 'feed', String(busy.heat[0].cells[5].kind))
const poopOverPee = build([at(9, 5, 0, [poop(), pee()])])
check('poop outranks pee', poopOverPee.heat[0].cells[5].kind === 'poop')

// A sleep crossing midnight has to colour both days, or a night's sleep
// disappears from the one chart meant to show it.
const overnight = build([
  at(8, 22, 0, [sleep()], new Date(2026, 8, 9, 2, 0)),
  at(9, 12, 0, [feed()]),
])
const night8 = overnight.heat.find((r) => r.label === '9/8')!
const night9 = overnight.heat.find((r) => r.label === '9/9')!
check('a sleep crossing midnight fills the evening it started',
  night8.cells[22].kind === 'sleep' && night8.cells[23].kind === 'sleep')
check('and the morning it ended',
  night9.cells[0].kind === 'sleep' && night9.cells[2].kind === 'sleep')
check('but not the hours after it ended', night9.cells[3].kind === null)

// --- growth -----------------------------------------------------------------

const weighed = build([
  at(8, 9, 0, [ev({ type: 'weight', note: '3.42 kg' })]),
  at(9, 9, 0, [ev({ type: 'weight', note: 'forgot the scale' })]),
])
check('a weight with a number is listed', weighed.weights.length === 1, String(weighed.weights.length))
check('a weight note with no number is not', weighed.weights[0].text === '3.42 kg')
check('the growth card is absent when nothing is weighed', build(naps).weights.length === 0)

// --- span -------------------------------------------------------------------

check('the 3d span keeps three days', build(week, 3).days.length === 3)
check('the 3d span keeps the most recent three',
  build(week, 3).days[2].isToday === true)

// --- nothing at all ---------------------------------------------------------

const empty = build([])
check('an empty log produces no days', empty.days.length === 0)
check('an empty log raises no flags', empty.flags.length === 0)
check('an empty log has no projection', empty.paceMl === null)

console.log(failures === 0 ? '\nverify-insights: all checks pass' : `\nverify-insights: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
