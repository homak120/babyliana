import type { Moment } from './types'

// Everything the home screen shows is computed from the log, never stored
// (event-model.md § Derived views).

/** Midnight local, matching how the paper log groups dates (D-015). */
export function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function sameDay(a: string, b: Date) {
  return startOfDay(new Date(a)).getTime() === startOfDay(b).getTime()
}

const hasFeed = (m: Moment) => m.events.some((e) => e.type === 'feed')

/**
 * When the last feed *finished*.
 *
 * Measured from `ended_at` when the moment has one and `occurred_at` otherwise:
 * what a tired parent means by "since the last feed" is since she finished, not
 * since she started.
 */
export function lastFeedAt(moments: Moment[]): Date | null {
  const feeds = moments.filter(hasFeed)
  if (feeds.length === 0) return null
  const times = feeds.map((m) =>
    new Date(m.timeslot.ended_at ?? m.timeslot.occurred_at).getTime(),
  )
  return new Date(Math.max(...times))
}

export function minutesSince(at: Date | null, now = new Date()): number | null {
  if (!at) return null
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60000))
}

/** `3h 40m`, or `40m` under the hour. Em dash when there is nothing yet. */
export function formatElapsed(minutes: number | null): string {
  if (minutes === null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, '0')}m`
}

export type Totals = {
  feeds: number
  ml: number
  /** Feeds logged with an unknown volume — `?` on paper, and not the same as 0. */
  unknownVolumes: number
  pee: number
  poop: number
  /** Millilitres by source. `unmarked` is volume logged without one. */
  breastMl: number
  formulaMl: number
  unmarkedMl: number
}

export function totalsFor(moments: Moment[], day = new Date()): Totals {
  return totalsOf(moments.filter((m) => sameDay(m.timeslot.occurred_at, day)))
}

/**
 * Totals for whatever is handed in, with no date filtering of its own.
 *
 * The day screen needs this because its scope is not always one day: "all days"
 * was showing *today's* totals under an "all days" heading, and a picked range
 * could not be totalled at all.
 */
export function totalsOf(moments: Moment[]): Totals {
  const t: Totals = {
    feeds: 0, ml: 0, unknownVolumes: 0, pee: 0, poop: 0,
    breastMl: 0, formulaMl: 0, unmarkedMl: 0,
  }
  for (const m of moments) {
    for (const e of m.events) {
      if (e.type === 'feed') {
        t.feeds++
        if (e.volume_ml === null) t.unknownVolumes++
        else {
          t.ml += e.volume_ml
          if (e.source === 'breast_milk') t.breastMl += e.volume_ml
          else if (e.source === 'formula') t.formulaMl += e.volume_ml
          else t.unmarkedMl += e.volume_ml
        }
      }
      if (e.type === 'diaper') {
        if (e.pee) t.pee++
        if (e.poop) t.poop++
      }
    }
  }
  return t
}

/**
 * The sleep that is still running, if there is one.
 *
 * A sleep is open when its moment carries a `sleep` event and the **timeslot**
 * has no `ended_at` — the end time is the timeslot's, shared by everything in
 * the moment (D-020), so there is no separate field to consult. A start in the
 * future is ignored: backdating is a core flow, and someone typing tomorrow's
 * hour by mistake should not put the app to sleep.
 */
export function ongoingSleep(moments: Moment[], now = new Date()): Moment | null {
  // The **latest** timeslot only, which is the rule as the owner stated it. A
  // sleep with anything logged after it is over by definition — something else
  // happened, so she woke. Scanning all open sleeps instead made every sleep
  // recorded before this feature existed read as still running, which on the
  // real log meant a bar reporting "30h 58m".
  const past = moments.filter((m) => new Date(m.timeslot.occurred_at) <= now)
  if (past.length === 0) return null
  const latest = past.reduce((a, b) =>
    new Date(a.timeslot.occurred_at) >= new Date(b.timeslot.occurred_at) ? a : b,
  )
  const open = latest.timeslot.ended_at === null && latest.events.some((e) => e.type === 'sleep')
  return open ? latest : null
}

/** "1h 20m" / "45m" — how long a sleep ran, or has been running. */
export function sleepDuration(from: string, to: string | Date): string {
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  return h === 0 ? `${mins}m` : `${h}h ${String(mins % 60).padStart(2, '0')}m`
}

export type Theme = 'day' | 'night'

/** By the clock, not by a setting (D-021). Night is roughly 20:00–07:00. */
export function themeFor(now = new Date()): Theme {
  const h = now.getHours()
  return h >= 20 || h < 7 ? 'night' : 'day'
}

export type MascotState = 'settled' | 'awake' | 'hungry' | 'sleeping' | 'logged'

/**
 * Derived, never set — and descriptive, never evaluative. Sleepy, awake,
 * hungry; never sad, worried or disappointed. An app that appears to disapprove
 * of a late feed lands very differently than intended (CLAUDE.md).
 */
export function mascotState(
  minutesSinceFeed: number | null,
  theme: Theme,
  justLogged = false,
  asleep = false,
): MascotState {
  if (justLogged) return 'logged'
  // A logged, still-open sleep is a fact and outranks the guess below it. The
  // night-plus-a-long-gap heuristic stays as the fallback for when nobody has
  // logged a sleep at all, which is most of the time.
  if (asleep) return 'sleeping'
  const gap = minutesSinceFeed ?? 0
  if (theme === 'night' && gap > 60) return 'sleeping'
  if (gap >= 240) return 'hungry'
  if (gap >= 120) return 'awake'
  return 'settled'
}
