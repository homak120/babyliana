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

const cdp = await ctx.newCDPSession(p)
// Which list is under test. The home screen is here because it never had the
// gesture at all — D-025 only specified the day view — and four fixes were shipped
// against the day view while the owner was swiping this one.
let SEL = '.row.swipeable'

const offset = () =>
  p.evaluate((sel) => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector(sel)!).transform)
    return Math.round(m.m41)
  }, SEL)

async function drag(dx: number, dy: number, steps = 14) {
  const box = (await p.locator(SEL).first().boundingBox())!
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

async function suite(label: string) {
  await drag(-150, 0)
  check(`${label}: horizontal swipe opens`, (await offset()) === -176, `offset ${await offset()}`)
  check(`${label}: edit visible`, await p.getByRole('button', { name: 'edit' }).first().isVisible(), 'rendered')
  check(`${label}: delete visible`, await p.getByRole('button', { name: 'delete' }).first().isVisible(), 'rendered')

  await drag(150, 0)
  check(`${label}: swiping back closes`, (await offset()) === 0, `offset ${await offset()}`)

  // A short horizontal move must spring back, not stick open.
  await drag(-25, 0)
  check(`${label}: short swipe springs back`, (await offset()) === 0, `offset ${await offset()}`)

  // A thumb arcs. This is the shape that a first-pixel axis lock got wrong.
  await drag(-150, -40)
  check(`${label}: arcing swipe still opens`, (await offset()) === -176, `offset ${await offset()}`)
  await drag(150, 0)

  // The one the axis lock is there to protect.
  await p.setViewportSize({ width: 390, height: 420 })
  await p.waitForTimeout(200)
  const before = await p.evaluate(() => window.scrollY)
  await drag(-30, -260)
  const after = await p.evaluate(() => window.scrollY)
  check(`${label}: vertical drag does not open`, (await offset()) === 0, `offset ${await offset()}`)
  check(`${label}: vertical drag still scrolls`, after > before, `scrollY ${before} -> ${after}`)
  await p.setViewportSize({ width: 390, height: 844 })
  await p.waitForTimeout(200)
}

await suite('home')

SEL = '.trow.swipeable'
await p.getByRole('navigation').getByLabel('day').click()
await p.waitForTimeout(600)
await suite('day')

await p.screenshot({ path: 'scripts/shots/swipe-check.png' })
await b.close()
stop()
console.log(fail === 0 ? '\n  all swipe checks pass' : `\n  ${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
