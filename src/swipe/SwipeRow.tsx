import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../log/Icon'
import './swipe.css'

/** Two 88px actions, so an open row sits at 176. */
const ACTIONS_W = 176
/** Past this, the row stays open; short of it, it springs back. */
const SNAP_AT = 60
/** Horizontal travel before the row starts visibly moving. */
const ENGAGE_AT = 8
/**
 * Travel in any direction before the gesture is called horizontal or vertical.
 *
 * Large enough that a real thumb's wobble has averaged out, small enough that
 * the row still moves as soon as the swipe is deliberate.
 */
const DECIDE_AT = 10

/**
 * A row that reveals edit and delete when dragged left (D-025).
 *
 * Shared rather than copied. The gesture took four attempts to get right on
 * iOS, and the reason the fourth was needed is that only the day view ever had
 * it — the owner was swiping the home screen, where no handler existed at all.
 * One implementation, used by both, is what stops that recurring.
 */
export function SwipeRow({
  className, onEdit, onDelete, children,
}: {
  className: string
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  // Native listeners, not React's.
  //
  // React attaches touchmove passively, so a handler there cannot call
  // preventDefault. The axis is then decided on accumulated distance rather
  // than the first pixel: a thumb arcs, and the first millimetre of a real
  // swipe is often more vertical than horizontal, so a first-pixel lock reads a
  // real finger as a scroll while passing every machine-straight test.
  //
  // Waiting is safe because `touch-action: pan-y` already tells iOS that
  // horizontal is ours; preventDefault below is belt and braces.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    let from: { x: number; y: number } | null = null
    let axis: 'x' | 'y' | null = null
    let travelled = 0

    const down = (e: TouchEvent) => {
      const t = e.touches[0]
      from = { x: t.clientX, y: t.clientY }
      axis = null
      travelled = open ? -ACTIONS_W : 0
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
      // Vertical: the user is scrolling the list. Leave it entirely alone.
      if (axis === 'y') return

      e.preventDefault()
      if (Math.abs(mx) < ENGAGE_AT && travelled === 0) return
      travelled = Math.max(-ACTIONS_W, Math.min(0, mx + (open ? -ACTIONS_W : 0)))
      setDx(travelled)
    }

    const up = () => {
      if (axis === 'x') setOpen(travelled < -SNAP_AT)
      from = null
      axis = null
      setDx(null)
    }

    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', up)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
    }
  }, [open])

  // Mouse only — touch is handled natively above, so the two never fight.
  const mouseFrom = useRef<{ x: number; y: number } | null>(null)
  const offset = dx ?? (open ? -ACTIONS_W : 0)

  return (
    <div className="rowwrap">
      <div className="rowactions">
        <button type="button" className="act edit" onClick={() => { setOpen(false); onEdit() }}>
          <Icon name="edit" size={20} />
          edit
        </button>
        <button type="button" className="act del" onClick={() => { setOpen(false); onDelete() }}>
          <Icon name="delete" size={20} />
          delete
        </button>
      </div>

      <div
        ref={rowRef}
        className={`${className} swipeable`}
        style={{ transform: `translateX(${offset}px)`, transition: dx === null ? undefined : 'none' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'touch') return
          mouseFrom.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch' || !mouseFrom.current) return
          const mx = e.clientX - mouseFrom.current.x
          const my = e.clientY - mouseFrom.current.y
          if (dx === null && (Math.abs(mx) < ENGAGE_AT || Math.abs(mx) <= Math.abs(my))) return
          if (dx === null) e.currentTarget.setPointerCapture(e.pointerId)
          setDx(Math.max(-ACTIONS_W, Math.min(0, mx + (open ? -ACTIONS_W : 0))))
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') return
          if (dx !== null) setOpen(dx < -SNAP_AT)
          mouseFrom.current = null
          setDx(null)
        }}
        onPointerCancel={() => {
          mouseFrom.current = null
          setDx(null)
        }}
      >
        {children}
      </div>
    </div>
  )
}
