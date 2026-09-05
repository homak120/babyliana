import { BABY_ID } from './config'
import * as db from './db'
import { createDeviceId, requireDeviceId } from './device-id'
import type { DraftEntry, LogEvent, Moment, Timeslot } from './types'

// Everything above IndexedDB that the UI touches. Kept apart from db.ts so the
// storage layer stays a dumb store and the rules about ids, timestamps and
// what a moment is live in one place.

const now = () => new Date().toISOString()

/**
 * Create this device, once, when its name is submitted.
 *
 * Deliberately not an upsert on startup: opening the app must not create an
 * identity. Nothing exists until someone commits to a name, which is also why
 * the id's presence is what says setup is done.
 */
export async function createThisDevice(name: string): Promise<string> {
  const id = createDeviceId()
  const t = now()
  await db.putDevice({
    id,
    name: name.trim() || null,
    created_at: t,
    updated_at: t,
    updated_by: null, // only ever set by a manual script
  })
  await db.enqueue([{ table: 'device', rowId: id, op: 'put' }])
  return id
}

/** Sets this device's name. Explicit — the startup upsert never touches it. */
export async function renameThisDevice(name: string) {
  const id = requireDeviceId()
  const existing = (await db.getDevices()).find((d) => d.id === id)
  if (!existing) return
  await db.putDevice({ ...existing, name: name.trim() || null, updated_at: now() })
  await db.enqueue([{ table: 'device', rowId: id, op: 'put' }])
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
    logged_by: requireDeviceId(),
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

/**
 * End any sleep still running at `at`, because something else just happened.
 *
 * Skips `exceptId` so a sleep does not close itself in the same save, and skips
 * sleeps that started *after* the new entry — backdating an old feed should not
 * reach forward and end tonight's sleep.
 *
 * **Called from the save path, deliberately not from `logMoment`.** It writes to
 * a row the caller did not create, and burying that inside the primitive meant
 * anything that logged a moment — the verify suites among them — silently
 * mutated unrelated data. `verify-s2` syncs the live database first, so running
 * the test suite could have ended a real sleep that was in progress.
 */
export async function closeOpenSleep(at: Date, exceptId?: string) {
  const before = (await db.getMoments()).filter(
    (m) => m.timeslot.id !== exceptId && new Date(m.timeslot.occurred_at) < at,
  )
  if (before.length === 0) return

  // Only the most recent one. Anything older already had something logged after
  // it, so it was over long before now — reaching back to stamp an end time on
  // it would be inventing data, not closing a sleep.
  const latest = before.reduce((a, b) =>
    new Date(a.timeslot.occurred_at) >= new Date(b.timeslot.occurred_at) ? a : b,
  )
  if (latest.timeslot.ended_at !== null) return
  if (!latest.events.some((e) => e.type === 'sleep')) return

  const timeslot: Timeslot = { ...latest.timeslot, ended_at: at.toISOString(), updated_at: now() }
  await db.putMoment({ timeslot, events: latest.events })
  await db.enqueue([{ table: 'timeslot', rowId: timeslot.id, op: 'put' }])
}

/**
 * Apply an edit to an existing moment.
 *
 * Entries carrying an id are updated in place; new ones are inserted; ones that
 * were removed from the sheet are deleted. Rows are mutable (D-003), so there
 * are no correction events and no tombstones — an edit is an edit.
 */
export async function updateMoment(
  timeslotId: string,
  input: NewMoment & { entryIds: (string | undefined)[] },
): Promise<Moment> {
  const existing = (await db.getMoments()).find((m) => m.timeslot.id === timeslotId)
  if (!existing) throw new Error('no such moment')

  const t = now()
  const timeslot: Timeslot = {
    ...existing.timeslot,
    occurred_at: (input.occurredAt ?? new Date(existing.timeslot.occurred_at)).toISOString(),
    ended_at: input.endedAt ? input.endedAt.toISOString() : null,
    note: input.note ?? null,
    updated_at: t,
  }

  const events: LogEvent[] = input.entries.map((e, i) => {
    const id = input.entryIds[i]
    const prior = id ? existing.events.find((x) => x.id === id) : undefined
    return {
      // Keeping the id is what makes a correction land on the entry it belongs
      // to, rather than replacing the whole moment.
      id: prior?.id ?? crypto.randomUUID(),
      timeslot_id: timeslotId,
      type: e.type,
      note: e.note ?? null,
      recorded_at: prior?.recorded_at ?? t,
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
    }
  })

  const kept = new Set(events.map((e) => e.id))
  const dropped = existing.events.filter((e) => !kept.has(e.id))

  await db.putMoment({ timeslot, events })
  for (const d of dropped) await db.deleteEvent(d.id)

  await db.enqueue([
    { table: 'timeslot', rowId: timeslot.id, op: 'put' },
    ...events.map((e) => ({ table: 'event' as const, rowId: e.id, op: 'put' as const })),
    ...dropped.map((e) => ({ table: 'event' as const, rowId: e.id, op: 'delete' as const })),
  ])

  return { timeslot, events }
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
