// Drive the deployed staging app through onboarding and report what the network
// actually did. A debugging tool, not a suite — it hits the real server, writes
// real rows, and cleans up nothing.
//
// It does not sign in. `npm run auth-check` does that interactively, and leaves
// a real session in .auth-session.json; this seeds that session into the browser
// and starts from there. So the OTP is typed by a person, once, in a terminal —
// never into a form by a script.
//
// Run:  npx tsx scripts/inspect-onboarding.mts
import { existsSync, readFileSync } from 'node:fs'
import { chromium, devices } from 'playwright'

const URL = 'https://babylianav2.vercel.app'
const BABY = 'Liana'
const CAREGIVER = 'Dad'

if (!existsSync('.auth-session.json')) {
  console.log('\n  no .auth-session.json — run `npm run auth-check` first\n')
  process.exit(1)
}
const session = JSON.parse(readFileSync('.auth-session.json', 'utf8'))
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], m[2]]),
)
const REF = (env.VITE_SUPABASE_URL ?? '').replace(/^https:\/\//, '').split('.')[0]

const b = await chromium.launch()
const ctx = await b.newContext({
  ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true,
})
const p = await ctx.newPage()

const log: string[] = []
p.on('console', (m) => {
  if (m.type() === 'error' || m.text().includes('[babyliana]')) log.push(`  console  ${m.text()}`)
})
p.on('pageerror', (e) => log.push(`  pageerror  ${String(e)}`))

// The whole point: a 4xx from PostgREST carries a JSON body naming the cause,
// and the status alone does not distinguish "not signed in" from "the policy
// refused this row" — which need opposite fixes.
p.on('response', async (r) => {
  if (!r.url().includes('supabase.co')) return
  const bad = r.status() >= 400
  const line = `  ${r.status()}  ${r.request().method()} ${r.url().replace(/^https:\/\/[^/]+/, '')}`
  if (!bad) { log.push(line); return }
  const auth = await r.request().headerValue('authorization') ?? ''
  const kind = auth.startsWith('Bearer eyJ') ? 'JWT (signed in)'
    : auth.includes('publishable') || auth.includes('anon') ? 'PUBLISHABLE KEY (anon!)' : auth.slice(0, 20)
  const body = await r.text().catch(() => '(no body)')
  log.push(`${line}\n      authorization: ${kind}\n      body: ${body.slice(0, 400)}`)
})

const shot = async (n: string) => {
  await p.screenshot({ path: `scripts/shots/onboard-${n}.png` })
  log.push(`  --- ${n}: ${(await p.locator('h1').innerText().catch(() => '(no h1)')).replace(/\n/g, ' ')}`)
}

await p.goto(URL, { waitUntil: 'load' })
await p.evaluate(([ref, s]) => {
  const saved = s as { expires_at?: number }
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
    ...(saved as object), token_type: 'bearer',
    // The real expiry, not an invented one. Overstating it means supabase-js
    // uses a dead access token instead of refreshing, and the 401 that follows
    // looks like a permissions problem rather than a stale token.
    expires_at: saved.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  }))
}, [REF, session] as const)
await p.reload({ waitUntil: 'load' })
await p.waitForTimeout(2500)
await shot('1-resumed')

// baby
const babyField = p.locator('#babyname')
if (await babyField.isVisible().catch(() => false)) {
  await babyField.fill(BABY)
  await p.getByRole('button', { name: /start the log/ }).click()
  await p.waitForTimeout(3000)
}
await shot('2-after-baby')

// caregiver
const nameField = p.locator('#yourname')
if (await nameField.isVisible().catch(() => false)) {
  await nameField.fill(CAREGIVER)
  await p.getByRole('button', { name: /start logging/ }).click()
  await p.waitForTimeout(4000)
}
await shot('3-after-caregiver')

log.push(`  localStorage baby_id   ${await p.evaluate(() => localStorage.getItem('babyliana.baby_id'))}`)
log.push(`  localStorage caregiver ${await p.evaluate(() => localStorage.getItem('babyliana.caregiver_id'))}`)
log.push(`  button disabled?       ${await p.locator('.save').isDisabled().catch(() => '(no button)')}`)
log.push(`  on screen              ${(await p.locator('main').innerText().catch(() => '')).slice(0, 300).replace(/\n/g, ' / ')}`)

console.log('\n' + log.join('\n') + '\n')
await ctx.close(); await b.close()
