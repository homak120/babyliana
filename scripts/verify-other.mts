import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// Weight, temperature and supplement each have a tile of their own now (D-038),
// beside milk, diaper and sleep. They used to be three of five rows behind
// `other`, which meant three taps to reach a thing that captures a number.
//
// The logic is covered in verify-s6. What is checked here is the part a
// data-layer suite cannot see: that each tile renders where the thumb expects
// it, that a decimal point survives being typed on a touch keypad, that a used
// bubble goes away, and that the values read back rather than being write-only.
//
// The decimal is the one worth a browser. A number-typed input drops the "." in
// "7." as fast as it is entered, which passes every unit test ever written for
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
const bubble = (label: string) => p.getByRole('button', { name: new RegExp(`\\+ .*${label}$`) })
const row = () => p.locator('.row').first().innerText()

// --- every type is one tap from the sheet -----------------------------------
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
const offered = await p.locator('.bubble').evaluateAll(
  (els) => els.map((e) => e.className.replace('bubble ', '')).join(','),
)
check('all seven types are offered as tiles',
  offered === 'milk,diaper,sleep,weight,temperature,supplement,other', offered)

// --- weight -----------------------------------------------------------------
await bubble('weight').click()
await p.waitForTimeout(250)
check('the weight tile has one field',
  (await p.locator('.block.weight .otherfield').count()) === 1,
  `${await p.locator('.block.weight .otherfield').count()} field(s)`)
check('and it is labelled in lb',
  (await p.locator('.fieldbox i').innerText()) === 'lb',
  await p.locator('.fieldbox i').innerText())
check('its bubble is gone once the tile exists',
  (await p.locator('.bubble.weight').count()) === 0,
  `${await p.locator('.bubble.weight').count()} weight bubbles`)

await p.getByLabel('weight', { exact: true }).fill('7.25')
await p.waitForTimeout(150)
check('a decimal point survives being typed',
  (await p.getByLabel('weight', { exact: true }).inputValue()) === '7.25',
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
    // Centres, not tops: the input is 46px tall and the unit is a 13px glyph,
    // so their tops legitimately differ.
    sameRow: Math.abs((ri.top + ri.height / 2) - (ru.top + ru.height / 2)) < 6
      && Math.round(ru.left) >= Math.round(ri.right) - 1,
  }
})
check('the field is a thumb-sized target inside the sheet',
  fits.tall >= 44 && fits.inside && fits.overflow === 0,
  `${fits.tall}px tall, ${fits.overflow}px page overflow`)
// This asserts the intended layout, but be clear about what it is worth: with
// the bug it was written for — `.otherfield > span` outspecifying `.fieldbox`
// and killing the flex row — **Chromium still passes**. It gives the input a
// narrow enough default that the unit fits beside it anyway. iOS Safari gives
// it a wider one and wrapped the unit underneath, and the Simulator is what
// found it. A regression guard on the rule, not proof it holds on a phone.
check('the unit sits beside the number, on one row',
  fits.sameRow && fits.tall <= 60,
  `${fits.tall}px tall, same row: ${fits.sameRow}`)

// --- temperature, in the same moment ----------------------------------------
await bubble('temp').click()
await p.waitForTimeout(250)
check('temperature is its own tile beside the weight',
  (await p.locator('.block.weight').count()) === 1
    && (await p.locator('.block.temperature').count()) === 1,
  `${await p.locator('.block.weight').count()} weight, ${await p.locator('.block.temperature').count()} temp`)
await p.getByLabel('temperature', { exact: true }).fill('98.6')
check('and is labelled in °F',
  (await p.locator('.block.temperature .fieldbox i').innerText()) === '°F',
  await p.locator('.block.temperature .fieldbox i').innerText())

await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
// Typed as a decimal, read back the way a scale says it.
check('the weight reads back on the log as lb and oz',
  (await row()).includes('7 lb 4 oz'), (await row()).replace(/\n/g, ' '))
check('and the temperature with its unit',
  (await row()).includes('98.6°F'), (await row()).replace(/\n/g, ' '))

// --- reopening keeps the decimal, not the lb/oz form ------------------------
const cdp = await ctx.newCDPSession(p)
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
// `.rowactions .edit`, not the button named "edit": the status row's
// name-this-phone control is also called edit and comes first in the document.
await p.locator('.rowactions .act.edit').first().click()
await p.waitForTimeout(500)
check('reopening fills the decimal back in, not the lb/oz form',
  (await p.getByLabel('weight', { exact: true }).inputValue()) === '7.25',
  await p.getByLabel('weight', { exact: true }).inputValue())
