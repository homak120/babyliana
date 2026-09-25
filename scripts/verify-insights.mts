// The insights screen turns a week of moments into figures somebody may act on,
// so the arithmetic is worth checking directly rather than by looking at bars.
//
// The watch-list rules get the most attention here. They are the part that
// asserts something about the baby rather than merely counting, which D-032
// allowed deliberately and narrowly — a rule that fires on the wrong day, or
// silently stops firing, is the failure that matters.
import {
  ALL_TIME, buildInsights, hm, lastDays, monthOf, monthsWithData, sameSpan, sourceSplit,
  type Span,
} from '../src/report/insights.ts'
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
  poop_colour: null, poop_consistency: null, pounds: null, fahrenheit: null,
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

const build = (ms: Moment[], span: Span = lastDays(7)) => buildInsights(ms, span, NOW)

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
  at(10, 0, 30, [feed(60)])], lastDays(7), earlyNow)
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
check('a 3h+ gap raises a flag', g.flags.some((f) => f.key === 'gap'))
check('the gap flag names the duration and the day',
  g.flags.some((f) => f.text === '5h 30m between feeds on 9/6'),
  JSON.stringify(g.flags.map((f) => f.text)))

// The threshold matches the mascot's hungry line at 180 minutes, so a feed
// every three hours on the dot does flag. Only a tighter rhythm stays quiet.
const tightDay = [at(6, 8, 0, [feed()]), at(6, 10, 30, [feed()]), at(6, 13, 0, [feed()])]
check('a 2h 30m rhythm raises no gap flag',
  !build(tightDay).flags.some((f) => f.key === 'gap'))
const onTheLine = [at(6, 8, 0, [feed()]), at(6, 11, 0, [feed()])]
check('a gap of exactly three hours does flag',
  build(onTheLine).flags.some((f) => f.key === 'gap'))

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

// --- the rhythm track (D-064) ------------------------------------------------

const trackDay = build([
  at(9, 3, 0, [feed()]),
  at(9, 7, 0, [pee()]),
  at(9, 11, 30, [poop()]),
])
const row = trackDay.track.find((r) => r.label === '9/9')!
const markAt = (pct: number) => row.marks.find((m) => Math.abs(m.at - pct) < 0.01)

// Position by the minute, not by the hour. 03:00 is 12.5% of the way through
// the day; 11:30 is 47.9166…% — which an hour grid could not tell from 11:05.
check('a feed is placed at the minute it happened',
  markAt(12.5)?.kind === 'feed', JSON.stringify(row.marks))
check('a change takes its own position too',
  markAt((7 / 24) * 100)?.kind === 'pee', JSON.stringify(row.marks))
check('and half past eleven is not eleven',
  markAt((11.5 / 24) * 100)?.kind === 'poop', JSON.stringify(row.marks))
check('two feeds 45 minutes apart are two marks, not one cell',
  build([at(9, 23, 5, [feed()]), at(9, 23, 50, [feed()])]).track[0].marks.length === 2)

// The fault this chart was rebuilt to fix: sleep was last in a priority order,
// so an hour with a feed in it painted over three hours of sleep.
const busy = build([
  at(9, 5, 0, [feed(), poop(), pee()]),
  at(9, 4, 0, [sleep()], new Date(2026, 8, 9, 7, 0)),
])
check('a feed no longer hides the sleep it happened during',
  busy.track[0].sleeps.length === 1 && busy.track[0].marks.some((m) => m.kind === 'feed'),
  JSON.stringify(busy.track[0]))
// A change is one tick and takes the name of the rarer half. The old priority
// rule survives only here, where the two really are the same event.
check('a change with both is one mark, named for the poop',
  busy.track[0].marks.filter((m) => m.kind !== 'feed').length === 1
  && busy.track[0].marks.some((m) => m.kind === 'poop'),
  JSON.stringify(busy.track[0].marks))
// A split feed is one thing that happened at one time (D-019).
check('a split feed is one mark, not two at the same spot',
  build([at(9, 5, 0, [feed(30), feed(30)])]).track[0].marks.length === 1)

// A sleep crossing midnight has to draw on both days, or a night's sleep
// disappears from the one chart meant to show it.
const overnight = build([
  at(8, 22, 0, [sleep()], new Date(2026, 8, 9, 2, 0)),
  at(9, 12, 0, [feed()]),
])
const night8 = overnight.track.find((r) => r.label === '9/8')!
const night9 = overnight.track.find((r) => r.label === '9/9')!
check('a sleep crossing midnight runs to the end of the evening it started',
  night8.sleeps[0].from === (22 / 24) * 100 && night8.sleeps[0].to === 100,
  JSON.stringify(night8.sleeps))
check('and from midnight on the morning it ended',
  night9.sleeps[0].from === 0 && night9.sleeps[0].to === (2 / 24) * 100,
  JSON.stringify(night9.sleeps))
check('and nowhere else', night8.sleeps.length === 1 && night9.sleeps.length === 1)

