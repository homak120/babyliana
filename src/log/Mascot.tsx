import type { MascotState } from '../derive'

import settledWebp from '../assets/mascot/settled.webp'
import awakeWebp from '../assets/mascot/awake.webp'
import hungryWebp from '../assets/mascot/hungry.webp'
import sleepingWebp from '../assets/mascot/sleeping.webp'
import homeWebp from '../assets/mascot/home.webp'
import settledPng from '../assets/mascot/settled.png'
import awakePng from '../assets/mascot/awake.png'
import hungryPng from '../assets/mascot/hungry.png'
import sleepingPng from '../assets/mascot/sleeping.png'
import homePng from '../assets/mascot/home.png'

// Liana, as supplied artwork. The second design delivery ships one transparent
// PNG per state, which is what made the switch from the CSS composition
// possible at all — a single flat image would have collapsed the five states
// into one expression.
//
// Her states stay derived and descriptive only. She never nags.

/** `logged` reuses the awake art, as the handoff specifies. */
const ART: Record<MascotState | 'home', { webp: string; png: string }> = {
  settled: { webp: settledWebp, png: settledPng },
  awake: { webp: awakeWebp, png: awakePng },
  hungry: { webp: hungryWebp, png: hungryPng },
  sleeping: { webp: sleepingWebp, png: sleepingPng },
  logged: { webp: awakeWebp, png: awakePng },
  home: { webp: homeWebp, png: homePng },
}

export function Mascot({
  state, size = 100, welcome = false,
}: {
  state: MascotState
  /** The width of the *slot*. The art is drawn larger and overflows it. */
  size?: number
  /** The welcome screen uses its own art rather than a state. */
  welcome?: boolean
}) {
  const art = ART[welcome ? 'home' : state]
  const asleep = state === 'sleeping'

  // The z marks are painted into the sleeping artwork, so there is no CSS
  // overlay any more — two sets would read as a mistake.
  const animation =
    state === 'logged'
      ? 'lianaPop 0.6s ease-out'
      : asleep
        ? 'lianaBreathe 5s ease-in-out infinite'
        : 'lianaBreathe 7s ease-in-out infinite'

  // The prototype's hero gives Liana a 100×96 slot and draws her at 108px on
  // top of it, bleeding 4px to each side and 8px above. That is what keeps the
  // art generous without stealing width from the elapsed figure beside it —
  // sizing the slot at 108 is what pushed "14h 21m" onto two lines.
  const k = size / 100
  const slotH = welcome ? size : Math.round(96 * k)
  const artSize = welcome ? size : Math.round(108 * k)
  const offX = welcome ? 0 : Math.round(-4 * k)
  const offY = welcome ? 0 : Math.round(-8 * k)

  return (
    <span className="mascot" style={{ width: `${size}px`, height: `${slotH}px`, animation }}>
      <picture>
        <source srcSet={art.webp} type="image/webp" />
        <img
          src={art.png}
          alt=""
          role="img"
          aria-label={welcome ? 'Liana' : `Liana is ${state}`}
          style={{ left: `${offX}px`, top: `${offY}px`, width: `${artSize}px`, height: `${artSize}px` }}
        />
      </picture>
    </span>
  )
}
