# Event model

Status: **Phase 4, column types finalised.** Two tables, mutable rows, a
timeslot as the unit, and a concrete Postgres schema below. What remains in
Phase 4 is the offline strategy (blocked on Q-004) and the owner's review pass —
see `docs/tasks.md`.

## Principles

**A timeslot is the unit, not an event.** The paper log's row is a moment:
`21:09` might carry a diaper change *and* two bottles. `paper-log-baseline.md`
states it directly — *"a row is a moment, not an event"* — and the schema
mirrors that rather than flattening it. One timeslot, one or more events.

**Rows are mutable.** Corrections are plain updates; deletes are real deletes.
Last write wins on `updated_at`. See D-003, which reversed an earlier
append-only design: a strikethrough on paper exists because ink cannot be
erased, not because anyone wants a revision history.

**Client-generated IDs.** Every row carries a UUID created on the device. Replay
is idempotent, offline creation is safe, and merging is union by `id`.

**Two timestamps, distinct.** `occurred_at` is when it happened and is editable.
`recorded_at` is when it was first written and never changes.

**No precision marker.** A time is a time — no exact/approximate/unknown, no
`?`, no `~`. D-018 removed the notation and put the weight on making time entry
and adjustment fast instead.

**Everything optional except the essentials.** A timeslot needs an id, a time,
and who logged it. An event needs an id, a timeslot, and a type. Every other
field may be absent — a feed with an unknown volume is a valid feed, and the
paper log contains one.

## `timeslot`

One row per moment someone sat down and logged something.

| Column | Notes |
| --- | --- |
| `id` | UUID, client-generated |
| `household_id` | Which family |
| `logged_by` | Device that recorded it — resolves to a name via the devices table |
| `occurred_at` | When it happened, or when a period starts. Editable |
| `ended_at` | Optional. Null means a point in time; set means a period |
| `recorded_at` | When first written. Never edited |
| `updated_at` | Bumped on every edit. The last-write-wins tiebreaker |
| `note` | Free text about the moment |

A timeslot always has at least one event. The UI enforces this: if nothing was
entered, nothing is written. Deleting a timeslot deletes its events with it —
enforced at the database level by `on delete cascade`, not left to application
code to remember.

### A point, or a period

`ended_at` is null for the overwhelmingly common case — a moment. Setting it
makes the timeslot a period, and **every event in it shares that period.**

Duration lives here rather than on individual events (D-020) so that any type
can have one, including `other`. The consequence, stated plainly: an event
cannot carry its own time inside a period. You cannot record "the diaper change
happened at 21:05 within a 21:00–23:30 sleep" — if that distinction ever
matters, it is two timeslots.

Whether the UI lets a period be opened now and closed later, or requires both
times at once, is an entry-flow question for Phase 2 (Q-007). The schema
supports either.

## `event`

One master table. `type` selects which columns are meaningful; the rest are
null. Adding a type is a migration, not configuration — see *Adding a type*.
Types and constraints are pinned in *Schema (Postgres)* below; this table is the
human-readable summary of the same thing.

| Column | Applies to | Notes |
| --- | --- | --- |
| `id` | all | UUID, client-generated |
| `timeslot_id` | all | Parent. An event belongs to exactly one |
| `type` | all | See registry |
| `note` | all | Free text. The escape hatch, on every type |
| `recorded_at`, `updated_at` | all | |
| `volume_ml` | feed | Integer. May be null — the log contains `?` |
| `source` | feed | `breast_milk` \| `formula` \| `unknown` |
| `pee` | diaper | Boolean |
| `poop` | diaper | Boolean. Both may be true on one change |
| `poop_colour` | diaper | yellow / green / brown / dark / other |
| `poop_consistency` | diaper | liquid / soft / seedy / firm / other |
| `grams` | weight | |
| `celsius` | temperature | |
| `supplement_name`, `amount` | supplement | |
| `severity` | spit_up | Or just use `note` |
| — | other | No columns of its own. `note` carries it |

