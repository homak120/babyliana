import { useEffect, useState } from 'react'
import { closeOpenSleep, logMoment, updateMoment } from '../moments'
import type { Moment } from '../types'
import { setEntryInProgress } from '../updates'
import { markOverlay } from '../overlay'
import {
  blocksFromMoment,
  canSave,
  newDiaper,
  newMilk,
  newOther,
  newSleep,
  newSupplement,
  newTemperature,
  newWeight,
  quickMilk,
  toEntries,
  type Block,
  type DiaperDraft,
  type MilkDraft,
  type OtherDraft,
  type SupplementDraft,
  type TemperatureDraft,
  type WeightDraft,
} from './drafts'
import { DiaperBlock } from './DiaperBlock'
import { Icon } from './Icon'
import { FieldBlock } from './FieldBlock'
import { MilkBlock } from './MilkBlock'
import { OtherBlock } from './OtherBlock'
import { SleepBlock } from './SleepBlock'
import { TimeCard } from './TimeCard'

// The sheet is one moment (D-019, D-021). It opens with NO type selected and
// save stays disabled until a block exists, which enforces "a moment always has
// at least one entry" at the point of entry rather than in a constraint nobody
// sees.
//
// Bubbles render from a list, so S6's `other` drops in without touching this.
//
// Time is not here yet. It defaults to now; S5 builds the steppers, offsets and
// numeric entry — the slice that decides whether this beats the pen.

type BlockType = Block['type']

/**
 * `repeats` is whether the bubble stays after it has been used.
 *
 * **Nothing repeats but `other`.** Milk used to, on the reading that D-019's
 * split feed is two milk blocks — but the milk card holds two parts and has its
 * own `+` for the second, so one tile already captures the whole feed. Two milk
 * tiles was a second way to say the same thing, and the one that made the
 * moment harder to read back. `other` is the exception because a moment can
 * carry a spit-up and a something-else at once, and neither has a tile.
 */
const AVAILABLE: { type: BlockType; label: string; icon: string; repeats: boolean }[] = [
  { type: 'milk', label: 'milk', icon: 'local_drink', repeats: false },
  // One change is one change; pee and poop are flags on it, not two entries.
  { type: 'diaper', label: 'diaper', icon: 'water_drop', repeats: false },
  // Sleep sits with the first two rather than behind `other`, where it used to
  // be — it is one of the three things that actually happen all night (D-029).
  { type: 'sleep', label: 'sleep', icon: 'bedtime', repeats: false },
  // The three that came out of `other` for the same reason (D-038): each
  // captures a value, and a type buried in a list of five was the wrong shape.
  { type: 'weight', label: 'weight', icon: 'monitor_weight', repeats: false },
  { type: 'temperature', label: 'temp', icon: 'thermostat', repeats: false },
  { type: 'supplement', label: 'supplement', icon: 'medication', repeats: false },
  { type: 'other', label: 'other', icon: 'more_horiz', repeats: true },
]

const emptyDraft = (type: BlockType) =>
  type === 'milk' ? newMilk()
    : type === 'diaper' ? newDiaper()
      : type === 'sleep' ? newSleep()
        : type === 'weight' ? newWeight()
          : type === 'temperature' ? newTemperature()
            : type === 'supplement' ? newSupplement()
              : newOther()

