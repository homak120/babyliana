// S7's done-when is "hold the phone next to the photograph and compare". This
// is that comparison, done against 8/27 from the real log — the day with the
// most variety: a feed with no diaper, a diaper with no feed, poop colours, and
// a consistency.
//
// Paper, as written:
//   8/27  01:39  43
//         04:30  50
//         05:50  41   1
//         08:20  46   2 (olive)
//         11:39  40   2 (yellow)
//         14:17       1
//         14:40  50   2 (G→Y liquid)
//         17:45  60   1
//         20:24       1
//         21:01  55
import type { Moment } from '../src/types.ts'
import {
  chronological, dateCell, daysWithEntries, diaperCell, feedCell, initialOf, milkCell, milkTotal,
  hhmm, otherCell, srcWord, timeCell,
} from '../src/day/cells.ts'
import { stepDay } from '../src/day/period.ts'
import { feedDuration, mascotState, ongoingFeed, ongoingSleep, sleepDuration } from '../src/derive.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

let n = 0
const ev = (e: Partial<Moment['events'][number]>) => ({
  id: `e${n++}`, timeslot_id: 't', type: 'feed', note: null,
  recorded_at: '', updated_at: '', updated_by: null,
  volume_ml: null, source: null, pee: null, poop: null,
  poop_colour: null, poop_consistency: null, pounds: null, fahrenheit: null,
  supplement_name: null, amount: null, severity: null, ...e,
}) as Moment['events'][number]

const at = (h: number, m: number, day = 27) =>
  new Date(2026, 7, day, h, m).toISOString()

const mom = (occurred: string, events: Moment['events'], note: string | null = null): Moment => ({
  timeslot: {
    id: `t${n++}`, baby_id: 'b', logged_by: 'dev', occurred_at: occurred,
    ended_at: null, recorded_at: occurred, updated_at: occurred, updated_by: null, note,
  },
  events,
})

const feed = (v: number | null, src: string | null = null) =>
  ev({ type: 'feed', volume_ml: v, source: src as never })
const diaper = (o: Partial<Moment['events'][number]>) => ev({ type: 'diaper', ...o })

const day = chronological([
  mom(at(1, 39), [feed(43)]),
  mom(at(4, 30), [feed(50)]),
  mom(at(5, 50), [feed(41), diaper({ pee: true })]),
  mom(at(8, 20), [feed(46), diaper({ poop: true, poop_colour: 'other' })], 'olive'),
  mom(at(11, 39), [feed(40), diaper({ poop: true, poop_colour: 'yellow' })]),
  mom(at(14, 17), [diaper({ pee: true })]),
  mom(at(14, 40), [feed(50), diaper({ poop: true, poop_colour: 'green', poop_consistency: 'liquid' })], 'green→yellow'),
  mom(at(17, 45), [feed(60), diaper({ pee: true })]),
  mom(at(20, 24), [diaper({ pee: true })]),
  mom(at(21, 1), [feed(55)]),
])

// --- the date column, which is the paper's own trick ------------------------
check('the date prints on the first row of the day', dateCell(day[0], undefined) === '8/27')
check('and is inherited by every row below it',
  day.slice(1).every((m, i) => dateCell(m, day[i]) === null))

const nextDay = mom(at(0, 10, 28), [feed(60)])
check('a new day prints its date again', dateCell(nextDay, day[9]) === '8/28')

// --- the milk column --------------------------------------------------------
//
// The unit and the source word, not the paper's (B)/(F) codes — §12 of the
// third handoff, recorded as D-034. What the codes carried is all still here.
const milk = (events: Moment['events']) => milkCell(events)!.parts.join(' + ')
check('a volume carries its unit', milk(day[0].events) === '43 mL')
check('a source is spelt out', milk([feed(45, 'breast_milk')]) === '45 mL breast')
check('a split feed joins with a plus, as the paper writes it',
  milk([feed(25, 'breast_milk'), feed(45, 'formula')]) === '25 mL breast + 45 mL formula')
check('an unlabelled split too', milk([feed(30), feed(30)]) === '30 mL + 30 mL')
check('an unknown volume prints ? and is flagged for the accent colour',
  milkCell([feed(null)])!.parts[0] === '? mL' && milkCell([feed(null)])!.unknown)
check('an unmarked source adds no word', srcWord(null) === '' && srcWord('unknown') === '')

// The one-line form the top card's narrow leads take instead.
check('the total is one figure', milkTotal([feed(25, 'breast_milk'), feed(45, 'formula')]) === '70 mL')
check('an unknown part is carried, not dropped',
  milkTotal([feed(90), feed(null)]) === '90 + ? mL')
check('all unknown is just ?', milkTotal([feed(null)]) === '? mL')
check('and no feed is null, like the column', milkTotal([diaper({ pee: true })]) === null)

