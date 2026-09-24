import { supabase } from './supabase'
import type { Baby, Caregiver } from './types'

// Which baby this install logs for, and how it found out.
//
// **This replaces the hard-coded `BABY_ID` in `config.ts`** (D-022, superseded by
// D-057). That constant's own comment predicted this file: it said localStorage
// would become "its right home, since it will then arrive from a join rather
// than a constant". It does now.
//
// Kept beside `caregiver-id.ts` rather than inside it because the two answer
// different questions — *which child* and *which parent* — and a household with
// two babies changes one of them without touching the other.
//
// **The cached id is what opens the log, not the session.** Reading it is
// synchronous and local, so the first render can decide without awaiting
// anything. A session that cannot refresh offline is sync's problem and sync
// already queues; it is never a reason to put a login in front of a feed
// (D-058).

const BABY_KEY = 'babyliana.baby_id'

export function getBabyId(): string | null {
  return localStorage.getItem(BABY_KEY)
}

/** Remember the choice, so the next launch goes straight to the log. */
export function setBabyId(id: string) {
  localStorage.setItem(BABY_KEY, id)
}

/**
 * Forget which baby this install was logging for.
 *
 * The escape hatch for a second child and for a phone changing hands. It leaves
 * the session and the caregiver alone: the next launch asks which baby and
 * nothing else, which is the smallest useful thing this can do.
 */
export function forgetBaby() {
  localStorage.removeItem(BABY_KEY)
}

/** For the write path, where onboarding has already run. */
export function requireBabyId(): string {
  const id = getBabyId()
  if (!id) throw new Error('no baby yet — onboarding should have run first')
  return id
}

/**
 * Every baby this household can see.
 *
 * No filter, deliberately: RLS already scopes the answer to rows reachable
 * through `baby_member`, so asking for all of them *is* asking for ours. A
 * `.eq()` here would duplicate the policy in the client and drift from it.
 *
 * `null` means the request failed. An empty array is a real answer — a
 * household that has signed in and not made a baby yet.
 */
export async function fetchBabies(): Promise<Baby[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('baby').select('*')
  if (error) return null
  return (data ?? []) as Baby[]
}

/**
 * Make a baby and join this household to it, in one call.
 *
 * Through the `create_baby` function rather than an insert, because the insert
 * cannot work: the policy on `app.baby` checks membership, and the membership
 * row cannot exist before the baby it points at. The function writes both
 * outside RLS. `0007` § 6 has the full reasoning.
 */
export async function createBaby(name: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('create_baby', { baby_name: name.trim() })
  if (error || typeof data !== 'string') return null
  return data
}

/**
 * The caregivers under this household account.
 *
 * Note what this is not scoped by: a baby. A caregiver belongs to a household,
 * not to a child (D-026), so the same two parents log for a sibling without a
 * second row. That is also why picking a baby and picking a caregiver are
 * independent steps rather than one nested inside the other.
 */
export async function fetchCaregiversForHousehold(): Promise<Caregiver[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('caregiver').select('*')
  if (error) return null
  return (data ?? []) as Caregiver[]
}
