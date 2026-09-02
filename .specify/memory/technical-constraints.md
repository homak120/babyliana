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

Shared household ID, no accounts, no passwords, no email.

Generated once on the first device. A second device joins by scanning a QR code.
Nothing to reset, no session to expire, no login to fail at 3am.

Rationale in `docs/decisions.md` D-004.

## Non-negotiables

- Never block a write on the network.
- Never mutate an event in place.
- Never resolve a duplicate silently.
- Never require a login to log an event.
- Export must work before the app is shown to a second person.
