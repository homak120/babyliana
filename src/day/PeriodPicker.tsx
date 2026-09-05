import { useEffect, useState } from 'react'
import { Icon } from '../log/Icon'
import { markOverlay } from '../overlay'
import { pad2 as pad, shiftIso as shift, type Range } from './period'

// The period picker from the Phone prototype's day view. The app shipped the
// date pills but not this, so any day older than the handful of pills was
// unreachable — see D-027.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** "1 day" / "7 days" — the spec labels apply with the span, not the dates. */
function spanLabel(from: string, to: string) {
  const ms = new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()
  const days = Math.round(ms / 86_400_000) + 1
  return days === 1 ? '1 day' : `${days} days`
}

export function PeriodPicker({
  today, withData, initial, onClose, onApply,
}: {
  today: string
  /** ISO days that have at least one entry — dotted in the grid. */
  withData: Set<string>
  initial: Range | null
  onClose: () => void
  onApply: (r: Range) => void
}) {
  const [from, setFrom] = useState<string | null>(initial?.from ?? null)
  const [to, setTo] = useState<string | null>(initial?.to ?? null)
  const [ym, setYm] = useState((initial?.from ?? today).slice(0, 7))

  useEffect(() => {
    markOverlay(true)
    return () => markOverlay(false)
  }, [])

  const year = Number(ym.slice(0, 4))
  const month = Number(ym.slice(5, 7))
  const lead = new Date(year, month - 1, 1).getDay()
  const length = new Date(year, month, 0).getDate()

  const presets: [string, string, string][] = [
    ['today', today, today],
    ['last 7 days', shift(today, -6), today],
    ['last 14 days', shift(today, -13), today],
    ['this month', `${today.slice(0, 7)}-01`, today],
  ]

  const tapDay = (iso: string) => {
    // First tap starts a range, second ends it, third starts over. Tapping
    // backwards flips the ends rather than rejecting it.
    if (!from || (from && to)) { setFrom(iso); setTo(null) }
    else if (iso < from) { setTo(from); setFrom(iso) }
    else setTo(iso)
  }

  const hint = !from
    ? 'tap a day to start — tap a second day for a range'
    : !to
      ? 'tap another day to end the range, or apply for the single day'
      : 'tap any day to start over'

  const move = (by: number) => {
    const d = new Date(year, month - 1 + by, 1)
    setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }

  return (
    <div className="picker" role="dialog" aria-label="pick a period">
      <header className="picker-head">
        <h2>
          <Icon name="calendar_month" size={24} /> pick a period
        </h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          <Icon name="close" size={22} />
        </button>
      </header>

      <div className="picker-body">
        <div className="presets">
          {presets.map(([label, f, t]) => (
            <button
              type="button"
              key={label}
              className={from === f && to === t ? 'preset on' : 'preset'}
              onClick={() => { setFrom(f); setTo(t); setYm(f.slice(0, 7)) }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="calcard">
          <div className="calhead">
            <button type="button" onClick={() => move(-1)} aria-label="previous month">
              <Icon name="chevron_left" size={20} />
            </button>
            <span>{MONTHS[month - 1]} {year}</span>
            <button type="button" onClick={() => move(1)} aria-label="next month">
              <Icon name="chevron_right" size={20} />
            </button>
          </div>

          <div className="calweek">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>

          <div className="calgrid">
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length }, (_, i) => {
              const iso = `${year}-${pad(month)}-${pad(i + 1)}`
              const isFrom = iso === from
              const isTo = iso === to || (from && !to && iso === from)
              const edge = isFrom || iso === to
              const between = from && to ? iso > from && iso < to : false
              const future = iso > today
              const cls = [
                'cal',
                edge ? 'edge' : '',
                isFrom ? 'from' : '',
                isTo ? 'to' : '',
                between ? 'between' : '',
                iso === today ? 'today' : '',
              ].filter(Boolean).join(' ')
              return (
                <button
                  type="button"
                  key={iso}
                  className={cls}
                  disabled={future}
                  onClick={() => tapDay(iso)}
                >
                  <span>{i + 1}</span>
                  <i className={withData.has(iso) && !edge ? 'dot on' : 'dot'} />
                </button>
              )
            })}
          </div>

          <p className="calhint">{hint}</p>
        </div>
      </div>

      <div className="picker-foot">
        <button
          type="button"
          className="apply"
          disabled={!from}
          onClick={() => from && onApply({ from, to: to ?? from })}
        >
          <Icon name="check_circle" size={24} />
          {from ? `apply · ${spanLabel(from, to ?? from)}` : 'pick a day'}
        </button>
      </div>
    </div>
  )
}
