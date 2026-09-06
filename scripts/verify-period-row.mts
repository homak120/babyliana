import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// A moment with an end time must read back as a period on BOTH screens.
// The home list had its own time formatter that only ever read occurred_at, so
// an end time logged there was invisible until you opened the day view — the
// same shape of bug as the swipe, where the two lists quietly diverged.
const PORT = 4194
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

await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ milk' }).click()
for (const k of ['6', '0']) await p.getByRole('button', { name: k, exact: true }).click()
await p.getByRole('button', { name: /end time/ }).click()
await p.waitForTimeout(250)
// +30 min, so the end differs from the start.
await p.getByRole('button', { name: '+30 min' }).click()
await p.waitForTimeout(200)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(700)

const RANGE = /^\d{2}:\d{2}[–-]\d{2}:\d{2}$/
const homeTime = (await p.locator('.row time').first().innerText()).replace(/\s/g, '')
check('home list shows the period', RANGE.test(homeTime), homeTime)

await p.getByRole('navigation').getByLabel('day', { exact: true }).click()
await p.waitForTimeout(500)
const dayTime = (await p.locator('.ttime').first().innerText()).replace(/\s/g, '')
check('day table shows the period', RANGE.test(dayTime), dayTime)
check('both screens agree', homeTime === dayTime, `${homeTime} vs ${dayTime}`)

// --- and again in 12-hour (D-041) -------------------------------------------
// One formatter feeds every clock time, so the toggle has to reach both lists
// and the period's two ends. The day table's time column is a fixed 62px and
// already wraps `18:23-18:53` onto two lines; `6:23 PM-6:53 PM` must not make
// that worse, which is what the height check is watching.
// Measured here, while the day table is still the screen showing.
const day24 = await p.evaluate(() => {
  const el = document.querySelector('.ttime') as HTMLElement
  return Math.round(el.getBoundingClientRect().height)
})
await p.getByRole('navigation').getByLabel('log', { exact: true }).click()
await p.waitForTimeout(400)
await p.getByLabel('show 12-hour times').click()
await p.waitForTimeout(300)

const AMPM = /^\d{1,2}:\d{2}(AM|PM)[–-]\d{1,2}:\d{2}(AM|PM)$/
const home12 = (await p.locator('.row time').first().innerText()).replace(/\s/g, '')
check('the home list switches to 12-hour', AMPM.test(home12), home12)
check('the hour is not padded', !/^0/.test(home12), home12)

const status = await p.locator('.statusrow span').first().innerText()
check('and so does the status clock', /\d{1,2}:\d{2}\s*(AM|PM)/.test(status), status.replace(/\n/g, ' '))

// The label names the format it switches TO, so it has flipped with the state.
check('the toggle now offers the way back',
  (await p.getByLabel('show 24-hour times').count()) === 1,
  `${await p.getByLabel('show 24-hour times').count()} button(s)`)

// This screen is remounted by `key={saved}` on every save, which is what sank
// the lead rail until it moved to localStorage. The format has to survive it.
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(250)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(800)
const afterSave = (await p.locator('.row time').first().innerText()).replace(/\s/g, '')
check('and it survives a save remounting the screen',
  /(AM|PM)/.test(afterSave), afterSave)

await p.getByRole('navigation').getByLabel('day', { exact: true }).click()
await p.waitForTimeout(500)
const dayRow = await p.evaluate(() => {
  const el = document.querySelector('.ttime') as HTMLElement
  return {
    text: el.innerText.replace(/\s/g, ''),
    h: Math.round(el.getBoundingClientRect().height),
    over: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
  }
})
check('the day table follows the same setting', AMPM.test(dayRow.text), dayRow.text)
check('the time column is no taller than it was at 24h, and nothing overflows',
  dayRow.h <= day24 && dayRow.over === 0,
  `${dayRow.h}px vs ${day24}px at 24h, ${dayRow.over}px overflow`)

await b.close()
stop()
console.log(fail === 0 ? '\n  periods read back on both screens' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
