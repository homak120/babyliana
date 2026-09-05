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

await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
check('a quick icon pre-adds its block', (await p.locator('.milkblock').count()) === 1, 'milk block open')
check('and the others are still offered', await p.getByRole('button', { name: /\+ .*diaper/ }).isVisible(), 'diaper bubble')
check('sleep is a bubble now, not an "other"', await p.getByRole('button', { name: /\+ .*sleep/ }).isVisible(), 'sleep bubble')
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
await p.getByLabel('log a sleep').click()
await p.waitForTimeout(300)
check('the sleep block opens', (await p.locator('.sleepblock').count()) === 1, 'present')
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(700)

check('the row reads "sleeping…"', (await p.locator('.chip-peri').first().innerText()).includes('sleeping'),
  (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' '))
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

// --- ending it from the bar ---
await p.getByLabel('end sleep').click()
await p.waitForTimeout(900)
const ended = (await p.locator('.chip-peri').first().innerText()).replace(/\n/g, ' ')
check('the end-sleep button closes it', /slept/.test(ended), ended)
await p.locator('.quick.sleep').waitFor({ state: 'visible', timeout: 5000 })
check('and the bar goes back to offering a sleep', true, 'restored')

// start another, to test the auto-close path
await p.getByLabel('log a sleep').click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(700)
await p.locator('.endsleep').waitFor({ state: 'visible', timeout: 5000 })

// --- logging anything else closes it ---
await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
for (const k of ['6', '0']) await p.getByRole('button', { name: k, exact: true }).click()
await p.getByRole('button', { name: 'save', exact: true }).click()
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
