// This caregiver's identity. Purely local, and deliberately not in supabase.ts:
// it has nothing to do with the network, and keeping it separate is what lets
// the whole local write path be used — and tested — without Supabase loaded.
//
// The only thing in localStorage (event-model.md § Where each fact lives). It
// must NOT sync: it is what distinguishes this phone from the other.
//
// **Nothing is generated on read.** An earlier version minted a UUID the first
// time anything asked, which meant merely opening the URL created a caregiver row
// — a phantom identity for anyone who looked at the page once. The id now comes
// into existence only when someone commits to a name.
//
// Its presence is also what says setup is done, so there is no separate
// "welcomed" flag to keep in step with it.

const CAREGIVER_KEY = 'babyliana.caregiver_id'

export function getCaregiverId(): string | null {
  return localStorage.getItem(CAREGIVER_KEY)
}

/** Mint and store one. Called once, when the name is submitted. */
export function createCaregiverId(): string {
  const id = crypto.randomUUID()
  localStorage.setItem(CAREGIVER_KEY, id)
  return id
}

/**
 * Take on an identity that already exists on the server, rather than minting a
 * fresh one (D-042).
 *
 * The recovery code's whole purpose. A phone that has been reinstalled has an
 * empty localStorage, so the normal welcome would mint a *second* caregiver for a
 * parent who already has one — and every entry logged after that would be
 * attributed to a stranger with the same name.
 *
 * No new row is created and nothing is enqueued: the row is already on the
 * server, and this phone is only agreeing to be it.
 */
export function adoptCaregiverId(id: string) {
  localStorage.setItem(CAREGIVER_KEY, id)
}

/** For the write path, where a caregiver is guaranteed to exist by then. */
export function requireCaregiverId(): string {
  const id = getCaregiverId()
  if (!id) throw new Error('no caregiver yet — the welcome should have run first')
  return id
}

/**
 * Forget this caregiver, so the welcome runs again.
 *
 * Needed because the id living in localStorage and the row living on the server
 * can get out of step — a row deleted elsewhere leaves this phone holding an id
 * that references nothing, and every write then fails its foreign key with
 * nothing on screen to say why.
 */
export function forgetCaregiver() {
  localStorage.removeItem(CAREGIVER_KEY)
}
