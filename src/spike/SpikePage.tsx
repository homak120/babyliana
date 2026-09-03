import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../supabase'
import { deviceId } from '../device-id'
import { BABY_ID } from '../config'
import './spike.css'

// Smoke test on /spike — the one exception D-012 allows, already in tasks.md.
//
// The Phase 3 tap page is gone with its table. What survives is the useful half:
// a read-only page answering "is this deployment actually wired up" without
// touching real data. Nothing should import from here.

type Check = { label: string; ok: boolean | null; detail?: string }

export default function SpikePage() {
  const [baby, setBaby] = useState<{ name: string } | null>(null)
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
      .from('baby')
      .select('name')
      .eq('id', BABY_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else if (!data) setError(`no baby row for ${BABY_ID}`)
        else setBaby(data)
      })

    const channel = supabase
      .channel('smoke')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timeslot' },
        () => {},
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const checks: Check[] = [
    {
      label: isConfigured ? 'Supabase configured' : 'No Supabase config',
      ok: isConfigured,
    },
    {
      label: baby ? `Baby row found — ${baby.name}` : 'Baby row not read',
      ok: baby ? true : error ? false : null,
    },
    { label: live ? 'Realtime subscribed' : 'Realtime not subscribed', ok: live },
    { label: online ? 'Online' : 'Offline — the page still opened', ok: online },
    {
      label: window.matchMedia('(display-mode: standalone)').matches
        ? 'Running installed'
        : 'Running in browser',
      ok: true,
    },
  ]

  return (
    <main className="spikepage">
      <p className="label">Smoke test</p>
      <h1>{checks.filter((c) => c.ok).length}/{checks.length}</h1>

      <ul className="status">
        {checks.map((c) => (
          <li key={c.label}>
            <span className={c.ok === null ? 'warn' : c.ok ? 'ok' : 'err'} />
            {c.label}
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}

      <p className="device">
        built {__BUILD_TIME__}
        <br />
        device {deviceId().slice(0, 8)}
      </p>
    </main>
  )
}
