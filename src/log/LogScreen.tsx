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
import { getMoments } from '../moments'
import { subscribe, sync, syncState } from '../sync'
import type { Moment } from '../types'
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

export function LogScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [sheet, setSheet] = useState(false)
  const [sync_, setSync] = useState(syncState())
  const [justLogged, setJustLogged] = useState(false)
  const [now, setNow] = useState(new Date())

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
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
          <Icon name="schedule" size={14} /> {time(now.toISOString())}
        </span>
        <span className={`sync ${sync_.state}`}>{sync_.state}</span>
      </div>

      <section className="hero">
        <Mascot state={state} />
        <div>
          <p className="kicker">since last feed</p>
          <p className="elapsed">{formatElapsed(since)}</p>
          <span className={`statetag ${state}`}>
            <Icon name={STATE[state].icon} size={16} />
            {STATE[state].word}
          </span>
        </div>
      </section>

      <div className="totals">
        <span className="tag rose">{totals.feeds} feeds</span>
        <span className="tag lav">{totals.ml} mL</span>
        <span className="tag yellow">{totals.pee} pee</span>
        <span className="tag mint">{totals.poop} poop</span>
        {totals.unknownVolumes > 0 && (
          <span className="tag chip">unmarked {totals.unknownVolumes}</span>
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
                  {feeds && <span className="chip-rose">{feeds}</span>}
                  {m.events.some((e) => e.pee) && <span className="chip-yellow">pee</span>}
                  {m.events.some((e) => e.poop) && <span className="chip-mint">poop</span>}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <button type="button" className="fab" onClick={() => setSheet(true)} aria-label="log">
        <Icon name="add" size={30} />
      </button>

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
