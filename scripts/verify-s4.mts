// S4's done-when, plus the coverage-checklist items diapers are responsible
// for. The sheet's rules live in drafts.ts precisely so they can be checked
// without a browser.
import 'fake-indexeddb/auto'
const store = new Map<string, string>([['babyliana.device_id', '00000000-0000-4000-8000-0000000d0d0d']])
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

import type { Block } from '../src/log/drafts.ts'
const { canSave, newDiaper, newMilk, toEntry, blockIsEmpty } = await import(
  '../src/log/drafts.ts'
)
const { createThisDevice, logMoment, getMoments } = await import('../src/moments.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const milk = (d: Partial<ReturnType<typeof newMilk>> = {}): Block =>
  ({ key: 'm', type: 'milk', draft: { ...newMilk(), ...d } })
const diaper = (d: Partial<ReturnType<typeof newDiaper>> = {}): Block =>
  ({ key: 'd', type: 'diaper', draft: { ...newDiaper(), ...d } })

// --- the default, which is grounded in the real log -------------------------
check('a new diaper block starts as a pee', newDiaper().pee && !newDiaper().poop)
check('so the commonest change is savable with zero extra taps', canSave([diaper()]))

// --- save gating ------------------------------------------------------------
check('nothing selected cannot be saved', !canSave([]))
check('a diaper with neither flag cannot be saved',
  !canSave([diaper({ pee: false, poop: false })]))
// The prototype states this outright: "leave it blank and it saves as ? — a
// feed happened, volume unknown". Requiring a number would make the app unable
// to record something the paper log does about once a day.
check('a blank milk block IS savable — blank is the paper\'s ?', canSave([milk()]))
check('and it stores as null, not 0', toEntry(milk()).volume_ml === null)
check('an empty diaper still blocks the save',
  !canSave([milk(), diaper({ pee: false, poop: false })]))

// --- coverage checklist -----------------------------------------------------
const peeEntry = toEntry(diaper())
check('a pee', peeEntry.pee === true && peeEntry.poop === false)

const poopEntry = toEntry(diaper({ pee: false, poop: true }))
check('a poop', poopEntry.poop === true && poopEntry.pee === false)

const both = toEntry(diaper({ pee: true, poop: true }))
check('a pee and a poop in the same change', both.pee === true && both.poop === true)

const annotated = toEntry(diaper({ pee: false, poop: true, colour: 'green', consistency: 'liquid' }))
check('a poop with colour and consistency',
  annotated.poop_colour === 'green' && annotated.poop_consistency === 'liquid')

const bare = toEntry(diaper({ pee: false, poop: true }))
check('skipping colour and consistency is valid, not an error',
  bare.poop === true && bare.poop_colour === null && bare.poop_consistency === null)

// --- a moment is a moment ---------------------------------------------------
await createThisDevice('Test')
const m = await logMoment({
  entries: [toEntry(milk({ volume: 60, source: 'formula' })), toEntry(diaper({ poop: true }))],
})
check('a feed and a diaper in one moment', m.events.length === 2)
check('they share the moment', m.events.every((e) => e.timeslot_id === m.timeslot.id))
check('types are distinct',
  m.events.map((e) => e.type).sort().join() === 'diaper,feed')

const stored = (await getMoments()).find((x) => x.timeslot.id === m.timeslot.id)!
const d = stored.events.find((e) => e.type === 'diaper')!
check('diaper flags survive a round trip', d.pee === true && d.poop === true)
check('a feed row carries no diaper columns',
  stored.events.find((e) => e.type === 'feed')!.pee === null)

// --- a row with a diaper and no feed, and vice versa -------------------------
const diaperOnly = await logMoment({ entries: [toEntry(diaper())] })
check('a row with a diaper and no feed',
  diaperOnly.events.length === 1 && diaperOnly.events[0].type === 'diaper')
check('blockIsEmpty is what gates it, not the UI',
  blockIsEmpty(diaper({ pee: false, poop: false })) && !blockIsEmpty(diaper()))

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
