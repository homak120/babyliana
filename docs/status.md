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
delivered by the second design handoff. 187 checks pass across twelve suites.

What exists: local-first writes to IndexedDB that never block on the network,
push-then-reconcile sync with Supabase, the home screen (mascot artwork by
derived state, elapsed hero, totals, recent list), the day table with a date
strip and period picker, the add/edit sheet with milk, diaper, other and notes,
swipe-to-edit-and-delete on both lists behind a confirm sheet, name entry, theme
by clock, and an offline-capable PWA at 874 KiB precached.

**What is left is mostly not code.** Three build items remain, and the rest is
the owner's judgement — see *Next action*.

## Next action

**1. The coverage run. This is the gate and it is the owner's.** Enter all seven
photographed days from `.specify/memory/paper-log/` into the app on the phone,
against the checklist in `coverage-requirement.md`. Not in a script — the point
is thumbs, at speed, in the dark. If something cannot be entered, that finding
outranks any further polish. It is the single biggest open item in the project.

**2. Two build items, both small, both `CC`:**

- **JSON export** — `technical-constraints.md` requires it before a second
  person sees the app, so it is a Phase 9 gate rather than a first-use one.
  Getting a file off an installed iOS PWA is the hard part, not the format.
- **A settings screen** — the design has never had one, and export needs
  somewhere to live.

**3. Three owner decisions, none blocking:** Q-003 (mascot identity and the
rights caution), Q-008 (the final name, which gets dearer with every asset
carrying it), Q-006 (which secondary types earned promotion — answered by the
solo run, not by thinking).

**4. Q-004 runs itself.** Whether Safari evicts IndexedDB on a backgrounded
phone. The clock is running; nobody needs to do anything.

## How to work on this

Read `CLAUDE.md` first, then this file. Beyond that:

- **`npm run verify`** is the gate: typecheck, nine data-layer suites, then three
  browser suites (`verify-swipe`, `verify-period`, `verify-hero`) that serve
  their own build. Two suites hit the **live** database and delete only ids they
  created in that run — never widen one to a filter.
- **`scripts/ios/`** drives the iOS Simulator with real touch, and
  `measure-screenshot.mts` measures a screenshot the owner sends. Both exist
  because this project has repeatedly shipped fixes that passed on desktop and
  did nothing on a phone. Read `scripts/ios/README.md` before using them.
- **When a design detail and the handoff prose disagree, the prototype wins.**
  The README said the elapsed hero was 64px and the mascot 108px; the prototype
  draws 44px in a 100×96 slot. Following the prose broke the layout twice.

## In flight

**Uncommitted: the third design handoff, and sleep as a first-class type (D-029).**

The handoff is copied in and carries its own `CHANGES.md`, which is the best
summary of what moved. `tokens.css` is byte-identical for the third delivery
running.

Built: sleep has its own bubble, block and quick icon; the bar is contextual
(quick-add row plus report icon on home, a back pill on the day screen); an open
sleep drives the mascot; the row reads "sleeping…" then "slept 1h 20m"; and
logging anything else closes the sleep automatically.

**The rule that matters is "the latest timeslot only".** Scanning all open sleeps
made every pre-feature sleep read as still running — the bar showed a live
"30h 58m" against the real log before that was corrected.

Two bugs worth remembering, both caught on the device rather than in a test:

- `.tabs button` beat the new bar classes on specificity, so the end-sleep pill
  rendered as a 56px grid cell with its icon stacked over its duration and no
  background. The suite now asserts the *resolved* layout, not presence.
- App's clock ticks every 30s, and a sleep logged just now failed its own
  "started at or before now" test until the next tick. The filter uses the
  render-time clock; only the displayed duration uses the ticking one.

`scripts/verify-sleep.mts` drives the whole lifecycle in a browser, and
`verify-s7` unit-tests the derivation. **233 checks.**

Not taken from this delivery: the day/night mascot variants, the bespoke
end-sleep SVG, and `liana-appicon.png` — see D-029.

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
  `other`. Worth a baseline pass, since the baseline is the authority and is now
  narrower than its own source.
- **No Spec Kit scaffold.** `.specify/memory/` follows the convention but there
  is no `constitution.md`, no scripts, no templates. The non-negotiables in
  `CLAUDE.md` are effectively the constitution. If Phase 5 intends to run real
  Spec Kit commands, the scaffold has to exist first.

## Session log

