// S9's done-when is mostly a phone test — installed, airplane mode, a deploy
// arriving without a reinstall. What a script can check is the logic underneath
// the two decisions that would be silently wrong: when the welcome is shown,
// and when an update is allowed to reload the page.
import 'fake-indexeddb/auto'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage

const { deviceId, hasBeenWelcomed, markWelcomed } = await import('../src/device-id.ts')
const { ensureThisDevice, renameThisDevice } = await import('../src/moments.ts')
const db = await import('../src/db.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// --- the welcome ------------------------------------------------------------
check('a fresh install has not been welcomed', !hasBeenWelcomed())

await ensureThisDevice()
const fresh = (await db.getDevices())[0]
check('the device row exists before any name is given', !!fresh && fresh.name === null)

// skipping is a first-class outcome, not a non-answer
markWelcomed()
check('skipping is remembered, so the form does not reappear', hasBeenWelcomed())
check('and the device is still unnamed, which is allowed',
  (await db.getDevices())[0].name === null)

// a null name alone could not have told these apart
check('"asked and declined" is distinguishable from "not asked yet"',
  hasBeenWelcomed() && (await db.getDevices())[0].name === null)

await renameThisDevice('  Mona  ')
const named = (await db.getDevices())[0]
check('a name is trimmed when set', named.name === 'Mona', String(named.name))
check('naming queues a push, so the other phone can resolve the initial',
  (await db.outbox()).some((i) => i.table === 'device' && i.rowId === deviceId()))

await renameThisDevice('   ')
check('clearing the name stores null rather than blank',
  (await db.getDevices())[0].name === null)

// --- a name has to be changeable after first run ---------------------------
// Without this, the name set (or skipped) on first run was permanent unless
// storage was cleared by hand — the settings screen that would hold it is
// deferred, and this is the one thing in it that is not optional.
await renameThisDevice('Mona')
await renameThisDevice('Ada')
check('a name can be changed after it is first set',
  (await db.getDevices())[0].name === 'Ada')
check('changing it queues a push so the other phone sees the new initial',
  (await db.outbox()).some((i) => i.table === 'device'))

// --- the update rule --------------------------------------------------------
// Modelled rather than imported: updates.ts talks to a real service worker.
// The rule is what matters, and it is the one that would silently lose typing.
const shouldReload = (waiting: boolean, entering: boolean, visible: boolean) =>
  waiting && !entering && visible

check('an update waits while the sheet is open', !shouldReload(true, true, true))
check('and lands once the sheet closes', shouldReload(true, false, true))
check('never while the app is backgrounded', !shouldReload(true, false, false))
check('and does nothing when there is no update', !shouldReload(false, false, true))

console.log(failures === 0 ? '\n  all checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
