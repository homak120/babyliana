# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-03

---

## Position

**Phases 0–6 are done. The app is built and deployed, and all ten build slices
are ticked.** It logs feeds, diapers and the `other` types locally, syncs
between devices, shows the home and day screens, and supports edit, delete and
undo. `npm run verify` is 141 checks across nine suites and passes.

What is left before it can replace the pen is not code. It is the owner using
it, and the coverage run below.

Task-level state is in `tasks.md`. Phase-level completion is in `plan.md`. This
file is the summary and the next move.

## Next action

**The coverage run, and it is the owner's, not an agent's.** Enter all seven
photographed days from `.specify/memory/paper-log/` into the real app on the
phone. The checklist is `coverage-requirement.md`. It is the only test that
tells us whether the app can hold what the paper actually held — every split
feed, every `?` volume, every out-of-order insertion, every correction. If
something cannot be entered, that is the finding, and it is worth more than any
further polish.

Do not do this in a script. The point is the thumbs, at speed, in the dark.

**Phase 7 (mascot and tone) and Phase 8 onward have not started.** Do not begin
them before the coverage run reports back — it may move what they contain.

## In flight

**Uncommitted: swipe on the home screen, which is the actual bug.**

The owner reported swipe-to-reveal broken four times. Every fix went into the day
view. He was swiping the **home screen's recent list**, which never had the
gesture — D-025 said "a row in the day view" and S8 built exactly that. Three of
those four diagnoses were wrong, and all of them were about a component that was
not in play. The lesson is cheap and worth keeping: confirm *which screen* before
diagnosing anything.

- `src/swipe/SwipeRow.tsx` + `swipe.css` — the gesture, extracted from DayRow so
  one implementation serves both lists and they cannot drift apart again.
- `src/log/LogScreen.tsx` — home rows are now swipeable, with edit, delete and the
  same undo window as the day view.
- `src/day/DayRow.tsx` — reduced to cells; the note moved outside the wrapper so
  the actions back the row rather than the note too.
- `docs/decisions.md` — D-025 amended to cover both lists.
- `scripts/verify-swipe.mts` — runs the whole suite against **both** screens now,
  including an arcing swipe. 16 checks; the home half would have caught this on
  day one.
- `src/probe/TouchProbe.tsx` at `/touch` — a readout of what a real finger
  produces. Kept because this bug class cost four rounds; safe to delete.
- `scripts/ios/` — the Simulator harness and README.

**Verified with real OS-level touch on iOS 18.3 Safari:** the home row opens,
reveals edit and delete, and closes again.

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

### 2026-09-02 — D-018, time precision removed

The owner's call, and the reasoning is worth keeping: `04:?` is what you write
when a pen has no idea what time it is. A phone does, so the app removes the
cause rather than giving the user a way to express uncertainty. His test for the
notation was "if a human cannot read a mark and immediately know what it means,
it does not belong" — which is also why the marker was dropped outright rather
than softened to a `~`.

What was knowingly given up: a time typed from memory and a time tapped live are
now indistinguishable, forever, including in exports. Recorded in D-018 so it is
not later read as an oversight.

What replaces it is entry speed, written into the Phase 2 brief as a new
§ Entering and adjusting the time — default to now, quick offsets, picker,
numeric entry. Ranking is left to the prototype under D-007. Natural-language
time parsing is explicitly ruled out; it fails silently on a tired user.

The coverage test loosened from *every glyph reproduced* to *every fact
represented*, which is the one real cost and is stated in
`coverage-requirement.md` rather than left implicit.

`paper-log-baseline.md` § Unknown values was **not** rewritten — it records what
the paper actually says, and editing evidence to match a decision would destroy
the ability to re-derive later. It carries a pointer to D-018 instead.
