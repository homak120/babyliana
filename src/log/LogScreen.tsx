import { useCallback, useEffect, useState } from 'react'
import { getMoments } from '../moments'
import type { Moment } from '../types'
import { AddSheet } from './AddSheet'

// Deliberately plain. S3 builds the real home screen — elapsed hero, totals,
// mascot — against the design's tokens. This is just enough to see that what
// went in came back out.

function describe(m: Moment) {
  return m.events
    .map((e) => {
      const vol = e.volume_ml === null ? '?' : `${e.volume_ml}`
      const src = e.source === 'breast_milk' ? '(B)' : e.source === 'formula' ? '(F)' : ''
      return `${vol}${src}`
    })
    .join(' + ')
}

export function LogScreen() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [sheet, setSheet] = useState(false)

  const refresh = useCallback(() => {
    getMoments().then(setMoments)
  }, [])

  useEffect(refresh, [refresh])

  return (
    <main className="log">
      <p className="label">logged, newest first</p>

      {moments.length === 0 && <p className="empty">nothing logged yet.</p>}

      <ul className="moments">
        {moments.map((m) => (
          <li key={m.timeslot.id}>
            <time>{new Date(m.timeslot.occurred_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}</time>
            <span className="what">{describe(m)}</span>
            <span className="count">{m.events.length} entr{m.events.length === 1 ? 'y' : 'ies'}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="fab" onClick={() => setSheet(true)} aria-label="log">
        +
      </button>

      {sheet && (
        <AddSheet
          onClose={() => setSheet(false)}
          onSaved={() => {
            setSheet(false)
            refresh()
          }}
        />
      )}
    </main>
  )
}
