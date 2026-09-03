import { useCallback, useEffect, useState } from 'react'
import { sameDay, totalsFor } from '../derive'
import { Icon } from '../log/Icon'
import { getMoments } from '../moments'
import { getDevices } from '../db'
import { subscribe } from '../sync'
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

export function DayScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [day, setDay] = useState<Date | null>(null)

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
  }, [])
  useEffect(refresh, [refresh])
  useEffect(() => subscribe(refresh), [refresh])

  const days = daysWithEntries(moments)
  const selected = day ?? days[0] ?? new Date()
  const forDay = chronological(
    moments.filter((m) => sameDay(m.timeslot.occurred_at, selected)),
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
          return (
            <div key={m.timeslot.id}>
              <div className="trow">
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
    </main>
  )
}
