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
| `migrations/0001_initial_schema.sql` | Drops the spike table, creates the three tables, RLS, grants, realtime | Once. Safe to re-run |

That is the whole schema. There is nothing else to run.

## The baby row

One row in `baby` for Liana. It can go in through the REST API with the anon key
rather than by hand — the app's own credentials are enough, since the policies
allow it.

Her id is then hard-coded in the client (D-022 — no pairing flow for MVP), so
keep it somewhere you can find it.

## Device rows are not seeded

A `device_id` is generated **on the device** — `crypto.randomUUID()`, kept in
`localStorage` — so a row created here would carry an id no phone will ever use.

The app writes its own row on first run, with that device's id and a null name. The welcome screen fills the name in later; an
unnamed device logging events is fine, and gating logging on a form is not
(`.specify/memory/baby-and-devices.md`).

**One ordering constraint this creates:** `timeslot.logged_by` is a foreign key
to `devices`, so the device row has to reach the server before any timeslot that
references it. Sync pushes devices first.

## Running a manual script

Every table has an **`updated_by`** column — free text, null by default. Set it
when a script touches rows, so they can be found again afterwards. The app never
writes it, which is what makes a non-null value mean exactly "a human ran
something".

It records *which* rows were touched, not what they held before. If you want to
be able to put things back, snapshot first — one line, and the free tier has
500 MB against a projected 5 MB a year:

```sql
create table event_backup_20260903 as select * from public.event;
```

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

No soft-delete columns: D-003 uses hard delete. No per-baby RLS: with no
Supabase Auth there is no identity to check `baby_id` against, and one baby is
all this deployment will ever hold — see the note in `0001` and D-004's
reversal condition.
