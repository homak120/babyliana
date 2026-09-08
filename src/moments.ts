import { BABY_ID } from './config'
import * as db from './db'
import { createDeviceId, requireDeviceId } from './device-id'
import { cycles, hydrateCycles, isDefaultCycles } from './cycles'
import type { Baby, BabySettings, DraftEntry, LogEvent, Moment, Timeslot } from './types'

// Everything above IndexedDB that the UI touches. Kept apart from db.ts so the
// storage layer stays a dumb store and the rules about ids, timestamps and
// what a moment is live in one place.

const now = () => new Date().toISOString()

/**
 * Write one shared setting to the row both phones read (D-052).
 *
 * The local write and the queue entry, and nothing else — `sync()` is the
 * caller's, so this never blocks on the network. `updated_at` and `updated_by`
 * are stamped the way every other write here stamps them, which is what makes
 * the server's last-write-wins mean *last*.
 *
 * **Silently local when the baby row has not arrived yet.** That is a fresh
 * install that has never synced; there is no row to update and one cannot be
 * invented, because `baby.name` is `not null` and this phone does not know it.
 * The value stays in its local cache and `reconcileCycles` sends it up once the
 * row appears.
 */
export async function saveSetting<K extends keyof BabySettings>(
  key: K,
  value: BabySettings[K],
): Promise<boolean> {
  const baby = (await db.getRow('baby', BABY_ID)) as Baby | undefined
  if (!baby) return false
  // **Merged into what is already there, never replacing it.** One key at a
  // time is the whole point of an object: writing the object wholesale would
  // make saving the feeding cycle quietly drop every other setting the row
  // carries, including ones this build has never heard of.
  const settings: BabySettings = { ...(baby.settings ?? {}), [key]: value }
  await db.putBaby({ ...baby, settings, updated_at: now(), updated_by: requireDeviceId() })
  await db.enqueue([{ table: 'baby', rowId: BABY_ID, op: 'put' }])
  return true
}

/**
 * Reconcile this phone's cycle with the shared row, after a pull.
 *
 * Two directions, and the asymmetry is deliberate. A row that *has* a cycle
 * wins — that is the sync. A row with none takes this phone's, but only if this
 * phone has actually been tuned, which closes the one hole `saveCycles` leaves:
 * a change made before the first sync would otherwise sit local forever.
 *
 * Returns whether the local value changed, so the screen can repaint on
 * something the other phone did.
 */
export async function reconcileCycles(): Promise<boolean> {
  const baby = (await db.getRow('baby', BABY_ID)) as Baby | undefined
  if (!baby) return false
  if (hydrateCycles(baby.settings)) return true
  if (!baby.settings?.cycles && !isDefaultCycles()) await saveSetting('cycles', cycles())
  return false
}

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
    pounds: e.pounds ?? null,
    fahrenheit: e.fahrenheit ?? null,
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
 * One entry, logged now, the way the sheet's save would have logged it.
 *
 * The bar's bottle and bedtime buttons write through this instead of opening
 * the sheet, so the sleep that the new entry implies has ended still gets
 * closed — that pairing is what "save" does, not what `logMoment` does, and a
 * quick icon that skipped it would leave a sleep running through a feed.
 */
export async function logQuick(entries: DraftEntry[]): Promise<Moment> {
  const m = await logMoment({ entries })
  await closeOpenSleep(new Date(m.timeslot.occurred_at), m.timeslot.id)
  return m
}

/**
 * The end button: stamp `at` as the end of whatever is still running.
 *
 * A sleep or a feed — the same write either way, which is why one function
 * serves both pills and both card buttons. Nothing distinguishes the two here
 * beyond which event the moment carries: an open period is a timeslot with no
 * `ended_at` (D-020), and that single field is the whole of it (D-033).
 *
 * User-initiated only. Its automatic cousin below is deliberately narrower.
 */
export async function endOpenPeriod(at: Date) {
  const latest = latestOpen(await db.getMoments(), at)
  if (!latest) return
  if (!latest.events.some((e) => e.type === 'sleep' || e.type === 'feed')) return
  await stampEnd(latest, at)
}

/**
 * End any sleep still running at `at`, because something else just happened.
 *
 * **Sleeps only, and that asymmetry is the point.** At 4am you log the feed, not
 * the waking, so the next entry is the best evidence there is of when a sleep
 * ended. A feed is the opposite: the next diaper says nothing about when the
 * bottle finished, and stamping that time on it would invent a duration nobody
 * observed. An open feed simply stops being the latest moment and stops reading
 * as running — no write, nothing to be wrong later.
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
  const latest = latestOpen(await db.getMoments(), at, exceptId)
  if (!latest) return
  if (!latest.events.some((e) => e.type === 'sleep')) return
  await stampEnd(latest, at)
}

/**
 * Take the end back off the latest sleep — the mirror of `endOpenPeriod`.
 *
 * The row's resume icon. It clears `ended_at` on the sleep that was just
 * closed, so it reads as running again and keeps counting from the start it
 * always had. That is what "resume" means here: an undo for a stir that turned
 * out not to be a waking, not a new sleep — the bar's bedtime button is what
 * starts one of those.
 *
 * **Only the latest moment**, same as ending one. Reopening anything older
 * would invent a sleep that ran through everything logged after it, and
 * `ongoingSleep` would not read it as running anyway.
 */
export async function resumeLastSleep(at: Date) {
  const latest = latestBefore(await db.getMoments(), at)
  if (!latest || latest.timeslot.ended_at === null) return
  if (!latest.events.some((e) => e.type === 'sleep')) return
  const timeslot: Timeslot = { ...latest.timeslot, ended_at: null, updated_at: now() }
  await db.putMoment({ timeslot, events: latest.events })
  await db.enqueue([{ table: 'timeslot', rowId: timeslot.id, op: 'put' }])
}

/**
 * The most recent moment before `at`.
 *
 * Only the most recent one. Anything older already had something logged after
 * it, so it was over long before now — reaching back to stamp an end time on it
 * would be inventing data, not closing a period.
 */
function latestBefore(moments: Moment[], at: Date, exceptId?: string): Moment | null {
  const before = moments.filter(
    (m) => m.timeslot.id !== exceptId && new Date(m.timeslot.occurred_at) < at,
  )
  if (before.length === 0) return null
  return before.reduce((a, b) =>
    new Date(a.timeslot.occurred_at) >= new Date(b.timeslot.occurred_at) ? a : b,
  )
}

/** The same moment, but only when it is still open. */
function latestOpen(moments: Moment[], at: Date, exceptId?: string): Moment | null {
  const latest = latestBefore(moments, at, exceptId)
  return latest && latest.timeslot.ended_at === null ? latest : null
}

/** The whole of ending a period: one field on one row. */
async function stampEnd(m: Moment, at: Date) {
  const timeslot: Timeslot = { ...m.timeslot, ended_at: at.toISOString(), updated_at: now() }
  await db.putMoment({ timeslot, events: m.events })
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
      pounds: e.pounds ?? null,
      fahrenheit: e.fahrenheit ?? null,
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
