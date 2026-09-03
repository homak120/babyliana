import type { DraftEntry, PoopColour, PoopConsistency, Source } from '../types'

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

export type Block =
  | { key: string; type: 'milk'; draft: MilkDraft }
  | { key: string; type: 'diaper'; draft: DiaperDraft }

export const blockIsEmpty = (b: Block) =>
  b.type === 'milk' ? milkIsEmpty(b.draft) : diaperIsEmpty(b.draft)

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
  return {
    type: 'diaper',
    pee: b.draft.pee,
    poop: b.draft.poop,
    poop_colour: b.draft.colour,
    poop_consistency: b.draft.consistency,
  }
}
