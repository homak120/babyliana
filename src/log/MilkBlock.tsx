import { Icon } from './Icon'
import type { MilkDraft } from './drafts'

// One bottle. A split feed is two of these in one moment (D-019) — the `+` key
// adds another rather than this one growing a second half.
//
// Arbitrary integers, not presets: the real log contains 31, 41, 43, 46, 57,
// and a picker of 30/45/60 cannot express it (paper-log-baseline.md).
//
// There is no `?` key and no "unknown" source button. Leaving the volume blank
// *is* the paper's `?` — a feed happened, volume unknown — and leaving both
// source toggles off is the unlabelled `30 + 30`. The prototype says so in as
// many words, and a control for something the absence already expresses is a
// control to get wrong at 4am.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫']

export function MilkBlock({
  value,
  onChange,
  onRemove,
  onAddAnother,
}: {
  value: MilkDraft
  onChange: (v: MilkDraft) => void
  onRemove: () => void
  onAddAnother: () => void
}) {
  function press(key: string) {
    if (key === '+') return onAddAnother()
    if (key === '⌫') {
      const next = value.volume === null ? null : Math.floor(value.volume / 10)
      return onChange({ ...value, volume: next === 0 ? null : next })
    }
    const next = (value.volume ?? 0) * 10 + Number(key)
    if (next > 999) return
    onChange({ ...value, volume: next })
  }

  const toggle = (s: MilkDraft['source']) =>
    onChange({ ...value, source: value.source === s ? 'unknown' : s })

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

      <p className="volume">{value.volume ?? ''}</p>
      <p className="volunit">
        <Icon name="water_full" size={16} /> mL
      </p>
      <p className="opt">
        leave it blank and it saves as ? — a feed happened, volume unknown.
      </p>

      <div className="sources">
        <button
          type="button"
          className={value.source === 'breast_milk' ? 'on breast' : ''}
          aria-pressed={value.source === 'breast_milk'}
          onClick={() => toggle('breast_milk')}
        >
          <Icon name="favorite" size={17} /> breast
        </button>
        <button
          type="button"
          className={value.source === 'formula' ? 'on formula' : ''}
          aria-pressed={value.source === 'formula'}
          onClick={() => toggle('formula')}
        >
          <Icon name="local_drink" size={17} /> formula
        </button>
      </div>

      <div
        className="scrub"
        role="slider"
        aria-label="drag to adjust volume"
        aria-valuenow={value.volume ?? 0}
        aria-valuemin={0}
        aria-valuemax={999}
        tabIndex={0}
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return
          const r = e.currentTarget.getBoundingClientRect()
          const pct = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
          onChange({ ...value, volume: Math.round(pct * 120) })
        }}
      >
        <Icon name="drag_indicator" size={16} /> drag to adjust
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button type="button" key={k} onClick={() => press(k)}>
            {k === '⌫' ? <Icon name="backspace" size={22} /> : k}
          </button>
        ))}
      </div>
    </section>
  )
}
