import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

// What this can and cannot prove: CDP touch goes through Chromium's real input
// pipeline, so it catches wiring and logic. It does NOT reproduce iOS's gesture
// arbitration, which is what actually broke the swipe on the owner's phone
// twice. A pass here is necessary, never sufficient.
// Serves its own build so `npm run verify` needs no running dev server.
const PORT = 4189
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  stdio: 'ignore',
  detached: true,
})
const stop = () => { try { process.kill(-server.pid!) } catch { /* already gone */ } }
process.on('exit', stop)

for (let i = 0; ; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`)
    break
  } catch {
    if (i > 40) throw new Error('vite preview did not come up')
    await new Promise((r) => setTimeout(r, 250))
  }
}

const b = await chromium.launch()
const ctx = await b.newContext({
  ...devices['iPhone 13'],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})
const p = await ctx.newPage()
await p.route('**://*.supabase.co/**', (r) => r.abort())
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })

const welcome = p.getByPlaceholder('Anya')
if (await welcome.isVisible().catch(() => false)) {
  await welcome.fill('Anya')
  await p.getByRole('button', { name: 'start logging' }).click()
  await p.waitForTimeout(400)
}
// Enough rows that a vertical drag has somewhere to scroll to.
for (const vol of [['6', '0'], ['4', '5'], ['3', '1'], ['7', '5'], ['5', '0']]) {
  await p.getByLabel('log a moment').click()
  await p.getByRole('button', { name: '+ milk' }).click()
  for (const k of vol) await p.getByRole('button', { name: k, exact: true }).click()
  await p.getByRole('button', { name: 'save', exact: true }).click()
  await p.waitForTimeout(350)
}
await p.getByRole('navigation').getByLabel('day').click()
await p.waitForTimeout(500)

const cdp = await ctx.newCDPSession(p)
const offset = () =>
  p.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.trow')!).transform)
    return Math.round(m.m41)
  })

async function drag(dx: number, dy: number, steps = 14) {
  const box = (await p.locator('.trow').first().boundingBox())!
  const x0 = box.x + box.width - 30
  const y0 = box.y + box.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(450)
}

let fail = 0
const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label} — ${detail}`)
}

await drag(-150, 0)
check('horizontal swipe opens', (await offset()) === -176, `offset ${await offset()}`)
check('edit visible', await p.getByRole('button', { name: 'edit' }).first().isVisible(), 'rendered')
check('delete visible', await p.getByRole('button', { name: 'delete' }).first().isVisible(), 'rendered')

await drag(150, 0)
check('swiping back closes', (await offset()) === 0, `offset ${await offset()}`)

// A short horizontal move must spring back, not stick open.
await drag(-25, 0)
check('short swipe springs back', (await offset()) === 0, `offset ${await offset()}`)

// The one the axis lock is there to protect.
// Five rows fit an iPhone 13 screen, so the page has nowhere to scroll and the
// check below would pass vacuously. Shrink the viewport instead of logging
// another twenty feeds.
await p.setViewportSize({ width: 390, height: 420 })
await p.waitForTimeout(200)
const page = await p.evaluate(() => ({
  scrollable: document.documentElement.scrollHeight - window.innerHeight,
  rows: document.querySelectorAll('.trow').length,
}))
console.log(`  (page scrollable by ${page.scrollable}px, ${page.rows} rows)`)
const before = await p.evaluate(() => window.scrollY)
await drag(-30, -260)
const after = await p.evaluate(() => window.scrollY)
check('vertical drag does not open', (await offset()) === 0, `offset ${await offset()}`)
check('vertical drag still scrolls', after > before, `scrollY ${before} -> ${after}`)

await p.screenshot({ path: 'scripts/shots/swipe-check.png' })
await b.close()
stop()
console.log(fail === 0 ? '\n  all swipe checks pass' : `\n  ${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
