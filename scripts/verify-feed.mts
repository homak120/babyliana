import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// A feed that is still running (D-033). The same rule as sleep, on the same
// field: a moment with a feed and no `ended_at` is open, and it stops reading
// as open the moment anything else is logged — no flag, no write.
//
// The check that matters most is the last pair: logging something else must
// clear the state WITHOUT stamping an end time on the feed. A sleep gets the
// new entry's time, because at 4am you log the feed and not the waking; a feed
// must not, because the next diaper says nothing about when the bottle
// finished, and D-003 leaves no history to recover an invented duration from.
const PORT = 4204
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

const typeVolume = async (digits: string) => {
  for (const k of digits) await p.getByRole('button', { name: k, exact: true }).click()
}

// --- a feed with no end time is running -------------------------------------
await p.locator('nav.tabs').waitFor({ state: 'visible' })
await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
check('the milk block carries no in-progress control of its own',
  (await p.locator('.stillfeeding').count()) === 0, 'the time card owns the end time')

// The quick bottle arrives filled in — the commonest feed at two taps — and the
// 60 is a suggestion rather than a claim: the first digit typed replaces it, so
// a 45 mL feed never becomes 604.
const part1 = p.getByLabel('part 1')
check('the quick bottle opens on 60 mL of formula',
  (await part1.innerText()).trim() === '60'
    && await part1.evaluate((el) => el.classList.contains('formula')),
  (await part1.innerText()).trim())
await typeVolume('4')
check('and the first digit typed replaces the suggestion',
  (await part1.innerText()).trim() === '4', (await part1.innerText()).trim())
// The backspace key is an aria-hidden icon, so it has no accessible name — it
// is the last key on the pad.
await p.locator('.keypad button').last().click()
await typeVolume('60')
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)

// The bar swaps the bottle for the end-feed pill, exactly as it swaps the moon
// for end-sleep: an unfinished feed's useful verb is "end it".
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
check('the bottle is replaced by the end-feed pill',
  (await p.locator('.quick.feed').count()) === 0,
  (await p.locator('.endfeed').innerText()).replace(/\n/g, ' '))
// The sleep pill once lost to `.tabs button` on specificity and rendered as a
// background-less grid cell, so assert the resolved layout rather than presence.
const pill = await p.evaluate(() => {
  const el = document.querySelector('.endfeed') as HTMLElement
  const cs = getComputedStyle(el)
  return {
    display: cs.display, bg: cs.backgroundColor,
    h: Math.round(el.getBoundingClientRect().height),
    icon: el.querySelector('.icon')?.textContent ?? '',
  }
})
check('laid out as the prototype draws it',
  pill.display === 'flex' && pill.h === 40 && pill.bg !== 'rgba(0, 0, 0, 0)'
  && pill.icon === 'timer_off',
  `${pill.display}, ${pill.h}px, ${pill.bg}, ${pill.icon}`)
check('and carries the running duration',
  /\d+ min$/.test((await p.locator('.endfeed').innerText()).replace(/\n/g, ' ').trim()),
  (await p.locator('.endfeed').innerText()).replace(/\n/g, ' '))

check('the mascot says feeding', (await p.locator('.statetag').innerText()).includes('feeding'),
  await p.locator('.statetag').innerText())
check('the row reads the volume with its unit',
  /60 mL/.test((await p.locator('.chip-rose').first().innerText()).replace(/\n/g, ' ')),
  (await p.locator('.chip-rose').first().innerText()).replace(/\n/g, ' '))

// The direct child only: the end-feed button beside it is a Material icon in a
// span of its own, where the end-sleep control is an SVG.
const cardLine = p.locator('.feedline')
await cardLine.waitFor({ state: 'visible', timeout: 5000 })
check('the card says how long she has been on it',
  /\d+ min feeding$/.test((await cardLine.locator('> span').innerText()).trim()),
  (await cardLine.innerText()).replace(/\n/g, ' '))
check('and the asleep line is not also showing',
  (await p.locator('.sleepline').count()) === 0, 'one line, not two')

// --- ending it from the card ------------------------------------------------
await p.locator('.endfeedmini').click()
await p.waitForTimeout(900)
await p.locator('.quick.feed').waitFor({ state: 'visible', timeout: 5000 })
check('the card button closes it',
  /fed/.test((await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' ')),
  (await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' '))
check('and the card drops its feeding line', (await p.locator('.feedline').count()) === 0, 'gone')
await p.locator('.quick.feed').waitFor({ state: 'visible', timeout: 5000 })
check('and the bar goes back to offering a feed', true, 'bottle restored')

// --- ending it from the bar -------------------------------------------------
await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
await typeVolume('30')
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
// Two controls carry "end feed", so every reference has to say which.
await p.locator('nav.tabs [aria-label="end feed"]').click()
await p.waitForTimeout(900)
check('the bar pill closes it too',
  /fed/.test((await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' ')),
  (await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' '))

// While one is open the `+` button is still the way to log anything, including
// another feed — the quick bottle is the thing that steps aside, not the sheet.
await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
await typeVolume('40')
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
check('the + button still reaches a feed while one is open',
  await p.getByRole('button', { name: /\+ .*milk/ }).isVisible(), 'milk bubble offered')
await p.getByRole('button', { name: 'close' }).click()
await p.waitForTimeout(300)
// Close it again so the next section starts from the bottle.
await p.locator('nav.tabs [aria-label="end feed"]').click()
await p.waitForTimeout(900)
await p.locator('.quick.feed').waitFor({ state: 'visible', timeout: 5000 })

// --- logging anything else clears the state, and writes nothing --------------
//
// The half that separates a feed from a sleep. A sleep gets the new entry's
// time stamped on it, because at 4am you log the feed and not the waking. A
// feed must not: the diaper says nothing about when the bottle finished, and an
// invented duration is unrecoverable in a model with no history (D-003).
await p.getByLabel('log a feed').click()
await p.waitForTimeout(300)
await typeVolume('55')
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
const openRowTime = (await p.locator('.row time').first().innerText()).trim()

await p.getByLabel('log a diaper').click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
check('the next entry clears the running state',
  (await p.locator('.endfeed').count()) === 0 && (await p.locator('.feedline').count()) === 0,
  'bar back to a bottle')
// The feed is the second row now; the diaper is newest.
const feedRowTime = (await p.locator('.row time').nth(1).innerText()).trim()
check('and does NOT stamp an end time on the feed',
  feedRowTime === openRowTime && !feedRowTime.includes('–'),
  `${openRowTime} then ${feedRowTime}`)

// --- the day view agrees ----------------------------------------------------
await p.getByLabel('day').click()
await p.waitForTimeout(500)
check('the day table carries the fed line', (await p.locator('.tfeed').count()) >= 1,
  (await p.locator('.tfeed').first().innerText()).replace(/\n/g, ' '))
const cell = (await p.locator('.tmilk').first().innerText()).trim()
check('and the milk column spells out the unit', /mL/.test(cell), cell)

await b.close()
stop()
console.log(fail === 0 ? '\n  a feed in progress works end to end' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
