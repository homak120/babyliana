import type { DraftEntry, EventType, Moment, PoopColour, PoopConsistency, Source } from '../types'

// What the sheet edits before ids and timestamps are attached. Kept out of the
// component files so those export components only — and because the "does this
// block say anything" rules are logic worth testing on their own.

export type MilkPart = { volume: number | null; source: Source }

/**
 * One card, up to two parts.
 *
 * The design puts both parts in the same card — "selecting a part moves the
 * underline to it, and the row reads 30 + 30" — with one keypad editing
 * whichever is active. Storage still makes them two feed events (D-019); the
 * card is how they are entered, not how they are kept.
 *
 * No `unknown` flag: a null volume *is* the paper's `?`. One representation.
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
 * None of them gets its own fields. The design's answer is "pick one, write the
 * rest in the note", which is also the honest one: Q-006 decides by observed use
 * in Phase 8 which of these deserves a proper input, and building five of them
 * now would be inventing requirements. The schema's `grams` and `celsius`
 * columns stay unused until a type is promoted.
 */
export const OTHER_TYPES: { kind: EventType; label: string }[] = [
  { kind: 'sleep', label: 'sleep' },
  { kind: 'weight', label: 'weight' },
  { kind: 'temperature', label: 'temperature' },
  { kind: 'supplement', label: 'supplement' },
  { kind: 'spit_up', label: 'spit up' },
  { kind: 'other', label: 'something else' },
]

export type OtherDraft = { kind: EventType | null }

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
  | { key: string; ids?: string[]; type: 'other'; draft: OtherDraft }

export const blockIsEmpty = (b: Block) =>
  b.type === 'milk'
    ? milkIsEmpty(b.draft)
    : b.type === 'diaper'
      ? diaperIsEmpty(b.draft)
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
  // `other` carries nothing but its type — the moment's note holds the detail.
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
    } else {
      blocks.push({ key, ids: [e.id], type: 'other', draft: { kind: e.type } })
    }
  }
  return blocks
}
