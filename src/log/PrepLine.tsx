import { useEffect, useRef, useState } from 'react'
import { BottleIcon } from './BottleIcon'
import { countUp } from './time'

/**
 * The bottle prompt, and the timer it becomes when tapped (D-045).
 *
 * Two states on one line. Before the tap it asks — *make a bottle* — and moves,
 * because the whole reason it exists is to be noticed by someone who is not
 * looking at the phone. After the tap it counts up from that moment, which is
 * how long the bottle has been standing: the cool-down, read rather than
 * calculated.
 *
 * **Nothing here reaches the database.** The tap is a note to yourself about a
 * bottle, not an event in the baby's log — there is no moment to attach it to
 * and nothing the other phone needs to know. `event-model.md` § Where each fact
 * lives puts it in the same bracket as the lead rail and the clock format.
 */
const KEY = 'babyliana.making'

/** Its own component so the one-second tick re-renders this line and not the
 *  whole screen — the card above it is content with `now` every 30s. */
export function PrepLine({ prepping, loaded }: { prepping: boolean; loaded: boolean }) {
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
   * The same disappearing act the prompt already had, and for the same reason.
   *
   * `prepping` is false exactly when a feed has been logged — the target moves
   * three or four hours out and takes the line with it (D-036) — so clearing on
   * it needs no separate rule about feeds. Nothing to cancel by hand: the owner
   * asked for none, on the grounds that logging the feed is the cancel.
   *
   * **`loaded` is what stops it firing on an empty first render.** The screen
   * remounts on every save and starts with no moments, which is indistinguish-
   * able from a feed having just been logged. Without this the count was wiped
   * by any save at all, and by opening the app.
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

  if (!prepping) return null

  if (startedAt === null) {
    return (
      <button
        type="button"
        className="prepline asking"
        onClick={() => {
          const at = Date.now()
          localStorage.setItem(KEY, String(at))
          setStartedAt(at)
        }}
      >
        <BottleIcon size={14} />
        <span>make a bottle</span>
      </button>
    )
  }

  return (
    <div className="prepline making">
      <BottleIcon size={14} />
      <span>making milk · {countUp(Date.now() - startedAt)}</span>
    </div>
  )
}
