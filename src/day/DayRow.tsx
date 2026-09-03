import { useRef, useState } from 'react'
import { Icon } from '../log/Icon'
import type { Moment } from '../types'
import { dateCell, diaperCell, initialOf, milkCell, otherCell, timeCell } from './cells'

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
  moment, previous, name, onEdit, onDelete,
}: {
  moment: Moment
  previous: Moment | undefined
  name: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const date = dateCell(moment, previous)
  const milk = milkCell(moment.events)
  const diaper = diaperCell(moment.events)
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
        className="trow"
        style={{ transform: `translateX(${offset}px)`, transition: dx === null ? undefined : 'none' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const mx = e.clientX - start.current.x
          const my = e.clientY - start.current.y
          // Only take over once the movement is clearly horizontal. Anything
          // else is the user scrolling, and stealing it would be worse than
          // having no swipe at all.
          if (dx === null && (Math.abs(mx) < ENGAGE_AT || Math.abs(mx) <= Math.abs(my))) return
          if (dx === null) e.currentTarget.setPointerCapture(e.pointerId)
          setDx(Math.max(-ACTIONS_W, Math.min(0, mx + (open ? -ACTIONS_W : 0))))
        }}
        onPointerUp={() => {
          if (dx !== null) setOpen(dx < -SNAP_AT)
          start.current = null
          setDx(null)
        }}
        onPointerCancel={() => {
          start.current = null
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
          {diaper}
          {rest && <em className="trest">{rest}</em>}
        </span>
        <span className="twho">{initial && <i className="avatar">{initial}</i>}</span>
      </div>

      {moment.timeslot.note && (
        <p className="tnote">
          <Icon name="edit_note" size={13} /> {moment.timeslot.note}
        </p>
      )}
    </div>
  )
}
