import { useCallback, useEffect, useRef, useState } from 'react'
import { sameDay, totalsOf } from '../derive'
import { getMoments } from '../moments'
import { getDevices } from '../db'
import { subscribe } from '../sync'
import type { Device, Moment } from '../types'
import { Icon } from '../log/Icon'
import { chronological, daysWithEntries } from './cells'
import { DayRow } from './DayRow'
import { usePageSwipe } from '../swipe/usePageSwipe'
import { PeriodPicker } from './PeriodPicker'
import { isoOf, rangeLabel, stepDay, type Range } from './period'
import { InsightsView } from '../report/InsightsView'
import type { Span } from '../report/insights'

// The read-back. Its whole purpose is that you can hold the phone next to the
// paper page and see the same thing, so the column order and the inherited date
// are not styling choices — they are the thing being reproduced.

const dayPill = (d: Date) =>
  sameDay(d.toISOString(), new Date())
    ? `today ${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getMonth() + 1}/${d.getDate()}`

const ALL = 'all' as const

/**
 * How many day pills the strip offers before `more` takes over.
 *
 * It used to offer every day that had entries, which pushed the picker off the
 * right-hand edge of the strip as soon as the log was a week old — the one
 * control that reaches an older day was the one you had to scroll to find. Three
 * is the most recent day and the two before it, which is what a phone-width
 * strip holds beside `all days` and `more`.
 */
const QUICK_DAYS = 3

function ModePills({
  mode,
  onMode,
}: {
  mode: 'log' | 'insights'
  onMode: (m: 'log' | 'insights') => void
}) {
  return (
    <div className="repmode">
      <button
        type="button"
        className={`modepill ${mode === 'log' ? 'on' : ''}`}
        onClick={() => onMode('log')}
      >
        <Icon name="list" size={16} /> log
      </button>
      <button
        type="button"
        className={`modepill ${mode === 'insights' ? 'on' : ''}`}
        onClick={() => onMode('insights')}
      >
        <Icon name="insights" size={16} /> insights
      </button>
    </div>
  )
}

export function DayScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  // null means "the most recent day with anything in it"; ALL means every day.
  const [day, setDay] = useState<Date | null | typeof ALL>(null)

  // A picked period, which overrides `day` while it is set. The date pills only
  // ever cover the days that happen to have entries, so without this there was
  // no route to an older day at all.
  const [range, setRange] = useState<Range | null>(null)
  const [picking, setPicking] = useState(false)

  // The screen opens on the read-back, which is the thing it exists for.
  // Insights is the second mode and carries its own range, so it ignores the
  // date strip and the picked period entirely.
  const [mode, setMode] = useState<'log' | 'insights'>('log')
  const [span, setSpan] = useState<Span>(7)


  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
  }, [])
  useEffect(refresh, [refresh])

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

  // Swiping the page steps between days. `days` is newest first, so the older
  // day is the next index — which is why a left swipe adds one.
  //
  // Only over days that have entries, so a swipe never lands on an empty table,
  // and only while a single day is showing: `all days` and a picked period are
  // deliberately not one day, so stepping has no meaning there and the gesture
  // is simply not attached.
  const page = useRef<HTMLElement>(null)
  const step = useCallback((delta: number) => {
    const next = stepDay(days, selected, delta)
    if (next) setDay(next)
  }, [days, selected])
  usePageSwipe(page, {
    onNext: () => step(1),
    onPrev: () => step(-1),
    enabled: mode === 'log' && !showingAll && !range,
  })

  // Insights shares only the mode pills with the read-back — no date strip, no
  // picked period, no totals row. Returning early keeps that honest instead of
  // threading four conditionals through one tree.
  if (mode === 'insights') {
    return (
      <main className="day" ref={page}>
        <ModePills mode={mode} onMode={setMode} />
        <InsightsView moments={moments} span={span} onSpan={setSpan} />
      </main>
    )
  }

  return (
    <main className="day" ref={page}>
      <ModePills mode={mode} onMode={setMode} />

      {/* `data-noswipe`: this scrolls sideways on its own, and dragging the
          pills to reach `more` must not step the day. */}
      <div className="datestrip" data-noswipe>
        <button
          type="button"
          className={`daypill ${showingAll ? 'on' : ''}`}
          onClick={() => { setRange(null); setDay(ALL) }}
        >
          all days
        </button>
        {(days.length ? days.slice(0, QUICK_DAYS) : [new Date()]).map((d) => (
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
          />
        ))}
      </div>

      {picking && (
        <PeriodPicker
          today={isoOf(new Date())}
          withData={withData}
          initial={range}
          onClose={() => setPicking(false)}
          onApply={(r) => { setRange(r); setPicking(false) }}
        />
      )}
    </main>
  )
}
