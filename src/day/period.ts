/** Date helpers for the period picker, kept out of the component file. */

export type Range = { from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

/** Local date as yyyy-mm-dd. Never toISOString — that is UTC and shifts the day. */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** M/D, matching the date pills rather than the ISO used for comparison. */
export const shortOf = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

export const rangeLabel = (r: Range) =>
  r.from === r.to ? shortOf(r.from) : `${shortOf(r.from)} – ${shortOf(r.to)}`

export const shiftIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoOf(d)
}

export const pad2 = pad

/**
 * The day `delta` steps away from `selected`, or null at either end.
 *
 * `days` is newest first (`daysWithEntries`), so **+1 is older** and −1 newer.
 * That inversion is the whole reason this is a named function rather than an
 * index sum inside the component: a left swipe means "older", and reading
 * `days[here + 1]` at the call site says the opposite of what it does.
 *
 * Only days that have entries are in the list, so stepping skips the gaps and a
 * swipe never lands on an empty table. Null at the ends rather than wrapping —
 * a log has a first day and a most recent one, and looping past either would be
 * a lie about the data.
 */
export function stepDay(days: Date[], selected: Date, delta: number): Date | null {
  const here = days.findIndex((d) => +d === +selected)
  if (here === -1) return null
  return days[here + delta] ?? null
}
