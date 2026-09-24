import { totalsOf } from '../derive'
import { Icon } from '../log/Icon'
import type { Caregiver, Moment } from '../types'
import { DayRow } from './DayRow'
import { summarise } from './summary'

// One page of the read-back: the heading, the totals and the table.
//
// Its own component because the swipe renders **two** of them side by side —
// the day you are on and the one you are dragging toward — and a page that only
// existed inline could not be. Everything above it on the screen (the mode
// pills, the date strip) is chrome and stays put while these slide.

export function DayPage({
  label, rows, caregivers, empty,
}: {
  label: string
  rows: Moment[]
  caregivers: Caregiver[]
  /** What to say when the period has nothing in it. */
  empty: string
}) {
  // Totalled over what is actually on this page, so the numbers match the
  // heading rather than the whole log.
  const totals = totalsOf(rows)
  // The tag row is the glance; this is the rest of what the page holds. A day
  // with a weight, a temperature and four notes in it looked exactly like a day
  // without them until the table was scrolled.
  const lines = summarise(rows)
  const nameFor = (id: string) => caregivers.find((d) => d.id === id)?.name ?? null

  return (
    <div className="daypage">
      <p className="daylabel">{label}</p>

      <div className="totals">
        <span className="tag rose"><Icon name="local_drink" size={14} /> {totals.feeds}</span>
        <span className="tag lav"><Icon name="water_full" size={14} /> {totals.ml} mL</span>
        <span className="tag yellow"><Icon name="water_drop" size={14} /> {totals.pee}</span>
        <span className="tag mint"><Icon name="cookie" size={14} /> {totals.poop}</span>
        {totals.unknownVolumes > 0 && (
          <span className="tag chip">? &times; {totals.unknownVolumes}</span>
        )}
      </div>

      {lines.length > 0 && (
        <dl className="daysum">
          {lines.map((l, n) => (
            // A continuation carries no key of its own — it is the line above
            // still talking, and repeating "milk" beside it would read as a
            // second figure for the same thing.
            <div className="sumRow" key={n}>
              <dt className="sumKey">{l.key ?? ''}</dt>
              <dd className="sumVal">{l.text}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="table">
        <div className="thead">
          <span>date</span>
          <span>time</span>
          <span>milk</span>
          <span>pee/poop</span>
          <span />
        </div>

        {rows.length === 0 && <p className="empty">{empty}</p>}

        {rows.map((m, i) => (
          <DayRow
            key={m.timeslot.id}
            moment={m}
            previous={rows[i - 1]}
            name={nameFor(m.timeslot.logged_by)}
            allCaregiverIds={caregivers.map((d) => d.id)}
          />
        ))}
      </div>
    </div>
  )
}
