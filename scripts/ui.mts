import { readFileSync } from 'node:fs'
import type { Page } from 'playwright'

/**
 * Get a fresh context past onboarding and into the app.
 *
 * The welcome became two pages when the gate landed, then four when the gate was
 * replaced by a real login (D-059), and every browser suite bootstraps through
 * here — so all of them change together or none of them do. One helper, so the
 * next change to first-run costs one edit.
 *
 * **Onboarding cannot be driven through the UI any more.** It starts with an
 * emailed six-digit code, and no browser test can read an inbox. So the session
 * is seeded directly into the storage supabase-js reads, the baby is seeded
 * beside it, and the run picks up at the caregiver step — which is the part
 * these suites actually depend on, because it is what puts a named row in
 * IndexedDB for `logged_by` to resolve against.
 *
 * What is *not* faked: `createThisCaregiver` still runs for real, through the
 * same button a person taps. The suites test the app, not a fixture.
 */

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
)

// supabase-js keys its session by project ref — `sb-<ref>-auth-token`.
const REF = (env.VITE_SUPABASE_URL ?? '').replace(/^https:\/\//, '').split('.')[0]

/** A fixed id, so a suite can assert on it without knowing how it got there. */
export const TEST_BABY = '00000000-1111-2222-3333-444444444444'

export async function enterApp(p: Page, name = 'Anya') {
  // Exactly one baby, so the app takes it without asking — the same path a real
  // household with one child walks. Seeding `babyliana.baby_id` below is not
  // enough on its own and deliberately so: the app re-asks the server even when
  // an id is cached, because a cached baby is the thing most likely to have
  // stopped being reachable.
  await p.route('**://*.supabase.co/rest/v1/baby*', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: TEST_BABY, name: 'Liana', settings: null }]),
    }),
  )

  // The caregiver list comes back empty, which is what makes the name field
  // appear rather than a picker. Suites that want a populated list route this
  // themselves before calling in — a later route wins in Playwright.
  await p.route('**://*.supabase.co/rest/v1/caregiver*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await p.evaluate(
    ([ref, baby]) => {
      // Far-future expiry on purpose: an expired token sends supabase-js to the
      // network to refresh, and these suites have no network.
      const year = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
      localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: year,
          token_type: 'bearer',
          user: { id: '55555555-6666-7777-8888-999999999999', email: 'test@example.com' },
        }),
      )
      localStorage.setItem('babyliana.baby_id', baby)
    },
    [REF, TEST_BABY] as const,
  )

  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(500)

  const field = p.getByPlaceholder(name)
  if (await field.isVisible().catch(() => false)) {
    await field.fill(name)
    await p.getByRole('button', { name: 'start logging' }).click()
    await p.waitForTimeout(400)
  }
}
