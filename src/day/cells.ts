import { feedDuration, sameDay, sleepDuration } from '../derive'
import { timeFormat, type TimeFormat } from '../timeformat'
import { poundsToLbOz } from '../log/drafts'
import type { LogEvent, Moment } from '../types'

// How a moment renders as a paper row. Kept out of the component because the
// acceptance test is "hold the phone next to the photograph and compare", and
// that is easier to check against real entries here than by eye.

const pad = (n: number) => String(n).padStart(2, '0')
/**
 * `21:09`, or `9:09 PM` when the phone is set to 12-hour (D-041).
 *
 * The one time formatter in the app — the home list used to have its own and
 * drifted from this one — so the toggle reaches every clock time by changing
 * this alone: the status row, the target, the home list and the day table.
 *
 * The hour is padded at 24h and not at 12h, which is how each is written:
 * `09:05` against `9:05 AM`. Minutes are padded in both.
 *
 * `format` is a parameter with a default rather than a straight read, so the
 * suites can check both without touching a preference behind the module.
 */
export const hhmm = (iso: string, format: TimeFormat = timeFormat()) => {
  const d = new Date(iso)
  const m = pad(d.getMinutes())
  if (format === '24h') return `${pad(d.getHours())}:${m}`
  const h = d.getHours()
  // Midnight and noon are the cases a modulo alone gets wrong: 0 and 12 both
  // read as 12, on opposite sides of the meridiem.
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

/** `21:09`, or `19:00–21:30` when the moment is a period. Both ends in
 *  whichever format is set — `7:00 PM–9:30 PM` reads long, and the day table's
 *  time column is sized for it. */
export function timeCell(m: Moment, format: TimeFormat = timeFormat()): string {
  const start = hhmm(m.timeslot.occurred_at, format)
  return m.timeslot.ended_at ? `${start}–${hhmm(m.timeslot.ended_at, format)}` : start
}

/** `breast` / `formula`, or nothing at all where the source was not marked. */
export const srcWord = (source: LogEvent['source']) =>
  source === 'breast_milk' ? 'breast' : source === 'formula' ? 'formula' : ''

/**
 * The Milk column: `45 mL`, `45 mL formula`, `25 mL breast + 45 mL formula`,
 * `30 mL + 30 mL`, or `? mL`.
 *
 * **The `(B)` / `(F)` short codes are gone**, replaced by the unit and the word.
 * The paper writes the codes and this used to copy them, which made the read-back
 * a transcription; the third handoff spends the width on saying it outright,
 * because the person reading at 4am is not holding the legend in their head.
 * What the codes carried — which source, and that a split feed is two volumes —
 * is all still here. The cost is real and lands in the day table, where a split
 * feed now wraps to two lines.
 *
 * An empty cell and a `?` are different facts — no feed at all, versus a feed
 * whose volume was not known. The paper log distinguishes them and so must
 * this, which is why an absent feed returns null rather than an empty string.
 */
export function milkCell(events: LogEvent[]): { parts: string[]; unknown: boolean } | null {
  const feeds = events.filter((e) => e.type === 'feed')
  if (feeds.length === 0) return null
  const parts = feeds.map((e) => {
    const vol = e.volume_ml === null ? '?' : String(e.volume_ml)
    const word = srcWord(e.source)
    return `${vol} mL${word ? ` ${word}` : ''}`
  })
  return { parts, unknown: feeds.every((e) => e.volume_ml === null) }
}

/**
 * The same feed as one figure: `60 mL`, `90 + ? mL`, `? mL`.
 *
 * For the places that have one line and no room to lose — the combined and
 * mascot leads on the top card. `milkCell` grew long enough with the unit and
 * the source word that a split feed overflowed the figure slot, so those two
 * take the sum instead of the breakdown. An unknown part is carried through
 * rather than dropped: `90 + ?` is a different fact from `90`.
 */
export function milkTotal(events: LogEvent[]): string | null {
  const feeds = events.filter((e) => e.type === 'feed')
  if (feeds.length === 0) return null
  const known = feeds.filter((e) => e.volume_ml !== null)
  const anyUnknown = known.length < feeds.length
  if (known.length === 0) return '? mL'
  const sum = known.reduce((a, e) => a + e.volume_ml!, 0)
  return `${sum}${anyUnknown ? ' + ?' : ''} mL`
}

/**
 * "fed 25 min" — how long the feed took, where the moment has an end time.
 *
 * The mirror of `sleepCell`, and the only thing an ended feed says that an
 * instant one does not. Nothing when the moment carries no feed, and nothing
 * while the feed is still running — the live count is the home row's, drawn
 * from `ongoingFeed` and `liveClock` where the screen already knows what is
 * open. The day table is a read-back of a day that is over, so it stays one:
 * a stopwatch on a row you scrolled back to is counting the wrong thing.
 */
export function feedCell(m: Moment): string | null {
  if (!m.events.some((e) => e.type === 'feed')) return null
  const { occurred_at, ended_at } = m.timeslot
  return ended_at === null ? null : `fed ${feedDuration(occurred_at, ended_at)}`
}

/**
 * The pee/poop column, split so each half can carry its own colour — the
 * prototype prints `pee` in yellow and the poop in mint rather than one string.
 */
export function diaperParts(events: LogEvent[]): { pee: boolean; poop: string | null } {
  const changes = events.filter((e) => e.type === 'diaper')
  const pee = changes.some((c) => c.pee)
  const pooped = changes.find((c) => c.poop)
  if (!pooped) return { pee, poop: null }
  // `other` is a schema value, not something anyone wrote. Printing
  // "poop (other)" says less than "poop" does, and the detail is in the note
  // anyway — which is why `other` exists as an option at all.
  const qual = [pooped.poop_colour, pooped.poop_consistency]
    .filter((v) => v && v !== 'other')
    .join(' ')
  return { pee, poop: qual ? `poop (${qual})` : 'poop' }
}

/** Flat form, for tests and anywhere a single string is wanted. */
export function diaperCell(events: LogEvent[]): string | null {
  const { pee, poop } = diaperParts(events)
  const bits = [pee ? 'pee' : null, poop].filter(Boolean)
  return bits.length ? bits.join(' · ') : null
}

/**
 * What one secondary entry reads as, value and all.
 *
 * The three types that carry a field (D-036) print it; the two that do not
 * still print their bare name, exactly as every one of them did before. A field
 * left blank falls back to the name too — a weight nobody caught is still a
 * weighing, the same way a `?` volume is still a feed.
 */
export function otherLabel(e: LogEvent): string {
  const name = e.type.replace('_', ' ')
  // Typed as a decimal, read back the way a scale says it (0003).
  if (e.type === 'weight' && e.pounds !== null) return `${name} ${poundsToLbOz(e.pounds)}`
  if (e.type === 'temperature' && e.fahrenheit !== null) return `${name} ${e.fahrenheit}°F`
  if (e.type === 'supplement') {
    const said = [e.supplement_name, e.amount].filter(Boolean).join(' ')
    return said ? `${name} ${said}` : name
  }
  return name
}

/** Anything that is neither a feed, a change, nor a sleep — sleep has its own. */
export function otherCell(events: LogEvent[]): string | null {
  const rest = events.filter(
    (e) => e.type !== 'feed' && e.type !== 'diaper' && e.type !== 'sleep',
  )
  if (rest.length === 0) return null
  return rest.map(otherLabel).join(' · ')
}

/**
 * The sleep cell: "sleeping…" while it is still running, "slept 1h 20m" once
 * it has ended.
 *
 * Its own slot rather than part of `otherCell`, because the two read
 * differently — one is a state you are in, the other is something that
 * happened — and they take different icons.
 */
export function sleepCell(m: Moment): { text: string; icon: string; open: boolean } | null {
  if (!m.events.some((e) => e.type === 'sleep')) return null
  const { occurred_at, ended_at } = m.timeslot
  return ended_at === null
    ? { text: 'sleeping…', icon: 'bedtime', open: true }
    : { text: `slept ${sleepDuration(occurred_at, ended_at)}`, icon: 'wb_twilight', open: false }
}

/**
 * The date prints on the first row of a day and is inherited below it, exactly
 * as the paper page does — which is why this takes the *previous* row rather
 * than formatting each row on its own.
 */
export function dateCell(m: Moment, previous: Moment | undefined): string | null {
  if (previous && sameDay(previous.timeslot.occurred_at, new Date(m.timeslot.occurred_at))) {
    return null
  }
  const d = new Date(m.timeslot.occurred_at)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Oldest first, like reading down a page. */
export function chronological(moments: Moment[]): Moment[] {
  return [...moments].sort(
    (a, b) => +new Date(a.timeslot.occurred_at) - +new Date(b.timeslot.occurred_at),
  )
}

/** Distinct days present in the log, newest first, for the date strip. */
export function daysWithEntries(moments: Moment[]): Date[] {
  const seen = new Map<number, Date>()
  for (const m of moments) {
    const d = new Date(m.timeslot.occurred_at)
    d.setHours(0, 0, 0, 0)
    seen.set(d.getTime(), d)
  }
  return [...seen.values()].sort((a, b) => +b - +a)
}

export const initialOf = (name: string | null) =>
  name ? name.trim().charAt(0).toUpperCase() : null

/**
 * Which of the design's two parent colours a device gets.
 *
 * By position in a stable sort of the ids, so both phones agree on who is amber
 * and who is blue without anything having to be stored.
 */
export function avatarClass(deviceId: string, allIds: string[]): string {
  const i = [...allIds].sort().indexOf(deviceId)
  return i % 2 === 0 ? 'avatar avatar-m' : 'avatar avatar-a'
}

/**
 * "9/3 · 21:35 · 60(B) + 73(F)" — the entry named back to you in the delete
 * confirm sheet (Q-012).
 *
 * A hard delete with no tombstone (D-003) is the one place worth spending a
 * sentence on being sure you have the right row, so this says what the row was,
 * not just that it exists.
 */
export function describeMoment(m: Moment): string {
  const d = new Date(m.timeslot.occurred_at)
  const milk = milkCell(m.events)
  const { pee, poop } = diaperParts(m.events)
  const rest = otherCell(m.events)
  // Without this a sleep-only row was named "empty" in the sheet that asks
  // whether to delete it, which is the one place the app must not shrug.
  const sleep = sleepCell(m)

  const what = [
    milk ? milk.parts.join(' + ') : null,
    pee ? 'pee' : null,
    poop,
    sleep ? sleep.text : null,
    rest,
  ].filter(Boolean).join(' · ')

  return [
    `${d.getMonth() + 1}/${d.getDate()}`,
    timeCell(m),
    // A moment can be a note and nothing else, and that is still worth naming.
    what || (m.timeslot.note ? 'note' : 'empty'),
  ].join(' · ')
}
