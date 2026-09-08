// S3's done-when: the elapsed figure and the totals have to be right, since
// they are what the whole screen is for. Pure functions, no browser needed.
import type { Moment } from '../src/types.ts'
import {
  DEFAULT_CYCLES, cycleFor, feedTimeline, gapText, hydrateCycles, isDefaultCycles,
  isNightCycle, resetCycles, setCycles, upcomingFeeds,
} from '../src/cycles.ts'
import {
  bottleDue,
  feedKind,
  formatElapsed,
  lastFeedAt,
  mascotState,
  minutesSince,
  targetText,
  targetWake,
  themeFor,
  totalsFor,
} from '../src/derive.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const at = (h: number, m = 0, day = 3) => new Date(2026, 8, day, h, m).toISOString()

const moment = (
  occurred: string,
  events: Partial<Moment['events'][number]>[],
  ended: string | null = null,
): Moment => ({
  timeslot: {
    id: crypto.randomUUID(), baby_id: 'b', logged_by: 'd',
    occurred_at: occurred, ended_at: ended,
    recorded_at: occurred, updated_at: occurred, updated_by: null, note: null,
  },
  events: events.map((e) => ({
    id: crypto.randomUUID(), timeslot_id: 'x', type: 'feed', note: null,
    recorded_at: occurred, updated_at: occurred, updated_by: null,
    volume_ml: null, source: null, pee: null, poop: null,
    poop_colour: null, poop_consistency: null, pounds: null, fahrenheit: null,
    supplement_name: null, amount: null, severity: null, ...e,
  })) as Moment['events'],
})

const now = new Date(2026, 8, 3, 18, 0)

// --- elapsed ---------------------------------------------------------------
check('no feeds reads as an em dash', formatElapsed(minutesSince(lastFeedAt([]), now)) === '—')

const simple = [moment(at(15, 20), [{ type: 'feed', volume_ml: 60 }])]
check('elapsed from occurred_at',
  formatElapsed(minutesSince(lastFeedAt(simple), now)) === '2h 40m',
  formatElapsed(minutesSince(lastFeedAt(simple), now)))

// The rule that needed a decision, and was then reversed (D-040): a feed with
// an end time still measures from its START. Feeding is counted start to start,
// and this is the check that pins it — 15:00 to 18:00 is 3h, not the 1h 30m
// from the 16:30 end.
const period = [moment(at(15, 0), [{ type: 'feed', volume_ml: 60 }], at(16, 30))]
check('a period measures from occurred_at, not ended_at',
  formatElapsed(minutesSince(lastFeedAt(period), now)) === '3h 00m',
  formatElapsed(minutesSince(lastFeedAt(period), now)))

// Where the two orderings disagree: a top-up logged inside a long breast feed.
// The later start is the more recent feed, so the 12:30 one wins over the
// 12:00-13:00 one it sits inside.
const overlap = [
  moment(at(12, 0), [{ type: 'feed', volume_ml: 60 }], at(13, 0)),
  moment(at(12, 30), [{ type: 'feed', volume_ml: 20 }]),
]
check('the last feed is the one that started most recently',
  formatElapsed(minutesSince(lastFeedAt(overlap), now)) === '5h 30m',
  formatElapsed(minutesSince(lastFeedAt(overlap), now)))

check('under an hour drops the hours',
  formatElapsed(minutesSince(lastFeedAt([moment(at(17, 25), [{ type: 'feed' }])]), now)) === '35m')

// a diaper-only moment must not count as a feed
const diaperLater = [
  moment(at(15, 20), [{ type: 'feed', volume_ml: 60 }]),
  moment(at(17, 50), [{ type: 'diaper', pee: true }]),
]
check('a later diaper does not reset "since last feed"',
  formatElapsed(minutesSince(lastFeedAt(diaperLater), now)) === '2h 40m')

// --- totals ----------------------------------------------------------------
const day = [
  moment(at(8), [{ type: 'feed', volume_ml: 25, source: 'breast_milk' },
                 { type: 'feed', volume_ml: 45, source: 'formula' }]),
  moment(at(11), [{ type: 'feed', volume_ml: null }, { type: 'diaper', pee: true, poop: true }]),
  moment(at(13), [{ type: 'diaper', pee: true }]),
  moment(at(9, 0, 2), [{ type: 'feed', volume_ml: 999 }]), // yesterday
]
const t = totalsFor(day, now)
check('feeds counted per entry, not per moment', t.feeds === 3, String(t.feeds))
check('volumes summed', t.ml === 70, String(t.ml))
check('an unknown volume counts as a feed but adds no mL', t.unknownVolumes === 1 && t.ml === 70)
check('pee and poop counted separately', t.pee === 2 && t.poop === 1, `${t.pee}/${t.poop}`)
check('yesterday excluded — day boundary is midnight local', t.ml === 70)

