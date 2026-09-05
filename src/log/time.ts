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
  const d = new Date(anchor)
  d.setHours(clampHour(h), clampMinute(m), 0, 0)
  const editingToday = startOfDay(anchor).getTime() === startOfDay(now).getTime()
  if (editingToday && d.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const clampHour = (h: number) => Math.min(23, Math.max(0, h))
export const clampMinute = (m: number) => Math.min(59, Math.max(0, m))

/** Wraps rather than sticking, so holding − past 00 rolls to 23. */
export const wrapHour = (h: number) => ((h % 24) + 24) % 24
export const wrapMinute = (m: number) => ((m % 60) + 60) % 60

export const pad = (n: number) => String(n).padStart(2, '0')

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
