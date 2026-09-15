// What onboarding leaves behind, for the suites that run without a browser.
//
// Only the baby id, and that is the honest scope. Seeding a session here does
// not work: supabase-js falls back to in-memory storage when there is no
// browser, so it never reads a shimmed localStorage however carefully it is
// filled. `enterApp` can seed one because it runs in a real browser; these
// cannot.
//
// They do not need one. `createThisCaregiver` refuses a caregiver with no
// session only when a Supabase project is configured — with none, there is
// nothing to sync to and nothing to refuse, which is exactly the state these
// suites run in.

export const TEST_BABY = '00000000-1111-2222-3333-444444444444'

/** Seed a shimmed localStorage so the write path has a baby to log against. */
export function seedOnboarded(store: Map<string, string>) {
  store.set('babyliana.baby_id', TEST_BABY)
}
