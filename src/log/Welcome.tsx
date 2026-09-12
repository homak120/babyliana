import { useCallback, useEffect, useState } from 'react'
import { putDevice } from '../db'
import { adoptDeviceId } from '../device-id'
import { createThisDevice } from '../moments'
import { fetchDevices } from '../sync'
import type { Device } from '../types'
import { Icon } from './Icon'
import { Mascot } from './Mascot'
import gateWebp from '../assets/mascot/gate.webp'
// JPEG, not PNG: it is a photograph, and the PNG fallback was 1.8MB against
// 258KB for the same picture.
import gateJpg from '../assets/mascot/gate.jpg'

// Shown once, when this device has no name yet.
//
// Shown when this device has no id yet, which is the only thing that says
// setup has happened. Submitting is what creates both the id and the row —
// opening the app must not mint an identity, or merely looking at the URL
// leaves a phantom device behind.
//
// A name is required, because with no device there is nothing for a moment's
// logged_by to reference. The cost, accepted: if storage is ever cleared this
// has to be retyped before logging.
//
// No device id and no pairing here: D-022 has one baby, one hard-coded id and
// no join flow for MVP. `baby-and-devices.md` has the shape for when that
// changes.
//
// Two pages, per the third handoff: a gate, then the name. See D-030 — the gate
// is a doormat, not a lock, and the code ships in a public bundle.

/**
 * The answer to "when did you first time to meet me".
 *
 * Deliberately the only place it appears, because it *will* need changing: this
 * repo is public and the built bundle carries it in plain text. It keeps a
 * stranger who finds the URL from typing into the real log; it stops nobody who
 * opens dev tools. D-030 says so out loud.
 */
const SECRET_CODE = '08242026'

/**
 * The second answer: the same gate, a different door (D-042).
 *
 * Typing this instead of the code above skips the name page entirely and lists
 * the devices already on the server, so a reinstalled phone can take its own
 * identity back rather than minting a second one under the same name.
 *
 * It is not more secret than `SECRET_CODE` — same bundle, same plain text, same
 * D-030 caveat. It is a different destination, not a higher privilege.
 */
const RECOVERY_CODE = '01202012'

/** Enough of a UUID to tell two devices apart without printing all 36. */
const shortId = (id: string) => `${id.slice(0, 4)}…${id.slice(-3)}`

type Stage = 'gate' | 'name' | 'devices'

