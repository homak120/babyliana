import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// The insights screen, rendered rather than reasoned about.
//
// verify-insights covers the arithmetic with no browser at all. This one exists
// because this project has repeatedly shipped a screen that computed the right
// numbers and drew nothing — the charts are absolutely-sized boxes and the
// heatmap is 24 flex children per row, both of which fail silently.
const PORT = 4199
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

// --- something to report on -------------------------------------------------
// The bottle writes straight to the log; the diaper still goes through the
// sheet, so the two are seeded differently on purpose.
await p.getByLabel('log a feed').click()
await p.waitForTimeout(500)
await p.getByLabel('log a diaper').click()
await p.waitForTimeout(250)
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(350)

// --- getting there ----------------------------------------------------------
await p.getByLabel('day').click()
await p.waitForTimeout(300)

check('the report opens on the log', (await p.locator('.table').count()) === 1, 'table present')
check('and the mode pills are offered', (await p.locator('.modepill').count()) === 2, 'log + insights')
check('insights is not the default', (await p.locator('.insights').count()) === 0, 'log leads')

await p.getByRole('button', { name: 'insights' }).click()
await p.waitForTimeout(350)

check('insights replaces the table', (await p.locator('.insights').count()) === 1, 'switched')
check('the date strip goes with it', (await p.locator('.datestrip').count()) === 0, 'hidden')
check('and so do the add actions', (await p.getByLabel('log a feed').count()) === 0, 'read-back only')

// --- the cards --------------------------------------------------------------
const titles = await p.locator('.cardTitle').allInnerTexts()
const has = (t: string) => titles.some((x) => x.toLowerCase().includes(t))
check('milk intake card', has('milk intake'), titles.join(' / '))
check('daily rhythm card', has('daily rhythm'), titles.join(' / '))
check('wet and poop cards', has('wet') && has('poop'), titles.join(' / '))
check('sleep card', has('sleep'), titles.join(' / '))
check('growth is absent with nothing weighed', !has('growth'), titles.join(' / '))

// --- the heatmap actually has width ----------------------------------------
// A row of 24 flex children inside a card that is itself flex has collapsed to
// zero before. Measured, not counted.
const cells = await p.locator('.heatRow').first().locator('.heatCell').count()
check('a heat row is 24 hours wide', cells === 24, String(cells))
const cell = await p.locator('.heatCell').first().boundingBox()
check('and its cells have real width', !!cell && cell.width > 4, cell ? `${Math.round(cell.width)}px` : 'no box')

// --- the bars are drawn, not just present ----------------------------------
// Only that the bar is laid out with real width and at least its floor height.
// One day of one 60 mL feed is its own maximum, so the height this proves is a
// layout fact rather than a scale one — verify-insights covers the arithmetic
// that decides how tall a bar should be, with no browser at all.
const bar = await p.locator('.barFill').first().boundingBox()
check('a bar is laid out', !!bar && bar.height >= 3 && bar.width > 4,
  bar ? `${Math.round(bar.width)}x${Math.round(bar.height)}` : 'no box')

// --- the range strip (D-063) ------------------------------------------------
check('7d is the default range',
  (await p.locator('.spanPill.on').innerText()).trim() === '7d',
  (await p.locator('.spanPill.on').innerText()).trim())
await p.getByRole('button', { name: '3d' }).click()
await p.waitForTimeout(250)
check('3d takes over', (await p.locator('.spanPill.on').innerText()).trim() === '3d', 'switched')

// The four counted spans, plus a pill for the month the seed lands in. Months
// are offered from the log rather than generated, so this is also the check
// that a month with data gets a pill at all.
const railText = (await p.locator('.spanStrip').innerText()).replace(/\n/g, ' ')
check('the longer spans are offered', /15d/.test(railText) && /30d/.test(railText), railText)
check('and the month the log is in', /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(railText), railText)
check('all time is folded away until asked for',
  !/\ball\b/.test(railText), railText)

await p.getByRole('button', { name: 'more', exact: true }).click()
await p.waitForTimeout(200)
check('more unfolds it', /\ball\b/.test((await p.locator('.spanStrip').innerText()).replace(/\n/g, ' ')),
  (await p.locator('.spanStrip').innerText()).replace(/\n/g, ' '))

await p.getByRole('button', { name: '30d' }).click()
await p.waitForTimeout(250)
check('a month-long span still draws its bars',
  (await p.locator('.barFill').first().boundingBox())!.width > 2, 'laid out')
