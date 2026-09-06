import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// Three of the five secondary types carry a field now (D-036), and the logic is
// covered in verify-s6. What is checked here is the part a data-layer suite
// cannot see: that the field renders where the thumb expects it, that a decimal
// point survives being typed on a touch keypad, and that the value reads back on
// the day table rather than being write-only.
//
// The decimal is the one worth a browser. A number-typed input drops the "." in
// "3." as fast as it is entered, which passes every unit test ever written for
// it and is unusable in the hand.
const PORT = 4200
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

// --- the block opens as five rows and nothing else ---
await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ other', exact: true }).click()
await p.waitForTimeout(300)
check('five types, no fields until one is picked',
  (await p.locator('.otherrow').count()) === 5 && (await p.locator('.otherfields').count()) === 0,
  `${await p.locator('.otherrow').count()} rows, ${await p.locator('.otherfields').count()} field groups`)

// --- weight ---
await p.getByRole('button', { name: 'weight', exact: true }).click()
await p.waitForTimeout(200)
check('picking weight reveals one field',
  (await p.locator('.otherfield').count()) === 1,
  `${await p.locator('.otherfield').count()} field(s)`)
check('and it is labelled in kg',
  (await p.locator('.fieldbox i').innerText()) === 'kg',
  await p.locator('.fieldbox i').innerText())

await p.getByLabel('weight', { exact: true }).fill('3.4')
await p.waitForTimeout(150)
check('a decimal point survives being typed',
  (await p.getByLabel('weight', { exact: true }).inputValue()) === '3.4',
  await p.getByLabel('weight', { exact: true }).inputValue())

const fits = await p.evaluate(() => {
  const box = document.querySelector('.fieldbox') as HTMLElement
  const input = box.querySelector('input') as HTMLElement
  const unit = box.querySelector('i') as HTMLElement
  const sheet = document.querySelector('.sheet') as HTMLElement
  const r = box.getBoundingClientRect()
  const ri = input.getBoundingClientRect(), ru = unit.getBoundingClientRect()
  return {
    tall: Math.round(r.height),
    inside: Math.round(r.right) <= Math.round(sheet.getBoundingClientRect().right),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    // The unit beside the number, not under it. Centres, not tops: the input is
    // 46px tall and the unit is a 13px glyph, so their tops legitimately differ.
    sameRow: Math.abs((ri.top + ri.height / 2) - (ru.top + ru.height / 2)) < 6
      && Math.round(ru.left) >= Math.round(ri.right) - 1,
  }
})
check('the field is a thumb-sized target inside the sheet',
  fits.tall >= 44 && fits.inside && fits.overflow === 0,
  `${fits.tall}px tall, ${fits.overflow}px page overflow`)
// This asserts the intended layout, but be clear about what it is worth: with
// the bug in place — `.otherfield > span` outspecifying `.fieldbox` and killing
// the flex row — **Chromium still passes this check**. It gives the input a
// narrow enough default that the unit fits beside it anyway. iOS Safari gives it
// a wider one and wrapped "kg" underneath, and the Simulator is what found it.
// Kept as a regression guard on the rule, not as proof the rule holds on a
// phone. That is `scripts/ios/`, and this is the fourth time that has been true.
check('the unit sits beside the number, on one row',
  fits.sameRow && fits.tall <= 60,
  `${fits.tall}px tall, same row: ${fits.sameRow}`)

await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(800)
check('the weight reads back on the log, in kg',
  (await p.locator('.row').first().innerText()).includes('3.4 kg'),
  (await p.locator('.row').first().innerText()).replace(/\n/g, ' '))

// --- reopening keeps it ---
// The row opens for editing behind a swipe, not a tap — the same gesture
// verify-swipe guards, driven through CDP because Playwright's mouse does not
// produce the touch events the row listens for.
const cdp = await ctx.newCDPSession(p)
async function swipeOpen() {
  const box = (await p.locator('.row.swipeable').first().boundingBox())!
  const y = box.y + box.height / 2, x0 = box.x + box.width - 30
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
  for (let i = 1; i <= 14; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x0 - (150 * i) / 14, y }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(400)
}
await swipeOpen()
// `.rowactions .edit`, not the button named "edit": the status row's
// name-this-phone control is also called edit and comes first in the document,
// so by-name matching opens the name prompt instead of the entry.
await p.locator('.rowactions .act.edit').first().click()
await p.waitForTimeout(400)
check('reopening the entry fills the field back in',
  (await p.getByLabel('weight', { exact: true }).inputValue()) === '3.4',
  await p.getByLabel('weight', { exact: true }).inputValue())

// Switching type clears what the old one held — a 3.4 must not be filed as a
// temperature by two taps.
await p.getByRole('button', { name: 'weight', exact: true }).click()
await p.waitForTimeout(200)
await p.getByRole('button', { name: 'temperature', exact: true }).click()
await p.waitForTimeout(200)
check('unpicking a type clears its value',
  (await p.getByLabel('temperature', { exact: true }).inputValue()) === '',
  `"${await p.getByLabel('temperature', { exact: true }).inputValue()}"`)

// --- supplement asks two things ---
await p.getByRole('button', { name: 'temperature', exact: true }).click()
await p.waitForTimeout(150)
await p.getByRole('button', { name: 'supplement', exact: true }).click()
await p.waitForTimeout(200)
check('supplement asks what and how much',
  (await p.locator('.otherfield').count()) === 2,
  `${await p.locator('.otherfield').count()} field(s)`)

await p.getByLabel('what', { exact: true }).fill('vitamin D')
await p.getByLabel('how much', { exact: true }).fill('1 drop')
// "save changes", not "save" — this sheet was opened on an existing entry.
await p.getByRole('button', { name: 'save changes', exact: true }).click()
await p.waitForTimeout(800)
check('both read back on the row',
  (await p.locator('.row').first().innerText()).includes('vitamin D 1 drop'),
  (await p.locator('.row').first().innerText()).replace(/\n/g, ' '))

// --- spit up still carries nothing ---
await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ other', exact: true }).click()
await p.getByRole('button', { name: 'spit up', exact: true }).click()
await p.waitForTimeout(200)
check('the two that carry no value still show no fields',
  (await p.locator('.otherfields').count()) === 0,
  `${await p.locator('.otherfields').count()} field group(s)`)

await b.close()
stop()
console.log(fail === 0 ? '\n  the secondary types take their values' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
