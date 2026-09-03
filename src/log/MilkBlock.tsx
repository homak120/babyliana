import type { Source } from '../types'

// One bottle. A split feed is two of these in one moment (D-019) — the sheet
// adds another block rather than this one growing a second half.
//
// Arbitrary integers, not presets: the real log contains 31, 41, 43, 46, 57,
// and a picker of 30/45/60 cannot express it (paper-log-baseline.md).

export type MilkDraft = { volume: number | null; unknown: boolean; source: Source }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '?', '0', '⌫']

export function MilkBlock({
  value,
  onChange,
  onRemove,
}: {
  value: MilkDraft
  onChange: (v: MilkDraft) => void
  onRemove: () => void
}) {
  function press(key: string) {
    if (key === '?') {
      onChange({ ...value, unknown: !value.unknown, volume: null })
      return
    }
    if (key === '⌫') {
      const next = value.volume === null ? null : Math.floor(value.volume / 10)
      onChange({ ...value, volume: next === 0 ? null : next, unknown: false })
      return
    }
    const next = (value.volume ?? 0) * 10 + Number(key)
    if (next > 999) return
    onChange({ ...value, volume: next, unknown: false })
  }

  return (
    <section className="block">
      <header>
        <span>milk</span>
        <button type="button" className="x" onClick={onRemove} aria-label="remove milk">
          ×
        </button>
      </header>

      <p className="volume">
        {value.unknown ? '?' : (value.volume ?? '—')}
        <small>mL</small>
      </p>

      <div className="sources">
        {(['breast_milk', 'formula', 'unknown'] as const).map((s) => (
          <button
            type="button"
            key={s}
            className={value.source === s ? 'on' : ''}
            onClick={() => onChange({ ...value, source: s })}
          >
            {s === 'breast_milk' ? 'breast' : s}
          </button>
        ))}
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button type="button" key={k} onClick={() => press(k)}>
            {k}
          </button>
        ))}
      </div>
    </section>
  )
}
