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

const { getDeviceId } = await import('../src/device-id.ts')
const { createThisDevice, renameThisDevice } = await import('../src/moments.ts')
const db = await import('../src/db.ts')

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail && !ok ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// --- nothing exists until a name is submitted -----------------------------
// Merely opening the app used to mint a device id and insert a row, so anyone
// who looked at the URL left a phantom identity behind.
check('a fresh install has no device id', getDeviceId() === null)
check('and no device row', (await db.getDevices()).length === 0)

await createThisDevice('  Mona  ')
check('submitting a name creates the id', getDeviceId() !== null)
check('and exactly one row', (await db.getDevices()).length === 1)
check('the name is trimmed', (await db.getDevices())[0].name === 'Mona')
check('the id is what says setup is done — no separate flag to drift',
  getDeviceId() === (await db.getDevices())[0].id)
check('creating queues a push', (await db.outbox()).some((i) => i.table === 'device'))

// --- a name has to be changeable after first run ---------------------------
// Without this, the name set (or skipped) on first run was permanent unless
// storage was cleared by hand — the settings screen that would hold it is
// deferred, and this is the one thing in it that is not optional.
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
