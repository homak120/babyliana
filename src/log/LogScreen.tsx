import { useCallback, useEffect, useState } from 'react'
import {
  bottleDue,
  feedDuration,
  feedKind,
  formatElapsed,
  lastFeedAt,
  lastFeedMoment,
  mascotState,
  minutesSince,
  ongoingFeed,
  ongoingSleep,
  resumableSleep,
  sameDay,
  sleepClock,
  sleepDuration,
  targetText,
  targetWake,
  themeFor,
  totalsFor,
  type MascotState,
} from '../derive'
import { getDevices } from '../db'
import {
  avatarClass, describeMoment, feedCell, hhmm, milkCell, milkTotal, otherLabel, sleepCell,
  timeCell,
} from '../day/cells'
import { getDeviceId } from '../device-id'
import { gapText, isNightCycle, upcomingFeeds } from '../cycles'
import { setTimeFormat, timeFormat } from '../timeformat'
import { getMoments, reconcileCycles, removeMoment, renameThisDevice } from '../moments'
import { subscribe, sync, syncState } from '../sync'
import type { Device, Moment } from '../types'
import { AddSheet } from './AddSheet'
import { CycleSheet } from './CycleSheet'
import { PrepPill, usePrepTimer } from './PrepLine'
import { BottleIcon } from './BottleIcon'
import { EndSleepIcon } from './EndSleepIcon'
import { Icon } from './Icon'
import { Mascot } from './Mascot'
import { SwipeRow } from '../swipe/SwipeRow'
import { ConfirmDelete } from '../swipe/ConfirmDelete'

// Icon per state, exactly as the handoff pairs them.
const STATE: Record<MascotState, { word: string; icon: string }> = {
  settled: { word: 'settled', icon: 'spa' },
  awake: { word: 'awake', icon: 'visibility' },
  hungry: { word: 'hungry', icon: 'local_drink' },
  // Descriptive, like every other state: what is happening, never whether it
  // is going well.
  feeding: { word: 'feeding', icon: 'local_drink' },
  sleeping: { word: 'sleeping', icon: 'bedtime' },
  logged: { word: 'logged', icon: 'auto_awesome' },
}

/**
 * Which summary the top card leads with.
 *
 * Three layouts of the same facts, not three feature sets: the card always
 * answers "when did she last eat", and this is only which half of the answer is
 * the big number. `elapsed` is the default because it is the question the paper
 * log was being read for at 4am.
 */
type Lead = 'elapsed' | 'combined' | 'mascot'

const LEADS: { id: Lead; icon: string; label: string }[] = [
  { id: 'elapsed', icon: 'schedule', label: 'elapsed view' },
  { id: 'combined', icon: 'event_upcoming', label: 'next feeds view' },
  { id: 'mascot', icon: 'pets', label: 'mascot view' },
]

/**
 * Kept in localStorage rather than in component state alone.
 *
 * The handoff calls the choice session state, and in the prototype that is
 * enough — but this screen is remounted by `key={saved}` on every save and
 * every ended sleep, so plain state would silently snap back to `elapsed` the
 * moment you logged anything. It stays local and unsynced either way: a lead is
 * a preference of the phone in your hand, not a fact about the baby.
 */
const LEAD_KEY = 'babyliana.lead'

function storedLead(): Lead {
  const v = localStorage.getItem(LEAD_KEY)
  return v === 'combined' || v === 'mascot' ? v : 'elapsed'
}

/** The poop chip shows the colour when there is one — the prototype prints
 *  "Dark" and "olive", not "poop", because that is what was actually seen. */
function poopLabel(m: Moment) {
  const p = m.events.find((e) => e.poop)
  if (!p) return null
  return p.poop_colour && p.poop_colour !== 'other' ? p.poop_colour : 'poop'
}

