import { useCallback, useEffect, useState } from 'react'
import {
  formatElapsed,
  lastFeedAt,
  lastFeedMoment,
  mascotState,
  minutesSince,
  ongoingSleep,
  sameDay,
  sleepDuration,
  themeFor,
  totalsFor,
  type MascotState,
} from '../derive'
import { getDevices } from '../db'
import { avatarClass, describeMoment, hhmm, milkCell, sleepCell, timeCell } from '../day/cells'
import { getDeviceId } from '../device-id'
import { getMoments, removeMoment, renameThisDevice } from '../moments'
import { subscribe, sync, syncState } from '../sync'
import type { Device, Moment } from '../types'
import { AddSheet } from './AddSheet'
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
  { id: 'combined', icon: 'insights', label: 'combined view' },
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

function feedLabel(m: Moment) {
  const feeds = m.events.filter((e) => e.type === 'feed')
  if (feeds.length === 0) return null
  return feeds
    .map((e) => {
      const vol = e.volume_ml === null ? '?' : String(e.volume_ml)
      const src = e.source === 'breast_milk' ? '(B)' : e.source === 'formula' ? '(F)' : ''
      return vol + src
    })
    .join(' + ')
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

export function LogScreen({ onEndSleep }: { onEndSleep: () => void }) {
  const [moments, setMoments] = useState<Moment[]>([])
  const [lead, setLead] = useState<Lead>(storedLead)
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

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
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
  const since = minutesSince(lastFeedAt(moments), now)
  const totals = totalsFor(moments, now)
  // A logged, still-open sleep beats the night-plus-long-gap guess. Not passed
  // the ticking `now`: it moves every 30s, and a sleep logged just now would
  // fail its own "started at or before now" test until the next tick.
  const asleep = ongoingSleep(moments)
  const state = mascotState(since, theme, justLogged, asleep !== null)

  // The combined and mascot leads print the last feed itself, not just how long
  // ago it was: its volume as the paper writes it, its clock time, and who
  // logged it. An em dash where there is nothing yet, same as the elapsed lead.
  const elapsedText = formatElapsed(since)
  const lastFeed = lastFeedMoment(moments)
  const lastMilk = lastFeed ? milkCell(lastFeed.events) : null
  const lastVol = lastMilk ? lastMilk.parts.join(' + ') : '—'
  const lastBy = lastFeed
    ? devices.find((d) => d.id === lastFeed.timeslot.logged_by)?.name ?? null
    : null

  return (
    <main className="log">
      <div className="statusrow">
        <span>
          <Icon name={theme === 'night' ? 'bedtime' : 'wb_sunny'} size={15} />
          {hhmm(now.toISOString())}
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
          <Mascot state={state} theme={theme} />
          {/* min-width:0 so the figure can shrink rather than force the card wide. */}
          <div style={{ minWidth: 0 }}>
            <p className="kicker">
              <Icon name={lead === 'mascot' ? 'pets' : 'schedule'} size={13} />{' '}
              {lead === 'mascot' ? 'Liana is' : lead === 'combined' ? 'last feed' : 'since last feed'}
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
                {/* How long she has been down, and the way out of it, without
                    going near the bar. Descriptive: how long, not whether it is
                    long enough. */}
                {asleep && (
                  <div className="sleepline">
                    <span>{sleepDuration(asleep.timeslot.occurred_at, now)} asleep</span>
                    <button
                      type="button"
                      className="endsleepmini"
                      aria-label="end sleep"
                      onClick={onEndSleep}
                    >
                      <EndSleepIcon size={18} />
                    </button>
                  </div>
                )}
              </>
            )}

            {lead === 'combined' && (
              <>
                <p className="combined">
                  {/* A non-breaking space before the unit: the column is
                      about eight characters wide at this size, so the line
                      always wraps, and "mL" alone on the second line reads as a
                      mistake. */}
                  {lastFeed ? `${elapsedText} ago · ${lastVol}\u00a0mL` : '—'}
                </p>
                <p className="leadsub">
                  {lastFeed
                    ? `at ${hhmm(lastFeed.timeslot.occurred_at)}${lastBy ? ` · logged by ${lastBy}` : ''}`
                    : 'nothing logged yet'}
                </p>
              </>
            )}

            {lead === 'mascot' && (
              <>
                <p className={`mascotword ${state}`}>{STATE[state].word}</p>
                <p className="leadelapsed">{elapsedText}</p>
                <p className="leadsub">
                  {lastFeed ? `${lastVol}\u00a0mL${lastBy ? ` · ${lastBy}` : ''}` : 'nothing logged yet'}
                </p>
              </>
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
        <span className="tag lilac"><Icon name="favorite" size={13} /> B {totals.breastMl}</span>
        <span className="tag amber"><Icon name="local_drink" size={13} /> F {totals.formulaMl}</span>
        {totals.unmarkedMl > 0 && <span className="tag chip">unmarked {totals.unmarkedMl}</span>}
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
          const feeds = feedLabel(m)
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
                <time>{timeCell(m)}</time>
                <span className="chips">
                  {feeds && (
                    <span className="chip-rose">
                      <Icon name="local_drink" size={14} /> {feeds}
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
                    return s ? (
                      <span className={s.open ? 'chip-peri open' : 'chip-peri'}>
                        <Icon name={s.icon} size={14} /> {s.text}
                      </span>
                    ) : null
                  })()}
                  {m.events
                    .filter((e) => e.type !== 'feed' && e.type !== 'diaper' && e.type !== 'sleep')
                    .map((e) => (
                      <span className="chip-lav" key={e.id}>
                        {e.type.replace('_', ' ')}
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
