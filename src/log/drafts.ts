import type { DraftEntry, EventType, Moment, PoopColour, PoopConsistency, Source } from '../types'

// What the sheet edits before ids and timestamps are attached. Kept out of the
// component files so those export components only — and because the "does this
// block say anything" rules are logic worth testing on their own.

/**
 * `preset` marks a volume the app suggested rather than one a person entered —
 * the quick bottle's 60 mL. The first digit typed replaces it instead of being
 * appended to it, so the suggestion never costs a tap to get rid of.
 */
export type MilkPart = { volume: number | null; source: Source; preset?: boolean }

/**
 * One card, up to two parts.
 *
 * The design puts both parts in the same card — "selecting a part moves the
 * underline to it, and the row reads 30 + 30" — with one keypad editing
 * whichever is active. Storage still makes them two feed events (D-019); the
 * card is how they are entered, not how they are kept.
 *
 * No `unknown` flag: a null volume *is* the paper's `?`. One representation.
 *
 * Nothing here says whether the feed is still going, either. That is the time
 * card's business — an open period is a missing end time (D-033) — and the block
 * carries only what a feed *is*.
 */
export type MilkDraft = { parts: MilkPart[]; active: number }

export type DiaperDraft = {
  pee: boolean
  poop: boolean
  colour: PoopColour | null
  consistency: PoopConsistency | null
}

export const newMilk = (): MilkDraft => ({ parts: [{ volume: null, source: 'unknown' }], active: 0 })

/**
 * What the bar's bottle opens with: 60 mL of formula, already filled in.
 *
 * The quick icon exists to make the commonest feed a two-tap entry, and the
 * commonest feed has a volume and a source. It is a suggestion, not a claim —
 * the first digit typed replaces the 60, and the source toggles off — so it
 * costs nothing to disagree with. `+ milk` inside the sheet still starts blank,
 * because a feed added by hand is as often the paper's `?` as it is 60.
 */
export const quickMilk = (): MilkDraft => ({
  parts: [{ volume: 60, source: 'formula', preset: true }],
  active: 0,
})

/**
 * A new diaper block starts as a pee.
 *
 * Not an assumption — the dominant entry across seven days of the real log is a
 * bare `1`. Defaulting to it makes the commonest change zero extra taps, and it
 * is one tap to turn off.
 */
export const newDiaper = (): DiaperDraft => ({
  pee: true,
  poop: false,
  colour: null,
  consistency: null,
})

/**
 * Never empty.
 *
 * A blank volume is the paper's `?` — a feed happened, volume unknown — which
 * the prototype states outright. Requiring a number would make the app unable
 * to record something the paper does about once a day.
 */
export const milkIsEmpty = (_d: MilkDraft) => false

/** Neither flag set records nothing, so it is not savable. */
export const diaperIsEmpty = (d: DiaperDraft) => !d.pee && !d.poop

/**
 * The low-frequency types, kept off the main surface on purpose (D-010).
 *
 * Three of them now carry their own fields — weight, temperature and
 * supplement, on the owner's call (D-036). The other two still say "pick one,
 * write the rest in the note", which for `spit up` and `something else` remains
 * the honest answer: neither has a value to capture.
 */
export const OTHER_TYPES: { kind: EventType; label: string }[] = [
  // Sleep is no longer here: it earned its own block and its own bubble.
  { kind: 'weight', label: 'weight' },
  { kind: 'temperature', label: 'temperature' },
  { kind: 'supplement', label: 'supplement' },
  { kind: 'spit_up', label: 'spit up' },
  { kind: 'other', label: 'something else' },
]

/**
 * Every field is a **string**, including the two numbers.
 *
 * `3.` is a legal thing to be halfway through typing, and a number-typed state
 * cannot hold it — it would eat the decimal point as fast as it was tapped.
 * Parsing happens once, on save.
 *
 * Weight is typed in **kg** and stored in the schema's `grams` (D-036): a scale
 * and a health visitor both say 3.4, and nothing underneath had to change.
 */
export type OtherDraft = {
  kind: EventType | null
  kg: string
  celsius: string
  supplementName: string
  supplementAmount: string
}

/** `3.4` → 3400. Blank, or anything that is not a number, stays null. */
export function kgToGrams(kg: string): number | null {
  const n = Number.parseFloat(kg)
  return Number.isFinite(n) ? Math.round(n * 1000) : null
}

/** 3400 → `3.4`, for the sheet reopened on an existing weight. */
export const gramsToKg = (grams: number): string => String(grams / 1000)

const numberOrNull = (v: string): number | null => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

const textOrNull = (v: string): string | null => v.trim() || null

/**
 * Sleep carries nothing of its own.
 *
 * Its end time is the **timeslot's** `ended_at` (D-020), shared by everything in
 * the moment, so there is no per-event field to hold. That is also what makes an
 * open-ended sleep expressible at all: no end time means still asleep, which is
 * the same blank-means-unknown rule the milk volume already uses.
 */
