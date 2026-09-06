import { useEffect, useRef, useState, type RefObject } from 'react'

/** Horizontal travel before a swipe counts as one. */
const COMMIT_AT = 60

/**
 * Travel in any direction before the gesture is called horizontal or vertical.
 *
 * The same 10px `SwipeRow` settled on, and for the same reason: a thumb arcs,
 * and the first millimetre of a real swipe is often more vertical than
 * horizontal. Deciding on the first pixel reads a real finger as a scroll while
 * passing every machine-straight test.
 */
const DECIDE_AT = 10

/**
 * A whole-page horizontal swipe — the day view's way to the day before or after.
 *
 * Deliberately **not** built on `SwipeRow`. That one drags its content under
 * the finger because the thing it reveals is behind the row; this one changes
 * what the page is showing, and there is nothing underneath to reveal. The
 * gesture rules are shared, the movement is not.
 *
 * **Returns the live horizontal offset** so the caller can move something with
 * the finger, and 0 the moment the touch ends. What moves, how far, and whether
 * it resists is the caller's business — this only reports the drag. The day
 * view carries the page one-to-one with the thumb where there is a day to reach
 * and barely gives where there is not.
 *
 * `enabled` is false wherever stepping has no meaning — `all days`, a picked
 * period, the insights mode — and the listeners are simply not attached.
 */
export function usePageSwipe(
  ref: RefObject<HTMLElement | null>,
  { onPrev, onNext, onSettle, enabled = true }: {
    /** Swipe right: the newer day. */
    onPrev: () => void
    /** Swipe left: the older day. */
    onNext: () => void
    /**
     * The finger lifted after a horizontal drag, whether or not it committed.
     *
     * The caller needs this to know when to start gliding: the offset returning
     * to 0 says nothing on its own, because it is 0 before a gesture as well as
     * after one. Called after `onPrev`/`onNext`, so a committing settle already
     * knows where it is going.
     */
    onSettle?: (committed: boolean) => void
    enabled?: boolean
  },
): number {
  const [dx, setDx] = useState(0)

  /**
   * The callbacks live in a ref so the effect does not depend on them.
   *
   * Callers pass inline arrows, which are new objects on every render. That was
   * harmless while this hook rendered nothing — but reporting `dx` re-renders
   * on every touchmove, so an effect keyed on the callbacks tore itself down
   * and re-attached mid-drag, losing the gesture's start point. The swipe then
   * did nothing at all, and only did nothing *after* the animation was added,
   * which is a nasty thing to debug backwards.
   */
  const cbs = useRef({ onPrev, onNext, onSettle })
  cbs.current = { onPrev, onNext, onSettle }

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) { setDx(0); return }
    let from: { x: number; y: number } | null = null
    let axis: 'x' | 'y' | null = null

    const down = (e: TouchEvent) => {
      // Ignore anything with a second finger on it: a pinch is not a swipe.
      if (e.touches.length !== 1) { from = null; return }
      // And anything that scrolls sideways on its own. The date strip is a
      // horizontal scroller, and dragging the pills is how you reach `more` —
      // it must not step the day instead.
      if ((e.target as Element | null)?.closest('[data-noswipe]')) { from = null; return }
      const t = e.touches[0]
      from = { x: t.clientX, y: t.clientY }
      axis = null
    }

    const move = (e: TouchEvent) => {
      if (!from) return
      const t = e.touches[0]
      const mx = t.clientX - from.x
      const my = t.clientY - from.y

      if (axis === null) {
        if (Math.hypot(mx, my) < DECIDE_AT) return
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      }
      // Vertical: the user is scrolling the table. Leave it entirely alone.
      if (axis === 'y') return
      // Horizontal is ours. `touch-action: pan-y` on the page says so too; this
      // is the belt to that pair of braces, and it is what stops iOS turning a
      // horizontal drag into a back-navigation swipe.
      e.preventDefault()
      setDx(mx)
    }

    const up = (e: TouchEvent) => {
      if (axis === 'x' && from) {
        const t = e.changedTouches[0]
        const mx = t.clientX - from.x
        const committed = mx <= -COMMIT_AT || mx >= COMMIT_AT
        if (mx <= -COMMIT_AT) cbs.current.onNext()
        else if (mx >= COMMIT_AT) cbs.current.onPrev()
        cbs.current.onSettle?.(committed)
      }
      from = null
      axis = null
      setDx(0)
    }

    const cancel = () => { from = null; axis = null; setDx(0) }

    el.addEventListener('touchstart', down, { passive: true })
    // Not passive: `move` calls preventDefault, and React attaches touchmove
    // passively, so this cannot be a React prop.
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', cancel)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', cancel)
    }
  }, [ref, enabled])

  return dx
}
