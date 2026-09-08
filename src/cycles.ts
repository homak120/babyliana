// The feeding cycle: how long a feed is expected to hold, by time of day.
//
// One source of truth for two things that must never disagree — the ceiling on
// the top card (`targetWake`, D-036) and the next-feed estimates on its second
// tab (D-050). Before this, the 3h/4h split lived inside `targetWake` as two
// constants; the tune screen made it something a person can change, so it had
// to come out.

/** A window of the clock and the gap that applies inside it. */
export type Cycle = {
  id: string
  /** Minutes from midnight. `from > to` means the window wraps past midnight. */
  from: number
  to: number
  /** Minutes between feeds inside this window. */
  gap: number
}

/**
 * Day 3h, night 4h — the numbers `targetWake` already used, and the same
 * 22:00–06:00 boundary (D-036). The defaults reproduce the old behaviour
 * exactly, so nothing moves for anyone who never opens the tune screen.
 */
export const DEFAULT_CYCLES: Cycle[] = [
  { id: 'day', from: 6 * 60, to: 22 * 60, gap: 180 },
  { id: 'night', from: 22 * 60, to: 6 * 60, gap: 240 },
]

const KEY = 'babyliana.cycles'

/**
 * Per-phone, in localStorage, like every other setting here (D-041, D-045).
 *
 * **The two phones can disagree**, and that is a real cost worth naming: a
 * feeding rhythm is arguably a fact about the baby rather than about the phone
 * in your hand. It is not synced because sync means a schema change, and D-039
 * made the schema additive-only for a reason. If it ever matters, the fix is a
 * column, not a second store.
 */
let cached: Cycle[] | null = null

const store = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage

/** Anything unparseable falls back to the defaults rather than throwing: a
 *  corrupt preference must not be able to stop the card rendering. */
function parse(raw: string | null): Cycle[] {
  if (!raw) return DEFAULT_CYCLES
  try {
    const v = JSON.parse(raw) as Cycle[]
    if (!Array.isArray(v) || v.length === 0) return DEFAULT_CYCLES
    if (!v.every((c) => typeof c.from === 'number' && typeof c.to === 'number' && c.gap > 0)) {
      return DEFAULT_CYCLES
    }
    return v
  } catch {
    return DEFAULT_CYCLES
  }
}

export function cycles(): Cycle[] {
  if (cached) return cached
  cached = parse(store()?.getItem(KEY) ?? null)
  return cached
}

export function setCycles(next: Cycle[]): void {
  cached = next
  store()?.setItem(KEY, JSON.stringify(next))
}

/** Forgets the cache, for suites that write the preference behind the module. */
export function resetCycles(): void {
  cached = null
}

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

/**
 * The window a given moment falls in.
 *
 * A window wraps when `from > to` — 22:00–06:00 is one window, not two — which
 * is why this is a membership test rather than a range comparison. Falls back
 * to the first window rather than returning null: a clock minute that belongs
 * to no window is a broken config, and the card still has to draw.
 */
export function cycleFor(at: Date, list = cycles()): Cycle {
  const m = minutesOfDay(at)
  return (
    list.find((c) => (c.from <= c.to ? m >= c.from && m < c.to : m >= c.from || m < c.to))
    ?? list[0]
  )
}

/**
 * Feed times counted forward from `anchor`, each step taking the gap of the
 * window *it* lands in.
 *
 * So a sequence can change interval mid-way — a 21:00 feed is followed at three
 * hours, and the one after that at four, because it starts inside the night
 * window. Counted from the last feed's start (D-040), never from now, so the
 * list does not creep forward while nobody is logging.
 */
export function feedTimeline(anchor: Date, count = 10, list = cycles()): Date[] {
  const out: Date[] = []
  let t = anchor
  for (let i = 0; i < count; i++) {
    const c = cycleFor(t, list)
    t = new Date(t.getTime() + c.gap * 60_000)
    out.push(t)
  }
  return out
}

/**
 * The next three feeds to show, positioned so the first row is the nearest one
 * — or the one just passed, when a feed is overdue.
 *
 * Showing the passed one is the point: it is the row a tired person is looking
 * for, and dropping it off the top would leave the card describing a future
 * that has already moved on.
 */
export function upcomingFeeds(anchor: Date | null, now: Date, list = cycles()): Date[] {
  if (!anchor) return []
  const all = feedTimeline(anchor, 10, list)
  let idx = all.findIndex((d) => d.getTime() > now.getTime())
  if (idx < 0) idx = all.length - 3
  return all.slice(Math.max(0, idx > 0 ? idx - 1 : 0), Math.max(0, idx > 0 ? idx - 1 : 0) + 3)
}

/** `3h`, or `2h 30m` where the gap is not whole hours. */
export const gapText = (mins: number) =>
  mins % 60 === 0 ? `${mins / 60}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`

/**
 * Whether a window is a night one, derived from where it starts rather than
 * stored — a window beginning between 05:00 and 19:00 is a day window.
 *
 * Derived so the label cannot fall out of step with the hours after the tune
 * screen has moved them.
 */
export const isNightCycle = (c: Cycle) => !(c.from >= 300 && c.from < 1140)
