// The shared settings: one registry, one reconcile, one cache.
//
// `baby.settings` is a single `jsonb` object keyed by setting name (D-052), so
// a new setting is a new key and never a migration. This module is the other
// half of that bargain: the place a key declares its default, how to parse it
// and how to compare it, so the *second* setting costs a registry entry rather
// than a `hydrateX`/`isDefaultX`/`same` trio of its own.
//
// It was a trio, for `cycles`, and that was right for one. Four of them would
// have been four copies drifting apart — see `.specify/memory/settings.md`.

import type { Cycle } from './cycles'
import type { BabySettings, Source } from './types'

/** What the bar's bottle icon writes. `unknown` is deliberately unreachable
 *  from the settings screen — see `BOTTLE` below. */
export type BottleDefault = { volume: number; source: Source }
export type SupplementDefault = { name: string; amount: string }

/**
 * Day 3h, night 4h — the numbers `targetWake` used as constants before the tune
 * screen existed, and the same 22:00–06:00 boundary (D-036). The defaults
 * reproduce the old behaviour exactly, so nothing moves for anyone who never
 * opens the screen.
 */
export const DEFAULT_CYCLES: Cycle[] = [
  { id: 'day', from: 6 * 60, to: 22 * 60, gap: 180 },
  { id: 'night', from: 22 * 60, to: 6 * 60, gap: 240 },
]

/**
 * 60 mL of formula: the commonest feed in the real log by a distance, which is
 * the entire argument for a one-tap bottle.
 *
 * **The screen offers breast milk or formula and not `unknown`.** The quick
 * icon is for the feed you do not have to think about, and that feed has a
 * known source; the paper's unlabelled `30 + 30` is still reachable, because
 * `newMilk()` starts at `unknown` and `+ milk` is where a feed you are unsure
 * about is entered anyway.
 */
export const DEFAULT_BOTTLE: BottleDefault = { volume: 60, source: 'formula' }

/**
 * The daily vitamin D — the supplement this app is actually used for, the same
 * two words and the same dose every time.
 *
 * A setting rather than a constant because the constant was one family's
 * routine hard-coded: a different vitamin, or a dose the paediatrician moves,
 * and it is retyped every single day. That is axis 2 in `settings.md`.
 */
export const DEFAULT_SUPPLEMENT: SupplementDefault = { name: 'Vitamin D', amount: '1 drop' }

/**
 * Fifteen minutes is roughly what warming a bottle takes, which is the whole
 * reason the prompt exists — knowing the feed is due is not the same as having
 * the bottle ready when it is.
 *
 * Tunable because "roughly" is per-household: a bottle out of the fridge and
 * one that has been standing on the side are not the same fifteen minutes.
 */
export const DEFAULT_PREP_LEAD = 15

/**
 * What one shared setting has to say about itself.
 *
 * `parse` takes whatever came back from Postgres — or out of a stale
 * localStorage cache written by an older build — and returns something safe to
 * render. It falls back rather than throwing: a corrupt preference must not be
 * able to stop the card drawing.
 */
