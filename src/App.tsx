import { useEffect, useState } from 'react'
import { DayScreen } from './day/DayScreen'
import { Icon } from './log/Icon'
import { LogScreen } from './log/LogScreen'
import { ensureThisDevice } from './moments'
import SpikePage from './spike/SpikePage'
import { startSync } from './sync'
import './tokens.css'
import './log/log.css'
import './day/day.css'

// Still no router. The design navigates with a two-tab bar rather than URLs, so
// a router would buy nothing but a dependency — /spike stays a path check
// because it is a diagnostic, not a screen anyone navigates to.

type Screen = 'log' | 'day'

export default function App() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('log')

  useEffect(() => {
    // Upsert, never a first-run check — see db.ensureDevice.
    ensureThisDevice().then(() => {
      setReady(true)
      startSync()
    })
  }, [])

  if (window.location.pathname.startsWith('/spike')) return <SpikePage />
  if (!ready) return null

  return (
    <>
      {screen === 'log' ? <LogScreen /> : <DayScreen />}

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
          className={screen === 'day' ? 'on' : ''}
          onClick={() => setScreen('day')}
          aria-label="day"
        >
          <Icon name="calendar_month" size={24} />
        </button>
      </nav>
    </>
  )
}
