// The feeding cycle: how long a feed is expected to hold, by time of day.
//
// One source of truth for two things that must never disagree — the ceiling on
// the top card (`targetWake`, D-036) and the next-feed estimates on its second
// tab (D-050). Before this, the 3h/4h split lived inside `targetWake` as two
// constants; the tune screen made it something a person can change, so it had
// to come out.

import { DEFAULT_CYCLES, hydrate, isDefault, read, resetSettings, write } from './settings'

export { DEFAULT_CYCLES }

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
 * The cycle is a key on `baby.settings`, and `settings.ts` is the registry that
 * owns its default, its parse and its comparison — along with every other
 * shared setting's (D-055).
 *
 * These five are thin adapters over it, kept because the cycle is read by name
 * all over the app and `cycles()` says more at a call site than
 * `read('cycles')` does. The bespoke cache, the bespoke parse and the bespoke
 * default that used to live here are gone: they were right for one setting and
 * would have been four copies drifting apart at four.
 */
export const cycles = (): Cycle[] => read('cycles')

export const setCycles = (next: Cycle[]): void => write('cycles', next)

/** Whether this phone is holding something other than the defaults. Used to
 *  decide if a local setting is worth pushing up to an empty row. */
export const isDefaultCycles = () => isDefault('cycles')

/** Forgets every cached setting, for suites that write one behind the module. */
export const resetCycles = resetSettings

/**
 * Take the pulled row's cycle as the local answer.
 *
 * The cycle's slice of `hydrate`, kept as a named export because `verify-s3`
 * exercises this direction on its own — a pulled row with a cycle wins, a row
 * without one changes nothing.
 */
export const hydrateCycles = (settings: { cycles?: Cycle[] } | null | undefined): boolean =>
  hydrate(settings?.cycles === undefined ? null : { cycles: settings.cycles })

/**
 * Two cycle lists compared by what they *say*, field by field — never
 * `JSON.stringify`, for the reason `settings.ts` spells out at length.
 */
export const same = (a: Cycle[], b: Cycle[]) =>
  a.length === b.length
  && a.every((c, i) => c.id === b[i].id && c.from === b[i].from
    && c.to === b[i].to && c.gap === b[i].gap)

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
