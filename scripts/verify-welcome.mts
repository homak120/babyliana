import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'

// The welcome is two pages: a gate, then the name. And the mascot art was one of
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
// Both themes draw the night set while `DAY_ART_IN_USE` is false — the owner is
// trying one character across the whole day. This asserts the switch is off
// rather than that the day art is gone: nothing was deleted, and the day set
// comes back by flipping that one flag, at which point these three checks
// invert back to what they said before.
check('the day theme draws the night art too', !/-day/.test(daySrc), daySrc.split('/').pop() ?? '')
await ctx.close()

const night = await fresh(23)
await night.p.locator('#code').fill('08242026')
await night.p.locator('.save').click()
await night.p.waitForTimeout(300)
await night.p.getByPlaceholder('Anya').fill('Anya')
await night.p.getByRole('button', { name: 'start logging' }).click()
await night.p.waitForTimeout(600)
const nightSrc = await night.p.evaluate(() => (document.querySelector('.mascot source') as HTMLSourceElement).srcset)
check('the night theme uses the night art', !/-day/.test(nightSrc), nightSrc.split('/').pop() ?? '')
check('and both themes land on the same file', daySrc === nightSrc, `${daySrc} vs ${nightSrc}`)
await night.ctx.close()

// --- the recovery code (D-042) ----------------------------------------------
//
// The same gate, a different door: `01202012` skips the name page and lists the
// devices already on the server, so a reinstalled phone takes its own identity
// back instead of minting a second one under the same name.

// The failure path first, on the context every other suite runs in — supabase
// aborted, which is exactly "cannot reach the list".
const off = await fresh(10)
await off.p.locator('#code').fill('01202012')
await off.p.locator('.gate .save').click()
await off.p.waitForTimeout(400)
check('the recovery code opens the device page, not the name page',
  (await off.p.locator('.recover').count()) === 1
  && (await off.p.getByPlaceholder('Anya').count()) === 0,
  `${await off.p.locator('.recover').count()} recovery page(s)`)
check('and it greets you before it asks anything',
  (await off.p.locator('.recover h1').innerText()).includes('so good to see you'),
  await off.p.locator('.recover h1').innerText())
// Waited for rather than slept on: the client does not give up the moment the
// request is aborted, so a fixed pause caught the page still saying "looking
// for your phones". That wait is the honest shape of being offline here.
const t0 = Date.now()
await off.p.locator('.gateerr').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
const waited = Date.now() - t0
const errs = await off.p.locator('.gateerr').count()
const lists = await off.p.locator('.devlist').count()
check('an unreachable list says so rather than showing an empty one',
  errs === 1 && lists === 0,
  `${errs} error(s), ${lists} list(s), after ${waited}ms`)
check('with a way to try again', (await off.p.getByRole('button', { name: /try again/ }).count()) === 1,
  `${await off.p.getByRole('button', { name: /try again/ }).count()} retry button(s)`)

// The way out. Without it a failed fetch is a dead end on a page with no tabs.
await off.p.getByRole('button', { name: /back/ }).click()
await off.p.waitForTimeout(300)
check('and a way back to the gate', (await off.p.locator('.gate').count()) === 1,
  `${await off.p.locator('.gate').count()} gate(s)`)
await off.ctx.close()

// Now the list itself, with the device table stubbed. The suites serve their
// own build and touch no database (`status.md`), so the rows are fulfilled here
// rather than fetched — what is under test is the page, not PostgREST.
const ID = '11111111-2222-3333-4444-555555555555'
const rec = await fresh(10)
await rec.p.route('**://*.supabase.co/rest/v1/device*', (r) => r.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify([
    { id: ID, name: 'Ho', created_at: null, updated_at: null, updated_by: null },
    { id: '99999999-8888-7777-6666-555555555555', name: 'Anya', created_at: null, updated_at: null, updated_by: null },
  ]),
}))
await rec.p.locator('#code').fill('01202012')
await rec.p.locator('.gate .save').click()
await rec.p.waitForTimeout(900)
const names = await rec.p.locator('.devlist b').allInnerTexts()
check('every device on the server is offered, by name',
  names.length === 2 && names.includes('Ho') && names.includes('Anya'), names.join(', '))
check('and each carries enough of its id to tell two apart',
  (await rec.p.locator('.devlist span').first().innerText()).includes('…'),
  await rec.p.locator('.devlist span').first().innerText())

// The point of the whole flow: the chosen id is taken, not a fresh one minted.
await rec.p.getByRole('button', { name: /Ho/ }).click()
await rec.p.waitForTimeout(900)
const stored = await rec.p.evaluate(() => localStorage.getItem('babyliana.device_id'))
check('picking one adopts that exact id rather than minting a new one',
  stored === ID, `${stored} vs ${ID}`)
check('and it lands in the app, with no name page in between',
  (await rec.p.locator('.log').count()) === 1 && (await rec.p.getByPlaceholder('Anya').count()) === 0,
  `${await rec.p.locator('.log').count()} log screen(s)`)
// The name comes from the adopted row, which is why it is written locally
// before the app opens rather than waited on from the next sync.
check('and the app already knows whose phone this is',
  (await rec.p.locator('.whos').innerText()).includes('H'),
  (await rec.p.locator('.whos').innerText()).replace(/\n/g, ' '))
await rec.ctx.close()

await b.close()
stop()
console.log(fail === 0 ? '\n  welcome and the art sets are right' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
