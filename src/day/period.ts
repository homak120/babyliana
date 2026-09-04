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
