import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

// Measure a screenshot the owner sent from his actual phone.
//
// Written because "the bottom spacing looks wrong" is not something a desktop
// browser can reproduce — safe-area insets are 0 there — and eyeballing a
// screenshot had already produced one wrong answer. This reads the pixels: it
// found the FAB at 71pt (so the build was current), on the same centre line as
// the tab icons (so that fix had landed), with 104pt below it where 56 was
// expected. That last number is what turned a vague complaint into a bug.
//
//   npx tsx scripts/ios/measure-screenshot.mts <path-to-screenshot.png>
//
// Colour thresholds are tuned to this app's rose FAB and muted tab ink; adjust
// them for anything else.

// Passed as a string: tsx's transform injects a __name helper into function
// literals, which does not exist in the page.
const b = await chromium.launch()
const p = await b.newPage()
await p.goto('about:blank')
const file = process.argv[2]
if (!file) throw new Error('usage: measure-screenshot.mts <screenshot.png>')
const b64 = readFileSync(file).toString('base64')
const r = await p.evaluate(`(async () => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)};
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const at = (px, py) => { const i = (py * c.width + px) * 4; return [d[i], d[i+1], d[i+2]]; };
  // Only the bottom 260pt, where the tab bar lives, so the rose tags and the
  // lavender day pill higher up cannot pollute the match.
  const y0 = Math.round(c.height - 260 * 3);
  const strongRose = (px, py) => { const a = at(px, py);
    return a[0] > 195 && a[0] < 250 && a[1] > 95 && a[1] < 155 && a[2] > 115 && a[2] < 180; };
  const rows = [];
  for (let py = y0; py < c.height; py++) {
    let n = 0;
    for (let px = 0; px < c.width; px++) if (strongRose(px, py)) n++;
    rows.push(n);
  }
  let fabTop = -1, fabBottom = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] > 30) { if (fabTop < 0) fabTop = y0 + i; fabBottom = y0 + i; }
  }
  // the paw / calendar icons: muted grey-brown ink
  const isInk = (px, py) => { const a = at(px, py);
    return Math.abs(a[0]-168) < 40 && Math.abs(a[1]-152) < 40 && Math.abs(a[2]-144) < 40; };
  let inkTop = -1, inkBottom = -1;
  for (let py = y0; py < c.height; py++) {
    let n = 0;
    for (let px = 0; px < 300; px++) if (isInk(px, py)) n++;   // left third: the paw
    if (n > 4) { if (inkTop < 0) inkTop = py; inkBottom = py; }
  }
  return { w: c.width, h: c.height,
           fabTop, fabBottom, inkTop, inkBottom,
           bottomPixel: at(c.width >> 1, c.height - 4) };
})()`) as any
const s = r.h / 844
console.log(`  image ${r.w}x${r.h}, ${s}x (logical 390x844)`)
console.log(`  FAB   top ${(r.fabTop/s).toFixed(1)}pt  bottom ${(r.fabBottom/s).toFixed(1)}pt  diameter ${((r.fabBottom-r.fabTop)/s).toFixed(1)}pt`)
console.log(`  paw   top ${(r.inkTop/s).toFixed(1)}pt  bottom ${(r.inkBottom/s).toFixed(1)}pt`)
console.log(`  FAB centre ${(((r.fabTop+r.fabBottom)/2)/s).toFixed(1)}pt, paw centre ${(((r.inkTop+r.inkBottom)/2)/s).toFixed(1)}pt`)
console.log(`  gap below the FAB: ${(844 - r.fabBottom/s).toFixed(1)}pt`)
console.log(`  pixel 4px  from bottom rgb(${r.bottomPixel.join(',')})`)
await b.close()