export type SleepDraft = Record<string, never>

export const newSleep = (): SleepDraft => ({})

export const newOther = (): OtherDraft => ({
  kind: null, kg: '', celsius: '', supplementName: '', supplementAmount: '',
})

/**
 * Nothing picked yet says nothing.
 *
 * A *picked* type with no number in it still says something, and stays savable:
 * a weight nobody read off the scale in time is the same shape as the paper's
 * `?` volume, and the app has never required a value it could record as blank.
 */
export const otherIsEmpty = (d: OtherDraft) => d.kind === null

/**
 * `id` is set when the block came from an existing entry.
 *
 * Editing keeps it, so an unchanged entry keeps its identity instead of being
 * deleted and reinserted under a new id. That keeps the sync small and, more
 * importantly, means correcting a volume does not disturb the diaper logged at
 * the same moment — the paper log's corrections strike a value, not a row.
 */
/**
 * `ids` are the entries this block came from, when it was opened for editing.
 * A milk block can map to two of them, which is why this is a list.
 */
export type Block =
  | { key: string; ids?: string[]; type: 'milk'; draft: MilkDraft }
  | { key: string; ids?: string[]; type: 'diaper'; draft: DiaperDraft }
  | { key: string; ids?: string[]; type: 'sleep'; draft: SleepDraft }
  | { key: string; ids?: string[]; type: 'other'; draft: OtherDraft }

export const blockIsEmpty = (b: Block) =>
  b.type === 'milk'
    ? milkIsEmpty(b.draft)
    : b.type === 'diaper'
      ? diaperIsEmpty(b.draft)
      // Sleep says everything just by being there.
      : b.type === 'sleep'
        ? false
        : otherIsEmpty(b.draft)

/** Save needs at least one block, and every block has to say something. */
export const canSave = (blocks: Block[]) =>
  blocks.length > 0 && !blocks.some(blockIsEmpty)

/** One block, one *or more* entries: a two-part feed is two of them (D-019). */
export function toEntries(b: Block): DraftEntry[] {
  if (b.type === 'milk') {
    return b.draft.parts.map((part) => ({
      type: 'feed' as const,
      // Blank stays blank: null is the `?`, and is not the same as 0.
      volume_ml: part.volume,
      source: part.source,
    }))
  }
  if (b.type === 'diaper') {
    return [{
      type: 'diaper',
      pee: b.draft.pee,
      poop: b.draft.poop,
      poop_colour: b.draft.colour,
      poop_consistency: b.draft.consistency,
    }]
  }
  if (b.type === 'sleep') return [{ type: 'sleep' }]
  const d = b.draft
  if (d.kind === 'weight') return [{ type: 'weight', grams: kgToGrams(d.kg) }]
  if (d.kind === 'temperature') return [{ type: 'temperature', celsius: numberOrNull(d.celsius) }]
  if (d.kind === 'supplement') {
    return [{
      type: 'supplement',
      supplement_name: textOrNull(d.supplementName),
      amount: textOrNull(d.supplementAmount),
    }]
  }
  // The two that have no value to carry — spit up, and something else. Their
  // detail lives in the moment's note, as it always has.
  return [{ type: d.kind! }]
}

/**
 * The reverse: an existing moment, opened for editing.
 *
 * Feeds collapse back into milk cards of up to two parts, which is how they
 * were entered even though they are stored separately.
 */
export function blocksFromMoment(m: Moment): Block[] {
  const feeds = m.events.filter((e) => e.type === 'feed')
  const rest = m.events.filter((e) => e.type !== 'feed')
  const blocks: Block[] = []

  for (let i = 0; i < feeds.length; i += 2) {
    const pair = feeds.slice(i, i + 2)
    blocks.push({
      key: crypto.randomUUID(),
      ids: pair.map((e) => e.id),
      type: 'milk',
      draft: {
        parts: pair.map((e) => ({ volume: e.volume_ml, source: e.source ?? 'unknown' })),
        active: 0,
      },
    })
  }

  for (const e of rest) {
    const key = crypto.randomUUID()
    if (e.type === 'diaper') {
      blocks.push({
        key, ids: [e.id], type: 'diaper',
        draft: {
          pee: e.pee ?? false, poop: e.poop ?? false,
          colour: e.poop_colour, consistency: e.poop_consistency,
        },
      })
    } else if (e.type === 'sleep') {
      blocks.push({ key, ids: [e.id], type: 'sleep', draft: {} })
    } else {
      blocks.push({
        key, ids: [e.id], type: 'other',
        draft: {
          kind: e.type,
          kg: e.grams === null ? '' : gramsToKg(e.grams),
          celsius: e.celsius === null ? '' : String(e.celsius),
          supplementName: e.supplement_name ?? '',
          supplementAmount: e.amount ?? '',
        },
      })
    }
  }
  return blocks
}
