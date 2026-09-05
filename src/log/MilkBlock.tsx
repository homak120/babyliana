import type { PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from './Icon'
import type { MilkDraft } from './drafts'

/**
 * The volume the drag strip spans end to end.
 *
 * The prototype uses 75, which is a typical feed. The real paper log runs to
 * 120, so the strip stops short of the owner's own larger feeds at 75 — the
 * baseline wins over the design here. The keypad takes any value regardless;
 * this only sets what a drag can reach and how full the bar reads.
 */
const SCRUB_MAX = 120

// One card, up to two parts. The design keeps a split feed in the same card —
// "selecting a part moves the underline to it, and the row reads 30 + 30" —
// with one keypad editing whichever part is active. Storage still makes them
// two feed events (D-019); this is how they are entered, not how they are kept.
//
// Arbitrary integers, not presets: the real log contains 31, 41, 43, 46, 57,
// and a picker of 30/45/60 cannot express it.
//
// No `?` key and no "unknown" source button. Leaving a part blank *is* the
// paper's `?`, and leaving both toggles off is the unlabelled `30 + 30`.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫']
const MAX_PARTS = 2

export function MilkBlock({
  value,
  onChange,
  onRemove,
}: {
  value: MilkDraft
  onChange: (v: MilkDraft) => void
  onRemove: () => void
}) {
  const part = value.parts[value.active]

  const setPart = (patch: Partial<MilkDraft['parts'][number]>) =>
    onChange({
      ...value,
      parts: value.parts.map((p, i) => (i === value.active ? { ...p, ...patch } : p)),
    })

  function press(key: string) {
    if (key === '+') {
      // Adds the second half of a split feed, and moves the underline to it.
      if (value.parts.length >= MAX_PARTS) return
      onChange({
        parts: [...value.parts, { volume: null, source: 'unknown' }],
        active: value.parts.length,
      })
      return
    }
    if (key === '⌫') {
      const next = part.volume === null ? null : Math.floor(part.volume / 10)
      return setPart({ volume: next === 0 ? null : next })
    }
    const next = (part.volume ?? 0) * 10 + Number(key)
    if (next > 999) return
    setPart({ volume: next })
  }

  const toggle = (s: MilkDraft['parts'][number]['source']) =>
    setPart({ source: part.source === s ? 'unknown' : s })

  // Never 0: a blank volume is the paper's `?`, and dragging to the far left
  // should give the smallest real feed rather than an ambiguous zero.
  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    setPart({ volume: Math.max(1, Math.round(pct * SCRUB_MAX)) })
  }

  return (
    <section className="block milkblock">
      <header>
        <span>
          <Icon name="local_drink" size={17} />
          milk
        </span>
        <button type="button" className="x" onClick={onRemove} aria-label="remove milk">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="parts">
        {value.parts.map((p, i) => (
          <span key={i} className="partwrap">
            {i > 0 && <span className="plus">+</span>}
            <button
              type="button"
              className={[
                'part',
                i === value.active ? 'active' : '',
                // The figure carries its own source's colour, so a two-part feed
                // reads as "25 lilac + 45 amber" without looking anything up.
                p.volume === null ? 'blank'
                  : p.source === 'breast_milk' ? 'breast'
                    : p.source === 'formula' ? 'formula' : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={i === value.active}
              aria-label={`part ${i + 1}`}
              onClick={() => onChange({ ...value, active: i })}
            >
              {p.volume ?? ''}
            </button>
            {value.parts.length > 1 && (
              <button
                type="button"
                className="droppart"
                aria-label={`remove part ${i + 1}`}
                onClick={() =>
                  onChange({
                    parts: value.parts.filter((_, j) => j !== i),
                    active: 0,
                  })
                }
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      <p className="volunit">
        <Icon name="water_full" size={16} /> mL
      </p>
      <p className="opt">
        leave it blank and it saves as ? — a feed happened, volume unknown.
      </p>

      <div className="sources">
        <button
          type="button"
          className={part.source === 'breast_milk' ? 'on breast' : ''}
          aria-pressed={part.source === 'breast_milk'}
          onClick={() => toggle('breast_milk')}
        >
          <Icon name="favorite" size={17} /> breast
        </button>
        <button
          type="button"
          className={part.source === 'formula' ? 'on formula' : ''}
          aria-pressed={part.source === 'formula'}
          onClick={() => toggle('formula')}
        >
          <Icon name="local_drink" size={17} /> formula
        </button>
      </div>

      <div
        className="scrub"
        role="slider"
        aria-label="drag to adjust volume"
        aria-valuenow={part.volume ?? 0}
        aria-valuemin={1}
        aria-valuemax={SCRUB_MAX}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          scrub(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          scrub(e)
        }}
      >
        {/* The bar the design draws and this never had: a gradient whose width
            tracks the volume, so the strip shows a value as well as taking one. */}
        <span
          className="scrubfill"
          style={{ width: `${Math.min(100, ((part.volume ?? 0) / SCRUB_MAX) * 100)}%` }}
        />
        <span className="scrublabel">
          <Icon name="drag_indicator" size={16} /> drag to adjust
        </span>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button
            type="button"
            key={k}
            disabled={k === '+' && value.parts.length >= MAX_PARTS}
            onClick={() => press(k)}
          >
            {k === '⌫' ? <Icon name="backspace" size={22} /> : k}
          </button>
        ))}
      </div>
    </section>
  )
}
