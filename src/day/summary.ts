import { hm } from '../report/insights'
import { otherLabel } from './cells'
import type { Moment } from '../types'

// What a page of the read-back adds up to, in words.
//
// The tag row above it is the glance — four figures and a `?` count. This is
// the rest of what was written down that day, and it exists because the glance
// was all there was: a day with a weight, a temperature, three supplements and
// four notes in it looked exactly like a day without them until you scrolled
// the table.
//
// Strings rather than numbers, and here rather than in the component, for the
// same reason `cells.ts` is: the acceptance test is what it reads like, and
// that is easier to check against real entries here than by eye.

/** One line of the summary. A null key is a continuation of the line above. */
export type SummaryLine = { key: string | null; text: string }

const isFeed = (m: Moment) => m.events.some((e) => e.type === 'feed')

/** Minutes between the first and last feed of a day, at their widest. */
function longestFeedGap(moments: Moment[]): number {
  const times = moments
    .filter(isFeed)
    .map((m) => new Date(m.timeslot.occurred_at).getTime())
    .sort((a, b) => a - b)
  let worst = 0
  for (let i = 1; i < times.length; i++) {
    worst = Math.max(worst, Math.round((times[i] - times[i - 1]) / 60000))
  }
  return worst
}

/**
 * Everything this page holds, grouped: milk, diapers, sleep, and a line for
 * whatever else was logged.
 *
 * Takes whatever moments it is given and counts them, with no date filtering of
 * its own — the same contract as `totalsOf`, because the page is one day, or
 * every day, or a picked period, and all three come through here.
 *
 * **Nothing here judges.** A temperature is printed, never compared to a
 * number; a gap is named, never called long. The one threshold on the wet
 * count lives on the insights screen, where D-032 put it deliberately and
 * narrowly, and it does not follow the figures here.
 */
export function summarise(moments: Moment[]): SummaryLine[] {
  const lines: SummaryLine[] = []

  const days = new Set<string>()
  for (const m of moments) {
    const d = new Date(m.timeslot.occurred_at)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  const dayCount = days.size

  // --- milk -----------------------------------------------------------------
  let ml = 0, feeds = 0, noVolume = 0, breast = 0, formula = 0, unmarked = 0
  let pee = 0, poop = 0
  const colours = new Set<string>()
  const also: string[] = []
  let notes = 0
  let sleepMins = 0, sleeps = 0, longestSleep = 0, openSleeps = 0

  for (const m of moments) {
    if (m.timeslot.note) notes++
    for (const e of m.events) {
      if (e.note) notes++
      if (e.type === 'feed') {
        feeds++
        if (e.volume_ml === null) noVolume++
        else {
          ml += e.volume_ml
          if (e.source === 'breast_milk') breast += e.volume_ml
          else if (e.source === 'formula') formula += e.volume_ml
          else unmarked += e.volume_ml
        }
      }
      if (e.type === 'diaper') {
        if (e.pee) pee++
        if (e.poop) {
          poop++
          // `other` is a schema value, not something anyone wrote — the same
          // reason `diaperParts` drops it.
          if (e.poop_colour && e.poop_colour !== 'other') colours.add(e.poop_colour)
        }
      }
      if (e.type !== 'feed' && e.type !== 'diaper' && e.type !== 'sleep') {
        also.push(otherLabel(e))
      }
    }
    if (m.events.some((e) => e.type === 'sleep')) {
      if (m.timeslot.ended_at) {
        const mins = Math.round(
          (new Date(m.timeslot.ended_at).getTime()
            - new Date(m.timeslot.occurred_at).getTime()) / 60000,
        )
        sleeps++
        sleepMins += mins
        longestSleep = Math.max(longestSleep, mins)
      } else {
        // An open sleep has no length yet. Counting it would make the total
        // climb on its own while nothing was logged — the insights screen makes
        // the same call for the same reason.
        openSleeps++
      }
    }
  }

  if (feeds > 0) {
    // A day that was all one thing says so on the first line. Printing
    // "60 formula" under "60 mL over 1 feed" is the same number twice, and the
    // only fact the second line was carrying is which source it was.
    const only = breast > 0 && formula === 0 && unmarked === 0 ? 'breast'
      : formula > 0 && breast === 0 && unmarked === 0 ? 'formula'
        : null

    const head = [
      `${ml} mL over ${feeds} ${feeds === 1 ? 'feed' : 'feeds'}`,
      only ? `all ${only}` : null,
      // The paper log's `?`. A day of 8 feeds and 410 mL where one had no
      // volume is not a 410 mL day, and only the count can say so.
      noVolume > 0 ? `${noVolume} with no volume` : null,
      dayCount > 1 ? `${Math.round(ml / dayCount)} mL a day` : null,
    ].filter(Boolean).join(' · ')
    lines.push({ key: 'milk', text: head })

    // Only worth a line when more than one band has anything in it — an
    // all-unmarked day printing "410 not marked" under "410 mL" says nothing
    // twice, and a single marked source has already been said above.
    if (!only && (breast > 0 || formula > 0)) {
      const parts = [
        breast > 0 ? `${breast} breast` : null,
        formula > 0 ? `${formula} formula` : null,
        unmarked > 0 ? `${unmarked} not marked` : null,
      ].filter(Boolean).join(' · ')
      lines.push({ key: null, text: parts })
    }

    // A gap only means something inside one day. Across a range the widest gap
    // is the night between two days, every time, which is not news.
    const gap = dayCount === 1 ? longestFeedGap(moments) : 0
    if (gap > 0) lines.push({ key: null, text: `longest gap ${hm(gap)}` })
  }

  if (pee > 0 || poop > 0) {
    const said = [
      pee > 0 ? `${pee} wet` : null,
      poop > 0 ? `${poop} dirty${colours.size ? ` (${[...colours].join(', ')})` : ''}` : null,
    ].filter(Boolean).join(' · ')
    lines.push({ key: 'diaper', text: said })
  }

  if (sleeps > 0 || openSleeps > 0) {
    const said = [
      sleeps > 0 ? `${hm(sleepMins)} over ${sleeps}` : null,
      sleeps > 1 ? `longest ${hm(longestSleep)}` : null,
      openSleeps > 0 ? `${openSleeps} still running` : null,
    ].filter(Boolean).join(' · ')
    lines.push({ key: 'sleep', text: said })
  }

  if (also.length > 0 || notes > 0) {
    const said = [
      ...also,
      notes > 0 ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : null,
    ].filter(Boolean).join(' · ')
    lines.push({ key: 'also', text: said })
  }

  return lines
}
