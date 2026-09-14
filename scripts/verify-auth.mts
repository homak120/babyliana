// ⚠ Interactive, and NOT part of `npm run verify`.
//
// It needs a human with an inbox, so it cannot run in a suite. That is also the
// point: it is the only check that can catch the Magic Link template still
// mailing a link instead of a code, because the API reports success either way
// and only a person reading the email knows which arrived.
//
// Run it with:  npm run auth-check
//
// **What it touches.** It signs in for real, which creates a real `auth.users`
// row for the address you give it — intended, that is your household account,
// and it is not cleaned up. Everything else it writes lives in `app` and is
// deleted in the `finally` block. It never touches `public`, so the two phones
// cannot be affected by anything here.
//
// Proves, in order: the dashboard configuration, the schema exposure, the
// grants, the policies, the foreign key chain, and — last and most important —
// that an unauthenticated client can read nothing at all (D-057).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

// supabase-js persists the session to localStorage. Node has none, and the
// library falls back to memory — fine for a one-shot script, and it means this
// run cannot disturb a session anywhere else.
const url = process.env.VITE_SUPABASE_URL!
const key = process.env.VITE_SUPABASE_ANON_KEY!

const { sendCode, verifyCode, currentUserId, signOut } = await import('../src/auth.ts')

// Its own client, pointed at `app`. src/supabase.ts still targets `public` at
// this point in the migration, and this script must not be the thing that
// changes that — the schema flip is its own step, with its own diff.
const app = createClient(url, key, { db: { schema: 'app' } })

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const babyId = { id: '' }
const caregiverId = crypto.randomUUID()
const timeslotId = crypto.randomUUID()
const eventId = crypto.randomUUID()

try {
  const email = (await rl.question('\n  household email: ')).trim()
  if (!email.includes('@')) { console.log('  not an email address'); process.exit(1) }

  // 1. the dashboard
  const sent = await sendCode(email)
  check('a code was requested without error', sent.ok, sent.ok ? '' : sent.message)
  if (!sent.ok) throw new Error('cannot continue without a code')

  // One prompt, not two.
  //
  // This asked "code or link?" and *then* asked for the code. The first person
  // to run it pasted the code into the first question — which is the obvious
  // move when the line above says "check the inbox" — and got told the template
  // was broken when it was working perfectly.
  //
  // Ask for the thing you want. Name the failure as the escape hatch. Then the
  // natural answer cannot be the wrong one.
  const answer = (await rl.question(
    '\n  check the inbox.\n' +
    '  paste the 6-digit code — or type LINK if the email had a clickable link: ',
  )).trim()

  const isLink = /^link$/i.test(answer)
  check('the email carries a code, not a link', !isLink,
    'the template still sends {{ .ConfirmationURL }} — edit BOTH "Magic Link" and ' +
    '"Confirm signup" to use {{ .Token }}')
  if (isLink) throw new Error('fix the templates, then run this again')

  // Not six exactly: the length is Supabase's to choose and has changed before.
  // Digits and a sane length is the real test, and saying what arrived beats
  // "invalid input" when someone pastes a whole line of the email by accident.
  if (!/^\d{4,10}$/.test(answer)) {
    check('that looks like a code', false,
      `got "${answer}" — expected digits, or the word LINK`)
    throw new Error('nothing to verify')
  }
  const code = answer
  const got = await verifyCode(email, code)
  check('the code was accepted', got.ok, got.ok ? '' : got.message)
  if (!got.ok) throw new Error('no session')

  const uid = await currentUserId()
  check('a session exists and carries a user id', !!uid)

  // The script's own client has no session — auth.ts signed in on the client
  // inside src/supabase.ts. Hand the token over so `app` requests run as this
  // user rather than as anon.
  const { supabase } = await import('../src/supabase.ts')
  const session = (await supabase!.auth.getSession()).data.session!
  await app.auth.setSession(session)

  // 2. the schema is reachable at all
  const reach = await app.from('baby').select('id').limit(1)
  check('the `app` schema is exposed to the Data API', !reach.error,
    reach.error ? `${reach.error.code} ${reach.error.message}` : '')
  if (reach.error?.code === 'PGRST106')
    console.log('        → Settings → API → Exposed schemas: add `app`')

  // 3. create_baby writes the baby and the membership together
  const made = await app.rpc('create_baby', { baby_name: 'Verify' })
  check('create_baby() returned an id', !made.error && !!made.data,
    made.error ? made.error.message : '')
  babyId.id = made.data ?? ''

  // 4. RLS lets this household see exactly its own baby and nothing else
  const mine = await app.from('baby').select('id')
  check('the new baby is visible to its household',
    !!mine.data?.some((b: { id: string }) => b.id === babyId.id))
  check('and nothing else is', (mine.data?.length ?? 0) === 1,
    `${mine.data?.length} rows came back`)

  // 5. the foreign key chain, caregiver → timeslot → event
  const cg = await app.from('caregiver')
    .insert({ id: caregiverId, name: 'Verify', user_id: uid, updated_by: 'verify-auth' })
  check('a caregiver row inserts against this household', !cg.error,
    cg.error ? cg.error.message : '')

  const ts = await app.from('timeslot').insert({
    id: timeslotId, baby_id: babyId.id, logged_by: caregiverId,
    occurred_at: new Date().toISOString(), updated_by: 'verify-auth',
  })
  check('a timeslot inserts against the baby and the caregiver', !ts.error,
    ts.error ? ts.error.message : '')

  const ev = await app.from('event').insert({
    id: eventId, timeslot_id: timeslotId, type: 'feed',
    volume_ml: 60, source: 'formula', updated_by: 'verify-auth',
  })
  check('an event inserts against the timeslot', !ev.error, ev.error ? ev.error.message : '')

  // The event policy is two hops — event → timeslot → membership. It is the
  // only one that could pass on write and fail on read.
  const back = await app.from('event').select('id,volume_ml').eq('id', eventId)
  check('and reads back through the two-hop policy',
    back.data?.[0]?.volume_ml === 60, JSON.stringify(back.data))

  // 6. **The one that matters.** A client with no session must see nothing.
  // This is the whole of D-057: `public` fails this test today by design, and
  // `app` has to pass it before anyone outside this family can sign up.
  const anon = createClient(url, key, {
    db: { schema: 'app' },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const [ab, at, ae] = await Promise.all([
    anon.from('baby').select('id'),
    anon.from('timeslot').select('id'),
    anon.from('event').select('id'),
  ])
  const leaked = (ab.data?.length ?? 0) + (at.data?.length ?? 0) + (ae.data?.length ?? 0)
  check('an unauthenticated client reads NOTHING from `app`', leaked === 0,
    `${leaked} rows came back to anon — the isolation is not there`)
} catch (e) {
  console.log(`\n  stopped: ${e instanceof Error ? e.message : String(e)}`)
} finally {
  // Events cascade from the timeslot, but delete them explicitly anyway: if the
  // timeslot delete is what failed, the cascade never ran and a silent orphan is
  // worse than a second delete.
  await app.from('event').delete().eq('id', eventId)
  await app.from('timeslot').delete().eq('id', timeslotId)
  if (babyId.id) await app.from('baby').delete().eq('id', babyId.id)
  await app.from('caregiver').delete().eq('id', caregiverId)
  const left = await app.from('baby').select('id').eq('id', babyId.id || crypto.randomUUID())
  console.log(`\n  cleanup: ${left.data?.length ?? 0} of this run's babies left`)
  await signOut()
  rl.close()
}

console.log(failures === 0
  ? '\n  all checks passed — stage 1 is done\n'
  : `\n  ${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
