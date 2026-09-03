# Event model

Status: **Phase 4, in progress.** The shape below is settled — two tables,
mutable rows, a timeslot as the unit. Column types and the secondary event
types are still being pinned down.

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
entered, nothing is written. Deleting a timeslot deletes its events with it.

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

### Adding a type

A migration: `ALTER TABLE`, a schema change, a redeploy. An earlier draft
claimed adding a type was configuration rather than migration; with one wide
table that is not true, and the claim is withdrawn rather than left standing.
The cost is accepted — the type list is short and already known, and D-010 says
most of these never reach the primary surface anyway.

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
- Conflicts resolve last-write-wins on `updated_at`.
- Duplicate detection is a read-time concern: two similar timeslots within a few
  minutes are surfaced for the user to resolve. Never merged silently, never
  resolved server-side.

## Export

A full JSON export of timeslots, events **and devices**, available from day one.

The free Supabase tier keeps no backups, and a project left paused is eventually
deleted. Both devices holding a local copy plus a manual export is the entire
disaster-recovery plan. Without the devices table the export is a wall of UUIDs.
