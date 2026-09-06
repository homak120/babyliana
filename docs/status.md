# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-06

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0–6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. 452 checks pass across twenty-one suites.
**No schema change — `0001` is still the whole schema.**

What exists: local-first writes to IndexedDB that never block on the network,
push-then-reconcile sync with Supabase, the home screen (mascot artwork by
derived state, elapsed hero, totals, recent list), the day table with a date
strip and period picker, the add/edit sheet with milk, diaper, **sleep**, other
and notes, swipe-to-edit-and-delete on both lists behind a confirm sheet, a
photograph gate before the welcome, name entry, two mascot sets and a theme
switched by clock, and an offline-capable PWA at 24 entries / 1284.22 KiB
precached. **The app icon is the v2 art** as of 2026-09-06 — the whole
`public/` set replaced, full-bleed on white, no config change beyond comments.
The precache grew 271 KiB with it: the 512 is 435 KB where the old one was 243,
and it is in the bundle where the 1024 is already excluded for being large and
only needed at install.

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
end row carries its own `now` pill beside the `+30 min` offsets. **The bar's
bottle opens on 60 mL of formula**, already filled in — a suggestion the first
digit typed replaces, so it costs nothing to disagree with; `+ milk` inside the
sheet still starts blank, because a feed added by hand is as often the paper's
`?`. The report screen's date strip now stops at three day pills, so `more` — the
only route to an older day — is on screen rather than off the right-hand edge.
**Liana's clock depends on what the last feed was** — D-035. After breast milk
she reads *awake* at 90 minutes and *hungry* at 105; after formula, a mixed
feed, or a feed with no source, it is 120 and 150. The night override sits above
both, so this is a daylight distinction.

**The top card carries a target wake time, and three secondary types take a
value** — both D-036. The target is the last feed plus three hours, four when
that feed landed between 22:00 and 06:00; it is flat, deliberately *not* the
mascot's split, and hidden while a feed is running. `weight`, `temperature` and
`supplement` now have inputs behind `other` — kg typed into the schema's grams,
°C, and a what/how-much pair — and they read back on both the day table and the
home list.

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

**Everything through the mascot's source split is pushed** (`e7ddf40`).

**Uncommitted: D-036, in two halves.**

1. **The secondary fields** — `src/log/drafts.ts` (`OtherDraft`'s four fields,
   `kgToGrams`, `gramsToKg`), `src/log/OtherBlock.tsx`, `src/log/log.css`,
   `src/day/cells.ts` (`otherLabel`, now shared), `src/log/LogScreen.tsx`'s
   recent list, twenty-four checks in `verify-s6`, six in `verify-s7`, and a
   **new browser suite, `verify-other`**, wired into `npm run verify`.
2. **The target wake time** — `src/derive.ts` (`targetWake`, `targetText`), the
   `.wakeline` on the card, its CSS, fourteen checks in `verify-s3` and six in
   `verify-hero`.

**Also uncommitted, and nobody asked for it:** a fix in `verify-period`.
`preset fills the span` counted `.cal.between` in the opening month only, and on
the 6th "last 7 days" starts on the 31st — an edge with nothing between it and
the month's end. It went red on the date rolling over, on `HEAD`, before any of
this session's changes touched anything. It now counts across both visible
months.

**And one bug the Simulator found that the browser suite could not.** The kg
field rendered as two lines on iOS — `3.4` above, `kg` beneath — because
`.otherfield > span` outspecified `.fieldbox` and killed the flex row. The label
span and the field box are both direct span children. Renamed to
`.otherfield > .fieldname`; not `.fieldlabel`, which the welcome gate already
owns. **Chromium passes `verify-other` either way** — it gives the input a
narrower default and fits the unit beside it regardless — so the new "on one
row" check is a guard on the rule, not proof it holds on a phone. Confirmed by
putting the bug back and watching the suite stay green. Fourth time `scripts/ios/`
has caught what desktop could not.

Nothing else.

**The date strip's cap has no browser check**, and deliberately: proving it
needs entries on four separate days, and the only way to backdate through the UI
is the time card, which reaches yesterday at best. `QUICK_DAYS` is one constant
in `DayScreen`; the suites cover the strip's behaviour, not its length.

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

### 2026-09-06 (latest) — the numbers he had and the app did not

**Three secondary types take a value now** (D-036). `weight` is typed in kg and
stored in the schema's existing `grams` — 3.4 in, 3400 down — `temperature` is
one °C field, and `supplement` asks what and how much, both free text because
"1 drop" is a real answer and not a number. `spit up` and `something else` still
carry nothing; neither has a value to capture.

Blank still saves and still reads as the bare word, which is the milk volume's
`?` rule applied to a weighing nobody caught in time. Every field is a **string**
until save: a number input eats the point in "3." as fast as it is typed, which
passes every unit test and is unusable in the hand, so `verify-other` — a new
browser suite — types a decimal into a real one.

**The read-back was in two places and only one of them knew.** The home list had
its own inline copy printing the bare type name, so a weight read `weight` there
and `weight 3.4 kg` in the day table. Both go through `otherLabel` now. That is
the same split that once hid an end time from this list.

**The top card carries a target wake time**: last feed plus three hours, four
when the feed landed between 22:00 and 06:00. Flat, and deliberately *not* the
mascot's breast/formula split — the owner chose that with the split in front of
him, and the two answer different questions. The window is judged on the feed's
own clock time rather than on the target it produces, or a 21:00 feed's target
would depend on the target. Hidden while a feed runs, because it counts from
where a feed ends.

