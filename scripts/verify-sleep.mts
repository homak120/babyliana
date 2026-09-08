import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// Sleep as a first-class type: its own bubble, its own block, and an end time
// that lives on the timeslot (D-020) so "no end time" means "still asleep".
const PORT = 4196
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

// --- the quick row ---
await p.locator('nav.tabs').waitFor({ state: 'visible' })
check('feed quick icon', await p.getByLabel('log a feed').isVisible(), 'in the bar')
check('diaper quick icon', await p.getByLabel('log a diaper').isVisible(), 'in the bar')
check('sleep quick icon', await p.getByLabel('log a sleep').isVisible(), 'in the bar')

// The diaper is the quick icon that still opens the sheet — the bottle and the
// bedtime button write straight to the log now, so they have no block to check.
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(300)
check('a quick icon pre-adds its block', (await p.locator('.block.diaper').count()) === 1, 'diaper block open')
check('and the others are still offered', await p.getByRole('button', { name: /\+ .*milk/ }).isVisible(), 'milk bubble')
check('sleep is a bubble now, not an "other"', await p.getByRole('button', { name: /\+ .*sleep/ }).isVisible(), 'sleep bubble')

// One milk tile per moment (D-038). The card holds both parts of a split feed
// and has its own `+` for the second, so a second tile would be a second way to
// say the same thing. Reached through the bubble now rather than through the
// bar, which is the only route left that opens a sheet on milk at all.
await p.getByRole('button', { name: /\+ .*milk/ }).click()
await p.waitForTimeout(250)
check('the milk bubble is gone once a milk block exists',
  (await p.locator('.milkblock').count()) === 1 && (await p.locator('.bubble.milk').count()) === 0,
  `${await p.locator('.bubble.milk').count()} milk bubbles`)

// Back to an empty sheet, where every bubble is on offer, for the colour set.
await p.getByRole('button', { name: 'close' }).click()
await p.waitForTimeout(300)
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
// Every bubble carries its type's own fill and ink, from the prototype's table:
// milk rose, diaper mint, sleep peri, other lavender. Checked as a set rather
// than one at a time — sleep was added without its pair and fell through to the
// bare .bubble default, which is exactly what a per-type check would miss next
// time. Tokens are resolved through a probe element because the theme, and so
// the literal rgb, switches by clock.
const token = (name: string) =>
  p.evaluate((n) => {
    const el = document.createElement('span')
    el.style.color = `var(${n})`
    document.body.appendChild(el)
    const c = getComputedStyle(el).color
    el.remove()
    return c
  }, name)

for (const [type, fill, ink] of [
  ['milk', '--roseFill', '--roseInk'],
  ['diaper', '--mintFill', '--mintInk'],
  ['sleep', '--periFill', '--periInk'],
  // The three that came out of `other` (D-038).
  ['weight', '--amberFill', '--amberInk'],
  ['temperature', '--amberFill', '--amberInk'],
  ['supplement', '--lavFill', '--lavInk'],
  ['other', '--lavFill', '--lavInk'],
] as const) {
  const got = await p.evaluate((t) => {
    const el = document.querySelector(`.bubble.${t}`)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, fg: cs.color }
  }, type)
  if (got === null) { check(`${type} bubble is offered`, false, 'missing'); continue }
  check(`${type} bubble takes its own colours`,
    got.bg === (await token(fill)) && got.fg === (await token(ink)),
    `${got.bg} on ${got.fg}`)
}

await p.getByRole('button', { name: 'close' }).click()
await p.waitForTimeout(300)

// --- log an open-ended sleep ---
//
// One tap. The bedtime button writes straight to the log: a sleep has nothing
// to fill in, so the sheet was only ever a save button in the way.
await p.getByLabel('log a sleep').click()
await p.waitForTimeout(900)
check('the bedtime button opens no sheet at all', (await p.locator('.sheet').count()) === 0,
  `${await p.locator('.sheet').count()} sheet(s)`)

check('the row reads "sleeping…"', (await p.locator('.chip-peri').first().innerText()).includes('sleeping'),
  (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' '))
