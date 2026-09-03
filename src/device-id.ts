// This device's identity. Deliberately not in supabase.ts: it is purely local
// and has nothing to do with the network, and keeping it separate is what lets
// the whole local write path be used — and tested — without Supabase loaded.
//
// The only thing that lives in localStorage (event-model.md § Where each fact
// lives). It must NOT sync: it is what distinguishes this phone from the other.

const DEVICE_KEY = 'babyliana.device_id'

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

// --- welcome dismissal ------------------------------------------------------
//
// The second and last thing in localStorage. It is not data: it is a per-device
// UI fact that must NOT sync — naming your phone should not dismiss the welcome
// on your wife's. Recorded separately from the device name so that *skipping*
// is remembered too; a null name alone cannot tell "not asked yet" from "asked
// and declined", and the difference is a form reappearing at 3am.

const WELCOMED_KEY = 'babyliana.welcomed'

export const hasBeenWelcomed = () => localStorage.getItem(WELCOMED_KEY) === '1'
export const markWelcomed = () => localStorage.setItem(WELCOMED_KEY, '1')
