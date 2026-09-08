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
 * What is left behind `other` — the two types that carry no value of their own.
 *
 * Weight, temperature and supplement used to be here. They have their own
 * bubbles and their own blocks now (D-038), because they each capture something
 * and a type buried in a list of five was the wrong shape for that. Sleep left
 * the same way, earlier and for the same reason.
 *
 * What remains is the escape hatch proper: pick one, write the rest in the
 * note. Neither has a value to capture, so neither wants a field.
 */
export const OTHER_TYPES: { kind: EventType; label: string }[] = [
  { kind: 'spit_up', label: 'spit up' },
  { kind: 'other', label: 'something else' },
]

export type OtherDraft = { kind: EventType | null }

/**
 * The three that carry a value. Every field is a **string**, including the two
 * numbers.
 *
 * `7.` is a legal thing to be halfway through typing, and a number-typed state
 * cannot hold it — it would eat the decimal point as fast as it was tapped.
 * Parsing happens once, on save.
 *
 * Weight is typed as a decimal number of **pounds** and temperature in **°F**,
 * both stored as typed (migration 0003). The row reads the weight back as
 * `7 lb 4 oz`; the conversion is display only, so a weight reopened for editing
 * shows the number that was entered and re-saving it cannot drift.
 */
export type WeightDraft = { lb: string }
export type TemperatureDraft = { fahrenheit: string }

/**
 * `preset` marks a suggestion nobody has touched yet — the same idea as
 * `MilkPart.preset`, and for the same reason: a prefill only earns its place if
 * disagreeing with it is free. Focusing a field while this is set selects what
 * is in it, so the first character typed replaces the whole suggestion instead
 * of landing in the middle of it. Any edit clears the flag.
 */
export type SupplementDraft = { name: string; amount: string; preset?: boolean }

/**
 * What a new supplement block arrives with, already filled in.
 *
 * The daily vitamin D is the supplement this app is actually used for, and it
 * is the same two words and the same dose every time — so typing them is pure
 * cost. Same argument as the quick bottle's 60 mL: a suggestion, not a claim.
 *
 * Weight and temperature get no prefill, deliberately — there is no number that
 * is right more often than any other, and a wrong one saved by accident is a
 * false reading rather than a mild annoyance.
 */
export const SUPPLEMENT_PRESET = { name: 'Vitamin D', amount: '1 drop' }

export const newWeight = (): WeightDraft => ({ lb: '' })
export const newTemperature = (): TemperatureDraft => ({ fahrenheit: '' })
export const newSupplement = (): SupplementDraft => ({
  name: SUPPLEMENT_PRESET.name,
  amount: SUPPLEMENT_PRESET.amount,
  preset: true,
})

/**
 * `7.25` → `7 lb 4 oz`, for reading a stored weight back.
 *
 * Whole ounces, rounded — a scale reads 4 oz, not 4.0. Sixteen rounds up into
 * the next pound rather than printing `7 lb 16 oz`, which is the one case a
 * naive `Math.round` gets visibly wrong. Exact pounds drop the ounces
 * altogether: `7 lb`, not `7 lb 0 oz`.
 */
export function poundsToLbOz(pounds: number): string {
  const oz = Math.round(pounds * 16)
  const lb = Math.floor(oz / 16)
  const rest = oz % 16
  return rest === 0 ? `${lb} lb` : `${lb} lb ${rest} oz`
}

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

export const newOther = (): OtherDraft => ({ kind: null })

/** Nothing picked yet says nothing. */
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
  | { key: string; ids?: string[]; type: 'weight'; draft: WeightDraft }
  | { key: string; ids?: string[]; type: 'temperature'; draft: TemperatureDraft }
  | { key: string; ids?: string[]; type: 'supplement'; draft: SupplementDraft }
  | { key: string; ids?: string[]; type: 'other'; draft: OtherDraft }

/**
 * Only `milk`, `diaper` and `other` can say nothing.
 *
 * The rest say everything by being there — a sleep block is a sleep, and a
 * weight block is a weighing whether or not anyone caught the number. A blank
 * value is the paper's `?`: it happened, the figure is unknown. Requiring one
 * would make the app unable to record something the paper does.
 */
export const blockIsEmpty = (b: Block) =>
  b.type === 'milk'
    ? milkIsEmpty(b.draft)
    : b.type === 'diaper'
      ? diaperIsEmpty(b.draft)
      : b.type === 'other'
        ? otherIsEmpty(b.draft)
        : false

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
  if (b.type === 'weight') return [{ type: 'weight', pounds: numberOrNull(b.draft.lb) }]
  if (b.type === 'temperature') {
    return [{ type: 'temperature', fahrenheit: numberOrNull(b.draft.fahrenheit) }]
  }
  if (b.type === 'supplement') {
    return [{
      type: 'supplement',
      supplement_name: textOrNull(b.draft.name),
      amount: textOrNull(b.draft.amount),
    }]
  }
  // The two that have no value to carry — spit up, and something else. Their
  // detail lives in the moment's note, as it always has.
  return [{ type: b.draft.kind! }]
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
    } else if (e.type === 'weight') {
      blocks.push({
        key, ids: [e.id], type: 'weight',
        draft: { lb: e.pounds === null ? '' : String(e.pounds) },
      })
    } else if (e.type === 'temperature') {
      blocks.push({
        key, ids: [e.id], type: 'temperature',
        draft: { fahrenheit: e.fahrenheit === null ? '' : String(e.fahrenheit) },
      })
    } else if (e.type === 'supplement') {
      // No `preset`: reopening is a restore, not a suggestion. Setting it would
      // make the first tap in the field select and wipe what is stored there.
      blocks.push({
        key, ids: [e.id], type: 'supplement',
        draft: { name: e.supplement_name ?? '', amount: e.amount ?? '' },
      })
    } else {
      blocks.push({ key, ids: [e.id], type: 'other', draft: { kind: e.type } })
    }
  }
  return blocks
}

/**
 * The bar's bottle and its bedtime button, as entries rather than as blocks.
 *
 * Both quick icons write straight to the log now — no sheet, no second tap on a
 * save button — so there is no block left to convert when the moment is saved.
 * The defaults still have exactly one definition each, and `toEntries` is still
 * the only thing that turns a draft into rows: what the bottle means is decided
 * by `quickMilk` here, in the same place it was decided when the icon opened a
 * sheet on it.
 */
export const quickFeedEntries = (): DraftEntry[] =>
  toEntries({ key: 'quick', type: 'milk', draft: quickMilk() })

export const quickSleepEntries = (): DraftEntry[] =>
  toEntries({ key: 'quick', type: 'sleep', draft: newSleep() })