// --- mascot ----------------------------------------------------------------
// The default kind is 'other' — formula, mixed, or a feed with no source on it.
check('settled under two hours', mascotState(60, 'day') === 'settled')
check('awake at two hours', mascotState(120, 'day') === 'awake')
check('hungry at 2h 30m', mascotState(150, 'day') === 'hungry')
check('awake just under it', mascotState(149, 'day') === 'awake')
check('sleeping at night overrides hungry', mascotState(300, 'night') === 'sleeping')
check('logged wins over everything for its moment', mascotState(300, 'day', true) === 'logged')
check('no feed yet is settled, not hungry', mascotState(null, 'day') === 'settled')

// Breast milk runs 30 minutes ahead on awake and 45 on hungry.
const br = (mins: number) => mascotState(mins, 'day', false, false, false, 'breast')
check('breast: settled under 90 minutes', br(89) === 'settled')
check('breast: awake at 90 minutes', br(90) === 'awake')
check('breast: hungry at 1h 45m', br(105) === 'hungry')
check('breast: still awake just under it', br(104) === 'awake')
// The two clocks are far enough apart that the same elapsed number lands two
// states apart in places: at 105 minutes breast is already hungry while formula
// has not even reached awake.
check('105 minutes is settled on formula and hungry on breast',
  mascotState(105, 'day') === 'settled' && br(105) === 'hungry')
check('and by two hours formula is only awake',
  mascotState(120, 'day') === 'awake' && br(120) === 'hungry')
check('breast is hungry across the whole of formula\'s awake band',
  [120, 135, 149].every((m) => br(m) === 'hungry' && mascotState(m, 'day') === 'awake'))
check('and they agree again once both are past their line',
  [150, 200].every((m) => br(m) === 'hungry' && mascotState(m, 'day') === 'hungry'))
check('night still overrides the breast clock too',
  mascotState(150, 'night', false, false, false, 'breast') === 'sleeping')

// --- what the last feed was ------------------------------------------------
const breastFeed = moment(at(15, 0), [{ type: 'feed', volume_ml: 60, source: 'breast_milk' }])
const formulaFeed = moment(at(15, 0), [{ type: 'feed', volume_ml: 60, source: 'formula' }])
const splitFeed = moment(at(15, 0), [
  { type: 'feed', volume_ml: 25, source: 'breast_milk' },
  { type: 'feed', volume_ml: 45, source: 'formula' },
])
const unmarkedFeed = moment(at(15, 0), [{ type: 'feed', volume_ml: 60 }])
const diaperOnly = moment(at(15, 0), [{ type: 'diaper', pee: true }])
check('an all-breast feed is breast', feedKind(breastFeed) === 'breast')
check('formula is other', feedKind(formulaFeed) === 'other')
check('a split feed with formula in it is other, not breast',
  feedKind(splitFeed) === 'other')
check('a feed with no source is other', feedKind(unmarkedFeed) === 'other')
check('a moment with no feed is other', feedKind(diaperOnly) === 'other')
check('nothing logged yet is other', feedKind(null) === 'other')
check('two breast parts in one moment are still breast',
  feedKind(moment(at(15, 0), [
    { type: 'feed', volume_ml: 25, source: 'breast_milk' },
    { type: 'feed', volume_ml: 20, source: 'breast_milk' },
  ])) === 'breast')
check('a breast feed alongside a diaper is still breast',
  feedKind(moment(at(15, 0), [
    { type: 'feed', volume_ml: 60, source: 'breast_milk' },
    { type: 'diaper', pee: true },
  ])) === 'breast')

// --- the target for the next feed -------------------------------------------
// A flat 3h, 4h overnight, and deliberately NOT the mascot's breast/formula
// split — the owner set it that way with the split in front of him.
const wake = (h: number, m = 0) => targetWake(new Date(2026, 8, 3, h, m))!
const hhmm_ = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

check('three hours in the daytime', hhmm_(wake(14)) === '17:00', hhmm_(wake(14)))
check('four hours from 22:00', hhmm_(wake(23)) === '03:00', hhmm_(wake(23)))
check('22:00 itself is already the night window', hhmm_(wake(22)) === '02:00')
check('21:59 is not', hhmm_(wake(21, 59)) === '00:59', hhmm_(wake(21, 59)))
check('05:59 is still the night window', hhmm_(wake(5, 59)) === '09:59', hhmm_(wake(5, 59)))
check('06:00 is back to three hours', hhmm_(wake(6)) === '09:00', hhmm_(wake(6)))
check('the window is judged on the feed, not on the target it produces',
  // 21:00 + 3h lands at midnight, inside the window — which must not then
  // make it a 4h target.
  hhmm_(wake(21)) === '00:00', hhmm_(wake(21)))
