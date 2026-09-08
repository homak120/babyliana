import { useEffect, useRef, useState } from 'react'
import { mmss } from './time'

/**
 * The milk-prep timer: how long the bottle has been standing (D-045), in the
 * shape the status-card handoff draws it (D-050).
 *
 * A pill, not a line — a bottle mark, a title, and a sub-line under it. Before
 * the tap it asks and breathes, because the whole reason it exists is to be
 * caught by someone who is not looking at the phone. After it, it counts and
 * rocks.
 *
 * **Nothing here reaches the database.** The tap is a note to yourself about a
 * bottle, not an event in the baby's log — there is no moment to attach it to
 * and nothing the other phone needs to know (`event-model.md` § Where each fact
 * lives).
 */
const KEY = 'babyliana.making'

/**
 * The timer itself, held by the screen rather than by the pill.
 *
 * The pill is not always on screen — tab 2 has no room for it — but the timer
 * has to keep clearing itself when a feed is logged whichever tab is showing.
 * A hook mounted once by `LogScreen` does that; a component mounted by one of
 * three tabs could not.
 */
export function usePrepTimer(prepping: boolean, loaded: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, tick] = useState(0)
  const readOnce = useRef(false)

  // Read once, so a save remounting the screen does not lose a running count.
  if (!readOnce.current) {
    readOnce.current = true
    const raw = Number(localStorage.getItem(KEY))
    if (raw > 0) setStartedAt(raw)
  }

  /**
   * Logging a feed still clears it, and that rule is untouched by the tap
   * (D-050). The two live together: the tap is a way out of a mis-tap, and the
   * feed is what the timer was counting towards.
   *
   * `prepping` is false exactly when a feed has been logged — the target moves
   * hours out and takes the prompt with it (D-036). `loaded` is what stops this
   * firing on the empty first render after a remount, which is
   * indistinguishable from a feed having just been logged.
   */
  useEffect(() => {
    if (!loaded || prepping) return
    localStorage.removeItem(KEY)
    setStartedAt(null)
  }, [loaded, prepping])

  useEffect(() => {
    if (startedAt === null) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return {
    startedAt,
    /** Tap toggles: start it, or stop one that is running. */
    toggle: () => {
      if (startedAt !== null) {
        localStorage.removeItem(KEY)
        setStartedAt(null)
        return
      }
      const at = Date.now()
      localStorage.setItem(KEY, String(at))
      setStartedAt(at)
    },
  }
}

/**
 * The bottle mark, filled rather than stroked, with the milk sitting at 60% of
 * the body — the handoff's own drawing.
 *
 * The app's other bottle (`BottleIcon`) is a 2px outline meant to sit beside
 * Material Symbols on a button. This one is a solid mark inside a coloured
 * pill, and the milk level is the part that says what the timer is about.
 */
function PrepBottle() {
  return (
    <svg width="17" height="21" viewBox="0 0 20 24" aria-hidden="true" focusable="false">
      <rect x="7.6" y="0.8" width="4.8" height="3" rx="1.5" fill="currentColor" />
      <rect x="6" y="3.4" width="8" height="2.8" rx="1.4" fill="currentColor" opacity="0.5" />
      <path
        d="M4.2 13.5h11.6v4.6a4.6 4.6 0 0 1-4.6 4.6H8.8a4.6 4.6 0 0 1-4.6-4.6V13.5z"
        fill="currentColor"
        opacity="0.8"
      />
      <rect
        x="4.2" y="6.2" width="11.6" height="16.5" rx="4.6"
        fill="none" stroke="currentColor" strokeWidth="1.5"
      />
    </svg>
  )
}

export function PrepPill({
  startedAt, onToggle,
}: {
  startedAt: number | null
  onToggle: () => void
}) {
  const running = startedAt !== null
  return (
    <button
      type="button"
      className={`preppill ${running ? 'making' : 'asking'}`}
      onClick={onToggle}
    >
      <span className="prepmark"><PrepBottle /></span>
      <span className="preptext">
        <b>{running ? 'making milk' : 'make milk'}</b>
        {/* Recomputed from the stored instant on every tick, never counted up
            from the tick itself: a backgrounded phone stops firing intervals,
            and a count of ticks would come back minutes short. */}
        <em>{running ? `${mmss(Date.now() - startedAt)} · tap to stop` : 'tap when you start'}</em>
      </span>
    </button>
  )
}
