# Supabase

Schema lives here as versioned SQL, not only as a block inside a design
document, for two reasons: it is repeatable, and it is half of the
disaster-recovery plan.

A paused free-tier project is eventually deleted and the free tier keeps no
backups (`.specify/memory/technical-constraints.md`). If that happens, rebuilding
is **run these migrations, then replay the JSON export** — not reconstruct a
schema from prose.

## Applying them

There is no automation and no CLI set up. Open the Supabase dashboard → SQL
Editor, paste each file in order, run it.

| File | What it does | When |
| --- | --- | --- |
| `migrations/0001_initial_schema.sql` | Drops the spike table, creates the three tables, RLS, grants, realtime | Once |
| `migrations/0002_seed_household.sql` | Creates one household and its devices | Once, after 0001. **Edit the names first** |

`0001` is safe to re-run — everything is `if not exists` / `if exists`.
**`0002` is not**: running it twice creates a second household.

## After running them

`0002` returns the `household_id` in the result pane. That value gets hard-coded
in the client (D-022 — no pairing flow for MVP), so keep it somewhere you can
find it.

## Two things that will otherwise cost you an evening

**The Data API grants in `0001` are not optional.** Projects created since
2026-05-30 need them stated explicitly. Without them the tables return empty
results or a 401 from the browser, while every tutorial written before mid-2026
insists it should have worked.

**Realtime lags behind the publication change.** After `0001`, a subscription can
report `SUBSCRIBED` and deliver nothing for tens of seconds. Wait and retry
before changing any configuration — the spike lost two attempts to exactly this.
See `.specify/memory/spike-spec.md`.

## What is not here

No `households` table: D-004 has no accounts, so a household is a bare UUID with
nothing to store about it. No soft-delete columns: D-003 uses hard delete. No
per-household RLS: with no Supabase Auth there is no identity to check
`household_id` against, and one household is all this deployment will ever hold —
see the note in `0001` and D-004's reversal condition.