**A split feed is two events, not one event with two components.** `25(B) +
45(F)` becomes two feed rows under one timeslot. This removes the nested
`components[]` array and its arbitrary two-item cap, and `30 + 30` — the
unlabelled split in the real log — falls out as two rows with `source` unknown.

**A diaper change is one event**, with `pee` and `poop` as separate booleans,
because one change may contain both.

**Sleep has no `ended_at` of its own.** Its duration is the timeslot's period.
Two places to express one fact is how a duration ends up correct in one view and
wrong in another.

**`other` has no columns at all.** Type plus `note`, and a period if it needs
one. It is the escape hatch that makes the app as accepting as paper: anything
the schema never anticipated still has somewhere to go, which is the last item
on the checklist in `coverage-requirement.md` and the one that makes the list
survive contact with reality.

**Annotations outside the fixed lists go in `note`.** The real log contains
`2 (G→Y liquid)` — a colour in transition — and `2 (small Y)`, where "small" is
a quantity with no column. Neither fits a single value from a fixed list, and
neither is worth a column: one appears once in seven days, the other may simply
be handwriting. They land in `note`, which is what `note` is for. The cost,
stated so nobody rediscovers it: the transition date is answerable as "the first
entry where colour is yellow", but an entry recording the change *as it happens*
is prose rather than data.

**For a `feed` row, `source` is never SQL null.** It is always one of the three
values — `unknown` is a real answer for the unlabelled `30 + 30` split, distinct
from the column being absent because the row is not a feed at all.

### Adding a type

A migration: `ALTER TABLE`, a schema change, a redeploy. An earlier draft
claimed adding a type was configuration rather than migration; with one wide
table that is not true, and the claim is withdrawn rather than left standing.
The cost is accepted — the type list is short and already known, and D-010 says
most of these never reach the primary surface anyway. `type` is plain text with
a `CHECK` constraint rather than a Postgres enum: extending a text `CHECK` is a
one-line edit, where growing an enum's value set is schema surgery. Given a
migration is already accepted, it should at least be the easy kind.

## Schema (Postgres)

No `households` table. D-004 has no accounts — the household is a bare UUID
minted by the first device and shared by QR code. There is nothing to store
about a household beyond its id, so `household_id` is a plain column on every
other table, not a foreign key to anything.

```sql
create table public.devices (
  device_id    uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  name         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.timeslot (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  logged_by    uuid not null references public.devices(device_id) on delete restrict,
  occurred_at  timestamptz not null,
  ended_at     timestamptz,
  recorded_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  note         text,
  constraint period_is_forward
    check (ended_at is null or ended_at >= occurred_at)
);

create table public.event (
  id            uuid primary key default gen_random_uuid(),
  timeslot_id   uuid not null references public.timeslot(id) on delete cascade,
  type          text not null check (type in (
                  'feed', 'diaper', 'sleep', 'weight',
                  'temperature', 'supplement', 'spit_up', 'other'
                )),
  note          text,
  recorded_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- feed
  volume_ml     integer check (volume_ml is null or volume_ml >= 0),
  source        text check (
                  source is null or source in ('breast_milk', 'formula', 'unknown')
                ),

  -- diaper
  pee               boolean,
  poop              boolean,
  poop_colour       text check (
                      poop_colour is null or poop_colour in
                      ('yellow', 'green', 'brown', 'dark', 'other')
                    ),
  poop_consistency  text check (
                      poop_consistency is null or poop_consistency in
                      ('liquid', 'soft', 'seedy', 'firm', 'other')
                    ),

  -- weight / temperature — no range CHECK. A bound tied to normal body-weight
  -- or body-temperature values is a step away from the normal-range judgement
  -- CLAUDE.md rules out; a typo-catching bound is not worth that risk.
  grams         integer check (grams is null or grams > 0),
  celsius       numeric(3,1),

  -- supplement — amount is text, not a number-plus-unit: "1 drop" and "0.5ml"
  -- are both real answers and do not share a unit.
  supplement_name  text,
  amount           text,

  -- spit_up — deliberately unstructured; Q-006 has not confirmed this type
  -- gets used at all
  severity      text
);

create index event_timeslot_id_idx
  on public.event (timeslot_id);
create index timeslot_household_occurred_idx
  on public.timeslot (household_id, occurred_at desc);
create index devices_household_id_idx
  on public.devices (household_id);
```

