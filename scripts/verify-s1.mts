// S1's "done when", run headlessly: log three feeds including one split and one
// with an unknown volume, reopen the database, confirm all three came back
// correct. fake-indexeddb gives us the same IndexedDB the browser has.
import 'fake-indexeddb/auto'

// deviceId() reaches for localStorage; the write path only needs a stable id.
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage

const { ensureThisDevice, logMoment, getMoments, deleteMoment } = await import('../src/moments.ts')
const { getDevices } = await import('../src/db.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

await ensureThisDevice()
await ensureThisDevice() // twice: must not make a second row
check('device row created once, not per startup', (await getDevices()).length === 1)

await logMoment({ entries: [{ type: 'feed', volume_ml: 60, source: 'formula' }] })
await logMoment({
  entries: [
    { type: 'feed', volume_ml: 25, source: 'breast_milk' },
    { type: 'feed', volume_ml: 45, source: 'formula' },
  ],
})
await logMoment({ entries: [{ type: 'feed', volume_ml: null, source: 'unknown' }] })

const moments = await getMoments()
check('three moments stored', moments.length === 3, `got ${moments.length}`)
check('split feed is two entries in one moment', moments.some((m) => m.events.length === 2))
check('unknown volume persists as null, not 0', moments.some((m) => m.events[0]?.volume_ml === null))
check('newest first', moments[0].timeslot.occurred_at >= moments[2].timeslot.occurred_at)

const split = moments.find((m) => m.events.length === 2)!
check('both halves keep their own source',
  split.events.map((e) => e.source).sort().join() === 'breast_milk,formula')
check('entries share their moment id', split.events.every((e) => e.timeslot_id === split.timeslot.id))
check('ids are distinct per entry', split.events[0].id !== split.events[1].id)
check('baby and device stamped on the moment',
  !!split.timeslot.baby_id && !!split.timeslot.logged_by)

// the real test: reopen as a cold start would
const reread = await getMoments()
check('survives a reload', reread.length === 3 && reread.some((m) => m.events.length === 2))

await deleteMoment(split.timeslot.id)
const after = await getMoments()
const orphans = after.flatMap((m) => m.events).filter((e) => e.timeslot_id === split.timeslot.id)
check('deleting a moment takes its entries', after.length === 2 && orphans.length === 0)

let refused = false
try {
  await logMoment({ entries: [] })
} catch {
  refused = true
}
check('a moment with no entries is refused', refused)

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
