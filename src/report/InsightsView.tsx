import { useState } from 'react'
import { diaperParts, hhmm } from '../day/cells'
import { Icon } from '../log/Icon'
import {
  ALL_TIME, buildInsights, hm, lastDays, monthOf, monthsWithData, NIGHT, sameSpan,
  shortDay, sourceSplit, type Span,
} from './insights'
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

/** The counted spans, shortest first. Months come after these, from the log. */
const DAY_SPANS = [3, 7, 15, 30]

/** How many month pills stand in the strip before `more` is asked. */
const MONTHS_SHOWN = 2

// Sleep first: it is the band the other three sit on, and it is the one the
// old chart kept hiding.
const LEGEND: { kind: string; label: string }[] = [
  { kind: 'sleep', label: 'sleep' },
  { kind: 'feed', label: 'feed' },
  { kind: 'poop', label: 'poop' },
  { kind: 'pee', label: 'pee' },
  { kind: 'night', label: 'night' },
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

  // The older months and `all` stay folded away until asked for.
  const [open, setOpen] = useState(false)
  const months = monthsWithData(moments)
  const shownMonths = open ? months : months.slice(0, MONTHS_SHOWN)

  // A month of bars is 30 columns in 358 points — six points each, which is
  // narrower than the number printed over them. Past ten days the per-bar value
  // comes off and the date labels thin out; the bars themselves stay, because
  // the shape of a month is the thing a month view is for.
  const dense = i.days.length > 10
  const step = Math.max(1, Math.ceil(i.days.length / 6))
  // Anchored to the last day rather than the first, so the most recent day is
  // always one of the labelled ones.
  const labelled = (n: number) => !dense || (i.days.length - 1 - n) % step === 0

  // Which day's milk is broken down under the source chart, by iso, or null for
  // the range summary. A span change can drop the day being read; looking it up
  // by iso rather than holding the stat means that lands on the summary instead
  // of on a day that is no longer on the chart.
  const [picked, setPicked] = useState<string | null>(null)
  const pickedDay = i.days.find((d) => d.iso === picked) ?? null
  const split = pickedDay ? sourceSplit(pickedDay) : []

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
      </div>

      {/* The range strip. Recent spans first, then the months the log actually
          has — offered rather than generated, so a pill never opens an empty
          screen. Older months and `all` sit behind `more`, because a log that
          runs for a year would otherwise put six rows of pills above the first
          chart. */}
      <div className="spanStrip">
        {DAY_SPANS.map((n) => (
          <button
            type="button"
            key={n}
            className={`spanPill ${sameSpan(span, lastDays(n)) ? 'on' : ''}`}
            onClick={() => onSpan(lastDays(n))}
          >
            {n}d
          </button>
        ))}

        {shownMonths.map((m) => (
          <button
            type="button"
            key={m.ym}
            className={`spanPill ${sameSpan(span, monthOf(m.ym)) ? 'on' : ''}`}
            onClick={() => onSpan(monthOf(m.ym))}
          >
            {m.label}
          </button>
        ))}

        {open && (
          <button
            type="button"
            className={`spanPill ${span.kind === 'all' ? 'on' : ''}`}
            onClick={() => onSpan(ALL_TIME)}
          >
            all
          </button>
        )}

        <button
          type="button"
          className="spanPill more"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'less' : 'more'}
        </button>
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

        <div className={`bars ${dense ? 'dense' : ''}`}>
          {i.days.map((d, n) => (
            <div className="bar" key={d.iso}>
              <span className="barValue">{d.ml || '—'}</span>
              <div
                className={`barFill ${d.isToday ? 'today' : ''}`}
                style={{ height: `${Math.round((d.ml / i.maxMl) * 78)}px` }}
              />
              <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                {labelled(n) ? shortDay(d.date) : ''}
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

      {/* 3. Daily rhythm (D-064). Two lanes and real times, not one cell an
          hour — see insights.ts § TrackRow for what that replaced and why. */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="grid_view" size={15} /> daily rhythm
        </h2>

        <div className={`track ${dense ? 'dense' : ''}`}>
          {i.track.map((row, n) => (
            <div className="trackRow" key={row.iso}>
              <span className="trackLabel">{labelled(n) ? row.label : ''}</span>
              <div className="lanes">
                <div className="lane sleepLane">
                  {/* The night, behind everything. Scenery to read the rows
                      against — the question asked of this chart at 4am is a
                      question about nights, and nothing on it used to say
                      which hours those were. */}
                  <i className="night" style={{ left: 0, width: `${(NIGHT.to / 24) * 100}%` }} />
                  <i
                    className="night"
                    style={{
                      left: `${(NIGHT.from / 24) * 100}%`,
                      width: `${((24 - NIGHT.from) / 24) * 100}%`,
                    }}
                  />
                  {row.sleeps.map((b, k) => (
                    <i
                      className="sleepBand"
                      key={`s${k}`}
                      style={{
                        left: `${b.from}%`,
                        width: `${Math.max(0.4, b.to - b.from)}%`,
                        // Square where it meets midnight, rounded at the free
                        // end — the data-end rule the stacked bars follow. A
                        // sleep running from 23:40 to 04:50 is one sleep, and
                        // two rounded ends at the boundary draw it as two.
                        borderTopLeftRadius: b.from === 0 ? 0 : undefined,
                        borderBottomLeftRadius: b.from === 0 ? 0 : undefined,
                        borderTopRightRadius: b.to === 100 ? 0 : undefined,
                        borderBottomRightRadius: b.to === 100 ? 0 : undefined,
                      }}
                    />
                  ))}
                  {row.marks.filter((m) => m.kind === 'feed').map((m) => (
                    <i className="mark feed" key={m.id} style={{ left: `${m.at}%` }} />
                  ))}
                </div>
                <div className="lane diaperLane">
                  {row.marks.filter((m) => m.kind !== 'feed').map((m) => (
                    <i className={`mark ${m.kind}`} key={m.id} style={{ left: `${m.at}%` }} />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* The row the per-day rows cannot be: what *usually* happens. */}
          <div className="trackRow usualRow">
            <span className="trackLabel">usual</span>
            <div className="usualCells">
              {i.usual.map((count, hour) => (
                <i
                  key={hour}
                  className="usualCell"
                  style={{ opacity: count ? 0.2 + 0.8 * (count / i.usualMax) : 0.08 }}
                />
              ))}
            </div>
          </div>

          <div className="trackScale">
            <span className="trackLabel" />
            <div className="heatTicks">
              {HOUR_TICKS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="insCaption">
          the bottom row is how often a feed falls in each hour, over {i.daysLogged}.
        </p>

        <ul className="legend">
          {LEGEND.map((l) => (
            <li key={l.kind}>
              <span className={`swatch ${l.kind}`} />
              {l.label}
            </li>
          ))}
        </ul>

        {/* A chart that illustrates a sentence gets read; one that has to be
            decoded gets admired. The stretch is the figure people came for, so
            it takes the stat slot and its caption says when it started.

            **It is deliberately not `worstGapMins`.** That one is the widest
            gap inside a calendar day, which is what D-032's watch rule counts;
            this one runs across midnight, where the long stretch anybody cares
            about actually happens. Printing both was printing the same number
            twice on every day the longest gap did not span midnight. */}
        <div className="statRow">
          <div>
            <p className="statValue">{hm(i.avgFeedGap)}</p>
            <p className="insCaption">typical gap between feeds</p>
          </div>
          <div>
            <p className="statValue">{i.longestStretch ? hm(i.longestStretch.mins) : '—'}</p>
            <p className="insCaption">
              {i.longestStretch
                ? `longest stretch · from ${hhmm(i.longestStretch.fromIso)} on ${shortDay(new Date(i.longestStretch.fromIso))}`
                : 'longest stretch'}
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

      {/* 4b. Diapers per day, stacked (D-049). The pair above says how many;
              this says what shape the days have. */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="water_drop" size={15} /> diapers a day
        </h2>

        {i.peeTotal + i.poopTotal > 0 ? (
          <>
            <div className={`bars ${dense ? 'dense' : ''}`}>
              {i.days.map((d, n) => {
                const total = d.pees + d.poops
                const h = (n: number) => Math.round((n / i.maxDiapers) * 78)
                return (
                  <div className="bar" key={d.iso}>
                    {/* The count on top, so the reader never has to judge a
                        length against the axis to know what a day held. */}
                    <span className="barValue">{total || '—'}</span>
                    <div className="stack">
                      {d.poops > 0 && (
                        <div className="seg dirty" style={{ height: `${h(d.poops)}px` }} />
                      )}
                      {d.pees > 0 && (
                        <div className="seg wet" style={{ height: `${h(d.pees)}px` }} />
                      )}
                    </div>
                    <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                      {labelled(n) ? shortDay(d.date) : ''}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Never colour alone: the two hues are close enough under
                protanopia that the words are what carry the difference. */}
            <div className="legend">
              <span><i className="key wet" /> wet {i.peeTotal}</span>
              <span><i className="key dirty" /> dirty {i.poopTotal}</span>
            </div>
          </>
        ) : (
          <p className="insCaption">no changes logged in this range.</p>
        )}
      </section>

      {/* 4c. What was in the bottle (D-049), and what a single day of it was
              made of (D-062) — the stack says the shape, the tap says the
              numbers. */}
      <section className="card">
        <h2 className="cardTitle">
          <Icon name="local_drink" size={15} /> by source
        </h2>

        {i.days.some((d) => d.ml > 0) ? (
          <>
            <div className={`bars ${dense ? 'dense' : ''}`}>
              {i.days.map((d, index) => {
                const h = (n: number) => Math.round((n / i.maxMl) * 78)
                const on = d.iso === picked
                return (
                  // The whole column is the target, value and label included:
                  // the stack alone is a few millimetres wide on a day with
                  // little in it, and this is read one-handed.
                  <button
                    type="button"
                    className={`bar pick ${on ? 'on' : ''}`}
                    key={d.iso}
                    aria-pressed={on}
                    aria-label={`${shortDay(d.date)}, ${d.ml} mL`}
                    onClick={() => setPicked(on ? null : d.iso)}
                  >
                    <span className="barValue">{d.ml || '—'}</span>
                    <span className="stack">
                      {d.mlUnmarked > 0 && (
                        <i className="seg unmarked" style={{ height: `${h(d.mlUnmarked)}px` }} />
                      )}
                      {d.mlFormula > 0 && (
                        <i className="seg formula" style={{ height: `${h(d.mlFormula)}px` }} />
                      )}
                      {d.mlBreast > 0 && (
                        <i className="seg breast" style={{ height: `${h(d.mlBreast)}px` }} />
                      )}
                    </span>
                    <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                      {labelled(index) ? shortDay(d.date) : ''}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="legend">
              <span><i className="key breast" /> breast</span>
              <span><i className="key formula" /> formula</span>
              <span><i className="key unmarked" /> not marked</span>
            </div>

            {pickedDay ? (
              <div className="split">
                <p className="splitHead">
                  <span className="splitDay">{shortDay(pickedDay.date)}</span>
                  <span className="splitTotal">{pickedDay.ml} mL</span>
                  <span className="insCaption">
                    over {pickedDay.feeds} {pickedDay.feeds === 1 ? 'feed' : 'feeds'}
                    {/* The paper log's `?`. A day of 8 feeds and 410 mL where
                        one feed had no volume is not a 410 mL day, and the
                        count is the only place that can say so. */}
                    {pickedDay.feedsNoVolume > 0
                      ? `, ${pickedDay.feedsNoVolume} without a volume`
                      : ''}
                  </span>
                </p>

                {split.length > 0 ? (
                  <div className="splitRows">
                    {split.map((r) => (
                      <div className="splitRow" key={r.key}>
                        <i className={`key ${r.key}`} />
                        <span className="splitName">{r.label}</span>
                        <span className="splitMl">{r.ml} mL</span>
                        <span className="splitPct">{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="insCaption">no milk logged on this day.</p>
                )}
              </div>
            ) : (
              /* Said outright rather than left to be inferred from a big grey
                 band: the chart is as much about how often the source goes
                 unwritten as about what was in the bottle. */
              <p className="insCaption">
                {i.mlUnmarked > 0
                  ? `${i.mlUnmarked} mL went down without a source marked.`
                  : 'every feed in this range has a source.'}{' '}
                tap a day for its breakdown.
              </p>
            )}
          </>
        ) : (
          <p className="insCaption">no milk logged in this range.</p>
        )}
      </section>

      {/* 4d. Poop colours (D-049) — a tally, and nothing said about it. */}
      {i.colours.length > 0 && (
        <section className="card">
          <h2 className="cardTitle">
            <Icon name="palette" size={15} /> poop colours
          </h2>
          <div className="tally">
            {i.colours.map((c) => (
              <div className="tallyRow" key={c.name}>
                <span className="tallyName">{c.name}</span>
                <span className="tallyBar">
                  <i style={{ width: `${Math.round((c.count / i.colours[0].count) * 100)}%` }} />
                </span>
                <span className="tallyCount">{c.count}</span>
              </div>
            ))}
          </div>
          <p className="insCaption">what was written down, counted. nothing more.</p>
        </section>
      )}

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

            <div className={`bars sleepBars ${dense ? 'dense' : ''}`}>
              {i.days.map((d, n) => (
                <div className="bar" key={d.iso}>
                  <div
                    className="barFill sleep"
                    style={{ height: `${Math.round((d.sleepMins / i.maxSleepMins) * 40)}px` }}
                  />
                  <span className={`barLabel ${d.isToday ? 'today' : ''}`}>
                    {labelled(n) ? shortDay(d.date) : ''}
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
