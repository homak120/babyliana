/**
 * Whether clock times read `21:09` or `9:09 PM`.
 *
 * A preference of the phone in your hand, not a fact about the baby, so it
 * stays in localStorage and never syncs — the same reasoning as the lead rail
 * (`LogScreen`) and the device id. Two phones may disagree and that is correct.
 *
 * **24h is the default**, because that is what the paper log is written in and
 * the day table is read side by side with the photographs of it.
 */
export type TimeFormat = '24h' | '12h'

const KEY = 'babyliana.timeformat'

/**
 * Cached after the first read. `hhmm` is called once per row and a day table is
 * long, so this is not a localStorage hit per cell.
 *
 * `null` means "not looked yet"; `undefined` storage means a Node suite, which
 * imports `cells.ts` for the formatters and has no localStorage at all.
 */
let cached: TimeFormat | null = null

const store = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage

export function timeFormat(): TimeFormat {
  if (cached) return cached
  const v = store()?.getItem(KEY)
  cached = v === '12h' ? '12h' : '24h'
  return cached
}

export function setTimeFormat(f: TimeFormat): void {
  cached = f
  store()?.setItem(KEY, f)
}

/** Forgets the cache. For suites that set the preference behind the module. */
export function resetTimeFormat(): void {
  cached = null
}
