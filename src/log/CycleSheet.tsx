import { useState } from 'react'
import { cycles, gapText, isNightCycle, setCycles, type Cycle } from '../cycles'
import { saveSetting } from '../moments'
import { sync } from '../sync'
import { Icon } from './Icon'

/**
 * The feeding cycle, behind the card's `tune` button (D-050).
 *
 * **The gaps are editable; the windows are not.** The handoff draws the hours
 * as labels and the interval as the field, and that is the smaller, closeable
 * half: moving a boundary raises what a window that no longer covers the whole
 * clock should do, which nobody has asked. The hours are named here so the
 * number beside them means something.
 */
const MIN_GAP = 60
const MAX_GAP = 8 * 60
const STEP = 30

const clock = (mins: number) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const ap = h < 12 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
}

export function CycleSheet({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<Cycle[]>(() => cycles().map((c) => ({ ...c })))

  const step = (id: string, by: number) =>
    setDraft((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, gap: Math.min(MAX_GAP, Math.max(MIN_GAP, c.gap + by)) }
          : c,
      ),
    )

  return (
    <div className="sheet cyclesheet" role="dialog" aria-label="feeding cycle">
      <header className="sheet-head">
        <h2>
          <Icon name="tune" size={20} /> feeding cycle
        </h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          <Icon name="close" size={20} />
        </button>
      </header>

      <p className="cyclenote">
        how long a feed is expected to hold. it sets the wake time on the card and
        the times on the next-feeds view — nothing is logged from it.
      </p>

      {draft.map((c) => (
        <section className="cyclerow" key={c.id}>
          <p className="cyclewhen">
            <Icon name={isNightCycle(c) ? 'bedtime' : 'wb_sunny'} size={15} />
            {clock(c.from)} – {clock(c.to)}
          </p>
          <div className="cyclegap">
            <span>every</span>
            <button
              type="button" className="stepper" aria-label={`less often, ${c.id}`}
              disabled={c.gap <= MIN_GAP} onClick={() => step(c.id, -STEP)}
            >
              <Icon name="remove" size={18} />
            </button>
            <b>{gapText(c.gap)}</b>
            <button
              type="button" className="stepper" aria-label={`more often, ${c.id}`}
              disabled={c.gap >= MAX_GAP} onClick={() => step(c.id, STEP)}
            >
              <Icon name="add" size={18} />
            </button>
          </div>
        </section>
      ))}

      <div className="spacer" />

      <button
        type="button"
        className="save"
        onClick={() => {
          // Local first, and the sheet closes on it: the card must repaint at
          // once whether or not there is a network. The shared row and the push
          // follow behind (D-052).
          setCycles(draft)
          onClose()
          void saveSetting('cycles', draft).then(() => sync())
        }}
      >
        <Icon name="check_circle" size={24} /> save
      </button>
    </div>
  )
}
