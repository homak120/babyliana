import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import {
  COLLAPSED_OFFSETS, END_OFFSETS, HOLD_MS, MINUTE_OFFSETS,
  atHourMinute, dayDate, dayWord, daysBack, endNow, formatDuration, minutesAfter, minutesAgo,
  onDay, pad, resolveEnd, stepFor, withHourMinute, wrapHour, wrapMinute,
} from './time'

// Always first in the sheet. Defaults to now, which is the overwhelmingly
// common case and costs zero taps; everything here is for the rest.
//
// No natural-language parsing, deliberately. "half four" fails silently and
// guesses wrong, and the person using it is tired and will not notice. Numeric
// entry gets the same speed with none of the ambiguity.

type Field = 'h' | 'm' | 'eh' | 'em'

/** Press-and-hold repeats, accelerating so a big change stays one gesture. */
function useHold(onStep: (step: number) => void) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticks = useRef(0)

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    ticks.current = 0
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }, [])
  useEffect(() => stop, [stop])

  return {
    onPointerDown: () => {
      onStep(1)
      // The release is heard on the window, not only on the button (D-044).
      // A chevron can be disabled by the very step it just took — the later-day
      // one on reaching today, the earlier-end-day one on reaching the start's
      // day — and React then removes its handlers, so `onPointerUp` never
      // arrives. The interval outlived the press and re-applied its stale step
      // every 110ms, quietly overwriting whatever was done next: the end time
      // could not be changed at all once its date had been stepped back.
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
      timer.current = setInterval(() => {
        ticks.current += 1
        onStep(stepFor(ticks.current))
      }, HOLD_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  }
}

function Stepper({
  value, onChange, active, onFocusField, big,
}: {
  value: number
  onChange: (next: number) => void
  active: boolean
  onFocusField: () => void
  big: boolean
}) {
  const down = useHold((s) => onChange(value - s))
  const up = useHold((s) => onChange(value + s))
  return (
    <div className="timestepper">
      <button type="button" className="stepper" aria-label="down" {...down}>
        <Icon name="remove" size={18} />
      </button>
      <input
        className={`num ${active ? 'active' : ''} ${big ? '' : 'small'}`}
        inputMode="numeric"
        value={pad(value)}
        onFocus={onFocusField}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(-2)
          if (digits !== '') onChange(Number(digits))
        }}
      />
      <button type="button" className="stepper" aria-label="up" {...up}>
        <Icon name="add" size={18} />
      </button>
    </div>
  )
}

/**
 * One chevron of the date row. Holding runs through days, accelerating exactly
 * as the hour and minute steppers do — ten days back for the coverage run is a
 * hold, not ten taps.
 */
