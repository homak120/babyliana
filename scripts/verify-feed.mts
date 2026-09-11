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

/**
 * A feed of a chosen volume, through the sheet.
 *
 * The bar's bottle writes 60 mL of formula and nothing else, so the `+` button
 * and the milk bubble are now the only route that asks for a number — which is
 * the trade the quick icon makes, and worth exercising rather than assuming.
 */
const feedOf = async (digits: string) => {
  await p.getByLabel('log a moment').click()
  await p.waitForTimeout(300)
  await p.getByRole('button', { name: /\+ .*milk/ }).click()
  await p.waitForTimeout(250)
  await typeVolume(digits)
  await p.getByRole('button', { name: 'save', exact: true }).click()
  await p.waitForTimeout(900)
}

// --- a feed with no end time is running -------------------------------------
//
// One tap. The bottle writes 60 mL of formula straight to the log: that is the
// commonest feed by a distance, and the sheet was a save button confirming what
// the first tap had already said.
await p.locator('nav.tabs').waitFor({ state: 'visible' })
await p.getByLabel('log a feed').click()
await p.waitForTimeout(900)
check('the bottle opens no sheet at all', (await p.locator('.sheet').count()) === 0,
  `${await p.locator('.sheet').count()} sheet(s)`)
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
  const probe = document.createElement('span')
  probe.style.color = 'var(--lavInk)'
  document.body.appendChild(probe)
  const lav = getComputedStyle(probe).color
  probe.remove()
  return {
    display: cs.display, bg: cs.backgroundColor,
    h: Math.round(el.getBoundingClientRect().height),
    // A drawn bottle, not a Material ligature: nothing in the set is a baby
    // bottle, and `timer_off` — then `local_drink` — both read as something
    // else (D-038). Its own element, like the hand-drawn end-sleep moon.
    paths: el.querySelector('svg')?.querySelectorAll('path').length ?? 0,
    ligature: el.querySelector('.icon')?.textContent ?? '',
    lav,
    fg: cs.color,
  }
})
check('laid out as the prototype draws it',
  pill.display === 'flex' && pill.h === 40 && pill.bg !== 'rgba(0, 0, 0, 0)',
  `${pill.display}, ${pill.h}px, ${pill.bg}`)
check('it carries the drawn bottle, not a Material glyph',
  pill.paths === 5 && pill.ligature === '',
  `${pill.paths} paths, ligature "${pill.ligature}"`)
// Lavender, not the rose it shipped in. Rose is the milk colour and reads as an
// alert at button size — the owner's word for it was red.
check('and it is not the rose it shipped in', pill.fg === pill.lav,
  `${pill.fg} vs lavender ${pill.lav}`)
check('and carries the running duration',
  /\d+ min$/.test((await p.locator('.endfeed').innerText()).replace(/\n/g, ' ').trim()),
  (await p.locator('.endfeed').innerText()).replace(/\n/g, ' '))

check('the mascot says feeding', (await p.locator('.statetag').innerText()).includes('feeding'),
  await p.locator('.statetag').innerText())
// The unit, the volume and the source, read back off the row rather than off
// the draft — verify-s4 checks `quickMilk()` itself, and this is the half that
// proves the bottle's defaults were written without a sheet in between.
check('the row reads the volume with its unit and its source',
  /60 mL formula/.test((await p.locator('.chip-rose').first().innerText()).replace(/\n/g, ' ')),
  (await p.locator('.chip-rose').first().innerText()).replace(/\n/g, ' '))

// --- the row's own clock, the mirror of the sleep chip ----------------------
//
// A running feed used to say nothing at all on the row: `feedCell` returns null
// while it is open, so the only live number was the card's and the bar's. Since
// the bottle writes straight to the log, every quick feed is an open one, and a
// row that says nothing about the thing that is happening is the wrong half of
// the screen to be silent.
check('the row reads "feeding" while it runs',
  (await p.locator('.chip-feeding').innerText()).includes('feeding'),
  (await p.locator('.chip-feeding').innerText()).replace(/\n/g, ' '))
// Live to the second, and actually moving — read twice a couple of seconds
// apart, because a chip that renders "0s" once and freezes would pass a check
// on the format alone. The same pair verify-sleep runs.
const feedChipAt = async () =>
  (await p.locator('.chip-feeding').innerText()).replace(/\n/g, ' ').trim()
const firstFeedRead = await feedChipAt()
check('and counts in seconds', /feeding \d+s$/.test(firstFeedRead), firstFeedRead)
await p.waitForTimeout(2100)
const secondFeedRead = await feedChipAt()
check('and the count is running, not painted once',
  secondFeedRead !== firstFeedRead && /feeding \d+s$/.test(secondFeedRead),
  `${firstFeedRead} then ${secondFeedRead}`)
