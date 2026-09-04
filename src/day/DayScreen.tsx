import { useCallback, useEffect, useRef, useState } from 'react'
import { sameDay, totalsFor } from '../derive'
import { AddSheet } from '../log/AddSheet'
import { getMoments, removeMoment } from '../moments'
import { getDevices } from '../db'
import { subscribe, sync } from '../sync'
import type { Device, Moment } from '../types'
import { Icon } from '../log/Icon'
import { chronological, daysWithEntries } from './cells'
import { DayRow } from './DayRow'

// The read-back. Its whole purpose is that you can hold the phone next to the
// paper page and see the same thing, so the column order and the inherited date
// are not styling choices — they are the thing being reproduced.

const dayPill = (d: Date) =>
  sameDay(d.toISOString(), new Date())
    ? `today ${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getMonth() + 1}/${d.getDate()}`

/** How long a deleted moment is held before it actually goes (D-025). */
const UNDO_MS = 5000
const ALL = 'all' as const

export function DayScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  // null means "the most recent day with anything in it"; ALL means every day.
  const [day, setDay] = useState<Date | null | typeof ALL>(null)
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
  const showingAll = day === ALL
  const selected = showingAll ? new Date() : (day ?? days[0] ?? new Date())
  const forDay = chronological(
    moments
      .filter((m) => showingAll || sameDay(m.timeslot.occurred_at, selected))
      .filter((m) => m.timeslot.id !== undo?.timeslot.id),
  )
  const totals = totalsFor(moments, selected)
  const nameFor = (id: string) => devices.find((d) => d.id === id)?.name ?? null

  return (
    <main className="day">
      <div className="datestrip">
        <button
          type="button"
          className={`daypill ${day === ALL ? 'on' : ''}`}
          onClick={() => setDay(ALL)}
        >
          all days
        </button>
        {(days.length ? days : [new Date()]).map((d) => (
          <button
            type="button"
            key={+d}
            className={`daypill ${!showingAll && +d === +selected ? 'on' : ''}`}
            onClick={() => setDay(d)}
          >
            {dayPill(d)}
          </button>
        ))}
      </div>

      <p className="daylabel">{showingAll ? 'all days' : dayPill(selected)}</p>

      <div className="totals">
        <span className="tag rose"><Icon name="local_drink" size={14} /> {totals.feeds}</span>
        <span className="tag lav"><Icon name="water_full" size={14} /> {totals.ml} mL</span>
        <span className="tag yellow"><Icon name="water_drop" size={14} /> {totals.pee}</span>
        <span className="tag mint"><Icon name="cookie" size={14} /> {totals.poop}</span>
        {totals.unknownVolumes > 0 && (
          <span className="tag chip">? &times; {totals.unknownVolumes}</span>
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

        {forDay.map((m, i) => (
          <DayRow
            key={m.timeslot.id}
            moment={m}
            previous={forDay[i - 1]}
            name={nameFor(m.timeslot.logged_by)}
            allDeviceIds={devices.map((d) => d.id)}
            onEdit={() => setEditing(m)}
            onDelete={() => {
              setUndo(m)
              if (undoTimer.current) clearTimeout(undoTimer.current)
              undoTimer.current = setTimeout(() => commitDelete(m.timeslot.id), UNDO_MS)
            }}
          />
        ))}
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
