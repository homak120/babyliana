import type { PoopColour, PoopConsistency } from '../types'
import { Icon } from './Icon'
import type { DiaperDraft } from './drafts'

// One change. Both flags may be true at once — the paper log's row carries a
// pee and a poop together often enough that forcing two entries would be worse
// than paper.
//
// Colour and consistency stay hidden until poop is on, and remain optional even
// then. Roughly half the poops in the real log carry no annotation at all, so
// demanding one would tax the common case to serve the rare one.

const COLOURS: PoopColour[] = ['yellow', 'green', 'brown', 'dark', 'other']
const CONSISTENCIES: PoopConsistency[] = ['liquid', 'soft', 'seedy', 'firm', 'other']

export function DiaperBlock({
  value,
  onChange,
  onRemove,
}: {
  value: DiaperDraft
  onChange: (v: DiaperDraft) => void
  onRemove: () => void
}) {
  return (
    <section className="block diaper">
      <header>
        <span>
          <Icon name="water_drop" size={17} />
          diaper
        </span>
        <button type="button" className="x" onClick={onRemove} aria-label="remove diaper">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="toggles">
        <button
          type="button"
          className={`toggle pee ${value.pee ? 'on' : ''}`}
          aria-pressed={value.pee}
          onClick={() => onChange({ ...value, pee: !value.pee })}
        >
          pee
        </button>
        <button
          type="button"
          className={`toggle poop ${value.poop ? 'on' : ''}`}
          aria-pressed={value.poop}
          onClick={() =>
            onChange(
              value.poop
                ? { ...value, poop: false, colour: null, consistency: null }
                : { ...value, poop: true },
            )
          }
        >
          poop
        </button>
      </div>

      {value.poop && (
        <>
          <p className="opt">colour — optional</p>
          <div className="pills">
            {COLOURS.map((c) => (
              <button
                type="button"
                key={c}
                className={`pill c-${c} ${value.colour === c ? 'on' : ''}`}
                onClick={() => onChange({ ...value, colour: value.colour === c ? null : c })}
              >
                {c}
              </button>
            ))}
          </div>

          <p className="opt">consistency — optional</p>
          <div className="pills">
            {CONSISTENCIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`pill ${value.consistency === c ? 'on' : ''}`}
                onClick={() =>
                  onChange({ ...value, consistency: value.consistency === c ? null : c })
                }
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
