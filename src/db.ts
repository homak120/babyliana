import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Baby, Caregiver, LogEvent, Moment, Timeslot } from './types'

// The local replica. Holds the whole log, not a cache of recent items —
// event-model.md § Where each fact lives. Everything the UI reads comes from
// here, so it reads the same online or off.
//
// `idb` is a thin promise wrapper over IndexedDB, about a kilobyte. Chosen over
// Dexie because nothing here needs a query DSL, and over raw IndexedDB because
// the transaction plumbing is unreadable by hand.

const DB_NAME = 'babyliana'
const DB_VERSION = 3

/**
 * What has been written locally but not yet accepted by the server.
 *
 * Load-bearing: reconcile replaces local state wholesale, so anything not yet
 * pushed would be erased by it. Reconcile is skipped while this is non-empty.
 * Keyed `table:rowId` so rewriting a row twice queues it once.
 */
export type OutboxItem = {
  key: string
  table: 'baby' | 'caregiver' | 'timeslot' | 'event'
  rowId: string
  op: 'put' | 'delete'
}

interface Schema extends DBSchema {
  baby: { key: string; value: Baby }
  outbox: { key: string; value: OutboxItem }
  caregiver: { key: string; value: Caregiver }
  timeslot: { key: string; value: Timeslot; indexes: { occurred_at: string } }
  event: { key: string; value: LogEvent; indexes: { timeslot_id: string } }
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null

/**
 * How long to wait for the database before deciding something is holding it.
 *
 * An IndexedDB version change cannot proceed while another connection has the
 * old version open, and the API's answer to that is to **wait forever**. No
 * error, no rejection — `openDB` simply never settles, and every caller awaiting
 * it hangs with nothing on screen to say why. That is how a version bump turns
 * into a dead button.
 *
 * Five seconds is far longer than an unblocked open ever takes and short enough
 * that a person has not yet decided the app is broken.
 */
const OPEN_TIMEOUT_MS = 5000

function db() {
  dbp ??= withTimeout(openDB<Schema>(DB_NAME, DB_VERSION, {
    /**
     * Another tab wants to upgrade and this connection is what stops it.
     *
     * Closing is right: whatever this tab was doing, the version it holds is
     * about to be superseded, and refusing to let go only strands the tab that
     * is trying to move forward. `dbp` is cleared so the next call reopens at
     * the new version rather than reusing a closed handle.
     */
    blocking() {
      void dbp?.then((d) => d.close()).catch(() => {})
      dbp = null
    },

    /** The mirror: something else is holding the old version and will not let go. */
    blocked() {
      console.error(
        '[babyliana] the local database is held open at an older version by ' +
          'another tab or the installed app. Close the others and reload.',
      )
    },

    upgrade(d, oldVersion) {
      // Guarded per version so an existing browser upgrades rather than
      // needing its data cleared.
      if (oldVersion < 1) {
        d.createObjectStore('baby', { keyPath: 'id' })
        d.createObjectStore('caregiver', { keyPath: 'id' })
        d.createObjectStore('timeslot', { keyPath: 'id' }).createIndex(
          'occurred_at',
          'occurred_at',
        )
        d.createObjectStore('event', { keyPath: 'id' }).createIndex(
          'timeslot_id',
          'timeslot_id',
        )
      }
      if (oldVersion < 2) {
        d.createObjectStore('outbox', { keyPath: 'key' })
      }
      // `device` became `caregiver`. A store cannot be renamed in place, so the
      // old one is dropped and the new one created — which a fresh browser never
      // sees, because `oldVersion < 1` above already made `caregiver`.
      //
      // **The rows are not carried across, deliberately.** They are a replica:
      // reconcile refills them from the server on the next sync. The one thing
      // that could be lost is a caregiver rename queued in the outbox and never
      // pushed, and that is acceptable here because this upgrade only ever runs
      // on a phone crossing from `public` to `app` — a cutover that re-onboards
      // the install and rebuilds the replica anyway. It is not a silent loss in
      // the middle of ordinary use.
      if (oldVersion < 3) {
        if (d.objectStoreNames.contains('device' as never)) {
          d.deleteObjectStore('device' as never)
        }
        if (!d.objectStoreNames.contains('caregiver')) {
          d.createObjectStore('caregiver', { keyPath: 'id' })
        }
      }
    },
  }))
  return dbp
}

/**
 * Turn "never settles" into a real rejection.
 *
 * `dbp` is cleared on failure, deliberately: a cached rejected promise would
 * make every later call fail with the same stale error, so closing the offending
 * tab would fix nothing until the app was restarted. Clearing it means a retry
 * is a retry.
 */
function withTimeout(p: Promise<IDBPDatabase<Schema>>): Promise<IDBPDatabase<Schema>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      dbp = null
      reject(
        new Error(
          'the local database is open at an older version somewhere else — ' +
            'close any other tabs or the installed app, then try again',
        ),
      )
    }, OPEN_TIMEOUT_MS)
    p.then(
      (d) => { clearTimeout(timer); resolve(d) },
      (e) => { clearTimeout(timer); dbp = null; reject(e) },
    )
  })
}

