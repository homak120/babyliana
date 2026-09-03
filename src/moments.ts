import { BABY_ID } from './config'
import * as db from './db'
import { deviceId } from './device-id'
import type { DraftEntry, LogEvent, Moment, Timeslot } from './types'

// Everything above IndexedDB that the UI touches. Kept apart from db.ts so the
// storage layer stays a dumb store and the rules about ids, timestamps and
// what a moment is live in one place.

const now = () => new Date().toISOString()

/**
 * Make this device's own row if it is not already there.
 *
 * Runs on every startup. See db.ensureDevice for why this is an upsert rather
 * than a first-run check.
 */
export async function ensureThisDevice() {
  const t = now()
  const created = await db.ensureDevice({
    id: deviceId(),
    name: null, // the welcome screen sets this in S9
    created_at: t,
    updated_at: t,
    updated_by: null, // only ever set by a manual script
  })
  if (created) {
    await db.enqueue([{ table: 'device', rowId: deviceId(), op: 'put' }])
  }
}

export type NewMoment = {
  occurredAt?: Date
  endedAt?: Date | null
  note?: string | null
  entries: DraftEntry[]
}

/**
 * Write a moment. Ids for the moment and every entry are generated here,
 * before anything is stored, which is what makes a retry idempotent later —
 * writing the same row twice costs nothing.
 */
export async function logMoment(input: NewMoment): Promise<Moment> {
  if (input.entries.length === 0) {
    // A moment always has at least one entry (D-019). The UI disables save, so
    // reaching this is a bug rather than a user action.
    throw new Error('a moment needs at least one entry')
  }

  const t = now()
  const timeslot: Timeslot = {
    id: crypto.randomUUID(),
    baby_id: BABY_ID,
    logged_by: deviceId(),
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    ended_at: input.endedAt ? input.endedAt.toISOString() : null,
    recorded_at: t,
    updated_at: t,
    updated_by: null,
    note: input.note ?? null,
  }

  const events: LogEvent[] = input.entries.map((e) => ({
    id: crypto.randomUUID(),
    timeslot_id: timeslot.id,
    type: e.type,
    note: e.note ?? null,
    recorded_at: t,
    updated_at: t,
    updated_by: null,
    volume_ml: e.volume_ml ?? null,
    source: e.source ?? null,
    pee: e.pee ?? null,
    poop: e.poop ?? null,
    poop_colour: e.poop_colour ?? null,
    poop_consistency: e.poop_consistency ?? null,
    grams: e.grams ?? null,
    celsius: e.celsius ?? null,
    supplement_name: e.supplement_name ?? null,
    amount: e.amount ?? null,
    severity: e.severity ?? null,
  }))

  const moment = { timeslot, events }
  await db.putMoment(moment)
  await db.enqueue([
    { table: 'timeslot', rowId: timeslot.id, op: 'put' },
    ...events.map((e) => ({ table: 'event' as const, rowId: e.id, op: 'put' as const })),
  ])
  return moment
}

export const getMoments = db.getMoments

/** Deleting locally also has to reach the server — hard delete, no tombstone. */
export async function removeMoment(timeslotId: string) {
  const eventIds = await db.eventIdsFor(timeslotId)
  await db.deleteMoment(timeslotId)
  await db.enqueue([
    { table: 'timeslot', rowId: timeslotId, op: 'delete' },
    ...eventIds.map((id) => ({ table: 'event' as const, rowId: id, op: 'delete' as const })),
  ])
}
