import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, devices } from 'playwright'

// First run is four steps now: email, code, which baby, which caregiver. The
// gate and both its codes are gone (D-059) — the household email plus an
// expiring OTP is the same idea done properly.
//
// **Everything Supabase is stubbed here.** These suites serve their own build
// and touch no database, and an emailed code is not something a browser test can
// read regardless. What is under test is the flow: which screen follows which,
// what each one refuses, and — the point of the whole thing — that picking an
// existing caregiver adopts that exact id rather than minting a second one.
const PORT = 4197
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { stdio: 'ignore', detached: true })
const stop = () => { try { process.kill(-server.pid!) } catch { /* already gone */ } }
process.on('exit', stop)
for (let i = 0; ; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break } catch {
    if (i > 40) throw new Error('vite preview did not come up')
    await new Promise((r) => setTimeout(r, 250))
  }
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
)
const REF = (env.VITE_SUPABASE_URL ?? '').replace(/^https:\/\//, '').split('.')[0]

const b = await chromium.launch()
let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }

const json = (body: unknown) => ({
  status: 200, contentType: 'application/json', body: JSON.stringify(body),
})

async function fresh(clockHour: number) {
  const ctx = await b.newContext({
    ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true,
  })
  const p = await ctx.newPage()
  // Everything not explicitly stubbed below fails, so a screen that quietly
  // depends on a call nobody noticed shows up as a failure rather than as a
  // pass that happened to work against a live server.
  await p.route('**://*.supabase.co/**', (r) => r.abort())
  await p.addInitScript((h) => {
    const real = Date
    const fixed = new real(); fixed.setHours(h, 0, 0, 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = class extends real {
      constructor(...a: unknown[]) { super(...(a.length ? a : [fixed]) as []) }
      static now() { return fixed.getTime() }
    }
  }, clockHour)
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
  return { ctx, p }
}

/** Seed the session supabase-js reads, so a run can start at a later step. */
const signedIn = (p: import('playwright').Page, babyId?: string) =>
  p.evaluate(([ref, baby]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 31536000,
      user: { id: '55555555-6666-7777-8888-999999999999', email: 'test@example.com' },
    }))
    if (baby) localStorage.setItem('babyliana.baby_id', baby)
  }, [REF, babyId ?? ''] as const)

// --- the email step ---------------------------------------------------------
const { ctx, p } = await fresh(10)
check('first run opens on the email step', await p.locator('#email').isVisible(), 'step one')
check('and there is no secret code to guess any more',
  (await p.locator('#code').count()) === 0, 'D-059: the gate is gone')
check('the button waits for something that looks like an address',
  await p.locator('.save').isDisabled(), 'disabled')

// D-030 put a real photograph of the baby on the first screen, when only this
// family had the URL. Open signup makes that the first thing a stranger sees.
check('no photograph of a real child is shipped to first run',
  (await p.locator('.gatephoto').count()) === 0, 'mascot only')

await p.locator('#email').fill('someone@example.com')
check('and enables once it does', !(await p.locator('.save').isDisabled()), 'enabled')

// --- the code step ----------------------------------------------------------
await p.route('**://*.supabase.co/auth/v1/otp*', (r) => r.fulfill(json({})))
await p.locator('.save').click()
await p.waitForTimeout(500)
check('sending the code moves to the code step', await p.locator('#code').isVisible(), 'step two')
check('and the address is shown, so a typo is visible',
  (await p.locator('.sub').innerText()).includes('someone@example.com'),
  await p.locator('.sub').innerText())
check('the button waits for all six digits', await p.locator('.save').isDisabled(), 'disabled')

