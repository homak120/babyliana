import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

// iOS launch screens, and the reason they exist.
//
// An installed iOS web app shows a **white** screen for the whole of its launch
// unless the page offers an `apple-touch-startup-image` at that device's exact
// pixel size. The manifest's `background_color` does not reliably stand in for
// one. That window is the OS bringing the web view up — before any of this
// app's code runs, and measurably longer than the app's own boot, which reaches
// first paint in 60ms on a phone-class CPU (D-065).
//
// So the fix is not to make the app faster. It is to hand iOS something to draw.
//
// Rendered rather than drawn by hand: twelve fixed sizes that have to stay in
// step with one ground colour and one icon, which is a script's job. Run
// `npx tsx scripts/splash.mts` after either of those changes.

/** Exactly the manifest's `background_color`, and `--bg` in the day theme. */
const GROUND = '#fdf7f2'

/**
 * Every iPhone this app could be installed on, portrait only — the manifest
 * locks orientation, and a landscape set would double twelve files for a case
 * that cannot happen.
 *
 * `[cssWidth, cssHeight, dpr]`. iOS matches on the CSS dimensions and the pixel
 * ratio, and the image must be the product of the two or it is ignored without
 * a word.
 */
const DEVICES: [number, number, number][] = [
  [320, 568, 2], // SE 1
  [375, 667, 2], // SE 2/3, 8
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 2], // XR, 11
  [414, 896, 3], // XS Max, 11 Pro Max
  [390, 844, 3], // 12, 13, 14
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3], // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
]

/*
 * The ground and nothing else.
 *
 * The app's mark was on these for one draft and cost 2.1MB across the twelve,
 * because the art is photographic and PNG charges for that; flat colour is 15KB
 * a file. Apple's own guidance argues the same way from the other end — a launch
 * screen should resemble the first screen of the app rather than carry a logo,
 * and the first screen of this app is this colour.
 *
 * One set, in the day ground. The app's theme follows the clock, and iOS can
 * only pick an image by media query, so a night launch goes cream then dark.
 * That is a colour changing, which is the thing this replaces being white.
 */
const page = `<!doctype html><meta charset="utf-8">
<style>html, body { margin: 0; height: 100%; background: ${GROUND}; }</style>`

rmSync('public/splash', { recursive: true, force: true })
mkdirSync('public/splash', { recursive: true })
const browser = await chromium.launch()
const links: string[] = []

for (const [cw, ch, dpr] of DEVICES) {
  const w = cw * dpr
  const h = ch * dpr
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.setContent(page, { waitUntil: 'load' })
  const file = `public/splash/${w}x${h}.png`
  await p.screenshot({ path: file })
  await ctx.close()
  links.push(
    `    <link rel="apple-touch-startup-image" href="/splash/${w}x${h}.png"\n`
    + `      media="(device-width: ${cw}px) and (device-height: ${ch}px)`
    + ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  )
  console.log(`  ${w}x${h}`)
}

await browser.close()

// Printed rather than written into index.html: the tags are static, they belong
// in the file a reader opens first, and a script that edits the head is a script
// nobody can see the output of.
writeFileSync('scripts/splash-links.html', links.join('\n') + '\n')
console.log(`\n${DEVICES.length} launch screens. Tags in scripts/splash-links.html.`)
