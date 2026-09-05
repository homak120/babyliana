import { useState } from 'react'
import { createThisDevice } from '../moments'
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

export function Welcome({ onDone }: { onDone: () => void }) {
  const [passed, setPassed] = useState(false)
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const [name, setName] = useState('')

  const [saving, setSaving] = useState(false)

  const submitCode = () => {
    if (code === SECRET_CODE) {
      setPassed(true)
      setWrong(false)
    } else {
      setWrong(true)
    }
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

  if (!passed) {
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
        <h1>do you know me?</h1>
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
