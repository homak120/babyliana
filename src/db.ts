import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Baby, Device, LogEvent, Moment, Timeslot } from './types'

// The local replica. Holds the whole log, not a cache of recent items —
// event-model.md § Where each fact lives. Everything the UI reads comes from
// here, so it reads the same online or off.
//
// `idb` is a thin promise wrapper over IndexedDB, about a kilobyte. Chosen over
// Dexie because nothing here needs a query DSL, and over raw IndexedDB because
// the transaction plumbing is unreadable by hand.

const DB_NAME = 'babyliana'
const DB_VERSION = 2

/**
 * What has been written locally but not yet accepted by the server.
 *
 * Load-bearing: reconcile replaces local state wholesale, so anything not yet
 * pushed would be erased by it. Reconcile is skipped while this is non-empty.
 * Keyed `table:rowId` so rewriting a row twice queues it once.
 */
export type OutboxItem = {
  key: string
  table: 'device' | 'timeslot' | 'event'
  rowId: string
  op: 'put' | 'delete'
}

interface Schema extends DBSchema {
  baby: { key: string; value: Baby }
  outbox: { key: string; value: OutboxItem }
  device: { key: string; value: Device }
  timeslot: { key: string; value: Timeslot; indexes: { occurred_at: string } }
  event: { key: string; value: LogEvent; indexes: { timeslot_id: string } }
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null

function db() {
  dbp ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      // Guarded per version so an existing browser upgrades rather than
      // needing its data cleared.
      if (oldVersion < 1) {
        d.createObjectStore('baby', { keyPath: 'id' })
        d.createObjectStore('device', { keyPath: 'id' })
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
    },
  })
  return dbp
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
 * Create if absent, leave alone if present. One row per device, forever.
 *
 * Deliberately not "if there is no localStorage key, this is a first run" —
 * the Phase 3 spike already wrote `babyliana.device_id` on both phones and it
 * survives, because localStorage is per-origin and dropping a table does not
 * touch a browser. A first-run check would skip this insert and every timeslot
 * would then fail its foreign key. It is also wrong after a storage eviction,
 * which is what Q-004 is measuring.
 */
export async function ensureDevice(device: Device): Promise<boolean> {
  const d = await db()
  const existing = await d.get('device', device.id)
  if (existing) return false
  await d.put('device', device)
  return true
}

export async function eventIdsFor(timeslotId: string): Promise<string[]> {
  const d = await db()
  return d.getAllKeysFromIndex('event', 'timeslot_id', timeslotId)
}

export async function putDevice(device: Device) {
  await (await db()).put('device', device)
}

export async function getDevices(): Promise<Device[]> {
  return (await db()).getAll('device')
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
  device: Device[]
  timeslot: Timeslot[]
  event: LogEvent[]
}) {
  const d = await db()
  const tx = d.transaction(['baby', 'device', 'timeslot', 'event'], 'readwrite')
  await Promise.all([
    tx.objectStore('baby').clear(),
    tx.objectStore('device').clear(),
    tx.objectStore('timeslot').clear(),
    tx.objectStore('event').clear(),
  ])
  await Promise.all([
    ...rows.baby.map((r) => tx.objectStore('baby').put(r)),
    ...rows.device.map((r) => tx.objectStore('device').put(r)),
    ...rows.timeslot.map((r) => tx.objectStore('timeslot').put(r)),
    ...rows.event.map((r) => tx.objectStore('event').put(r)),
    tx.done,
  ])
}

export async function deleteEvent(id: string) {
  await (await db()).delete('event', id)
}

export async function getRow(table: 'device' | 'timeslot' | 'event', id: string) {
  return (await db()).get(table, id)
}
