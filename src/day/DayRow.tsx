import { SwipeRow } from '../swipe/SwipeRow'
import { Icon } from '../log/Icon'
import type { Moment } from '../types'
import { avatarClass, dateCell, diaperParts, initialOf, milkCell, otherCell, timeCell } from './cells'

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
  const date = dateCell(moment, previous)
  const milk = milkCell(moment.events)
  const diaper = diaperParts(moment.events)
  const rest = otherCell(moment.events)
  const initial = initialOf(name)

  return (
    <>
      <SwipeRow className="trow" onEdit={onEdit} onDelete={onDelete}>
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
      </SwipeRow>

      {/* Outside the wrapper: the actions should back the row, not the note. */}
      {moment.timeslot.note && (
        <p className="tnote">
          <Icon name="edit_note" size={13} /> {moment.timeslot.note}
        </p>
      )}
    </>
  )
}
