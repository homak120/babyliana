import { useState } from 'react'
import { logMoment } from '../moments'
import type { DraftEntry } from '../types'
import { MilkBlock, type MilkDraft } from './MilkBlock'

// The sheet is one moment (D-019, D-021). It opens with NO type selected and
// save stays disabled until a block exists, which is what enforces "a moment
// always has at least one entry" at the point of entry.
//
// S1 offers milk only. Diaper arrives in S4 and other in S6, and they drop into
// this same pattern — the bubbles render from a list rather than being three
// hard-coded buttons.
//
// Time is not here yet. It defaults to now; S5 builds the steppers, offsets and
// numeric entry, which is the slice that decides whether this beats the pen.

type Block = { key: string; type: 'milk'; draft: MilkDraft }

const AVAILABLE = [{ type: 'milk' as const, label: '+ milk' }]

export function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [saving, setSaving] = useState(false)

  function add(type: 'milk') {
    const draft: MilkDraft = { volume: null, unknown: false, source: 'unknown' }
    setBlocks((b) => [...b, { key: crypto.randomUUID(), type, draft }])
  }

  async function save() {
    setSaving(true)
    const entries: DraftEntry[] = blocks.map((b) => ({
      type: 'feed',
      volume_ml: b.draft.unknown ? null : b.draft.volume,
      source: b.draft.source,
    }))
    await logMoment({ entries })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="sheet">
      <header className="sheet-head">
        <h2>log a moment</h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          ×
        </button>
      </header>

      <p className="hint">time is now — S5 makes it adjustable</p>

      {blocks.map((b, i) => (
        <MilkBlock
          key={b.key}
          value={b.draft}
          onChange={(draft) =>
            setBlocks((prev) => prev.map((p, j) => (j === i ? { ...p, draft } : p)))
          }
          onRemove={() => setBlocks((prev) => prev.filter((_, j) => j !== i))}
        />
      ))}

      <div className="bubbles">
        {AVAILABLE.map((a) => (
          <button type="button" key={a.type} onClick={() => add(a.type)}>
            {a.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="save"
        disabled={blocks.length === 0 || saving}
        onClick={save}
      >
        save
      </button>
    </div>
  )
}
