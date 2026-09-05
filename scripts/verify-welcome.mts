import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

// The welcome is two pages: a gate, then the name. And the mascot art is one of
// two sets, chosen by the clock — the day set is the plush, the night set is
// the girl.
const PORT = 4197
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
let fail = 0
const check = (l: string, ok: boolean, d: string) => { if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`) }

async function fresh(clockHour: number) {
  const ctx = await b.newContext({
    ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true,
  })
  const p = await ctx.newPage()
  await p.route('**://*.supabase.co/**', (r) => r.abort())
  // Pin the clock so the theme, and therefore the art set, is deterministic.
  await p.addInitScript((h) => {
    const real = Date
    const fixed = new real(); fixed.setHours(h, 0, 0, 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = class extends real {
      constructor(...a: unknown[]) { super(...(a.length ? a : [fixed]) as []) }
      static now() { return fixed.getTime() }
    }
  }, clockHour)
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
  return { ctx, p }
}

// --- the gate ---
const { ctx, p } = await fresh(10)
check('the welcome opens on the gate', await p.locator('.gate').isVisible(), 'page one')
check('and not on the name page yet', (await p.getByPlaceholder('Anya').count()) === 0, 'name not shown')
check('the button waits for a long-enough code', await p.locator('.save').isDisabled(), 'disabled')

// The gate showed the same art as the name page once, which made both pages of
// the welcome look identical.
const art = await p.evaluate(() => {
  const gate = document.querySelector('.gatephoto source') as HTMLSourceElement
  const box = (document.querySelector('.gatephoto') as HTMLElement).getBoundingClientRect()
  return { src: gate.srcset, w: Math.round(box.width), h: Math.round(box.height), top: Math.round(box.top) }
})
check('the gate has its own art', /gate/.test(art.src), art.src.split('/').pop() ?? '')
const fit = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.gatephoto img')!)
  return `${cs.objectFit} ${cs.objectPosition}`
})
// A photograph fills the block; the earlier stand-in was a transparent asset
// and had to be contained.
check('the photo fills the block', fit.startsWith('cover'), fit)
check('and it is a full-bleed hero', art.w === 390 && art.h === 330 && art.top <= 0,
  `${art.w}x${art.h} at y ${art.top}`)

await p.locator('#code').fill('1234')
await p.locator('.save').click()
await p.waitForTimeout(300)
check('a wrong code is refused', await p.locator('.gateerr').isVisible(), await p.locator('.gateerr').innerText())
check('and it stays on the gate', await p.locator('.gate').isVisible(), 'still page one')

await p.locator('#code').fill('08242026')
await p.locator('.save').click()
await p.waitForTimeout(400)
check('the right code opens the name page', await p.getByPlaceholder('Anya').isVisible(), 'page two')
check('the gate is gone', (await p.locator('.gate').count()) === 0, 'dismissed')

// --- the art sets ---
const srcOf = () => p.evaluate(() => (document.querySelector('.mascot source') as HTMLSourceElement).srcset)
await p.getByPlaceholder('Anya').fill('Anya')
await p.getByRole('button', { name: 'start logging' }).click()
await p.waitForTimeout(600)
const daySrc = await srcOf()
check('the day theme uses the -day art', /-day/.test(daySrc), daySrc.split('/').pop() ?? '')
await ctx.close()

const night = await fresh(23)
await night.p.locator('#code').fill('08242026')
await night.p.locator('.save').click()
await night.p.waitForTimeout(300)
await night.p.getByPlaceholder('Anya').fill('Anya')
await night.p.getByRole('button', { name: 'start logging' }).click()
await night.p.waitForTimeout(600)
const nightSrc = await night.p.evaluate(() => (document.querySelector('.mascot source') as HTMLSourceElement).srcset)
check('the night theme uses the other set', !/-day/.test(nightSrc), nightSrc.split('/').pop() ?? '')
check('the two sets are different files', daySrc !== nightSrc, 'distinct')
await night.ctx.close()

await b.close()
stop()
console.log(fail === 0 ? '\n  welcome and the art sets are right' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
