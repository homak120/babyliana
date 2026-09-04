import { useEffect, useState } from 'react'
import { forgetDevice, getDeviceId } from './device-id'
import { DayScreen } from './day/DayScreen'
import { Icon } from './log/Icon'
import { LogScreen } from './log/LogScreen'
import { Welcome } from './log/Welcome'
import SpikePage from './spike/SpikePage'
import { getDevices } from './db'
import { startSync, subscribe, syncState } from './sync'
import { registerUpdates } from './updates'
import './tokens.css'
import './log/log.css'
import './day/day.css'

// Still no router. The design navigates with a two-tab bar rather than URLs, so
// a router would buy nothing but a dependency — /spike stays a path check
// because it is a diagnostic, not a screen anyone navigates to.

import { AddSheet } from './log/AddSheet'

type Screen = 'log' | 'day'

export default function App() {
  const [screen, setScreen] = useState<Screen>('log')
  // Read at initialisation, not in an effect: nothing async happens here, and
  // opening the app must not create an identity.
  const [hasDevice, setHasDevice] = useState(() => getDeviceId() !== null)
  const [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState(0)

  useEffect(() => {
    if (!hasDevice) return
    startSync()
    registerUpdates()
  }, [hasDevice])

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
  if (!hasDevice) {
    return (
      <Welcome
        onDone={() => setHasDevice(true)}
      />
    )
  }

  return (
    <>
      {screen === 'log' ? <LogScreen key={saved} /> : <DayScreen key={saved} />}

      {/* The FAB lives in the tab bar, raised and centred, so logging is
          reachable from either screen without it floating over the content. */}
      <nav className="tabs">
        <button
          type="button"
          className={screen === 'log' ? 'on' : ''}
          onClick={() => setScreen('log')}
          aria-label="log"
        >
          <Icon name="pets" size={24} />
        </button>

        <button
          type="button"
          className="fab"
          onClick={() => setAdding(true)}
          aria-label="log a moment"
        >
          <Icon name="add" size={30} />
        </button>

        <button
          type="button"
          className={screen === 'day' ? 'on' : ''}
          onClick={() => setScreen('day')}
          aria-label="day"
        >
          <Icon name="calendar_month" size={24} />
        </button>
      </nav>

      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            setSaved((n) => n + 1)
          }}
        />
      )}
    </>
  )
}
