# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-08

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0-6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. **660 checks pass across twenty-one
suites**, and the working tree is clean: everything through D-053, and the
documentation pass that followed it, is committed and pushed.

**The schema is current through `0006`, and every migration is applied.**
`supabase/README.md` is the record of what exists and when each one ran — trust
it over this file for migration state. Two rules sit around it. **Additive
only** (D-039): no column is ever dropped or narrowed again, because "after
every phone has updated" is not an observable moment when the service worker
updates lazily, there is no forced update, and one of the phones belongs to the
other parent. And **a schema change must reach Supabase before the code that
writes it is pushed**, because sync upserts whole rows — a client naming a
column the database does not have stalls its outbox, silently.

### What exists

Local-first writes to IndexedDB that never block on the network, and
push-then-reconcile sync with Supabase.

- **Home** — mascot artwork by derived state, a top card with three leads
  (elapsed / next feeds / mascot) chosen from a rail beside it, a prep-timer
  pill, totals, and the recent list with swipe-to-edit-and-delete behind a
  confirm sheet.
- **Report** — the paper-shaped day table with a scrolling date rail and a
  period picker, plus an insights mode: milk intake, daily rhythm, wet and poop,
  diapers a day, milk by source, poop colours, sleep, and growth when there is
  a weight.
- **The add sheet** — one moment, with milk, diaper, sleep, weight, temperature,
  supplement and other, a free-text note on every one of them, and a time card
  carrying its own date, an optional end with its own date, and offsets both
  ways.
- **The bar** — a bottle and a bedtime button that write straight to the log, a
  diaper that opens the sheet, and `+` for everything else. Each of the first
  two becomes an *end* pill while its period is running.
- **First run** — a photograph gate, name entry, and a second gate code that
  hands a reinstalled phone its old identity back rather than minting a new one.
- Two mascot sets and a theme switched by the clock; 12- and 24-hour times, per
  phone.

**An offline-capable PWA at 24 entries / 1311.58 KiB precached.** The app icon
is the v2 art as of 2026-09-06 — the whole `public/` set replaced, full-bleed on
white. The 512 is 435 KB where the old one was 243, which is most of why the
precache sits where it does; the 1024 is excluded, being needed only at install.

### What changed most recently

Newest first, and **this is an index, not a record** — `docs/decisions.md`
carries the reasoning for every one of these, and for everything older.

- **D-053** — the bottle and the bedtime button write straight to the log, one
  tap and no sheet, so `+` is now the only route that asks for a volume. The
  home list's sleep chip counts in seconds while it runs and carries an *end*
  button, then a *resume* once it is over, which reopens that same sleep rather
  than starting a new one. The report's day strip becomes `all days` and `more`
  pinned around a scrolling rail that follows a page swipe as well as a tap.
- **D-052** — `baby.settings jsonb`, one object keyed by setting name, with the
  feeding cycle as the first key, so the two phones agree on the rhythm instead
  of each holding its own opinion of it.
- **D-050, D-051** — the status card as the handoff draws it: a prep pill, four
  estimated next feeds each naming the window that produced it, and the feeding
  windows editable behind a `tune` button — the app's first settings screen.
- **D-049** — three more charts on the report, on a series palette that was
  computed and validated rather than eyeballed.
- **D-039** — additive-only schema, written after a dropped column silently
  stopped the second phone syncing while it showed *offline*. The most expensive
  lesson on this list.

**What is left is mostly not code.** Two build items remain — export and a
settings screen — and the rest is the owner's judgement. See *Next action*.

## Next action

**1. The coverage run. This is the gate and it is the owner's.** Enter the
photographed days from `.specify/memory/paper-log/` into the app on the phone,
against the checklist in `coverage-requirement.md`. **Ten days, not seven** — the
photographs run 8/26–9/4, three days past what the baseline covers. Not in a
script — the point is thumbs, at speed, in the dark. If something cannot be
entered, that finding outranks any further polish. It is the single biggest open
item in the project.

**2. Two build items, both small, both `CC`:**

- **JSON export** — `technical-constraints.md` requires it before a second
  person sees the app, so it is a Phase 9 gate rather than a first-use one.
  Getting a file off an installed iOS PWA is the hard part, not the format.
- **A settings screen** — the design has never had one. The `tune` sheet
  (D-050) is the first thing that looks like one, but it holds the feeding
  windows and nothing else; export needs somewhere real to live, and the
  12/24-hour toggle and the name are currently two unrelated controls in the
  status row.

**3. Three owner decisions, none blocking:** Q-003 (mascot identity and the
rights caution), Q-008 (the final name, which gets dearer with every asset
carrying it), Q-006 (which of the *remaining* secondary types earned promotion —
sleep already went, by design in D-029 rather than by the solo run; weight,
temperature, supplements and spit-up are still answered by use, not by thinking).

**4. Q-004 runs itself.** Whether Safari evicts IndexedDB on a backgrounded
phone. The clock is running; nobody needs to do anything.

