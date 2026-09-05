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

await b.close()
stop()
console.log(fail === 0 ? '\n  periods read back on both screens' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
