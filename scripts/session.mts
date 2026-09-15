// A signed-in session for the suites that hit the live database.
//
// `verify-s2` and `verify-s8` are the two that would go red when the schema and
// the app disagree, which is the whole reason they exist — so they cannot become
// no-ops now that `app` requires a session. But OTP needs a human with an inbox,
// and no script can produce one.
//
// So: `npm run auth-check` signs in once, interactively, and leaves the session
// here. The suites restore it. Supabase refresh tokens do not expire on their
// own, so one sign-in keeps the suites running indefinitely.
//
// **This file holds a real credential and is gitignored.** It is a refresh token
// for the household account, on the owner's own machine, for a test harness. If
// that trade is not wanted, delete it — the suites then say what to run and stop,
// which is loud rather than silently green.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Structural, not `SupabaseClient`. That type carries the schema as a generic
// parameter, so a client pointed at `app` is not assignable to one typed for
// `public` — and this function does not care: setSession is auth, and auth is
// the same whatever schema the Data API side is reading.
type HasAuth = {
  auth: {
    setSession(t: { access_token: string; refresh_token: string }): Promise<{ error: unknown }>
  }
}

const FILE = '.auth-session.json'

export function saveSession(access_token: string, refresh_token: string, expires_at?: number) {
  writeFileSync(FILE, JSON.stringify({ access_token, refresh_token, expires_at }, null, 2))
  console.log(`\n  session saved to ${FILE} — verify-s2 and verify-s8 can run now`)
}

/**
 * Put the saved session on a client. False means there is nothing saved, or the
 * refresh token has been revoked.
 *
 * Callers should stop rather than carry on: without a session every `app` query
 * returns zero rows, which reads as "the data is gone" instead of "you are not
 * signed in" — the more alarming of the two, and the wrong one.
 */
export async function restoreSession(sb: HasAuth): Promise<boolean> {
  if (!existsSync(FILE)) return false
  try {
    const { access_token, refresh_token } = JSON.parse(readFileSync(FILE, 'utf8'))
    const { error } = await sb.auth.setSession({ access_token, refresh_token })
    return !error
  } catch {
    return false
  }
}

export const NO_SESSION =
  '\n  no session. run `npm run auth-check` first — it signs in once and leaves\n' +
  '  the session where this suite can find it.\n'
