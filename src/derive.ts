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
  const m = lastFeedMoment(moments)
  return m ? new Date(m.timeslot.ended_at ?? m.timeslot.occurred_at) : null
}

/**
 * The moment that feed was part of, not just when it was.
 *
 * The combined and mascot leads print its volume, its clock time and who
 * logged it, so they need the row and not only the timestamp.
 */
export function lastFeedMoment(moments: Moment[]): Moment | null {
  const feeds = moments.filter(hasFeed)
  if (feeds.length === 0) return null
  const at = (m: Moment) => new Date(m.timeslot.ended_at ?? m.timeslot.occurred_at).getTime()
  return feeds.reduce((a, b) => (at(a) >= at(b) ? a : b))
}

/**
 * Which clock the mascot runs on. Breast milk empties faster than formula, so
 * the same elapsed number means something different depending on what the last
 * feed was.
 *
 * `'other'` is the conservative default and covers everything that is not
 * unambiguously breast: formula, a mixed feed, and a feed logged with no source
 * at all. Only an all-breast moment reads as `'breast'` — a `25 mL breast +
 * 45 mL formula` moment (D-034) has formula in it and takes the longer timings.
 */
export type FeedKind = 'breast' | 'other'

export function feedKind(m: Moment | null): FeedKind {
  if (!m) return 'other'
  const feeds = m.events.filter((e) => e.type === 'feed')
  if (feeds.length === 0) return 'other'
  return feeds.every((e) => e.source === 'breast_milk') ? 'breast' : 'other'
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

/**
 * The overnight window the longer target runs in — 22:00 up to 06:00.
 *
 * Judged on the **last feed's own clock time**, not on the target it produces.
 * A feed knows which side of ten o'clock it happened on the moment it is
 * logged, so the answer never changes underneath a card that is already
 * showing it; deriving the window from the target instead would make a 21:30
 * feed's target depend on the target.
 */
const NIGHT_TARGET = { from: 22, to: 6 }

/**
 * When the next feed is aimed at: three hours after the last one, four
 * overnight.
 *
 * A flat number, deliberately — it does **not** follow the mascot's breast /
 * formula split (D-035). The owner set it that way with the split in front of
 * him: this is the target he is aiming at, and the mascot's *hungry* is a
 * description of the baby, so the two are allowed to disagree.
 *
 * Measured from where `lastFeedAt` measures — the end of the feed where there
 * is one — so the target and the elapsed hero count from the same instant.
 */
export function targetWake(lastFeedEnd: Date | null): Date | null {
  if (!lastFeedEnd) return null
  const h = lastFeedEnd.getHours()
  const overnight = h >= NIGHT_TARGET.from || h < NIGHT_TARGET.to
  return new Date(lastFeedEnd.getTime() + (overnight ? 4 : 3) * 3_600_000)
}

/**
 * `in 40m`, `1h 10m ago`, `now`. A distance and nothing else.
 *
 * Past the target it still only says how far past. The tone rule holds here as
 * much as it does on the mascot: the card reports the clock, it does not have
 * an opinion about a feed that has not happened yet.
 */
export function targetText(target: Date | null, now = new Date()): string | null {
  if (!target) return null
  const mins = Math.round((target.getTime() - now.getTime()) / 60000)
  if (mins === 0) return 'now'
  return mins > 0 ? `in ${formatElapsed(mins)}` : `${formatElapsed(-mins)} ago`
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
  const latest = latestPast(moments, now)
  if (!latest) return null
  const open = latest.timeslot.ended_at === null && latest.events.some((e) => e.type === 'sleep')
  return open ? latest : null
}

/**
 * The feed that is still running, if there is one.
 *
 * **The same rule as `ongoingSleep`, on the same field.** A moment with a feed
 * and no `ended_at` is a feed that has not been given an end time yet; once
 * anything else is logged it is no longer the latest moment and stops reading
 * as running, without a single byte being written to say so.
 *
 * No flag on the event, deliberately (D-033). `ended_at` is the timeslot's and
 * is shared by everything in the moment (D-020) — that is already the one place
 * a duration lives, and a second field saying the same thing in different words
 * is how a duration ends up right in one view and wrong in another. The state is
 * derived at render time like every other thing on the home screen.
 */
export function ongoingFeed(moments: Moment[], now = new Date()): Moment | null {
  const latest = latestPast(moments, now)
  if (!latest) return null
  const open = latest.timeslot.ended_at === null && latest.events.some((e) => e.type === 'feed')
  return open ? latest : null
}

/**
 * The most recent moment at or before `now` — the only one either rule looks at.
 *
 * The **latest** timeslot only, which is the rule as the owner stated it for
 * sleep (D-029) and which this keeps for feeds. Anything logged after an open
 * period ended it: something else happened. Scanning all open sleeps instead
 * made every sleep recorded before that feature existed read as still running,
 * which on the real log meant a bar reporting "30h 58m". A start in the future
 * is ignored: backdating is a core flow, and someone typing tomorrow's hour by
 * mistake should not put the app to sleep.
 */
function latestPast(moments: Moment[], now: Date): Moment | null {
  const past = moments.filter((m) => new Date(m.timeslot.occurred_at) <= now)
  if (past.length === 0) return null
  return past.reduce((a, b) =>
    new Date(a.timeslot.occurred_at) >= new Date(b.timeslot.occurred_at) ? a : b,
  )
}

const durationMinutes = (from: string, to: string | Date) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))

