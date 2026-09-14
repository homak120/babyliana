import { supabase } from './supabase'

// Authentication, and nothing else.
//
// Deliberately thin: four Supabase calls with their errors turned into
// sentences a tired person can act on. It knows nothing about babies,
// caregivers or the log — the bootstrap in App.tsx composes those.
//
// **Auth is schema-independent.** These calls go to `/auth/v1`, not through
// PostgREST, so they behave identically whether the client is pointed at
// `public` or `app`. Nothing in this file changes at cutover, which is why it
// can land before the schema flip rather than with it.
//
// **The session is cached and that is the whole offline answer.** supabase-js
// persists it to localStorage and refreshes it in the background, both by
// default. Signing in happens once per install; after that the session is read
// locally with no network call, which is what satisfies "never require a login
// to log an event" (D-058). Nothing else needs to be built for that.

export type AuthResult = { ok: true } | { ok: false; message: string }

const NOT_CONFIGURED = 'this app is not connected to a server yet'

/**
 * Turn a Supabase error into something worth showing someone.
 *
 * The raw strings are written for developers — "Email rate limit exceeded",
 * "Token has expired or is invalid" — and three of them are states a person can
 * actually do something about, so they are worth translating. Anything
 * unrecognised passes through rather than being flattened into "something went
 * wrong", which would hide the one detail that makes a bug reportable.
 */
function readable(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('rate limit') || m.includes('for security purposes'))
    return 'a code was just sent — wait a minute before asking for another'
  if (m.includes('expired') || m.includes('invalid'))
    return 'that code is wrong or has expired — ask for a new one'
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'no connection — try again when you have signal'
  return raw
}

/**
 * Mail a six-digit code to this address, creating the household if it is new.
 *
 * `shouldCreateUser: true` is what makes one call serve both first run and a
 * returning parent. D-057 chose open signup, so an address nobody has used is a
 * new household rather than an error, and there is no separate sign-up call.
 *
 * **A code only arrives if the Magic Link email template has been edited to use
 * `{{ .Token }}`.** Out of the box Supabase mails a clickable link instead —
 * this call still returns ok, the email still arrives, and nothing on this side
 * can tell the difference. `scripts/verify-auth.mts` is the only thing that
 * catches it, because it asks a human what the email actually said.
 */
export async function sendCode(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED }
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  })
  return error ? { ok: false, message: readable(error.message) } : { ok: true }
}

/**
 * Exchange the code for a session.
 *
 * `type: 'email'` is load-bearing and easy to get wrong: 'magiclink' verifies
 * the same token against a different flow and rejects a code that is perfectly
 * valid. The email address has to come back with it because the token alone is
 * only six digits and is not unique across accounts.
 */
export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED }
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  })
  return error ? { ok: false, message: readable(error.message) } : { ok: true }
}

/**
 * The signed-in household's id, or null.
 *
 * Reads the cached session — no network call in the normal case, which is what
 * lets the bootstrap ask this question before first paint. supabase-js refreshes
 * an expired access token in the background; if that refresh cannot reach the
 * network the cached session is still returned, because the refresh token has
 * not expired and the app has to open regardless.
 */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/**
 * Drop the session.
 *
 * Not a button anyone is expected to press often — it exists so a phone can
 * change hands, and so a household that signed in with the wrong address can
 * get out of it. It does not touch the local log: IndexedDB survives, which is
 * deliberate, because a sign-out during a bad sync must not destroy writes that
 * have not reached the server.
 */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}
