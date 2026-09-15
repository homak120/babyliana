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

// `db.schema` is the whole cutover at this end: every `.from('timeslot')` in
// sync.ts resolves against `app` instead of `public` without one call changing.
// PostgREST picks the schema off an `Accept-Profile` header the client sets from
// this option — which is also why `app` has to be on Settings → API → Exposed
// schemas, or every request 404s.
//
// Auth is unaffected either way: signInWithOtp and verifyOtp go to /auth/v1,
// not through PostgREST.
export const supabase = isConfigured
  ? createClient(url!, anonKey!, { db: { schema: 'app' } })
  : null