// --- the average day --------------------------------------------------------

const usualDays = build([
  at(7, 2, 0, [feed()]), at(7, 2, 40, [feed()]), at(7, 9, 0, [feed()]),
  at(8, 2, 10, [feed()]), at(8, 14, 0, [feed()]),
  at(9, 2, 30, [feed()]),
])
check('the usual row counts feeds by hour across the span',
  usualDays.usual[2] === 4, String(usualDays.usual[2]))
check('an hour nobody feeds in stays at zero', usualDays.usual[5] === 0)
check('and the row scales against its own busiest hour',
  usualDays.usualMax === 4, String(usualDays.usualMax))
check('an empty log still scales against one, never zero', build([]).usualMax === 1)

// --- the longest stretch ----------------------------------------------------

// Runs across midnight, which is where the stretch anybody cares about
// happens — and is why it is not the same figure as maxFeedGap, which D-032's
// watch rule counts inside one day.
const stretch = build([
  at(8, 20, 0, [feed()]),
  at(9, 4, 30, [feed()]),
  at(9, 7, 0, [feed()]),
])
check('the longest stretch crosses midnight',
  stretch.longestStretch?.mins === 510, String(stretch.longestStretch?.mins))
check('and says when it started',
  new Date(stretch.longestStretch!.fromIso).getHours() === 20,
  String(stretch.longestStretch?.fromIso))
check('while the in-a-day figure the flag counts stays what it was',
  stretch.worstGapMins === 150, String(stretch.worstGapMins))
check('one feed is not a stretch', build([at(9, 8, 0, [feed()])]).longestStretch === null)

// --- growth -----------------------------------------------------------------

const weighed = build([
  at(8, 9, 0, [ev({ type: 'weight', note: '3.42 kg' })]),
  at(9, 9, 0, [ev({ type: 'weight', note: 'forgot the scale' })]),
])
check('a weight with a number is listed', weighed.weights.length === 1, String(weighed.weights.length))
check('a weight note with no number is not', weighed.weights[0].text === '3.42 kg')
check('the growth card is absent when nothing is weighed', build(naps).weights.length === 0)

// --- span -------------------------------------------------------------------

check('the 3d span keeps three days', build(week, lastDays(3)).days.length === 3)
check('the 3d span keeps the most recent three',
  build(week, lastDays(3)).days[2].isToday === true)

// --- the longer spans and the months (D-063) --------------------------------

check('15d and 30d reach further back than the log goes',
  build(week, lastDays(15)).days.length === 7 && build(week, lastDays(30)).days.length === 7,
  `${build(week, lastDays(15)).days.length}/${build(week, lastDays(30)).days.length}`)
check('all time is every day there is', build(week, ALL_TIME).days.length === 7)

// A month is a calendar month, not a count of days — the whole reason a span is
// a shape rather than a number.
const acrossMonths = [
  at(1, 8, 0, [feed(60)]),   // 9/1
  at(3, 8, 0, [feed(60)]),
  ...week,
]
const sept = build(acrossMonths, monthOf('2026-09'))
check('a month keeps only its own days',
  sept.days.every((d) => d.iso.startsWith('2026-09')) && sept.days.length === 9,
  String(sept.days.length))
check('and an empty month is empty rather than wrong',
  build(acrossMonths, monthOf('2026-08')).days.length === 0)

const months = monthsWithData(acrossMonths, NOW)
check('the months offered are the ones with entries in them',
  months.length === 1 && months[0].ym === '2026-09' && months[0].label === 'Sep',
  JSON.stringify(months))
// Newest first, and the year shows only once it stops being this one.
const older: Moment[] = [{
  timeslot: {
    id: 'old', baby_id: 'b', logged_by: 'd',
    occurred_at: new Date(2025, 11, 4, 8, 0).toISOString(), ended_at: null,
    recorded_at: '', updated_at: '', updated_by: null, note: null,
  },
  events: [feed(60)],
}]
const mixedMonths = monthsWithData([...older, ...acrossMonths], NOW)
check('older years say which year they are',
  mixedMonths.map((m) => m.label).join(',') === "Sep,Dec '25",
  JSON.stringify(mixedMonths.map((m) => m.label)))

check('a span knows itself', sameSpan(lastDays(7), lastDays(7)) && sameSpan(ALL_TIME, ALL_TIME))
check('and knows the ones it is not',
  !sameSpan(lastDays(7), lastDays(3)) && !sameSpan(monthOf('2026-09'), monthOf('2026-08'))
  && !sameSpan(lastDays(30), ALL_TIME))

// --- the three charts (D-049) -----------------------------------------------

const sourced = (ml: number, source: LogEvent['source']) =>
  ev({ type: 'feed', volume_ml: ml, source })

