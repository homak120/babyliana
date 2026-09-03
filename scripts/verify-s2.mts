// S2's done-when, against the REAL database — push, reconcile, and the two
// failures that matter: a moment logged elsewhere while this client was not
// listening, and unpushed local writes surviving a reconcile.
//
// Writes to the live project and cleans up after itself.
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

// A FIXED id, not a random one. Every run previously minted a fresh UUID and
// pushed a device row that cleanup never removed, so the production table
// slowly filled with test devices — which is exactly what the owner then found.
// Reusing one id makes re-runs idempotent, and updated_by marks it as script
// litter rather than a real phone, which is what that column is for.
const TEST_DEVICE = '00000000-0000-4000-8000-0000000d0d0d'
const store = new Map<string, string>([['babyliana.device_id', TEST_DEVICE]])
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage
// node 22 has a read-only navigator; sync() checks navigator.onLine
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })

const { BABY_ID } = await import('../src/config.ts')
const { ensureThisDevice, logMoment, getMoments, removeMoment } = await import('../src/moments.ts')
const { sync } = await import('../src/sync.ts')
const { supabase } = await import('../src/supabase.ts')
const dbmod = await import('../src/db.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const sb = supabase!
const made: string[] = [] // timeslot ids to clean up

try {
  await ensureThisDevice()
  await sync()
  await sb.from('device').update({ updated_by: 'verify-s2' }).eq('id', TEST_DEVICE)
  check('device reached the server',
    !!(await sb.from('device').select('id').eq('id', TEST_DEVICE)).data?.length)

  // 1. push
  const m = await logMoment({
    entries: [
      { type: 'feed', volume_ml: 25, source: 'breast_milk' },
      { type: 'feed', volume_ml: 45, source: 'formula' },
    ],
  })
  made.push(m.timeslot.id)
  check('outbox holds the write before sync', (await dbmod.outbox()).length === 3)
  await sync()
  check('outbox drains after sync', (await dbmod.outbox()).length === 0)

  const remote = await sb.from('event').select('*').eq('timeslot_id', m.timeslot.id)
  check('split feed reached the server as two rows', remote.data?.length === 2)

  // 2. a moment created elsewhere, while this client was not listening
  const otherTs = crypto.randomUUID()
  made.push(otherTs)
  await sb.from('timeslot').insert({
    id: otherTs,
    baby_id: BABY_ID,
    logged_by: TEST_DEVICE,
    occurred_at: new Date().toISOString(),
  })
  await sb.from('event').insert({
    id: crypto.randomUUID(),
    timeslot_id: otherTs,
    type: 'feed',
    volume_ml: 60,
    source: 'formula',
  })
  check('not local yet', !(await getMoments()).some((x) => x.timeslot.id === otherTs))
  await sync()
  check('reconcile pulls what was logged elsewhere',
    (await getMoments()).some((x) => x.timeslot.id === otherTs))

  // 3. THE HAZARD: a local write must survive a reconcile that would replace
  //    local state wholesale
  const pending = await logMoment({ entries: [{ type: 'feed', volume_ml: 31, source: 'unknown' }] })
  made.push(pending.timeslot.id)
  const before = (await getMoments()).length
  await sync() // pushes, then reconciles — must not lose it
  const after = await getMoments()
  check('unpushed local write survives a reconcile',
    after.some((x) => x.timeslot.id === pending.timeslot.id), `${before} -> ${after.length}`)

  // 4. hard delete propagates by absence
  await sb.from('timeslot').delete().eq('id', otherTs)
  await sync()
  check('a delete elsewhere is noticed by its absence',
    !(await getMoments()).some((x) => x.timeslot.id === otherTs))

  // 5. deleting locally reaches the server
  await removeMoment(pending.timeslot.id)
  await sync()
  const gone = await sb.from('timeslot').select('id').eq('id', pending.timeslot.id)
  check('a local delete reaches the server', gone.data?.length === 0)
} finally {
  // Timeslots first — device is `on delete restrict` and will refuse while any
  // moment still points at it.
  for (const id of made) await sb.from('timeslot').delete().eq('id', id)
  await sb.from('device').delete().eq('id', TEST_DEVICE)
  const [ts, dev] = await Promise.all([
    sb.from('timeslot').select('id').eq('baby_id', BABY_ID),
    sb.from('device').select('id').eq('updated_by', 'verify-s2'),
  ])
  console.log(
    `\n  cleanup: ${ts.data?.length ?? '?'} timeslots, ${dev.data?.length ?? '?'} test devices left`,
  )
}

console.log(failures === 0 ? '  all checks passed' : `  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
