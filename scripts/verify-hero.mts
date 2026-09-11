import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// The hero's elapsed figure must never wrap. It did: the README lists 64px and
// the mascot at 108, and "14h 21m" broke onto two lines beside her. The
// prototype actually draws 44px with the art overflowing a 100x96 slot.
//
// Serves its own build so `npm run verify` needs no running dev server.
const PORT = 4192
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
await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ milk' }).click()
await p.getByRole('button', { name: '6', exact: true }).click()
await p.getByRole('button', { name: '0', exact: true }).click()
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(600)

let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }

// That feed has no end time, so it is running. The next-feed target is measured
// from where a feed *ends*, so while one is open the line is hidden rather than
// showing a number that moves every tick and is wrong the moment it closes.
check('no target while a feed is running',
  (await p.locator('.wakeline').count()) === 0 && (await p.locator('.endfeedmini').count()) === 1,
  `${await p.locator('.wakeline').count()} wake line(s)`)

// Every shape formatElapsed can produce, longest last.
//
// The class is toggled here as well as the text, because the component sizes
// the figure by its length — the lead rail left the card too narrow to hold
// seven characters at 44px. Setting textContent alone would measure a state the
// app never renders.
for (const text of ['24m', '1h 05m', '14h 21m', '23h 59m', '999h 59m']) {
  const r = await p.evaluate((t) => {
    const el = document.querySelector('.elapsed') as HTMLElement
    el.textContent = t
    el.classList.toggle('long', t.length > 6)
    const card = document.querySelector('.herocard') as HTMLElement
    const cs = getComputedStyle(el)
    return {
      lines: Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight)),
      overflows: el.scrollWidth > el.clientWidth + 1,
      cardRight: Math.round(card.getBoundingClientRect().right),
      elRight: Math.round(el.getBoundingClientRect().right),
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  }, text)
  // scrollWidth alone under-reports overflow on a nowrap block, so measure the
  // rendered glyph run against the card's inner edge instead.
  const inner = await p.evaluate(() => {
    const el = document.querySelector('.elapsed') as HTMLElement
    const card = document.querySelector('.herocard') as HTMLElement
    const range = document.createRange()
    range.selectNodeContents(el)
    const textRight = range.getBoundingClientRect().right
    const pad = parseFloat(getComputedStyle(card).paddingRight)
    return { textRight: Math.round(textRight), limit: Math.round(card.getBoundingClientRect().right - pad) }
  })
  const ok = r.lines === 1 && r.docOverflow === 0 && inner.textRight <= inner.limit
  check(`"${text}"`, ok, `${r.lines} line(s), text ends ${inner.textRight} vs limit ${inner.limit}`)
}

const geo = await p.evaluate(() => {
  const m = document.querySelector('.mascot')!.getBoundingClientRect()
  const img = document.querySelector('.mascot img')!.getBoundingClientRect()
  return { slot: `${Math.round(m.width)}x${Math.round(m.height)}`, art: `${Math.round(img.width)}x${Math.round(img.height)}` }
})
check('mascot slot 88x88 with 100px art', geo.slot === '88x88' && geo.art === '100x100', `slot ${geo.slot}, art ${geo.art}`)

// --- the lead-view switcher ---
//
// The rail is what made the card narrow enough for the figure to wrap, so it is
// checked in the same suite that guards the wrap.
const rail = await p.evaluate(() => {
  const r = document.querySelector('.leadrail')
  const card = document.querySelector('.herocard')!.getBoundingClientRect()
  if (!r) return null
  const btns = [...r.querySelectorAll('button')]
  const b = btns[0].getBoundingClientRect()
  return {
    count: btns.length,
    size: `${Math.round(b.width)}x${Math.round(b.height)}`,
    leftOfCard: Math.round(r.getBoundingClientRect().right) <= Math.round(card.left),
    on: btns.filter((x) => x.classList.contains('on')).length,
    labels: btns.map((x) => x.getAttribute('aria-label')).join(', '),
  }
})
check('three 32px lead buttons, left of the card',
  rail !== null && rail.count === 3 && rail.size === '32x32' && rail.leftOfCard,
  rail === null ? 'no rail' : `${rail.count} x ${rail.size}, ${rail.labels}`)
check('exactly one is active', rail !== null && rail.on === 1, `${rail?.on} active`)

// Each lead must draw *something* — an empty card is the failure mode of a
// switch that renders by branch.
for (const [label, sel] of [
  ['elapsed view', '.elapsed'],
  ['next feeds view', '.nextfeed'],
  ['mascot view', '.mascotword'],
] as const) {
  await p.getByLabel(label).click()
  await p.waitForTimeout(200)
  const seen = await p.locator(sel).count()
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check(`${label} leads with ${sel}`, seen === 1 && overflow === 0,
    `${seen} element(s), ${overflow}px overflow`)
}

