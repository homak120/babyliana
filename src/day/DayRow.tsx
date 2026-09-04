import { useEffect, useRef, useState } from 'react'
import { Icon } from '../log/Icon'
import type { Moment } from '../types'
import { avatarClass, dateCell, diaperParts, initialOf, milkCell, otherCell, timeCell } from './cells'

/** Two 88px actions, so an open row sits at 176. */
const ACTIONS_W = 176
/** Past this, the row stays open; short of it, it springs back. */
const SNAP_AT = 40
/**
 * Horizontal travel before the gesture is treated as a swipe at all.
 *
 * Without it, any touch on a row starts a drag and scrolling the day list feels
 * broken — which is the whole reason this lives in the row rather than in a
 * shared bit of state.
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

  // Native listeners, not React's.
  //
  // React attaches touchmove passively, so a handler there cannot call
  // preventDefault — and without that iOS arbitrates the gesture as a scroll and
  // cancels the pointer before a horizontal swipe engages. That is why this
  // worked with a mouse and did nothing on a phone.
  //
  // The drag value lives in the closure rather than a ref, so nothing is read
  // or written during render.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    let from: { x: number; y: number } | null = null
    let engaged = false
    let travelled = 0

    const down = (e: TouchEvent) => {
      const t = e.touches[0]
      from = { x: t.clientX, y: t.clientY }
      engaged = false
      travelled = open ? -ACTIONS_W : 0
    }

    const move = (e: TouchEvent) => {
      if (!from) return
      const t = e.touches[0]
      const mx = t.clientX - from.x
      const my = t.clientY - from.y
      if (!engaged) {
        // Only take over once the movement is clearly horizontal; anything else
        // is the user scrolling, and stealing that is worse than no swipe.
        if (Math.abs(mx) < ENGAGE_AT || Math.abs(mx) <= Math.abs(my)) return
        engaged = true
      }
      e.preventDefault()
      travelled = Math.max(-ACTIONS_W, Math.min(0, mx + (open ? -ACTIONS_W : 0)))
      setDx(travelled)
    }

    const up = () => {
      if (engaged) setOpen(travelled < -SNAP_AT)
      from = null
      engaged = false
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