Newest first. **Three entries maximum** — delete the oldest when adding a
fourth. This is orientation, not history. `git log` is the history.

### 2026-09-05 — the paper log transcribed, and a backfill script that is not the gate

Both notebook photographs read at full resolution and transcribed: 8/26–9/4, 75
moments, 71 feeds, 3523 mL, 39 pee, 23 poop, one `other`. Three of those days
postdate the baseline. Output is `supabase/imports/2026-09-05_paper-log-backfill.sql`
— staging tables shaped to be diffed against the photographs line by line, then
mechanical inserts.

**The script is deliberately not a substitute for the coverage run**, and says so
in its own header. It proves the schema can hold the data. The gate asks whether
the *app* can capture it at 4am with thumbs, which no script can answer.

Every awkward case in `coverage-requirement.md` appears in the real data and
survived the round trip: split feeds with and without sources, a `5(B)`, volumes
of 31/41/43/46/57, an unknown volume, a pee-only and a poop-only row, `1+2` on
one change, `2×2`, and `Nasal`. Strikethroughs are dropped entirely under D-003
rather than imported as anything.

Four readings are genuinely uncertain and were left as holes, not guesses — see
*Open threads*. The two 8/30 rows sit commented out at the end of the script with
both candidate times, because the cleanup rule that was applied (unclear minutes
round to the hour) cannot help when the *hour* is the unreadable part.

### 2026-09-04 — second handoff, mascot artwork, and four layout fixes

The second design handoff replaced the first wholesale. `tokens.css` is
byte-identical, so nothing about colour, type, radius or motion moved; four
things changed and `phase-2-reconciliation.md` lists them. The mascot is supplied
artwork now, one PNG per state, which is what made retiring the CSS composition
possible — a single flat image would have collapsed five states into one
expression.

**Q-012 closed against D-025's original reasoning.** Delete now opens a confirm
sheet naming the row rather than deleting with an undo toast. The 4am-modal
argument lost to D-003: a hard delete with no tombstone that syncs to the other
phone deserves its check before the action, not after.

**Four layout problems, and the pattern connecting them is worth keeping.** Every
one came from believing a document or a desktop browser over the phone:

- The swipe was dead on the home screen for four rounds of fixes because D-025
  said "the day view" and nobody checked which screen the owner was on.
- The tab bar sat 47.7pt higher on the day screen — exactly the device's
  `safe-area-inset-top`. Never reproduced in Chromium, insets substituted or not.
  Fixed by adopting the prototype's flex-column shell, which has no fixed bar at
  all, so the mechanism stayed unknown and stopped mattering.
- The elapsed hero wrapped because the README says 64px where the prototype draws
  44, and says 108px for a mascot the prototype puts in a 100×96 slot.
- The unknown-minute marker came back in the handoff for the second time and was
  struck again under D-018.

`scripts/ios/` came out of this: a Swift tool that posts mouse events to the
Simulator, which iOS turns into genuine touches, and a screenshot measurer.
"103.7pt against an expected 56" is what turned a vague complaint into a bug;
eyeballing had already produced one wrong answer.

### 2026-09-03 — Phase 6 built end to end; swipe fixed for real touch

S0 through S9 all landed. The app is usable: local write, sync, home, day,
edit, delete, undo, name entry, theme by clock.

The last bug is the one worth remembering. Swipe-to-reveal passed an end-to-end
test and did nothing on the owner's iPhone. The test drove it with a mouse,
which sends pointer events a phone never sends. The real cause was that React
attaches `touchmove` passively, so a handler there cannot call
`preventDefault` — and without that, iOS arbitrates the gesture as a scroll and
cancels the pointer before a horizontal swipe engages. Listeners are now native
with `{ passive: false }`. `scripts/shoot.mts` sets `hasTouch` from now on, so
this class of bug surfaces in a screenshot run instead of on the phone.

The broader lesson, which cost several rounds this phase: a passing test of the
wrong input proves nothing. Several CSS "fixes" were also verified by reading
the file rather than the rendered result, and one `.replace()` silently matched
nothing while I reported a match. Measure computed styles in the browser.

Three fixes went out before one worked, and only the second mattered — see
*In flight*. The rule that came out of it: a synthetic-event test cannot prove a
touch gesture, because arbitration is exactly what synthetic events skip. Use
`scripts/ios/` instead.

The first (d9c3bad) also went in without consent.
