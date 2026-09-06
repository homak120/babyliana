import { Icon } from './Icon'
import { OTHER_TYPES, type OtherDraft } from './drafts'

// The escape hatch, and the thing that lets the app fully replace the pen rather
// than nearly replace it. Kept off the main surface on purpose (D-010): a
// dropdown of ten types at 3am costs a tap, a scroll, a read and a selection,
// and the pen wins.
//
// Three of the five now carry a field of their own — weight, temperature and
// supplement (D-036). Fields appear under the row that was picked and only
// there, so the block still opens as five rows and nothing else. Spit up and
// something else have no value to capture and still write into the note.

/** What each kind asks for. Nothing here for the two that carry no value. */
type Field = { key: 'kg' | 'celsius' | 'supplementName' | 'supplementAmount'; label: string; unit?: string; placeholder?: string; numeric?: boolean }

const FIELDS: Partial<Record<string, Field[]>> = {
  weight: [{ key: 'kg', label: 'weight', unit: 'kg', placeholder: '3.4', numeric: true }],
  temperature: [{ key: 'celsius', label: 'temperature', unit: '°C', placeholder: '36.8', numeric: true }],
  supplement: [
    { key: 'supplementName', label: 'what', placeholder: 'vitamin D' },
    { key: 'supplementAmount', label: 'how much', placeholder: '1 drop' },
  ],
}

export function OtherBlock({
  value,
  onChange,
  onRemove,
}: {
  value: OtherDraft
  onChange: (v: OtherDraft) => void
  onRemove: () => void
}) {
  const fields = value.kind ? FIELDS[value.kind] : undefined

  return (
    <section className="block other">
      <header>
        <span>
          <Icon name="more_horiz" size={17} />
          other
        </span>
        <button type="button" className="x" onClick={onRemove} aria-label="remove other">
          <Icon name="close" size={18} />
        </button>
      </header>

      <p className="opt">kept off the main screen on purpose. pick one; anything it does not ask for goes in the note.</p>

      <div className="otherlist">
        {OTHER_TYPES.map((t) => (
          <button
            type="button"
            key={t.kind}
            className={`otherrow ${value.kind === t.kind ? 'on' : ''}`}
            aria-pressed={value.kind === t.kind}
            // Unpicking clears the fields with it. Keeping a weight around
            // under a deselected row is how a 3.4 ends up filed as a
            // temperature two taps later.
            onClick={() => onChange(
              value.kind === t.kind
                ? { kind: null, kg: '', celsius: '', supplementName: '', supplementAmount: '' }
                : { ...value, kind: t.kind },
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {fields && (
        <div className="otherfields">
          {fields.map((f) => (
            <label key={f.key} className="otherfield">
              <span>{f.label}</span>
              <span className="fieldbox">
                <input
                  // Text, not number: a number input eats the decimal point
                  // halfway through "3." and offers spinners nobody wants at
                  // 4am. `inputMode` is what actually raises the right keypad.
                  type="text"
                  inputMode={f.numeric ? 'decimal' : 'text'}
                  value={value[f.key]}
                  placeholder={f.placeholder}
                  aria-label={f.label}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                />
                {f.unit && <i>{f.unit}</i>}
              </span>
            </label>
          ))}
          {/* Blank is allowed and means what it means everywhere else here —
              it happened, the number is not known. Same rule as the milk
              volume's `?`. */}
          <p className="opt">leave it blank if you did not catch the number.</p>
        </div>
      )}
    </section>
  )
}