check('a night target crosses into the next day',
  wake(23).getDate() === 4, String(wake(23).getDate()))
check('no feed yet has no target', targetWake(null) === null)

const aim = new Date(2026, 8, 3, 17, 0)
// Worded as a ceiling, not an appointment: how much room is left, and how far
// past it once there is none. `past` rather than `over` or `late` — the line
// reports the clock and has no view about it.
check('how much room is left', targetText(aim, new Date(2026, 8, 3, 16, 20)) === '40m left',
  String(targetText(aim, new Date(2026, 8, 3, 16, 20))))
check('how far past once there is none',
  targetText(aim, new Date(2026, 8, 3, 18, 10)) === '1h 10m past',
  String(targetText(aim, new Date(2026, 8, 3, 18, 10))))
check('and on the minute', targetText(aim, aim) === 'now')
check('nothing to say without a target', targetText(null) === null)

// --- the cycle windows behind it (D-050) ------------------------------------
// The defaults reproduce exactly what `targetWake` used to hardcode, which is
// why every check above still passes unchanged.
check('the day window is three hours', cycleFor(new Date(2026, 8, 3, 14)).gap === 180)
check('the night window is four', cycleFor(new Date(2026, 8, 3, 23)).gap === 240)
check('a wrapping window is one window, not two',
  cycleFor(new Date(2026, 8, 3, 2)).id === 'night' && cycleFor(new Date(2026, 8, 3, 23)).id === 'night')
check('and 06:00 is back in the day one', cycleFor(new Date(2026, 8, 3, 6)).id === 'day')

// The estimate steps forward, taking the gap of the window each step lands in
// — so a sequence can change interval halfway.
const line = feedTimeline(new Date(2026, 8, 3, 21, 0), 3)
check('a 21:00 feed is followed at three hours', line[0].at.getHours() === 0)
check('and the one after that at four, being inside the night window',
  line[1].at.getHours() === 4, String(line[1].at.getHours()))
// 04:00 is still inside the night window, so the third step is four hours too
// — the interval follows where each step *starts*.
check('and stays at four while still inside it',
  line[2].at.getHours() === 8, String(line[2].at.getHours()))

// The chip names the window that PRODUCED the time, not the one it landed in.
// The two differ exactly when a step crosses a boundary, and labelling from
// where it landed put `4h` beside two times three hours apart (D-051).
check('a step across the boundary is labelled by where it began',
  line[0].cycle.id === 'day' && line[0].cycle.gap === 180,
  `${line[0].cycle.id} ${line[0].cycle.gap}`)
check('and the one wholly inside the night by the night',
  line[1].cycle.id === 'night', line[1].cycle.id)

const up = upcomingFeeds(new Date(2026, 8, 3, 14, 0), new Date(2026, 8, 3, 15, 0))
check('four are offered', up.length === 4, String(up.length))
check('the first is the nearest still ahead', up[0].at.getHours() === 17, String(up[0].at.getHours()))
// Four reaches into the night from an afternoon feed, which is the point of the
// fourth row: 14:00 + 3 + 3 + 3 + 4 lands at 03:00.
check('and the fourth reaches past midnight', up[3].at.getHours() === 3, String(up[3].at.getHours()))

// Overdue: the row just passed leads, because it is the one being looked for.
const late = upcomingFeeds(new Date(2026, 8, 3, 14, 0), new Date(2026, 8, 3, 20, 30))
check('a passed feed still leads the list',
  late[0].at.getTime() < new Date(2026, 8, 3, 20, 30).getTime(),
  String(late[0].at.getHours()))
check('nothing logged yet means nothing to estimate',
  upcomingFeeds(null, new Date()).length === 0)

check('a whole-hour gap reads without minutes', gapText(180) === '3h', gapText(180))
check('and a half-hour one says so', gapText(150) === '2h 30m', gapText(150))
check('a window starting in the evening is a night one',
  isNightCycle({ id: 'n', from: 22 * 60, to: 6 * 60, gap: 240 }))
check('and one starting in the morning is not',
  !isNightCycle({ id: 'd', from: 6 * 60, to: 22 * 60, gap: 180 }))

// --- the cycle is shared, and localStorage is only its cache (D-052) --------
// `hydrateCycles` is the direction that matters: a pulled row with a cycle wins.
resetCycles()
const shared = { cycles: [{ id: 'day', from: 360, to: 1320, gap: 150 }] }
check('a pulled cycle is adopted',
  hydrateCycles(shared) && cycleFor(new Date(2026, 8, 3, 14)).gap === 150,
  String(cycleFor(new Date(2026, 8, 3, 14)).gap))