## How to work on this

Read `CLAUDE.md` first, then this file. Beyond that:

- **`npm run verify`** is the gate: typecheck, **ten** data-layer suites
  (`verify-s1`…`s9` plus `insights`), a build, then **eleven** browser suites
  against it — `swipe`, `period`, `hero`, `milk`, `period-row`, `overlay`,
  `sleep`, `feed`, `welcome`, `report`, `other`. Twenty-one in total. The browser
  eleven serve their own build and touch no database, so they are the cheap ones
  to run on a UI change. Two of the data-layer suites — `s2` and `s8` — hit the **live**
  database and delete only ids they created in that run; never widen one to a
  filter. **Those two are the ones that go red when the schema and the app
  disagree** — which is how a stray column got caught on 2026-09-05 before it
  reached the database.
- **`scripts/ios/`** drives the iOS Simulator with real touch, and
  `measure-screenshot.mts` measures a screenshot the owner sends. Both exist
  because this project has repeatedly shipped fixes that passed on desktop and
  did nothing on a phone. Read `scripts/ios/README.md` before using them.
- **When a design detail and the handoff prose disagree, the prototype wins.**
  The README said the elapsed hero was 64px and the mascot 108px; the prototype
  draws 44px in a 100×96 slot. Following the prose broke the layout twice.

## In flight

**Nothing.** The working tree is clean.

This section records **what is sitting uncommitted and why**, so a cold session
can read `git status` and know what it is looking at. It is not a changelog:
once work is committed its entry comes out, and `docs/decisions.md` carries the
reasoning from then on. It had grown to four hundred lines of already-committed
history and was emptied on 2026-09-08 — the facts in it that were not decisions,
namely which migrations are applied and when, now live in `supabase/README.md`,
which is the right home for them.

## Open threads

Noticed, not blocking, no owner yet.

- **Unresolved marks on the paper log.** Several `1`s in the Pee/Poop column
  appear underlined, and one 9/1 milk cell may be a ditto mark rather than a
  number. Both may just be handwriting crossing the ruled line. Deliberately not
  recorded in the baseline as fact. Needs human eyes on the original page — the
  coverage rule is *every mark has a home*, so if an underline means something,
  the model is missing a dimension.

  **Sharpened 2026-09-05 by re-reading the photographs at full resolution.** The
  9/1 `00:22` cell reads as `80` to me; if it is instead a ditto it inherits
  `30(B)+30(F)` from the row above and becomes two feed rows, not one — a
  materially different entry either way. Two more: on 8/30 the two afternoon
  hours are overwritten and unreadable (`1?:?`, twice), so two moments cannot be
  placed at all; and 8/31 `12:40` is written above `04:10`, which is either the
  out-of-order insertion the baseline already describes or a slipped leading
  digit. All four are left as holes in the backfill script rather than guessed.

- **The paper log runs three days past the baseline.** `paper-log-baseline.md`
  covers 8/26–9/1; the photographs also carry 9/2, 9/3 and 9/4. Those days
  introduce at least one thing the baseline never saw — `Nasal` written in the
  Pee/Poop column on 9/3, which is neither a feed nor a diaper and lands on
  `other`.

  **The baseline now says so, in a dated note at its head, and nothing more.**
  Extending its tables is a re-read of the photographs against the authority
  document, not a doc edit, and it is the owner's — an agent widening the primary
  requirements document from its own transcription would make the transcription
  the authority. The note names the gap so a cold reader cannot mistake the
  document for complete.
- **No Spec Kit scaffold.** `.specify/memory/` follows the convention but there
  is no `constitution.md`, no scripts, no templates. The non-negotiables in
  `CLAUDE.md` are effectively the constitution. If Phase 5 intends to run real
  Spec Kit commands, the scaffold has to exist first.

## Session log

Newest first. **Three entries maximum** — delete the oldest when adding a
fourth. This is orientation, not history. `git log` is the history.

### 2026-09-08 (latest) — two taps become one, and the day strip scrolls

**The bottle and the bedtime button stopped opening the sheet** (D-053). Both
write straight to the log now. The reasoning is short: the sheet was not asking
a question on either of them — the bottle already opened on 60 mL of formula,
and sleep has nothing to fill in at all — so the save button was confirming what
the first tap had said. These are the two entries made one-handed in the dark.

**Nothing was taken away to buy it.** The `+` button still reaches a feed of any
volume, and it is now the only route that asks for one; the row lands at the top
of the list where a swipe reaches edit and delete. No toast, no undo bar — a bar
you have to dismiss puts back the tap this removed.

**The sleep chip counts in seconds while it runs**, on an interval that exists
only while there is an open sleep, and reverts to minutes once it is over. It is
the one thing on the screen that is *happening*; a figure that sits still for a
minute reads as one the app has stopped watching.

**Resume reopens that same sleep rather than starting a new one.** The owner
chose this over "start a fresh sleep" with both readings in front of him: it is
the undo for a stir that was not a waking, and the count picks up from the start
it always had. Latest moment only, the same rule ending has.

