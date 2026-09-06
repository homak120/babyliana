import { Icon } from '../log/Icon'
import type { Moment } from '../types'
import {
  avatarClass, dateCell, diaperParts, feedCell, initialOf, milkCell, otherCell, sleepCell,
  timeCell,
} from './cells'

/**
 * A row on the read-back, and **only** a read-back — it does not swipe.
 *
 * Editing and deleting live on the home screen alone (the owner's call,
 * 2026-09-06, amending D-025). The gesture is spent here on moving between
 * days instead: one screen, one meaning for a horizontal drag.
 */
export function DayRow({
  moment, previous, name, allDeviceIds,
}: {
  moment: Moment
  previous: Moment | undefined
  name: string | null
  allDeviceIds: string[]
}) {
  const date = dateCell(moment, previous)
  const milk = milkCell(moment.events)
  const diaper = diaperParts(moment.events)
  const rest = otherCell(moment.events)
  const sleep = sleepCell(moment)
  const fed = feedCell(moment)
  const initial = initialOf(name)

  return (
    <>
      <div className="trow">
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
          {/* Beside "slept 1h 20m" rather than in the milk column, which the
              unit and the source word already filled. */}
          {fed && (
            <em className="tfeed">
              <Icon name="timer" size={13} /> {fed}
            </em>
          )}
          {sleep && (
            <em className={sleep.open ? 'tsleep open' : 'tsleep'}>
              <Icon name={sleep.icon} size={13} /> {sleep.text}
            </em>
          )}
          {rest && <em className="trest">{rest}</em>}
        </span>
        <span className="twho">
          {initial && (
            <i className={avatarClass(moment.timeslot.logged_by, allDeviceIds)}>{initial}</i>
          )}
        </span>
      </div>

      {/* Outside the row, as it always was — it is a second line, not a cell. */}
      {moment.timeslot.note && (
        <p className="tnote">
          <Icon name="edit_note" size={13} /> {moment.timeslot.note}
        </p>
      )}
    </>
  )
}