await p.locator('#code').fill('000000')
await p.route('**://*.supabase.co/auth/v1/verify*', (r) =>
  r.fulfill({ status: 403, contentType: 'application/json',
    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Token has expired or is invalid' }) }))
await p.locator('.save').click()
await p.waitForTimeout(600)
check('a wrong code is refused, in words a person can act on',
  (await p.locator('.gateerr').innerText()).includes('expired'),
  await p.locator('.gateerr').innerText())
check('and it stays on the code step', await p.locator('#code').isVisible(), 'still step two')
check('with a way back to fix the address',
  (await p.getByRole('button', { name: /different email/ }).count()) === 1, 'escape hatch')
await ctx.close()

// --- one baby is not a choice ----------------------------------------------
const ONE = '11111111-aaaa-bbbb-cccc-222222222222'
const solo = await fresh(10)
await solo.p.route('**://*.supabase.co/rest/v1/baby*', (r) =>
  r.fulfill(json([{ id: ONE, name: 'Liana', settings: null }])))
await solo.p.route('**://*.supabase.co/rest/v1/caregiver*', (r) => r.fulfill(json([])))
await signedIn(solo.p)
await solo.p.reload({ waitUntil: 'load' })
await solo.p.waitForTimeout(900)
check('a household with one baby is not asked to pick it',
  (await solo.p.locator('.devlist').count()) === 0, 'skipped the picker')
check('and it is remembered, so the next launch does not ask either',
  (await solo.p.evaluate(() => localStorage.getItem('babyliana.baby_id'))) === ONE, ONE)
check('landing instead on the name, because this household has no caregivers yet',
  await solo.p.getByPlaceholder('Anya').isVisible(), 'step four')
await solo.ctx.close()

// --- the art sets -----------------------------------------------------------
// Both themes draw the night set while `DAY_ART_IN_USE` is false — the owner is
// trying one character across the whole day. This asserts the switch is off
// rather than that the day art is gone: nothing was deleted, and the day set
// comes back by flipping that one flag.
const srcOf = (p: import('playwright').Page) =>
  p.evaluate(() => (document.querySelector('.mascot source') as HTMLSourceElement).srcset)
const day = await fresh(10)
const daySrc = await srcOf(day.p)
check('the day theme draws the night art too', !/-day/.test(daySrc), daySrc.split('/').pop() ?? '')
await day.ctx.close()

const night = await fresh(23)
const nightSrc = await srcOf(night.p)
check('the night theme uses the night art', !/-day/.test(nightSrc), nightSrc.split('/').pop() ?? '')
check('and both themes land on the same file', daySrc === nightSrc, `${daySrc} vs ${nightSrc}`)
await night.ctx.close()

// --- picking who you are ----------------------------------------------------
// What `RECOVERY_CODE` existed for, now an ordinary step. A reinstalled phone
// must take its own identity back rather than minting a second "Dad" and
// attributing every entry after it to a stranger with the same name.
const ID = '11111111-2222-3333-4444-555555555555'
const rec = await fresh(10)
await rec.p.route('**://*.supabase.co/rest/v1/baby*', (r) =>
  r.fulfill(json([{ id: ONE, name: 'Liana', settings: null }])))
await rec.p.route('**://*.supabase.co/rest/v1/caregiver*', (r) => r.fulfill(json([
  { id: ID, name: 'Ho', created_at: null, updated_at: null, updated_by: null, user_id: null },
  { id: '99999999-8888-7777-6666-555555555555', name: 'Anya', created_at: null, updated_at: null, updated_by: null, user_id: null },
])))
await signedIn(rec.p, ONE)
await rec.p.reload({ waitUntil: 'load' })
await rec.p.waitForTimeout(900)

const names = await rec.p.locator('.devlist b').allInnerTexts()
check('every caregiver in the household is offered, by name',
  names.length === 2 && names.includes('Ho') && names.includes('Anya'), names.join(', '))
check('and each carries enough of its id to tell two apart',
  (await rec.p.locator('.devlist span').first().innerText()).includes('…'),
  await rec.p.locator('.devlist span').first().innerText())
check('with a way to be someone the list does not have',
  (await rec.p.getByRole('button', { name: /someone new/ }).count()) === 1, 'escape hatch')

await rec.p.getByRole('button', { name: /Ho/ }).click()
await rec.p.waitForTimeout(900)
const stored = await rec.p.evaluate(() => localStorage.getItem('babyliana.caregiver_id'))
check('picking one adopts that exact id rather than minting a new one',
  stored === ID, `${stored} vs ${ID}`)
check('and it lands in the app, with no name page in between',
  (await rec.p.locator('.log').count()) === 1 && (await rec.p.getByPlaceholder('Anya').count()) === 0,
  `${await rec.p.locator('.log').count()} log screen(s)`)
const status = await rec.p.locator('.statusrow').innerText().catch(() => '')
check('and the app already knows whose phone this is',
  status.includes('edit'), status.replace(/\n/g, ' ') || '(no status row)')
await rec.ctx.close()

await b.close()
stop()
console.log(fail === 0 ? '\n  welcome and the art sets are right\n' : `\n  ${fail} FAILED\n`)
process.exit(fail === 0 ? 0 : 1)
