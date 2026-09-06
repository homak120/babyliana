import { useEffect, type RefObject } from 'react'

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
 * Nothing moves under the thumb. A day change is instantaneous, so a transform
 * would be animating a page that is about to be replaced — and the one thing
 * this project has learnt about gestures on iOS is that every moving part is
 * another thing to get wrong on a device but not on a desktop.
 *
 * `enabled` is false wherever stepping has no meaning — `all days`, a picked
 * period, the insights mode — and the listeners are simply not attached.
 */
export function usePageSwipe(
  ref: RefObject<HTMLElement | null>,
  { onPrev, onNext, enabled = true }: {
    /** Swipe right: the newer day. */
    onPrev: () => void
    /** Swipe left: the older day. */
    onNext: () => void
    enabled?: boolean
  },
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
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
    }

    const up = (e: TouchEvent) => {
      if (axis === 'x' && from) {
        const t = e.changedTouches[0]
        const mx = t.clientX - from.x
        if (mx <= -COMMIT_AT) onNext()
        else if (mx >= COMMIT_AT) onPrev()
      }
      from = null
      axis = null
    }

    const cancel = () => { from = null; axis = null }

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
  }, [ref, onPrev, onNext, enabled])
}
