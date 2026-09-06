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
const {
  blocksFromMoment, canSave, newDiaper, newOther, newSupplement, newTemperature, newWeight,
  poundsToLbOz, toEntries, OTHER_TYPES, SUPPLEMENT_PRESET,
} = await import('../src/log/drafts.ts')
const { createThisDevice, logMoment, getMoments } = await import('../src/moments.ts')

const one = (b: Block) => toEntries(b)[0]
let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const other = (kind: string | null): Block =>
  ({ key: 'o', type: 'other', draft: { ...newOther(), kind: kind as never } })

await createThisDevice('Test')

// --- the other block --------------------------------------------------------
// Sleep left this list when it earned its own block and its own bubble, and
// weight, temperature and supplement followed for the same reason (D-038).
// What is left has no value to capture.
check('only the two valueless types are left behind other',
  OTHER_TYPES.map((t) => t.kind).join() === 'spit_up,other',
  OTHER_TYPES.map((t) => t.kind).join())
for (const gone of ['sleep', 'weight', 'temperature', 'supplement']) {
  check(`${gone} is not buried in the other list`,
    !OTHER_TYPES.some((t) => t.kind === gone))
}
check('nothing picked cannot be saved', !canSave([other(null)]))
check('picking one can', canSave([other('spit_up')]))
check('it becomes an entry of that type', one(other('spit_up')).type === 'spit_up')

// --- the three with tiles of their own (D-036, D-038) -----------------------
const withFields = (kind: string, fields: Record<string, string>): Block => {
  const base = kind === 'weight' ? newWeight()
    : kind === 'temperature' ? newTemperature()
      : newSupplement()
  return { key: 'o', type: kind as never, draft: { ...base, ...fields } as never }
}

// Pounds are stored exactly as typed (0003); the lb + oz form is display only,
// so a weight reopened for editing shows the number that was entered.
const weighed = one(withFields('weight', { lb: '7.25' }))
check('a weight entry carries the pounds as typed', weighed.pounds === 7.25, String(weighed.pounds))
check('a whole number of pounds works', one(withFields('weight', { lb: '8' })).pounds === 8)
check('a blank weight is null, not zero', one(withFields('weight', { lb: '' })).pounds === null)
check('so is something that is not a number',
  one(withFields('weight', { lb: 'abc' })).pounds === null)
check('half-typed reads as the digits so far',
  one(withFields('weight', { lb: '7.' })).pounds === 7)
check('a weight with no number is still savable and still a weight',
  canSave([withFields('weight', { lb: '' })])
    && one(withFields('weight', { lb: '' })).type === 'weight')
// Neither the draft nor the row can name the metric pair any more — they are
// gone from DraftEntry, from LogEvent, and from the table in 0004.
check('the superseded columns are gone from the draft entirely',
  !Object.keys(weighed).includes('grams') && !Object.keys(weighed).includes('celsius'))

check('pounds read back the way a scale says it', poundsToLbOz(7.25) === '7 lb 4 oz',
  poundsToLbOz(7.25))
check('exact pounds drop the ounces', poundsToLbOz(8) === '8 lb', poundsToLbOz(8))
check('ounces are whole, rounded', poundsToLbOz(7.3) === '7 lb 5 oz', poundsToLbOz(7.3))
// 7.97 lb is 15.52 oz, which rounds to 16 — that must carry into the pound
// rather than print "7 lb 16 oz".
check('sixteen ounces carry into the pound', poundsToLbOz(7.97) === '8 lb', poundsToLbOz(7.97))
check('and under an ounce is just the pounds', poundsToLbOz(7.01) === '7 lb', poundsToLbOz(7.01))

const temp = one(withFields('temperature', { fahrenheit: '98.6' }))
check('a temperature entry carries fahrenheit', temp.fahrenheit === 98.6, String(temp.fahrenheit))
check('a fever reading fits, where the old numeric(3,1) could not hold it',
  one(withFields('temperature', { fahrenheit: '100.4' })).fahrenheit === 100.4)
check('a decimal point is not lost',
  one(withFields('temperature', { fahrenheit: '99.05' })).fahrenheit === 99.05)

const supp = one(withFields('supplement', { name: ' vitamin D ', amount: '1 drop' }))
check('a supplement carries its name, trimmed', supp.supplement_name === 'vitamin D', String(supp.supplement_name))
check('and its amount', supp.amount === '1 drop', String(supp.amount))
check('a supplement with only a name keeps the amount null',
  one(withFields('supplement', { name: 'vitamin D', amount: '' })).amount === null)

