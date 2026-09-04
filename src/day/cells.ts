import { sameDay } from '../derive'
import type { LogEvent, Moment } from '../types'

// How a moment renders as a paper row. Kept out of the component because the
// acceptance test is "hold the phone next to the photograph and compare", and
// that is easier to check against real entries here than by eye.

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `21:09`, or `19:00–21:30` when the moment is a period. */
export function timeCell(m: Moment): string {
  const start = hhmm(m.timeslot.occurred_at)
  return m.timeslot.ended_at ? `${start}–${hhmm(m.timeslot.ended_at)}` : start
}

const SRC: Record<string, string> = { breast_milk: '(B)', formula: '(F)' }

/**
 * The Milk column, as the paper writes it: `45`, `45(B)`, `25(B) + 45(F)`,
 * `30 + 30`, or `?`.
 *
 * An empty cell and a `?` are different facts — no feed at all, versus a feed
 * whose volume was not known. The paper log distinguishes them and so must
 * this, which is why an absent feed returns null rather than an empty string.
 */
export function milkCell(events: LogEvent[]): { parts: string[]; unknown: boolean } | null {
  const feeds = events.filter((e) => e.type === 'feed')
  if (feeds.length === 0) return null
  const parts = feeds.map((e) => {
    const vol = e.volume_ml === null ? '?' : String(e.volume_ml)
    return vol + (e.source ? (SRC[e.source] ?? '') : '')
  })
  return { parts, unknown: feeds.every((e) => e.volume_ml === null) }
}

/**
 * The pee/poop column, split so each half can carry its own colour — the
 * prototype prints `pee` in yellow and the poop in mint rather than one string.
 */
export function diaperParts(events: LogEvent[]): { pee: boolean; poop: string | null } {
  const changes = events.filter((e) => e.type === 'diaper')
  const pee = changes.some((c) => c.pee)
  const pooped = changes.find((c) => c.poop)
  if (!pooped) return { pee, poop: null }
  // `other` is a schema value, not something anyone wrote. Printing
  // "poop (other)" says less than "poop" does, and the detail is in the note
  // anyway — which is why `other` exists as an option at all.
  const qual = [pooped.poop_colour, pooped.poop_consistency]
    .filter((v) => v && v !== 'other')
    .join(' ')
  return { pee, poop: qual ? `poop (${qual})` : 'poop' }
}

/** Flat form, for tests and anywhere a single string is wanted. */
export function diaperCell(events: LogEvent[]): string | null {
  const { pee, poop } = diaperParts(events)
  const bits = [pee ? 'pee' : null, poop].filter(Boolean)
  return bits.length ? bits.join(' · ') : null
}

/** Anything that is neither a feed nor a change — sleep, weight, other. */
export function otherCell(events: LogEvent[]): string | null {
  const rest = events.filter((e) => e.type !== 'feed' && e.type !== 'diaper')
  if (rest.length === 0) return null
  return rest.map((e) => e.type.replace('_', ' ')).join(' · ')
}

/**
 * The date prints on the first row of a day and is inherited below it, exactly
 * as the paper page does — which is why this takes the *previous* row rather
 * than formatting each row on its own.
 */
export function dateCell(m: Moment, previous: Moment | undefined): string | null {
  if (previous && sameDay(previous.timeslot.occurred_at, new Date(m.timeslot.occurred_at))) {
    return null
  }
  const d = new Date(m.timeslot.occurred_at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Oldest first, like reading down a page. */
export function chronological(moments: Moment[]): Moment[] {
  return [...moments].sort(
    (a, b) => +new Date(a.timeslot.occurred_at) - +new Date(b.timeslot.occurred_at),
  )
}

/** Distinct days present in the log, newest first, for the date strip. */
export function daysWithEntries(moments: Moment[]): Date[] {
  const seen = new Map<number, Date>()
  for (const m of moments) {
    const d = new Date(m.timeslot.occurred_at)
    d.setHours(0, 0, 0, 0)
    seen.set(d.getTime(), d)
  }
  return [...seen.values()].sort((a, b) => +b - +a)
}

export const initialOf = (name: string | null) =>
  name ? name.trim().charAt(0).toUpperCase() : null

/**
 * Which of the design's two parent colours a device gets.
 *
 * By position in a stable sort of the ids, so both phones agree on who is amber
 * and who is blue without anything having to be stored.
 */
export function avatarClass(deviceId: string, allIds: string[]): string {
  const i = [...allIds].sort().indexOf(deviceId)
  return i % 2 === 0 ? 'avatar avatar-m' : 'avatar avatar-a'
}
