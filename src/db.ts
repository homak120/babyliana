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
const DB_VERSION = 1

interface Schema extends DBSchema {
  baby: { key: string; value: Baby }
  device: { key: string; value: Device }
  timeslot: { key: string; value: Timeslot; indexes: { occurred_at: string } }
  event: { key: string; value: LogEvent; indexes: { timeslot_id: string } }
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null

function db() {
  dbp ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(d) {
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
export async function ensureDevice(device: Device) {
  const d = await db()
  const existing = await d.get('device', device.id)
  if (!existing) await d.put('device', device)
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
