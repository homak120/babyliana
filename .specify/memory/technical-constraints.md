# Technical constraints

## Stack

| Layer | Choice |
| --- | --- |
| App | PWA — React + TypeScript + Vite |
| Local storage | IndexedDB, holding the full event log |
| Sync | Supabase (Postgres, realtime, row-level security) |
| Hosting | Vercel (D-016) |
| CI/CD | GitHub → automatic build → deploy |
| Cost | $0 |

Scaffold-level choices under this — package manager, PWA plugin, lint, and what
is deliberately still open — are pinned in `.specify/memory/spike-spec.md`.

## Not native, and why it matters

This is not an App Store app. No Apple Developer Program, no $99, no signing, no
certificates, no 7-day provisioning expiry. Installation is Safari → Share →
Add to Home Screen.

The consequence to design around: **no Apple Watch, no Live Activities, no
lock-screen widgets.** The three-second glanceable logging pattern is not
available. Speed has to be won inside the app — cold start, first paint, and taps
to log — not outside it.

Going native is a separate future project, not a continuation of this one. See
`docs/decisions.md` D-001.

## Local-first is a hard requirement

The app is used in a nursery, at night, possibly with poor signal, on a phone
that may have been backgrounded for hours.

- Writes go to IndexedDB and the UI updates immediately. The network is never in
  the write path.
- The app opens and functions fully offline.
- Sync catches up whenever connectivity returns, including hours later.

Supabase is the source of truth for sharing. IndexedDB is a full local replica,
not a cache of recent items.

## Supabase free tier

Verified limits: 500 MB Postgres, 5 GB egress, 2 million realtime messages,
200 concurrent realtime connections, 2 active projects.

Projected usage: two users, ~30 events/day, ~150 bytes/row. Under 5 MB per year.
Capacity is not a consideration.

Three things that are:

- **Projects pause after 7 days with no database activity.** Resuming is a
  manual dashboard click, ~30 seconds. Daily use makes this a non-issue, but a
  week's gap will pause it.
- **A project left paused is eventually deleted, permanently.** Pausing is
  recoverable — a dashboard click, data intact. Deletion is not. This is the
  step that turns an inconvenience into data loss, and it is why the export is
  mandatory rather than prudent.
- **No backups on the free tier.** Zero days of retention; there is no snapshot
  sitting behind a paused project. Mitigated by the local replicas and the JSON
  export. Build the export early.

Note: new projects since 2026-05-30 require explicit Postgres grants for the
Data API. Tutorials written before mid-2026 will not match.

## Identity

**Rewritten by D-057 (2026-09-11).** Accounts exist, because the app is becoming
multi-tenant: many accounts per baby, many babies per account, open signup.

What survives from the original rule is the part that was load-bearing: **sign in
to join a baby, never to log an event.** Onboarding happens once per install;
after it the app opens straight into the log, offline, indefinitely. An expired
token never blocks a write, and a sync that cannot authenticate queues rather
than refuses.

What is gone is *"shared baby ID, no accounts, no passwords, no email"* and the
QR join of D-004 — see D-057, and
`.specify/memory/baby-and-devices.md` for the join design, whose shape is now
many-to-many rather than one shared id.

**Until the join table and RLS exist, nothing separates one family's rows from
another's.** One anon key, one hard-coded baby id, and a gate code that ships in
a public bundle (D-030: "a doormat, not a lock"). That was an accepted risk while
the only data was this family's; it is not one after the first stranger signs up.

Original rationale, now superseded: `docs/decisions.md` D-004, D-022.

## Non-negotiables

- Never block a write on the network.
- Corrections are updates and deletes are deletes (D-003). Last write wins.
- Never resolve a duplicate silently.
- Never require a login to log an event. Signing in to *join* a baby is allowed
  and expected (D-057); a session standing between a parent and a feed is not.
- Export must work before the app is shown to a second person — the reveal, not
  the first usable version. See D-024. **With open signup that second person is a
  stranger, so this is a prerequisite rather than a Phase 9 item.**
- Never let one family read another's rows. RLS per baby, not a shared key and a
  gate code (D-057). This one is new and it is the reason the others now need
  re-reading.
