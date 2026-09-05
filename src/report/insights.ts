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

export type Span = 3 | 7

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
  feeds: number
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

export type HeatCell = { hour: number; kind: 'feed' | 'poop' | 'pee' | 'sleep' | null }
export type HeatRow = { iso: string; label: string; cells: HeatCell[] }

export type WeightEntry = { key: string; day: string; text: string }

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
    ml: 0, feeds: 0, pees: 0, poops: 0,
    sleeps: 0, sleepMins: 0, longestSleepMins: 0,
    maxFeedGap: 0, avgFeedGap: 0, moments,
  }

  const feedTimes: number[] = []
  for (const m of moments) {
    for (const e of m.events) {
      if (e.type === 'feed') {
        s.feeds++
        if (e.volume_ml !== null) s.ml += e.volume_ml
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

/** Which hours of `day` a sleep covers, clamped to that day so one crossing
 *  midnight colours the right hours on both rows rather than none on either. */
function sleepHours(m: Moment, day: Date, now: Date): number[] {
  const dayStart = day.getTime()
  const dayEnd = dayStart + 86_400_000
  const [from, to] = sleepSpan(m, now)
  const a = Math.max(from, dayStart)
  const b = Math.min(to, dayEnd - 1)
  if (b < a) return []
  const first = new Date(a).getHours()
  const last = new Date(b).getHours()
  const out: number[] = []
  for (let h = first; h <= last; h++) out.push(h)
  return out
}

function heatRow(s: DayStat, all: Moment[], now: Date): HeatRow {
  const feed = new Set<number>()
  const poop = new Set<number>()
  const pee = new Set<number>()
  const sleep = new Set<number>()

  for (const m of s.moments) {
    const h = new Date(m.timeslot.occurred_at).getHours()
    for (const e of m.events) {
      if (e.type === 'feed') feed.add(h)
      if (e.type === 'diaper' && e.poop) poop.add(h)
      if (e.type === 'diaper' && e.pee) pee.add(h)
    }
  }
  // Sleeps are read from every moment, not just this day's, because one that
  // began yesterday evening still covers this morning's hours.
  for (const m of all) {
    if (isSleep(m)) for (const h of sleepHours(m, s.date, now)) sleep.add(h)
  }

  const cells: HeatCell[] = []
  for (let hour = 0; hour < 24; hour++) {
    // Priority is feed > poop > pee > sleep, per the handoff: one cell, and
    // the rarer thing is the one worth seeing.
    const kind = feed.has(hour) ? 'feed'
      : poop.has(hour) ? 'poop'
      : pee.has(hour) ? 'pee'
      : sleep.has(hour) ? 'sleep'
      : null
    cells.push({ hour, kind })
  }
  return { iso: s.iso, label: shortDay(s.date), cells }
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

  const days = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-span)
    .map(([iso, ms]) => statsFor(iso, ms, now))

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
  for (const d of complete) {
    if (d.pees < 6) {
      flags.push({
        key: `pee-${d.iso}`,
        icon: 'water_drop',
        text: `${shortDay(d.date)}: ${d.pees} wet ${d.pees === 1 ? 'diaper' : 'diapers'}, below the 6-a-day mark`,
      })
    }
  }
  if (sincePoopMins !== null && sincePoopMins > 1440) {
    flags.push({ key: 'poop', icon: 'cookie', text: `no poop for ${hm(sincePoopMins)}` })
  }
  if (worstGap && worstGap.maxFeedGap >= 300) {
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
    heat: days.map((d) => heatRow(d, moments, now)),

    avgFeedGap,
    worstGapMins: worstGap ? worstGap.maxFeedGap : 0,
    worstGapDay: worstGap ? shortDay(worstGap.date) : '',

    sincePoopMins,
    lastPoop,
    poopTotal: days.reduce((a, d) => a + d.poops, 0),

    sleepCount: days.reduce((a, d) => a + d.sleeps, 0),
    longestSleepMins: Math.max(0, ...days.map((d) => d.longestSleepMins)),
    hasSleep: days.some((d) => d.sleeps > 0),

    weights,
  }
}
