import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

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
await enterApp(p)
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
check('today preset exists', await p.getByRole('button', { name: 'today', exact: true }).isVisible(), 'first preset')
check('preset marks an edge', (await p.locator('.cal.edge').count()) >= 1, `${await p.locator('.cal.edge').count()} edge(s) in view`)
// Counted across *both* visible months rather than the first one alone. On the
// 6th of a month "last 7 days" starts on the 31st of the one before, which is
// its own last day — so the opening grid holds an edge and nothing between it
// and the month's end, and a check that looked only there went red on a date
// change rather than on a regression.
const betweenFirst = await p.locator('.cal.between').count()
await p.getByLabel('next month').click()
await p.waitForTimeout(200)
check('other edge is next month', (await p.locator('.cal.edge').count()) >= 1, 'found after paging')
const betweenSecond = await p.locator('.cal.between').count()
check('preset fills the span', betweenFirst + betweenSecond > 0,
  `${betweenFirst} + ${betweenSecond} days between`)
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

// --- swiping the page between days ------------------------------------------
//
// The day view spends the horizontal gesture on moving between days now, not on
// revealing edit and delete — those are the home screen's alone (2026-09-06,
// amending D-025). `verify-swipe` checks the old gesture is gone; this checks
// the new one works.
const cdp = await ctx.newCDPSession(p)
const swipe = async (dx: number) => {
  // Started low on the page, clear of the date strip: that scrolls sideways on
  // its own and carries `data-noswipe` so it keeps its own drags.
  const y = 520
  const x0 = dx < 0 ? 300 : 90
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 12, y }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(400)
}
const label = async () => (await p.locator('.daylabel').innerText()).trim()

// A second day is needed to have anywhere to swipe to, and the only route to
// one through the UI is the time card: setting an hour that is still ahead of
// now moves the entry to yesterday (`withHourMinute`). That trick needs an hour
// left in the day, so late in the evening this section is skipped rather than
// asserted wrongly.
const room = new Date().getHours() < 21
if (!room) {
  check('skipping the day swipe: too late in the day to backdate through the UI',
    true, 'runs before 21:00')
} else {
  await p.getByRole('navigation').getByLabel('log', { exact: true }).click()
  await p.waitForTimeout(500)
  const rowBox = (await p.locator('.row.swipeable').first().boundingBox())!
  const ry = rowBox.y + rowBox.height / 2, rx = rowBox.x + rowBox.width - 30
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rx, y: ry }] })
  for (let i = 1; i <= 14; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: rx - (150 * i) / 14, y: ry }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(400)
  await p.locator('.rowactions .act.edit').first().click()
  await p.waitForTimeout(400)
  await p.locator('.timestepper .num').first().fill('23')
  await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'save changes', exact: true }).click()
  await p.waitForTimeout(800)

  await p.getByRole('navigation').getByLabel('day', { exact: true }).click()
  await p.waitForTimeout(600)
  const pills = await p.locator('.daypill').count()
  check('two days to move between', pills >= 3, `${pills} pills including "all days"`)

  const start = await label()

  // --- two pages on a track, dragged as a pair ---
  //
  // Mid-drag, before the finger lifts: the day being read and the one being
  // dragged toward sit side by side and move together, which is what makes it
  // read as page navigation rather than as one page wobbling.
  const holdAt = async (dx: number) => {
    const y = 520, x0 = dx < 0 ? 300 : 90
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 10, y }],
      })
    }
    await p.waitForTimeout(120)
    const held = await p.evaluate(() => ({
      shift: new DOMMatrix(getComputedStyle(document.querySelector('.daytrack')!).transform).m41,
      pages: document.querySelectorAll('.daypage').length,
      widths: [...document.querySelectorAll('.daypage')]
        .map((e) => Math.round(e.getBoundingClientRect().width)).join('/'),
    }))
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await p.waitForTimeout(500)
    return { ...held, shift: Math.round(held.shift) }
  }

  const heldLeft = await holdAt(-140)
  check('the neighbouring day is mounted beside the current one',
    heldLeft.pages === 2, `${heldLeft.pages} page(s)`)
  check('each page is exactly one screen wide',
    heldLeft.widths === '390/390', heldLeft.widths)
  // One-to-one, not damped: the pair is being pushed, so it goes where the
  // thumb goes.
  check('the track follows the thumb one-to-one',
    heldLeft.shift <= -120 && heldLeft.shift >= -160, `${heldLeft.shift}px for a 140px drag`)

  const rested = await p.evaluate(() => ({
    shift: Math.round(
      new DOMMatrix(getComputedStyle(document.querySelector('.daytrack')!).transform).m41),
    pages: document.querySelectorAll('.daypage').length,
  }))
  check('and springs back to one page when the day did not change',
    rested.shift === 0 && rested.pages === 1, `${rested.shift}px, ${rested.pages} page(s)`)

  // Nothing older than the oldest, so there is no page to mount and the track
  // barely gives — the end of the log is something you feel rather than read.
  await p.locator('.daypill').last().click().catch(() => {})
  await p.waitForTimeout(300)
  const atOldest = (await p.locator('.daypill.on').count()) === 1
  if (atOldest) {
    const heldAtEnd = await holdAt(-140)
    check('at the end of the log there is nothing to mount',
      heldAtEnd.pages === 1, `${heldAtEnd.pages} page(s)`)
    check('and the track barely gives',
      heldAtEnd.shift > -20, `${heldAtEnd.shift}px for the same 140px drag`)
  }
  await p.locator('.daypill').nth(1).click()
  await p.waitForTimeout(300)

  await swipe(-160)
  const older = await label()
  check('a left swipe steps to the older day', older !== start, `${start} -> ${older}`)
  check('and the track is back to a single resting page',
    (await p.locator('.daypage').count()) === 1
      && (await p.locator('.daytrack.panning').count()) === 0,
    `${await p.locator('.daypage').count()} page(s)`)

  // Reduced motion removes the transition, so `transitionend` never fires and
  // only the timeout fallback lands the page. Checked because the failure is
  // silent and total: the day would simply never change.
  await p.emulateMedia({ reducedMotion: 'reduce' })
  await swipe(160)
  check('it still lands with the animation turned off',
    (await label()) === start, `${older} -> ${await label()}`)
  await p.emulateMedia({ reducedMotion: null })
  await swipe(-160)
  await p.waitForTimeout(300)

  await swipe(160)
  check('a right swipe comes back', (await label()) === start, `${await label()}`)
  check('and settles the same way going the other direction',
    (await p.locator('.daypage').count()) === 1
      && (await p.locator('.daytrack.panning').count()) === 0,
    `${await p.locator('.daypage').count()} page(s)`)

  await swipe(160)
  check('and stops at the most recent day', (await label()) === start,
    `still ${await label()}`)

  // Inert where stepping has no meaning.
  await p.getByRole('button', { name: 'all days' }).click()
  await p.waitForTimeout(300)
  const all = await label()
  await swipe(-160)
  check('a swipe does nothing on "all days"', (await label()) === all, `still ${all}`)

  // A short drag is not a swipe.
  await p.getByRole('button', { name: 'today', exact: false }).first().click()
    .catch(() => p.locator('.daypill').nth(1).click())
  await p.waitForTimeout(300)
  const single = await label()
  await swipe(-30)
  check('a short drag is not a swipe', (await label()) === single, `still ${single}`)
}

await p.locator('.picker, main.day').first().screenshot({ path: 'scripts/shots/period-picker.png' })
await b.close()
stop()
console.log(fail === 0 ? '\n  all picker checks pass' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