// The choice outlives the remount that every save causes.
//
// A diaper, not a second feed: the feed logged at the top of this file has no
// end time, so the bar is showing its end-feed pill where the bottle was
// (D-033). Any save exercises the remount, and this one does not depend on
// which quick icon happens to be on screen.
await p.getByLabel('mascot view').click()
await p.waitForTimeout(200)
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(300)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
check('the lead survives a save', (await p.locator('.mascotword').count()) === 1,
  `${await p.locator('.mascotword').count()} mascot lead(s) after saving`)
await p.getByLabel('elapsed view').click()
await p.waitForTimeout(200)

// --- the target for the next feed ---
//
// The diaper logged above stopped the feed reading as running — anything
// logged after an open period ends it as the latest moment (D-033) — so the
// target is back.
check('the target is there once no feed is running',
  (await p.locator('.wakeline').count()) === 1,
  (await p.locator('.wakeline').innerText().catch(() => 'absent')).replace(/\n/g, ' '))

// Under the elapsed and mascot leads, and deliberately not under the next-feeds
// one (D-050): that tab's big number is the same instant this line names, and
// saying it twice on one card — once as a ceiling, once as an appointment —
// reads as two different claims.
for (const [label, want] of [
  ['next feeds view', 0],
  ['mascot view', 1],
  ['elapsed view', 1],
] as const) {
  await p.getByLabel(label).click()
  await p.waitForTimeout(200)
  const seen = await p.locator('.wakeline').count()
  const over = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check(`the target is ${want ? 'under' : 'off'} ${label}`, seen === want && over === 0,
    `${seen} wake line(s), ${over}px overflow`)
}

// The card is narrow enough that this line is where a long one would push the
// page sideways — the same trap the elapsed figure fell into.
const wake = await p.evaluate(() => {
  const el = document.querySelector('.wakeline') as HTMLElement
  const card = document.querySelector('.herocard') as HTMLElement
  const pad = parseFloat(getComputedStyle(card).paddingRight)
  return {
    right: Math.round(el.getBoundingClientRect().right),
    limit: Math.round(card.getBoundingClientRect().right - pad),
  }
})
check('and stays inside the card', wake.right <= wake.limit,
  `ends ${wake.right} vs limit ${wake.limit}`)

// `by 9:23 PM` is four characters longer than `by 21:23`, on the line that is
// already the narrowest thing on this card (D-041). Measured, then switched
// back, because everything below this reads 24-hour times.
//
// The toggle is in the settings sheet now (D-055), not beside the clock in the
// status row — so this opens it, taps, and closes. It applies on the tap: the
// screen behind is repainted before the sheet is shut, which is the whole
// no-save-button rule.
const setClock = async (which: '12' | '24') => {
  await p.getByLabel('settings').click()
  await p.waitForTimeout(300)
  await p.getByLabel(`show ${which}-hour times`).click()
  await p.waitForTimeout(200)
  await p.locator('.setsheet').getByLabel('close').click()
  await p.waitForTimeout(300)
}
await setClock('12')
const wake12 = await p.evaluate(() => {
  const el = document.querySelector('.wakeline') as HTMLElement
  const card = document.querySelector('.herocard') as HTMLElement
  const pad = parseFloat(getComputedStyle(card).paddingRight)
  return {
    text: el.innerText.replace(/\n/g, ' '),
    right: Math.round(el.getBoundingClientRect().right),
    limit: Math.round(card.getBoundingClientRect().right - pad),
    over: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
  }
})
check('the target holds a 12-hour time too',
  /\d{1,2}:\d{2}\s*(AM|PM)/.test(wake12.text)
  && wake12.right <= wake12.limit && wake12.over === 0,
  `${wake12.text} — ends ${wake12.right} vs limit ${wake12.limit}, ${wake12.over}px overflow`)
await setClock('24')

// --- the bottle prompt ---
//
// Nothing to prepare yet: the feed above is minutes old, so the target is
// hours out.
check('no bottle prompt hours ahead of the target',
  (await p.locator('.preppill').count()) === 0,
  `${await p.locator('.preppill').count()} prompt(s)`)

