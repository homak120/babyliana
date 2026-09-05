import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp } from './ui.mts'

// The milk figure must carry its own source's colour, and the drag strip must
// show a fill. Both tokens existed in tokens.css and were simply never used —
// the kind of gap that only a rendered-colour check catches, since the markup
// looked complete.
const PORT = 4193
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
const colourOf = (sel: string) => p.evaluate((s) => getComputedStyle(document.querySelector(s)!).color, sel)

// Resolve a token the same way the page does. Comparing against literals fails
// half the day: the theme switches by clock, so day and night give different
// correct answers for the same rule.
const token = (name: string) =>
  p.evaluate((n) => {
    const el = document.createElement('span')
    el.style.color = `var(${n})`
    document.body.appendChild(el)
    const c = getComputedStyle(el).color
    el.remove()
    return c
  }, name)
const fillWidth = () => p.evaluate(() => {
  const f = document.querySelector('.scrubfill') as HTMLElement
  const s = document.querySelector('.scrub') as HTMLElement
  return Math.round((f.getBoundingClientRect().width / s.getBoundingClientRect().width) * 100)
})

await p.getByLabel('log a moment').click()
await p.getByRole('button', { name: '+ milk' }).click()
await p.waitForTimeout(200)

check('a blank volume reads muted', await colourOf('.part') === await token('--muted'), await colourOf('.part'))
check('an empty strip shows no fill', (await fillWidth()) === 0, `${await fillWidth()}%`)

for (const k of ['6', '0']) await p.getByRole('button', { name: k, exact: true }).click()
check('unmarked volume takes the plain ink', await colourOf('.part') === await token('--ink'), await colourOf('.part'))
check('the strip fills to the volume', (await fillWidth()) === 50, `60 of 120 -> ${await fillWidth()}%`)

await p.getByRole('button', { name: 'breast' }).click()
await p.waitForTimeout(150)
check('breast turns the figure lilac', await colourOf('.part') === await token('--lilacInk'), await colourOf('.part'))

await p.getByRole('button', { name: 'formula' }).click()
await p.waitForTimeout(150)
check('formula turns the figure amber', await colourOf('.part') === await token('--amberInk'), await colourOf('.part'))

const grad = await p.evaluate(() => getComputedStyle(document.querySelector('.scrubfill')!).backgroundImage)
check('the fill is the token gradient', grad.includes('gradient'), grad.slice(0, 58))

await p.locator('.sheet').screenshot({ path: 'scripts/shots/milk-block.png' })
await b.close()
stop()
console.log(fail === 0 ? '\n  milk block matches the design' : `\n  ${fail} FAILED`)
process.exit(fail ? 1 : 0)
