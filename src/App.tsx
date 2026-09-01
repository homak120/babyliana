import { useCallback, useEffect, useState } from 'react'
import { supabase, isConfigured, deviceId } from './supabase'
import './App.css'

// THROWAWAY. Deleted before the Phase 6 build begins — see D-012. This exists
// to prove the pipeline carries weight, nothing more. No baby data lives here.

type Tap = {
  id: string
  device_id: string
  created_at: string
}

const me = deviceId()

export default function App() {
  const [taps, setTaps] = useState<Tap[]>([])
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return

    supabase
      .from('spike_taps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTaps(data as Tap[])
      })

    // Q-005: does a write on one device show up on the other, and how fast.
    const channel = supabase
      .channel('spike')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spike_taps' },
        (payload) => setTaps((prev) => [payload.new as Tap, ...prev].slice(0, 50)),
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const tap = useCallback(async () => {
    if (!supabase) return
    setError(null)
    const { error } = await supabase.from('spike_taps').insert({ device_id: me })
    if (error) setError(error.message)
  }, [])

  const mine = taps.filter((t) => t.device_id === me).length

  return (
    <main>
      <p className="label">Infrastructure spike</p>
      <h1>{taps.length}</h1>
      <p className="label">
        {mine} from this device · {taps.length - mine} from elsewhere
      </p>

      <button onClick={tap} disabled={!isConfigured}>
        Tap
      </button>

      <ul className="status">
        <li>
          <span className={isConfigured ? 'ok' : 'warn'} />
          {isConfigured ? 'Supabase configured' : 'No Supabase config — see .env.example'}
        </li>
        <li>
          <span className={live ? 'ok' : 'warn'} />
          {live ? 'Realtime subscribed' : 'Realtime not subscribed'}
        </li>
        <li>
          <span className={online ? 'ok' : 'warn'} />
          {online ? 'Online' : 'Offline — the page still opened'}
        </li>
        <li>
          <span className="ok" />
          {window.matchMedia('(display-mode: standalone)').matches
            ? 'Running installed'
            : 'Running in browser'}
        </li>
      </ul>

      {error && <p className="error">{error}</p>}

      <p className="device">device {me.slice(0, 8)}</p>
    </main>
  )
}