/** "1h 20m" / "45m" — how long a sleep ran, or has been running. */
export function sleepDuration(from: string, to: string | Date): string {
  const mins = durationMinutes(from, to)
  const h = Math.floor(mins / 60)
  return h === 0 ? `${mins}m` : `${h}h ${String(mins % 60).padStart(2, '0')}m`
}

/**
 * "25 min" / "1h 05m" — how long a feed took, or has been taking.
 *
 * Spelt out under the hour where a sleep says "45m", because that is what the
 * handoff writes and because the two read differently on the row: a feed is
 * minutes and a sleep is hours, so the unit is doing more work here.
 */
export function feedDuration(from: string, to: string | Date): string {
  const mins = durationMinutes(from, to)
  const h = Math.floor(mins / 60)
  return h === 0 ? `${mins} min` : `${h}h ${String(mins % 60).padStart(2, '0')}m`
}

export type Theme = 'day' | 'night'

/** By the clock, not by a setting (D-021). Night is roughly 20:00–07:00. */
export function themeFor(now = new Date()): Theme {
  const h = now.getHours()
  return h >= 20 || h < 7 ? 'night' : 'day'
}

export type MascotState = 'settled' | 'awake' | 'hungry' | 'feeding' | 'sleeping' | 'logged'

/**
 * How long a feed of each kind holds, in minutes: awake first, then hungry.
 * Breast milk runs 30 and 60 minutes ahead of the rest.
 */
const HOLDS: Record<FeedKind, { awake: number; hungry: number }> = {
  breast: { awake: 90, hungry: 120 },
  other: { awake: 120, hungry: 180 },
}

/**
 * Derived, never set — and descriptive, never evaluative. Sleepy, awake,
 * hungry; never sad, worried or disappointed. An app that appears to disapprove
 * of a late feed lands very differently than intended (CLAUDE.md).
 *
 * The thresholds depend on what the last feed was (`HOLDS`), so the same
 * elapsed number can read settled after formula and awake after breast milk.
 */
export function mascotState(
  minutesSinceFeed: number | null,
  theme: Theme,
  justLogged = false,
  asleep = false,
  feeding = false,
  kind: FeedKind = 'other',
): MascotState {
  if (justLogged) return 'logged'
  // Feeding outranks sleeping: the feed is what is happening right now, and a
  // moment carrying both can only be one of them on the card.
  if (feeding) return 'feeding'
  // A logged, still-open sleep is a fact and outranks the guess below it. The
  // night-plus-a-long-gap heuristic stays as the fallback for when nobody has
  // logged a sleep at all, which is most of the time.
  if (asleep) return 'sleeping'
  const gap = minutesSinceFeed ?? 0
  if (theme === 'night' && gap > 60) return 'sleeping'
  const holds = HOLDS[kind]
  if (gap >= holds.hungry) return 'hungry'
  if (gap >= holds.awake) return 'awake'
  return 'settled'
}
