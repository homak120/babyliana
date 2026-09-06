import { Icon } from './Icon'
import type { SupplementDraft, TemperatureDraft, WeightDraft } from './drafts'

// Weight, temperature and supplement, each with its own tile beside milk,
// diaper and sleep (D-038). They used to be three of five rows behind `other`,
// which meant three taps to reach a thing that captures a number — the same
// shape D-029 moved sleep out of.
//
// One component, three configurations, because the three differ only in what
// they ask for. Separate files would have been three copies of the same input.

type Key = 'lb' | 'fahrenheit' | 'name' | 'amount'
type Field = {
  key: Key
  label: string
  unit?: string
  placeholder?: string
  numeric?: boolean
}

type Spec = {
  label: string
  icon: string
  fields: Field[]
  /**
   * Whether each field prints its own name above the box.
   *
   * Off for the single-field tiles, where the header already says `weight` and
   * repeating it directly underneath is the same word twice in 40px. On for
   * supplement, where `what` and `how much` are the only thing telling the two
   * boxes apart.
   */
  labelled: boolean
  /** Shown under the fields. Differs because supplement arrives filled in. */
  hint: string
}

export const FIELD_SPECS: Record<'weight' | 'temperature' | 'supplement', Spec> = {
  weight: {
    label: 'weight',
    icon: 'monitor_weight',
    // Pounds as a decimal, one field. The row reads it back as `7 lb 4 oz` —
    // how a scale says it — but nobody wants two boxes to fill at 4am.
    fields: [{ key: 'lb', label: 'weight', unit: 'lb', placeholder: '7.25', numeric: true }],
    labelled: false,
    hint: 'leave it blank if you did not catch the number.',
  },
  temperature: {
    label: 'temperature',
    icon: 'thermostat',
    fields: [{
      key: 'fahrenheit', label: 'temperature', unit: '°F', placeholder: '98.6', numeric: true,
    }],
    labelled: false,
    hint: 'leave it blank if you did not catch the number.',
  },
  supplement: {
    label: 'supplement',
    icon: 'medication',
    fields: [
      { key: 'name', label: 'what', placeholder: 'vitamin D' },
      { key: 'amount', label: 'how much', placeholder: '1 drop' },
    ],
    labelled: true,
    hint: 'the usual, already filled in. change it or clear it.',
  },
}

type AnyDraft = WeightDraft | TemperatureDraft | SupplementDraft

export function FieldBlock({
  kind, value, onChange, onRemove,
}: {
  kind: 'weight' | 'temperature' | 'supplement'
  value: AnyDraft
  onChange: (v: AnyDraft) => void
  onRemove: () => void
}) {
  const spec = FIELD_SPECS[kind]
  const held = value as Record<string, string | boolean | undefined>
  const preset = held.preset === true

  return (
    <section className={`block ${kind}`}>
      <header>
        <span>
          <Icon name={spec.icon} size={17} />
          {spec.label}
        </span>
        <button
          type="button"
          className="x"
          onClick={onRemove}
          aria-label={`remove ${spec.label}`}
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="otherfields">
        {spec.fields.map((f) => (
          <label key={f.key} className="otherfield">
            {/* The name is always on the input as `aria-label`; this is only
                whether it is also printed. */}
            {spec.labelled && <span className="fieldname">{f.label}</span>}
            <span className="fieldbox">
              <input
                // Text, not number: a number input eats the decimal point
                // halfway through "7." and offers spinners nobody wants at 4am.
                // `inputMode` is what actually raises the right keypad.
                type="text"
                inputMode={f.numeric ? 'decimal' : 'text'}
                value={(held[f.key] as string | undefined) ?? ''}
                placeholder={f.placeholder}
                aria-label={f.label}
                // While the value is still the untouched suggestion, focusing
                // selects it, so the first character typed replaces the whole
                // thing rather than landing inside "Vitamin D".
                onFocus={(e) => { if (preset) e.currentTarget.select() }}
                onChange={(e) => onChange(
                  { ...value, [f.key]: e.target.value, preset: false } as AnyDraft,
                )}
              />
              {f.unit && <i>{f.unit}</i>}
            </span>
          </label>
        ))}
        {/* Blank is allowed and means what it means everywhere else here — it
            happened, the number is not known. Same rule as the milk volume's
            `?`. */}
        <p className="opt">{spec.hint}</p>
      </div>
    </section>
  )
}
