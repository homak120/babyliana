import { isoOf } from '../day/period'
import { sameDay, startOfDay } from '../derive'
import type { Moment } from '../types'

// Everything on the insights screen is derived here, at render time, from the
// moments already in memory. Nothing is stored and no new column exists for it
// — same rule as the home screen's totals (event-model.md § Derived views).
//
// Kept apart from the component because these are the parts worth testing: the
// projection, the gap arithmetic and the watch-list rules are where this can be
// quietly wrong, and none of them needs a browser to check.

/**
 * What the insights screen is looking at.
 *
 * Three shapes rather than a number, because a calendar month is not a count of
 * days and pretending it is would put "August" one day out whenever a month is
 * 31 days long. `days` keeps the original meaning — the last N days that have
 * *entries*, not the last N on the calendar — so a gap in the log does not
 * silently shorten the window.
 */
export type Span =
  | { kind: 'days'; n: number }
  | { kind: 'month'; ym: string }
  | { kind: 'all' }

export const lastDays = (n: number): Span => ({ kind: 'days', n })
export const monthOf = (ym: string): Span => ({ kind: 'month', ym })
export const ALL_TIME: Span = { kind: 'all' }

/** Whether two spans are the same one, for marking the selected pill. */
export const sameSpan = (a: Span, b: Span) =>
  a.kind === 'days' ? b.kind === 'days' && a.n === b.n
    : a.kind === 'month' ? b.kind === 'month' && a.ym === b.ym
      : b.kind === 'all'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** One month pill: `2026-09` and what to print on it. */
export type MonthOption = { ym: string; label: string }

/**
 * The months the log actually has something in, newest first.
 *
 * Offered rather than generated, so a pill never opens an empty screen. The
 * year is printed only when it is not the current one — `Sep` all year, and
 * `Sep '25` once it stops being obvious.
 */
