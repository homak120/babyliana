// ⚠ This writes to the PRODUCTION database, which now holds real entries.
// Every delete here names an exact id this run created. Never widen one to a
// filter — `delete().eq('baby_id', …)` would take the real log with it.
//
// S2's done-when, against the REAL database — push, reconcile, and the two
// failures that matter: a moment logged elsewhere while this client was not
// listening, and unpushed local writes surviving a reconcile.
//
// Writes to the live project and cleans up after itself.
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { NO_SESSION, restoreSession } from './session.mts'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

// A FIXED id, not a random one. Every run previously minted a fresh UUID and
// pushed a caregiver row that cleanup never removed, so the production table
// slowly filled with test caregivers — which is exactly what the owner then found.
// Reusing one id makes re-runs idempotent, and updated_by marks it as script
// litter rather than a real phone, which is what that column is for.
// Not pre-seeded any more: createThisCaregiver mints the id, because opening the
// app must not. The id it returns is what gets used and cleaned up.
let TEST_CAREGIVER = ''
const store = new Map<string, string>()
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

const { createThisCaregiver, logMoment, getMoments, removeMoment } = await import('../src/moments.ts')
const { sync } = await import('../src/sync.ts')
const { supabase } = await import('../src/supabase.ts')
const { setBabyId, fetchBabies } = await import('../src/household.ts')
const dbmod = await import('../src/db.ts')

// `app` answers nothing without a session, and the baby id is no longer a
// constant — it arrives from a join now (D-057). Both come from the sign-in that
// `npm run auth-check` did once, interactively.
if (!(await restoreSession(supabase!))) { console.log(NO_SESSION); process.exit(1) }

const babies = await fetchBabies()
if (!babies?.length) {
  console.log('\n  signed in, but this household has no baby. Create one in the app first.\n')
  process.exit(1)
}
// The first one. This suite writes real rows into a real log and cleans up after
// itself by exact id — which is exactly why it must not invent a baby of its own
// and leave it behind.
const BABY_ID = babies[0].id
setBabyId(BABY_ID)

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}
const sb = supabase!
const made: string[] = [] // timeslot ids to clean up

try {
  TEST_CAREGIVER = await createThisCaregiver('verify')
  await sync()
  await sb.from('caregiver').update({ updated_by: 'verify-s2' }).eq('id', TEST_CAREGIVER)
  check('caregiver reached the server',
    !!(await sb.from('caregiver').select('id').eq('id', TEST_CAREGIVER)).data?.length)

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
    logged_by: TEST_CAREGIVER,
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
  // --- shared settings ride on the baby row (D-052) -------------------------
  // The one check that goes red when `0006` has not been applied, which is what
  // `verify-s2` is for: a client naming a column the database does not have
  // stalls its outbox, and this says so before a phone does.
  const wasSet = await sb.from('baby').select('settings').eq('id', BABY_ID).single()
  check('the baby row carries a settings column', !wasSet.error,
    wasSet.error?.message ?? 'present')

  if (!wasSet.error) {
    const probe = [{ id: 'day', from: 360, to: 1320, gap: 195 }]
    const wrote = await sb.from('baby')
      .update({ settings: { cycles: probe } }).eq('id', BABY_ID)
    check('a setting can be written to it', !wrote.error, wrote.error?.message ?? 'written')

    // Compared field by field, not as a string: `jsonb` does not preserve key
    // order, and `{id, from, to, gap}` comes back as `{id, to, gap, from}`.
    // The app compares the same way for the same reason (`same` in cycles.ts).
    const read = await sb.from('baby').select('settings').eq('id', BABY_ID).single()
    const got = read.data?.settings?.cycles?.[0]
    check('and comes back saying the same thing',
      got?.id === probe[0].id && got?.from === probe[0].from
      && got?.to === probe[0].to && got?.gap === probe[0].gap,
      JSON.stringify(read.data?.settings))

    // The reason it is an object and not a column: a second setting must not
    // take the first with it. `saveSetting` merges, and this is the shape that
    // merge produces.
    const merged = { ...(read.data?.settings ?? {}), somethingElse: 'kept' }
    await sb.from('baby').update({ settings: merged }).eq('id', BABY_ID)
    const both = await sb.from('baby').select('settings').eq('id', BABY_ID).single()
    check('a second setting sits beside the first rather than replacing it',
      both.data?.settings?.cycles?.[0]?.gap === probe[0].gap
      && both.data?.settings?.somethingElse === 'kept',
      JSON.stringify(both.data?.settings))

    // Put back exactly what was there — including `null`, which is what the
    // column holds until someone opens a settings screen for real.
    await sb.from('baby').update({ settings: wasSet.data?.settings ?? null }).eq('id', BABY_ID)
    const restored = await sb.from('baby').select('settings').eq('id', BABY_ID).single()
    check('and the real value is put back',
      JSON.stringify(restored.data?.settings) === JSON.stringify(wasSet.data?.settings ?? null),
      JSON.stringify(restored.data?.settings))
  }
} finally {
  // Timeslots first — caregiver is `on delete restrict` and will refuse while any
  // moment still points at it.
  for (const id of made) await sb.from('timeslot').delete().eq('id', id)
  await sb.from('caregiver').delete().eq('id', TEST_CAREGIVER)
  const [ts, dev] = await Promise.all([
    sb.from('timeslot').select('id').in('id', made),
    sb.from('caregiver').select('id').eq('updated_by', 'verify-s2'),
  ])
  console.log(
    `\n  cleanup: ${ts.data?.length ?? '?'} of this run's timeslots, ` +
      `${dev.data?.length ?? '?'} test caregivers left`,
  )
}

console.log(failures === 0 ? '  all checks passed' : `  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
