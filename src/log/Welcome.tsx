import { useCallback, useEffect, useState } from 'react'
import { sendCode, verifyCode, currentUserId } from '../auth'
import { putCaregiver } from '../db'
import { adoptCaregiverId } from '../caregiver-id'
import {
  createBaby,
  fetchBabies,
  fetchCaregiversForHousehold,
  setBabyId,
} from '../household'
import { createThisCaregiver } from '../moments'
import type { Baby, Caregiver } from '../types'
import { Icon } from './Icon'
import { Mascot } from './Mascot'

// First run, in four steps: email, code, which baby, which caregiver.
//
// **The gate is gone** (D-059). `SECRET_CODE` stood in for authentication that
// did not exist, and D-030 already called it a doormat — public repo, code in
// the bundle in plain text. The household email plus an expiring OTP is the same
// idea done properly: not in the bundle, not per deployment, and it expires.
// `RECOVERY_CODE` went with it, but **the screen behind it survives** as the
// caregiver step. That list was always the useful part; the code in front of it
// was the workaround.
//
// **The photograph is gone from here too**, and that is not a styling choice.
// D-030 put a real picture of the baby on the first screen because only this
// family had the URL. With open signup (D-057) the first thing a stranger sees
// would be a photograph of someone's child. The mascot does the same job and
// belongs to nobody.
//
// **Two of the four steps skip themselves.** One baby is chosen for you; a
// household that has already signed in does not see the email step again. The
// shortest real path from a cold install is email, code, name — and from a
// reinstall it is email, code, tap yourself.

type Stage = 'email' | 'code' | 'baby' | 'caregiver'

/**
 * Every step here ends in a write, and a write can fail.
 *
 * **The button must always come back.** The first version of the last two steps
 * set `busy` and awaited without a catch, so a write that threw — or one that
 * never returned, which is what a blocked IndexedDB upgrade does — left a greyed
 * button, no message, and no way forward but closing the app. A dead control
 * that explains nothing is worse than an error, because the person cannot even
 * tell you what happened.
 */
function readable(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'that did not save — try again'
}

/** Enough of a UUID to tell two caregivers apart without printing all 36. */
const shortId = (id: string) => `${id.slice(0, 4)}…${id.slice(-3)}`