export function AddSheet({
  onClose,
  onSaved,
  editing,
  opensWith,
}: {
  onClose: () => void
  onSaved: () => void
  /** Set to reopen an existing moment pre-filled, rather than start a new one. */
  editing?: Moment
  /**
   * Start with this block already added — what the bar's quick icons do.
   *
   * They are shortcuts into this same sheet, not screens of their own, so the
   * other types are still one tap away and a feed and a diaper at the same
   * minute stay one moment.
   */
  opensWith?: BlockType
}) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    editing
      ? blocksFromMoment(editing)
      : opensWith
        // The bar's bottle opens on a filled-in feed; `+ milk` inside the
        // sheet still starts blank. See `quickMilk`.
        ? [{
          key: crypto.randomUUID(),
          type: opensWith,
          draft: opensWith === 'milk' ? quickMilk() : emptyDraft(opensWith),
        } as Block]
        : [],
  )
  const [saving, setSaving] = useState(false)
  // Defaults to now — the overwhelmingly common case, at zero taps.
  const [start, setStart] = useState(() =>
    editing ? new Date(editing.timeslot.occurred_at) : new Date(),
  )
  const [end, setEnd] = useState<Date | null>(() =>
    editing?.timeslot.ended_at ? new Date(editing.timeslot.ended_at) : null,
  )
  const [note, setNote] = useState(editing?.timeslot.note ?? '')

  // While this sheet is open a service-worker update must not reload the page
  // and discard what is being typed.
  useEffect(() => {
    setEntryInProgress(true)
    markOverlay(true)
    return () => {
      setEntryInProgress(false)
      markOverlay(false)
    }
  }, [])

  function add(type: BlockType) {
    setBlocks((b) => [
      ...b,
      { key: crypto.randomUUID(), type, draft: emptyDraft(type) } as Block,
    ])
  }

  const update = (
    i: number,
    draft: MilkDraft | DiaperDraft | OtherDraft | WeightDraft | TemperatureDraft | SupplementDraft,
  ) =>
    setBlocks((prev) =>
      prev.map((p, j) => (j === i ? ({ ...p, draft } as Block) : p)),
    )

  const remove = (i: number) => setBlocks((prev) => prev.filter((_, j) => j !== i))

  async function save() {
    setSaving(true)
    const payload = {
      occurredAt: start,
      endedAt: end,
      note: note.trim() || null,
      entries: blocks.flatMap(toEntries),
    }
    if (editing) {
      await updateMoment(editing.timeslot.id, {
        ...payload,
        entryIds: blocks.flatMap((b) =>
          // One block can be two entries; pad so ids line up with entries.
          toEntries(b).map((_, i) => b.ids?.[i]),
        ),
      })
    } else {
      const m = await logMoment(payload)
      // Logging anything else means she woke. Sleeps only — the next entry says
      // nothing about when a bottle finished (D-033). Done here rather than
      // inside logMoment so that primitive never touches rows its caller did
      // not name — see closeOpenSleep's note.
      await closeOpenSleep(new Date(m.timeslot.occurred_at), m.timeslot.id)
    }
    setSaving(false)
    onSaved()
  }

  const ready = canSave(blocks) && !saving

  return (
    <div className="sheet">
      <header className="sheet-head">
        <h2>
          <Icon name="auto_awesome" size={20} />
          {editing ? 'edit this moment' : 'what just happened'}
        </h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          <Icon name="close" size={20} />
        </button>
      </header>

      <TimeCard
        start={start}
        end={end}
        onChange={(s, e) => {
          setStart(s)
          setEnd(e)
        }}
      />

      {blocks.map((b, i) =>
        b.type === 'milk' ? (
          <MilkBlock
            key={b.key}
            value={b.draft}
            onChange={(d) => update(i, d)}
            onRemove={() => remove(i)}
          />
        ) : b.type === 'diaper' ? (
          <DiaperBlock
            key={b.key}
            value={b.draft}
            onChange={(d) => update(i, d)}
            onRemove={() => remove(i)}
          />
        ) : b.type === 'sleep' ? (
          <SleepBlock key={b.key} onRemove={() => remove(i)} />
        ) : b.type === 'weight' || b.type === 'temperature' || b.type === 'supplement' ? (
          <FieldBlock
            key={b.key}
            kind={b.type}
            value={b.draft}
            onChange={(d) => update(i, d)}
            onRemove={() => remove(i)}
          />
        ) : (
          <OtherBlock
            key={b.key}
            value={b.draft}
            onChange={(d) => update(i, d)}
            onRemove={() => remove(i)}
          />
        ),
      )}

      <div className="bubbles">
        <p className="bubbleslabel">
          {blocks.length === 0 ? 'what happened at this time' : 'also happened at this time'}
        </p>
        {AVAILABLE.filter((a) => a.repeats || !blocks.some((b) => b.type === a.type)).map((a) => (
          <button type="button" key={a.type} className={`bubble ${a.type}`} onClick={() => add(a.type)}>
            + <Icon name={a.icon} size={17} /> {a.label}
          </button>
        ))}
      </div>

      <section className="notecard">
        <label htmlFor="note">
          <Icon name="edit_note" size={17} /> note — anything at all
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="spat some up / half asleep / …"
        />
      </section>

      {/* A disabled button that says why is worth more than a greyed-out one
          that does not — the prototype's own copy. */}
      <button type="button" className="save" disabled={!ready} onClick={save}>
        <Icon name="check_circle" size={24} />
        {blocks.length === 0 ? 'pick what happened' : editing ? 'save changes' : 'save'}
      </button>
    </div>
  )
}
