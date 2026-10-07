import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp, recordPushes, TEST_BABY } from './ui.mts'

// The cloud says what it means (D-067). Three things, each of which used to be
// impossible: tapping the cloud explains it, the add sheet says where an entry
// will go when sync is down — without stopping it — and a reload is one tap.
//
// The failure is real, not mocked state: `enterApp` aborts every Supabase call
// it does not stub, so the first pull fails exactly as it would on a phone the
// server refuses. That is also why the trail is worth checking across a reload
// — the reload is the cure, and it must not wipe the record of the disease.
const PORT = 4207
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { stdio: 'ignore', detached: true })
const stop = () => { try { process.kill(-server.pid!) } catch { /* already gone */ } }
process.on('exit', stop)
for (let i = 0; ; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break } catch {
    if (i > 40) throw new Error('vite preview did not come up')
    await new Promise((r) => setTimeout(r, 250))
  }
}

const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true })
const p = await ctx.newPage()
await p.route('**://*.supabase.co/**', (r) => r.abort())
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
await enterApp(p)

let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }
const cloud = () => p.locator('.statusrow .sync.syncbtn')
const cloudState = async () => (await cloud().getAttribute('class')) ?? ''
const waitFor = async (state: string) => {
  for (let i = 0; i < 200 && !(await cloudState()).includes(state); i++) await p.waitForTimeout(100)
}
// Icons are ligatures, so an icon's name is part of its element's innerText.
const text = async (l: import('playwright').Locator) =>
  (await l.innerText()).replace(/\b[a-z]+_[a-z_]+\b/g, '').trim()

// --- a failing sync ---------------------------------------------------------
await waitFor('error')
check('the cloud is red when the server cannot be reached', (await cloudState()).includes('error'), await cloudState())
check('and a reload button sits beside it', await p.getByLabel('reload app').isVisible(), 'visible')

await cloud().click()
await p.waitForTimeout(250)
const sheet = p.getByRole('dialog', { name: 'sync' })
check('tapping the cloud opens the sync sheet', await sheet.isVisible(), 'visible')
check('which names the state in words',
  (await text(sheet.locator('h2'))) === 'not syncing', await text(sheet.locator('h2')))
check('and says what stopped it',
  await sheet.getByText('what stopped it').isVisible(), 'row present')
check('the developer detail is folded away by default',
  !(await sheet.locator('.syncdebug pre').isVisible()), 'collapsed')
await sheet.getByText('details for the developer').click()
const debug = await sheet.locator('.syncdebug pre').innerText()
check('and opens to a report with the state and the trail',
  debug.includes('state: error') && debug.includes('stopped —'), debug.split('\n').slice(0, 3).join(' | '))
const versionRow = await sheet.locator('.setrow', { hasText: 'version' }).innerText()
check('the sheet says which version this is, and when it was built',
  /version\s+([0-9a-f]{7}|local) · built \S/.test(versionRow), versionRow.replace(/\s+/g, ' '))
check('the sheet offers try again and reload',
  (await sheet.getByRole('button', { name: /try again/ }).isVisible())
    && (await sheet.getByRole('button', { name: /reload app/ }).isVisible()), 'both')
await sheet.getByLabel('close').click()
await p.waitForTimeout(200)

// --- the version is in settings too (D-068) -----------------------------------
await p.getByLabel('settings').click()
await p.waitForTimeout(250)
const vline = await p.locator('.versionline').innerText().catch(() => 'missing')
check('settings carries the same version line', /^version ([0-9a-f]{7}|local) · built \S/.test(vline), vline)
await p.getByRole('dialog', { name: 'settings' }).getByLabel('close').click()
await p.waitForTimeout(200)

// --- the add sheet warns and still saves -------------------------------------
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(300)
const warn = p.locator('.syncwarn')
await warn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
check('the add sheet says sync is down', await warn.isVisible(), await text(warn).catch(() => 'missing'))
check('and that the entry is kept on this phone',
  (await warn.innerText()).includes('saves on this phone'), 'wording')
check('the save is not blocked by it', await p.locator('.save').isEnabled(), 'enabled')
await p.locator('.save').click()
await p.waitForTimeout(500)
check('and the entry lands on the list', (await p.locator('.row').count()) >= 1, `${await p.locator('.row').count()} row(s)`)

// --- the reload keeps the trail ---------------------------------------------
await Promise.all([p.waitForEvent('load'), p.getByLabel('reload app').click()])
await p.waitForTimeout(600)
await cloud().click()
await p.waitForTimeout(250)
await p.getByText('details for the developer').click()
const after = await p.locator('.syncdebug pre').innerText()
check('the trail survives the reload that clears the fault',
  after.includes('stopped —'), `${after.split('\n').filter((l) => l.includes('stopped')).length} stop line(s)`)
check('and the entry still waits to be sent',
  (await p.locator('.syncsheet').innerText()).match(/waiting to send\s*\n?\s*[1-9]/) !== null, 'pending > 0')
await p.getByRole('dialog', { name: 'sync' }).getByLabel('close').click()
await p.waitForTimeout(200)

// --- offline is a different red ----------------------------------------------
await ctx.setOffline(true)
await waitFor('offline')
check('offline shows the offline cloud', (await cloudState()).includes('offline'), await cloudState())
check('with no reload button — a reload brings no signal',
  (await p.getByLabel('reload app').count()) === 0, `${await p.getByLabel('reload app').count()}`)
await p.getByLabel('log a moment').click()
await p.locator('.syncwarn').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
check('and the add sheet says offline, not broken',
  (await text(p.locator('.syncwarn'))).startsWith('offline'), await text(p.locator('.syncwarn')))
await p.locator('.sheet').getByLabel('close').click()
await p.waitForTimeout(200)
await ctx.setOffline(false)
// Coming back online starts a sync of its own, which fails against the aborted
// routes. Let it finish before the healthy half takes the routes over.
await p.waitForTimeout(300)
for (let i = 0; i < 200 && (await cloudState()).includes('syncing'); i++) await p.waitForTimeout(100)

// --- and healthy says so, and says nothing in the add sheet -------------------
const pushes = recordPushes(p)
// A healthy server still has the baby. Without it the pull empties the local
// row and the app rightly sends this phone back to "pick a little one".
await p.route('**://*.supabase.co/rest/v1/baby*', (r) =>
  r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: TEST_BABY, name: 'Liana', settings: null }]) })
    : r.fallback())
await cloud().click()
await p.waitForTimeout(200)
await p.getByRole('button', { name: /try again/ }).click()
for (let i = 0; i < 200 && (await text(p.locator('.syncsheet h2'))) !== 'synced'; i++) await p.waitForTimeout(100)
check('a sync that works turns the sheet green',
  (await text(p.locator('.syncsheet h2'))) === 'synced', await text(p.locator('.syncsheet h2')))
check('and sends what was waiting', pushes.length > 0, pushes.join(', ') || 'nothing sent')
await p.getByRole('dialog', { name: 'sync' }).getByLabel('close').click()
await p.waitForTimeout(200)
check('the reload button goes once sync works', (await p.getByLabel('reload app').count()) === 0, 'gone')
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
check('and the add sheet has nothing to warn about', (await p.locator('.syncwarn').count()) === 0, 'no line')

await b.close()
stop()
console.log(fail ? `\n${fail} failed` : '\nall passed')
process.exit(fail ? 1 : 0)