// Walk the feed back four hours so the target has passed. Editing the entry
// rather than logging another one, because the prompt reads the *latest* feed
// and a backdated second one would not be it.
const cdp = await ctx.newCDPSession(p)
const feedRow = p.locator('.row.swipeable').nth(1)
const rbox = (await feedRow.boundingBox())!
const ry = rbox.y + rbox.height / 2, rx = rbox.x + rbox.width - 30
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rx, y: ry }] })
for (let i = 1; i <= 14; i++) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: rx - (150 * i) / 14, y: ry }],
  })
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await p.waitForTimeout(400)
await p.locator('.rowwrap').nth(1).locator('.act.edit').click()
await p.waitForTimeout(400)
// The first `.timestepper` is the hour; both steppers label their buttons the
// same way, so scope it rather than matching on the name.
const hourDown = p.locator('.timestepper').first().getByLabel('down')
for (let i = 0; i < 4; i++) { await hourDown.click(); await p.waitForTimeout(120) }
await p.getByRole('button', { name: 'save changes', exact: true }).click()
await p.waitForTimeout(900)

check('the prep pill is up once the target is inside 15 minutes',
  (await p.locator('.preppill').count()) === 1,
  (await p.locator('.preppill').innerText().catch(() => 'absent')).replace(/\n/g, ' '))

// It lives *inside* a lead now (D-050), not under all three: on the elapsed
// tab only while the ceiling is close, on the mascot tab always, and never on
// the next-feeds tab, which has three times of its own to carry.
for (const [label, want] of [
  ['next feeds view', 0],
  ['mascot view', 1],
  ['elapsed view', 1],
] as const) {
  await p.getByLabel(label).click()
  await p.waitForTimeout(200)
  const seen = await p.locator('.preppill').count()
  const over = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check(`the pill is ${want ? 'on' : 'off'} ${label}`, seen === want && over === 0,
    `${seen} pill(s), ${over}px overflow`)
}

const prep = await p.evaluate(`(() => {
  const el = document.querySelector('.preppill');
  const card = document.querySelector('.herocard');
  const pad = parseFloat(getComputedStyle(card).paddingRight);
  const r = el.getBoundingClientRect();
  return { right: Math.round(r.right), limit: Math.round(card.getBoundingClientRect().right - pad),
           lines: Math.round(r.height / 18) };
})()`) as { right: number; limit: number; lines: number }
check('and it fits inside the card, two lines and no more',
  prep.right <= prep.limit && prep.lines <= 2,
  `ends ${prep.right} vs ${prep.limit}, ${prep.lines} line(s)`)

// --- the timer (D-045, redrawn in D-050) ------------------------------------
check('it asks before it counts, and says how to start',
  /make milk/.test(await p.locator('.preppill').innerText())
  && /tap when you start/.test(await p.locator('.preppill').innerText()),
  (await p.locator('.preppill').innerText()).replace(/\n/g, ' '))
const askAnim = await p.evaluate(
  `getComputedStyle(document.querySelector('.preppill.asking .prepmark')).animationName`)
check('and it is moving', askAnim === 'prepbreathe', String(askAnim))

await p.locator('.preppill').click()
await p.waitForTimeout(1300)
const madeText = (await p.locator('.preppill').innerText()).replace(/\n/g, ' ')
check('tapping turns it into a running stopwatch',
  /making milk/.test(madeText) && /\d+:\d{2}/.test(madeText), madeText)
check('the motion changes with the state, rather than stopping',
  (await p.evaluate(
    `getComputedStyle(document.querySelector('.preppill.making .prepmark')).animationName`))
  === 'preprock',
  String(await p.evaluate(
    `getComputedStyle(document.querySelector('.preppill.making .prepmark')).animationName`)))

// The owner's call in D-050: the tap-to-stop from the handoff AND the
// clear-on-feed rule from D-045 both hold. This is the first half.
check('it offers the way back out', /tap to stop/.test(madeText), madeText)
await p.locator('.preppill').click()
await p.waitForTimeout(300)
check('and tapping again stops it',
  /make milk/.test(await p.locator('.preppill').innerText()),
  (await p.locator('.preppill').innerText()).replace(/\n/g, ' '))
await p.locator('.preppill').click()
await p.waitForTimeout(400)

// This screen is remounted by `key={saved}` on every save — the trap the lead
// rail fell into. A diaper is not a feed, so the count must survive it.
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(250)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
await p.getByLabel('elapsed view').click()
await p.waitForTimeout(250)
check('a save that is not a feed leaves the count running',
  /making milk/.test(await p.locator('.preppill').innerText().catch(() => 'absent')),
  (await p.locator('.preppill').innerText().catch(() => 'absent')).replace(/\n/g, ' '))

