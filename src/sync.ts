import { getBabyId } from './household'
import * as db from './db'
import { supabase } from './supabase'
import type { Baby, Caregiver, LogEvent, Timeslot } from './types'

// Sync is push-then-pull, and the order matters more than it looks.
//
// Reconcile replaces local state wholesale, which is what makes a hard delete
// propagate — a row removed on the other phone is noticed by its absence, since
// D-003 leaves no tombstone to carry the news. But that same wholesale replace
// would erase anything written locally and not yet pushed. So: push first, and
// skip the pull entirely while the outbox is non-empty.
//
// Realtime is a latency optimisation on top, never the mechanism. It has no
// replay, so anything written while this phone was backgrounded is missed
// permanently — which the Phase 3 spike demonstrated by sitting at 20 while the
// database held 23, subscription green. The reconcile is what makes that right;
// realtime only makes it fast.

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

let state: SyncState = 'idle'
let lastSyncedAt: number | null = null
let running: Promise<void> | null = null
const listeners = new Set<() => void>()

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const notify = () => listeners.forEach((fn) => fn())

export const syncState = () => ({ state, lastSyncedAt })

function setState(next: SyncState) {
  state = next
  notify()
}

/** Caregivers before timeslots: `logged_by` is a foreign key and will reject. */
// `baby` first: it is the root every timeslot references, so it has to exist
// on the server before anything points at it. It is only ever *updated* here —
// the row is seeded by `0002` and no client creates one (D-052).
const PUSH_ORDER = ['baby', 'caregiver', 'timeslot', 'event'] as const

async function push(): Promise<boolean> {
  if (!supabase) return false
  const items = await db.outbox()
  if (items.length === 0) return true

  for (const table of PUSH_ORDER) {
    const mine = items.filter((i) => i.table === table)
    if (mine.length === 0) continue

    const deletes = mine.filter((i) => i.op === 'delete')
    if (deletes.length) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', deletes.map((d) => d.rowId))
      if (error) return false
      await db.dequeue(deletes.map((d) => d.key))
    }

    const puts = mine.filter((i) => i.op === 'put')
    if (puts.length) {
      const rows = (
        await Promise.all(puts.map((p) => db.getRow(p.table, p.rowId)))
      ).filter((r) => r !== undefined)
      if (rows.length) {
        // The row came out of the store named by `table`, so its shape is
        // right; the typed client cannot see that through the union.
        const { error } = await supabase.from(table).upsert(rows as never[])
        if (error) return false
      }
      await db.dequeue(puts.map((p) => p.key))
    }
  }
  return true
}

/**
 * Every caregiver on the server, for the recovery page (D-042).
 *
 * Read directly rather than through `pull()`, which calls `replaceAll` and
 * would wipe the local database — wrong for a screen that is only offering a
 * list. It also has to work before this phone has an identity at all, which is
 * why it filters on nothing: `caregiver` is not scoped by `baby_id`.
 *
 * `null` means the list could not be fetched — offline, unreachable, or no
 * Supabase configured. The page says so rather than showing an empty list,
 * because "nobody has ever set this up" and "I cannot see" are different
 * answers and only one of them is recoverable by waiting.
 */
export async function fetchCaregivers(): Promise<Caregiver[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('caregiver').select('*')
  if (error) return null
  return (data ?? []) as Caregiver[]
}

async function pull(): Promise<boolean> {
  if (!supabase) return false
  // Onboarding has not finished, so there is nothing to pull *for*. Returning
  // false rather than throwing keeps this the same shape as every other reason
  // a pull cannot happen — offline, unauthenticated, a server error — all of
  // which sync() already treats as "try again later" rather than as a fault.
  const babyId = getBabyId()
  if (!babyId) return false

  const [baby, caregiver, timeslot, event] = await Promise.all([
    supabase.from('baby').select('*').eq('id', babyId),
    supabase.from('caregiver').select('*'),
    supabase.from('timeslot').select('*').eq('baby_id', babyId),
    supabase.from('event').select('*'),
  ])
  const failed = [baby, caregiver, timeslot, event].find((r) => r.error)
  if (failed) return false

  await db.replaceAll({
    baby: (baby.data ?? []) as Baby[],
    caregiver: (caregiver.data ?? []) as Caregiver[],
    timeslot: (timeslot.data ?? []) as Timeslot[],
    event: (event.data ?? []) as LogEvent[],
  })
  return true
}

/**
 * Push anything pending, then refresh from the server.
 *
 * Safe to call often — concurrent calls share one run rather than racing.
 */
export async function sync(): Promise<void> {
  if (running) return running
  if (!supabase || !navigator.onLine) {
    setState('offline')
    return
  }

  running = (async () => {
    setState('syncing')
    try {
      const pushed = await push()
      if (!pushed) {
        setState('error')
        return
      }
      // Never reconcile with writes still pending — the wholesale replace
      // would erase them.
      if ((await db.outbox()).length > 0) {
        setState('error')
        return
      }
      setState((await pull()) ? 'idle' : 'error')
      if (state === 'idle') lastSyncedAt = Date.now()
    } catch {
      setState('error')
    } finally {
      running = null
      notify()
    }
  })()

  return running
}

let started = false

/** Wire the triggers. Idempotent. */
export function startSync() {
  if (started) return
  started = true

  void sync()

  // Resume is the important one. A backgrounded phone misses every realtime
  // message, so coming back to the foreground has to reconcile.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync()
  })
  window.addEventListener('online', () => void sync())
  window.addEventListener('offline', () => setState('offline'))

  if (supabase) {
    supabase
      .channel('log')
      // **These do not follow the client's `db.schema` option.** The filter is
      // sent to the realtime server as its own literal, so flipping supabase.ts
      // leaves these on `public` — and the failure is silent: every read and
      // write works, and only live updates between the two phones stop arriving.
      .on('postgres_changes', { event: '*', schema: 'app', table: 'timeslot' }, () =>
        void sync(),
      )
      .on('postgres_changes', { event: '*', schema: 'app', table: 'event' }, () =>
        void sync(),
      )
      .subscribe()
  }
}
