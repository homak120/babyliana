import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

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
const w = p.getByPlaceholder('Anya')
if (await w.isVisible().catch(() => false)) {
  await w.fill('Anya'); await p.getByRole('button', { name: 'start logging' }).click(); await p.waitForTimeout(400)
}
await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ milk' }).click()
await p.getByRole('button', { name: '6', exact: true }).click()
await p.getByRole('button', { name: '0', exact: true }).click()
await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(600)

let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }

// Every shape formatElapsed can produce, longest last.
for (const text of ['24m', '1h 05m', '14h 21m', '23h 59m', '999h 59m']) {
  const r = await p.evaluate((t) => {
    const el = document.querySelector('.elapsed') as HTMLElement
    el.textContent = t
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
check('mascot slot 100x96 with 108px art', geo.slot === '100x96' && geo.art === '108x108', `slot ${geo.slot}, art ${geo.art}`)

await b.close()
stop()
console.log(fail === 0 ? '\n  hero fits' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
