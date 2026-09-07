// Time arithmetic for the add sheet, kept apart from the component so the rules
// can be checked without a browser.
//
// D-018 removed the `?` the paper log uses for an unknown time, on the grounds
// that a phone knows what time it is and `04:?` is a workaround for a pen that
// does not. That puts the whole weight on adjustment being fast — which is what
// this exists for.

export const HOLD_MS = 110
/** Ticks before the step grows, ≈1.5s at HOLD_MS. */
export const HOLD_ACCELERATE_AFTER = 14
export const HOLD_BIG_STEP = 5

export const stepFor = (ticks: number) =>
  ticks >= HOLD_ACCELERATE_AFTER ? HOLD_BIG_STEP : 1

/** Minutes back from now, for the shortcut pills. */
export const MINUTE_OFFSETS = [5, 10, 15, 20, 30, 45, 60]
/** Shown collapsed until the `…` toggle — the first two cover most cases. */
export const COLLAPSED_OFFSETS = 2

/** Minutes forward from the start, for the end-time shortcuts. */
export const END_OFFSETS = [30, 60, 120, 180, 240]

export const minutesAgo = (mins: number, now = new Date()) =>
  new Date(now.getTime() - mins * 60_000)

export const minutesAfter = (from: Date, mins: number) =>
  new Date(from.getTime() + mins * 60_000)

/**
 * How far ahead a typed time may land before it is read as yesterday.
 *
 * The old value was one minute, which made nudging a time two minutes forward
 * file the entry a full day earlier — silently. Six hours still catches the case
 * this rule exists for (23:45 typed at 00:30 is 23 hours ahead) while leaving
 * ordinary correction alone. A time slightly in the future is visible and
 * fixable; a 23-hour error is neither.
 */
const FUTURE_TOLERANCE_MS = 6 * 60 * 60_000

/**
 * Set an hour and minute on a date, resolving which *day* is meant.
 *
 * Two rules, and they are separate:
 *
 * 1. **The day comes from `anchor`**, which is the moment being edited. Editing
 *    a feed from three days ago and nudging its minute must not drag it to
 *    today — it did, because this always anchored to the current date.
 * 2. **Only a moment being logged today can fall back a day.** If the clock
 *    reads 00:30 and you type 23:45 you mean last night, so it lands on
 *    yesterday. Without that, backdating across midnight files a feed almost 24
 *    hours ahead, which is exactly when someone is most likely to be doing it.
 */
export function withHourMinute(h: number, m: number, now = new Date(), anchor = now): Date {
  const d = atHourMinute(h, m, anchor)
  const editingToday = startOfDay(anchor).getTime() === startOfDay(now).getTime()
  if (editingToday && d.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

/**
 * The clock set on the anchor's own day, and nothing else — no inference about
 * which day was meant.
 *
 * What `withHourMinute` does once the day question is already answered. The
 * time card uses it directly after the date has been set by hand (D-043): an
 * explicit date is an answer, and a rule that then moved the entry anyway would
 * be overruling the person who gave it.
 */
export function atHourMinute(h: number, m: number, anchor: Date): Date {
  const d = new Date(anchor)
  d.setHours(clampHour(h), clampMinute(m), 0, 0)
  return d
}

/**
 * Move a moment to another day, carrying its end with it (D-043).
 *
 * The end is shifted by the same number of days rather than re-anchored, which
 * is what keeps a period that crosses midnight intact: a sleep from 9/2 23:00
 * to 9/3 07:00 stepped back a day is 9/1 23:00 to 9/2 07:00, still eight hours.
 * `resolveEnd` afterwards is belt and braces — the shift preserves the ordering
 * it fixes.
 */
export function onDay(start: Date, end: Date | null, days: number): {
  start: Date
  end: Date | null
} {
  const s = new Date(start)
  s.setDate(s.getDate() + days)
  if (!end) return { start: s, end: null }
  const e = new Date(end)
  e.setDate(e.getDate() + days)
  return { start: s, end: resolveEnd(s, e) }
}

/**
 * How many days back a moment sits. `0` is today, `1` yesterday, and a negative
 * number is the future — which the date stepper refuses.
 *
 * Compared at the day boundary rather than by dividing a millisecond gap, so a
 * clock change does not make yesterday 0.96 of a day ago.
 */
export function daysBack(d: Date, now = new Date()): number {
  return Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  )
}

/** `today`, `yesterday`, or the paper log's own `9/1`. */
export function dayWord(d: Date, now = new Date()): string {
  const back = daysBack(d, now)
  if (back === 0) return 'today'
  if (back === 1) return 'yesterday'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const clampHour = (h: number) => Math.min(23, Math.max(0, h))
export const clampMinute = (m: number) => Math.min(59, Math.max(0, m))

/** Wraps rather than sticking, so holding − past 00 rolls to 23. */
export const wrapHour = (h: number) => ((h % 24) + 24) % 24
export const wrapMinute = (m: number) => ((m % 60) + 60) % 60

export const pad = (n: number) => String(n).padStart(2, '0')

/**
 * `40s`, `4m 10s`, `1h 04m` — a count that is being watched (D-045).
 *
 * Seconds while they matter and not once they do not: under an hour the seconds
 * are the thing moving, and past it the minute is. Distinct from
 * `formatDuration`, which reads a period that is over and has no use for a
 * second hand.
 */
export function countUp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(sec)}s`
  return `${sec}s`
}

/** `25 min`, `1h 05m`. Words, because a bare number of minutes reads slower. */
export function formatDuration(start: Date, end: Date): string {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
  const h = Math.floor(mins / 60)
  return h === 0 ? `${mins} min` : `${h}h ${pad(mins % 60)}m`
}

/**
 * An end before its start means the period crossed midnight — 23:00 to 01:30 is
 * a real sleep. Push the end to the next day rather than rejecting it, since the
 * database constraint would refuse it and the user would only see a failure.
 */
export function resolveEnd(start: Date, end: Date): Date {
  if (end.getTime() >= start.getTime()) return end
  const next = new Date(end)
  next.setDate(next.getDate() + 1)
  return next
}

/**
 * The end time meant by "now", for a moment that may not be today.
 *
 * Anchored to the start's day for the same reason `withHourMinute` is: ending a
 * period logged three days ago means that day's clock, not this instant. Landing
 * before the start then reads as a period that ran past midnight — a sleep begun
 * at 23:00 and ended at 07:00 is exactly the case — so it moves to the next day.
 * A start that is itself in the future has no such reading, and clamps to the
 * start rather than inventing a 23-hour period.
 */
export function endNow(start: Date, now = new Date()): Date {
  const at = withHourMinute(now.getHours(), now.getMinutes(), now, start)
  if (at.getTime() >= start.getTime()) return at
  return start.getTime() <= now.getTime() ? resolveEnd(start, at) : new Date(start)
}
