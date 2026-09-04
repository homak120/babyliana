import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import {
  COLLAPSED_OFFSETS, END_OFFSETS, HOLD_MS, MINUTE_OFFSETS,
  formatDuration, minutesAfter, minutesAgo, pad, resolveEnd,
  stepFor, withHourMinute, wrapHour, wrapMinute,
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

  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    ticks.current = 0
  }
  useEffect(() => stop, [])

  return {
    onPointerDown: () => {
      onStep(1)
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

export function TimeCard({
  start, end, onChange,
}: {
  start: Date
  end: Date | null
  onChange: (start: Date, end: Date | null) => void
}) {
  const [field, setField] = useState<Field>('h')
  const [expanded, setExpanded] = useState(false)

  const setStart = (h: number, m: number) => {
    const next = withHourMinute(h, m, new Date())
    onChange(next, end ? resolveEnd(next, end) : null)
  }
  const setEnd = (h: number, m: number) => {
    const raw = new Date(start)
    raw.setHours(wrapHour(h), wrapMinute(m), 0, 0)
    onChange(start, resolveEnd(start, raw))
  }

  const offsets = expanded ? MINUTE_OFFSETS : MINUTE_OFFSETS.slice(0, COLLAPSED_OFFSETS)

  return (
    <section className="block timecard">
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
          onClick={() => onChange(start, minutesAfter(start, 30))}
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
              onClick={() => onChange(start, null)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="shortcuts">
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
