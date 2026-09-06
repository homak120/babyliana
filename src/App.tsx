import { useCallback, useEffect, useState } from 'react'
import { forgetDevice, getDeviceId } from './device-id'
import { DayScreen } from './day/DayScreen'
import { BottleIcon } from './log/BottleIcon'
import { EndSleepIcon } from './log/EndSleepIcon'
import { Icon } from './log/Icon'
import { LogScreen } from './log/LogScreen'
import { Welcome } from './log/Welcome'
import SpikePage from './spike/SpikePage'
import { useOverlayOpen } from './overlay'
import TouchProbe from './probe/TouchProbe'
import { getDevices } from './db'
import { startSync, subscribe, sync, syncState } from './sync'
import { registerUpdates } from './updates'
import './tokens.css'
import './log/log.css'
import './day/day.css'
import './report/insights.css'

// Still no router. The design navigates with a two-tab bar rather than URLs, so
// a router would buy nothing but a dependency — /spike stays a path check
// because it is a diagnostic, not a screen anyone navigates to.

import { AddSheet } from './log/AddSheet'
import { getMoments, endOpenPeriod } from './moments'
import { feedDuration, ongoingFeed, ongoingSleep, sleepDuration } from './derive'
import type { Moment } from './types'
import type { Block } from './log/drafts'

type Screen = 'log' | 'day'

export default function App() {
  const [screen, setScreen] = useState<Screen>('log')
  // Read at initialisation, not in an effect: nothing async happens here, and
  // opening the app must not create an identity.
  const [hasDevice, setHasDevice] = useState(() => getDeviceId() !== null)
  // What the sheet opens with, or null when it is closed. A quick icon opens the
  // same sheet with one block already added — not a screen of its own.
  const [adding, setAdding] = useState<Block['type'] | 'none' | null>(null)

  // App needs the moments only to know whether a sleep or a feed is still
  // running, which decides what the first and third quick buttons are.
  const [moments, setMoments] = useState<Moment[]>([])
  const [now, setNow] = useState(new Date())
  const overlay = useOverlayOpen()
  const [saved, setSaved] = useState(0)

  useEffect(() => {
    if (!hasDevice) return
    startSync()
    registerUpdates()
  }, [hasDevice])

  // Defaulted to the render-time clock, not the ticking `now`. That state only
  // moves every 30s, and a sleep logged *just now* would fail its own
  // "started at or before now" test until the next tick.
  const asleep = ongoingSleep(moments)
  const feeding = ongoingFeed(moments)

  // One handler for both pills: ending a feed and ending a sleep are the same
  // act on the same latest moment — stamp now as its end (D-033).
  const endOpen = useCallback(() => {
    void endOpenPeriod(new Date()).then(() => {
      void getMoments().then(setMoments)
      setSaved((n) => n + 1)
      void sync()
    })
  }, [])

  const refreshMoments = useCallback(() => { void getMoments().then(setMoments) }, [])
  useEffect(refreshMoments, [refreshMoments])
  useEffect(() => subscribe(refreshMoments), [refreshMoments])

  // The end pills show a running duration, so they have to move on their own.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // The id in localStorage and the row on the server can fall out of step — a
  // row deleted elsewhere leaves this phone holding an id that references
  // nothing, and every write then fails its foreign key silently. Checked only
  // after a *successful* sync, so being offline never wipes a good id.
  useEffect(
    () =>
      subscribe(() => {
        if (syncState().state !== 'idle') return
        const id = getDeviceId()
        if (!id) return
        void getDevices().then((all) => {
          if (all.length > 0 && !all.some((d) => d.id === id)) {
            forgetDevice()
            setHasDevice(false)
          }
        })
      }),
    [],
  )

  if (window.location.pathname.startsWith('/spike')) return <SpikePage />
  if (window.location.pathname.startsWith('/touch')) return <TouchProbe />
  if (!hasDevice) {
    return (
      <Welcome
        onDone={() => setHasDevice(true)}
      />
    )
  }

  return (
    <>
      {screen === 'log' ? (
        <LogScreen key={saved} onEndOpen={endOpen} />
      ) : (
        <DayScreen key={saved} />
      )}

      {/* Contextual, per the handoff. Home carries the quick-add row; the day
          screen is a read-back and carries no add actions at all. Hidden behind
          any sheet — see D-028. */}
      {!overlay && (
        <nav className="tabs">
          {screen === 'log' ? (
            <>
              {/* The same swap as sleep below, and for the same reason: a feed
                  with no end time is unfinished, so the useful verb is "end it"
                  rather than "log another". `timer_off` on roseFill, carrying
                  the running duration — the handoff's own pill.

                  The consequence, stated because it is not small: while a feed
                  is open the quick bottle is gone, so a second feed goes through
                  the `+` button. That is what closing the first one is for. */}
              {feeding ? (
                <button
                  type="button"
                  className="endfeed"
                  onClick={endOpen}
                  aria-label="end feed"
                >
                  <BottleIcon size={20} />
                  {feedDuration(feeding.timeslot.occurred_at, now)}
                </button>
              ) : (
                <button
                  type="button"
                  className="quick feed"
                  onClick={() => setAdding('milk')}
                  aria-label="log a feed"
                >
                  <Icon name="local_drink" size={20} />
                </button>
              )}

              <button
                type="button"
                className="quick diaper"
                onClick={() => setAdding('diaper')}
                aria-label="log a diaper"
              >
                <Icon name="water_drop" size={20} />
              </button>

              {/* While a sleep is open this becomes the way to end it, showing
                  how long it has run. Offering "log a sleep" mid-sleep would be
                  the wrong verb. */}
              {asleep ? (
                <button
                  type="button"
                  className="endsleep"
                  onClick={endOpen}
                  aria-label="end sleep"
                >
                  <EndSleepIcon size={20} />
                  {sleepDuration(asleep.timeslot.occurred_at, now)}
                </button>
              ) : (
                <button
                  type="button"
                  className="quick sleep"
                  onClick={() => setAdding('sleep')}
                  aria-label="log a sleep"
                >
                  <Icon name="bedtime" size={20} />
                </button>
              )}

              <button
                type="button"
                className="fab"
                onClick={() => setAdding('none')}
                aria-label="log a moment"
              >
                <Icon name="add" size={26} />
              </button>

              <span className="tabspacer" />

              <button
                type="button"
                onClick={() => setScreen('day')}
                aria-label="day"
              >
                <Icon name="assessment" size={24} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="backpill"
              onClick={() => setScreen('log')}
              aria-label="log"
            >
              <Icon name="arrow_back" size={20} /> back
            </button>
          )}
        </nav>
      )}

      {adding !== null && (
        <AddSheet
          opensWith={adding === 'none' ? undefined : adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null)
            // A local write does not go through `subscribe`, and the bar's
            // first and third buttons depend on what is now open.
            refreshMoments()
            setSaved((n) => n + 1)
          }}
        />
      )}
    </>
  )
}
