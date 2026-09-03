import { BABY_ID } from './config'
import * as db from './db'
import { supabase } from './supabase'
import type { Baby, Device, LogEvent, Timeslot } from './types'

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

/** Devices before timeslots: `logged_by` is a foreign key and will reject. */
const PUSH_ORDER = ['device', 'timeslot', 'event'] as const

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

async function pull(): Promise<boolean> {
  if (!supabase) return false
  const [baby, device, timeslot, event] = await Promise.all([
    supabase.from('baby').select('*').eq('id', BABY_ID),
    supabase.from('device').select('*'),
    supabase.from('timeslot').select('*').eq('baby_id', BABY_ID),
    supabase.from('event').select('*'),
  ])
  const failed = [baby, device, timeslot, event].find((r) => r.error)
  if (failed) return false

  await db.replaceAll({
    baby: (baby.data ?? []) as Baby[],
    device: (device.data ?? []) as Device[],
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timeslot' }, () =>
        void sync(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event' }, () =>
        void sync(),
      )
      .subscribe()
  }
}
