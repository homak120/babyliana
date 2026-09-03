# Baby, devices and joining — Phase 4 design note

Status: **deferred to post-MVP** (D-022). Kept because the thinking is done and
will be wanted; not to be built yet.

For MVP one `baby` row is inserted for Liana and her id is hard-coded — two
phones, one baby, no join flow (D-022, D-026). The `device` table still exists
and is in the schema, because attribution ("did I log that, or did you") is
wanted from day one; only the *pairing* is deferred.

Note that the Phase 2 handoff independently proposed a **typed readable code**
(`LNA-7QD4-8213`) rather than the QR in D-004. That is worth reconciling when
this comes back: a readable code needs no camera permission and can be sent to
someone who is not in the room.

## The problem it solves

Every event records which device wrote it. `product-definition.md` is explicit
that this is not for accountability — *"did I log that or did you"* is a real
3am question. But a device id is a UUID, and `cacf8082-185a-4214` answers
nothing. D-018 set the rule: a mark a human cannot read at a glance does not
belong in the app.

The name also has to be readable on **the other parent's phone**. Solving it in
local storage only would fix it on the one device that already knew the answer.

## The design

A synced `device` table. Timeslots carry `logged_by`; clients fetch the table
once and resolve ids to names for display.

Draft shape, to be typed properly in Phase 4:

| Column | Notes |
| --- | --- |
| `id` | UUID, generated on the device, primary key |
| `name` | Free text, entered by the user. "Dad's iPhone", "Mum" |
| `created_at`, `updated_at` | |

A device does **not** reference a baby (D-026). A phone belongs to a parent, not
to a child.

**Why a table rather than carrying the name on each event.** Renaming works
retroactively — fix a typo once and every past event displays correctly.
Denormalising the name onto events makes that impossible without rewriting
history. The lookup cost that would normally argue the other way does not apply
here: the table holds two or three rows, forever, and sits in memory.

## Three constraints

**1. Creation requires a connection.** Naming a device happens on first run,
which for MVP is already a connected moment. Owner's call, and the right one:
with two devices this is not worth engineering around.
Names are then available from whatever was last fetched, and the set is tiny and
near-static, so keeping it is trivial rather than a sync problem.

**2. The export includes it.** `technical-constraints.md` makes JSON export a
non-negotiable, and a paused Supabase project is eventually deleted. An export
of events alone would be a wall of UUIDs — complete, and unreadable. Export both
tables, or resolve names into the export as it is written.

**3. Renames are last-write-wins**, like everything else now that D-003 has
moved to mutable rows. Two devices renaming the same row concurrently is the
only conflict here, and in practice each parent names their own phone once and
it never fires.

## First run, and the QR join, are the same screen

D-004 has the shared token be the baby's id. Receiving it is the same moment as
naming yourself, so it is one design with two paths:

- **First device** — create the baby, name this device
- **Second device** — receive the baby id, name this device

Do not gate logging on it. If storage is ever cleared, this screen would
otherwise reappear at 3am in front of someone holding a baby, and a parent who
opens the app to log a feed and gets a form instead reaches for the pen. An
unnamed device logging events is fine; a blocked parent is not.

## Not on screen

The raw UUID. It is visible in the spike for debugging, and does not belong in
the real app — D-018's readability rule. Behind a settings or debug view if it
is needed at all.

## Carried over from the spike

The table needs **RLS policies and an explicit Data API grant**, exactly like
`spike_taps` did. Skipping the grant returns empty results or a 401 with no
useful error — see `.specify/memory/spike-spec.md`.
