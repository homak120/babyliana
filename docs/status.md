# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-05

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0–6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. 371 checks pass across twenty suites.
**No schema change — `0001` is still the whole schema.**

What exists: local-first writes to IndexedDB that never block on the network,
push-then-reconcile sync with Supabase, the home screen (mascot artwork by
derived state, elapsed hero, totals, recent list), the day table with a date
strip and period picker, the add/edit sheet with milk, diaper, **sleep**, other
and notes, swipe-to-edit-and-delete on both lists behind a confirm sheet, a
photograph gate before the welcome, name entry, two mascot sets and a theme
switched by clock, and an offline-capable PWA at 24 entries / 1012.76 KiB
precached.

**Feeds now run live too** — §11 and §12 of `CHANGES.md`, the last two items.
A feed with no end time reads as running: the bar's bottle becomes the handoff's
`timer_off` pill carrying the live duration, the top card grows a
`<duration> feeding` line with a matching 30px button, Liana's state is
*feeding*, and `fed 25 min` reads back on the row once it is over. Either control
stamps the end on the **timeslot**. **Derived from `ended_at` and nothing else**, the
same rule as sleep — D-033, which records that a first pass added an
`event.in_progress` column and the owner rejected it, because the timeslot
already carries the end time for every type (D-020). Milk also reads in words
now: `25 mL breast + 45 mL formula`, not `25(B) + 45(F)` (D-034). **Adding an
end time by hand now defaults to the clock**, not to a guessed half hour, and the
end row carries its own `now` pill beside the `+30 min` offsets.

**Sleep is a first-class type** as of the third design delivery — its own bubble,
its own block, a quick icon that becomes a live "end sleep" pill while one is
running, and an open sleep expressed as a missing end time rather than a flag.
D-029 has the reasoning; it amends D-013, which had sleep supported but not
featured. The card now also says how long she has been down and offers a second
way to end it, and **the top card has three leads** — elapsed, combined, mascot
— chosen from a rail beside it. That completes the third handoff's `CHANGES.md`.

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
- **A settings screen** — the design has never had one, and export needs
  somewhere to live.

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
  (`verify-s1`…`s9` plus `insights`), a build, then **ten** browser suites
  against it — `swipe`, `period`, `hero`, `milk`, `period-row`, `overlay`,
  `sleep`, `feed`, `welcome`, `report`. Twenty in total. The browser ten serve
  their own build and touch no database, so they are the cheap ones to run on a
  UI change. Two of the data-layer suites — `s2` and `s8` — hit the **live**
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

**§11 and §12, committed but not pushed** (`a2cb0cb`, amended), plus this file
and `docs/decisions.md`, where D-032 gained a measurement of what the watch list
does on the real log. **Also uncommitted: the end-time `now` default** —
`src/log/time.ts` (`endNow`), `src/log/TimeCard.tsx`, four checks in
`verify-s5`. Nothing else — the insights screen itself is pushed
(`b725da1`, `0584b57`).

**Read D-033 before touching any of it.** The first pass followed the prototype
and added an `event.in_progress` column with a migration behind it. The owner
rejected it on the model: the timeslot already carries the end time for every
type (D-020), so a feed derives its open state from `ended_at` exactly as a sleep
does, and nothing new is stored. The column, the migration and the "she is still
on it" toggle were all rolled back. **The prototype is authority on interaction,
not on the data model** — that is the durable lesson, and it is now the first
line of D-033.

The one asymmetry with sleep that survives is the auto-close: logging something
else ends a running *sleep* and deliberately does **not** end a running *feed*,
because the next diaper is no evidence of when a bottle finished. `verify-feed`
asserts the feed's row still reads `20:57` and not `20:57–20:58`. Everything else
is the same rule on the same field.

**Known and accepted:** while a feed is open the quick bottle is the end-feed
pill, so a second feed goes through `+`. Tried the other way first; the owner
chose the swap, and closing the feed is what the pill is asking for.

Two smaller judgement calls:

- **The end-sleep icon did not revert.** §11 moves it back to `wb_twilight`; the
  app keeps the hand-drawn crescent from the last session, because that change
  was made deliberately and end-feed's `timer_off` already tells the two apart.
- **`endOpenPeriod` is the button; `closeOpenSleep` is the save path.** One
  closes whatever a person says is over, the other only ever a sleep.

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

