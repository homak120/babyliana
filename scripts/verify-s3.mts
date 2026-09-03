// S3's done-when: the elapsed figure and the totals have to be right, since
// they are what the whole screen is for. Pure functions, no browser needed.
import type { Moment } from '../src/types.ts'
import {
  formatElapsed,
  lastFeedAt,
  mascotState,
  minutesSince,
  themeFor,
  totalsFor,
} from '../src/derive.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const at = (h: number, m = 0, day = 3) => new Date(2026, 8, day, h, m).toISOString()

const moment = (
  occurred: string,
  events: Partial<Moment['events'][number]>[],
  ended: string | null = null,
): Moment => ({
  timeslot: {
    id: crypto.randomUUID(), baby_id: 'b', logged_by: 'd',
    occurred_at: occurred, ended_at: ended,
    recorded_at: occurred, updated_at: occurred, updated_by: null, note: null,
  },
  events: events.map((e) => ({
    id: crypto.randomUUID(), timeslot_id: 'x', type: 'feed', note: null,
    recorded_at: occurred, updated_at: occurred, updated_by: null,
    volume_ml: null, source: null, pee: null, poop: null,
    poop_colour: null, poop_consistency: null, grams: null, celsius: null,
    supplement_name: null, amount: null, severity: null, ...e,
  })) as Moment['events'],
})

const now = new Date(2026, 8, 3, 18, 0)

// --- elapsed ---------------------------------------------------------------
check('no feeds reads as an em dash', formatElapsed(minutesSince(lastFeedAt([]), now)) === '—')

const simple = [moment(at(15, 20), [{ type: 'feed', volume_ml: 60 }])]
check('elapsed from occurred_at',
  formatElapsed(minutesSince(lastFeedAt(simple), now)) === '2h 40m',
  formatElapsed(minutesSince(lastFeedAt(simple), now)))

// the rule that needed a decision: measure from the END of a period
const period = [moment(at(15, 0), [{ type: 'feed', volume_ml: 60 }], at(16, 30))]
check('a period measures from ended_at, not occurred_at',
  formatElapsed(minutesSince(lastFeedAt(period), now)) === '1h 30m',
  formatElapsed(minutesSince(lastFeedAt(period), now)))

check('under an hour drops the hours',
  formatElapsed(minutesSince(lastFeedAt([moment(at(17, 25), [{ type: 'feed' }])]), now)) === '35m')

// a diaper-only moment must not count as a feed
const diaperLater = [
  moment(at(15, 20), [{ type: 'feed', volume_ml: 60 }]),
  moment(at(17, 50), [{ type: 'diaper', pee: true }]),
]
check('a later diaper does not reset "since last feed"',
  formatElapsed(minutesSince(lastFeedAt(diaperLater), now)) === '2h 40m')

// --- totals ----------------------------------------------------------------
const day = [
  moment(at(8), [{ type: 'feed', volume_ml: 25, source: 'breast_milk' },
                 { type: 'feed', volume_ml: 45, source: 'formula' }]),
  moment(at(11), [{ type: 'feed', volume_ml: null }, { type: 'diaper', pee: true, poop: true }]),
  moment(at(13), [{ type: 'diaper', pee: true }]),
  moment(at(9, 0, 2), [{ type: 'feed', volume_ml: 999 }]), // yesterday
]
const t = totalsFor(day, now)
check('feeds counted per entry, not per moment', t.feeds === 3, String(t.feeds))
check('volumes summed', t.ml === 70, String(t.ml))
check('an unknown volume counts as a feed but adds no mL', t.unknownVolumes === 1 && t.ml === 70)
check('pee and poop counted separately', t.pee === 2 && t.poop === 1, `${t.pee}/${t.poop}`)
check('yesterday excluded — day boundary is midnight local', t.ml === 70)

// --- mascot ----------------------------------------------------------------
check('settled under two hours', mascotState(60, 'day') === 'settled')
check('awake at two hours', mascotState(120, 'day') === 'awake')
check('hungry at four', mascotState(240, 'day') === 'hungry')
check('sleeping at night overrides hungry', mascotState(300, 'night') === 'sleeping')
check('logged wins over everything for its moment', mascotState(300, 'day', true) === 'logged')
check('no feed yet is settled, not hungry', mascotState(null, 'day') === 'settled')

// --- theme -----------------------------------------------------------------
check('night at 22:00', themeFor(new Date(2026, 8, 3, 22)) === 'night')
check('night at 03:00', themeFor(new Date(2026, 8, 3, 3)) === 'night')
check('day at 09:00', themeFor(new Date(2026, 8, 3, 9)) === 'day')

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