const mixedDay = build([
  at(9, 8, 0, [sourced(60, 'breast_milk')]),
  at(9, 11, 0, [sourced(45, 'formula')]),
  at(9, 14, 0, [feed(30)]),          // `unknown` — a source nobody wrote down
  at(9, 17, 0, [ev({ type: 'feed', volume_ml: 25, source: null })]),
])
const d0 = mixedDay.days[0]
check('milk splits by source', d0.mlBreast === 60 && d0.mlFormula === 45)
check('an unmarked source is its own band, not a discard', d0.mlUnmarked === 55)
// The bands are a decomposition, so they must add back up — a chart whose parts
// do not sum to its total is a lie about the day.
check('and the three bands add up to the day', d0.mlBreast + d0.mlFormula + d0.mlUnmarked === d0.ml)
check('the unmarked total is carried for the caption', mixedDay.mlUnmarked === 55)

// --- a day's own breakdown (D-062) ------------------------------------------

const split = sourceSplit(d0)
check('the split names every band that has milk in it',
  split.map((r) => r.key).join(',') === 'breast,formula,unmarked',
  JSON.stringify(split.map((r) => r.key)))
check('and carries the millilitres unrounded',
  split.map((r) => r.ml).join(',') === '60,45,55', JSON.stringify(split.map((r) => r.ml)))
// 60/160, 45/160, 55/160 is 37.5, 28.125, 34.375 — two of the three round up on
// their own, which is exactly the case that would print 101%.
check('the percentages add to exactly 100',
  split.reduce((a, r) => a + r.pct, 0) === 100, JSON.stringify(split.map((r) => r.pct)))
check('and the leftover goes to the largest remainder',
  split.map((r) => r.pct).join(',') === '38,28,34', JSON.stringify(split.map((r) => r.pct)))

// Thirds are the case that cannot come out even: 33 + 33 + 33 is 99.
const thirds = build([
  at(9, 8, 0, [sourced(50, 'breast_milk')]),
  at(9, 11, 0, [sourced(50, 'formula')]),
  at(9, 14, 0, [feed(50)]),
])
const three = sourceSplit(thirds.days[0])
check('three equal bands still add to 100',
  three.reduce((a, r) => a + r.pct, 0) === 100, JSON.stringify(three.map((r) => r.pct)))

const oneSource = build([at(9, 8, 0, [sourced(90, 'formula')])])
const only = sourceSplit(oneSource.days[0])
check('a band with nothing in it is dropped, not printed as zero',
  only.length === 1 && only[0].key === 'formula' && only[0].pct === 100,
  JSON.stringify(only))

// A `?` feed is in the count and not in the volume — the paper log's own
// distinction between an empty cell and a mark (paper-log-baseline.md).
const unknownVol = build([
  at(9, 8, 0, [sourced(60, 'breast_milk')]),
  at(9, 11, 0, [feed(null)]),
])
const uv = unknownVol.days[0]
check('a feed with no volume is counted', uv.feeds === 2 && uv.feedsNoVolume === 1,
  `${uv.feeds}/${uv.feedsNoVolume}`)
check('and adds nothing to the day, or to the split',
  uv.ml === 60 && sourceSplit(uv).length === 1 && sourceSplit(uv)[0].pct === 100)
check('a day with no milk at all has no split',
  sourceSplit(build([at(9, 8, 0, [pee()])]).days[0]).length === 0)

const diaperDays = build([
  at(9, 8, 0, [pee()]), at(9, 9, 0, [pee()]), at(9, 10, 0, [poop()]),
  at(10, 8, 0, [pee()]),
])
// A stacked bar scales against the tallest *total*, not the tallest part.
check('the diaper scale is the tallest day\'s total', diaperDays.maxDiapers === 3)
check('and both parts are counted across the span',
  diaperDays.peeTotal === 3 && diaperDays.poopTotal === 1)
check('an empty span still scales against one, never zero', build([]).maxDiapers === 1)

const coloured = build([
  at(9, 8, 0, [poop('yellow')]), at(9, 9, 0, [poop('green')]),
  at(9, 10, 0, [poop('yellow')]), at(9, 11, 0, [poop(null)]),
  at(10, 8, 0, [pee()]),
])
check('colours are tallied commonest first',
  coloured.colours[0].name === 'yellow' && coloured.colours[0].count === 2,
  JSON.stringify(coloured.colours))
// "not written down" is not a colour called "other" — the paper log's own
// distinction between an empty cell and a mark.
check('an unrecorded colour is counted as its own row',
  coloured.colours.some((c) => c.name === 'not noted' && c.count === 1),
  JSON.stringify(coloured.colours))
check('a wet-only change is not in the tally at all',
  coloured.colours.reduce((a, c) => a + c.count, 0) === 4)
check('and no poops means no rows to draw', build([at(9, 8, 0, [pee()])]).colours.length === 0)

// --- nothing at all ---------------------------------------------------------

const empty = build([])
check('an empty log produces no days', empty.days.length === 0)
check('an empty log raises no flags', empty.flags.length === 0)
check('an empty log has no projection', empty.paceMl === null)

console.log(failures === 0 ? '\nverify-insights: all checks pass' : `\nverify-insights: ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