// Rose while it runs, neutral once it is a read-back: the running feed is the
// thing happening, and `.chip-timer` is where a *finished* one belongs.
check('the running chip is rose and the finished one is not',
  (await p.locator('.chip-feeding').evaluate((el) => getComputedStyle(el).backgroundColor))
    === (await p.locator('.chip-rose').first().evaluate((el) => getComputedStyle(el).backgroundColor)),
  'same fill as the volume chip beside it')
// A third control carries "end feed": the bar pill, the card's button, and this
// one inside the chip that says what is running.
check('the row carries its own end-feed button',
  await p.locator('.chip-feeding [aria-label="end feed"]').isVisible(), 'in the chip')
// No resume to match the sleep chip's. Reopening a sleep is the undo for a stir
// that was not a waking; a feed has no equivalent, and `closeOpenSleep` records
// the same asymmetry on the write side.
check('and offers no resume once it is over',
  (await p.locator('.row [aria-label="resume feed"]').count()) === 0, 'feeds do not reopen')

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
check('and the row stops counting', (await p.locator('.chip-feeding').count()) === 0,
  'the rose clock is gone')
await p.locator('.quick.feed').waitFor({ state: 'visible', timeout: 5000 })
check('and the bar goes back to offering a feed', true, 'bottle restored')

// --- ending it from the bar -------------------------------------------------
await feedOf('30')
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
// Two controls carry "end feed", so every reference has to say which.
await p.locator('nav.tabs [aria-label="end feed"]').click()
await p.waitForTimeout(900)
check('the bar pill closes it too',
  /fed/.test((await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' ')),
  (await p.locator('.chip-timer').first().innerText()).replace(/\n/g, ' '))

// While one is open the `+` button is still the way to log anything, including
// another feed — the quick bottle is the thing that steps aside, not the sheet.
await feedOf('40')
await p.locator('.endfeed').waitFor({ state: 'visible', timeout: 5000 })
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
check('the + button still reaches a feed while one is open',
  await p.getByRole('button', { name: /\+ .*milk/ }).isVisible(), 'milk bubble offered')
await p.getByRole('button', { name: /\+ .*milk/ }).click()
await p.waitForTimeout(250)
// The end time lives on the time card, not on the milk block — D-033, and the
// only place a milk block is opened at all now.
check('the milk block carries no in-progress control of its own',
  (await p.locator('.stillfeeding').count()) === 0, 'the time card owns the end time')
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
await feedOf('55')
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

// --- the quick bottle's default is a setting (D-055) ------------------------
//
// The end-to-end half: change it on the settings screen, tap the bottle, and
// read the row. Since D-053 there is no sheet between the tap and the write, so
// the default IS the entry — a wrong one is a wrong row, not a wrong prefill.
await p.getByRole('navigation').getByLabel('log', { exact: true }).click()
await p.waitForTimeout(400)
await p.getByLabel('settings').click()
await p.waitForTimeout(350)
// 60 → 90 in fives, and formula → breast milk.
for (let i = 0; i < 6; i++) {
  await p.getByLabel('increase bottle volume').click()
  await p.waitForTimeout(60)
}
check('the volume stepper walks the default up',
  /90 mL/.test(await p.locator('.setstep b').first().innerText()),
  (await p.locator('.setstep b').first().innerText()).trim())
await p.getByRole('button', { name: 'breast milk', exact: true }).click()
await p.waitForTimeout(150)
// No save button anywhere on the sheet — the taps above already wrote.
check('and nothing had to be saved',
  (await p.locator('.setsheet .save').count()) === 0, 'committed on the tap')
await p.locator('.setsheet').getByLabel('close').click()
await p.waitForTimeout(400)

await p.getByLabel('log a feed').click()
await p.waitForTimeout(900)
const newRow = (await p.locator('.chip-rose').first().innerText()).replace(/\n/g, ' ')
// `breast`, not `breast milk`: the column abbreviates the source (`cells.ts`),
// and the settings screen spells it out. Two audiences, one value.
check('the bottle logs the volume and source from settings',
  /90 mL breast/.test(newRow), newRow)

// And it survives a reload, because the local cache is written before the push
// and the push is what a reload does not wait for.
await p.reload({ waitUntil: 'load' })
await p.waitForTimeout(900)
await p.getByLabel('settings').click()
await p.waitForTimeout(350)
check('and the setting is still there after a reload',
  /90 mL/.test(await p.locator('.setstep b').first().innerText()),
  (await p.locator('.setstep b').first().innerText()).trim())

await b.close()
stop()
console.log(fail === 0 ? '\n  a feed in progress works end to end' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
