import { createClient } from '@supabase/supabase-js'

// Vite inlines import.meta.env at build time. Node has no such thing, so the
// fallback is what lets the sync path be exercised against the real database
// from a script rather than only by tapping a phone — see scripts/verify-s2.mts.
const env: Record<string, string | undefined> =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env ??
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ??
  {}

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

// The spike had to run before the Supabase project existed, so missing config is
// a state the page renders — never a crash on load.
export const isConfigured =
  Boolean(url && anonKey) && !url!.includes('your-project-ref')

export const supabase = isConfigured ? createClient(url!, anonKey!) : null