/** The prototype prints the date on every separator, today included. */
function dayLabel(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function NamePrompt({
  current,
  onDone,
}: {
  current: string
  onDone: (name: string | null) => void
}) {
  const [value, setValue] = useState(current)
  return (
    <div className="sheet nameSheet">
      <header className="sheet-head">
        <h2>who is logging?</h2>
        <button type="button" className="x" onClick={() => onDone(null)} aria-label="close">
          <Icon name="close" size={20} />
        </button>
      </header>
      <p className="sub">
        your name marks every entry you log, so Liana&rsquo;s other grown-ups know who did what.
      </p>
      <input
        className="nameinput"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Anya"
        autoFocus
      />
      <button type="button" className="save" onClick={() => onDone(value)}>
        <Icon name="check_circle" size={24} /> save
      </button>
    </div>
  )
}

export function LogScreen({ onEndOpen, onResumeSleep }: {
  /** Ends whatever is running — a feed or a sleep. One act, two pills (D-033). */
  onEndOpen: () => void
  /** Takes the end back off the sleep just closed — the row's resume icon. */
  onResumeSleep: () => void
}) {
  const [moments, setMoments] = useState<Moment[]>([])
  /**
   * Whether `moments` has been read yet, as opposed to being empty.
   *
   * The two are the same array and mean opposite things. Everything on this
   * screen was content to render the empty one for a frame — but the bottle
   * prompt's timer clears itself when the prompt is over (D-045), and "no
   * moments yet" looks exactly like "the feed has been logged". It wiped a
   * running count on every save and on every app open until this told them
   * apart.
   */
  const [loaded, setLoaded] = useState(false)
  const [lead, setLead] = useState<Lead>(storedLead)
  // Held as state as well as in localStorage for the same reason the lead is:
  // this screen is remounted on every save, and `hhmm` reads the stored value,
  // so what state buys is the re-render that repaints every clock time at once.
  const [clock, setClock] = useState(timeFormat)
  const [devices, setDevices] = useState<Device[]>([])
  const [sheet, setSheet] = useState(false)
  const [sync_, setSync] = useState(syncState())
  const [justLogged, setJustLogged] = useState(false)
  const [naming, setNaming] = useState(false)
  const [now, setNow] = useState(new Date())

  // Edit and delete from the home list too, not only the day view.
  //
  // D-025 only ever said "a row in the day view", so this list never had the
  // gesture — which is why swiping it did nothing for four rounds of fixes.
  // The home screen is where the app is actually used.
  const [editing, setEditing] = useState<Moment | null>(null)

  // Nothing is removed until the sheet is confirmed (Q-012).
  const [pendingDelete, setPendingDelete] = useState<Moment | null>(null)
  const [tuning, setTuning] = useState(false)
  // Bumped when a pull brings a cycle from the other phone. Nothing reads it —
  // it exists to re-render a card whose numbers come from a module cache.
  const [, setCycleTick] = useState(0)

  const refresh = useCallback(() => {
    getMoments().then((m) => {
      setMoments(m)
      setLoaded(true)
    })
    getDevices().then(setDevices)
    // The feeding cycle is on the row both phones share (D-052), so a pull can
    // bring one the other phone set. `cycles()` reads a synchronous cache, so
    // the repaint has to be asked for rather than observed.
    void reconcileCycles().then((changed) => {
      if (changed) setCycleTick((n) => n + 1)
    })
  }, [])

  useEffect(refresh, [refresh])

  const commitDelete = useCallback(
    (id: string) => {
      setPendingDelete(null)
      void removeMoment(id).then(() => { refresh(); void sync() })
    },
    [refresh],
  )
  useEffect(() => subscribe(() => { setSync(syncState()); refresh() }), [refresh])

  // The hero is an elapsed time, so it has to move on its own — otherwise a
  // screen left open quietly shows a number that was right when it loaded.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const theme = themeFor(now)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const shown = moments
  // When the last feed *began* (D-040) — the hero, the mascot and the target
  // all count from that one instant, and feeding is counted start to start.
  const lastFeedStart = lastFeedAt(moments)
  const since = minutesSince(lastFeedStart, now)
  const totals = totalsFor(moments, now)
  // A logged, still-open sleep beats the night-plus-long-gap guess. Not passed
  // the ticking `now`: it moves every 30s, and a sleep logged just now would
  // fail its own "started at or before now" test until the next tick.
  const asleep = ongoingSleep(moments)
  const feeding = ongoingFeed(moments)
  // The sleep that was just closed, and so the one the row may offer to resume.
  // Never both this and `asleep` — they are complements on the same moment.
  const resumable = resumableSleep(moments)

  // The running sleep's chip counts in seconds, so it needs its own tick rather
  // than the 30s one the hero runs on. Keyed on the sleep's id and torn down the
  // moment there is no open sleep, so the app is not repainting once a second
  // for the rest of the day because something was asleep an hour ago.
  const openSleepId = asleep?.timeslot.id ?? null
  const [second, setSecond] = useState(() => new Date())
  useEffect(() => {
    if (!openSleepId) return
    setSecond(new Date())
    const t = setInterval(() => setSecond(new Date()), 1000)
    return () => clearInterval(t)
  }, [openSleepId])
  // The combined and mascot leads print the last feed itself, not just how long
  // ago it was: its volume as the paper writes it, its clock time, and who
  // logged it. An em dash where there is nothing yet, same as the elapsed lead.
  const lastFeed = lastFeedMoment(moments)
  // Breast milk holds for less time than formula, so that same feed's source
  // also sets which thresholds the state runs on.
  const state = mascotState(
    since, theme, justLogged, asleep !== null, feeding !== null, feedKind(lastFeed),
  )

  const elapsedText = formatElapsed(since)
  // What the next feed is aimed at — the ceiling, not an appointment (D-036).
  // Still hidden while one is running, but no longer because it has to be:
  // counting from the start (D-040) the target is known and settled from the
  // feed's first second. The owner kept it hidden anyway — while she is on it,
  // the running-feed line is the point and the ceiling is not yet the question.
  const target = feeding ? null : targetWake(lastFeedStart)
  // Display only. It says the bottle is worth starting; it does not know
  // whether one was, and there is nothing to dismiss — logging the feed moves
  // the target and takes the line with it.
  const prepping = bottleDue(target, now)
  // The timer is held by the screen, not by the pill: the pill is absent on the
  // next-feeds tab, and the timer still has to clear itself when a feed is
  // logged whichever tab is showing (D-050).
  const prep = usePrepTimer(prepping, loaded)
  // Counted forward from the last feed's start, never from now, so the list
  // does not creep while nobody is logging (D-040).
  const upcoming = upcomingFeeds(lastFeedStart, now)
  // The total, not the breakdown. With the unit and the source word on every
  // part (§12), "25 mL breast + 45 mL formula" is far past what a one-line
  // figure slot holds — so these two leads print one number.
  const lastVol = (lastFeed && milkTotal(lastFeed.events)) || '—'
  const lastBy = lastFeed
    ? devices.find((d) => d.id === lastFeed.timeslot.logged_by)?.name ?? null
    : null

  return (
    <main className="log">
      <div className="statusrow">
        <span>
          <Icon name={theme === 'night' ? 'bedtime' : 'wb_sunny'} size={15} />
          {hhmm(now.toISOString(), clock)}
          {/* Beside the clock it changes, so what it does needs no label. It
              reaches every time in the app, not just this one — `hhmm` is the
              only formatter (D-041) — and the label names the format being
              switched *to*, which is what a screen reader should announce. */}
          <button
            type="button"
            className="fmtbtn"
            aria-label={clock === '24h' ? 'show 12-hour times' : 'show 24-hour times'}
            onClick={() => {
              const next = clock === '24h' ? '12h' : '24h'
              setTimeFormat(next)
              setClock(next)
            }}
          >
            <Icon name="history_toggle_off" size={15} />
          </button>
        </span>
        <span className="whos">
          {devices.filter((d) => d.name).map((d) => (
            <i key={d.id} className={avatarClass(d.id, devices.map((x) => x.id))}>
              {d.name!.charAt(0).toUpperCase()}
            </i>
          ))}
          {/* Without this the name set on first run could never be changed —
              the design's settings screen is deferred, and this is the one
              thing in it that is not optional. */}
          <button type="button" className="namebtn" onClick={() => setNaming(true)}>
            {devices.find((d) => d.id === getDeviceId())?.name ? 'edit' : 'name this phone'}
          </button>
          <span className={`sync ${sync_.state}`}>
            <Icon name="cloud_done" size={15} />
          </span>
        </span>
      </div>

      <div className="herorow">
        {/* Outside the card, not on it: the card is the summary and the rail is
            what chooses which summary, so they are siblings. */}
        <div className="leadrail">
          {LEADS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`leadbtn ${lead === l.id ? 'on' : ''}`}
              aria-label={l.label}
              aria-pressed={lead === l.id}
              onClick={() => {
                setLead(l.id)
                localStorage.setItem(LEAD_KEY, l.id)
              }}
            >
              <Icon name={l.icon} size={18} />
            </button>
          ))}
        </div>

        <section className="herocard">
          {/* Top-right of the card, where the handoff puts it. Quiet: the two
              windows are right for almost everyone almost always, and this is
              the only control on a card that is otherwise all read-back. */}
          <button
            type="button"
            className="tunebtn"
            aria-label="feeding cycle settings"
            onClick={() => setTuning(true)}
          >
            <Icon name="tune" size={17} />
          </button>
          <Mascot state={state} theme={theme} />
          {/* min-width:0 so the figure can shrink rather than force the card wide. */}
          <div style={{ minWidth: 0 }}>
            <p className="kicker">
              <Icon
                name={lead === 'mascot' ? 'pets' : lead === 'combined' ? 'event_upcoming' : 'schedule'}
                size={13}
              />{' '}
              {lead === 'mascot' ? 'Liana is' : lead === 'combined' ? 'next feeds' : 'since last feed'}
            </p>

            {lead === 'elapsed' && (
              <>
                {/* The rail costs the card 40px, which leaves this column
                    about six characters at 44px. "14h 21m" is seven and an
                    overnight gap is not an edge case, so anything longer steps
                    down a size rather than wrapping — the one thing this figure
                    must never do. */}
                <p className={elapsedText.length > 6 ? 'elapsed long' : 'elapsed'}>{elapsedText}</p>
                <span className={`statetag ${state}`}>
                  <Icon name={STATE[state].icon} size={16} />
                  {STATE[state].word}
                </span>
                {/* Only inside fifteen minutes of the ceiling, or while it is
                    already running — the handoff's own rule, and the one
                    `bottleDue` has always used (D-036). */}
                {(prepping || prep.startedAt !== null) && (
                  <PrepPill startedAt={prep.startedAt} onToggle={prep.toggle} />
                )}
                {/* How long she has been down, and the way out of it, without
                    going near the bar. Descriptive: how long, not whether it is
                    long enough. */}
                {feeding && (
                  <div className="feedline">
                    <span>{feedDuration(feeding.timeslot.occurred_at, now)} feeding</span>
                    <button
                      type="button"
                      className="endfeedmini"
                      aria-label="end feed"
                      onClick={onEndOpen}
                    >
                      <BottleIcon size={18} />
                    </button>
                  </div>
                )}
                {/* Only one of the two, and the feed wins — the same priority
                    the mascot state uses. A moment can carry both. */}
                {asleep && !feeding && (
                  <div className="sleepline">
                    <span>{sleepDuration(asleep.timeslot.occurred_at, now)} asleep</span>
                    <button
                      type="button"
                      className="endsleepmini"
                      aria-label="end sleep"
                      onClick={onEndOpen}
                    >
                      <EndSleepIcon size={18} />
                    </button>
                  </div>
                )}
              </>
            )}

            {lead === 'combined' && (
              <>
                {upcoming.length > 0 ? (
                  <>
                    {/* The nearest one, large. Or the one just passed, which is
                        the row a tired person is actually looking for. */}
                    <p className="nextfeed">
                      <b>{hhmm(upcoming[0].at.toISOString(), clock)}</b>
                      <em>{targetText(upcoming[0].at, now)}</em>
                    </p>
                    {upcoming.slice(1).map(({ at, cycle: c }) => {
                      return (
                        <p className="laterfeed" key={at.toISOString()}>
                          <b>{hhmm(at.toISOString(), clock)}</b>
                          <em>{targetText(at, now)}</em>
                          {/* Which window produced this one, so a sequence that
                              changes interval halfway explains itself. */}
                          <span className={isNightCycle(c) ? 'gapchip gapnight' : 'gapchip gapday'}>
                            <Icon name={isNightCycle(c) ? 'bedtime' : 'wb_sunny'} size={12} />
                            {gapText(c.gap)}
                          </span>
                        </p>
                      )
                    })}
                  </>
                ) : (
                  <p className="leadsub">nothing logged yet</p>
                )}
              </>
            )}

            {lead === 'mascot' && (
              <>
                <p className={`mascotword ${state}`}>{STATE[state].word}</p>
                <p className="leadelapsed">{elapsedText}</p>
                <p className="leadsub">
                  {lastFeed
                    ? `${lastVol.replace(' mL', '\u00a0mL')}${lastBy ? ` · ${lastBy}` : ''}`
                    : 'nothing logged yet'}
                </p>
                {/* Always here, whatever the clock says — this tab is the one
                    you open to ask about the bottle (D-050). */}
                <PrepPill startedAt={prep.startedAt} onToggle={prep.toggle} />
              </>
            )}

            {/* Under the elapsed and mascot leads, not under the next-feed one
                (D-050): tab 2's big number is the same instant this line names,
                and saying it twice on one card — once as a ceiling, once as an
                appointment — reads as two different claims. */}
            {target && lead !== 'combined' && (
              <div className="wakeline">
                <Icon name="alarm" size={14} />
                <span>by {hhmm(target.toISOString(), clock)}</span>
                <em>{targetText(target, now)}</em>
              </div>
            )}


          </div>
        </section>
      </div>

      <div className="statcards">
        <div className="stat rose">
          <p><Icon name="local_drink" size={14} /> feeds</p>
          <b>{totals.feeds}</b>
        </div>
        <div className="stat lav">
          <p><Icon name="water_full" size={14} /> mL</p>
          <b>{totals.ml}</b>
        </div>
        <div className="stat mint">
          <p><Icon name="water_drop" size={14} /> pee / poop</p>
          <b>{totals.pee} / {totals.poop}</b>
        </div>
      </div>

      <div className="totals">
        {/* Words, not codes — the same move `milkCell` makes (§12). "B 240"
            needed the legend; "breast 240 mL" does not. */}
        <span className="tag lilac">
          <Icon name="favorite" size={13} /> breast {totals.breastMl} mL
        </span>
        <span className="tag amber">
          <Icon name="local_drink" size={13} /> formula {totals.formulaMl} mL
        </span>
        {totals.unmarkedMl > 0 && (
          <span className="tag chip">unmarked {totals.unmarkedMl} mL</span>
        )}
        {totals.unknownVolumes > 0 && (
          <span className="tag chip">? &times; {totals.unknownVolumes}</span>
        )}
      </div>

      <p className="kicker recent-head">most recent first</p>

      {shown.length === 0 && <p className="empty">nothing logged in this period.</p>}

      <ul className="moments">
        {shown.map((m, i) => {
          const prev = shown[i - 1]
          const newDay = !prev || !sameDay(prev.timeslot.occurred_at, new Date(m.timeslot.occurred_at))
          const feeds = milkCell(m.events)
          const fed = feedCell(m)
          return (
            <li key={m.timeslot.id}>
              {newDay && <p className="day-sep">{dayLabel(m.timeslot.occurred_at)}</p>}
              <SwipeRow
                className="row"
                onEdit={() => setEditing(m)}
                onDelete={() => setPendingDelete(m)}
              >
                {/* timeCell, not a local formatter: it prints the period as
                    21:37–23:37 where there is one. The home list had its own
                    formatter that only ever read occurred_at, so an end time
                    logged here was invisible until you opened the day view. */}
                <time>{timeCell(m, clock)}</time>
                <span className="chips">
                  {feeds && (
                    <span className="chip-rose">
                      <Icon name="local_drink" size={14} /> {feeds.parts.join(' + ')}
                    </span>
                  )}
                  {/* "fed 25 min", the mirror of "slept 1h 20m" — the one thing
                      a finished feed says that an instant one does not. */}
                  {fed && (
                    <span className="chip-timer">
                      <Icon name="timer" size={14} /> {fed}
                    </span>
                  )}
                  {m.events.some((e) => e.pee) && (
                    <span className="chip-yellow">
                      <Icon name="water_drop" size={14} /> pee
                    </span>
                  )}
                  {m.events.some((e) => e.poop) && (
                    <span className="chip-mint">
                      <Icon name="cookie" size={14} /> {poopLabel(m)}
                    </span>
                  )}
                  {(() => {
                    const s = sleepCell(m)
                    if (!s) return null
                    // Only ever the latest moment carries a control, because
                    // only the latest one can be ended or reopened — see
                    // `resumableSleep`. Every other sleep row is a read-back.
                    const running = asleep?.timeslot.id === m.timeslot.id
                    const canResume = resumable?.timeslot.id === m.timeslot.id
                    return (
                      <span className={s.open ? 'chip-peri open' : 'chip-peri'}>
                        <Icon name={s.icon} size={14} />{' '}
                        {/* Live to the second while it runs, so the row reads as
                            something happening rather than a figure that stopped
                            being watched. Finished, it is minutes again. */}
                        {running ? `sleeping ${sleepClock(m.timeslot.occurred_at, second)}` : s.text}
                        {running && (
                          <button
                            type="button"
                            className="chipbtn"
                            aria-label="end sleep"
                            onClick={onEndOpen}
                          >
                            <EndSleepIcon size={14} />
                          </button>
                        )}
                        {/* Resume, not "sleep again": it clears the end time on
                            this same sleep, which is the undo for a stir that
                            was not a waking. A new sleep is the bar's button. */}
                        {canResume && (
                          <button
                            type="button"
                            className="chipbtn"
                            aria-label="resume sleep"
                            onClick={onResumeSleep}
                          >
                            <Icon name="bedtime" size={14} />
                          </button>
                        )}
                      </span>
                    )
                  })()}
                  {/* `otherLabel`, not the bare type name: a weight logged
                      here read as "weight" while the day table read
                      "weight 7 lb 4 oz", which is the same split that hid an
                      end time from this list until timeCell replaced its local
                      formatter. */}
                  {m.events
                    .filter((e) => e.type !== 'feed' && e.type !== 'diaper' && e.type !== 'sleep')
                    .map((e) => (
                      <span className="chip-lav" key={e.id}>
                        {otherLabel(e)}
                      </span>
                    ))}
                </span>
                {(() => {
                  const who = devices.find((d) => d.id === m.timeslot.logged_by)?.name
                  return who ? (
                    <i className={avatarClass(m.timeslot.logged_by, devices.map((d) => d.id))}>
                      {who.charAt(0).toUpperCase()}
                    </i>
                  ) : null
                })()}
              </SwipeRow>
              {m.timeslot.note && (
                <p className="rownote">
                  <Icon name="edit_note" size={14} /> {m.timeslot.note}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {naming && (
        <NamePrompt
          current={devices.find((d) => d.id === getDeviceId())?.name ?? ''}
          onDone={(name) => {
            setNaming(false)
            if (name !== null) void renameThisDevice(name).then(refresh)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDelete
          label={describeMoment(pendingDelete)}
          onKeep={() => setPendingDelete(null)}
          onDelete={() => commitDelete(pendingDelete.timeslot.id)}
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

      {tuning && <CycleSheet onClose={() => setTuning(false)} />}

      {sheet && (
        <AddSheet
          onClose={() => setSheet(false)}
          onSaved={() => {
            setSheet(false)
            refresh()
            void sync()
            setJustLogged(true)
            setTimeout(() => setJustLogged(false), 1500)
          }}
        />
      )}
    </main>
  )
}
