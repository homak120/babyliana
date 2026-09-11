# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-11

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0-6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. **689 checks pass across twenty-one
suites**, and the working tree is clean: everything through D-055 is committed
and pushed.

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
- **Settings** — five sections behind the card's `tune` button: the quick
  bottle's volume and source, the supplement prefill, the prep-prompt lead, the
  feeding cycle, and this phone's clock format and name. Each row says whether
  it reaches both phones or stays on this one.
- Two mascot sets and a theme switched by the clock; 12- and 24-hour times, per
  phone.

**An offline-capable PWA at 24 entries / 1311.58 KiB precached.** The app icon
is the v2 art as of 2026-09-06 — the whole `public/` set replaced, full-bleed on
white. The 512 is 435 KB where the old one was 243, which is most of why the
precache sits where it does; the 1024 is excluded, being needed only at install.

### What changed most recently

Newest first, and **this is an index, not a record** — `docs/decisions.md`
carries the reasoning for every one of these, and for everything older.

- **D-055** — the `tune` sheet becomes a settings screen. Three new keys on
  `baby.settings` (bottle, supplement, prep lead), no migration — which is
  D-052 paying off. `settings.ts` is now a registry so the *next* setting costs
  an entry rather than a bespoke hydrate/isDefault/same trio, and `parse`
  returning null for junk stops a corrupt row resetting the other phone. No
  save button: every control commits on the tap.
- **D-054** — the home list's feed chip counts in seconds while the feed is
  open, in rose, with its own *end* button — the mirror of the sleep chip. It
  said nothing at all before, which stopped being defensible when D-053 made
  every quick bottle an open feed. No resume: reopening a sleep is the undo for
  a stir, and a feed has no equivalent.
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

**2. One build item left, `CC`:**

- **JSON export** — `technical-constraints.md` requires it before a second
  person sees the app, so it is a Phase 9 gate rather than a first-use one.
  Getting a file off an installed iOS PWA is the hard part, not the format.
- ~~A settings screen~~ — **done, D-055.** Export now has somewhere to live,
  which was half the reason it was on this list.

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
reasoning from then on.

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

### 2026-09-11 (latest) — the tune sheet becomes a settings screen

**Three more shared settings, and no migration** (D-055). The quick bottle's
volume and source, the supplement prefill, and the prep-prompt lead are keys on
`baby.settings` now. That is D-052 paying off exactly as designed: a key per
setting is no migration, where a column per setting would have been three — and
three pushes that could not go out ahead of them.

**The bottle default earned its place first, and D-053 is why.** While the
bottle opened a sheet, 60 mL was a prefill: visible, overwritable, wrong at no
cost. Since D-053 it writes straight to the log, so a wrong default is a wrong
*row*, fixed by a swipe-edit afterwards. The setting is what stops the one-tap
entry from lying.

**`cycles.ts`'s bespoke trio became a registry.** `hydrateCycles` /
`isDefaultCycles` / `same` was right for one setting and would have been four
copies drifting apart at four. Each key now declares its default, its parse and
its comparison, and one `hydrate` walks them.

**The interesting part is what `parse` returns for junk: null, not the
default.** A row carrying an empty cycle list or a volume of zero means
*nothing*, and reading it as the default would let one phone's corrupt write
quietly reset a setting the other had deliberately changed. `hydrate` skips the
key. The old `hydrateCycles` had that guard inline and it would have been lost
in the generalisation — `verify-s3` now checks all three junk shapes.

**And the reconcile lost its early return**, which was invisible while `cycles`
was the only key: it stopped at the first adopted value, so a row carrying a
cycle but no bottle default would never have pushed the bottle up.

**No save button.** Every control commits on the tap — local write, repaint,
push behind. A save button would also have been a regression on the clock
toggle, which has always applied instantly. The *push* debounces 600ms so
holding `+` does not queue twenty row writes; the local write never does.

**Every row says whose it is.** With one shared setting, "the cycle syncs" was
something you knew. With four, changing the bottle default and having the other
parent's phone start logging 90 mL is a surprise. The clock format and the
phone's name are in the same screen and marked *this phone* — they did not move
into `baby.settings` and must not.

**Six suites changed, and two labels were wrong before.** The cycle sheet said
"less often" on the button that *shortens* the gap, which feeds her more often;
the generic stepper says `decrease`/`increase`, which describes the number and
cannot be inverted. And the clock toggle's label named the format it would
switch *to* — a segmented control shows both and marks the live one instead.

### 2026-09-10 — the running feed gets the sleep chip's clock

**The home list said nothing about a feed that was happening** (D-054).
`sleepCell` returns "sleeping…" for an open sleep and the row overrides it with
a live count; `feedCell` returns *null* for an open feed. That was fine while a
feed came through the sheet — you had just typed a volume, and the card and the
bar carried the number. D-053 took the sheet off the bottle, so every quick feed
is an open one, and the commonest entry in the log was the one the list was
silent about.

**Seconds, rose, and an end button in the chip.** Seconds for the reason the
sleep chip has them — an open period is the thing on the screen that is
happening, and a figure sitting still for a minute reads as one the app stopped
watching. Rose only *while* it runs: `log.css` already said a second rose chip
beside the volume reads as a second feed, and that stays true of a finished one,
which is a footnote to the volume and keeps the neutral fill.

**No resume, deliberately.** The sleep chip has one because reopening a sleep is
the undo for a stir that was not a waking. A feed has no equivalent, and the
same asymmetry is already on the write side — `closeOpenSleep` stamps an end on
a sleep and refuses to on a feed.

**One tick for both.** A moment can carry a feed and a sleep, and two 1-second
intervals would repaint that row twice a second to show one number. Keyed on
whichever period is open, feed first, which is the priority the card and the
mascot state already use.

**`sleepClock` became `liveClock`.** Its own comment claimed to be the only
place in the app that counts in seconds; a second caller made that false, and
two stopwatches drifting apart in format is how one row ends up writing the same
second two ways.

### 2026-09-08 — two taps become one, and the day strip scrolls

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
