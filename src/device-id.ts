// This device's identity. Purely local, and deliberately not in supabase.ts:
// it has nothing to do with the network, and keeping it separate is what lets
// the whole local write path be used — and tested — without Supabase loaded.
//
// The only thing in localStorage (event-model.md § Where each fact lives). It
// must NOT sync: it is what distinguishes this phone from the other.
//
// **Nothing is generated on read.** An earlier version minted a UUID the first
// time anything asked, which meant merely opening the URL created a device row
// — a phantom identity for anyone who looked at the page once. The id now comes
// into existence only when someone commits to a name.
//
// Its presence is also what says setup is done, so there is no separate
// "welcomed" flag to keep in step with it.

const DEVICE_KEY = 'babyliana.device_id'

export function getDeviceId(): string | null {
  return localStorage.getItem(DEVICE_KEY)
}

/** Mint and store one. Called once, when the name is submitted. */
export function createDeviceId(): string {
  const id = crypto.randomUUID()
  localStorage.setItem(DEVICE_KEY, id)
  return id
}

/** For the write path, where a device is guaranteed to exist by then. */
export function requireDeviceId(): string {
  const id = getDeviceId()
  if (!id) throw new Error('no device yet — the welcome should have run first')
  return id
}
