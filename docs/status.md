# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-04

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

**Uncommitted: the end time on the home list, plus a shell hardening — and one
thing that needs checking on the phone.**

*End time.* The home list had its own `time()` formatter that only ever read
`occurred_at`, so a period logged there showed as a single time until you opened
the day view. It uses `timeCell` now, the same function the day table uses, and
`hhmm` is exported so the status-row clock shares one formatter too — the local
one had drifted. `scripts/verify-period-row.mts` logs a period and asserts both
screens print `HH:MM–HH:MM` **and agree with each other**; the same shape of bug
as the swipe, where the two lists quietly diverged.

*Shell hardening.* The flex-column change made `.log` and `.day` scrollers by
hand, which left `.welcome`, the spike page and `/touch` as plain `main`
elements inside an `overflow: hidden` shell — anything taller than the viewport
would have been clipped with no way to reach it. The rule is now on
`#root > main`, with `-webkit-overflow-scrolling: touch` and
`overscroll-behavior-y: contain`. `.welcome` lost its `min-height: 100dvh`,
which had been forcing it taller than its own scroll box.

**Needs a check on the real phone: does the list scroll?** The shell change moved
the scroll container from the document to `main`. Chromium scrolls it correctly —
`verify-swipe` asserts both screens scroll and by how much — but repeated
attempts to confirm it in the Simulator failed, first because injected touch may
not drive a nested scroller and then because the Simulator stopped exposing a
window to System Events at all. **This is unconfirmed on iOS, and a list that
cannot scroll would hide every older entry.** If it does not scroll, the shell is
the cause and the fix is not another guess — it is to give the tab bar its own
non-scrolling row and let the document scroll behind it.

197 checks pass.

## Open threads

Noticed, not blocking, no owner yet.

- **Unresolved marks on the paper log.** Several `1`s in the Pee/Poop column
  appear underlined, and one 9/1 milk cell may be a ditto mark rather than a
  number. Both may just be handwriting crossing the ruled line. Deliberately not
  recorded in the baseline as fact. Needs human eyes on the original page — the
  coverage rule is *every mark has a home*, so if an underline means something,
  the model is missing a dimension.
- **No Spec Kit scaffold.** `.specify/memory/` follows the convention but there
  is no `constitution.md`, no scripts, no templates. The non-negotiables in
  `CLAUDE.md` are effectively the constitution. If Phase 5 intends to run real
  Spec Kit commands, the scaffold has to exist first.

## Session log

Newest first. **Three entries maximum** — delete the oldest when adding a
fourth. This is orientation, not history. `git log` is the history.

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

### 2026-09-03 — Phase 2 landed, Phase 4 re-scoped

Claude Design's handoff arrived and is final (D-021), closing Q-001, Q-002,
Q-007 and Q-009. Its unknown-minute marker was struck as a D-018 conflict, and
`.specify/memory/design/phase-2-reconciliation.md` lists where its data shapes
diverge from the model — remapping work for Phase 6, not design problems.

Column types finalised: three tables with full DDL in `event-model.md`.

Phase 4 was then re-scoped on the owner's point that the plan was written with
less information than we now have, and following it unexamined wastes time.
Pairing (D-022), duplicate detection (D-023) and export (D-024) are out of MVP,
each with a named trigger. The offline strategy turned out not to be blocked on
Q-004 after all. Phase 5 shrank to slicing, since the spec artifacts already
exist.
