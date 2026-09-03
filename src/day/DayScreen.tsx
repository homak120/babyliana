import { useCallback, useEffect, useRef, useState } from 'react'
import { sameDay, totalsFor } from '../derive'
import { Icon } from '../log/Icon'
import { AddSheet } from '../log/AddSheet'
import { getMoments, removeMoment } from '../moments'
import { getDevices } from '../db'
import { subscribe, sync } from '../sync'
import type { Device, Moment } from '../types'
import {
  chronological, dateCell, daysWithEntries, diaperCell, initialOf,
  milkCell, otherCell, timeCell,
} from './cells'

// The read-back. Its whole purpose is that you can hold the phone next to the
// paper page and see the same thing, so the column order and the inherited date
// are not styling choices — they are the thing being reproduced.

const dayPill = (d: Date) =>
  sameDay(d.toISOString(), new Date())
    ? `today ${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getMonth() + 1}/${d.getDate()}`

/** Two 88px actions, so a row opens to 176. */
const ACTIONS_W = 176
const SNAP_AT = 40
const UNDO_MS = 5000

/** Left only, and no further than the actions are wide. */
const clampDx = (raw: number, alreadyOpen: boolean) =>
  Math.max(-ACTIONS_W, Math.min(0, raw + (alreadyOpen ? -ACTIONS_W : 0)))

export function DayScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [day, setDay] = useState<Date | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)
  /** An in-progress drag. Kept in state so the transform is a render output. */
  const [drag, setDrag] = useState<{ id: string; from: number; dx: number } | null>(null)
  const [editing, setEditing] = useState<Moment | null>(null)

  // The moment is hidden at once and actually deleted when the toast expires.
  // D-003 is a hard delete with no tombstone, so once it goes there is nothing
  // to restore it from — the window is the only recourse a mis-swipe has.
  const [undo, setUndo] = useState<Moment | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)


  // If the screen goes away mid-window the delete still happens. You asked for
  // it; silently keeping the row would be the surprising outcome.
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    [],
  )

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
  }, [])
  useEffect(refresh, [refresh])

  const commitDelete = useCallback(
    (id: string) => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
      undoTimer.current = null
      setUndo(null)
      void removeMoment(id).then(() => {
        refresh()
        void sync()
      })
    },
    [refresh],
  )
  useEffect(() => subscribe(refresh), [refresh])

  const days = daysWithEntries(moments)
  const selected = day ?? days[0] ?? new Date()
  const forDay = chronological(
    moments
      .filter((m) => sameDay(m.timeslot.occurred_at, selected))
      .filter((m) => m.timeslot.id !== undo?.timeslot.id),
  )
  const totals = totalsFor(moments, selected)
  const nameFor = (id: string) => devices.find((d) => d.id === id)?.name ?? null

  return (
    <main className="day">
      <div className="datestrip">
        {(days.length ? days : [new Date()]).map((d) => (
          <button
            type="button"
            key={+d}
            className={`daypill ${+d === +selected ? 'on' : ''}`}
            onClick={() => setDay(d)}
          >
            {dayPill(d)}
          </button>
        ))}
      </div>

      <div className="totals">
        <span className="tag rose">{totals.feeds} feeds</span>
        <span className="tag lav">{totals.ml} mL</span>
        <span className="tag yellow">{totals.pee} pee</span>
        <span className="tag mint">{totals.poop} poop</span>
        {totals.unknownVolumes > 0 && (
          <span className="tag chip">unmarked {totals.unknownVolumes}</span>
        )}
      </div>

      <div className="table">
        <div className="thead">
          <span>date</span>
          <span>time</span>
          <span>milk</span>
          <span>pee/poop</span>
          <span />
        </div>

        {forDay.length === 0 && <p className="empty">nothing logged in this period.</p>}

        {forDay.map((m, i) => {
          const date = dateCell(m, forDay[i - 1])
          const milk = milkCell(m.events)
          const diaper = diaperCell(m.events)
          const rest = otherCell(m.events)
          const initial = initialOf(nameFor(m.timeslot.logged_by))
          const open = openRow === m.timeslot.id
          return (
            <div key={m.timeslot.id} className="rowwrap">
              <div className="rowactions">
                <button
                  type="button"
                  className="act edit"
                  onClick={() => {
                    setEditing(m)
                    setOpenRow(null)
                  }}
                >
                  <Icon name="edit" size={20} />
                  edit
                </button>
                <button
                  type="button"
                  className="act del"
                  onClick={() => {
                    setOpenRow(null)
                    setUndo(m)
                    if (undoTimer.current) clearTimeout(undoTimer.current)
                    undoTimer.current = setTimeout(() => commitDelete(m.timeslot.id), UNDO_MS)
                  }}
                >
                  <Icon name="delete" size={20} />
                  delete
                </button>
              </div>
              <div
                className="trow"
                style={{
                  transform: `translateX(${
                    drag?.id === m.timeslot.id ? drag.dx : open ? -ACTIONS_W : 0
                  }px)`,
                  transition: drag?.id === m.timeslot.id ? 'none' : undefined,
                }}
                onPointerDown={(e) => setDrag({ id: m.timeslot.id, from: e.clientX, dx: 0 })}
                onPointerMove={(e) => {
                  setDrag((d) =>
                    d && d.id === m.timeslot.id
                      ? { ...d, dx: clampDx(e.clientX - d.from, open) }
                      : d,
                  )
                }}
                onPointerUp={() => {
                  // Past the snap point it stays open; short of it, it springs back.
                  setOpenRow(drag && drag.dx < -SNAP_AT ? m.timeslot.id : null)
                  setDrag(null)
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <span className="tdate">{date}</span>
                <span className="ttime">{timeCell(m)}</span>
                <span className="tmilk">
                  {milk === null ? (
                    ''
                  ) : milk.unknown ? (
                    <b className="unknown">{milk.parts.join(' + ')}</b>
                  ) : (
                    milk.parts.join(' + ')
                  )}
                </span>
                <span className="tdiaper">
                  {diaper}
                  {rest && <em className="trest">{rest}</em>}
                </span>
                <span className="twho">
                  {initial && <i className="avatar">{initial}</i>}
                </span>
              </div>
              {m.timeslot.note && (
                <p className="tnote">
                  <Icon name="edit_note" size={13} /> {m.timeslot.note}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {undo && (
        <div className="toast" role="status">
          <span>moment deleted</span>
          <button
            type="button"
            onClick={() => {
              if (undoTimer.current) clearTimeout(undoTimer.current)
              undoTimer.current = null
              setUndo(null)
            }}
          >
            undo
          </button>
        </div>
      )}

      {editing && (
        <AddSheet
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
            void sync()
          }}
        />
      )}
    </main>
  )
}
