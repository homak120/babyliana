import { hm } from '../report/insights'
import { poundsToLbOz } from '../log/drafts'
import type { Moment } from '../types'

// What a page of the read-back adds up to, as bubbles.
//
// The tag row above it is the glance — feeds, millilitres, wet, dirty. This is
// everything else that was written down, and it exists because the glance was
// all there was: a day with a weight, a temperature, three supplements and four
// notes in it looked exactly like a day without them until you scrolled the
// table.
//
// **Nothing here repeats the tag row.** The total and the feed count are
// already up there in their own bubbles, so a group that would only have said
// them again is absent instead.
//
// Structure rather than strings, because the same fact has to carry a colour
// and an icon now — and the colour is the app's existing vocabulary, not a new
// one: rose is a feed, lav a volume, yellow wet, mint dirty, peri a period of
// time, lilac breast, amber formula. A reader who has learned the tag row has
// already learned this.

/** The tag palette, by the name each colour already has in `log.css`. */
export type Tone =
  | 'rose' | 'lav' | 'yellow' | 'mint' | 'peri' | 'lilac' | 'amber' | 'plain'

/** One bubble: an icon where one helps, a figure, and the colour of its kind. */
export type Bubble = { id: string; icon?: string; text: string; tone: Tone }

/** A labelled row of them. Omitted entirely when it has nothing to add. */
export type SummaryGroup = { key: string; bubbles: Bubble[] }

const isFeed = (m: Moment) => m.events.some((e) => e.type === 'feed')

/** Minutes between the two feeds furthest apart in a row, at their widest. */
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
 * Everything this page holds beyond its four headline figures, grouped.
 *
 * Takes whatever moments it is given and counts them, with no date filtering of
 * its own — the same contract as `totalsOf`, because the page is one day, or
 * every day, or a picked period, and all three come through here.
 *
 * **Nothing here judges.** A temperature is printed, never compared to a
 * number; a gap is named, never called long; no bubble turns red. The one
 * threshold on the wet count lives on the insights screen, where D-032 put it
 * deliberately and narrowly, and it does not follow the figures here.
 */
