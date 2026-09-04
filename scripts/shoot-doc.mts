import { chromium } from 'playwright'
import { resolve } from 'node:path'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } })
await page.goto('file://' + resolve('.specify/memory/design/handoff/prototype/BabyLiana.dc.html'), {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(2500)
const h = await page.evaluate('document.body.scrollHeight')
console.log('  doc height:', h)
// slice it, so each band is readable rather than one enormous strip
for (let i = 0, y = 0; y < (h as number) && i < 8; i++, y += 1200) {
  await page.evaluate(`window.scrollTo(0, ${y})`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `scripts/shots/doc-${String(i).padStart(2, '0')}.png` })
  console.log(`  doc-${String(i).padStart(2, '0')}.png @ ${y}`)
}
await browser.close()
