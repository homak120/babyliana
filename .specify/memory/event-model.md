# Event model

Status: **draft.** Phase 1 shape, to be finalised in Phase 4 (technical design).
The principles are settled; field names and types are not.

## Principles

**Append-only.** Events are immutable once written. An edit is a new event
referencing the one it corrects. A deletion is a tombstone event. Nothing is
ever mutated in place, and nothing is ever removed.

This is not architectural purity. It is derived from the paper log, which
already contains strikethroughs, retroactive insertions, and out-of-order rows.
The correction case is real usage, not a hypothetical.

**Client-generated IDs.** Every event carries a UUID created on the device. This
makes replay idempotent, makes offline creation safe, and makes merging two
offline devices a concatenation rather than a conflict resolution.

**Two timestamps, always distinct.**

- `occurred_at` — when the thing happened. Editable. May be approximate.
- `recorded_at` — when it was written. Never editable. Set by the device.

The paper log proves these diverge: `04:?` written in the morning, `4:10`
inserted after `12:40`. One timestamp is not enough.

**Approximation is first-class.** `occurred_at` carries a precision marker
(exact / approximate / unknown). The log uses `?` roughly once a day. An app
that demands an exact time will be lied to.

**Everything optional except the essentials.** An event needs an ID, a type, a
timestamp, and a device. Every other field may be absent. A feed with an unknown
volume is a valid feed — the paper log contains one.

## Envelope

Every event, regardless of type:

| Field | Notes |
| --- | --- |
| `id` | UUID, client-generated |
| `household_id` | Container for the family |
| `device_id` | Which device created it |
| `type` | See registry below |
| `occurred_at` | When it happened |
| `occurred_at_precision` | `exact` \| `approximate` \| `unknown` |
| `recorded_at` | When it was written. Immutable |
| `note` | Free text. Available on every type. The escape hatch |
| `corrects` | Optional. ID of an event this supersedes |
| `deleted` | Tombstone marker |

## Type registry

Open registry. Adding a type is configuration, not migration.

### `feed` — required at launch

Up to two components, each with a volume and an optional source. Covers `60`,
`25(B) + 45(F)`, and `30 + 30` in one shape.

- `components[]` — each `{ volume_ml, source }` where source is
  `breast_milk` | `formula` | `unknown`
- Volume may be null (the log contains `?`)

Unit is millilitres throughout. Display units are a presentation concern.

### `diaper` — required at launch

- `pee` — boolean
- `poop` — boolean
- `poop_colour` — yellow / green / brown / dark / other. Free text fallback
- `poop_consistency` — liquid / soft / seedy / firm / other
- Both `pee` and `poop` may be true on one event

Colour and consistency are structured, not free text, because the log already
records them by hand and the transition date is a question worth answering
without reading rows.

### Additional types — supported, not featured

Built into the registry, reachable behind a secondary affordance. Not on the
primary logging surface at launch. See `decisions.md` D-010.

| Type | Fields |
| --- | --- |
| `sleep` | `ended_at`, or open-ended |
| `weight` | `grams`. Expect very few rows, entered from appointments |
| `temperature` | `celsius`. Rare, but the rows you most want timestamped |
| `supplement` | `name`, `amount`. Vitamin D drops and similar |
| `spit_up` | severity, or just the note field |

Promotion from secondary to primary is decided by observed use during Phase 8,
not by design now.

## Derived views

Computed from the log, never stored:

- Time since last feed — the primary readout
- Volume today, split by source
- Pee and poop counts today
- Time since last poop
- Chronological day view, matching the paper log's shape

Day boundary is midnight local, matching how the paper log groups dates.

## Sync

- Events are written to local storage first. The UI never waits on the network.
- Sync to the server is background replication of an append-only stream.
- Merge is union by `id`. Two devices offline simultaneously produce two sets of
  events that concatenate. There is no conflict to resolve.
- Duplicate detection is a read-time concern: two same-type events within a few
  minutes are flagged as possible duplicates for the user to resolve. Never
  merged silently, never resolved server-side.

## Export

A full JSON export of the event stream, available from day one.

The free Supabase tier has no backups. Both devices holding a full local copy
plus a manual export is the entire disaster-recovery plan. It is also the
migration path if the backend is ever replaced.
