import { chromium, devices } from 'playwright'
import { resolve } from 'node:path'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 430, height: 932 } })
const page = await ctx.newPage()
await page.goto('file://' + resolve('.specify/memory/design/handoff/prototype/Phone.dc.html'), {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(1500)
const tap = async (text: string) => {
  const els = await page.getByText(text, { exact: false }).all()
  if (!els.length) return console.log(`  (no "${text}")`)
  await els[els.length - 1].click({ force: true })
  await page.waitForTimeout(700)
}
await tap('add')                       // the FAB
await tap('milk')
await page.screenshot({ path: 'scripts/shots/proto-milk.png' })
console.log('  proto-milk.png')
await tap('diaper')
await page.screenshot({ path: 'scripts/shots/proto-diaper.png' })
console.log('  proto-diaper.png')
await browser.close()