**The report's day strip is now a fixed pair around a scrolling rail.** The
three-pill cap existed because the pills used to push `more` off the edge;
pinning `all days` and `more` solves that directly and the cap had nothing left
to buy. The rail follows a page swipe as well as a tap — centred by hand, not
with `scrollIntoView`, which walks every scrollable ancestor and would scroll
the table vertically on what was meant to be a sideways move.

**Five verify suites had to change** and that is the honest cost: four of them
seeded data by driving the bottle through the sheet, and that route is gone.
660 checks pass across twenty-one suites.

**Then a documentation pass, because this file had stopped working.** *In
flight* had grown to four hundred lines of already-committed history — it is
meant to say what is sitting uncommitted, so a cold session can read `git
status` and know why. It is empty now. *Position* was a reverse-chronological
changelog contradicting itself in two places (it said the bottle prompt was
display-only, which D-045 had already changed, and described weight in kg after
D-036 moved it to pounds); it is a description of the current app plus an index
into `docs/decisions.md`. **801 lines to roughly 300.** Nothing was lost: every
paragraph removed named its own D-number, and the two facts that were not
decisions — that `0005` and `0006` are applied — belong in
`supabase/README.md`, which had never recorded `0006` at all.

**And the pass found a live contradiction in a spec artifact.**
`.specify/memory/event-model.md` still said time since the last feed is measured
from `ended_at` where there is one — the rule D-040 reversed, quoting the same
reasoning D-040 records as wrong. That is the document `CLAUDE.md` sends you to
before writing storage code, so it was worth more than a footnote. Corrected,
and it gains a paragraph on reopening a period, since clearing `ended_at` back
to null is a model fact rather than a UI one. **Worth repeating as a habit: the
artifacts go stale silently, and only a decision that reverses an earlier one
leaves a trace to find them by.**

### 2026-09-08 — the feeding cycle stops being a per-phone opinion

**`0006` adds `baby.settings jsonb`** and the rhythm syncs (D-052). It went on
`baby` rather than a new table because that row is the root of the schema
(D-022), a setting like this is a fact about her rather than about a phone, and
`pull()` already fetched it — half the work existed.

**It was `cycles jsonb` first, and the owner asked the better question:** make
it generic. A column per setting is a migration each; a key per setting is none.
`0006` was rewritten rather than superseded — it had never been applied or
committed, so no database and no client had seen it, and a file that never ran
does not burn its number the way `0002` did.

**Writes merge, never replace.** Saving the cycle by writing the whole object
would drop every other key, including ones the writing build has never heard of.
`verify-s2` checks a second key survives the first. What is still true: two
phones editing *different* keys at once resolve last-write-wins over the object,
and one loses.

**And the round-trip found a bug.** `jsonb` does not preserve key order — a
cycle written `{id, from, to, gap}` comes back `{id, to, gap, from}`, the same
thing and a different string. `hydrateCycles` compared with `JSON.stringify`, so
every pull read as a change and repainted the card before settling. It compares
field by field now. The `verify-s2` check that caught it was making the same
mistake, which is how both were found at once.

**The write path did not.** `PUSH_ORDER` was device/timeslot/event and the
outbox knew nothing of `baby`. Both widened, `baby` first, since it is the root
every timeslot references.

**localStorage stays, demoted to a cache.** `cycleFor` is called during render
and IndexedDB is asynchronous, so a synchronous read has to come from somewhere.

**The reconcile is asymmetric, and that is the interesting part.** A row with a
cycle wins — that is the sync. A row with *none* takes this phone's, but only if
this phone has been tuned. `saveCycles` needs a local `baby` row to update and
cannot invent one (`baby.name` is `not null` and a fresh phone does not know
it), so a cycle set before the first sync would otherwise sit local forever.
Adopting a `null` would have thrown away exactly that change.

**Last write wins, silently, and that is a choice** — for one pair of numbers
there is nothing to merge, and "never resolve a duplicate silently" is about
events.

**This one blocks the deploy, and it is the case the rule was written for.**
`verify-s2` is red on `the baby row carries a cycles column` until the migration
runs.

### 2026-09-07 — a fourth estimate, and the chip it caught

**Next feeds shows four times** (D-051). Three reached about nine hours out — an
evening. Four reaches past midnight from an afternoon feed, which is the
question that tab is opened at 4am to answer.

**And it put a bug on screen.** The interval chip named the window a row *landed
in*, not the one whose gap produced it. Those differ only when a step crosses a
boundary, which three rows rarely showed: `22:40` is three hours after `19:40`
and carried a `4h` label, because 22:40 is itself inside the night window.
`feedTimeline` returns `{ at, cycle }` now, the cycle being the one the step
started in.

**No check caught it** — `verify-hero` counted chips and `verify-s3` checked
times, and both passed throughout. Reading the four times against each other did.
Two checks guard it now.