### 2026-09-05 (latest) — an end time that means now

Tapping *end time — optional* stamped `start + 30 min`, which is a guess dressed
as a default: every period then had to be corrected, and a 30-minute sleep or
feed that was never checked is indistinguishable from a real one. It defaults to
the clock now, and the end row gained a `now` pill of its own so a period that
has run on closes in one tap, the same gesture the start row already offers.

`endNow` lives in `time.ts` with the rest of the arithmetic, and it is anchored
to the **start's day** for the same reason `withHourMinute` is: ending a moment
logged three days ago means that day's clock, not this instant. Landing before
the start reads as a period across midnight — 23:00 to 07:00 is the case that
matters — except when the start is itself in the future, where it clamps rather
than inventing a 23-hour period. Four checks in `verify-s5` cover those.

The end pill carries `aria-label="end now"` so it does not collide with the start
row's `now` under Playwright's strict mode — the same trap two visible "end
sleep" controls sprang last session.

### 2026-09-05 (earlier) — the watch list, measured against the real log

D-032 now records what the insights watch list actually does when the ten
transcribed paper-log days are behind it: **six flags across seven days, five of
them the same rule.** The log records 3–5 wet nappies most days against a
threshold of 6, so on real data the card is close to permanently lit. The sixth,
a 10h feed gap on 8/30, was an artifact of the two unreadable rows commented out
of the backfill — a rule firing on a hole in the *record* looks identical to one
firing on a hole in the *feeding*. Nothing was changed; the thresholds are the
owner's.

**The process lesson is the one to keep.** The insights screen shipped correctly,
and then the summary suggested loading real data into a scratch project as
something for the owner to run. That produced a throwaway script, three rounds of
explaining a file that changed nothing, and no code. His words: *"as human, it is
hard for me to keep watching each single that you try to do or suggest to do."*
**Finish the ask, state what changed, stop.** Incomplete verification gets closed
silently or named in one sentence — it does not become a task for him. The right
fix here was a realistic fixture in `verify-insights` from the start, which would
have caught the misfiring thresholds in the gate instead of in a screenshot.

### 2026-09-05 (earliest) — feeds run live, and a column that should never have been

§11 and §12, the last two items in the third handoff's `CHANGES.md`. The build
reads like sleep because it *is* sleep: `ongoingFeed` differs from `ongoingSleep`
by one event type. An end-feed pill in the bar, a `feedline` on the card, a
`feeding` mascot state ahead of `sleeping`, `fed 25 min` on the row and in the
day table, and milk spelt out in words everywhere it is printed.

**The session's real content was a wrong turn.** The prototype keeps a
`feeding: true` flag on the entry, and I followed it — an `event.in_progress`
column, a migration, a toggle in the milk block, and a long argument in D-033 for
why the flag was unavoidable. It was avoidable. The owner's answer was one line:
the timeslot already has the end time, so handle it the same as sleep. He was
right, and the argument I had built was for a problem the model does not have.
All of it is rolled back; the schema is untouched at `0001`.

Two things worth carrying forward, both now written down where they will be
found:

- **The prototype is authority on interaction, not on the data model.** It is a
  design artefact and its storage shape is incidental. Where the two disagree the
  model wins — the first paragraph of D-033 says so, because this is the second
  time a handoff detail has been followed further than it earned.
- **Migration numbers are spent even when the file is deleted.**
  `0002_seed_household.sql` was run on 2026-09-03 and dropped from the repo the
  same day, so `ls` shows the slot free and it is not. Numbering a new migration
  `0002` made "have you run 0002?" unanswerable and cost several rounds to
  untangle. `supabase/README.md` records it; number from
  `git log --all --diff-filter=AD -- supabase/migrations/`.

**The rollback then surfaced something the flag had been hiding.** `verify-hero`
started failing: it logs two feeds in a row, and the second had nowhere to go,
because the first was open and the bar had turned the bottle into the end-feed
pill. I removed the swap; the owner put it back, which is right — the pill is the
app asking you to close the feed, and `+` still reaches every type. `verify-hero`
logs a diaper for its second entry now, which is all that test ever needed.

The asymmetry that does survive is the auto-close. A running sleep is closed by the next
entry, because at 4am you log the feed and not the waking. A running feed is not,
because the next diaper says nothing about when the bottle finished, and an
invented duration is unrecoverable under D-003.