// And the second half: a feed pushes the ceiling hours out, which takes the
// pill off this tab and the stored timer with it. One tap — the bottle writes
// straight to the log now, with no sheet to save.
await p.getByLabel('log a feed').click()
await p.waitForTimeout(900)
check('logging a feed clears the pill and the count with it',
  (await p.locator('.preppill').count()) === 0,
  `${await p.locator('.preppill').count()} pill(s)`)
check('and it does not come back on the next render',
  await p.evaluate(() => localStorage.getItem('babyliana.making')) === null,
  String(await p.evaluate(() => localStorage.getItem('babyliana.making'))))

// --- the next-feeds lead and the tune screen (D-050) -------------------------
// The feed logged above is still open, so the bar shows "end feed" rather than
// the quick bottle. Close it: the estimate counts from a feed, not from a
// running one.
await p.locator('nav.tabs [aria-label="end feed"]').click()
await p.waitForTimeout(900)
await p.getByLabel('next feeds view').click()
await p.waitForTimeout(300)

check('the next-feeds lead names four times',
  (await p.locator('.nextfeed').count()) === 1 && (await p.locator('.laterfeed').count()) === 3,
  `${await p.locator('.nextfeed').count()} + ${await p.locator('.laterfeed').count()}`)
// Each later row says which window produced it, so a sequence that changes
// interval halfway explains itself rather than looking wrong.
check('and each later one names the interval behind it',
  (await p.locator('.gapchip').count()) === 3,
  (await p.locator('.laterfeed').first().innerText()).replace(/\n/g, ' '))
// The tone rule: a distance, never a verdict. `overdue` in rose was the
// handoff's wording and is deliberately not taken (CLAUDE.md).
check('the distances are distances, with no verdict in them',
  !/overdue|late/i.test(await p.locator('.herocard').innerText()),
  (await p.locator('.nextfeed').innerText()).replace(/\n/g, ' '))

const noOver = await p.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('and the whole lead stays inside the page', noOver === 0, `${noOver}px overflow`)

// The tune button, and the one thing it must do: change the gap and have both
// the estimate and the ceiling follow it.
const before = await p.locator('.nextfeed b').innerText()
await p.getByLabel('settings').click()
await p.waitForTimeout(350)
// The cycle is one section of five now (D-055), and the button that opens them
// says `settings` rather than `feeding cycle settings`.
check('the tune button opens settings, with the cycle among them',
  (await p.locator('.setsheet').count()) === 1 && (await p.locator('.setblock').count()) === 5,
  `${await p.locator('.setblock').count()} section(s)`)
check('and every section says whose setting it is',
  (await p.locator('.scope.shared').count()) === 4
  && (await p.locator('.scope.local').count()) === 1,
  `${await p.locator('.scope.shared').count()} shared, ${await p.locator('.scope.local').count()} local`)
// **Neither a count nor a kind of hardware**, and both were shipped once.
// "both phones" capped a household that `device` does not cap — anything
// entering with the shared baby id mints its own row. "every phone" then named
// the owner's hardware: this is a PWA, so it installs on a laptop or a tablet
// just as well. Two separate assumptions, one chip, both guarded here.
const scopeWords = (await p.locator('.scope').allInnerTexts()).join(' ').toLowerCase()
check('the scope labels say who, not how many and not what kind',
  /everyone/.test(scopeWords) && /only here/.test(scopeWords),
  scopeWords.replace(/\n/g, ' '))
check('and name no hardware and no count',
  !/phone|laptop|tablet|\bboth\b|\btwo\b/.test(scopeWords),
  scopeWords.replace(/\n/g, ' '))
// Both windows, so the check does not depend on which one the clock is in
// when the suite runs — the fault this repo has spent two days removing.
await p.getByLabel('decrease day gap').click()
await p.waitForTimeout(150)
await p.getByLabel('decrease night gap').click()
await p.waitForTimeout(150)
// No save button: the write happened on the tap. Closing is just closing, and
// the estimate behind has already moved.
check('there is no save button to press',
  (await p.locator('.setsheet .save').count()) === 0, 'every control commits itself')
await p.locator('.setsheet').getByLabel('close').click()
await p.waitForTimeout(500)
const after = await p.locator('.nextfeed b').innerText()
check('a changed gap moves the estimate', before !== after, `${before} → ${after}`)
// The ceiling reads the same cycles, which is why they left `targetWake`.
await p.getByLabel('elapsed view').click()
await p.waitForTimeout(250)
check('and the wake line follows the same change',
  (await p.locator('.wakeline').innerText()).includes(after.trim()),
  `${(await p.locator('.wakeline').innerText()).replace(/\n/g, ' ')} vs ${after}`)

await b.close()
stop()
console.log(fail === 0 ? '\n  hero fits' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
