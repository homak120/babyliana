import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

// The tab bar belongs to the two main screens only.
//
// It is a flex row at the bottom of the shell rather than a fixed overlay, so a
// sheet scrolled to its end put the save button inside the bar's band — 56px of
// overlap on a 56px button, which is why an edit could not be saved.
const PORT = 4195
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
const w = p.getByPlaceholder('Anya')
if (await w.isVisible().catch(() => false)) {
  await w.fill('Anya'); await p.getByRole('button', { name: 'start logging' }).click(); await p.waitForTimeout(400)
}

let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }
const navCount = () => p.locator('nav.tabs').count()

check('the bar is on the log screen', (await navCount()) === 1, 'present')

// --- add sheet ---
await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ milk' }).click()
await p.waitForTimeout(300)
check('the bar is gone while the add sheet is open', (await navCount()) === 0, 'removed')

await p.evaluate(() => { const s = document.querySelector('.sheet')!; s.scrollTop = s.scrollHeight })
await p.waitForTimeout(300)
const reach = await p.evaluate(() => {
  const save = document.querySelector('.save') as HTMLElement
  const r = save.getBoundingClientRect()
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return { onScreen: r.bottom <= innerHeight && r.top >= 0, topmost: hit === save || save.contains(hit) }
})
check('save is fully on screen when scrolled to the end', reach.onScreen, 'within the viewport')
check('save is the topmost thing at its own centre', reach.topmost, 'nothing covers it')

for (const k of ['6', '0']) await p.getByRole('button', { name: k, exact: true }).click()
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(700)
check('the bar comes back after saving', (await navCount()) === 1, 'restored')
check('and the moment was actually saved', (await p.locator('.row').count()) === 1, `${await p.locator('.row').count()} row`)

// --- confirm sheet ---
const box = (await p.locator('.row.swipeable').first().boundingBox())!
const cdp = await ctx.newCDPSession(p)
const y = box.y + box.height / 2, x0 = box.x + box.width - 30
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
for (let i = 1; i <= 14; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - (150 * i) / 14, y }] })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'delete' }).first().click()
await p.waitForTimeout(300)
check('the bar is gone behind the confirm sheet', (await navCount()) === 0, 'removed')
await p.getByRole('button', { name: 'keep it' }).click()
await p.waitForTimeout(300)
check('and returns when it closes', (await navCount()) === 1, 'restored')

// --- period picker ---
await p.getByRole('navigation').getByLabel('day', { exact: true }).click()
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'more' }).click()
await p.waitForTimeout(300)
check('the bar is gone behind the period picker', (await navCount()) === 0, 'removed')

await b.close()
stop()
console.log(fail === 0 ? '\n  the bar stays out of every sheet' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
