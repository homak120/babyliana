import { useState } from 'react'
import { logMoment } from '../moments'
import {
  canSave,
  newDiaper,
  newMilk,
  newOther,
  toEntry,
  type Block,
  type DiaperDraft,
  type MilkDraft,
  type OtherDraft,
} from './drafts'
import { DiaperBlock } from './DiaperBlock'
import { Icon } from './Icon'
import { MilkBlock } from './MilkBlock'
import { OtherBlock } from './OtherBlock'
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

const AVAILABLE: { type: BlockType; label: string }[] = [
  { type: 'milk', label: '+ milk' },
  { type: 'diaper', label: '+ diaper' },
  { type: 'other', label: '+ other' },
]

const emptyDraft = (type: BlockType) =>
  type === 'milk' ? newMilk() : type === 'diaper' ? newDiaper() : newOther()

export function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [saving, setSaving] = useState(false)
  // Defaults to now — the overwhelmingly common case, at zero taps.
  const [start, setStart] = useState(() => new Date())
  const [end, setEnd] = useState<Date | null>(null)
  const [note, setNote] = useState('')

  function add(type: BlockType) {
    setBlocks((b) => [
      ...b,
      { key: crypto.randomUUID(), type, draft: emptyDraft(type) } as Block,
    ])
  }

  const update = (i: number, draft: MilkDraft | DiaperDraft | OtherDraft) =>
    setBlocks((prev) =>
      prev.map((p, j) => (j === i ? ({ ...p, draft } as Block) : p)),
    )

  const remove = (i: number) => setBlocks((prev) => prev.filter((_, j) => j !== i))

  async function save() {
    setSaving(true)
    await logMoment({
      occurredAt: start,
      endedAt: end,
      note: note.trim() || null,
      entries: blocks.map(toEntry),
    })
    setSaving(false)
    onSaved()
  }

  const ready = canSave(blocks) && !saving

  return (
    <div className="sheet">
      <header className="sheet-head">
        <h2>log a moment</h2>
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
        {AVAILABLE.map((a) => (
          <button type="button" key={a.type} onClick={() => add(a.type)}>
            {a.label}
          </button>
        ))}
      </div>

      <section className="notecard">
        <label htmlFor="note">
          <Icon name="edit_note" size={17} /> note
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="spat some up / half asleep / …"
        />
      </section>

      <button type="button" className="save" disabled={!ready} onClick={save}>
        <Icon name="check_circle" size={24} />
        save
      </button>
    </div>
  )
}