check('and the strip does not push the page sideways',
  (await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0,
  'no overflow')
await p.getByRole('button', { name: '7d' }).click()
await p.waitForTimeout(250)

// --- nothing overflows the phone -------------------------------------------
// Wide content on this screen is a chart, and a chart that pushes the body
// sideways breaks every other screen with it.
// --- the three charts added in D-049 ----------------------------------------
for (const title of ['diapers a day', 'by source'] as const) {
  check(`the ${title} card renders`,
    (await p.locator('.card', { hasText: new RegExp(title, 'i') }).count()) === 1,
    `${await p.locator('.card', { hasText: new RegExp(title, 'i') }).count()} card(s)`)
}
// Two series each, so a legend is not optional — the wet/dirty pair sits in the
// CVD floor band and the words are what carry the difference.
check('every stacked chart names its series in a legend',
  (await p.locator('.legend').count()) >= 3,
  `${await p.locator('.legend').count()} legends`)
check('and the diaper legend counts as well as names',
  /wet \d+/.test(await p.locator('.legend').nth(1).innerText()),
  (await p.locator('.legend').nth(1).innerText()).replace(/\n/g, ' '))
// A stack whose parts do not sum to its own total would be a lie about the day.
const stacks = await p.evaluate(`(() => {
  const out = [];
  document.querySelectorAll('.stack').forEach((st) => {
    let parts = 0;
    st.querySelectorAll('.seg').forEach((sg) => { parts += sg.getBoundingClientRect().height; });
    out.push([Math.round(parts), Math.round(st.getBoundingClientRect().height)]);
  });
  return out;
})()`) as [number, number][]
check('a stack is exactly its segments plus their gaps',
  stacks.length > 0 && stacks.every(([parts, total]) => total - parts <= 4 && total >= parts),
  stacks.map(([a, c]) => `${a}/${c}`).join(' '))
// --- a day's own breakdown (D-062) ------------------------------------------
// The stack is the only place the source split is drawn, and reading a number
// off it takes a ruler. The tap is what turns it into figures, so the tap is
// what is worth checking in a browser.
const srcCard = p.locator('.card', { hasText: /by source/i })
check('the source chart offers its days as buttons',
  (await srcCard.locator('button.bar.pick').count()) >= 1,
  `${await srcCard.locator('button.bar.pick').count()} tappable`)
check('and says nothing about one day until asked',
  (await p.locator('.split').count()) === 0, 'range summary leads')

await srcCard.locator('button.bar.pick').last().click()
await p.waitForTimeout(250)
check('a tapped day opens its breakdown', (await p.locator('.split').count()) === 1, 'panel open')
const splitText = (await p.locator('.split').innerText()).replace(/\n/g, ' ')
check('the breakdown gives the day a clear total', /\d+ mL/.test(splitText), splitText)
check('and a share for every band it draws',
  (await p.locator('.splitRow').count()) >= 1 && /\d+%/.test(splitText), splitText)
// The shares are a decomposition of one day; printing 101% would be the same
// lie the stack is checked against above.
const pcts = (await p.locator('.splitPct').allInnerTexts()).map((t) => parseInt(t, 10))
check('the shares add to exactly 100',
  pcts.reduce((a, n) => a + n, 0) === 100, pcts.join(' + '))
check('the tapped day is marked on the chart',
  (await srcCard.locator('button.bar.pick.on').count()) === 1, 'one day selected')

await srcCard.locator('button.bar.pick.on').click()
await p.waitForTimeout(250)
check('and tapping it again goes back to the range',
  (await p.locator('.split').count()) === 0, 'panel closed')

// The poop tally only exists when something has been logged with a colour; the
// seeded diaper above has none, so it is absent, which is the point.
check('the colour tally stays away until a colour is recorded',
  (await p.locator('.tally').count()) === 0, 'no colours logged in this range')

const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('the page does not scroll sideways', overflow <= 0, `${overflow}px over`)

// Taken here, in insights, and not at the end — the first version shot after
// switching back and captured the log table under an "insights" filename.
await p.locator('.spanPill', { hasText: '7d' }).click()
await p.waitForTimeout(250)
await p.screenshot({ path: 'scripts/shots/insights.png', fullPage: true })

// --- back to the log --------------------------------------------------------
// Scoped to the pill: the bar's back button also answers to "log", and an
// ambiguous locator is a test that breaks the next time the bar changes.
await p.locator('.modepill').first().click()
await p.waitForTimeout(250)
check('the log comes back', (await p.locator('.table').count()) === 1, 'table again')

// --- the page summary (D-063) -----------------------------------------------
// The tag row was all a page said. This is the rest of what it holds, and the
// seed has a feed and a change in it, so two of its lines must be there.
const sum = (await p.locator('.daysum').innerText()).replace(/\n/g, ' ')
check('the page summarises what it holds', (await p.locator('.daysum').count()) === 1, sum)
check('the milk line names the volume and the count', /mL over \d+ feed/.test(sum), sum)
check('and the diaper line counts the change', /\d+ wet|\d+ dirty/.test(sum), sum)

console.log(fail === 0 ? '\n  the insights screen renders' : `\n  ${fail} FAILED`)
await b.close()
stop()
process.exit(fail === 0 ? 0 : 1)