**Q-006 was overtaken again**, and it is noted there rather than tidied away:
three of its four remaining types got an input because the owner asked, not
because the solo run found anything. `spit up` is the one still open.

**Both themes draw the night mascot set** as of 2026-09-06 — the owner trying
one character across a whole day. `DAY_ART_IN_USE` in `src/log/Mascot.tsx` is
the flag, and it is `false`. **Nothing about the day set was removed**: `DAY` is
still built from its own eight files, they still import and still ship, and
flipping that one constant restores the old behaviour. `verify-welcome`'s three
art checks were inverted to assert the switch is off rather than that the day
art is gone, and they invert back with it.

**The app icon is the v2 art.** The whole `public/` set replaced from
`app_icon_babyliana/` — 180, 512 and 1024 as supplied, 192 and 32 resized from
them — full-bleed on white, no config change beyond comments. **An installed
PWA does not pick up a new icon on its own**: iOS snapshots the tile at add
time, so the home screen only changes after removing and re-adding it. Watched
that happen on the Simulator, where a webclip kept an icon two generations old
while Safari's own share sheet showed the new one correctly.

**Then the Simulator earned its keep again.** Run on the phone, the kg field was
two lines — `3.4` above, `kg` beneath. `.otherfield > span` was outspecifying
`.fieldbox` and killing the flex row, because the label span and the field box
are both direct span children. Chromium fitted both on one line anyway, so
`verify-other` was green through the whole thing; putting the bug back
afterwards confirmed the suite still passes with it in. The check added for it
is a guard on the rule, not evidence about a phone. **That distinction is the
lesson, and it is now the fourth instance of it.**

**One thing nobody asked for.** `verify-period`'s `preset fills the span` went
red on the date rolling to the 6th — on `HEAD`, before any change here. It
counted `.cal.between` in the opening month only, and "last 7 days" from the 6th
starts on the 31st, which leaves nothing between it and the month's end. It
counts across both visible months now. Flagged rather than folded in silently.

### 2026-09-05 — hungry is two clocks now, not one

`mascotState` moved the hungry threshold from 240 minutes to 180. Awake still
starts at 120, so the awake band is now 2–3h rather than 2–4h, and the night
override (night theme plus a gap over an hour reads as *sleeping*) is untouched,
so the change is only visible in daylight.

**The insights watch list's feed-gap flag followed, from 5h to 3h.** The two now
sit on one number: three hours since a feed is what the app calls long, whether
it is describing this moment on the home screen or counting a past day on the
report. D-032 carries a dated amendment, because the decision named 5h and the
count of rules — four, still four — is what that entry is guarding.

**The gap flag will fire much more often now.** The comparison is `>= 180`, so a
feed every three hours on the dot flags, and that is an ordinary newborn rhythm.
This is the same always-on-warning problem D-032's measured note already records
for the wet-diaper rule, now on a second rule. The owner set the number with the
mascot's use of it in view; the lever if it is ever tuned is the boundary itself,
since `> 180` would exempt the exact three-hour case.

Three checks guard the new boundaries: hungry at 180 and awake at 179 in
`verify-s3`, and a three-hour gap flagging in `verify-insights`, whose quiet
fixture moved to a 2h 30m rhythm because a 3h one is no longer quiet.

**Then the flat number split in two.** Breast milk empties faster than formula,
so the mascot now runs on the last feed's source: 90/120 after breast milk,
120/180 after everything else. D-035 has the table and the reasoning.

**"Everything else" is wide on purpose, and the case to know is the mixed
feed.** `25 mL breast + 45 mL formula` is one moment with two feed events, and it
takes the *slower* clock — only an all-breast moment gets the faster one.
Formula, a feed with no source, and a moment with no feed at all land there too,
so a log that never records a source behaves exactly as it did before. Erring
long means the app is late to say hungry rather than early.

`feedKind` is the whole rule and it reads the moment the card already had, so
nothing new is stored and nothing new is asked of the person logging.

**The insights gap flag did not follow the split** and is still a flat 3h. It
counts a past day's largest gap without asking what was in the bottle; giving it
a source would mean deciding what a mixed day is measured against, which nobody
has asked for.

### 2026-09-05 (earliest) — a filled-in quick feed, and a date strip that stops

Two things the owner hit in use, both about the cost of a default.

**The bar's bottle opens on 60 mL of formula.** It used to open blank, which is
right for `+ milk` — a feed entered by hand is as often the paper's `?` — and
wrong for the quick icon, whose whole point is the commonest feed at two taps.
The 60 is a *suggestion*: `MilkPart.preset` marks it, and the first digit typed
replaces it rather than appending, so a 45 mL feed cannot become 604. Without
that flag the prepopulation would have made every non-60 feed cost two
backspaces, which is worse than the blank it replaced.

**The date strip stops at three day pills.** It offered one per day with
entries, so a fortnight of use pushed `more` off the right-hand edge — and
`more` is the only route to a day older than the pills. Three is the most recent
day and the two before it.

Left undone on purpose: no browser check on the cap. Producing four distinct
days through the UI is not possible — the time card backdates to yesterday at
the furthest — and a check that cannot see the case it guards is worse than the
constant it would be watching.
