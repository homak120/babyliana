import { useEffect, useRef, useState } from 'react'
import { cycles, gapText, isNightCycle, setCycles, type Cycle } from '../cycles'
import { getDeviceId } from '../device-id'
import { renameThisDevice, saveSetting } from '../moments'
import { read, write, type SettingKey } from '../settings'
import { sync } from '../sync'
import { setTimeFormat, timeFormat, type TimeFormat } from '../timeformat'
import type { BabySettings, Device, Source } from '../types'
import { Icon } from './Icon'

/**
 * Settings, behind the card's `tune` button (D-055).
 *
 * It was the feeding cycle and nothing else (D-050), which is why the button is
 * where it is. The cycle is now one section of five.
 *
 * **Every row says whose it is.** With one shared setting, "the cycle syncs" was
 * something you simply knew. With four, changing the bottle default and having
 * someone else's phone start logging 90 mL is a surprise — and a surprise in a
 * shared log is worse than a word of chrome. `every phone` is a key on
 * `baby.settings`; `this phone` never leaves this device.
 *
 * **`every phone`, not `both phones`.** Nothing in the app caps the household
 * at two. `device` has no limit, and any phone entering with the shared baby id
 * mints its own row — so a label that counted them was describing today's
 * household rather than the rule, and would quietly start lying the first time
 * a third phone logged a feed. `every` is true at two and at ten.
 *
 * **No save button.** Every control commits as you touch it: local write, the
 * card repaints, the push follows. That is the rule the whole app runs on, and
 * D-053 removed two confirmation steps for the same reason. `✕` closes; it
 * never discards, because there is never anything pending.
 */

// The gaps are editable; the windows are not. The handoff draws the hours as
// labels and the interval as the field, and that is the smaller, closeable
// half: moving a boundary raises what a window that no longer covers the whole
// clock should do, which nobody has asked.
const MIN_GAP = 60
const MAX_GAP = 8 * 60
const GAP_STEP = 30

// A *default*, so round is right — the keypad still takes 31 or 57, which is
// the whole point of D-034. 10 rather than 0 as the floor: zero is not a feed.
const MIN_VOL = 10
const MAX_VOL = 240
const VOL_STEP = 5

// Zero is meaningful: the prompt appears exactly at the target. An hour is
// past the point where "make a bottle now" is describing the same feed.
const MIN_LEAD = 0
const MAX_LEAD = 60
const LEAD_STEP = 5

const clock12 = (mins: number) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const ap = h < 12 ? 'AM' : 'PM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
}

/**
 * A setting held locally and pushed after the taps stop.
 *
 * The local write is immediate — that is the rule, and the card behind the
 * sheet has to repaint at once whether or not there is a network. Only the
 * *push* waits: holding `+` walks the volume up in fives, and without this each
 * step would queue its own row write and its own sync.
 *
 * 600ms is long enough to cover a stepper being tapped repeatedly and short
 * enough that closing the sheet straight after a change still lands — and if it
 * does not, `reconcileSettings` pushes it on the next pull, because the local
 * value is already saved and no longer matches an empty row.
 */
const PUSH_DELAY = 600

function useShared<K extends SettingKey>(key: K) {
  const [value, setValue] = useState<NonNullable<BabySettings[K]>>(() => read(key))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const commit = (next: NonNullable<BabySettings[K]>) => {
    setValue(next)
    write(key, next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void saveSetting(key, read(key)).then(() => sync())
    }, PUSH_DELAY)
  }

  return [value, commit] as const
}

function Section({ children, title, shared }: {
  children: React.ReactNode
  title: string
  shared: boolean
}) {
  return (
    <section className="setblock">
      <header className="sethead">
        <h3>{title}</h3>
        <span className={shared ? 'scope shared' : 'scope local'}>
          <Icon name={shared ? 'group' : 'smartphone'} size={13} />
          {shared ? 'every phone' : 'this phone'}
        </span>
      </header>
      {children}
    </section>
  )
}

/**
 * `name` is the accessibility name and `label` is what the row prints. They
 * differ because a window's label is its hours — "6:00 AM – 10:00 PM" — which
 * makes a fine row heading and a useless button name.
 *
 * **`decrease` / `increase`, not `less often` / `more often`.** The cycle sheet
 * said "less often" on the button that *shortens* the gap, which is the one
 * that feeds her more often. Describing the number rather than what the number
 * means cannot be inverted, and the same two words then work for a volume and a
 * lead time, which have no "often" at all.
 */
function Stepper({ label, name, value, onStep, min, max, step, unit, icon }: {
  label: string
  name: string
  value: number
  onStep: (next: number) => void
  min: number
  max: number
  step: number
  unit: (v: number) => string
  icon?: string
}) {
  return (
    <div className="setrow">
      <span className="setlabel">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <div className="setstep">
        <button
          type="button" className="stepper" aria-label={`decrease ${name}`}
          disabled={value <= min} onClick={() => onStep(Math.max(min, value - step))}
        >
          <Icon name="remove" size={18} />
        </button>
        <b>{unit(value)}</b>
        <button
          type="button" className="stepper" aria-label={`increase ${name}`}
          disabled={value >= max} onClick={() => onStep(Math.min(max, value + step))}
        >
          <Icon name="add" size={18} />
        </button>
      </div>
    </div>
  )
}

