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
delivered by the second design handoff. 332 checks pass across nineteen
suites.

What exists: local-first writes to IndexedDB that never block on the network,
push-then-reconcile sync with Supabase, the home screen (mascot artwork by
derived state, elapsed hero, totals, recent list), the day table with a date
strip and period picker, the add/edit sheet with milk, diaper, **sleep**, other
and notes, swipe-to-edit-and-delete on both lists behind a confirm sheet, a
photograph gate before the welcome, name entry, two mascot sets and a theme
switched by clock, and an offline-capable PWA at 24 entries / 1012.76 KiB
precached.

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
  (`verify-s1`…`s9` plus `insights`), a build, then **nine** browser suites
  against it — `swipe`, `period`, `hero`, `milk`, `period-row`, `overlay`,
  `sleep`, `welcome`, `report`. Nineteen in total. The browser nine serve their
  own build and touch no database, so they are the cheap ones to run on a UI
  change. Two of the data-layer suites hit the **live** database and delete only
  ids they created in that run — never widen one to a filter.
- **`scripts/ios/`** drives the iOS Simulator with real touch, and
  `measure-screenshot.mts` measures a screenshot the owner sends. Both exist
  because this project has repeatedly shipped fixes that passed on desktop and
  did nothing on a phone. Read `scripts/ios/README.md` before using them.
- **When a design detail and the handoff prose disagree, the prototype wins.**
  The README said the elapsed hero was 64px and the mascot 108px; the prototype
  draws 44px in a 100×96 slot. Following the prose broke the layout twice.

## In flight

**Nothing.** The tree is clean as of the insights commit.

One thing that outlives it: **read D-032 before touching the watch-list rules.**
The insights card that flags four thresholds contradicts what `CLAUDE.md` said
until 2026-09-05. It was raised as a conflict before anything was built and the
owner chose the handoff with the old rule in front of him. `CLAUDE.md` and
`docs/plan.md` Phase 7 both say so now, so it does not read as an oversight.

**The insights screen has only ever been seen with one day of empty-volume
data.** The bars, the projection and the watch list all want a real week behind
them. Running `supabase/imports/2026-09-05_paper-log-backfill.sql` into a scratch
project is the cheap way to look at it properly.

Worth knowing why this section was wrong twice in one day: it named the sleep
colours, the live-data hazard and D-031 long after `ad2ccce` shipped them,
because clearing it is a separate act from doing the work. **If you are finishing
a session, clear this before you commit, not after** — the commit that empties
the tree is the same commit that should empty this list.

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

### 2026-09-05 (later still) — the lead switcher, and a card that says how long she has slept

The last three items of the third handoff's `CHANGES.md` — §7 sleep in the log
views, §8 sleep duration on the top card, §9 the lead-view switcher.

**§7 was already there.** Sleep had its own row slot, its peri chip on the home
list and its peri line in the day table; only one thing was missing, and it was
in the confirm sheet rather than the list: `describeMoment` had no sleep branch,
so a sleep-only row asked "delete 9/3 · 21:35 · **empty**?". A hard delete with
no tombstone is the one place the app must not shrug. The handoff's timeline dot
does not apply — the app builds the prototype's *table* read-back, which has no
dots.

**§9 cost the card 40px, and that is the whole story of this change.** The rail
sits outside the card, so the text column went from 202px to 140px, and 44px
only holds six characters in that — "14h 21m" is seven and an overnight gap is
not an edge case. The mascot dropped to the handoff's 88px slot (100px art),
which gave 12px back, and anything over six characters now steps down to 36px.
The alternative was the wrap that `verify-hero` exists to catch.

Two more judgement calls worth knowing:

- **The lead lives in localStorage, not in state.** The handoff calls it session
  state, which is right in a prototype but wrong here: `App` remounts the screen
  with `key={saved}` on every save, so plain state snapped back to `elapsed` the
  moment you logged anything. It stays local and unsynced either way.
- **Both end-sleep controls now carry the hand-drawn crescent-and-arrow SVG**,
  not `wb_twilight`. The bar pill shipped with the Material icon in `ad2ccce`;
  having the card's button and the bar's disagree about what the same action
  looks like was worse than the small scope creep of changing it.

`aria-label="end sleep"` is now on two visible controls, which broke
`getByLabel` under Playwright's strict mode — `verify-sleep` scopes the bar one
to `nav.tabs` and exercises the card one on its own sleep. 264 checks across the
same seventeen suites.

### 2026-09-05 (later) — the tab bar's bottom gap, and a documentation sweep

The bar's bottom padding was `max(22px, env(safe-area-inset-bottom))` — 34pt on a
notched phone, on top of the inner margin that 40–56px rounded targets already
give their 20px icons. It discounts the inset by 16pt now, so 18pt on the phone.
**Invisible off-device**: the inset is 0 in every desktop browser, so before and
after render identically in the suites that would otherwise have caught it.
Committed as `5fca772` after the eight browser suites passed.

Then a sweep for stale prose, which found more than the tab bar did. Six
documents disagreed with the code:

- *In flight* still listed three items that shipped in `ad2ccce`, and Position
  claimed 187 checks across twelve suites against an actual 254 across seventeen,
  and 874 KiB precached against 1012.76.
- **Sleep's promotion (D-029) had not reached any document outside
  `decisions.md`.** D-013 said sleep was supported but not featured; the baseline
  drew the same implication and cited D-010 for it; Q-006 still listed sleep as a
  candidate for promotion; the README described an app that records feeds and
  diaper changes. Each now points at D-029, and Q-006 covers only the four types
  that are genuinely still open.
- The coverage run is **ten photographed days, not seven**, in three documents
  that all said seven.
- `supabase/README.md` documented `migrations/` and not `imports/`, so the
  backfill script existed with no entry in the file that tells you what to run.

The pattern worth keeping: **every one of these was a document that was correct
when written.** Nothing was wrong at the time. They went stale because a decision
landed in `decisions.md` and stopped there, which is the failure mode a document
set has instead of a bug.

### 2026-09-05 — the insights screen, and the rule it required changing

The third design handoff's report screen, built: a log/insights pill pair on the
report screen, a 3d/7d range, and six cards — milk intake with per-day bars and a
day-end projection, a days × 24h rhythm heatmap, wet and poop as half-cards,
sleep, and growth. All of it derived at render time; nothing new is stored.

**The part worth knowing about is not the code.** Card one asserts things about
the baby — under 6 wet diapers, over 24h without a poop, a 5h feed gap, today
tracking 20% under average — and `CLAUDE.md` forbade exactly that. The conflict
was put to the owner before anything was built, with the alternative of shipping
the descriptive cards only. He chose the handoff. **D-032 records that**, and
`CLAUDE.md` and `docs/plan.md` Phase 7 were both amended, because a rule
contradicted by shipped code and not by a document is a rule the next session
quietly re-litigates. The mascot rule did not move and she never sees a flag.

Two things the prototype gets wrong and this does not, both commented where they
diverge. Its "today" is the last day *with entries*, so a day with nothing logged
projects yesterday's total against today's elapsed hours; here `today` means
today and the pace card is absent otherwise. And its heatmap tests a sleep with
`h >= start && h <= end`, which drops a sleep crossing midnight from both days —
here the span is clamped per day, so a night's sleep colours the evening and the
morning.

`verify-insights` covers the arithmetic in 50 checks with no browser — the
thresholds, the 0.2 projection floor, the midnight sleep, "today is never
flagged". `verify-report` renders it, because two of the three bugs found while
building were layout: a screenshot taken after switching modes, and 44px of dead
space under every card title from UA margins `index.css` does not reset.