// Live to the second, and actually moving — read twice a second and a bit
// apart, because a chip that renders "0s" once and freezes would pass a check
// on the format alone.
const chipAt = async () => (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ').trim()
const firstRead = await chipAt()
check('and counts in seconds', /sleeping \d+s$/.test(firstRead), firstRead)
await p.waitForTimeout(2100)
const secondRead = await chipAt()
check('and the count is running, not painted once',
  secondRead !== firstRead && /sleeping \d+s$/.test(secondRead), `${firstRead} then ${secondRead}`)
// A third control carries "end sleep" now: the bar pill, the card's 30px
// button, and this one inside the chip that says what is running.
check('the row carries its own end-sleep button',
  await p.locator('.chip-peri [aria-label="end sleep"]').isVisible(), 'in the chip')
check('the mascot says sleeping', (await p.locator('.statetag').innerText()).includes('sleeping'),
  await p.locator('.statetag').innerText())
// isVisible() does not auto-wait, so it can read a frame before the re-render.
await p.locator('.endsleep').waitFor({ state: 'visible', timeout: 5000 })
check('the bar offers to end it', true, (await p.locator('.endsleep').innerText()).replace(/\n/g, ' '))
// It lost to `.tabs button` on specificity once and rendered as a 56px grid
// cell with no background, so assert the resolved layout rather than presence.
const pill = await p.evaluate(() => {
  const el = document.querySelector('.endsleep') as HTMLElement
  const cs = getComputedStyle(el)
  return { display: cs.display, bg: cs.backgroundColor, h: Math.round(el.getBoundingClientRect().height) }
})
check('the pill is laid out as a pill', pill.display === 'flex' && pill.h === 40 && pill.bg !== 'rgba(0, 0, 0, 0)',
  `${pill.display}, ${pill.h}px, ${pill.bg}`)

// --- the top card says how long, and offers the same way out ---
//
// Three controls carry "end sleep" now — the bar pill, the card's 30px button
// and the row's chip button — so every reference to one has to say which.
const cardLine = p.locator('.sleepline')
await cardLine.waitFor({ state: 'visible', timeout: 5000 })
check('the card says how long she has been asleep',
  /\d+m asleep$/.test((await cardLine.locator('span').innerText()).trim()),
  (await cardLine.innerText()).replace(/\n/g, ' '))
const mini = await p.evaluate(() => {
  const el = document.querySelector('.endsleepmini') as HTMLElement
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { size: `${Math.round(r.width)}x${Math.round(r.height)}`, svg: !!el.querySelector('svg') }
})
check('with the 30px end-sleep button beside it',
  mini !== null && mini.size === '30x30' && mini.svg, mini === null ? 'missing' : mini.size)

// --- ending it from the bar ---
await p.locator('nav.tabs [aria-label="end sleep"]').click()
await p.waitForTimeout(900)
const ended = (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ')
check('the end-sleep button closes it', /slept/.test(ended), ended)
check('and the card drops its asleep line', (await p.locator('.sleepline').count()) === 0, 'gone')
await p.locator('.quick.sleep').waitFor({ state: 'visible', timeout: 5000 })
check('and the bar goes back to offering a sleep', true, 'restored')

// --- and resuming it puts it back ------------------------------------------
//
// The undo for a stir that turned out not to be a waking. It clears the end
// time on the *same* sleep rather than starting a new one, so the row goes back
// to counting from the start it always had — which is why the chip has to read
// "sleeping" again and not a fresh "0s".
check('a closed sleep offers to be resumed',
  await p.locator('.chip-peri [aria-label="resume sleep"]').isVisible(), 'in the chip')
await p.locator('.chip-peri [aria-label="resume sleep"]').click()
await p.waitForTimeout(900)
const resumed = await chipAt()
check('resuming reopens that same sleep', /sleeping \d+s$/.test(resumed), resumed)
await p.locator('.endsleep').waitFor({ state: 'visible', timeout: 5000 })
check('and the bar goes back to offering the end', true, 'end pill again')
check('the resume icon is gone while it runs',
  (await p.locator('.chip-peri [aria-label="resume sleep"]').count()) === 0,
  'end or resume, never both')

// --- ending it from the card instead ---
await p.locator('.endsleepmini').waitFor({ state: 'visible', timeout: 5000 })
await p.locator('.endsleepmini').click()
await p.waitForTimeout(900)
const fromCard = (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ')
check('the card button closes it too', /slept/.test(fromCard), fromCard)

// --- and the row's own button is the third way -----------------------------
await p.getByLabel('log a sleep').click()
await p.waitForTimeout(900)
await p.locator('.chip-peri [aria-label="end sleep"]').click()
await p.waitForTimeout(900)
const fromRow = (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ')
check('the chip button closes it too', /slept/.test(fromRow), fromRow)

// a fourth, to test the auto-close path
await p.getByLabel('log a sleep').click()
await p.waitForTimeout(900)
await p.locator('.endsleep').waitFor({ state: 'visible', timeout: 5000 })

// --- logging anything else closes it ---
// The bottle writes 60 mL of formula straight to the log, so this is one tap
// and the sleep is closed by the write rather than by the sheet's save.
await p.getByLabel('log a feed').click()
await p.waitForTimeout(900)

const chip = (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ')
check('the next entry closes the sleep', /slept/.test(chip), chip)
check('the bar offers a new sleep again', await p.getByLabel('log a sleep').isVisible(), 'restored')
check('the mascot is no longer asleep from an open sleep',
  !(await p.locator('.statetag').innerText()).includes('sleeping')
  || (await p.evaluate(() => new Date().getHours() >= 20 || new Date().getHours() < 7)),
  `${await p.locator('.statetag').innerText()} (night fallback may still apply)`)

// --- the day view agrees ---
await p.getByLabel('day').click()
await p.waitForTimeout(500)
check('the day table shows the sleep', (await p.locator('.tsleep').count()) >= 1,
  await p.locator('.tsleep').first().innerText())
check('the day screen has no add actions', (await p.getByLabel('log a feed').count()) === 0, 'read-back only')
check('and offers a way back', await p.locator('.backpill').isVisible(), 'back pill')

await b.close()
stop()
console.log(fail === 0 ? '\n  sleep works end to end' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
