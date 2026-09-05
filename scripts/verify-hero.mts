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
  ['combined view', '.combined'],
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
await p.getByLabel('mascot view').click()
await p.waitForTimeout(200)
await p.getByLabel('log a feed').click()
await p.getByRole('button', { name: '3', exact: true }).click()
await p.getByRole('button', { name: '0', exact: true }).click()
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
check('the lead survives a save', (await p.locator('.mascotword').count()) === 1,
  `${await p.locator('.mascotword').count()} mascot lead(s) after saving`)
await p.getByLabel('elapsed view').click()
await p.waitForTimeout(200)

await b.close()
stop()
console.log(fail === 0 ? '\n  hero fits' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
