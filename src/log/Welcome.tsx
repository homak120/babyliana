import { useState } from 'react'
import { createThisDevice } from '../moments'
import { Icon } from './Icon'
import { Mascot } from './Mascot'

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

export function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')

  const [saving, setSaving] = useState(false)

  // This is where the device comes into existence — nothing before it. Which is
  // also why a name is required: with no device there is nothing for a moment's
  // logged_by to reference, so there is no useful "skip" to offer.
  const finish = async () => {
    if (!name.trim()) return
    setSaving(true)
    await createThisDevice(name)
    onDone()
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
