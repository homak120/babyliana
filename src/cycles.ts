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
 * **The shared truth is `baby.cycles`** (D-052). localStorage is the local
 * *cache* of it, and exists for one reason: `cycleFor` is called during render,
 * by `targetWake` among others, and IndexedDB is asynchronous. A synchronous
 * read has to come from somewhere.
 *
 * So the flow is: `hydrate` copies the pulled row down into the cache, and
 * `setCycles` writes the cache while `saveCycles` in `moments.ts` writes the
 * row and queues it for push. Both phones converge on whichever write reaches
 * the server last — there is no merge, and for one pair of numbers there does
 * not need to be.
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

/**
 * Take the pulled row's cycle as the local answer.
 *
 * **Only when there is one.** A missing key means nobody has ever set a cycle,
 * and adopting it would throw away a change made on this phone before its first
 * successful sync — which is exactly when the row is missing.
 *
 * Returns whether anything moved, so the screen can re-render on a change that
 * arrived from the other phone rather than from a tap.
 */
export function hydrateCycles(settings: { cycles?: Cycle[] } | null | undefined): boolean {
  const theirs = settings?.cycles
  if (!theirs || !Array.isArray(theirs) || theirs.length === 0) return false
  const next = parse(JSON.stringify(theirs))
  if (same(next, cycles())) return false
  setCycles(next)
  return true
}

/**
 * Two cycle lists compared by what they *say*, field by field.
 *
 * **Not `JSON.stringify`.** `jsonb` does not preserve key order — a cycle
 * written as `{id, from, to, gap}` comes back from Postgres as
 * `{id, to, gap, from}`, identical in meaning and different as a string. A
 * string comparison would call every pull a change, rewrite the cache and
 * repaint the card each time. Caught by a `verify-s2` check that compared the
 * round-trip the same wrong way.
 */
export const same = (a: Cycle[], b: Cycle[]) =>
  a.length === b.length
  && a.every((c, i) => c.id === b[i].id && c.from === b[i].from
    && c.to === b[i].to && c.gap === b[i].gap)

/** Whether this phone is holding something other than the defaults. Used to
 *  decide if a local setting is worth pushing up to an empty row. */
export const isDefaultCycles = () => same(cycles(), DEFAULT_CYCLES)

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
export type FeedStep = {
  at: Date
  /**
   * The window whose gap *produced* this time — the one the step started in,
   * not the one it landed in.
   *
   * They differ exactly when a step crosses a boundary, and that is the case
   * the chip exists for: a 19:40 feed plus the day's three hours is 22:40,
   * which is itself inside the night window. Labelling it from where it landed
   * put `4h` beside two times three hours apart.
   */
  cycle: Cycle
}

export function feedTimeline(anchor: Date, count = 10, list = cycles()): FeedStep[] {
  const out: FeedStep[] = []
  let t = anchor
  for (let i = 0; i < count; i++) {
    const cycle = cycleFor(t, list)
    t = new Date(t.getTime() + cycle.gap * 60_000)
    out.push({ at: t, cycle })
  }
  return out
}

/**
 * How many rows the next-feeds tab shows. Four as of D-051, up from the
 * handoff's three — with the day gap at 3h the fourth reaches nine to twelve
 * hours out, which is what makes the list cover a night rather than an evening.
 */
export const UPCOMING = 4

/**
 * The next feeds to show, positioned so the first row is the nearest one — or
 * the one just passed, when a feed is overdue.
 *
 * Showing the passed one is the point: it is the row a tired person is looking
 * for, and dropping it off the top would leave the card describing a future
 * that has already moved on.
 */
export function upcomingFeeds(
  anchor: Date | null,
  now: Date,
  list = cycles(),
  count = UPCOMING,
): FeedStep[] {
  if (!anchor) return []
  // Enough headroom that the window never runs off the end of the timeline,
  // however far behind the anchor is.
  const all = feedTimeline(anchor, count + 8, list)
  let idx = all.findIndex((s) => s.at.getTime() > now.getTime())
  if (idx < 0) idx = all.length - count
  const start = Math.max(0, idx > 0 ? idx - 1 : 0)
  return all.slice(start, start + count)
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