type Spec<K extends keyof BabySettings> = {
  fallback: NonNullable<BabySettings[K]>
  /**
   * **`null` means unusable, which is not the same as absent.**
   *
   * A row carrying junk — an empty cycle list, a volume of zero — means
   * *nothing*, and must not be read as meaning the default. If it were,
   * hydrating from a corrupt row would quietly reset a setting this phone had
   * deliberately changed, and the two phones would fight over it. `read` falls
   * back on null; `hydrate` skips the key entirely and leaves local alone.
   */
  parse: (v: unknown) => NonNullable<BabySettings[K]> | null
  /**
   * Field by field, **never `JSON.stringify`**.
   *
   * `jsonb` does not preserve key order: a cycle written `{id, from, to, gap}`
   * comes back `{id, to, gap, from}` — the same thing and a different string. A
   * string comparison calls every pull a change, rewrites the cache and
   * repaints the card. That bug shipped once (D-052) and the check written to
   * catch it was making the same mistake, which is how both were found at once.
   */
  same: (a: NonNullable<BabySettings[K]>, b: NonNullable<BabySettings[K]>) => boolean
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {}

const CYCLES: Spec<'cycles'> = {
  fallback: DEFAULT_CYCLES,
  parse: (v) => {
    if (!Array.isArray(v) || v.length === 0) return null
    const ok = v.every(
      (c) => c && typeof c.from === 'number' && typeof c.to === 'number' && c.gap > 0,
    )
    return ok ? (v as Cycle[]) : null
  },
  same: (a, b) =>
    a.length === b.length
    && a.every((c, i) => c.id === b[i].id && c.from === b[i].from
      && c.to === b[i].to && c.gap === b[i].gap),
}

const BOTTLE: Spec<'bottle'> = {
  fallback: DEFAULT_BOTTLE,
  parse: (v) => {
    if (v === null || typeof v !== 'object') return null
    const o = obj(v)
    // A volume of 0 is not a feed and a negative one is nonsense. Either way
    // the value is unusable, not defaultable — the icon writes a row with no
    // confirmation step behind it, so a volume this build cannot vouch for must
    // not become one it silently logs.
    const volume = num(o.volume, 0)
    if (volume <= 0) return null
    // The source is the one field that *is* defaultable, and for a specific
    // reason: a newer build may write a source this one has never heard of, and
    // the right answer to that is to show something sane locally rather than to
    // discard the whole setting. Nothing is written back, so the newer value
    // survives on the row untouched.
    const source = o.source === 'breast_milk' || o.source === 'formula' || o.source === 'unknown'
      ? o.source
      : DEFAULT_BOTTLE.source
    return { volume, source }
  },
  same: (a, b) => a.volume === b.volume && a.source === b.source,
}

const SUPPLEMENT: Spec<'supplement'> = {
  fallback: DEFAULT_SUPPLEMENT,
  parse: (v) => {
    if (v === null || typeof v !== 'object') return null
    const o = obj(v)
    // Empty strings are kept, not replaced: clearing the prefill is a thing
    // someone may mean, and the block then opens blank rather than arguing.
    return {
      name: str(o.name, DEFAULT_SUPPLEMENT.name),
      amount: str(o.amount, DEFAULT_SUPPLEMENT.amount),
    }
  },
  same: (a, b) => a.name === b.name && a.amount === b.amount,
}

const PREP_LEAD: Spec<'prepLeadMinutes'> = {
  fallback: DEFAULT_PREP_LEAD,
  parse: (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    // Zero is meaningful — the prompt appears exactly at the target — so the
    // floor is zero and not one. Negative would put it *after* the feed is due,
    // which is the one thing the prompt exists to avoid.
    return v >= 0 ? Math.round(v) : null
  },
  same: (a, b) => a === b,
}

/**
 * A mapped type rather than an object literal, so indexing with a generic `K`
 * yields `Spec<K>` and not the union of all four — which is what lets `read`,
 * `write` and `hydrate` be written once, generically, instead of switching on
 * the key. `Required` is what makes leaving a key out a compile error: every
 * optional field on `BabySettings` must appear here or it can never be read.
 */
type Specs = { [K in keyof Required<BabySettings>]: Spec<K> }

const SPECS: Specs = {
  cycles: CYCLES,
  bottle: BOTTLE,
  supplement: SUPPLEMENT,
  prepLeadMinutes: PREP_LEAD,
}

export type SettingKey = keyof Specs

export const SETTING_KEYS = Object.keys(SPECS) as SettingKey[]

/**
 * **The shared truth is `baby.settings`; this is the local cache of it.**
 *
 * The cache exists for one reason: `read` is called during render — `cycleFor`
 * by way of `targetWake`, `quickMilk` by way of the bar — and IndexedDB is
 * asynchronous. A synchronous read has to come from somewhere.
 *
 * So the flow is: a pull hydrates the cache from the row, and a tap writes the
 * cache and queues the row. Both phones converge on whichever write reaches the
 * server last. There is no merge, and for these values there does not need to
 * be one — but note that two phones editing *different* keys at once still
 * resolve last-write-wins over the whole object, and one loses (D-052).
 */
const cached = new Map<SettingKey, unknown>()

const storageKey = (k: SettingKey) => `babyliana.${k}`

const store = (): Storage | null =>
  typeof localStorage === 'undefined' ? null : localStorage

export function read<K extends SettingKey>(key: K): NonNullable<BabySettings[K]> {
  const hit = cached.get(key)
  if (hit !== undefined) return hit as NonNullable<BabySettings[K]>
  const spec = SPECS[key]
  const raw = store()?.getItem(storageKey(key)) ?? null
  let value = spec.fallback
  if (raw !== null) {
    try {
      value = spec.parse(JSON.parse(raw)) ?? spec.fallback
    } catch {
      // A corrupt preference must not be able to stop the card drawing.
      value = spec.fallback
    }
  }
  cached.set(key, value)
  return value
}

/** Writes the local cache only. The row and the push are `saveSetting`'s, in
 *  `moments.ts` — local first, so the screen repaints with or without network. */
export function write<K extends SettingKey>(key: K, value: NonNullable<BabySettings[K]>): void {
  const spec = SPECS[key]
  const parsed = spec.parse(value) ?? spec.fallback
  cached.set(key, parsed)
  store()?.setItem(storageKey(key), JSON.stringify(parsed))
}

/** Whether this phone holds something other than the shipped default — which is
 *  what decides if a local value is worth pushing up to a row that has none. */
export function isDefault<K extends SettingKey>(key: K): boolean {
  const spec = SPECS[key]
  return spec.same(read(key), spec.fallback)
}

/**
 * Take the pulled row's settings as the local answer, key by key.
 *
 * **Only keys the row actually has.** A missing key means nobody has ever set
 * it, and adopting a default over the top would throw away a change made on
 * this phone before its first successful sync — which is exactly when the key
 * is missing.
 *
 * Returns whether anything moved, so the screen can repaint on a change that
 * arrived from the other phone rather than from a tap.
 */
export function hydrate(settings: BabySettings | null | undefined): boolean {
  if (!settings) return false
  let moved = false
  for (const key of SETTING_KEYS) {
    const theirs = settings[key]
    if (theirs === undefined || theirs === null) continue
    const spec = SPECS[key] as Spec<SettingKey>
    const next = spec.parse(theirs)
    // Junk on the row is not an instruction to reset. Leave local alone.
    if (next === null) continue
    if (spec.same(next, read(key) as never)) continue
    write(key, next as never)
    moved = true
  }
  return moved
}

/**
 * The keys this phone should push up: ones the row does not carry where this
 * phone is holding something other than the default.
 *
 * This is the half that closes the hole `saveSetting` leaves. It returns
 * silently when the `baby` row has not arrived yet — a fresh install that has
 * never synced — because there is no row to update and one cannot be invented
 * (`baby.name` is `not null` and this phone does not know it). Without this, a
 * setting changed before the first sync would sit local forever.
 */
export function unsynced(settings: BabySettings | null | undefined): SettingKey[] {
  return SETTING_KEYS.filter((k) => !settings?.[k] && !isDefault(k))
}

/** Forgets the cache, for suites that write a preference behind the module. */
export function resetSettings(): void {
  cached.clear()
}
