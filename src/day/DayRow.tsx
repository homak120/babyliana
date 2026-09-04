import { useEffect, useRef, useState } from 'react'
import { Icon } from '../log/Icon'
import type { Moment } from '../types'
import { avatarClass, dateCell, diaperParts, initialOf, milkCell, otherCell, timeCell } from './cells'

/** Two 88px actions, so an open row sits at 176. */
const ACTIONS_W = 176
/** Past this, the row stays open; short of it, it springs back. */
const SNAP_AT = 40
/**
 * Horizontal travel before the row actually starts moving.
 *
 * Without it, any touch on a row twitches it and scrolling the day list feels
 * broken. Note this is only about *drawing* the drag — which gesture owns the
 * touch is decided earlier and separately. See the axis lock below.
 */
const ENGAGE_AT = 8

export function DayRow({
  moment, previous, name, allDeviceIds, onEdit, onDelete,
}: {
  moment: Moment
  previous: Moment | undefined
  name: string | null
  allDeviceIds: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  // Native listeners, not React's, and the axis is locked on the first move.
  //
  // Two separate iOS problems live here, and only fixing both makes the swipe
  // work on a phone.
  //
  // 1. React attaches touchmove passively, so a handler there cannot call
  //    preventDefault at all.
  //
  // 2. iOS decides what a gesture is on its *first* touchmove. If that move
  //    goes by without preventDefault, the touch is committed to scrolling and
  //    is never handed back, no matter what later moves do. The previous
  //    version waited for 8px of horizontal travel before calling
  //    preventDefault — by which point iOS had already made up its mind. That
  //    is the bug: it looked correct, and passed a synthetic test, because
  //    synthetic events have no such arbitration.
  //
  // So the axis is locked on the first move that carries any distance, and the
  // touch is claimed from that moment. ENGAGE_AT then only governs when the row
  // starts visibly moving, which is a cosmetic threshold and safe to wait for.
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
        // Anything smaller than this is noise from a resting finger, not a
        // direction. Deliberately tiny: waiting is what loses the gesture.
        if (Math.abs(mx) < 1 && Math.abs(my) < 1) return
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      }
      // Vertical: the user is scrolling the day list. Leave it entirely alone.
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

  const date = dateCell(moment, previous)
  const milk = milkCell(moment.events)
  const diaper = diaperParts(moment.events)
  const rest = otherCell(moment.events)
  const initial = initialOf(name)

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
        className="trow"
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
        <span className="tdate">{date}</span>
        <span className="ttime">{timeCell(moment)}</span>
        <span className="tmilk">
          {milk === null ? '' : milk.unknown ? (
            <b className="unknown">{milk.parts.join(' + ')}</b>
          ) : (
            milk.parts.join(' + ')
          )}
        </span>
        <span className="tdiaper">
          {diaper.pee && <em className="tpee">pee</em>}
          {diaper.poop && <em className="tpoop">{diaper.poop}</em>}
          {rest && <em className="trest">{rest}</em>}
        </span>
        <span className="twho">
          {initial && (
            <i className={avatarClass(moment.timeslot.logged_by, allDeviceIds)}>{initial}</i>
          )}
        </span>
      </div>

      {moment.timeslot.note && (
        <p className="tnote">
          <Icon name="edit_note" size={13} /> {moment.timeslot.note}
        </p>
      )}
    </div>
  )
}
