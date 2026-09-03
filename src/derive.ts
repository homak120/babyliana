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
}

export function totalsFor(moments: Moment[], day = new Date()): Totals {
  const t: Totals = { feeds: 0, ml: 0, unknownVolumes: 0, pee: 0, poop: 0 }
  for (const m of moments) {
    if (!sameDay(m.timeslot.occurred_at, day)) continue
    for (const e of m.events) {
      if (e.type === 'feed') {
        t.feeds++
        if (e.volume_ml === null) t.unknownVolumes++
        else t.ml += e.volume_ml
      }
      if (e.type === 'diaper') {
        if (e.pee) t.pee++
        if (e.poop) t.poop++
      }
    }
  }
  return t
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
): MascotState {
  if (justLogged) return 'logged'
  const gap = minutesSinceFeed ?? 0
  if (theme === 'night' && gap > 60) return 'sleeping'
  if (gap >= 240) return 'hungry'
  if (gap >= 120) return 'awake'
  return 'settled'
}
