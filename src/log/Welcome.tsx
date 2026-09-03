import { useState } from 'react'
import { markWelcomed } from '../device-id'
import { renameThisDevice } from '../moments'
import { Icon } from './Icon'
import { Mascot } from './Mascot'

// Shown once, when this device has no name yet.
//
// It is NOT a gate. Skipping is a first-class option, because if storage is
// ever cleared this screen reappears — and a parent who opens the app to log a
// feed and gets a form instead reaches for the pen. An unnamed device logging
// events is fine; a blocked parent is not.
//
// No device id and no pairing here: D-022 has one baby, one hard-coded id and
// no join flow for MVP. `baby-and-devices.md` has the shape for when that
// changes.

export function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')

  const finish = async (withName: string) => {
    if (withName.trim()) await renameThisDevice(withName)
    markWelcomed()
    onDone()
  }

  return (
    <main className="welcome">
      <Mascot state="settled" size={76} />

      <p className="kickerup">welcome</p>
      <h1>
        what should we
        <br />
        call you?
      </h1>
      <p className="sub">
        your name marks every entry you log, so liana&rsquo;s other grown-ups know who did
        what.
      </p>

      <label htmlFor="yourname">your name</label>
      <input
        id="yourname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="mona"
        autoComplete="given-name"
      />

      <div className="spacer" />

      <button type="button" className="save" onClick={() => finish(name)}>
        <Icon name="arrow_forward" size={22} />
        start logging
      </button>
      <button type="button" className="skiplink" onClick={() => finish('')}>
        skip for now
      </button>
    </main>
  )
}
