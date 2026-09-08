import { useCallback, useEffect, useRef, useState } from 'react'
import { sameDay } from '../derive'
import { getMoments } from '../moments'
import { getDevices } from '../db'
import { subscribe } from '../sync'
import type { Device, Moment } from '../types'
import { Icon } from '../log/Icon'
import { chronological, daysWithEntries } from './cells'
import { DayPage } from './DayPage'
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
  const withData = new Set(moments.map((m) => isoOf(new Date(m.timeslot.occurred_at))))

  // --- swiping between days -------------------------------------------------
  //
  // Two pages on a track, the one you are reading and the one you are dragging
  // toward, moved as a pair — the way a phone moves between pages everywhere
  // else. An earlier pass slid only the outgoing page and animated the new one
  // in afterwards, which looked like two separate movements rather than one.
  //
  // `days` is newest first, so the older day is the next index — a left swipe
  // adds one. Only days that have entries, so a swipe never lands on an empty
  // table, and only while a single day is showing: `all days` and a picked
  // period are deliberately not one day, so the gesture is not attached at all.
  const page = useRef<HTMLElement>(null)
  /** Which neighbour is mounted beside the current page, if any. */
  const [pan, setPan] = useState<'older' | 'newer' | null>(null)
  /** True from the moment the finger lifts until the track finishes moving. */
  const [gliding, setGliding] = useState(false)
  /** Where the track is going, or null if it is springing back. */
  const landing = useRef<Date | null>(null)

  const swipeable = mode === 'log' && !showingAll && !range
  const dx = usePageSwipe(page, {
    onNext: () => { landing.current = stepDay(days, selected, 1) },
    onPrev: () => { landing.current = stepDay(days, selected, -1) },
    onSettle: () => setGliding(true),
    enabled: swipeable,
  })

  // Which side the neighbour goes on, decided the moment the drag has a
  // direction and held until the track has finished moving — the offset returns
  // to 0 on release, and the page must not jump back mid-glide.
  useEffect(() => {
    if (dx !== 0) { setPan(dx < 0 ? 'older' : 'newer'); setGliding(false) }
  }, [dx])

  const neighbour = pan ? stepDay(days, selected, pan === 'older' ? 1 : -1) : null
  const dayOf = (d: Date) =>
    chronological(moments.filter((m) => sameDay(m.timeslot.occurred_at, d)))

  // The track holds [current, older] or [newer, current], so its resting offset
  // is 0 in the first case and -100% in the second.
  const base = pan === 'newer' ? -100 : 0
  // One-to-one with the thumb where there is a page to reach; where there is
  // not, it barely gives, so the end of the log is something you feel rather
  // than read.
  const held = neighbour
    ? Math.max(-window.innerWidth, Math.min(window.innerWidth, dx))
    : Math.max(-18, Math.min(18, dx * 0.12))
  const goingTo = landing.current
  const target = goingTo ? (pan === 'older' ? -100 : 0) : base

  const settle = useCallback(() => {
    if (landing.current) { setDay(landing.current); landing.current = null }
    setPan(null)
    setGliding(false)
  }, [])

  // A fallback for the glide that never ends. `prefers-reduced-motion` removes
  // the transition entirely, so `transitionend` never fires and without this the
  // day would never change for anyone who asked for less movement. Also covers a
  // transition interrupted by a re-render.
  useEffect(() => {
    if (!gliding) return
    const t = setTimeout(settle, 400)
    return () => clearTimeout(t)
  }, [gliding, settle])

  // --- keeping the rail and the page in step --------------------------------
  //
  // The day changes two ways — a pill is tapped, or the page is swiped — and
  // the rail has to follow the second one as well as the first. Swiping back a
  // week and leaving the strip showing today would put the selected pill off
  // the left-hand edge, so the one control that says which day you are on would
  // be the one you have to go looking for.
  //
  // Centred by hand rather than with `scrollIntoView`. That method walks every
  // scrollable ancestor, so on a phone it scrolls the *page* vertically as well
  // — the table jumps under the thumb on what was meant to be a sideways move.
  const rail = useRef<HTMLDivElement>(null)
  const at = +selected
  useEffect(() => {
    const el = rail.current
    if (!el) return
    const pill = el.querySelector<HTMLElement>('.daypill.on')
    if (!pill) return
    el.scrollTo({
      left: Math.max(0, pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2),
      behavior: 'smooth',
    })
  }, [at, showingAll, range])

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

      {/* `data-noswipe` on the whole strip: nothing in the chrome may step the
          day, and the rail inside it scrolls sideways on its own. */}
      <div className="datestrip" data-noswipe>
        {/* `all days` and `more` are the two fixed ends. They are the controls
            you reach for when you do not know which day you want, so they must
            be in the same place every time — the rail between them is the part
            that moves, and it holds every day the log has rather than the three
            that happened to fit. */}
        <button
          type="button"
          className={`daypill ${showingAll ? 'on' : ''}`}
          onClick={() => { setRange(null); setDay(ALL) }}
        >
          all days
        </button>

        <div className="dayrail" ref={rail}>
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
        </div>

        <button
          type="button"
          className={`morepill ${range ? 'on' : ''}`}
          onClick={() => setPicking(true)}
        >
          <Icon name="calendar_month" size={18} />
          {range ? rangeLabel(range) : 'more'}
        </button>
      </div>

      {/* The part that moves: two pages on a track, dragged as a pair. The mode
          pills and the date strip are chrome and hold still. */}
      <div
        className={`daytrack${pan ? ' panning' : ''}`}
        style={pan ? {
          transform: gliding
            ? `translateX(${target}%)`
            : `translateX(calc(${base}% + ${held}px))`,
          // No transition while the finger is down, or the track lags behind
          // the thumb; one the moment it lifts, so the page glides home
          // whichever way it is going.
          transition: gliding ? 'transform 0.26s ease-out' : 'none',
        } : undefined}
        // Only this element's own transform. `transitionend` bubbles, and a
        // pill or a row finishing its own transition inside the page would
        // otherwise settle the track early and mid-slide.
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'transform') settle()
        }}
      >
        {pan === 'newer' && neighbour && (
          <DayPage
            label={dayPill(neighbour)}
            rows={dayOf(neighbour)}
            devices={devices}
            empty="nothing logged in this period."
          />
        )}

        <DayPage
          label={range ? rangeLabel(range) : showingAll ? 'all days' : dayPill(selected)}
          rows={forDay}
          devices={devices}
          empty="nothing logged in this period."
        />

        {pan === 'older' && neighbour && (
          <DayPage
            label={dayPill(neighbour)}
            rows={dayOf(neighbour)}
            devices={devices}
            empty="nothing logged in this period."
          />
        )}
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
