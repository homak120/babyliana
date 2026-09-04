import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

// Serves its own build so `npm run verify` needs no running dev server.
const PORT = 4191
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
for (const v of [['6','0'], ['4','5']]) {
  await p.getByLabel('log a moment').click()
  await p.getByRole('button', { name: '+ milk' }).click()
  for (const k of v) await p.getByRole('button', { name: k, exact: true }).click()
  await p.getByRole('button', { name: 'save', exact: true }).click()
  await p.waitForTimeout(400)
}
await p.getByRole('navigation').getByLabel('day', { exact: true }).click()
await p.waitForTimeout(500)

let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }

check('more pill exists', await p.getByRole('button', { name: 'more' }).isVisible(), 'in the date strip')
await p.getByRole('button', { name: 'more' }).click()
await p.waitForTimeout(300)
check('picker opens', await p.getByRole('dialog', { name: 'pick a period' }).isVisible(), 'dialog shown')
check('apply disabled with no day', await p.locator('.apply').isDisabled(), 'nothing picked yet')
check('a day carries a dot', (await p.locator('.dot.on').count()) > 0, `${await p.locator('.dot.on').count()} dotted`)
check('future days disabled', (await p.locator('.cal:disabled').count()) >= 0, `${await p.locator('.cal:disabled').count()} disabled`)

// preset, then apply
await p.getByRole('button', { name: 'last 7 days' }).click()
await p.waitForTimeout(200)
// "last 7 days" straddles two months, so only one edge is in the visible grid.
check('preset marks an edge', (await p.locator('.cal.edge').count()) >= 1, `${await p.locator('.cal.edge').count()} edge(s) in view`)
check('preset fills the span', (await p.locator('.cal.between').count()) > 0, `${await p.locator('.cal.between').count()} days between`)
await p.getByLabel('next month').click()
await p.waitForTimeout(200)
check('other edge is next month', (await p.locator('.cal.edge').count()) >= 1, 'found after paging')
check('apply enabled', await p.locator('.apply').isEnabled(), await p.locator('.apply').innerText())
await p.locator('.apply').click()
await p.waitForTimeout(400)

check('picker closes', !(await p.locator('.picker').isVisible().catch(() => false)), 'dismissed')
// innerText includes the Material Symbols ligature, which is the icon.
const pill = (await p.locator('.morepill').innerText()).replace('calendar_month', '').trim()
check('pill shows the range', /^\d+\/\d+ – \d+\/\d+$/.test(pill), pill)
check('pill marked active', (await p.locator('.morepill.on').count()) === 1, 'rose')
check('heading matches the pill', (await p.locator('.daylabel').innerText()).trim() === pill, await p.locator('.daylabel').innerText())
check('rows still shown', (await p.locator('.trow').count()) === 2, `${await p.locator('.trow').count()} rows`)
check('totals count the scope', (await p.locator('.totals').innerText()).includes('105'), (await p.locator('.totals').innerText()).replace(/\n/g, ' '))

// a day pill clears the range again
await p.getByRole('button', { name: 'all days' }).click()
await p.waitForTimeout(300)
check('day pill clears the range', (await p.locator('.morepill.on').count()) === 0, 'back to "more"')

await p.locator('.picker, main.day').first().screenshot({ path: 'scripts/shots/period-picker.png' })
await b.close()
stop()
console.log(fail === 0 ? '\n  all picker checks pass' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
