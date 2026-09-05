import { themeFor, type MascotState, type Theme } from '../derive'

import settledDayWebp from '../assets/mascot/settled-day.webp'
import awakeDayWebp from '../assets/mascot/awake-day.webp'
import hungryDayWebp from '../assets/mascot/hungry-day.webp'
import sleepingDayWebp from '../assets/mascot/sleeping-day.webp'
import settledDayPng from '../assets/mascot/settled-day.png'
import awakeDayPng from '../assets/mascot/awake-day.png'
import hungryDayPng from '../assets/mascot/hungry-day.png'
import sleepingDayPng from '../assets/mascot/sleeping-day.png'
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

/**
 * Two sets, one per theme. `logged` reuses the awake art, as the handoff says.
 *
 * The day set is not a recolour — it is a different character, the plush, drawn
 * landscape against a soft ground. It letterboxes inside the same 108px box on
 * `object-fit: contain`, which is what the prototype does with it too.
 */
const NIGHT: Record<MascotState | 'home', { webp: string; png: string }> = {
  settled: { webp: settledWebp, png: settledPng },
  awake: { webp: awakeWebp, png: awakePng },
  hungry: { webp: hungryWebp, png: hungryPng },
  sleeping: { webp: sleepingWebp, png: sleepingPng },
  logged: { webp: awakeWebp, png: awakePng },
  home: { webp: homeWebp, png: homePng },
}

const DAY: Record<MascotState | 'home', { webp: string; png: string }> = {
  settled: { webp: settledDayWebp, png: settledDayPng },
  awake: { webp: awakeDayWebp, png: awakeDayPng },
  hungry: { webp: hungryDayWebp, png: hungryDayPng },
  sleeping: { webp: sleepingDayWebp, png: sleepingDayPng },
  logged: { webp: awakeDayWebp, png: awakeDayPng },
  // The welcome art is the same in both themes — the handoff names one file.
  home: { webp: homeWebp, png: homePng },
}

export function Mascot({
  state, size = 88, welcome = false, theme,
}: {
  state: MascotState
  /** The width of the *slot*. The art is drawn larger and overflows it. */
  size?: number
  /** The welcome screen uses its own art rather than a state. */
  welcome?: boolean
  /**
   * Defaults to the clock, like every other theme decision (D-021). Passed
   * explicitly from the home screen so the art turns over at the boundary with
   * the rest of the palette rather than on the next unrelated re-render.
   */
  theme?: Theme
}) {
  const set = (theme ?? themeFor()) === 'night' ? NIGHT : DAY
  const art = set[welcome ? 'home' : state]
  const asleep = state === 'sleeping'

  // The z marks are painted into the sleeping artwork, so there is no CSS
  // overlay any more — two sets would read as a mistake.
  const animation =
    state === 'logged'
      ? 'lianaPop 0.6s ease-out'
      : asleep
        ? 'lianaBreathe 5s ease-in-out infinite'
        : 'lianaBreathe 7s ease-in-out infinite'

  // The prototype's card gives Liana an 88×88 slot and draws her at 100px on
  // top of it, bleeding 6px left and 8px above. That is what keeps the art
  // generous without stealing width from the figure beside it — sizing the slot
  // at the art's own size is what pushed "14h 21m" onto two lines.
  //
  // It was 100×96 with 108px art until the lead rail arrived. The rail costs
  // the card 40px of width, and this is where 12 of them came back from.
  const k = size / 88
  const slotH = size
  const artSize = welcome ? size : Math.round(100 * k)
  const offX = welcome ? 0 : Math.round(-6 * k)
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
