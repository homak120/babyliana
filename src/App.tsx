import { useEffect, useState } from 'react'
import { getDeviceId } from './device-id'
import { DayScreen } from './day/DayScreen'
import { Icon } from './log/Icon'
import { LogScreen } from './log/LogScreen'
import { Welcome } from './log/Welcome'
import SpikePage from './spike/SpikePage'
import { startSync } from './sync'
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
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('log')
  const [hasDevice, setHasDevice] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saved, setSaved] = useState(0)

  useEffect(() => {
    // Upsert, never a first-run check — see db.ensureDevice.
    // Nothing is created here. Opening the app must not mint an identity.
    setHasDevice(getDeviceId() !== null)
    setReady(true)
    if (getDeviceId()) {
      startSync()
      registerUpdates()
    }
  }, [])

  if (window.location.pathname.startsWith('/spike')) return <SpikePage />
  if (!ready) return null
  if (!hasDevice) {
    return (
      <Welcome
        onDone={() => {
          setHasDevice(true)
          startSync()
          registerUpdates()
        }}
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