// the distinction the whole model turns on
check('NO feed is null, not an empty string — a blank cell and a ? differ',
  milkCell(day[5].events) === null)
check('and a ? is not null', milkCell([feed(null)]) !== null)

// --- the pee/poop column ----------------------------------------------------
check('a pee', diaperCell(day[2].events) === 'pee')
check('a poop with colour', diaperCell(day[4].events) === 'poop (yellow)')
check('a colour of "other" prints nothing — the note carries what was written',
  diaperCell(day[3].events) === 'poop', String(diaperCell(day[3].events)))
check('a poop with colour and consistency',
  diaperCell(day[6].events) === 'poop (green liquid)', String(diaperCell(day[6].events)))
check('both in one change joins with a middot',
  diaperCell([diaper({ pee: true, poop: true })]) === 'pee · poop')
check('no change is null, like the milk column',
  diaperCell(day[0].events) === null)

// --- time and periods -------------------------------------------------------
check('an instant prints HH:MM', timeCell(day[0]) === '01:39')
const period: Moment = JSON.parse(JSON.stringify(day[0]))
period.timeslot.occurred_at = at(19, 0)
period.timeslot.ended_at = at(21, 30)
check('a period prints both ends', timeCell(period) === '19:00–21:30')

// --- 12-hour times (D-041) --------------------------------------------------
// The format is passed rather than read, so these check the formatter and not
// a preference set behind the module. 24h stays the default everywhere.
check('midnight is 12 AM, not 0', hhmm(at(0, 5), '12h') === '12:05 AM')
check('noon is 12 PM, not 0', hhmm(at(12, 0), '12h') === '12:00 PM')
check('half past midnight is still AM', hhmm(at(0, 30), '12h') === '12:30 AM')
check('the last minute of the morning', hhmm(at(11, 59), '12h') === '11:59 AM')
check('the afternoon subtracts twelve', hhmm(at(13, 5), '12h') === '1:05 PM')
check('the last minute of the day', hhmm(at(23, 59), '12h') === '11:59 PM')
check('the hour is not padded at 12h', hhmm(at(9, 5), '12h') === '9:05 AM')
check('but it is at 24h', hhmm(at(9, 5), '24h') === '09:05')
check('and the minute is padded in both',
  hhmm(at(9, 5), '12h').endsWith(':05 AM')
  && hhmm(at(9, 5), '24h').endsWith(':05'))
check('a period carries the format to both ends',
  timeCell(period, '12h') === '7:00 PM–9:30 PM', timeCell(period, '12h'))
check('24h is what a period reads by default', timeCell(period) === timeCell(period, '24h'))

// --- the rest ---------------------------------------------------------------
// Sleep has its own cell now — it reads as a state, not as an event that
// happened, and takes its own icon.
check('the other cell carries the secondary types',
  otherCell([ev({ type: 'spit_up' })]) === 'spit up')
check('and leaves sleep alone', otherCell([ev({ type: 'sleep' })]) === null)

// The three that carry a value read it back on the row (D-036) — an input the
// table never showed would be write-only.
check('a weight reads back as lb and oz',
  otherCell([ev({ type: 'weight', pounds: 7.25 })]) === 'weight 7 lb 4 oz',
  String(otherCell([ev({ type: 'weight', pounds: 7.25 })])))
check('a temperature reads back with its unit',
  otherCell([ev({ type: 'temperature', fahrenheit: 98.6 })]) === 'temperature 98.6°F')
check('a supplement reads back name then amount',
  otherCell([ev({ type: 'supplement', supplement_name: 'vitamin D', amount: '1 drop' })])
    === 'supplement vitamin D 1 drop')
check('a supplement with only a name says just that',
  otherCell([ev({ type: 'supplement', supplement_name: 'vitamin D' })])
    === 'supplement vitamin D')
check('a blank value falls back to the bare name, like a ? volume',
  otherCell([ev({ type: 'weight' })]) === 'weight')
check('two secondary entries still join with a middot',
  otherCell([ev({ type: 'weight', pounds: 7.25 }), ev({ type: 'spit_up' })])
    === 'weight 7 lb 4 oz · spit up')

// --- sleep ------------------------------------------------------------------
const sleepy = (occurred: string, endedAt: string | null): Moment => {
  const m = mom(occurred, [ev({ type: 'sleep' })])
  m.timeslot.ended_at = endedAt
  return m
}
const t20 = at(20, 0), t22 = at(22, 30), t23 = at(23, 0)

check('an open sleep on the latest timeslot is running',
  ongoingSleep([sleepy(t20, null)], new Date(t23)) !== null)
check('a closed one is not', ongoingSleep([sleepy(t20, t22)], new Date(t23)) === null)