check('and reopens as tiles, not as an "other" list',
  (await p.locator('.block.weight').count()) === 1
    && (await p.locator('.block.temperature').count()) === 1
    && (await p.locator('.otherlist').count()) === 0,
  `${await p.locator('.otherlist').count()} type lists`)
await p.getByRole('button', { name: 'close' }).click()
await p.waitForTimeout(400)

// --- supplement arrives filled in -------------------------------------------
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
await bubble('supplement').click()
await p.waitForTimeout(250)
const what = p.getByLabel('what', { exact: true })
const howMuch = p.getByLabel('how much', { exact: true })
check('supplement asks what and how much',
  (await p.locator('.block.supplement .otherfield').count()) === 2,
  `${await p.locator('.block.supplement .otherfield').count()} field(s)`)
// The daily vitamin D is the one this app is used for — the same two words and
// the same dose every time, so typing them is pure cost.
check('and both arrive filled in',
  (await what.inputValue()) === 'Vitamin D' && (await howMuch.inputValue()) === '1 drop',
  `"${await what.inputValue()}" / "${await howMuch.inputValue()}"`)

// A suggestion only earns its place if disagreeing with it is free: focusing
// selects what is there, so the first character typed replaces the whole thing
// rather than landing inside "Vitamin D". Typed through the keyboard rather
// than `fill`, which would replace regardless and prove nothing.
await what.click()
await p.keyboard.type('iron')
check('typing over it replaces rather than appends',
  (await what.inputValue()) === 'iron', await what.inputValue())

await p.getByRole('button', { name: 'save', exact: true }).click()
await p.waitForTimeout(900)
check('it reads back on the row',
  (await row()).includes('iron 1 drop'), (await row()).replace(/\n/g, ' '))

// --- what is left behind `other` --------------------------------------------
await p.getByLabel('log a moment').click()
await p.waitForTimeout(300)
await bubble('other').click()
await p.waitForTimeout(250)
const rows = await p.locator('.otherrow').evaluateAll((els) => els.map((e) => e.textContent).join(','))
check('only the two valueless types are left behind other',
  rows === 'spit up,something else', rows)
await p.locator('.otherrow').first().click()
await p.waitForTimeout(200)
check('and picking one shows no fields',
  (await p.locator('.otherfields').count()) === 0,
  `${await p.locator('.otherfields').count()} field groups`)
// `other` is the one bubble that repeats: a moment can carry a spit-up and a
// something-else at once, and neither has a tile.
check('the other bubble stays, because it repeats',
  (await p.locator('.bubble.other').count()) === 1,
  `${await p.locator('.bubble.other').count()} other bubbles`)

// --- the bubbles pair up, whatever the longest word is (D-048) ---------------
//
// `supplement` is five pixels wider than half a row at 390, and a flex item
// cannot shrink below its own text unless told it may — so it took a line of
// its own and left `temp` sitting alone above it. The pairing is the layout.
await p.reload({ waitUntil: 'load' })
await p.waitForTimeout(600)
await p.getByLabel('log a moment').click()
await p.waitForTimeout(400)
const grid = await p.evaluate(`(() => {
  const rows = {}; const clipped = [];
  document.querySelectorAll('.bubble').forEach((el) => {
    const top = Math.round(el.getBoundingClientRect().top);
    const s = el.querySelector('.bubbletext');
    if (s.scrollWidth > s.clientWidth + 1) clipped.push(s.innerText);
    (rows[top] = rows[top] || []).push(s.innerText);
  });
  return { rows: Object.values(rows), clipped,
           over: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth) };
})()`) as { rows: string[][]; clipped: string[]; over: number }

const paired = grid.rows.filter((r) => r.length === 2).length
check('the bubbles sit two to a row, with the odd one last',
  paired === 3 && grid.rows.length === 4 && grid.rows[3].length === 1,
  grid.rows.map((r) => r.join('+')).join(' / '))
check('supplement shares its row with temp rather than taking one',
  grid.rows.some((r) => r.length === 2 && r.includes('supplement') && r.includes('temp')),
  grid.rows.map((r) => r.join('+')).join(' / '))
// It is the label that gives on a narrower phone, never the grid. At this
// width it should not have to give at all.
check('and reads whole at 390, with nothing pushed sideways',
  grid.clipped.length === 0 && grid.over === 0,
  `clipped: ${grid.clipped.join(',') || 'none'}, ${grid.over}px overflow`)

await b.close()
stop()
console.log(fail === 0 ? '\n  the secondary types take their values' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