function DayStep({
  label, icon, onStep, disabled = false,
}: {
  label: string
  icon: string
  onStep: (days: number) => void
  disabled?: boolean
}) {
  const hold = useHold(onStep)
  return (
    <button
      type="button" className="stepper" aria-label={label} disabled={disabled}
      {...hold}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}

export function TimeCard({
  start, end, onChange,
}: {
  start: Date
  end: Date | null
  onChange: (start: Date, end: Date | null) => void
}) {
  const [field, setField] = useState<Field>('h')
  const [expanded, setExpanded] = useState(false)
  /**
   * Set once the date row has been touched (D-043).
   *
   * After that the six-hour rule stops running: a date chosen by hand is an
   * answer, and inferring over it would move an entry off the day someone just
   * picked. Before it, the inference is what fills the date row in — the guess
   * became a default rather than a verdict.
   */
  const [pinned, setPinned] = useState(false)
  /**
   * The same flag for the end (D-044).
   *
   * Until it is set, the end is anchored to the start's day and rolled forward
   * when it lands before it — which is what makes `23:30` plus an hour read as
   * `00:30 tomorrow` without anyone thinking about it. Once the end's own date
   * row is touched, the end keeps the day it is on and the time steppers stop
   * re-anchoring it to the start.
   */
  const [endPinned, setEndPinned] = useState(false)

  const setStart = (h: number, m: number) => {
    // `start` is the anchor: editing an older moment keeps its own day.
    const next = pinned ? atHourMinute(h, m, start) : withHourMinute(h, m, new Date(), start)
    onChange(next, end ? resolveEnd(next, end) : null)
  }

  const back = daysBack(start)
  /**
   * How many days past the start the end sits — 0 or 1, and the handoff allows
   * nothing else. Nothing in a newborn log runs past a day, and the cap is what
   * makes both arrows answerable: back at 0, forward at 1.
   */
  const endOffset = end ? daysBack(start) - daysBack(end) : 0
  const stepDay = (days: number) => {
    // Never forward of today. There is no such thing as a feed that has not
    // happened, and the old inference made a future date impossible to reach by
    // accident — the date row must not be the thing that reintroduces it.
    if (days > 0 && back <= 0) return
    setPinned(true)
    const moved = onDay(start, end, days)
    onChange(moved.start, moved.end)
  }
  const setEnd = (h: number, m: number) => {
    if (!end) return
    // Pinned, the end's own day is the answer and nothing rolls it: changing
    // `00:30` to `23:45` on a pinned 9/7 means 9/7 23:45, and correcting the
    // day after that is what the row above is for.
    if (endPinned) {
      onChange(start, atHourMinute(wrapHour(h), wrapMinute(m), end))
      return
    }
    const raw = new Date(start)
    raw.setHours(wrapHour(h), wrapMinute(m), 0, 0)
    onChange(start, resolveEnd(start, raw))
  }

  const stepEndDay = (days: number) => {
    if (!end) return
    // The start's day or the one after it. Earlier is a period the database
    // refuses outright (`ended_at >= occurred_at`); later than one day is not a
    // thing this log records.
    const next = endOffset + days
    if (next < 0 || next > 1) return
    const moved = new Date(end)
    moved.setDate(moved.getDate() + days)
    setEndPinned(true)
    onChange(start, moved)
  }

  const offsets = expanded ? MINUTE_OFFSETS : MINUTE_OFFSETS.slice(0, COLLAPSED_OFFSETS)

  return (
    <section className="block timecard">
      {/* Above the clock, because the day is the coarser question and reading it
          answers "did it guess right?" at a glance — which is the whole reason
          this row exists. Always visible rather than behind a tap: logging now
          costs no extra taps either way, and a date you cannot see is a date
          nobody checks (D-043). */}
      <div className="daterow">
        <Icon name="calendar_today" size={20} />
        <DayStep label="earlier day" icon="chevron_left" onStep={(n) => stepDay(-n)} />
        <span className="dateword">{dayWord(start)}</span>
        <DayStep
          label="later day" icon="chevron_right" disabled={back <= 0}
          onStep={(n) => stepDay(n)}
        />
      </div>

      <div className="timerow">
        <Icon name="schedule" size={17} />
        <Stepper
          value={start.getHours()} active={field === 'h'} big
          onFocusField={() => setField('h')}
          onChange={(v) => setStart(wrapHour(v), start.getMinutes())}
        />
        <span className="colon">:</span>
        <Stepper
          value={start.getMinutes()} active={field === 'm'} big
          onFocusField={() => setField('m')}
          onChange={(v) => setStart(start.getHours(), wrapMinute(v))}
        />
      </div>

      <p className="timehint">hold &minus; or + to run, or type over any number</p>

      <div className="shortcuts">
        <button type="button" className="pill" onClick={() => setStart(new Date().getHours(), new Date().getMinutes())}>
          <Icon name="schedule" size={14} /> now
        </button>
        {offsets.map((o) => (
          <button
            type="button" key={o} className="pill"
            onClick={() => {
              const d = minutesAgo(o)
              onChange(d, end ? resolveEnd(d, end) : null)
            }}
          >
            {o} min ago
          </button>
        ))}
        <button type="button" className="pill dim" onClick={() => setExpanded(!expanded)}>
          {expanded ? '−' : '…'}
        </button>
      </div>

      {end === null ? (
        <button
          type="button" className="pill addend"
          onClick={() => onChange(start, endNow(start))}
        >
          <Icon name="add" size={16} /> end time — optional
        </button>
      ) : (
        <div className="endblock">
          <div className="timerow end">
            <Stepper
              value={end.getHours()} active={field === 'eh'} big={false}
              onFocusField={() => setField('eh')}
              onChange={(v) => setEnd(v, end.getMinutes())}
            />
            <span className="colon small">:</span>
            <Stepper
              value={end.getMinutes()} active={field === 'em'} big={false}
              onFocusField={() => setField('em')}
              onChange={(v) => setEnd(end.getHours(), v)}
            />
            <button
              type="button" className="x" aria-label="remove end time"
              onClick={() => {
                setEndPinned(false)
                onChange(start, null)
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          {/* Under the end's own steppers and above the duration, where the
              handoff puts it: it qualifies the time just set, and the duration
              below is what the two of them add up to. Named "ends on" rather
              than left bare — this row is a date and the one above is a clock,
              and at 4am that is worth saying (D-044, D-046). */}
          <div className="daterow end">
            <Icon name="event" size={17} />
            <span className="endson">ends on</span>
            <DayStep
              label="earlier end day" icon="chevron_left"
              disabled={endOffset <= 0}
              onStep={(n) => stepEndDay(-n)}
            />
            <span className="dateword">{dayDate(end)}</span>
            <DayStep
              label="later end day" icon="chevron_right"
              disabled={endOffset >= 1}
              onStep={(n) => stepEndDay(n)}
            />
          </div>

          <div className="shortcuts">
            <button
              type="button" className="pill" aria-label="end now"
              onClick={() => onChange(start, endNow(start))}
            >
              <Icon name="schedule" size={14} /> now
            </button>
            {END_OFFSETS.map((o) => (
              <button
                type="button" key={o} className="pill"
                onClick={() => onChange(start, minutesAfter(start, o))}
              >
                +{o < 60 ? `${o} min` : `${o / 60} h`}
              </button>
            ))}
            <span className="duration">{formatDuration(start, end)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
