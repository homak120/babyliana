import { Icon } from './Icon'
import { OTHER_TYPES, type OtherDraft } from './drafts'

// The escape hatch, and the thing that lets the app fully replace the pen rather
// than nearly replace it. Kept off the main surface on purpose (D-010): a
// dropdown of ten types at 3am costs a tap, a scroll, a read and a selection,
// and the pen wins.
//
// None of these gets its own fields. Pick one, write the rest in the note.

export function OtherBlock({
  value,
  onChange,
  onRemove,
}: {
  value: OtherDraft
  onChange: (v: OtherDraft) => void
  onRemove: () => void
}) {
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

      <p className="opt">kept off the main screen on purpose. pick one, write the rest in the note.</p>

      <div className="otherlist">
        {OTHER_TYPES.map((t) => (
          <button
            type="button"
            key={t.kind}
            className={`otherrow ${value.kind === t.kind ? 'on' : ''}`}
            aria-pressed={value.kind === t.kind}
            onClick={() => onChange({ kind: value.kind === t.kind ? null : t.kind })}
          >
            {t.label}
          </button>
        ))}
      </div>
    </section>
  )
}