/**
 * Write a moment and its entries as one unit.
 *
 * Both ids are generated before anything is written, and both stores are
 * touched in a single transaction. The naive insert-await-insert is what
 * produces an orphan timeslot when the second call fails —
 * event-model.md § Writing a timeslot.
 */
export async function putMoment(moment: Moment) {
  const d = await db()
  const tx = d.transaction(['timeslot', 'event'], 'readwrite')
  await Promise.all([
    tx.objectStore('timeslot').put(moment.timeslot),
    ...moment.events.map((e) => tx.objectStore('event').put(e)),
    tx.done,
  ])
}

/** Newest first. */
export async function getMoments(): Promise<Moment[]> {
  const d = await db()
  const timeslots = await d.getAllFromIndex('timeslot', 'occurred_at')
  const events = await d.getAll('event')
  const byTimeslot = new Map<string, LogEvent[]>()
  for (const e of events) {
    const list = byTimeslot.get(e.timeslot_id)
    if (list) list.push(e)
    else byTimeslot.set(e.timeslot_id, [e])
  }
  return timeslots
    .reverse()
    .map((timeslot) => ({ timeslot, events: byTimeslot.get(timeslot.id) ?? [] }))
}

/** Deleting a moment takes its entries — mirrors `on delete cascade` (D-025). */
export async function deleteMoment(timeslotId: string) {
  const d = await db()
  const tx = d.transaction(['timeslot', 'event'], 'readwrite')
  const ids = await tx.objectStore('event').index('timeslot_id').getAllKeys(timeslotId)
  await Promise.all([
    tx.objectStore('timeslot').delete(timeslotId),
    ...ids.map((id) => tx.objectStore('event').delete(id)),
    tx.done,
  ])
}

/**
 * Create if absent, leave alone if present. One row per caregiver, forever.
 *
 * Deliberately not "if there is no localStorage key, this is a first run" —
 * the Phase 3 spike already wrote `babyliana.device_id` on both phones and it
 * survives, because localStorage is per-origin and dropping a table does not
 * touch a browser. A first-run check would skip this insert and every timeslot
 * would then fail its foreign key. It is also wrong after a storage eviction,
 * which is what Q-004 is measuring.
 */
export async function ensureCaregiver(caregiver: Caregiver): Promise<boolean> {
  const d = await db()
  const existing = await d.get('caregiver', caregiver.id)
  if (existing) return false
  await d.put('caregiver', caregiver)
  return true
}

export async function eventIdsFor(timeslotId: string): Promise<string[]> {
  const d = await db()
  return d.getAllKeysFromIndex('event', 'timeslot_id', timeslotId)
}

export async function putCaregiver(caregiver: Caregiver) {
  await (await db()).put('caregiver', caregiver)
}

export async function getCaregivers(): Promise<Caregiver[]> {
  return (await db()).getAll('caregiver')
}

export async function putBaby(baby: Baby) {
  await (await db()).put('baby', baby)
}

export async function getBaby(id: string): Promise<Baby | undefined> {
  return (await db()).get('baby', id)
}

// --- outbox -----------------------------------------------------------------

export async function enqueue(items: Omit<OutboxItem, 'key'>[]) {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  await Promise.all([
    ...items.map((i) => tx.store.put({ ...i, key: `${i.table}:${i.rowId}` })),
    tx.done,
  ])
}

export async function outbox(): Promise<OutboxItem[]> {
  return (await db()).getAll('outbox')
}

export async function dequeue(keys: string[]) {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done])
}

// --- reconcile --------------------------------------------------------------

/**
 * Replace local state with what the server has.
 *
 * Wholesale rather than incremental, which is what makes a hard delete
 * propagate: a row removed elsewhere is noticed by its absence, and there is no
 * tombstone to carry the news (D-003). Only safe when the outbox is empty —
 * see sync.ts.
 */
export async function replaceAll(rows: {
  baby: Baby[]
  caregiver: Caregiver[]
  timeslot: Timeslot[]
  event: LogEvent[]
}) {
  const d = await db()
  const tx = d.transaction(['baby', 'caregiver', 'timeslot', 'event'], 'readwrite')
  await Promise.all([
    tx.objectStore('baby').clear(),
    tx.objectStore('caregiver').clear(),
    tx.objectStore('timeslot').clear(),
    tx.objectStore('event').clear(),
  ])
  await Promise.all([
    ...rows.baby.map((r) => tx.objectStore('baby').put(r)),
    ...rows.caregiver.map((r) => tx.objectStore('caregiver').put(r)),
    ...rows.timeslot.map((r) => tx.objectStore('timeslot').put(r)),
    ...rows.event.map((r) => tx.objectStore('event').put(r)),
    tx.done,
  ])
}

export async function deleteEvent(id: string) {
  await (await db()).delete('event', id)
}

export async function getRow(table: 'baby' | 'caregiver' | 'timeslot' | 'event', id: string) {
  return (await db()).get(table, id)
}
