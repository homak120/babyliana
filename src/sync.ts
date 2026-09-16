import { getBabyId, setBabyId } from './household'
import * as db from './db'
import { forgetSettings } from './settings'
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

/**
 * Why the last push stopped, or null.
 *
 * `push` returned false and nothing else, so every reason it can fail — a
 * column the table does not have, a policy refusing the row, an expired
 * session, a dropped connection — arrived on screen as the same red dot, which
 * is also the dot for being offline (D-045). The difference matters: one of
 * those clears itself when the signal comes back and the rest never do.
 *
 * Retained and logged rather than rendered, for now. Putting it in front of
 * someone mid-feed is a design question; having it available when they ask what
 * went wrong is not.
 */
let lastError: string | null = null
export const lastSyncError = () => lastError

/** Uniform handling, so no call site can drop an error by forgetting to look. */
function failed(where: string, error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  lastError = `${where}: ${error.message}${error.code ? ` (${error.code})` : ''}`
  console.error(`[babyliana] sync stopped — ${lastError}`)
  return true
}

async function push(): Promise<boolean> {
  if (!supabase) return false
  const items = await db.outbox()
  if (items.length === 0) return true
  lastError = null

  for (const table of PUSH_ORDER) {
    const mine = items.filter((i) => i.table === table)
    if (mine.length === 0) continue

    const deletes = mine.filter((i) => i.op === 'delete')
    if (deletes.length) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', deletes.map((d) => d.rowId))
      if (failed(`deleting from ${table}`, error)) return false
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
        if (failed(`writing ${rows.length} row(s) to ${table}`, error)) return false
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
    // **Scoped through the timeslot, not left open.** An event reaches a baby
    // only through its timeslot, so with one baby in the household this is the
    // same set as `select('*')` and with two it is not: the unscoped version
    // pulled the sibling's events down on every sync and `replaceAll` wrote them
    // into IndexedDB, where they sat as orphans no view could reach (D-060).
    //
    // `!inner` is load-bearing. Without it PostgREST keeps rows whose embed does
    // not match and nulls the embed, so the filter quietly stops filtering.
    supabase.from('event').select('*, timeslot!inner(baby_id)').eq('timeslot.baby_id', babyId),
  ])
  const bad = [
    ['reading baby', baby], ['reading caregiver', caregiver],
    ['reading timeslot', timeslot], ['reading event', event],
  ] as const
  for (const [where, r] of bad) if (failed(where, r.error)) return false

  // **The id can change while those four requests are in the air**, and
  // `switchBaby` below does exactly that. Writing this answer now would
  // repopulate the log with the baby we just left, under the name of the one we
  // just joined — the single worst thing this app could put on a screen. The
  // pull is simply abandoned; the caller treats it as any other failed pull and
  // the switch's own sync fetches the right rows a moment later.
  if (getBabyId() !== babyId) return false

  await db.replaceAll({
    baby: (baby.data ?? []) as Baby[],
    caregiver: (caregiver.data ?? []) as Caregiver[],
    timeslot: (timeslot.data ?? []) as Timeslot[],
    // The embed is a filter, not a field. It has to come off before the row
    // reaches IndexedDB, because `push()` upserts local rows verbatim — and a
    // key the table does not have is the precise 403 that stalled the whole
    // outbox in stage 2 when `caregiver.user_id` went missing the other way.
    event: ((event.data ?? []) as (LogEvent & { timeslot?: unknown })[]).map(
      ({ timeslot: _embed, ...row }) => row as LogEvent,
    ),
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

/**
 * Why a switch did not happen, or `ok`.
 *
 * Four outcomes rather than a boolean because three of them are the user's to
 * act on and they need different sentences — one clears itself when the signal
 * comes back, one clears when the dot goes green, one is a retry.
 */
export type SwitchResult = 'ok' | 'pending' | 'offline' | 'failed'

/**
 * Move this install to another baby in the same household (D-060).
 *
 * Lives here rather than in `household.ts` for two reasons. `sync.ts` already
 * imports that module, so the reverse would be a cycle — and this *is* a sync
 * operation: flush, swap, refill, in that order, which is the same push-then-pull
 * discipline the rest of the file runs on.
 *
 * **It refuses rather than queues.** Offline, or with writes still pending, it
 * declines and says so. That is not a retreat from local-first: D-058 is about
 * never blocking a *write*, and this is not a write — it is changing which log
 * you are looking at, which is a two-handed act nobody performs mid-feed. The
 * alternative is holding a half-finished switch across a restart, which buys a
 * class of bug to serve a case that does not arise.
 *
 * The caregiver is deliberately untouched. A caregiver belongs to the household,
 * not to the child (D-026), so switching babies must not ask who you are again.
 */
export async function switchBaby(id: string): Promise<SwitchResult> {
  if (id === getBabyId()) return 'ok'
  if (!supabase || !navigator.onLine) return 'offline'

  // Flush first. Anything sitting in the outbox belongs to the baby being left,
  // and the wipe below would take it with no way to get it back.
  await sync()
  if ((await db.outbox()).length > 0) return 'pending'

  forgetSettings()

  // **Order matters through the next three lines.** The id moves first, so any
  // pull still in flight for the previous baby hits the guard in `pull()` and
  // abandons its write. Then local state is emptied, so that if the pull below
  // never lands — the signal drops in between — the screen shows an empty log
  // under the new baby's name. Empty is honest and self-heals on the next sync;
  // the previous baby's feeds relabelled is neither.
  setBabyId(id)
  await db.replaceAll({ baby: [], caregiver: [], timeslot: [], event: [] })
  await sync()

  // Check the outcome, not the sequence. `sync()` shares an in-flight run with
  // whatever else asked for one, so a green state is not proof that *this*
  // baby's rows arrived. Its row being in the local store is.
  return (await db.getRow('baby', id)) ? 'ok' : 'failed'
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