check('and adopting the same one again changes nothing', !hydrateCycles(shared))

// Settings with no cycle key means nobody has ever set one. Adopting it would
// throw away a change made on this phone before its first sync — which is
// exactly when the row is missing.
check('settings without a cycle are not adopted over a local one',
  !hydrateCycles({}) && cycleFor(new Date(2026, 8, 3, 14)).gap === 150)
check('nor is a row with no settings at all', !hydrateCycles(null))
check('nor a missing row', !hydrateCycles(undefined))
// Anything unrecognisable falls back rather than throwing: a bad value must not
// be able to stop the card rendering.
check('and neither is a nonsense one', !hydrateCycles({ cycles: [] }))

// `jsonb` does not preserve key order — a cycle written `{id, from, to, gap}`
// comes back `{id, to, gap, from}`. Comparing as strings would call every pull
// a change and repaint the card on each one.
check('the same cycle in a different key order is not a change',
  !hydrateCycles({ cycles: [{ gap: 150, to: 1320, from: 360, id: 'day' }] }),
  'reordered keys read as unchanged')

setCycles(DEFAULT_CYCLES)
check('the defaults are recognised as such', isDefaultCycles())
setCycles([{ id: 'day', from: 360, to: 1320, gap: 210 }])
check('and a tuned phone is not', !isDefaultCycles())
// Back to the defaults for whatever runs after this — and through `setCycles`
// rather than `localStorage`, which does not exist in a Node suite. That guard
// is the reason `cycles.ts` reaches storage through an accessor at all.
setCycles(DEFAULT_CYCLES)
resetCycles()

// --- the bottle prompt ------------------------------------------------------
// Up from 15 minutes before the target and onwards, not just until it.
const at17 = new Date(2026, 8, 3, 17, 0)
const clock = (h: number, m = 0) => new Date(2026, 8, 3, h, m)

check('quiet 16 minutes out', !bottleDue(at17, clock(16, 44)))
check('up 15 minutes out', bottleDue(at17, clock(16, 45)))
check('still up on the target itself', bottleDue(at17, clock(17, 0)))
check('and still up well past it', bottleDue(at17, clock(19, 30)))
check('nothing to say with no target', !bottleDue(null, clock(17, 0)))

// Nothing clears it explicitly. Logging a feed moves the target three or four
// hours out, and that is what takes the line down — no flag, no stored state.
const afterAFeedAt1730 = targetWake(clock(17, 30))!
check('logging a feed takes the prompt down with it',
  !bottleDue(afterAFeedAt1730, clock(17, 31)),
  `${hhmm_(afterAFeedAt1730)} target`)
check('and it comes back 15 minutes before the new one',
  bottleDue(afterAFeedAt1730, clock(20, 15)),
  `${hhmm_(afterAFeedAt1730)} target`)

// --- theme -----------------------------------------------------------------
check('night at 22:00', themeFor(new Date(2026, 8, 3, 22)) === 'night')
check('night at 03:00', themeFor(new Date(2026, 8, 3, 3)) === 'night')
check('day at 09:00', themeFor(new Date(2026, 8, 3, 9)) === 'day')

// --- the design system's classes are not ours to redefine -----------------
// tokens.css is authoritative for colour, type, radius and motion, and it also
// ships component classes. Redefining one silently breaks it: `.stepper` there
// is a 42px round button, and using the same name for a container collapsed the
// time row to 42px with its children overlapping. Only a screenshot caught it.
{
  const { readFileSync } = await import('node:fs')
  const classesIn = (f: string) =>
    new Set([...readFileSync(f, 'utf8').matchAll(/^\.([a-zA-Z][\w-]*)/gm)].map((m) => m[1]))
  const design = classesIn('src/tokens.css')
  const mine = new Set([
    ...classesIn('src/log/log.css'),
    ...classesIn('src/day/day.css'),
  ])
  const ALLOWED = new Set(['day-sep']) // extended deliberately, not redefined
  const clash = [...mine].filter((c) => design.has(c) && !ALLOWED.has(c))
  check('no class redefines one from tokens.css', clash.length === 0, clash.join(', '))

  // And the same rule between our own two stylesheets. A `.gapchip day` chip
  // picked up `.day` — the day screen's page class, a flex container — and
  // stretched into an amber slab across the card. Nothing in the markup said
  // which sheet a class came from, and only a screenshot showed it (D-050).
  const logCss = classesIn('src/log/log.css')
  const dayCss = classesIn('src/day/day.css')
  const crossed = [...logCss].filter((c) => dayCss.has(c))
  check('and the two screens do not share a class name',
    crossed.length === 0, crossed.join(', '))
}

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