export function Welcome({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>('gate')
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const [name, setName] = useState('')

  const [saving, setSaving] = useState(false)

  // The recovery list. `null` is "not fetched"; the failure is its own flag,
  // because an empty list is a real answer — a server nobody has set up yet.
  const [list, setList] = useState<Device[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    const rows = await fetchDevices()
    if (rows) {
      // Named first and alphabetical, so the two phones that matter are at the
      // top however many test rows are behind them.
      setList([...rows].sort((a, b) => (a.name ?? '~').localeCompare(b.name ?? '~')))
    } else {
      setFailed(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (stage === 'devices' && list === null && !failed && !loading) void loadDevices()
  }, [stage, list, failed, loading, loadDevices])

  const submitCode = () => {
    if (code === SECRET_CODE) {
      setStage('name')
      setWrong(false)
    } else if (code === RECOVERY_CODE) {
      setStage('devices')
      setWrong(false)
    } else {
      setWrong(true)
    }
  }

  /**
   * Straight through, deliberately — no confirm step. The owner chose that with
   * the consequence in front of him: if the other phone still holds this id,
   * both write as the same device. That is the recovery case working, not a
   * mistake, and anyone who got here typed an eight-digit code to do it.
   *
   * The row is written locally before the app opens so the first render already
   * knows the name; the normal sync brings the rest down behind it.
   */
  const adopt = async (d: Device) => {
    if (saving) return
    setSaving(true)
    await putDevice(d)
    adoptDeviceId(d.id)
    onDone()
  }

  // This is where the device comes into existence — nothing before it. Which is
  // also why a name is required: with no device there is nothing for a moment's
  // logged_by to reference, so there is no useful "skip" to offer.
  const finish = async () => {
    if (!name.trim()) return
    setSaving(true)
    await createThisDevice(name)
    onDone()
  }

  if (stage === 'gate') {
    return (
      <main className="welcome gate">
        {/* The photograph the design asks for, `assets/liana-photo.png`, which
            arrived in a later drop of the same package.

            It renders before the code is entered, so it is what anyone holding
            the URL sees. That is deliberate and the owner's call — see D-030. */}
        <div className="gatephoto">
          <picture>
            <source srcSet={gateWebp} type="image/webp" />
            <img src={gateJpg} alt="" />
          </picture>
        </div>

        <p className="kickerup">hello there</p>
        <h1>Hello! Do you know me?</h1>
        <p className="sub">only Liana&rsquo;s people get in. enter the secret code to confirm.</p>

        <label className="fieldlabel" htmlFor="code">secret code</label>
        <input
          id="code"
          className={wrong ? 'nameinput code wrong' : 'nameinput code'}
          value={code}
          inputMode="numeric"
          autoComplete="off"
          placeholder="••••••••"
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 8))
            setWrong(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submitCode()}
        />

        <div className="hintcard">
          <Icon name="lightbulb" size={19} />
          <div>
            <p className="hintlabel">hint</p>
            <p className="hinttext">when did you first time to meet me</p>
          </div>
        </div>

        {wrong && (
          <p className="gateerr">
            <Icon name="error" size={18} /> that&rsquo;s not it. try the day we met.
          </p>
        )}

        <div className="spacer" />

        <button
          type="button"
          className="save"
          disabled={code.length < 4}
          onClick={submitCode}
        >
          <Icon name="lock_open" size={26} /> that&rsquo;s me
        </button>
      </main>
    )
  }

  if (stage === 'devices') {
    return (
      <main className="welcome recover">
        <Mascot state="settled" size={88} welcome />

        <p className="kickerup">you&rsquo;re my dad or mom</p>
        <h1>so good to see you</h1>
        <p className="sub">
          pick the phone you were logging on before, and this one carries on as it.
        </p>

        {loading && <p className="recovnote">looking for your phones&hellip;</p>}

        {failed && (
          <>
            <p className="gateerr">
              <Icon name="error" size={18} /> can&rsquo;t reach the list of devices right now.
            </p>
            <button type="button" className="save" onClick={() => void loadDevices()}>
              <Icon name="refresh" size={22} /> try again
            </button>
          </>
        )}

        {list && list.length === 0 && (
          <p className="recovnote">
            no devices on the server yet — there is nothing to come back to.
          </p>
        )}

        {list && list.length > 0 && (
          <ul className="devlist">
            {list.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => void adopt(d)} disabled={saving}>
                  <b>{d.name ?? 'unnamed'}</b>
                  <span>{shortId(d.id)}</span>
                  <Icon name="arrow_forward" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="spacer" />

        {/* The way out. Without it a failed fetch is a dead end, and the only
            escape from a hidden page is closing the app. */}
        <button
          type="button"
          className="backlink"
          onClick={() => {
            setStage('gate')
            setCode('')
            setList(null)
            setFailed(false)
          }}
        >
          <Icon name="arrow_back" size={18} /> back
        </button>
      </main>
    )
  }

  return (
    <main className="welcome">
      <Mascot state="settled" size={88} welcome />

      <p className="kickerup">welcome</p>
      <h1>
        what should we
        <br />
        call you?
      </h1>
      <p className="sub">
        your name marks every entry you log, so Liana&rsquo;s other grown-ups know who did
        what.
      </p>

      <label htmlFor="yourname">your name</label>
      <input
        id="yourname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Anya"
        autoComplete="given-name"
      />

      <div className="spacer" />

      <button
        type="button"
        className="save"
        disabled={!name.trim() || saving}
        onClick={finish}
      >
        <Icon name="arrow_forward" size={22} />
        start logging
      </button>
    </main>
  )
}
