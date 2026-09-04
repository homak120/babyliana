import { useCallback, useEffect, useState } from 'react'
import {
  formatElapsed,
  lastFeedAt,
  mascotState,
  minutesSince,
  sameDay,
  themeFor,
  totalsFor,
  type MascotState,
} from '../derive'
import { getDevices } from '../db'
import { avatarClass } from '../day/cells'
import { getDeviceId } from '../device-id'
import { getMoments, renameThisDevice } from '../moments'
import { subscribe, sync, syncState } from '../sync'
import type { Device, Moment } from '../types'
import { AddSheet } from './AddSheet'
import { Icon } from './Icon'
import { Mascot } from './Mascot'

// Icon per state, exactly as the handoff pairs them.
const STATE: Record<MascotState, { word: string; icon: string }> = {
  settled: { word: 'settled', icon: 'spa' },
  awake: { word: 'awake', icon: 'visibility' },
  hungry: { word: 'hungry', icon: 'local_drink' },
  sleeping: { word: 'sleeping', icon: 'bedtime' },
  logged: { word: 'logged', icon: 'auto_awesome' },
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

function dayLabel(iso: string) {
  const d = new Date(iso)
  if (sameDay(iso, new Date())) return 'today'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (sameDay(iso, y)) return 'yesterday'
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

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

export function LogScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [sheet, setSheet] = useState(false)
  const [sync_, setSync] = useState(syncState())
  const [justLogged, setJustLogged] = useState(false)
  const [naming, setNaming] = useState(false)
  const [now, setNow] = useState(new Date())

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
    getDevices().then(setDevices)
  }, [])

  useEffect(refresh, [refresh])
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

  const since = minutesSince(lastFeedAt(moments), now)
  const totals = totalsFor(moments, now)
  const state = mascotState(since, theme, justLogged)

  return (
    <main className="log">
      <div className="statusrow">
        <span>
          <Icon name={theme === 'night' ? 'bedtime' : 'wb_sunny'} size={15} />
          {time(now.toISOString())}
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

      <section className="herocard">
        <Mascot state={state} />
        <div>
          <p className="kicker">
            <Icon name="schedule" size={13} /> since last feed
          </p>
          <p className="elapsed">{formatElapsed(since)}</p>
          <span className={`statetag ${state}`}>
            <Icon name={STATE[state].icon} size={16} />
            {STATE[state].word}
          </span>
        </div>
      </section>

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

      {moments.length === 0 && <p className="empty">nothing logged in this period.</p>}

      <ul className="moments">
        {moments.map((m, i) => {
          const prev = moments[i - 1]
          const newDay = !prev || !sameDay(prev.timeslot.occurred_at, new Date(m.timeslot.occurred_at))
          const feeds = feedLabel(m)
          return (
            <li key={m.timeslot.id}>
              {newDay && <p className="day-sep">{dayLabel(m.timeslot.occurred_at)}</p>}
              <div className="row">
                <time>{time(m.timeslot.occurred_at)}</time>
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
                  {m.events
                    .filter((e) => e.type !== 'feed' && e.type !== 'diaper')
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
              </div>
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
