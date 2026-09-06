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
  blocksFromMoment, canSave, gramsToKg, kgToGrams, newDiaper, newOther, toEntries, OTHER_TYPES,
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
// Sleep left this list when it earned its own block and its own bubble; the
// rest of the schema's secondary types still live behind `other`.
check('every secondary type in the schema is reachable',
  OTHER_TYPES.map((t) => t.kind).join() === 'weight,temperature,supplement,spit_up,other')
check('sleep is no longer buried in the other list',
  !OTHER_TYPES.some((t) => t.kind === 'sleep'))
check('nothing picked cannot be saved', !canSave([other(null)]))
check('picking one can', canSave([other('weight')]))
check('it becomes an entry of that type', one(other('weight')).type === 'weight')

// --- the three that carry a value now (D-036) -------------------------------
const withFields = (kind: string, fields: Record<string, string>): Block =>
  ({ key: 'o', type: 'other', draft: { ...newOther(), kind: kind as never, ...fields } })

check('kg is typed and grams is stored', kgToGrams('3.4') === 3400)
check('a whole number of kg still works', kgToGrams('4') === 4000)
check('grams round rather than truncate', kgToGrams('3.4567') === 3457)
check('a blank weight is null, not zero', kgToGrams('') === null)
check('so is something that is not a number', kgToGrams('abc') === null)
check('half-typed reads as the digits so far', kgToGrams('3.') === 3000)
check('grams come back as kg for editing', gramsToKg(3400) === '3.4')

const weighed = one(withFields('weight', { kg: '3.4' }))
check('a weight entry carries grams', weighed.grams === 3400, String(weighed.grams))
const unweighed = one(withFields('weight', { kg: '' }))
check('a weight with no number is still savable and still a weight',
  canSave([withFields('weight', { kg: '' })]) && unweighed.grams === null)

const temp = one(withFields('temperature', { celsius: '36.8' }))
check('a temperature entry carries celsius', temp.celsius === 36.8, String(temp.celsius))
check('a decimal point is not lost', one(withFields('temperature', { celsius: '37.05' })).celsius === 37.05)

const supp = one(withFields('supplement', { supplementName: ' vitamin D ', supplementAmount: '1 drop' }))
check('a supplement carries its name, trimmed', supp.supplement_name === 'vitamin D', String(supp.supplement_name))
check('and its amount', supp.amount === '1 drop', String(supp.amount))
check('a supplement with only a name keeps the amount null',
  one(withFields('supplement', { supplementName: 'vitamin D' })).amount === null)

// The two that carry nothing still carry nothing — their detail is the note.
check('spit up takes no fields', Object.keys(one(other('spit_up'))).join() === 'type')
check('nor does something else', Object.keys(one(other('other'))).join() === 'type')

// --- a value survives being reopened for editing ----------------------------
const logged = await logMoment({ entries: [one(withFields('weight', { kg: '3.4' }))] })
const reopened = blocksFromMoment(logged)
check('reopening a weight fills the field back in',
  reopened[0].type === 'other' && reopened[0].draft.kg === '3.4',
  JSON.stringify(reopened[0].draft))
check('and saves back to the same grams', one(reopened[0]).grams === 3400)

const suppSaved = await logMoment({
  entries: [one(withFields('supplement', { supplementName: 'vitamin D', supplementAmount: '1 drop' }))],
})
const suppBack = blocksFromMoment(suppSaved)[0]
check('reopening a supplement fills both fields back in',
  suppBack.type === 'other'
    && suppBack.draft.supplementName === 'vitamin D'
    && suppBack.draft.supplementAmount === '1 drop',
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
