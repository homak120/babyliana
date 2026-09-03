import type { DraftEntry, EventType, LogEvent, Moment, PoopColour, PoopConsistency, Source } from '../types'

// What the sheet edits before ids and timestamps are attached. Kept out of the
// component files so those export components only — and because the "does this
// block say anything" rules are logic worth testing on their own.

export type MilkDraft = { volume: number | null; unknown: boolean; source: Source }

export type DiaperDraft = {
  pee: boolean
  poop: boolean
  colour: PoopColour | null
  consistency: PoopConsistency | null
}

export const newMilk = (): MilkDraft => ({ volume: null, unknown: false, source: 'unknown' })

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

/** No volume typed and no explicit `?` means the block says nothing yet. */
export const milkIsEmpty = (d: MilkDraft) => d.volume === null && !d.unknown

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
export type Block =
  | { key: string; id?: string; type: 'milk'; draft: MilkDraft }
  | { key: string; id?: string; type: 'diaper'; draft: DiaperDraft }
  | { key: string; id?: string; type: 'other'; draft: OtherDraft }

export const blockIsEmpty = (b: Block) =>
  b.type === 'milk'
    ? milkIsEmpty(b.draft)
    : b.type === 'diaper'
      ? diaperIsEmpty(b.draft)
      : otherIsEmpty(b.draft)

/** Save needs at least one block, and every block has to say something. */
export const canSave = (blocks: Block[]) =>
  blocks.length > 0 && !blocks.some(blockIsEmpty)

export function toEntry(b: Block): DraftEntry {
  if (b.type === 'milk') {
    return {
      type: 'feed',
      // An explicit `?` is a feed of unknown volume, which is not the same as
      // no feed — the paper log distinguishes them and so must this.
      volume_ml: b.draft.unknown ? null : b.draft.volume,
      source: b.draft.source,
    }
  }
  if (b.type === 'diaper') {
    return {
      type: 'diaper',
      pee: b.draft.pee,
      poop: b.draft.poop,
      poop_colour: b.draft.colour,
      poop_consistency: b.draft.consistency,
    }
  }
  // `other` carries nothing but its type — the moment's note holds the detail.
  return { type: b.draft.kind! }
}

/** The reverse of toEntry: an existing moment, opened for editing. */
export function blocksFromMoment(m: Moment): Block[] {
  return m.events.map((e: LogEvent): Block => {
    const key = crypto.randomUUID()
    if (e.type === 'feed') {
      return {
        key,
        id: e.id,
        type: 'milk',
        draft: {
          volume: e.volume_ml,
          // A stored null volume is the paper's `?` — a feed of unknown volume,
          // not an empty block. Reopening it must not silently lose that.
          unknown: e.volume_ml === null,
          source: e.source ?? 'unknown',
        },
      }
    }
    if (e.type === 'diaper') {
      return {
        key,
        id: e.id,
        type: 'diaper',
        draft: {
          pee: e.pee ?? false,
          poop: e.poop ?? false,
          colour: e.poop_colour,
          consistency: e.poop_consistency,
        },
      }
    }
    return { key, id: e.id, type: 'other', draft: { kind: e.type } }
  })
}