// The rule the owner stated: the *last* timeslot. Anything logged after a sleep
// means she woke, so an old open sleep must not read as still running — on the
// real log that showed a bar reporting "30h 58m".
check('a sleep with something logged after it is over',
  ongoingSleep([sleepy(t20, null), mom(t22, [feed(60)])], new Date(t23)) === null)
check('a sleep starting in the future is ignored',
  ongoingSleep([sleepy(at(23, 30), null)], new Date(t23)) === null)

check('a duration reads in hours and minutes', sleepDuration(t20, t22) === '2h 30m')
check('and drops the hours under one', sleepDuration(t20, at(20, 45)) === '45m')

// --- a feed still running (D-033) -------------------------------------------
//
// The same rule as sleep, on the same field: an open period is a timeslot with
// no ended_at. No flag on the event — the timeslot already carries the end time
// for every type (D-020), and a second field saying it again is how a duration
// ends up right in one view and wrong in another.
const eating = (occurred: string, endedAt: string | null): Moment => {
  const m = mom(occurred, [feed(60)])
  m.timeslot.ended_at = endedAt
  return m
}

check('a feed with no end time is running',
  ongoingFeed([eating(t20, null)], new Date(t23)) !== null)
check('one that has been given an end time is not',
  ongoingFeed([eating(t20, t22)], new Date(t23)) === null)
check('a feed with something logged after it is over',
  ongoingFeed([eating(t20, null), mom(t22, [diaper({ pee: true })])], new Date(t23)) === null)
check('a feed starting in the future is ignored',
  ongoingFeed([eating(at(23, 30), null)], new Date(t23)) === null)
check('and a sleep is not a feed', ongoingFeed([sleepy(t20, null)], new Date(t23)) === null)

check('a feed duration spells out the minutes', feedDuration(t20, at(20, 25)) === '25 min')
check('and reads in hours past one', feedDuration(t20, t22) === '2h 30m')
check('the row says how long an ended feed took', feedCell(eating(t20, t22)) === 'fed 2h 30m')
check('a running feed says nothing on the row — the card carries it',
  feedCell(eating(t20, null)) === null)
check('and a moment with no feed says nothing either', feedCell(sleepy(t20, t22)) === null)

// The mascot, whose priority the handoff states outright.
check('feeding outranks sleeping', mascotState(30, 'night', false, true, true) === 'feeding')
check('and the save flash outranks both', mascotState(30, 'night', true, true, true) === 'logged')
check('sleeping still wins when nothing is feeding',
  mascotState(30, 'night', false, true, false) === 'sleeping')
check('the date strip lists each day once, newest first',
  daysWithEntries([...day, nextDay]).length === 2)
check('an unnamed device shows no initial rather than a UUID', initialOf(null) === null)
check('a named one shows its first letter', initialOf('mona') === 'M')

// --- the whole day, as a page ----------------------------------------------
const rendered = day.map((m, i) => [
  dateCell(m, day[i - 1]) ?? '', timeCell(m),
  milkCell(m.events)?.parts.join(' + ') ?? '', diaperCell(m.events) ?? '',
])
console.log('\n  8/27 as the app renders it:')
for (const r of rendered) {
  console.log(`    ${r[0].padEnd(5)} ${r[1].padEnd(6)} ${r[2].padEnd(9)} ${r[3]}`)
}
check('every row on the page carries something',
  rendered.every((r) => r[2] !== '' || r[3] !== ''))

// --- stepping between days, which is what the page swipe does ---------------
// `daysWithEntries` is newest first, so +1 is older. Only days with entries are
// in it, so a step skips the gaps and never lands on an empty table.
const d = (m: number, day: number) => new Date(2026, m - 1, day)
const span = [d(9, 6), d(9, 4), d(9, 3), d(8, 30)]

check('a left swipe goes older, skipping the gap',
  +stepDay(span, d(9, 6), 1)! === +d(9, 4), String(stepDay(span, d(9, 6), 1)))
check('and again over a longer gap',
  +stepDay(span, d(9, 3), 1)! === +d(8, 30))
check('a right swipe goes newer', +stepDay(span, d(9, 3), -1)! === +d(9, 4))
check('the oldest day has nothing older', stepDay(span, d(8, 30), 1) === null)
check('the newest has nothing newer', stepDay(span, d(9, 6), -1) === null)
check('neither end wraps round to the other',
  stepDay(span, d(8, 30), 1) === null && stepDay(span, d(9, 6), -1) === null)
check('a day that is not in the list steps nowhere',
  stepDay(span, d(9, 5), 1) === null && stepDay(span, d(9, 5), -1) === null)
check('a single logged day steps nowhere either',
  stepDay([d(9, 6)], d(9, 6), 1) === null && stepDay([d(9, 6)], d(9, 6), -1) === null)
check('and an empty log has nothing to step through',
  stepDay([], d(9, 6), 1) === null)

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