// The two that carry nothing still carry nothing — their detail is the note.
check('spit up takes no fields', Object.keys(one(other('spit_up'))).join() === 'type')
check('nor does something else', Object.keys(one(other('other'))).join() === 'type')

// --- a new supplement block arrives filled in -------------------------------
const picked = newSupplement()
check('supplement comes with the usual name and dose',
  picked.name === SUPPLEMENT_PRESET.name && picked.amount === SUPPLEMENT_PRESET.amount,
  `${picked.name} / ${picked.amount}`)
check('and it is marked a suggestion, not an entry', picked.preset === true)
check('so it saves as typed if nobody disagrees',
  one({ key: 'o', type: 'supplement', draft: picked }).supplement_name === 'Vitamin D')
check('and clearing it is still allowed',
  one({ key: 'o', type: 'supplement', draft: { name: '', amount: '', preset: false } })
    .supplement_name === null)

check('weight starts blank', newWeight().lb === '')
check('temperature starts blank', newTemperature().fahrenheit === '')

// Reopening an existing supplement is a restore, not a suggestion — the flag
// must not come back on, or the first tap in the field would wipe what is
// stored there.
const storedSupp = await logMoment({
  entries: [one(withFields('supplement', { name: 'iron', amount: '2 mL' }))],
})
const reopenedSupp = blocksFromMoment(storedSupp)[0]
check('a reopened supplement is not marked a suggestion',
  reopenedSupp.type === 'supplement' && !reopenedSupp.draft.preset
    && reopenedSupp.draft.name === 'iron',
  JSON.stringify(reopenedSupp.draft))

// --- a value survives being reopened for editing ----------------------------
const logged = await logMoment({ entries: [one(withFields('weight', { lb: '7.25' }))] })
const reopened = blocksFromMoment(logged)
check('reopening a weight fills the field back in',
  reopened[0].type === 'weight' && reopened[0].draft.lb === '7.25',
  JSON.stringify(reopened[0].draft))
check('and saves back to the same number, with no drift',
  one(reopened[0]).pounds === 7.25)

const suppSaved = await logMoment({
  entries: [one(withFields('supplement', { name: 'vitamin D', amount: '1 drop' }))],
})
const suppBack = blocksFromMoment(suppSaved)[0]
check('reopening a supplement fills both fields back in',
  suppBack.type === 'supplement'
    && suppBack.draft.name === 'vitamin D'
    && suppBack.draft.amount === '1 drop',
  JSON.stringify(suppBack.draft))

// --- the note ---------------------------------------------------------------
const noted = await logMoment({
  note: 'seemed uncomfortable, arched a lot',
  entries: [one({ key: 'm', type: 'milk', draft: { parts: [{ volume: 40, source: 'unknown' }], active: 0 } })],
})
check('a moment carries a note', noted.timeslot.note === 'seemed uncomfortable, arched a lot')
const back = (await getMoments()).find((x) => x.timeslot.id === noted.timeslot.id)!
check('the note survives a reload', back.timeslot.note === noted.timeslot.note)

// --- the coverage items this slice is responsible for -----------------------
// `2 (G→Y liquid)` — the transition is prose, which is why it waited for S6
const transition = await logMoment({
  note: 'green→yellow',
  entries: [
    one({ key: 'd', type: 'diaper',
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
  entries: [one({ key: 'd', type: 'diaper',
    draft: { ...newDiaper(), pee: false, poop: true, colour: 'yellow' } })],
})
check('2 (small Y) is expressible', small.timeslot.note === 'small' &&
  small.events[0].poop_colour === 'yellow')

// the last checklist item, in its own words
const unanticipated = await logMoment({
  note: 'rash on her neck, showed the midwife',
  entries: [one(other('other'))],
})
check('something nobody anticipated has somewhere to go',
  unanticipated.events[0].type === 'other' && !!unanticipated.timeslot.note)

// a sleep with a duration, using the period rather than a field
const sleep = await logMoment({
  occurredAt: new Date(2026, 8, 3, 19, 0),
  endedAt: new Date(2026, 8, 3, 21, 30),
  entries: [one(other('sleep'))],
})
check('sleep uses the moment period, not a field of its own',
  sleep.events[0].type === 'sleep' && sleep.timeslot.ended_at !== null)

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
