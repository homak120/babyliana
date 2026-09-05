import { Icon } from './Icon'

/**
 * Sleep, as its own block rather than an entry in the `other` list.
 *
 * It has no fields of its own on purpose. The end time lives on the time card
 * above — it is the timeslot's, shared by everything in the moment (D-020) — so
 * this block exists to say *that a sleep happened* and to explain what leaving
 * the end time blank means.
 */
export function SleepBlock({ onRemove }: { onRemove: () => void }) {
  return (
    <section className="block sleepblock">
      <header>
        <span>
          <Icon name="bedtime" size={18} /> sleep
        </span>
        <button type="button" className="x" onClick={onRemove} aria-label="remove sleep">
          <Icon name="close" size={18} />
        </button>
      </header>

      <p className="opt">
        leave the end time blank while she is still asleep — the next thing you
        log will close it for you.
      </p>
    </section>
  )
}
