import { chromium, devices } from 'playwright'

// page.evaluate bodies are passed as strings: tsx's transform injects helpers
// that do not exist inside the browser context.
const PROBE = `(() => {
  const out = {}
  const look = (label, sel, props) => {
    const el = document.querySelector(sel)
    if (!el) { out[label] = 'MISSING'; return }
    const c = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    out[label] = Object.assign(
      { box: Math.round(r.width) + 'x' + Math.round(r.height) },
      Object.fromEntries(props.map((p) => [p, c.getPropertyValue(p)])),
    )
  }
  look('html', 'html', ['font-size'])
  look('main.log', 'main.log', ['max-width', 'padding-top'])
  look('statusrow', '.statusrow', ['display', 'justify-content'])
  look('fab', '.fab', ['width', 'height', 'border-radius'])
  look('tab button', '.tabs button', ['width', 'height', 'flex-grow'])
  look('elapsed', '.elapsed', ['font-size'])
  look('hero', '.hero', ['display', 'gap'])
  return out
})()`

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.evaluate("localStorage.setItem('babyliana.welcomed','1')")
await page.reload({ waitUntil: 'networkidle' })
console.log(JSON.stringify(await page.evaluate(PROBE), null, 2))
await browser.close()