export function SettingsSheet({ onClose, devices, onRenamed, onClockChange }: {
  onClose: () => void
  devices: Device[]
  /** The name lives on the `device` row, so the screen behind has to refetch. */
  onRenamed: () => void
  /** `hhmm` is the only formatter (D-041), so changing this restyles every time
   *  in the app — including the ones on the card behind this sheet. */
  onClockChange: (f: TimeFormat) => void
}) {
  const [bottle, setBottle] = useShared('bottle')
  const [supplement, setSupplement] = useShared('supplement')
  const [lead, setLead] = useShared('prepLeadMinutes')

  // The cycle keeps its own state rather than going through `useShared`: it is
  // a list, and the steppers edit one window of it at a time.
  const [windows, setWindows] = useState<Cycle[]>(() => cycles().map((c) => ({ ...c })))
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (cycleTimer.current) clearTimeout(cycleTimer.current) }, [])
  const commitCycles = (next: Cycle[]) => {
    setWindows(next)
    setCycles(next)
    if (cycleTimer.current) clearTimeout(cycleTimer.current)
    cycleTimer.current = setTimeout(() => {
      void saveSetting('cycles', cycles()).then(() => sync())
    }, PUSH_DELAY)
  }

  const [clock, setClock] = useState<TimeFormat>(timeFormat)

  // Local, uncommitted text. The name is written on blur rather than on every
  // keystroke: it is a row on the `device` table and a sync each, where the
  // shared settings at least collapse into one object.
  const [name, setName] = useState(
    () => devices.find((d) => d.id === getDeviceId())?.name ?? '',
  )

  const sources: { id: Source; label: string }[] = [
    { id: 'breast_milk', label: 'breast milk' },
    { id: 'formula', label: 'formula' },
  ]

  return (
    <div className="sheet setsheet" role="dialog" aria-label="settings">
      <header className="sheet-head">
        <h2>
          <Icon name="tune" size={20} /> settings
        </h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          <Icon name="close" size={20} />
        </button>
      </header>

      <Section title="quick bottle" shared>
        <p className="setnote">
          what the bottle button logs, in one tap. the keypad behind <b>+</b> still
          takes any volume.
        </p>
        <Stepper
          label="volume" name="bottle volume" value={bottle.volume} min={MIN_VOL} max={MAX_VOL} step={VOL_STEP}
          unit={(v) => `${v} mL`}
          onStep={(volume) => setBottle({ ...bottle, volume })}
        />
        <div className="setrow">
          <span className="setlabel">source</span>
          <div className="segmented">
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                className={bottle.source === s.id ? 'seg on' : 'seg'}
                aria-pressed={bottle.source === s.id}
                onClick={() => setBottle({ ...bottle, source: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="supplement preset" shared>
        <p className="setnote">
          what a new supplement block arrives filled in with. clearing a field
          leaves it blank rather than putting the old text back.
        </p>
        <div className="setrow">
          <span className="setlabel">name</span>
          <input
            className="setinput"
            aria-label="supplement name"
            value={supplement.name}
            placeholder="Vitamin D"
            onChange={(e) => setSupplement({ ...supplement, name: e.target.value })}
          />
        </div>
        <div className="setrow">
          <span className="setlabel">amount</span>
          <input
            className="setinput"
            aria-label="supplement amount"
            value={supplement.amount}
            placeholder="1 drop"
            onChange={(e) => setSupplement({ ...supplement, amount: e.target.value })}
          />
        </div>
      </Section>

      <Section title="prep prompt" shared>
        <p className="setnote">
          how far ahead the card says <b>make a bottle</b> — roughly how long
          warming one takes.
        </p>
        <Stepper
          label="lead time" name="prep lead" value={lead} min={MIN_LEAD} max={MAX_LEAD} step={LEAD_STEP}
          unit={(v) => (v === 0 ? 'at the time' : `${v} min early`)}
          onStep={setLead}
        />
      </Section>

      <Section title="feeding cycle" shared>
        <p className="setnote">
          how long a feed is expected to hold. it sets the wake time on the card
          and the times on the next-feeds view — nothing is logged from it.
        </p>
        {windows.map((c) => (
          <Stepper
            key={c.id}
            icon={isNightCycle(c) ? 'bedtime' : 'wb_sunny'}
            label={`${clock12(c.from)} – ${clock12(c.to)}`}
            name={`${c.id} gap`}
            value={c.gap} min={MIN_GAP} max={MAX_GAP} step={GAP_STEP}
            unit={gapText}
            onStep={(gap) =>
              commitCycles(windows.map((w) => (w.id === c.id ? { ...w, gap } : w)))
            }
          />
        ))}
        <p className="setnote faint">
          the hours are fixed; the interval inside them is not.
        </p>
      </Section>

      <Section title="this phone" shared={false}>
        <p className="setnote">
          these two stay here. other phones may answer them differently, and
          that is correct.
        </p>
        <div className="setrow">
          <span className="setlabel">times</span>
          <div className="segmented">
            {(['24h', '12h'] as TimeFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                className={clock === f ? 'seg on' : 'seg'}
                aria-pressed={clock === f}
                aria-label={f === '24h' ? 'show 24-hour times' : 'show 12-hour times'}
                onClick={() => { setTimeFormat(f); setClock(f); onClockChange(f) }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="setrow">
          <span className="setlabel">name</span>
          <input
            className="setinput"
            aria-label="name this phone"
            value={name}
            placeholder="Anya"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void renameThisDevice(name).then(onRenamed)}
          />
        </div>
        <p className="setnote faint">
          your name marks every entry you log, so Liana&rsquo;s other grown-ups
          know who did what.
        </p>
      </Section>

      <div className="spacer" />
    </div>
  )
}
