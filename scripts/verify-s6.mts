// S6's done-when is the last coverage item: something nobody anticipated has
// somewhere to go. That is the one that decides whether the pen leaves the
// nightstand, so it is worth checking against real entries from the paper log
// rather than invented ones.
import 'fake-indexeddb/auto'
const store = new Map<string, string>([['babyliana.device_id', '00000000-0000-4000-8000-0000000d0d0d']])
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

import type { Block } from '../src/log/drafts.ts'
const { canSave, newDiaper, newMilk, newOther, toEntry, OTHER_TYPES } = await import(
  '../src/log/drafts.ts'
)
const { ensureThisDevice, logMoment, getMoments } = await import('../src/moments.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const other = (kind: string | null): Block =>
  ({ key: 'o', type: 'other', draft: { ...newOther(), kind: kind as never } })

await ensureThisDevice()

// --- the other block --------------------------------------------------------
check('every secondary type in the schema is reachable',
  OTHER_TYPES.map((t) => t.kind).join() === 'sleep,weight,temperature,supplement,spit_up,other')
check('nothing picked cannot be saved', !canSave([other(null)]))
check('picking one can', canSave([other('sleep')]))
check('it becomes an entry of that type', toEntry(other('weight')).type === 'weight')

// --- the note ---------------------------------------------------------------
const noted = await logMoment({
  note: 'seemed uncomfortable, arched a lot',
  entries: [toEntry({ key: 'm', type: 'milk', draft: { ...newMilk(), volume: 40 } })],
})
check('a moment carries a note', noted.timeslot.note === 'seemed uncomfortable, arched a lot')
const back = (await getMoments()).find((x) => x.timeslot.id === noted.timeslot.id)!
check('the note survives a reload', back.timeslot.note === noted.timeslot.note)

// --- the coverage items this slice is responsible for -----------------------
// `2 (G→Y liquid)` — the transition is prose, which is why it waited for S6
const transition = await logMoment({
  note: 'green→yellow',
  entries: [
    toEntry({ key: 'd', type: 'diaper',
      draft: { ...newDiaper(), pee: false, poop: true, colour: 'green', consistency: 'liquid' } }),
  ],
})
const d = transition.events[0]
check('2 (G→Y liquid) is expressible — structure plus the note for the transition',
  d.poop === true && d.poop_colour === 'green' && d.poop_consistency === 'liquid' &&
  transition.timeslot.note === 'green→yellow')

// `2 (small Y)` — "small" is a quantity with no column, so it is prose too
const small = await logMoment({
  note: 'small',
  entries: [toEntry({ key: 'd', type: 'diaper',
    draft: { ...newDiaper(), pee: false, poop: true, colour: 'yellow' } })],
})
check('2 (small Y) is expressible', small.timeslot.note === 'small' &&
  small.events[0].poop_colour === 'yellow')

// the last checklist item, in its own words
const unanticipated = await logMoment({
  note: 'rash on her neck, showed the midwife',
  entries: [toEntry(other('other'))],
})
check('something nobody anticipated has somewhere to go',
  unanticipated.events[0].type === 'other' && !!unanticipated.timeslot.note)

// a sleep with a duration, using the period rather than a field
const sleep = await logMoment({
  occurredAt: new Date(2026, 8, 3, 19, 0),
  endedAt: new Date(2026, 8, 3, 21, 30),
  entries: [toEntry(other('sleep'))],
})
check('sleep uses the moment period, not a field of its own',
  sleep.events[0].type === 'sleep' && sleep.timeslot.ended_at !== null)

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
