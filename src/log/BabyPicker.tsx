import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createBaby, fetchBabies } from '../household'
import type { Baby } from '../types'
import { Icon } from './Icon'

// Choosing a baby, or making one. Two hosts, one list (D-060).
//
// This was the `'baby'` stage inside `Welcome.tsx` and nothing else could reach
// it, which is why a household could create a second child and then never open
// its log. Lifting it out is the whole of the switch feature: the sheet behind
// the status row renders this component, and so does onboarding.
//
// **Not copied into the sheet — moved.** Two lists over the same table drift,
// which is the reason `fetchBabies` refuses to restate the RLS filter as a
// `.eq()` in the client. The same argument applies one layer up.
//
// The hosts differ in three small ways, all props: onboarding takes a lone baby
// without asking, the sheet always shows the list and marks the current row, and
// each writes its own copy. Everything else — the fetch, the failure, the retry,
// the create field — is here once.

/** Enough of a UUID to tell two babies apart without printing all 36. */
const shortId = (id: string) => `${id.slice(0, 4)}…${id.slice(-3)}`

export function BabyPicker({
  onChosen,
  copy,
  currentId = null,
  autoTakeSingle = false,
  busy: hostBusy = false,
  error: hostError = null,
}: {
  /** The picker does not know what choosing means — onboarding caches an id,
   *  the sheet runs a whole switch. It reports and the host decides. */
  onChosen: (id: string) => void
  /** The host's own voice, told whether the create field is showing. */
  copy: (creating: boolean) => ReactNode
  /** Marked in the list as the one this install is already on. */
  currentId?: string | null
  /** A household with one baby is not being asked a question, so onboarding
   *  takes it and moves on. The switch sheet always lists — you opened it to
   *  look, and the way to a second baby runs through the same screen. */
  autoTakeSingle?: boolean
  /** The host's work, while it is happening. Merged with the picker's own. */
  busy?: boolean
  error?: string | null
}) {
  // `null` is "not fetched yet". An empty array is a real answer and a different
  // one — a household that has signed in and made nothing yet.
  const [babies, setBabies] = useState<Baby[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  // **A flag, not an emptied list.** The old code reached the create field by
  // calling `setBabies([])`, which threw away the fetched rows to change what
  // rendered — so `someone new` was a one-way door and the only way back to the
  // list was to reload the app. Keeping the two facts apart costs one boolean
  // and buys the `back` link below.
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    const rows = await fetchBabies()
    if (!rows) setError('cannot reach the server right now')
    else if (rows.length === 1 && autoTakeSingle) onChosen(rows[0].id)
    else setBabies(rows)
    setBusy(false)
  }, [autoTakeSingle, onChosen])

  useEffect(() => {
    if (babies === null && !busy && !error) void load()
  }, [babies, busy, error, load])

  const make = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    const id = await createBaby(name)
    setBusy(false)
    if (id) onChosen(id)
    else setError('could not create that — try again')
  }

  const working = busy || hostBusy
  const problem = error ?? hostError
  const none = babies !== null && babies.length === 0
  const showForm = none || creating

  return (
    <>
      {copy(showForm)}

      {busy && babies === null && <p className="recovnote">looking&hellip;</p>}

      {problem && (
        <p className="gateerr">
          <Icon name="error" size={18} /> {problem}
        </p>
      )}
      {error && (
        <button type="button" className="save" onClick={() => void load()}>
          <Icon name="refresh" size={22} /> try again
        </button>
      )}

      {babies && babies.length > 0 && !creating && (
        <ul className="devlist">
          {babies.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={b.id === currentId ? 'on' : undefined}
                onClick={() => onChosen(b.id)}
                disabled={working}
              >
                <b>{b.name}</b>
                {/* The one already open says so rather than showing an arrow
                    into where you are. */}
                {b.id === currentId
                  ? <span className="here">open</span>
                  : <span>{shortId(b.id)}</span>}
                <Icon name={b.id === currentId ? 'check' : 'arrow_forward'} size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <>
          <label className="fieldlabel" htmlFor="babyname">their name</label>
          <input
            id="babyname"
            className="nameinput"
            value={name}
            autoComplete="off"
            placeholder="Liana"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void make()}
          />
        </>
      )}

      <div className="spacer" />

      {showForm && (
        <button
          type="button"
          className="save"
          disabled={working || !name.trim()}
          onClick={() => void make()}
        >
          <Icon name="arrow_forward" size={22} /> start the log
        </button>
      )}

      {babies && babies.length > 0 && (
        <button
          type="button"
          className="skiplink"
          disabled={working}
          onClick={() => {
            setCreating(!creating)
            setError(null)
          }}
        >
          {creating ? 'back to the list' : 'someone new'}
        </button>
      )}
    </>
  )
}
