import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The spike has to run before the Supabase project exists, so missing config is
// a state the page renders — never a crash on load.
export const isConfigured =
  Boolean(url && anonKey) && !url.includes('your-project-ref')

export const supabase = isConfigured ? createClient(url, anonKey) : null

// Mirrors the real app's device_id: answers "did I log that, or did you".
const DEVICE_KEY = 'babyliana.device_id'

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}