**`logged_by` is `on delete restrict`, deliberately.** A device that has logged
anything cannot be deleted. History should not disappear because someone tidied
up a device list, and with two devices there is no reason to remove one. The
alternative — nullable `logged_by` with `on delete set null` — keeps the rows
and loses the attribution, which is the thing the column exists for.

**No per-type `CHECK` forcing irrelevant columns to stay null** — e.g. blocking
`volume_ml` on a `diaper` row. Considered and declined: the only writer is this
app's own client, so a malformed row would be a bug in code you control, not
data from an untrusted source. Worth adding later if the API is ever opened up.

**`updated_at` has no trigger.** The client sets it explicitly on every write,
including the first — equal to `recorded_at` at creation. No `PLPGSQL` function
to maintain on a free-tier project with no server side.

### RLS cannot isolate households — a real, accepted gap

Every device shares one public anon key, and D-008 made the repo (and therefore
that key) genuinely public. Row-level security can restrict what the `anon`
*role* is allowed to do — same pattern as `spike_taps` in
`.specify/memory/spike-spec.md`, and the same Data API grant gotcha applies —
but it cannot restrict rows to *one household*, because with no Supabase Auth
there is no authenticated identity to check `household_id` against.

**Today this is moot.** Exactly one household will ever exist on this
deployment. It stops being moot the moment a second family shares the same
deployment — Phase 12, and D-004 already names this as the reason identity
needs revisiting if that phase opens. Real isolation at that point means
Supabase Auth, a JWT claim, or separate projects per household — not a
`household_id` filter that anyone holding the anon key could simply omit.

## Writing a timeslot

The client generates **both** UUIDs up front, writes the timeslot and its events
to local storage as one unit, and syncs them together. The naive
insert-await-insert produces an orphan timeslot when the second call fails;
generating ids first makes a retry idempotent, since union by `id` means writing
the same row twice costs nothing.

## Derived views

Computed, never stored:

- Time since last feed — the primary readout. The most recent timeslot holding a
  feed event, measured from its `ended_at` when it has one and `occurred_at`
  otherwise. What a tired parent means by "since the last feed" is since she
  finished, not since she started. Same rule everywhere else time-since is shown
- Volume today, split by source
- Pee and poop counts today
- Time since last poop
- Chronological day view, matching the paper log's shape

Day boundary is midnight local (D-015).

## Sync

- Writes land locally first. The UI never waits on the network.
- **Reconcile is a full refresh.** On mount and on resume, re-fetch and replace
  local state. At roughly thirty events a day the whole log is small enough that
  this is cheap, and it is what makes hard deletes work — a removed row is
  noticed by its absence.
- **Realtime is a latency optimisation, not the sync mechanism.** It has no
  replay, so anything written while a phone was backgrounded is missed
  permanently. The spike demonstrated this: a phone sat at 20 while the database
  held 23, subscription green. See `.specify/memory/spike-spec.md`.
- Conflicts resolve last-write-wins on `updated_at`, **which the client sets.**
  Two phones with skewed clocks can therefore pick the wrong winner: an edit made
  later can carry the earlier timestamp and lose. Server-side `now()` would fix
  it and would break the local-first write path, so this is accepted rather than
  solved. The realistic case is one person correcting their own entry seconds
  after making it, where no second device is involved at all.
- **No duplicate detection in MVP** (D-023). Nothing is flagged, surfaced or
  merged. The non-negotiable is *never resolve a duplicate silently*, and never
  merging satisfies it for free. If both parents log the same feed, that is two
  timeslots minutes apart in the day view, and a human deletes one — which the
  paper-shaped table and swipe-to-edit rows already make easy. Revisit if it
  turns out to be annoying during the solo run.

## Export

A full JSON export of timeslots, events **and devices**, available from day one.

The free Supabase tier keeps no backups, and a project left paused is eventually
deleted. Both devices holding a local copy plus a manual export is the entire
disaster-recovery plan. Without the devices table the export is a wall of UUIDs.
