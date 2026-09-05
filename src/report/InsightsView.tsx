import { diaperParts } from '../day/cells'
import { Icon } from '../log/Icon'
import { buildInsights, hm, type Span } from './insights'
import type { Moment } from '../types'

// The second mode of the report screen. Every figure here is derived at render
// time — see insights.ts, which holds all of the arithmetic so this file stays
// markup.

/** `9/4 14:12`, plus the poop's description when it has one worth printing. */
function lastPoopLine(m: Moment): string {
  const d = new Date(m.timeslot.occurred_at)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const qual = diaperParts(m.events).poop
  // `diaperParts` returns a bare "poop" when nothing was recorded about it,
  // which adds nothing after the word "poop" in the card's own title.
  const detail = qual && qual !== 'poop' ? ` · ${qual}` : ''
  return `last: ${d.getMonth() + 1}/${d.getDate()} ${time}${detail}`
}

const HOUR_TICKS = [0, 6, 12, 18, 23]

const LEGEND: { kind: string; label: string }[] = [
  { kind: 'feed', label: 'feed' },
  { kind: 'poop', label: 'poop' },
  { kind: 'pee', label: 'pee' },
  { kind: 'sleep', label: 'sleep' },
]

export function InsightsView({
  moments,
  span,
  onSpan,
}: {
  moments: Moment[]
  span: Span
  onSpan: (s: Span) => void
}) {
  const i = buildInsights(moments, span)

  if (i.days.length === 0) {
    return (
      <div className="insights">
        <p className="empty">nothing logged yet — the insights fill in as you go.</p>
      </div>
    )
  }

  return (
    <div className="insights">
      <div className="insHead">
        <div>
          <p className="insRange">{i.rangeLabel}</p>
          <p className="insCaption">{i.daysLogged}</p>
        </div>
        <div className="spanToggle">
          <button
            type="button"
            className={`spanPill ${span === 3 ? 'on' : ''}`}
            onClick={() => onSpan(3)}
          >
            3d
          </button>
          <button
            type="button"
            className={`spanPill ${span === 7 ? 'on' : ''}`}
            onClick={() => onSpan(7)}
          >
            7d
          </button>
        </div>
      </div>

      {/* 1. Worth a look — absent entirely when no rule fires, which is the
          normal state. See D-032 for why this card is allowed to exist. */}
      {i.flags.length > 0 && (
        <section className="card flagCard">
          <h2 className="cardTitle flagTitle">
            <Icon name="flag" size={15} /> worth a look
          </h2>
          <ul className="flagList">
            {i.flags.map((f) => (
              <li key={f.key}>
                <Icon name={f.icon} size={16} />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. Milk intake */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="local_drink" size={15} /> milk intake
        </h2>

        <p className="bigFigure">
          {i.avgMl || '—'} <small>mL/day average</small>
        </p>

        <div className="bars">
          {i.days.map((d) => (
            <div className="bar" key={d.iso}>
              <span className="barValue">{d.ml || '—'}</span>
              <div
                className={`barFill ${d.isToday ? 'today' : ''}`}
                style={{ height: `${Math.round((d.ml / i.maxMl) * 78)}px` }}
              />
              <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                {d.date.getMonth() + 1}/{d.date.getDate()}
              </span>
            </div>
          ))}
        </div>

        <div className="statRow">
          <div>
            <p className="statValue">{i.avgFeeds || '—'}</p>
            <p className="insCaption">feeds/day</p>
          </div>
          <div>
            <p className="statValue">{i.perFeedMl ? `${i.perFeedMl} mL` : '—'}</p>
            <p className="insCaption">average per feed</p>
          </div>
        </div>

        {i.today && (
          <div className="paceCard">
            <p className="insCaption">{i.todayMl} mL so far today</p>
            <p className="paceLine">
              <span className="paceValue">{i.paceMl} mL</span>
              <span className="paceTag">on pace</span>
            </p>
            {i.paceDelta !== null && (
              <p className="paceNote">
                {i.paceDelta === 0
                  ? 'in line with the average'
                  : `${Math.abs(i.paceDelta)}% ${i.paceDelta > 0 ? 'over' : 'under'} the ${i.avgMl} mL average`}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3. Daily rhythm */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="grid_view" size={15} /> daily rhythm
        </h2>

        <div className="heat">
          {i.heat.map((row) => (
            <div className="heatRow" key={row.iso}>
              <span className="heatLabel">{row.label}</span>
              <div className="heatCells">
                {row.cells.map((c) => (
                  <span key={c.hour} className={`heatCell ${c.kind ?? ''}`} />
                ))}
              </div>
            </div>
          ))}
          <div className="heatScale">
            <span className="heatLabel" />
            <div className="heatTicks">
              {HOUR_TICKS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
        </div>

        <ul className="legend">
          {LEGEND.map((l) => (
            <li key={l.kind}>
              <span className={`heatCell ${l.kind}`} />
              {l.label}
            </li>
          ))}
        </ul>

        <div className="statRow">
          <div>
            <p className="statValue">{hm(i.avgFeedGap)}</p>
            <p className="insCaption">typical gap between feeds</p>
          </div>
          <div>
            <p className="statValue">{hm(i.worstGapMins)}</p>
            <p className="insCaption">
              longest{i.worstGapDay ? ` · ${i.worstGapDay}` : ''}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Wet and poop, side by side */}
      <div className="cardPair">
        <section className="card">
          <h2 className="cardTitle">
            <Icon name="water_drop" size={15} /> wet
          </h2>
          <p className={`bigFigure ${i.avgPee >= 6 ? 'ok' : 'flagged'}`}>
            {i.avgPee || '—'} <small>/day</small>
          </p>
          <p className="insCaption">
            {i.avgPee >= 6
              ? 'at or above the 6-a-day hydration mark'
              : 'under the 6-a-day hydration mark'}
          </p>
        </section>

        <section className="card">
          <h2 className="cardTitle">
            <Icon name="cookie" size={15} /> poop
          </h2>
          <p className="bigFigure">
            {hm(i.sincePoopMins)} <small>ago</small>
          </p>
          <p className="insCaption">
            {i.lastPoop ? lastPoopLine(i.lastPoop) : 'nothing logged yet'}
          </p>
        </section>
      </div>

      {/* 5. Sleep */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="bedtime" size={15} /> sleep
        </h2>

        {i.hasSleep ? (
          <>
            <p className="bigFigure">
              {hm(i.avgSleepMins)} <small>/day average</small>
            </p>

            <div className="bars sleepBars">
              {i.days.map((d) => (
                <div className="bar" key={d.iso}>
                  <div
                    className="barFill sleep"
                    style={{ height: `${Math.round((d.sleepMins / i.maxSleepMins) * 40)}px` }}
                  />
                  <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                    {d.date.getMonth() + 1}/{d.date.getDate()}
                  </span>
                </div>
              ))}
            </div>

            <div className="statRow">
              <div>
                <p className="statValue">{i.sleepCount}</p>
                <p className="insCaption">sleeps logged</p>
              </div>
              <div>
                <p className="statValue">{hm(i.longestSleepMins)}</p>
                <p className="insCaption">longest stretch</p>
              </div>
            </div>
          </>
        ) : (
          <p className="insCaption">
            no sleep logged in this range — the bedtime button on the home screen starts one.
          </p>
        )}
      </section>

      {/* 6. Growth — omitted entirely when nothing has been weighed. */}
      {i.weights.length > 0 && (
        <section className="card">
          <h2 className="cardTitle">
            <Icon name="monitor_weight" size={15} /> growth
          </h2>
          <ul className="weightList">
            {i.weights.map((w) => (
              <li key={w.key}>
                <span className="insCaption">{w.day}</span>
                <span className="statValue">{w.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
