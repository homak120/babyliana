// ⚠ This writes to the PRODUCTION database, which now holds real entries.
// Every delete here names an exact id this run created. Never widen one to a
// filter — `delete().eq('baby_id', …)` would take the real log with it.
//
// S8's done-when, in three parts: correct a volume without disturbing the
// diaper logged at the same moment; delete and get it back; delete and let it
// go, confirming it left the server too.
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2]
}
// Not pre-seeded any more: createThisDevice mints the id, because opening the
// app must not. The id it returns is what gets used and cleaned up.
let TEST_DEVICE = ''
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })

import type { Block } from '../src/log/drafts.ts'
const { blocksFromMoment, newDiaper, newMilk, toEntry } = await import('../src/log/drafts.ts')
const { createThisDevice, logMoment, updateMoment, getMoments, removeMoment } = await import(
  '../src/moments.ts'
)
const { sync } = await import('../src/sync.ts')
const { supabase } = await import('../src/supabase.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const sb = supabase!
const made: string[] = []

try {
  TEST_DEVICE = await createThisDevice('verify')

  // --- correcting a value, without disturbing the rest ----------------------
  const m = await logMoment({
    entries: [
      toEntry({ key: 'a', type: 'milk', draft: { ...newMilk(), volume: 50, source: 'formula' } }),
      toEntry({ key: 'b', type: 'diaper', draft: { ...newDiaper(), poop: true, colour: 'yellow' } }),
    ],
  })
  made.push(m.timeslot.id)
  const diaperId = m.events.find((e) => e.type === 'diaper')!.id

  const blocks = blocksFromMoment(m)
  check('reopening gives a block per entry, each carrying its id',
    blocks.length === 2 && blocks.every((b) => !!b.id))

  // the paper log's own correction: strike the value, leave the row
  const corrected = blocks.map((b) =>
    b.type === 'milk' ? ({ ...b, draft: { ...b.draft, volume: 60 } } as Block) : b,
  )
  const after = await updateMoment(m.timeslot.id, {
    entries: corrected.map(toEntry),
    entryIds: corrected.map((b) => b.id),
  })

  const feed = after.events.find((e) => e.type === 'feed')!
  const diaper = after.events.find((e) => e.type === 'diaper')!
  check('the corrected volume is 60', feed.volume_ml === 60, String(feed.volume_ml))
  check('the diaper at the same moment is untouched',
    diaper.id === diaperId && diaper.poop === true && diaper.poop_colour === 'yellow')
  check('and it keeps its identity rather than being replaced', diaper.id === diaperId)
  check('the moment still holds exactly two entries', after.events.length === 2)

  // --- an unknown volume must survive a round trip through the sheet --------
  const q = await logMoment({ entries: [toEntry({ key: 'q', type: 'milk', draft: { ...newMilk(), unknown: true } })] })
  made.push(q.timeslot.id)
  const reopened = blocksFromMoment(q)[0]
  check('a stored ? reopens as ?, not as an empty block',
    reopened.type === 'milk' && reopened.draft.unknown && reopened.draft.volume === null)

  // --- removing one entry from a moment ------------------------------------
  const trimmed = blocksFromMoment(after).filter((b) => b.type === 'milk')
  const smaller = await updateMoment(m.timeslot.id, {
    entries: trimmed.map(toEntry),
    entryIds: trimmed.map((b) => b.id),
  })
  check('removing a block deletes just that entry', smaller.events.length === 1)
  const stored = (await getMoments()).find((x) => x.timeslot.id === m.timeslot.id)!
  check('and it is gone locally too', stored.events.length === 1)

  // --- the edit has to reach the other phone -------------------------------
  await sync()
  const remote = await sb.from('event').select('*').eq('timeslot_id', m.timeslot.id)
  check('the server holds the edit, not the original',
    remote.data?.length === 1 && remote.data[0].volume_ml === 60,
    JSON.stringify(remote.data?.map((r) => r.volume_ml)))

  // --- delete, and undo ----------------------------------------------------
  const doomed = await logMoment({ entries: [toEntry({ key: 'x', type: 'milk', draft: { ...newMilk(), volume: 31 } })] })
  made.push(doomed.timeslot.id)
  await sync()
  // undo is "the timer never fired", so nothing was called — the row stands
  check('an undone delete leaves the moment exactly where it was',
    (await getMoments()).some((x) => x.timeslot.id === doomed.timeslot.id))

  // --- delete, and let it go -----------------------------------------------
  await removeMoment(doomed.timeslot.id)
  await sync()
  check('a committed delete is gone locally',
    !(await getMoments()).some((x) => x.timeslot.id === doomed.timeslot.id))
  const gone = await sb.from('timeslot').select('id').eq('id', doomed.timeslot.id)
  check('and gone from the server, so the other phone loses it too',
    gone.data?.length === 0)
  const orphans = await sb.from('event').select('id').eq('timeslot_id', doomed.timeslot.id)
  check('its entries went with it — no orphans left behind', orphans.data?.length === 0)
} finally {
  for (const id of made) await sb.from('timeslot').delete().eq('id', id)
  await sb.from('device').delete().eq('id', TEST_DEVICE)
  const [ts, dev] = await Promise.all([
    sb.from('timeslot').select('id').in('id', made),
    sb.from('device').select('id').eq('id', TEST_DEVICE),
  ])
  console.log(
    `\n  cleanup: ${ts.data?.length ?? '?'} of this run's timeslots, ` +
      `${dev.data?.length ?? '?'} test devices left`,
  )
}

console.log(failures === 0 ? '  all checks passed' : `  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