export function Welcome({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [babyName, setBabyName] = useState('')

  // `null` is "not fetched yet". An empty array is a real answer and a different
  // one — a household that has signed in and made nothing yet.
  const [babies, setBabies] = useState<Baby[] | null>(null)
  const [carers, setCarers] = useState<Caregiver[] | null>(null)

  // A session that outlived the last install skips straight past the email.
  // Runs once, reads the cached session, and touches the network only if the
  // access token needs refreshing.
  //
  // **It resumes at the baby step even when one is cached, deliberately.** Being
  // here at all means onboarding is unfinished, and a cached id is exactly the
  // thing most likely to be why: a baby can stop being reachable without anything
  // happening on this phone — membership removed, the row deleted from the other
  // parent's phone, an account deleted out from under it. Trusting the cache
  // would skip the step and open a log whose every write fails a foreign key
  // against a row this household cannot see.
  //
  // It costs nothing. `loadBabies` takes the single baby without asking, so a
  // household with one is no more asked than before — the fetch happens either
  // way, and now its answer is believed over the cache.
  useEffect(() => {
    void currentUserId().then((uid) => {
      if (uid) setStage('baby')
    })
  }, [])

  const loadBabies = useCallback(async () => {
    setBusy(true)
    setError(null)
    const rows = await fetchBabies()
    if (!rows) setError('cannot reach the server right now')
    else if (rows.length === 1) {
      // One baby is not a choice. Take it and move on — a picker with a single
      // option is a tap that asks nothing.
      setBabyId(rows[0].id)
      setStage('caregiver')
    } else setBabies(rows)
    setBusy(false)
  }, [])

  const loadCarers = useCallback(async () => {
    setBusy(true)
    setError(null)
    const rows = await fetchCaregiversForHousehold()
    if (!rows) setError('cannot reach the server right now')
    // Named first and alphabetical, so the people who matter sit above any test
    // rows behind them.
    else setCarers([...rows].sort((a, b) => (a.name ?? '~').localeCompare(b.name ?? '~')))
    setBusy(false)
  }, [])

  useEffect(() => {
    if (stage === 'baby' && babies === null && !busy && !error) void loadBabies()
    if (stage === 'caregiver' && carers === null && !busy && !error) void loadCarers()
  }, [stage, babies, carers, busy, error, loadBabies, loadCarers])

  const submitEmail = async () => {
    if (busy || !email.includes('@')) return
    setBusy(true)
    setError(null)
    const r = await sendCode(email)
    setBusy(false)
    if (r.ok) setStage('code')
    else setError(r.message)
  }

  const submitCode = async () => {
    if (busy || code.length < 6) return
    setBusy(true)
    setError(null)
    const r = await verifyCode(email, code)
    setBusy(false)
    if (r.ok) setStage('baby')
    else setError(r.message)
  }

  const chooseBaby = (id: string) => {
    setBabyId(id)
    setStage('caregiver')
  }

  const makeBaby = async () => {
    if (busy || !babyName.trim()) return
    setBusy(true)
    setError(null)
    const id = await createBaby(babyName)
    setBusy(false)
    if (id) chooseBaby(id)
    else setError('could not create that — try again')
  }

  /**
   * Take on a caregiver that already exists rather than minting a second one.
   *
   * This is `RECOVERY_CODE`'s whole purpose, now an ordinary step. A reinstalled
   * phone has empty storage, so without it the next screen would create a second
   * "Dad" and every entry after that would be attributed to a stranger with the
   * same name.
   *
   * Written locally before the app opens so the first render already knows the
   * name; the normal sync brings the rest down behind it.
   */
  const beCaregiver = async (c: Caregiver) => {
    if (busy) return
    setBusy(true)
    try {
      await putCaregiver(c)
      adoptCaregiverId(c.id)
      onDone()
    } catch (e) {
      setBusy(false)
      setError(readable(e))
    }
  }

  // Where a caregiver comes into existence — nothing before this creates one.
  // A name is required because with no caregiver there is nothing for a
  // moment's `logged_by` to reference, so there is no useful "skip" to offer.
  const makeCaregiver = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      await createThisCaregiver(name)
      onDone()
    } catch (e) {
      setBusy(false)
      setError(readable(e))
    }
  }

  const problem = error && (
    <p className="gateerr">
      <Icon name="error" size={18} /> {error}
    </p>
  )

  // ---------------------------------------------------------------- email ---
  if (stage === 'email') {
    return (
      <main className="welcome">
        <Mascot state="settled" size={88} welcome />

        <p className="kickerup">hello there</p>
        <h1>let&rsquo;s get you in</h1>
        <p className="sub">
          we&rsquo;ll email you a six-digit code. there&rsquo;s no password to remember, and
          you&rsquo;ll only do this once on this phone.
        </p>

        <label className="fieldlabel" htmlFor="email">email address</label>
        <input
          id="email"
          className="nameinput"
          type="email"
          value={email}
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="you@example.com"
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submitEmail()}
        />

        <div className="hintcard">
          <Icon name="group" size={19} />
          <div>
            <p className="hintlabel">both of you</p>
            <p className="hinttext">
              use the same address on both phones — you each pick who you are next
            </p>
          </div>
        </div>

        {problem}

        <div className="spacer" />

        <button
          type="button"
          className="save"
          disabled={busy || !email.includes('@')}
          onClick={() => void submitEmail()}
        >
          <Icon name="mail" size={24} /> {busy ? 'sending…' : 'send the code'}
        </button>
      </main>
    )
  }

  // ----------------------------------------------------------------- code ---
  if (stage === 'code') {
    return (
      <main className="welcome gate">
        <Mascot state="awake" size={88} welcome />

        <p className="kickerup">check your email</p>
        <h1>type the code</h1>
        <p className="sub">
          six digits, sent to {email}. it&rsquo;s good for fifteen minutes.
        </p>

        <label className="fieldlabel" htmlFor="code">the code</label>
        <input
          id="code"
          className={error ? 'nameinput code wrong' : 'nameinput code'}
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submitCode()}
        />

        {problem}

        <div className="spacer" />

        <button
          type="button"
          className="save"
          disabled={busy || code.length < 6}
          onClick={() => void submitCode()}
        >
          <Icon name="lock_open" size={26} /> that&rsquo;s me
        </button>

        {/* Not "resend": one tap sends again, and the same tap is also how you
            fix a typo in the address. Supabase rate-limits a resend to one a
            minute, and `readable()` in auth.ts turns that into a sentence. */}
        <button
          type="button"
          className="backlink"
          onClick={() => {
            setStage('email')
            setCode('')
            setError(null)
          }}
        >
          <Icon name="arrow_back" size={18} /> different email, or send it again
        </button>
      </main>
    )
  }

  // ----------------------------------------------------------------- baby ---
  if (stage === 'baby') {
    const none = babies !== null && babies.length === 0

    return (
      <main className="welcome">
        <Mascot state="settled" size={88} welcome />

        <p className="kickerup">{none ? 'first time' : 'whose log is this'}</p>
        <h1>{none ? 'who are we logging for?' : 'pick a little one'}</h1>
        <p className="sub">
          {none
            ? 'just a name — it goes at the top of the log and you can change it later.'
            : 'this phone will open straight into the one you choose.'}
        </p>

        {busy && babies === null && <p className="recovnote">looking&hellip;</p>}
        {problem}
        {error && (
          <button type="button" className="save" onClick={() => void loadBabies()}>
            <Icon name="refresh" size={22} /> try again
          </button>
        )}

        {babies && babies.length > 0 && (
          <ul className="devlist">
            {babies.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => chooseBaby(b.id)} disabled={busy}>
                  <b>{b.name}</b>
                  <span>{shortId(b.id)}</span>
                  <Icon name="arrow_forward" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {none && (
          <>
            <label className="fieldlabel" htmlFor="babyname">their name</label>
            <input
              id="babyname"
              className="nameinput"
              value={babyName}
              autoComplete="off"
              placeholder="Liana"
              onChange={(e) => setBabyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void makeBaby()}
            />
          </>
        )}

        <div className="spacer" />

        {none && (
          <button
            type="button"
            className="save"
            disabled={busy || !babyName.trim()}
            onClick={() => void makeBaby()}
          >
            <Icon name="arrow_forward" size={22} /> start the log
          </button>
        )}

        {babies && babies.length > 0 && (
          <button type="button" className="skiplink" onClick={() => setBabies([])}>
            someone new
          </button>
        )}
      </main>
    )
  }

  // ------------------------------------------------------------ caregiver ---
  const none = carers !== null && carers.length === 0

  return (
    <main className="welcome recover">
      <Mascot state="settled" size={88} welcome />

      <p className="kickerup">{none ? 'welcome' : 'you’re mum or dad'}</p>
      <h1>{none ? 'what should we call you?' : 'which one are you?'}</h1>
      <p className="sub">
        {none
          ? 'your name marks every entry you log, so the other grown-ups know who did what.'
          : 'tap yourself and this phone carries on as you. tap someone new if you are not on the list.'}
      </p>

      {busy && carers === null && <p className="recovnote">looking&hellip;</p>}
      {problem}
      {error && (
        <button type="button" className="save" onClick={() => void loadCarers()}>
          <Icon name="refresh" size={22} /> try again
        </button>
      )}

      {carers && carers.length > 0 && (
        <ul className="devlist">
          {carers.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => void beCaregiver(c)} disabled={busy}>
                <b>{c.name ?? 'unnamed'}</b>
                <span>{shortId(c.id)}</span>
                <Icon name="arrow_forward" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {none && (
        <>
          <label className="fieldlabel" htmlFor="yourname">your name</label>
          <input
            id="yourname"
            className="nameinput"
            value={name}
            autoComplete="given-name"
            placeholder="Anya"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void makeCaregiver()}
          />
        </>
      )}

      <div className="spacer" />

      {none && (
        <button
          type="button"
          className="save"
          disabled={busy || !name.trim()}
          onClick={() => void makeCaregiver()}
        >
          <Icon name="arrow_forward" size={22} /> start logging
        </button>
      )}

      {carers && carers.length > 0 && (
        <button type="button" className="skiplink" onClick={() => setCarers([])}>
          someone new
        </button>
      )}
    </main>
  )
}
