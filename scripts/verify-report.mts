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
for (const label of ['log a feed', 'log a diaper'] as const) {
  await p.getByLabel(label).click()
  await p.waitForTimeout(250)
  await p.getByRole('button', { name: 'save', exact: true }).click()
  await p.waitForTimeout(350)
}

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
// Only that the bar is laid out with real width and its floor height. The feed
// saved above carries no volume, so its bar is legitimately the 3px minimum —
// proving a *tall* bar needs a seeded volume, which verify-insights covers as
// arithmetic instead.
const bar = await p.locator('.barFill').first().boundingBox()
check('a bar is laid out', !!bar && bar.height >= 3 && bar.width > 4,
  bar ? `${Math.round(bar.width)}x${Math.round(bar.height)}` : 'no box')

// --- the range toggle -------------------------------------------------------
check('7d is the default range',
  (await p.locator('.spanPill.on').innerText()).trim() === '7d',
  (await p.locator('.spanPill.on').innerText()).trim())
await p.getByRole('button', { name: '3d' }).click()
await p.waitForTimeout(250)
check('3d takes over', (await p.locator('.spanPill.on').innerText()).trim() === '3d', 'switched')

// --- nothing overflows the phone -------------------------------------------
// Wide content on this screen is a chart, and a chart that pushes the body
// sideways breaks every other screen with it.
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

console.log(fail === 0 ? '\n  the insights screen renders' : `\n  ${fail} FAILED`)
await b.close()
stop()
process.exit(fail === 0 ? 0 : 1)
