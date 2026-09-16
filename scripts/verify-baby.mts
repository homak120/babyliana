import { spawn } from 'node:child_process'
import { chromium, devices } from 'playwright'
import { enterApp, TEST_BABY } from './ui.mts'

// A second baby: naming the one you are in, and moving between them (D-060).
//
// **The three things here could only fail on a household that has two**, which
// is why none of them were caught by 699 existing checks — every suite, and the
// real deployment, has exactly one baby. That is the shape of bug this file is
// for: behaviour that is correct right up until the data stops being singular.
//
// Everything Supabase is stubbed. What is under test is the client's half of the
// switch — which log the status row names, which rows survive the swap, which
// settings do not follow you across, and what the pull actually asks for.

const PORT = 4199
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  stdio: 'ignore', detached: true,
})
const stop = () => { try { process.kill(-server.pid!) } catch { /* already gone */ } }
process.on('exit', stop)
for (let i = 0; ; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break } catch {
    if (i > 40) throw new Error('vite preview did not come up')
    await new Promise((r) => setTimeout(r, 250))
  }
}

const b = await chromium.launch()
let fail = 0
const check = (l: string, ok: boolean, d: string) => {
  if (!ok) fail++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${l} — ${d}`)
}

const OTHER = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'

const stamp = '2026-01-01T08:00:00.000Z'
// Finished, not running. An open feed replaces the bar's quick bottle with an
// `end feed` control, and the outbox case below needs something to tap that
// writes a new entry rather than closing this one.
const ended = '2026-01-01T08:20:00.000Z'
const slot = (id: string, babyId: string, carer: string, note: string) => ({
  id, baby_id: babyId, logged_by: carer, occurred_at: stamp, ended_at: ended,
  recorded_at: stamp, updated_at: stamp, updated_by: null, note,
})
const feed = (id: string, timeslotId: string) => ({
  id, timeslot_id: timeslotId, type: 'feed', note: null,
  recorded_at: stamp, updated_at: stamp, updated_by: null,
  volume_ml: 60, source: 'formula',
  pee: null, poop: null, poop_colour: null, poop_consistency: null,
  pounds: null, fahrenheit: null, supplement_name: null, amount: null, severity: null,
})

/**
 * One handler for the whole Data API, answering from the query string.
 *
 * A route per table cannot express this: the point of the exercise is that the
 * *same* table returns different rows depending on which baby is being asked
 * about, which is exactly what a switch changes and what a single fixture body
 * would hide.
 */
async function household(p: import('playwright').Page, carer: string, failWrites = false) {
  const asked: string[] = []
  const wrote: string[] = []
  const rows = {
    [TEST_BABY]: {
      baby: { id: TEST_BABY, name: 'Liana', settings: { prepLeadMinutes: 40 }, created_at: stamp, updated_at: stamp, updated_by: null },
      slot: slot('aaaaaaaa-0000-0000-0000-000000000001', TEST_BABY, carer, 'first-baby-note'),
    },
    [OTHER]: {
      // **No settings at all**, which is what makes the leak visible. With a
      // value of its own the row would simply overwrite whatever this phone was
      // holding and the bug would hide behind a correct-looking answer.
      baby: { id: OTHER, name: 'Nova', settings: null, created_at: stamp, updated_at: stamp, updated_by: null },
      slot: slot('bbbbbbbb-0000-0000-0000-000000000002', OTHER, carer, 'second-baby-note'),
    },
  }

  await p.route('**://*.supabase.co/rest/v1/**', (r) => {
    const req = r.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/').pop() ?? ''
    const json = (body: unknown) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(body),
    })

    if (req.method() !== 'GET') {
      wrote.push(`${req.method()} ${table}`)
      // A refused write leaves the row in the outbox, which is the state the
      // switch has to notice: swapping now would wipe an entry that has never
      // reached anyone else.
      if (failWrites) {
        return r.fulfill({ status: 500, contentType: 'application/json',
          body: JSON.stringify({ message: 'nope' }) })
      }
      return json([])
    }
    asked.push(`${table}${url.search}`)

    // `id=eq.<uuid>` is the pull asking for one row; no filter is `fetchBabies`
    // asking what this household has. Two different questions on one path.
    if (table === 'baby') {
      const one = url.searchParams.get('id')?.replace('eq.', '')
      if (one) return json(one in rows ? [rows[one as keyof typeof rows].baby] : [])
      return json([rows[TEST_BABY].baby, rows[OTHER].baby])
    }
    if (table === 'caregiver') {
      // **The id this install actually minted**, not one of our own. A pull
      // whose caregiver list does not contain this phone's id is a caregiver
      // deleted elsewhere, and `App.tsx` correctly answers that by sending the
      // install back to onboarding — so a fixture that invents an id tests the
      // recovery path instead of the one it meant to.
      return json([{
        id: carer, name: 'Anya', user_id: '55555555-6666-7777-8888-999999999999',
        created_at: stamp, updated_at: stamp, updated_by: null,
      }])
    }
    if (table === 'timeslot') {
      const id = url.searchParams.get('baby_id')?.replace('eq.', '') ?? ''
      return json(id in rows ? [rows[id as keyof typeof rows].slot] : [])
    }
    if (table === 'event') {
      // Answered off the *timeslot* filter, deliberately. If the client ever
      // stops scoping this request the key is absent, this returns nothing, and
      // the suite fails rather than passing on rows it should not have asked for.
      const id = url.searchParams.get('timeslot.baby_id')?.replace('eq.', '') ?? ''
      if (!(id in rows)) return json([])
      const s = rows[id as keyof typeof rows].slot
      return json([{ ...feed(`${s.id.slice(0, 8)}-eeee-0000-0000-000000000003`, s.id), timeslot: { baby_id: id } }])
    }
    return json([])
  })

  return { asked, wrote }
}

async function session(failWrites = false) {
  const ctx = await b.newContext({
    ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, hasTouch: true,
  })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
  // Onboarding runs on `enterApp`'s own fixtures — one baby, so it is taken
  // without asking. The household routes go on *after*, because Playwright gives
  // the later registration precedence and these have to outrank the single-baby
  // stub that got us in here. The reload is what makes the app pull against them.
  await enterApp(p)
  const carer = await p.evaluate(() => localStorage.getItem('babyliana.caregiver_id'))
  const traffic = await household(p, carer ?? '', failWrites)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(1600)
  return { ctx, p, ...traffic }
}

// --- the log says whose it is ----------------------------------------------
const a = await session()
check('the status row names the baby being logged for',
  (await a.p.locator('.babybtn').innerText()).trim() === 'Liana',
  await a.p.locator('.babybtn').innerText())

// The reason the scoped pull exists. An event reaches a baby only through its
// timeslot, so an unfiltered request hands back the sibling's entries and
// `replaceAll` writes them into IndexedDB as orphans nothing can reach.
const eventAsk = a.asked.filter((u) => u.startsWith('event')).pop() ?? ''
check('the event pull is scoped through the timeslot, not left open',
  eventAsk.includes('timeslot.baby_id=eq.') && eventAsk.includes('inner'),
  decodeURIComponent(eventAsk) || '(no event request)')

// --- the picker ------------------------------------------------------------
await a.p.locator('.babybtn').click()
await a.p.waitForTimeout(700)
const listed = await a.p.locator('.devlist b').allInnerTexts()
check('tapping it offers every baby the household has',
  listed.length === 2 && listed.includes('Liana') && listed.includes('Nova'),
  listed.join(', ') || '(empty)')
check('with the one already open marked as such',
  (await a.p.locator('.devlist button.on b').innerText()) === 'Liana',
  await a.p.locator('.devlist button.on').innerText().catch(() => '(none marked)'))

// `someone new` used to reach the create field by emptying the fetched list,
// which meant the list was gone and the only way back was to restart the app.
await a.p.getByRole('button', { name: 'someone new' }).click()
await a.p.waitForTimeout(400)
check('someone new offers a name field', await a.p.getByPlaceholder('Liana').isVisible(), 'field shown')
await a.p.getByRole('button', { name: /back to the list/ }).click()
await a.p.waitForTimeout(400)
check('and it is a door that opens both ways',
  (await a.p.locator('.devlist b').count()) === 2,
  `${await a.p.locator('.devlist b').count()} row(s) back`)

// --- switching -------------------------------------------------------------
check('the other baby’s entries are not on screen first',
  !(await a.p.locator('.log').innerText().catch(() => '')).includes('second-baby-note'),
  'starts on Liana')

await a.p.getByRole('button', { name: /Nova/ }).click()
await a.p.waitForTimeout(1800)

check('choosing the other one moves this install to it',
  (await a.p.evaluate(() => localStorage.getItem('babyliana.baby_id'))) === OTHER, 'baby_id swapped')
check('and the status row says so',
  (await a.p.locator('.babybtn').innerText()).trim() === 'Nova',
  await a.p.locator('.babybtn').innerText())

const body = await a.p.locator('.log').innerText()
check('the log shows the new baby’s entries', body.includes('second-baby-note'), 'B present')
// The failure this guards is the worst thing the app could render: one child's
// feeds under another child's name. `replaceAll` empties before the pull refills.
check('and none of the previous baby’s survive the swap',
  !body.includes('first-baby-note'), 'A gone')

// D-026: a caregiver belongs to the household, not to the child.
check('it never asks who is logging again',
  (await a.p.getByPlaceholder('Anya').count()) === 0 && (await a.p.locator('.log').count()) === 1,
  'stayed in the app')

// --- settings do not follow you across -------------------------------------
// The quiet one. `unsynced()` reads a cached value the new row does not carry as
// "this phone changed something" and pushes the previous baby's preferences onto
// the new baby. Nothing errors and both phones agree on the wrong answer.
// Back to the foreground, which is what actually flushes the queue:
// `reconcileSettings` writes the row and enqueues it, and the push waits for a
// sync. Without this the leak is still sitting in the outbox, unsent, and the
// second check below could not fail.
await a.p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await a.p.waitForTimeout(1400)
check('the previous baby’s preferences are not still being held',
  (await a.p.evaluate(() => localStorage.getItem('babyliana.prepLeadMinutes'))) === null,
  String(await a.p.evaluate(() => localStorage.getItem('babyliana.prepLeadMinutes'))))
check('nor pushed onto the new baby’s row, which is how they would spread',
  !a.wrote.some((w) => w.endsWith('baby')),
  a.wrote.join(', ') || 'no writes at all')
await a.ctx.close()

// --- a switch that cannot happen says why ----------------------------------
// Two refusals, and they are refusals rather than queued work on purpose. A
// half-finished switch held across a restart is a class of bug bought to serve a
// case that does not arise: nobody changes which child they are logging for
// one-handed in the dark (D-060).

// Offline. `ctx.setOffline` after the list has loaded, so the sheet is open and
// usable and the only thing missing is the network the swap needs.
const off = await session()
const before = await off.p.evaluate(() => localStorage.getItem('babyliana.baby_id'))
await off.p.locator('.babybtn').click()
await off.p.waitForTimeout(700)
await off.ctx.setOffline(true)
await off.p.getByRole('button', { name: /Nova/ }).click()
await off.p.waitForTimeout(900)
check('offline, the switch is refused in words rather than half-done',
  (await off.p.locator('.gateerr').innerText()).includes('network'),
  await off.p.locator('.gateerr').innerText().catch(() => '(no message)'))
check('and this install is left exactly where it was',
  (await off.p.evaluate(() => localStorage.getItem('babyliana.baby_id'))) === before,
  'baby_id untouched')
check('with the sheet still usable, not a greyed row and no sentence',
  !(await off.p.locator('.devlist button').first().isDisabled()), 'still tappable')
await off.ctx.close()

// Entries still waiting to go up. The wipe would take them with it, and D-003
// leaves no tombstone that could bring them back.
const stuck = await session(true)
await stuck.p.locator('.quick.feed').click()
await stuck.p.waitForTimeout(1200)
check('a feed that cannot be pushed stays in the outbox',
  stuck.wrote.some((w) => w.endsWith('timeslot')), stuck.wrote.join(', ') || '(nothing attempted)')
await stuck.p.locator('.babybtn').click()
await stuck.p.waitForTimeout(700)
await stuck.p.getByRole('button', { name: /Nova/ }).click()
await stuck.p.waitForTimeout(1200)
check('and the switch waits for it rather than wiping it',
  (await stuck.p.locator('.gateerr').innerText()).includes('waiting'),
  await stuck.p.locator('.gateerr').innerText().catch(() => '(no message)'))
check('leaving the install on the baby whose entry is still pending',
  (await stuck.p.evaluate(() => localStorage.getItem('babyliana.baby_id'))) === TEST_BABY,
  'baby_id untouched')
await stuck.ctx.close()

await b.close()
stop()
console.log(fail === 0 ? '\n  a second baby is reachable and separate\n' : `\n  ${fail} FAILED\n`)
process.exit(fail === 0 ? 0 : 1)
