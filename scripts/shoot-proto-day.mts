import { chromium, devices } from 'playwright'
import { resolve } from 'node:path'
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 430, height: 932 } })
const page = await ctx.newPage()
await page.goto('file://' + resolve('.specify/memory/design/handoff/prototype/Phone.dc.html'), {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(1500)

// the tab bar is at the bottom; the calendar icon is the day screen
const icons = await page.locator('text=calendar_month').all()
console.log('  calendar_month targets:', icons.length)
if (icons.length) {
  await icons[icons.length - 1].click({ force: true })
  await page.waitForTimeout(900)
}
await page.screenshot({ path: 'scripts/shots/proto-day.png' })
console.log('  proto-day.png')

// and the add sheet
const add = await page.locator('text=add').all()
console.log('  add targets:', add.length)
if (add.length) {
  await add[add.length - 1].click({ force: true })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'scripts/shots/proto-sheet.png' })
  console.log('  proto-sheet.png')
}
await browser.close()
