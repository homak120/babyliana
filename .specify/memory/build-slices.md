# Phase 6 build slices

Sessions here are short and scattered — often twenty minutes, often late. These
slices are sized and ordered so that **each one ends with the app still working**
and something new demonstrable. None leaves a half-built thing that has to be
held in your head until next time.

Each slice names what it delivers and, more importantly, **how you know it is
done** — a concrete test, not a feeling.

Ordering principle: reach *"I could actually use this tonight"* as early as
possible, then add breadth until the coverage checklist passes.

---

## S0 — Clear the decks

D-012: the spike's application code goes before the build starts, so an
evening's hacking cannot become the foundation.

**Owner, in the Supabase dashboard** — this is the only part of Phase 6 that
cannot be delegated. The anon key cannot run DDL, and the database password is
not something an agent should hold.

1. Run `supabase/migrations/0001_initial_schema.sql` — drops the spike table,
   creates the three tables, RLS, grants, realtime
2. One `baby` row for Liana. It can be inserted through the REST API rather
   than by hand — say the word and I will do it once the tables exist. Hand back
   her id

**Then, agent side:**

- Delete `src/App.tsx` and `src/App.css`
- Keep a smoke test on `/spike` — the one exception D-012 allows, already in
  `tasks.md`. **Not the tap page.** Its table is dropped, so keeping it would
  leave a permanently broken smoke test. Rewritten read-only against the real
  schema: reads the baby row, subscribes to `timeslot`, and reports config,
  connectivity, install state and build time. It writes nothing, so it cannot
  put junk rows into real tables
- Hard-code the baby id (D-022)

**Dropping `spike_taps` does not clean the phones.** Both already hold
`babyliana.device_id` in `localStorage`, which is per-origin and survives any
deploy. S1 has to cope with that rather than assume a clean slate — see the
upsert note there.

**Device rows are not seeded.** A `device_id` is generated on the device and
kept in `localStorage`, so a row created in SQL would carry an id no phone ever
uses. The app writes its own row on first run, with a null name; the welcome
screen in S9 fills the name in. This is why `device.name` is nullable.

**Done when:** `npm run build` passes, `/spike` still works, and `curl` against
each of the three tables returns `[]` rather than an error.

## S1 — Log a moment, locally

No network. This is the whole write path, proven on one device.

- IndexedDB store; TypeScript types matching the schema
- **Upsert this device's own `device` row on every startup** — the id from
  `localStorage`, name left null. `timeslot.logged_by` is a foreign key, so
  nothing can be logged until the row exists.

  Upsert means *create if absent, do nothing if present* — one row per device,
  forever, not a write per startup. `id` is the primary key, so after the first
  time the conflict always matches. **Use `ignoreDuplicates: true`**:
  `supabase-js`'s `.upsert()` defaults to updating on conflict, which would
  overwrite `name` with null on every startup and silently erase the name set on
  the welcome screen. Setting a name is a separate explicit update.

  **Do not detect "first run" by the absence of the localStorage key.** The
  spike already wrote `babyliana.device_id` on both phones and it survives —
  `localStorage` is per-origin and the real app deploys to the same origin, so
  dropping `spike_taps` does not clear it. A first-run check would find the key,
  conclude the device is registered, skip the insert, and then every timeslot
  write would fail its foreign key. An app that opens fine and cannot save.

  Upserting is immune to that, and to two other ways the flag desyncs: Safari
  evicting `localStorage` (which is what Q-004 is measuring), and a `device` row
  that was deleted or never synced. Reusing the spike's UUID is harmless once
  `spike_taps` is dropped — nothing references it and a UUID is a UUID.

  **Do not "fix" this by deleting the PWA and reinstalling.** That install is the
  running Q-004 experiment.
- The write path from `event-model.md` § Writing a timeslot: **generate both
  UUIDs up front**, write the timeslot and its events as one local unit. The
  naive insert-await-insert is what produces orphan timeslots
- The add sheet's skeleton: opens with **no type selected**, the three-bubble
  container, save disabled until a block exists (D-021)
- The milk block: volume keypad, arbitrary integers, `?` for unknown, breast /
  formula toggle
- A plain unstyled list of what has been logged

Because the sheet holds *N* blocks from the start, **a split feed works here for
free** — `25(B) + 45(F)` is two milk blocks in one moment, which is exactly what
D-019 says it is.

**Done when:** log three feeds including one split and one with an unknown
volume, reload the page, all three are still there and correct.

## S2 — Make it shared

- Push local writes to Supabase. **Devices first** — `timeslot.logged_by` is a
  foreign key, so a timeslot arriving before its device row is rejected
- **Full-refresh reconcile** on mount and on `visibilitychange` → visible
- Realtime subscription as a latency optimisation on top

