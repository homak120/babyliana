# Infrastructure spike — spec

Per D-011 this slice gets a short artifact, not the full package.

## Purpose

Prove the pipeline carries weight before anything valuable rides on it, and
answer Q-004 and Q-005, which only a real deployment on a real phone can answer.

It proves six things and nothing else:

1. `git push` → build → live URL, without a manual step
2. A browser write reaches Postgres and comes back
3. A write on one device appears on the other (Q-005)
4. Add to Home Screen produces a full-screen app (D-001 rests on this)
5. The app opens with no signal
6. Local storage survives being left alone (Q-004)

**It is not the first slice of the app.** No baby data, no design decisions, no
event model. A button and a counter.

## Stack, pinned

The table in `technical-constraints.md` names the architecture. These are the
scaffold-level choices under it.

| | Choice | Note |
| --- | --- | --- |
| Package manager | npm | No extra install, no lockfile debate |
| Build | Vite 8 | |
| UI | React 19 + TypeScript 6 | |
| Lint | oxlint | Ships with the Vite template |
| PWA | `vite-plugin-pwa` | Manifest, service worker and offline in one dep |
| Supabase | `@supabase/supabase-js` | |
| Hosting | **Vercel** | D-016 |
| Routing | none | One page |
| Styling | plain CSS | Deliberately deferred — see below |

**Styling is deliberately unresolved.** Claude Design is producing the Phase 2
prototype now, and what it returns changes the answer. Choosing a styling system
before seeing it is a coin flip that may have to be redone. The spike uses plain
CSS, which D-012 deletes anyway.

Local storage is likewise not chosen here. Q-004 has to answer before the
IndexedDB approach is settled, and that is Phase 4 work.

## The throwaway table

A row per tap, so
one table exercises insert, select, realtime and RLS together.

```sql
create table public.spike_taps (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  created_at timestamptz not null default now()
);

alter table public.spike_taps enable row level security;

create policy "spike: anon can read"
  on public.spike_taps for select to anon using (true);

create policy "spike: anon can insert"
  on public.spike_taps for insert to anon with check (true);

-- Required. Projects created since 2026-05-30 need the Data API grant stated
-- explicitly; without it the table returns empty or 401 from the browser and
-- every pre-mid-2026 tutorial will tell you it should have worked.
grant select, insert on public.spike_taps to anon;

-- Realtime is opt-in per table.
alter publication supabase_realtime add table public.spike_taps;
```

RLS is switched on deliberately rather than skipped. The real app's auth model
is unusual — shared baby ID, no accounts, anon key only (D-004) — and RLS
against an anon key is exactly where it could fail. Proving one policy works now
is cheap; discovering it in Phase 6 is not.

## Human steps

The scaffold is committed and builds. These need a browser and cannot be
delegated:

1. ~~Create the Supabase project by hand.~~ **Done 2026-09-02**, project ref
   `fhqbgnlzqnpzqbhjkxda`, US East. Named `babyliana`, not `-spike`: D-012 keeps
   the project, so the name outlives the throwaway code.
2. ~~Run the SQL above in the Supabase SQL editor.~~ **Done.**
3. ~~Copy `.env.example` to `.env.local`.~~ **Done.** Note the dashboard now
   issues a **publishable** key (`sb_publishable_…`) rather than one labelled
   `anon`. Same thing, same browser-safe status; the Postgres *role* is still
   called `anon`, which is what the policies and grants refer to.
4. ~~Local check.~~ **Done.** Table, RLS, both policies, both grants, the
   read/write round trip and realtime all verified from two independent clients.
   Realtime push measured at roughly one second.
5. Import the repo into Vercel. Add the same two variables as environment
   variables there. Deploy.
6. Push a trivial change and confirm it deploys with no manual step.
7. Open the deployed URL on the phone → Share → Add to Home Screen.
8. iOS checks: full screen, no address bar, icon renders, airplane mode still
   opens the app, survives being backgrounded.
9. Leave it installed and untouched. That is the Q-004 test, and it runs itself.

## Three ways this fails silently

Worth knowing before debugging it tired.

**Realtime lags behind `alter publication`.** The subscription reports
`SUBSCRIBED` and delivers nothing, for tens of seconds after the table is added
to the publication. This happened here: the first check timed out at 12s and a
retry minutes later worked first time, ~1s latency. **If realtime looks dead
immediately after running the SQL, wait and retry before changing anything.**
Config that was already correct is the easiest thing in the world to "fix".

**RLS on with no policy returns `[]`, not an error.** The table looks healthy in
the dashboard, the API returns `200` with an empty array, and nothing says a
policy is missing. If reads come back empty and rows exist, suspect policies
first.

**The Data API grant.** Projects created since 2026-05-30 need
`grant … to anon` stated explicitly, or the table 401s or reads empty from the
browser while every tutorial written before mid-2026 insists it should work.

### Isolating a failure

Test Supabase directly before blaming app code:

```bash
curl "https://<ref>.supabase.co/rest/v1/spike_taps?select=*" \
  -H "apikey: <key>" -H "Authorization: Bearer <key>"
```

`[]` is correct and healthy. `401` means the key or grant is wrong.
`PGRST205 … not found in the schema cache` means the table does not exist —
which is also the signal that the URL and key are *right*, since a bad key
fails earlier with a 401.

## What offline actually does, and what it does not

Tested on the installed PWA in airplane mode, 2026-09-02.

**It opens.** The service worker serves the shell from cache, React boots, the
UI renders. That is the sixth thing this spike exists to prove, and it holds.

**It shows 0, and a tap fails with `TypeError: Load failed`.** Both are correct
for the spike as built. There is no local storage here at all: the page reads
from Supabase on mount and holds the result in React state, and
`vite-plugin-pwa` precaches static assets rather than API responses. Nothing was
ever stored locally, so there is nothing to show and nowhere to write.

### Two lessons for Phase 4 and Phase 6

This is worth more than a passing test, because it is a live demonstration of
the failure the first non-negotiable exists to prevent.

**A failed write must never reach the user.** At 3am a parent taps to log a
feed and gets `TypeError: Load failed`. They cannot tell whether it saved. They
reach for the pen — and once the pen is back on the nightstand, the app has
lost. The real app writes to IndexedDB, updates the UI immediately, and syncs
when it can. A network failure should be invisible at the point of entry.

**Zero is a lie.** Showing `0` while seven events exist is worse than showing
nothing, because it is confidently wrong. A full local replica — not a cache of
recent items — means the count is right whether or not the network is.

Neither is fixed here. D-012 deletes this application code before Phase 6
precisely so an evening's hacking does not shape the event model. The local
layer is designed in Phase 4, with Q-004 answered, and built in Phase 6.

## Realtime is not sync — the stale-after-resume finding

Observed on the installed iPhone PWA, 2026-09-02, and the most valuable thing
this spike surfaced.

The phone was showing 20 and went to sleep. Four taps were made on the laptop.
On reopening the phone, the subscription visibly reconnected — the realtime
light went amber, then green — **and the count stayed at 20.** The database held
23.

### Why

iOS suspends the WebSocket when the app is backgrounded. The four inserts
happened while the socket was dead. On resume the client reconnected and
resubscribed, but `postgres_changes` is a **live broadcast, not a durable
queue**: it has no replay, so resubscribing means "from now on". The spike
fetches once on mount and never again, so nothing reconciles the gap.

### Why it matters more than it looks

Same failure class as the offline `0`: a confidently wrong number, no error
shown. But this one lands on the app's core value.

*"Did she already feed her"* is one of only two things the app does that paper
cannot. A phone that has been in a pocket for twenty minutes, reporting the last
feed as three hours ago when the other parent fed her twenty minutes ago, is not
merely unhelpful — it is misleading, at 4am, with nothing on screen to suggest
anything is wrong. **Backgrounded is the normal state of a phone**, not an edge
case; it is what happens between every use.

### The model already handles this; the spike does not

Client-generated UUIDs and merge-as-union-by-`id` make re-fetching idempotent — pulling the same event twice costs nothing and there is
no conflict to resolve. The design is right. The spike is simply thin.

**The rule for Phase 6:**

> Realtime is a latency optimisation, not a sync mechanism.

- On mount: render from IndexedDB immediately, then reconcile with the server
- On resume (`visibilitychange` → visible): reconcile again
- Realtime keeps an already-open screen fresh
- Never treat the stream as complete

Not fixed here. D-012 deletes this code before Phase 6, and the finding is worth
more than the five-line fix. Consequence for anyone still using the spike: it
will keep showing stale numbers after any backgrounding, and that is expected.

## Q-005 — answered

**Realtime latency is acceptable.** Measured at roughly one second from a Node
client, and confirmed by the owner on 2026-09-02 across an installed iPhone PWA
and a laptop browser on a home network — a tap on one device showed up on the
other fast enough for "did she already feed her", which is the only bar that
matters.

Q-005 is struck from `docs/open-questions.md`. Q-004 is still running: it needs
the installed app left alone, and nothing else waits on it.

**Scope of that answer.** Latency is fine *while connected*. It says nothing
about staying correct across a disconnect — see the section above. Realtime
being fast and realtime being sufficient are different claims, and only the
first was tested.

## Boundary — D-012

**Kept:** the repo, Vercel project and its env vars, the Supabase project, the
PWA manifest and icons, the build and deploy pipeline, `.env.example`.

**Deleted before Phase 6:** `src/App.tsx`, `src/App.css`, the `spike_taps` table
and its policies. The tap page may survive on a route as a smoke test if that
proves useful — that is the only exception, and it is already in `tasks.md`.

The spike's application code carries a comment saying so, so it cannot quietly
become the foundation.

## Exit

Six items above proven, Q-005 answered, Q-004 running. Placeholder icons stay
placeholder until Phase 7.
