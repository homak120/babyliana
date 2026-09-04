import { useCallback, useEffect, useState } from 'react'
import { sameDay, totalsOf } from '../derive'
import { AddSheet } from '../log/AddSheet'
import { getMoments, removeMoment } from '../moments'
import { getDevices } from '../db'
import { subscribe, sync } from '../sync'
import type { Device, Moment } from '../types'
import { Icon } from '../log/Icon'
import { chronological, daysWithEntries, describeMoment } from './cells'
import { DayRow } from './DayRow'
import { ConfirmDelete } from '../swipe/ConfirmDelete'
import { PeriodPicker } from './PeriodPicker'
import { isoOf, rangeLabel, type Range } from './period'

// The read-back. Its whole purpose is that you can hold the phone next to the
// paper page and see the same thing, so the column order and the inherited date
// are not styling choices — they are the thing being reproduced.

const dayPill = (d: Date) =>
  sameDay(d.toISOString(), new Date())
    ? `today ${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getMonth() + 1}/${d.getDate()}`

const ALL = 'all' as const

export function DayScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  // null means "the most recent day with anything in it"; ALL means every day.
  const [day, setDay] = useState<Date | null | typeof ALL>(null)
  const [editing, setEditing] = useState<Moment | null>(null)

  // A picked period, which overrides `day` while it is set. The date pills only
  // ever cover the days that happen to have entries, so without this there was
  // no route to an older day at all.
  const [range, setRange] = useState<Range | null>(null)
  const [picking, setPicking] = useState(false)

  // Nothing is removed until the sheet is confirmed (Q-012). D-003 is a hard
  // delete with no tombstone, so the check happens before, not after.
  const [pendingDelete, setPendingDelete] = useState<Moment | null>(null)


  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
  }, [])
  useEffect(refresh, [refresh])

  const commitDelete = useCallback(
    (id: string) => {
      setPendingDelete(null)
      void removeMoment(id).then(() => {
        refresh()
        void sync()
      })
    },
    [refresh],
  )
  useEffect(() => subscribe(refresh), [refresh])

  const days = daysWithEntries(moments)
  const showingAll = day === ALL && !range
  const selected = showingAll ? new Date() : (day instanceof Date ? day : days[0] ?? new Date())
  const inScope = moments.filter((m) => {
    if (range) {
      const iso = isoOf(new Date(m.timeslot.occurred_at))
      return iso >= range.from && iso <= range.to
    }
    return showingAll || sameDay(m.timeslot.occurred_at, selected)
  })
  const forDay = chronological(inScope)
  // Totalled over what is actually on screen, so the numbers match the heading.
  const totals = totalsOf(forDay)
  const withData = new Set(moments.map((m) => isoOf(new Date(m.timeslot.occurred_at))))
  const nameFor = (id: string) => devices.find((d) => d.id === id)?.name ?? null

  return (
    <main className="day">
      <div className="datestrip">
        <button
          type="button"
          className={`daypill ${showingAll ? 'on' : ''}`}
          onClick={() => { setRange(null); setDay(ALL) }}
        >
          all days
        </button>
        {(days.length ? days : [new Date()]).map((d) => (
          <button
            type="button"
            key={+d}
            className={`daypill ${!showingAll && !range && +d === +selected ? 'on' : ''}`}
            onClick={() => { setRange(null); setDay(d) }}
          >
            {dayPill(d)}
          </button>
        ))}

        <button
          type="button"
          className={`morepill ${range ? 'on' : ''}`}
          onClick={() => setPicking(true)}
        >
          <Icon name="calendar_month" size={18} />
          {range ? rangeLabel(range) : 'more'}
        </button>
      </div>

      <p className="daylabel">
        {range ? rangeLabel(range) : showingAll ? 'all days' : dayPill(selected)}
      </p>

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
            onDelete={() => setPendingDelete(m)}
          />
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDelete
          label={describeMoment(pendingDelete)}
          onKeep={() => setPendingDelete(null)}
          onDelete={() => commitDelete(pendingDelete.timeslot.id)}
        />
      )}

      {picking && (
        <PeriodPicker
          today={isoOf(new Date())}
          withData={withData}
          initial={range}
          onClose={() => setPicking(false)}
          onApply={(r) => { setRange(r); setPicking(false) }}
        />
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