export function summarise(moments: Moment[]): SummaryGroup[] {
  const days = new Set<string>()
  for (const m of moments) {
    const d = new Date(m.timeslot.occurred_at)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  const dayCount = days.size

  let ml = 0, feeds = 0, breast = 0, formula = 0, unmarked = 0
  const colours = new Set<string>()
  const also: Bubble[] = []
  let notes = 0
  let sleepMins = 0, sleeps = 0, longestSleep = 0, openSleeps = 0

  for (const m of moments) {
    if (m.timeslot.note) notes++
    for (const e of m.events) {
      if (e.note) notes++
      if (e.type === 'feed') {
        feeds++
        if (e.volume_ml !== null) {
          ml += e.volume_ml
          if (e.source === 'breast_milk') breast += e.volume_ml
          else if (e.source === 'formula') formula += e.volume_ml
          else unmarked += e.volume_ml
        }
      }
      if (e.type === 'diaper' && e.poop) {
        // `other` is a schema value, not something anyone wrote — the same
        // reason `diaperParts` drops it.
        if (e.poop_colour && e.poop_colour !== 'other') colours.add(e.poop_colour)
      }
      // The type word is the icon's job now, so the bubble carries the value
      // alone: `7 lb 4 oz`, not `weight 7 lb 4 oz`. A field left blank falls
      // back to the name, because a weight nobody caught is still a weighing.
      if (e.type === 'weight') {
        also.push({
          id: e.id, icon: 'monitor_weight', tone: 'lav',
          text: e.pounds !== null ? poundsToLbOz(e.pounds) : 'weight',
        })
      }
      if (e.type === 'temperature') {
        also.push({
          id: e.id, icon: 'thermostat', tone: 'peri',
          text: e.fahrenheit !== null ? `${e.fahrenheit}°F` : 'temperature',
        })
      }
      if (e.type === 'supplement') {
        const said = [e.supplement_name, e.amount].filter(Boolean).join(' ')
        also.push({ id: e.id, icon: 'medication', tone: 'mint', text: said || 'supplement' })
      }
      if (e.type === 'spit_up') {
        also.push({ id: e.id, tone: 'plain', text: e.severity ? `spit up ${e.severity}` : 'spit up' })
      }
      if (e.type === 'other') {
        also.push({ id: e.id, tone: 'plain', text: 'other' })
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

  const groups: SummaryGroup[] = []

  // --- milk: the split, and the rhythm. Never the total — that is a tag. -----
  const milk: Bubble[] = []
  const only = breast > 0 && formula === 0 && unmarked === 0 ? 'breast'
    : formula > 0 && breast === 0 && unmarked === 0 ? 'formula'
      : null
  if (only === 'breast') milk.push({ id: 'b', tone: 'lilac', text: 'all breast' })
  else if (only === 'formula') milk.push({ id: 'f', tone: 'amber', text: 'all formula' })
  else {
    // An all-unmarked page says nothing here: "410 not marked" under a 410 mL
    // tag is the same number twice, and the only fact a split can add is which
    // source it was.
    if (breast > 0) milk.push({ id: 'b', tone: 'lilac', text: `${breast} breast` })
    if (formula > 0) milk.push({ id: 'f', tone: 'amber', text: `${formula} formula` })
    if ((breast > 0 || formula > 0) && unmarked > 0) {
      milk.push({ id: 'u', tone: 'plain', text: `${unmarked} not marked` })
    }
  }
  if (dayCount > 1 && ml > 0) {
    milk.push({ id: 'avg', icon: 'local_drink', tone: 'rose', text: `${Math.round(ml / dayCount)} mL a day` })
  }
  // A gap only means something inside one day. Across a range the widest gap
  // between feeds is the night, every time, which is not news.
  const gap = dayCount === 1 ? longestFeedGap(moments) : 0
  if (gap > 0) milk.push({ id: 'gap', icon: 'schedule', tone: 'plain', text: `longest gap ${hm(gap)}` })
  if (milk.length) groups.push({ key: 'milk', bubbles: milk })

  // --- what the poop looked like. Neutral: a green bubble beside the word
  //     "yellow" asks the reader to ignore what they can see (D-049's tally
  //     made the same call). -------------------------------------------------
  if (colours.size) {
    groups.push({
      key: 'poop',
      bubbles: [...colours].map((c, n) => ({
        id: `c${n}`, icon: n === 0 ? 'cookie' : undefined, tone: 'plain' as const, text: c,
      })),
    })
  }

  // --- sleep, which the tag row does not carry at all -----------------------
  if (sleeps > 0 || openSleeps > 0) {
    const bubbles: Bubble[] = []
    if (sleeps > 0) {
      bubbles.push({ id: 'total', icon: 'bedtime', tone: 'peri', text: hm(sleepMins) })
      bubbles.push({ id: 'count', tone: 'plain', text: `${sleeps} ${sleeps === 1 ? 'sleep' : 'sleeps'}` })
    }
    if (sleeps > 1) {
      bubbles.push({ id: 'longest', icon: 'schedule', tone: 'plain', text: `longest ${hm(longestSleep)}` })
    }
    if (openSleeps > 0) {
      bubbles.push({ id: 'open', icon: 'bedtime', tone: 'peri', text: `${openSleeps} still running` })
    }
    groups.push({ key: 'sleep', bubbles })
  }

  // --- everything else, including how much was written in words -------------
  if (notes > 0) {
    also.push({
      id: 'notes', icon: 'sticky_note_2', tone: 'peri',
      text: `${notes} ${notes === 1 ? 'note' : 'notes'}`,
    })
  }
  if (also.length) groups.push({ key: 'also', bubbles: also })

  return groups
}