**Done when:** log on the laptop and it appears on the phone within a second or
two. Then the specific bug the spike found: background the phone, log twice on
the laptop, foreground the phone — **the count must be right.** A green realtime
light and a stale number is the failure this slice exists to prevent.

## S3 — The home screen

- Elapsed hero: time since the last feed, measured from `ended_at` when present
  and `occurred_at` otherwise
- Today's totals — feeds, mL, pee, poop
- Recent list, newest first, with day separators
- The mascot and its derived states (settled / awake / hungry / sleeping, plus
  the *logged* flash). CSS as delivered in the handoff; Phase 7 refines it

**Done when:** the screen matches `handoff/README.md` § Log, and the elapsed
figure is correct against a known set of entries.

## S4 — Diapers

Drops into the block pattern S1 established.

- Diaper block: `pee` and `poop` toggles, both allowed at once
- Optional colour and consistency, revealed only when poop is on

**Done when:** a pee, a poop, and both-in-one-change are all expressible, and
skipping colour and consistency entirely is one tap fewer, not an error.

## S5 — Time entry

D-018 removed the `?`, which puts the whole weight here. **This is the slice
that decides whether the app beats the pen**, so it is worth doing properly.

- Steppers with hold-to-repeat (110ms, accelerating after ~1.5s)
- Offset pills — `now`, then minutes back
- Direct numeric entry
- Optional end time, making the moment a period (D-020)
- No natural-language parsing. It fails silently and the person using it is tired

**Done when:** you can log a feed you gave at 04:10 while standing in the kitchen
at 08:00, faster than writing it on paper. And log a sleep of 19:00–21:30.

> **From here the app is usable for real.** Feeds, diapers, backdating, and the
> recent list to check yourself. Everything after this is breadth and read-back.

## S6 — Notes, and the `other` type

The escape hatch. Without it the app is narrower than paper and the pen stays.

- Free-text note on the moment and on each entry
- The `other` block, with the secondary types behind it (D-010)

**Done when:** the last item on the coverage checklist passes — something nobody
anticipated has somewhere to go.

## S7 — The day view

- The table: date, time, milk, pee/poop, who — with **the date printed only on
  the first row of a day** and inherited below, as the paper page does
- The date strip

**Done when:** you enter one full day from the photographed log and hold the
phone next to the photo. Anything you cannot represent is a bug in the model,
not in the view.

## S8 — Edit and delete

Mutable rows (D-003) — plain updates, real deletes, no correction events.

- Swipe a row to reveal **two** actions: edit and delete (D-025). The handoff
  has only edit and no delete anywhere, so this extends the design
- **Edit** reopens the sheet pre-filled. Editing a value leaves the rest of the
  moment intact — the paper log's corrections strike a *value*, not a row
- **Delete** removes the whole moment and its entries (`on delete cascade`). To
  remove only one part, edit and `×` that block — the sheet already does this
- **Delete is immediate with an undo toast**, roughly five seconds, and the
  actual delete fires when it expires. The client therefore *holds* the moment
  during the window rather than deleting straight away — that holding is part of
  this slice, not an extra

The undo window is doing real work here. D-003 is hard delete: nothing to
restore from, and the deletion syncs to the other phone. A confirm dialog would
be safer and puts a modal in front of someone holding a baby at 4am.

**Done when:** correct a volume without disturbing the diaper logged at the same
moment; delete a moment and get it back with undo; delete another, let the toast
expire, and confirm it is gone from the other device too.

## S9 — Ready for the solo run

- Name entry on first run — simplified, no pairing (D-022). Do not gate logging
  on it: an unnamed device logging events is fine, a blocked parent is not
- Theme by clock, not by a setting
- Update strategy: check for a new service worker on `visibilitychange`, reload
  silently only when no entry is in progress, never a modal
- Offline check on the installed PWA

**Done when:** installed on your phone, it opens and logs in airplane mode, and
a deploy reaches it without reinstalling.

---

## Then: run the coverage checklist

`coverage-requirement.md` is the acceptance test, and it is a real one: enter all
**ten** photographed days — 8/26 to 9/4, three of them past what the baseline
writes up. If any entry cannot be represented faithfully, the app is not ready —
regardless of how good the parts that do work are.

That is the gate into Phase 7, not a formality.

## What is deliberately not here

Pairing (D-022), duplicate detection (D-023), export and settings (D-024). Each
has a trigger recorded in `docs/tasks.md` under *Post-MVP*.

## Before building from the design

Read `.specify/memory/design/phase-2-reconciliation.md`. The handoff is final on
look and interaction, but its data shapes predate D-019 and D-020 and need
remapping. The one place it reaches the interaction is the milk block: selecting
between two halves of one feed becomes *add another bottle*.
