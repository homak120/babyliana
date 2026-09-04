// Screenshots the app and the Phase 2 prototype in the same browser, at the
// same viewport, so the two can actually be compared instead of described.
//
// The design is final (D-021) and the handoff says its colours, type sizes,
// radii and spacing should be matched closely — which is not something anyone
// can check by reading CSS.
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve('scripts/shots')
mkdirSync(OUT, { recursive: true })

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const PROTO =
  'file://' + resolve('.specify/memory/design/handoff/prototype/Phone.dc.html')

// iPhone 14/15 logical size — what the design is specified at.
const iphone = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }

const browser = await chromium.launch()
const ctx = await browser.newContext(iphone)
const page = await ctx.newPage()

const shot = async (name: string) => {
  await page.waitForTimeout(600) // let fonts and the mascot settle
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`  ${name}.png`)
}

console.log('app:')
await page.goto(APP, { waitUntil: 'networkidle' })
await shot('app-01-first')

// Complete setup for real. There is no flag to set any more — the device id
// only exists once a name is submitted, which is the point.
await page.getByPlaceholder('Anya').fill('Anya')
await page.getByRole('button', { name: 'start logging' }).click()
await page.waitForTimeout(800)
await shot('app-02-log')

await page.getByLabel('log a moment').click()
await shot('app-03-sheet-empty')

await page.getByRole('button', { name: '+ milk' }).click()
await shot('app-04-sheet-milk')

await page.getByRole('button', { name: '+ diaper' }).click()
await page.getByRole('button', { name: 'poop', exact: true }).click()
await shot('app-05-sheet-diaper')

await page.getByRole('button', { name: '+ other' }).click()
await shot('app-06-sheet-other')

await page.getByRole('button', { name: 'close' }).click()
await page.getByRole('navigation').getByLabel('day').click()
await shot('app-07-day')

console.log('prototype:')
await page.goto(PROTO, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot('proto-01')

await browser.close()