export function monthsWithData(moments: Moment[], now = new Date()): MonthOption[] {
  const seen = new Set<string>()
  for (const m of moments) {
    const d = new Date(m.timeslot.occurred_at)
    seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return [...seen]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((ym) => {
      const year = Number(ym.slice(0, 4))
      const name = MONTH_NAMES[Number(ym.slice(5, 7)) - 1]
      return { ym, label: year === now.getFullYear() ? name : `${name} '${String(year).slice(2)}` }
    })
}

/** `1h 20m`, `45m`, `2h`. Trailing zero minutes are dropped, unlike
 *  `formatElapsed`, which pads because it sits under a ticking clock. */
export function hm(mins: number | null): string {
  if (mins === null || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

/** `9/4`, matching the date pills rather than an ISO string. */
export const shortDay = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

export type DayStat = {
  iso: string
  date: Date
  isToday: boolean
  ml: number
  /** Millilitres by source. The three add up to `ml` (D-049). */
  mlBreast: number
  mlFormula: number
  mlUnmarked: number
  feeds: number
  /** Feeds with nothing in the volume column — the paper log's `?` (D-018).
   *  They are counted, and they are not in `ml`. */
  feedsNoVolume: number
  pees: number
  poops: number
  sleeps: number
  sleepMins: number
  longestSleepMins: number
  /** Largest gap between consecutive feeds **within** the day, in minutes. */
  maxFeedGap: number
  /** First feed to last, divided by the gaps between them. 0 under two feeds. */
  avgFeedGap: number
  moments: Moment[]
}

export type Flag = { key: string; icon: string; text: string }

/** Where the night band sits. Fixed, and not a setting: it is scenery for
 *  reading the rows against, not a claim about when this baby sleeps. */
export const NIGHT = { from: 19, to: 7 }

/** A stretch of sleep on one day's track, as percentages across that day. */
export type TrackBand = { from: number; to: number }

/** One thing that happened, positioned by the minute it happened at. */
export type TrackMark = { id: string; at: number; kind: 'feed' | 'poop' | 'pee' }

/**
 * One day of the rhythm chart.
 *
 * **Two lanes, not one cell per hour (D-064).** The hour grid it replaces had
 * three faults and this fixes all three: sleep was last in a priority order, so
 * the only thing that occupies hours rather than instants was the thing most
 * often painted over; 23:05 and 23:50 were the same cell; and one feed in an
 * hour looked like three.
 */
export type TrackRow = {
  iso: string
  label: string
  /** Clamped to this day, so a sleep crossing midnight draws on both. */
  sleeps: TrackBand[]
  marks: TrackMark[]
}

/** The longest anyone went without a feed, and when it started. */
export type Stretch = { mins: number; fromIso: string }

export type WeightEntry = { key: string; day: string; text: string }

/** One row of the poop-colour tally — a count and nothing said about it. */
export type ColourCount = { name: string; count: number }

/**
 * Poop colours across the span, commonest first.
 *
 * A tally, and deliberately no more: the app records and does not diagnose
 * (CLAUDE.md), so there is no threshold here, nothing flagged, and no colour
 * treated as better or worse than another. Unrecorded colours are counted
 * separately rather than dropped, because "not written down" is not "other".
 */
export function poopColours(moments: Moment[]): ColourCount[] {
  const tally = new Map<string, number>()
  for (const m of moments) {
    for (const e of m.events) {
      if (e.type !== 'diaper' || !e.poop) continue
      const name = e.poop_colour ?? 'not noted'
      tally.set(name, (tally.get(name) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    // Commonest first, and ties by name so the order does not shuffle between
    // renders of the same data.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** One band of a day's milk: what it was, how much of it, and what share of
 *  that day the share is. */
export type SourceRow = {
  key: 'breast' | 'formula' | 'unmarked'
  label: string
  ml: number
  /** Whole percent of the day's volume. The rows add up to exactly 100. */
  pct: number
}

/**
 * One day's milk split three ways, in the legend's own order.
 *
 * The stacked bar says the shape of a day at a glance and nothing else — it
 * takes a ruler and the legend to get a number out of it. This is that number,
 * for the day the reader asked about.
 *
 * Percentages are whole and they sum to 100. Rounding each band alone gives
 * 44 + 37 + 20 = 101, and a breakdown that does not add up reads as a bug to
 * the one person who checks it, so the rounding loss goes to the bands with the
 * largest remainders rather than to whichever one is printed last.
 *
 * A band with nothing in it is dropped rather than printed as 0 mL: the chart
 * does not draw it either, and `formula 0 mL 0%` is noise on a day that was all
 * breast milk.
 */
export function sourceSplit(d: DayStat): SourceRow[] {
  if (d.ml <= 0) return []
  const all: SourceRow[] = [
    { key: 'breast', label: 'breast', ml: d.mlBreast, pct: 0 },
    { key: 'formula', label: 'formula', ml: d.mlFormula, pct: 0 },
    { key: 'unmarked', label: 'not marked', ml: d.mlUnmarked, pct: 0 },
  ]
  const bands = all.filter((b) => b.ml > 0)

  const exact = bands.map((b) => (b.ml / d.ml) * 100)
  bands.forEach((b, n) => { b.pct = Math.floor(exact[n]) })

  // Largest fractional part takes the leftover first; ties to the larger band,
  // then to chart order, so the same day never rounds two ways on two renders.
  const order = bands
    .map((b, n) => ({ n, frac: exact[n] - Math.floor(exact[n]), ml: b.ml }))
    .sort((a, b) => b.frac - a.frac || b.ml - a.ml || a.n - b.n)
  const left = 100 - bands.reduce((a, b) => a + b.pct, 0)
  for (let k = 0; k < left; k++) bands[order[k].n].pct++

  return bands
}

const minutesInto = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const isSleep = (m: Moment) => m.events.some((e) => e.type === 'sleep')

/** Milliseconds a sleep ran, or has been running. Open sleeps measure to `now`. */
function sleepSpan(m: Moment, now: Date): [number, number] {
  const from = new Date(m.timeslot.occurred_at).getTime()
  const to = m.timeslot.ended_at ? new Date(m.timeslot.ended_at).getTime() : now.getTime()
  return [from, Math.max(from, to)]
}

function statsFor(iso: string, moments: Moment[], now: Date): DayStat {
  const date = startOfDay(new Date(moments[0].timeslot.occurred_at))
  const s: DayStat = {
    iso, date, isToday: sameDay(date.toISOString(), now),
    ml: 0, mlBreast: 0, mlFormula: 0, mlUnmarked: 0,
    feeds: 0, feedsNoVolume: 0, pees: 0, poops: 0,
    sleeps: 0, sleepMins: 0, longestSleepMins: 0,
    maxFeedGap: 0, avgFeedGap: 0, moments,
  }

  const feedTimes: number[] = []
  for (const m of moments) {
    for (const e of m.events) {
      if (e.type === 'feed') {
        s.feeds++
        if (e.volume_ml !== null) {
          s.ml += e.volume_ml
          // A feed with no source is its own band, not a rounding error: more
          // than half the log has none, and hiding that would make the chart a
          // claim about the baby rather than about what was written down.
          if (e.source === 'breast_milk') s.mlBreast += e.volume_ml
          else if (e.source === 'formula') s.mlFormula += e.volume_ml
          else s.mlUnmarked += e.volume_ml
        } else s.feedsNoVolume++
      }
      if (e.type === 'diaper') {
        if (e.pee) s.pees++
        if (e.poop) s.poops++
      }
    }
    if (m.events.some((e) => e.type === 'feed')) feedTimes.push(minutesInto(m.timeslot.occurred_at))

    // Only a *finished* sleep contributes a duration. An open one has no
    // length yet, and counting it would make the daily average climb on its
    // own while nothing was logged.
    if (isSleep(m) && m.timeslot.ended_at) {
      const [from, to] = sleepSpan(m, now)
      const mins = Math.round((to - from) / 60000)
      s.sleeps++
      s.sleepMins += mins
      s.longestSleepMins = Math.max(s.longestSleepMins, mins)
    }
  }

  feedTimes.sort((a, b) => a - b)
  for (let i = 1; i < feedTimes.length; i++) {
    s.maxFeedGap = Math.max(s.maxFeedGap, feedTimes[i] - feedTimes[i - 1])
  }
  if (feedTimes.length > 1) {
    s.avgFeedGap = Math.round(
      (feedTimes[feedTimes.length - 1] - feedTimes[0]) / (feedTimes.length - 1),
    )
  }
  return s
}

/** How far into a day a moment in time falls, as a percentage of it. */
const pctOfDay = (ms: number) => (ms / 86_400_000) * 100

function trackRow(s: DayStat, all: Moment[], now: Date): TrackRow {
  const dayStart = s.date.getTime()
  const dayEnd = dayStart + 86_400_000

  // Read from every moment, not just this day's: a sleep that began yesterday
  // evening still covers this morning, and clamping is what draws it on both
  // rows rather than on neither.
  const sleeps: TrackBand[] = []
  for (const m of all) {
    if (!isSleep(m)) continue
    const [from, to] = sleepSpan(m, now)
    const a = Math.max(from, dayStart)
    const b = Math.min(to, dayEnd)
    if (b <= a) continue
    sleeps.push({ from: pctOfDay(a - dayStart), to: pctOfDay(b - dayStart) })
  }

  const marks: TrackMark[] = []
  for (const m of s.moments) {
    const at = pctOfDay(new Date(m.timeslot.occurred_at).getTime() - dayStart)
    if (m.events.some((e) => e.type === 'feed')) {
      // One tick per *moment*, not per event: a feed split across two sources
      // is one thing that happened at one time (D-019), and two ticks at the
      // same position would say it twice.
      marks.push({ id: `${m.timeslot.id}-f`, at, kind: 'feed' })
    }
    const changes = m.events.filter((e) => e.type === 'diaper')
    if (changes.length) {
      // A change is one tick, and it takes the name of the rarer half. This is
      // the old priority rule, surviving only where the two are genuinely the
      // same event — never again between sleep and everything else, which is
      // where it was doing damage.
      marks.push({
        id: `${m.timeslot.id}-d`,
        at,
        kind: changes.some((e) => e.poop) ? 'poop' : 'pee',
      })
    }
  }
  marks.sort((a, b) => a.at - b.at)

  return { iso: s.iso, label: shortDay(s.date), sleeps, marks }
}

/**
 * How often a feed falls in each hour, across the whole span.
 *
 * The per-day rows say what happened; this says what usually happens, which is
 * the question anyone actually brings to a rhythm chart. A count, by hour, and
 * nothing said about it.
 */
export function usualHours(days: DayStat[]): number[] {
  const counts = new Array(24).fill(0) as number[]
  for (const d of days) {
    for (const m of d.moments) {
      if (m.events.some((e) => e.type === 'feed')) {
        counts[new Date(m.timeslot.occurred_at).getHours()]++
      }
    }
  }
  return counts
}

/**
 * The longest anyone went between feeds across the span, and when it began.
 *
 * **Not the same figure as `maxFeedGap`, deliberately.** That one is the widest
 * gap *inside* a calendar day and it is what D-032's watch rule counts. This one
 * runs across midnight, which is where the long stretch anybody cares about
 * actually happens. Both are printed, and each says which it is.
 */
function longestStretch(days: DayStat[]): Stretch | null {
  const feeds = days
    .flatMap((d) => d.moments)
    .filter((m) => m.events.some((e) => e.type === 'feed'))
    .map((m) => m.timeslot.occurred_at)
    .sort()
  let best: Stretch | null = null
  for (let i = 1; i < feeds.length; i++) {
    const mins = Math.round(
      (new Date(feeds[i]).getTime() - new Date(feeds[i - 1]).getTime()) / 60000,
    )
    if (!best || mins > best.mins) best = { mins, fromIso: feeds[i - 1] }
  }
  return best
}

export type Insights = ReturnType<typeof buildInsights>

export function buildInsights(moments: Moment[], span: Span, now = new Date()) {
  const byDay = new Map<string, Moment[]>()
  for (const m of moments) {
    const iso = isoOf(new Date(m.timeslot.occurred_at))
    const bucket = byDay.get(iso)
    if (bucket) bucket.push(m)
    else byDay.set(iso, [m])
  }

  const inSpan = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  const picked = span.kind === 'days'
    ? inSpan.slice(-span.n)
    : span.kind === 'month'
      ? inSpan.filter(([iso]) => iso.startsWith(span.ym))
      : inSpan
  const days = picked.map(([iso, ms]) => statsFor(iso, ms, now))

  const today = days.find((d) => d.isToday) ?? null

  // "Complete days" means days that have finished. Today is excluded because
  // it is still filling up, and averaging a half-finished day drags every
  // figure down all morning. If nothing is logged today, every day counts.
  const complete = days.filter((d) => !d.isToday)
  const basis = complete.length ? complete : days

  const mean = (pick: (d: DayStat) => number) =>
    basis.length ? Math.round(basis.reduce((a, d) => a + pick(d), 0) / basis.length) : 0

  const avgMl = mean((d) => d.ml)
  const avgFeeds = mean((d) => d.feeds)
  const avgPee = mean((d) => d.pees)
  const avgSleepMins = mean((d) => d.sleepMins)

  // Today's total, scaled up to a whole day. The 0.2 floor stops the small
  // hours turning 30 mL into a four-figure projection.
  const elapsed = Math.max(0.2, (now.getHours() * 60 + now.getMinutes()) / 1440)
  const paceMl = today ? Math.round(today.ml / elapsed) : null
  const paceDelta = today && avgMl ? Math.round(((paceMl! - avgMl) / avgMl) * 100) : null

  const poops = moments
    .filter((m) => m.events.some((e) => e.type === 'diaper' && e.poop))
    .sort((a, b) => (a.timeslot.occurred_at < b.timeslot.occurred_at ? -1 : 1))
  const lastPoop = poops[poops.length - 1] ?? null
  const sincePoopMins = lastPoop
    ? Math.max(0, Math.round((now.getTime() - new Date(lastPoop.timeslot.occurred_at).getTime()) / 60000))
    : null

  const worstGap = days.reduce<DayStat | null>(
    (a, d) => (a === null || d.maxFeedGap > a.maxFeedGap ? d : a),
    null,
  )
  const gapDays = basis.filter((d) => d.avgFeedGap > 0)
  const avgFeedGap = gapDays.length
    ? Math.round(gapDays.reduce((a, d) => a + d.avgFeedGap, 0) / gapDays.length)
    : 0

  // The watch list. Descriptive rules with fixed thresholds, shipped on the
  // owner's explicit call — see D-032, which narrowed the "no normal-range
  // judgements" rule in CLAUDE.md to make room for exactly these four.
  const flags: Flag[] = []
  // One line per day reads as a list of days at 7. At 30 it is a wall, and a
  // card that has to be scrolled past stops being a card you look at — so past
  // three days the *same rule* says how many and when it last happened. Still
  // D-032's wet-diaper rule, counted the same way; only the printing changes.
  const dry = complete.filter((d) => d.pees < 6)
  if (dry.length <= 3) {
    for (const d of dry) {
      flags.push({
        key: `pee-${d.iso}`,
        icon: 'water_drop',
        text: `${shortDay(d.date)}: ${d.pees} wet ${d.pees === 1 ? 'diaper' : 'diapers'}, below the 6-a-day mark`,
      })
    }
  } else {
    const last = dry[dry.length - 1]
    flags.push({
      key: 'pee-many',
      icon: 'water_drop',
      text: `${dry.length} days under the 6-a-day wet mark, most recently ${shortDay(last.date)}`,
    })
  }
  if (sincePoopMins !== null && sincePoopMins > 1440) {
    flags.push({ key: 'poop', icon: 'cookie', text: `no poop for ${hm(sincePoopMins)}` })
  }
  if (worstGap && worstGap.maxFeedGap >= 180) {
    flags.push({
      key: 'gap',
      icon: 'schedule',
      text: `${hm(worstGap.maxFeedGap)} between feeds on ${shortDay(worstGap.date)}`,
    })
  }
  if (paceDelta !== null && paceDelta <= -20) {
    flags.push({
      key: 'pace',
      icon: 'trending_down',
      text: `today is tracking ${Math.abs(paceDelta)}% under the ${avgMl} mL average`,
    })
  }

  const usual = usualHours(days)

  const weights: WeightEntry[] = moments
    .filter((m) => m.events.some((e) => e.type === 'weight'))
    .sort((a, b) => (a.timeslot.occurred_at < b.timeslot.occurred_at ? -1 : 1))
    .flatMap((m) =>
      m.events
        .filter((e) => e.type === 'weight' && /\d/.test(e.note ?? ''))
        .map((e) => ({
          key: e.id,
          day: shortDay(new Date(m.timeslot.occurred_at)),
          text: e.note!,
        })),
    )

  return {
    span,
    days,
    today,
    complete,
    rangeLabel: days.length
      ? `${shortDay(days[0].date)} – ${shortDay(days[days.length - 1].date)}`
      : '',
    daysLogged: `${days.length} ${days.length === 1 ? 'day' : 'days'} logged`,

    avgMl, avgFeeds, avgPee, avgSleepMins,
    perFeedMl: avgFeeds ? Math.round(avgMl / avgFeeds) : null,
    maxMl: Math.max(1, ...days.map((d) => d.ml)),
    maxSleepMins: Math.max(1, ...days.map((d) => d.sleepMins)),

    todayMl: today ? today.ml : null,
    paceMl, paceDelta,

    flags,
    track: days.map((d) => trackRow(d, moments, now)),
    usual,
    usualMax: Math.max(1, ...usual),
    longestStretch: longestStretch(days),

    avgFeedGap,
    worstGapMins: worstGap ? worstGap.maxFeedGap : 0,
    worstGapDay: worstGap ? shortDay(worstGap.date) : '',

    sincePoopMins,
    lastPoop,
    poopTotal: days.reduce((a, d) => a + d.poops, 0),

    // --- the three charts added in D-049 ---
    // A stacked bar needs the tallest total to scale against, and it is the
    // *sum* that sets the height, not either part.
    maxDiapers: Math.max(1, ...days.map((d) => d.pees + d.poops)),
    peeTotal: days.reduce((a, d) => a + d.pees, 0),
    // The whole point of the source chart: how much was never marked. Kept as
    // a figure of its own so the caption can say it outright.
    mlUnmarked: days.reduce((a, d) => a + d.mlUnmarked, 0),
    sourcedDays: days.filter((d) => d.mlBreast + d.mlFormula > 0).length,
    colours: poopColours(days.flatMap((d) => d.moments)),

    sleepCount: days.reduce((a, d) => a + d.sleeps, 0),
    longestSleepMins: Math.max(0, ...days.map((d) => d.longestSleepMins)),
    hasSleep: days.some((d) => d.sleeps > 0),

    weights,
  }
}
