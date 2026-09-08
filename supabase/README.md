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
| `migrations/0003_us_units.sql` | Adds `event.pounds` and `event.fahrenheit`; comments the superseded `grams` and `celsius` | **Before deploying the version that writes them.** Additive and `if not exists`, so safe to re-run. Applied 2026-09-06 |
| `migrations/0004_drop_metric_columns.sql` | Drops `event.grams` and `event.celsius` | **After both phones are on code that stops sending them** — the reverse of 0003, so the reverse order. Refuses to run if either column holds a value. Applied 2026-09-06, ahead of that code being deployed — see below |
| `migrations/0005_restore_metric_columns.sql` | Puts `event.grams` and `event.celsius` back, nullable and dead | **Immediately** — it unblocks a phone that is silently not syncing. Additive and `if not exists`, so safe to re-run. Reverses 0004 and retires the idea; D-039 |
| `migrations/0006_baby_settings.sql` | Adds `baby.settings jsonb` — one object keyed by setting name, the feeding cycle being the first key | **Before deploying the version that writes it.** Additive and `if not exists`, so safe to re-run. Applied 2026-09-08; D-052 |

**There is no `0002`, and the number is burned.** `0002_seed_household.sql`
existed on 2026-09-03 and was **run against the database** before `0b14b40`
deleted it from the repo — device rows are written by the app, not seeded. The
directory therefore looks like `0002` is free and it is not: the owner has run a
file by that number, so reusing it makes "have you run 0002?" an unanswerable
question. It has already caused one round trip: a new migration
was numbered `0002`, and "0002 was run long ago" and "0002 has never been run"
were both true about different files. **Number from the git history, not from
what is on disk** — `git log --all --diff-filter=AD -- supabase/migrations/`
lists the deleted ones too. That migration was then dropped altogether; the
migration numbered `0003` is the next one that ever needed to run, and it skips
`0002` for exactly that reason.

**When one is ever added, order matters against the app, not just against the
other files.** Sync pushes whole local rows, so a client that knows about a
column and a database that does not fails the upsert and the outbox stops
draining — quietly, because push returns false and the reconcile is skipped while
writes are pending. Run the migration **before** deploying the version that
writes it. `verify-s2` and `verify-s8` are the two suites that would tell you,
because they are the two that hit the live database.

**`0003` is the first time this has actually happened.** It is additive on
purpose — the old `grams` and `celsius` columns stay — because two phones run
this app and the service worker updates lazily, so during a rollout one of them
is still on code that writes the old pair. Dropping them would break that
phone's sync until it happened to update.

**`0004` is that separate step, and its ordering is the mirror image.** Adding a
column is safe *early*, because a client that has never heard of it carries on
working. Dropping one is only safe *late*: any phone still naming `grams` fails
its upsert the moment the column is gone, and the outbox stops draining
quietly — push returns false and the reconcile is skipped while writes are
pending, so the phone looks fine and is not syncing. Deploy first, open the app
on both phones and let the worker update, then run `0004`. The columns sitting
there unread in the meantime cost nothing, and there is no deadline.

**In practice `0004` ran first, on 2026-09-06, before the code that stops
sending those columns was deployed.** Recorded rather than tidied away, because
the window it opened is exactly what this section describes: from the drop until
each phone picked up the new build, any phone still on the old code was failing
its upserts and holding writes in the outbox. Nothing was lost — the outbox is
durable and drains once the client and the schema agree again — but a moment
logged in that window did not reach the other phone until the app was reopened.

**`0005` puts them back, and nothing drops them again.** The
window did not close on its own: the owner saw a red sync dot on the second
phone later the same day and could not reach it to update it. That is the case
the "deploy first, then drop" order never covers — it assumes every client can
be brought forward on demand, and with a lazily-updating service worker, no
forced update and a phone in someone else's hand, none can.

So the rule is now stronger than an ordering. **Never drop a column, and never
narrow one.** Additive only. A dead column is two bytes of null on a table
projected at 5 MB a year against the free tier's 500 MB; a dropped one is a
phone that stops syncing and says *offline* while it does it. D-039 carries the
reasoning, including why the fix is a migration and not a deploy.

## `imports/` — one-off data, not schema

Scripts that put rows in rather than tables. They are **not** migrations, are not
part of rebuilding from empty, and are not safe to re-run blindly — each carries
its own guard.

| File | What it does |
| --- | --- |
| `imports/2026-09-05_paper-log-backfill.sql` | The ten photographed days of the paper log — 80 timeslots, 144 events — as staging tables that can be diffed against the photographs, then mechanical inserts. Guarded against a second run, with a rollback that filters on `updated_by = 'paper-log-import'` and nothing else |

**The backfill is not the coverage run**, and says so in its own header. It proves
the schema can hold the paper log. The gate in
`.specify/memory/coverage-requirement.md` asks whether the *app* can capture it
at 4am with thumbs, which no script can answer.

## The baby row

One row in `baby` for Liana. It can go in through the REST API with the anon key
rather than by hand — the app's own credentials are enough, since the policies
allow it.

**Done, 2026-09-03.** Liana is `94c55231-e3dd-46d0-8567-fa8d0b90d809`, and that
id is hard-coded in `src/config.ts` (D-022 — no pairing flow for MVP). The repo
is where it is kept; there is nowhere else it needs to be.

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
