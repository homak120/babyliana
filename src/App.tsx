import { useEffect, useState } from 'react'
import SpikePage from './spike/SpikePage'
import { LogScreen } from './log/LogScreen'
import { ensureThisDevice } from './moments'
import './log/log.css'

// No router. The design navigates with a two-tab bar rather than URLs, so a
// router may never earn its place — S3 introduces real navigation when there is
// a second screen to navigate to. Until then a path check covers /spike.

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Upsert, never a first-run check — see db.ensureDevice.
    ensureThisDevice().then(() => setReady(true))
  }, [])

  if (window.location.pathname.startsWith('/spike')) return <SpikePage />
  if (!ready) return null

  return <LogScreen />
}
