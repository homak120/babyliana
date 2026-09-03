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
