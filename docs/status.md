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
delivered by the second design handoff. 510 checks pass across twenty-one suites.

**`0003_us_units.sql` is applied.** The first schema change since `0001`. The
owner ran it in the SQL Editor before the code that writes `pounds` and
`fahrenheit` was pushed, which is the order `supabase/README.md` requires —
sync pushes whole rows, so a client that knows a column the database does not
stops draining its outbox, quietly. `verify-s2` and `verify-s8` went red in
between and green after, which is them doing their job.

What exists: local-first writes to IndexedDB that never block on the network,
push-then-reconcile sync with Supabase, the home screen (mascot artwork by
derived state, elapsed hero, totals, recent list), the day table with a date
strip and period picker, the add/edit sheet with milk, diaper, **sleep**, other
and notes, swipe-to-edit-and-delete on the home list behind a confirm sheet, a
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
**The report has three more charts** — D-049. Diapers a day stacked wet/dirty,
milk by source with a hatched *not marked* band, and a poop-colour tally. Chosen
against what the database actually holds, and they describe rather than assess —
D-032's four rules are still four. **Four new series tokens**, validated rather
than eyeballed: the app's `*Ink` tones are chosen to be read as text on a fill
and fail as adjacent bar fills.

**The end's shortcuts are minutes back from now** — D-048. `5 / 10 / 15 min
ago` replace `+2 h`, `+3 h` and `+4 h`, which nothing ever used, and they are
bounded so they cannot land before the start. **The bubble grid holds two to a
row again** — `supplement` was five pixels too wide and took a line of its own,
leaving `temp` alone above it.

**The end time opens at the start, not a day out** — D-047. It prefilled 23h
59m long: the start carries seconds and every other time zeroes them, so the end
candidate was a few seconds *before* it and `resolveEnd` read that as crossing
midnight. Comparisons are minute-to-minute now, and the prefill is a copy of the
start rather than the clock.

**The date rows follow the date-fields handoff** — D-046. `calendar_today`, a
36px round step either side of a centred `today · 09/07`, and a hairline under
it; the end row moved below its own steppers as `event · ends on · 09/08` with
30px steps, capped to the start's day or the one after. **Its data model was not
taken** — `day` / `endDay` strings would be a weaker second source of truth for
what `occurred_at` and `ended_at` already hold.

**The bottle prompt moves and can be tapped** — D-045. `make a bottle` is light
blue now, its icon breathes to catch an eye that is not on the phone, and
tapping it turns the line into `making milk · 4m 10s` with the icon rocking
instead. Counts up, claims nothing about when the bottle is cool, stores nothing
in the database, and clears exactly when the prompt does — logging the feed is
the cancel.

**The end has its own date too** — D-044. Same row, same words, under the end
time. The app still works it out — `+1 h` on a 23:30 feed lands on the next day
— and touching the row pins it, after which changing the time keeps that day
rather than re-anchoring to the start. An end before its start is refused by the
save button, which says why. **The moment is still filed by its start date**, so
the day table needs no crossing marker.

**The add sheet has a date** — D-043. A `‹ today ›` row above the clock, with
hold-to-repeat, so any past day is reachable; the six-hour midnight rule still
fills it in but stops deciding once it is touched. Forward of today is refused.
**This unblocks the coverage run**, which could not be done through the UI at
all — backdating reached yesterday and no further.

**A second gate code hands a phone its identity back** — D-042. `01202012`
instead of the secret code skips the name page and lists the devices on the
server; picking one adopts that id rather than minting a new one, which is the
only thing that stops a reinstall creating a second parent with the same name.

**Times can read `9:09 PM`** — D-041. An icon beside the status row's clock
toggles the whole app between 24-hour and 12-hour: the status clock, the
target, the home list and the day table, because `hhmm` is the only formatter.
24-hour stays the default and the choice is per-phone, in localStorage, never
synced.

**"The last feed" is when it started** — D-040. `lastFeedAt` returns
`occurred_at` and no longer prefers `ended_at`, so the elapsed hero, the
mascot's thresholds and the target all count from the feed's beginning. Feeding
is counted start to start, and this is also what the insights screen has always
done. Only feeds with a duration move at all.

**Liana's clock depends on what the last feed was** — D-035. After breast milk
she reads *awake* at 90 minutes and *hungry* at 105; after formula, a mixed
feed, or a feed with no source, it is 120 and 150. The night override sits above
both, so this is a daylight distinction.

**The top card carries a target wake time and a bottle prompt, and three
secondary types take a value** — all D-036. The target is the last feed plus three hours, four when
that feed landed between 22:00 and 06:00; it is flat, deliberately *not* the
mascot's split, and hidden while a feed is running. **It is a ceiling, not an
appointment** — the mascot's *hungry* is the floor, and holding the ceiling
still is what makes the room between them vary by source. The line reads
**`by 15:00 · 1h 15m left`**, and `1h 10m past` once there is none. D-036,
sharpened 2026-09-06. `weight`, `temperature` and
`supplement` now have inputs behind `other` — kg typed into the schema's grams,
°F, and a what/how-much pair that **arrives filled in with `Vitamin D` /
`1 drop`** — and they read back on both the day table and the home list, the
weight as `7 lb 4 oz`. **`make a bottle`** goes up fifteen minutes before the target, on its
own row under the wake line, and clears when a feed is logged rather than when
the target passes. Display only: nothing to tap, nothing stored.

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

**The `make a bottle` prompt wears the drawn bottle, in lavender.** It was
`local_drink` — the paper cup with a straw — in `--roseDeep`, which is the
colour D-038 already moved the end-feed control off for reading as an alert. The
prompt is a suggestion with nothing wrong behind it, so it takes the same
lavender and the same `BottleIcon` the end-feed pill wears. `src/log/LogScreen.tsx`
and the `.prepline` rule in `src/log/log.css`. No test changed: `verify-hero`
asserts the prompt's count, text and geometry, not its glyph, and its five
prompt checks pass.

**Three charts on the report — D-049.** `mlBreast` / `mlFormula` /
`mlUnmarked` per day plus a `poopColours` tally in `src/report/insights.ts`,
three cards in `InsightsView.tsx`, stacked-bar and tally styles in
`insights.css`, and `--cWet` / `--cDirty` / `--cBreast` / `--cFormula` in
`tokens.css` for both themes. Twelve checks in `verify-insights`, six in
`verify-report`.

**The palette was computed.** Reusing the `*Ink` tokens the app already assigns
to these meanings looked obvious and fails the validator: mint against yellow is
ΔE 14.5 where the floor is 15 and reads grey at chroma 0.09, and `--muted` is
chroma 0.02 at 2.78:1. The four new tokens were snapped to passing steps and
checked separately per surface — **dark is its own selection, not a flip**,
because every light value sits outside the dark lightness band.

**Two things are load-bearing rather than decorative.** The wet/dirty pair
passes at CVD ΔE 7.9, the floor band, which is legal only with secondary
encoding — so the counting legend, the value on each bar and the 2px gap between
segments are what make that chart right for a protanopic reader. And the tally
bar is neutral because it was green beside a row labelled *yellow*, which
rendering it made obvious and no validator would have caught.

**The sheet's two rough edges — D-048.** `END_OFFSETS` is `[30,
60]`, a new `END_AGO_OFFSETS` is `[5, 10, 15]`, and `endAgo` in
`src/log/time.ts` bounds them at the start and at start + 1 day. `.bubble` gains
`min-width: 0` with tighter padding, and the label gets its own `.bubbletext`
class. Six checks in `verify-s5`, one in `verify-period-row`, three in
`verify-other`.

**Measured across six widths**: two bubbles to a row at 430, 393, 390, 375, 360
and 320, `other` last, no overflow anywhere, and `supplement` reading whole down
to 375.

**One thing worth remembering from it.** An early probe read
`querySelector('span')` inside a bubble and got the **Material Symbols span**,
not the label — so it reported the word as clipped when it was not, and the
ellipsis rule written from that reading was clipping the icon. It surfaced only
because a second check disagreed with the first. A check that reads the wrong
element reports the wrong thing confidently.

**The end-time prefill — D-047.** `resolveEnd` and `endNow` compare
minute to minute, a new `toMinute` in `src/log/time.ts` for comparing only, and
`+ end time — optional` copies the start instead of calling `endNow`. Six checks
in `verify-s5`, one in `verify-period-row`.

**The first fix was wrong and two suites caught it.** Truncating seconds at the
source — in `minutesAgo` and the sheet's initial `start` — cured the symptom and
took `verify-feed` and `verify-sleep` down with a crash. **Stored instants need
their seconds:** they order two moments logged in the same minute, and
`ongoingFeed` and `ongoingSleep` both ask which is latest. A feed and the diaper
logged twenty seconds after it became simultaneous, so a running feed stopped
being detectable. `toMinute` is for comparing, never for storing, and
`verify-s5` now pins that.

**The date rows redrawn to the handoff — D-046.** `dayWord` and a
new `dayDate` in `src/log/time.ts`, both rows restructured in
`src/log/TimeCard.tsx`, `.daterow` rewritten in `src/log/log.css`. Four checks
updated in `verify-s5`, two in `verify-period`, five in `verify-period-row`.
Geometry measured against the spec in a throwaway probe: 36x36 and 30x30 steps,
20px and 17px icons, a 1px hairline, the end row between its steppers and the
duration, no overflow.

**Two things in the handoff were deliberately not taken**, both recorded in
D-046. Its `day` / `endDay` string fields are storage shape, and this app has
carried real timestamps since D-020 — which is why the duration and
midnight-wrap behaviour it lists as work to do has always worked here. And its
clamp of the start date to the log's existing days would make the coverage run
impossible, since the photographed days are older than anything in the log.

**The bottle prompt's motion and count — D-045.** New
`src/log/PrepLine.tsx`, `--blueFill` / `--blueInk` in `src/tokens.css` for both
themes, `countUp` in `src/log/time.ts`, two keyframes and a reduced-motion guard
in `src/log/log.css`. Six checks in `verify-s5`, six in `verify-hero`.

**And a bug it uncovered: empty is not the same as unread.** `LogScreen` starts
with `moments = []` and fills it asynchronously, so the first render after every
remount has no moments — no target, `prepping` false — which is indistinguish-
able from *a feed has just been logged*. Everything else on the screen renders
the empty array happily for a frame; this line **acts** on it, and wiped a
running count on every save and every app open. A `loaded` flag now tells the
two apart. **The shape is worth remembering:** a component that acts on absent
data needs to know whether the data is absent or merely not here yet.

**The end's date — D-044, and a real bug under it.** The end date
row and `endPinned` in `src/log/TimeCard.tsx`, the `endsBeforeStart` gate in
`src/log/AddSheet.tsx`, `.daterow.end` styles, and five checks in
`verify-period-row`.

**`useHold` leaked an interval, and it was already shipped.** A chevron that
disables itself under the finger — the later-day one on reaching today (D-043),
the earlier-end-day one on reaching the start's day — has its handlers removed
by React mid-press, so `pointerup` never fires and the interval keeps
re-applying its stale step every 110ms. The symptom was that the end time could
not be changed at all once its date had been stepped back: every edit applied,
then reverted. The release is heard on the window now. **Found by logging a
stack trace in the parent's `onChange`** after four passes of reading the wrong
code.

**`verify-period` is green again — the calendar check now sums.** It asserted
one preset edge per month grid, which depends entirely on the date: picking a
preset opens the calendar on the month the range *starts* in, so on the 6th
"last 7 days" is 8/31–9/6 and the edges are a month apart, while on the 7th it
is 9/1–9/7 and both sit in September. It counts both grids and asserts **two
edges in total**, which is true on every date because a range has two ends.
Checked by pinning the clock to 9/7, 9/6 and 9/2 in a throwaway probe: `2+0`,
`1+1`, `1+1`. **All twenty-one suites pass.**

**One test of my own was that fault too.** `verify-period-row`'s 12-hour column
check compared the wrapped height against the 24-hour one — five characters
against up to eight, so `11:02 AM–11:32 AM` takes three lines in the morning
where `6:23 PM–6:53 PM` takes two. It now asserts the cell wraps inside its own
width without overflowing, which is the thing that actually matters.

**The date field — D-043.** `atHourMinute`, `onDay`, `daysBack`
and `dayWord` in `src/log/time.ts`; the date row and a `DayStep` chevron in
`src/log/TimeCard.tsx`, with a `pinned` flag that switches the hour steppers off
the inference once the date is set by hand; `.daterow` styles. Seven checks in
`verify-s5`, four in `verify-period`.

**`verify-period` is green again, and not by tuning its guard.** The suite made
its second day by setting the hour to 23 and hoping the midnight rule read it as
yesterday, which only works before ~17:00 — hence the `getHours() < 21` guard
that was the wrong number. It steps the date row now and the guard is deleted.
**All twenty-one suites pass**, at 19:00, which the old approach could not do.

**The recovery gate — D-042.** `01202012` at the gate opens a
third welcome page listing the server's devices; tapping one writes that exact
id to localStorage and opens the app as it. `adoptDeviceId` in
`src/device-id.ts`, `fetchDevices` in `src/sync.ts` (a direct read, not
`pull()`, which would `replaceAll` and wipe the local database), the third
stage in `src/log/Welcome.tsx`, styles in `src/log/log.css`, and eight checks in
`verify-welcome` — the happy path with the device table stubbed by a fulfilled
route, since the browser suites touch no database.

**Two things to know about it.** Picking is straight through with no confirm,
which the owner chose with the shared-id consequence stated. And a failed fetch
takes **about seven seconds** to surface — 6.8s measured in the suite, which
waits for it rather than sleeping — because the client does not give up when the
request does. Until then the page says *looking for your phones*. The lever, if
it is ever wanted, is a timeout around `fetchDevices`.

**The clock-format toggle — D-041.** A new `src/timeformat.ts`
holds the preference (localStorage, cached, and guarded so the Node suites that
import `cells.ts` do not fall over on a missing `localStorage`); `hhmm` and
`timeCell` take the format as a defaulted parameter; `LogScreen` holds it in
state too, so a save remounting the screen does not lose it. Ten checks in
`verify-s7` for the formatter, six in `verify-period-row` for the toggle and
both screens, one in `verify-hero` for the card.

**Both tight spots were measured, not assumed.** The day table's 62px time
column already wrapped `18:23–18:53` onto two lines and wraps the 12-hour one
onto the same two — 42px either way. The wake line at 12-hour ends **exactly**
on the card's inner edge, 337 against a 337 limit; it wraps rather than
truncates, so a longer case takes a second line instead of overflowing, but
there is no slack left on that line.

**The last feed is now its start time — D-040.** `lastFeedAt`
returns `occurred_at`; `lastFeedMoment` orders by the same field, so a top-up
logged inside a long breast feed reads as the later one. `src/derive.ts`,
`src/log/LogScreen.tsx` (`lastFeedEnd` renamed `lastFeedStart`), and
`verify-s3`, where the check that pinned the old rule now pins its reverse plus
a new overlap case. **The target stays hidden while a feed runs** — it no longer
has to be, since the ceiling is settled from the feed's first second, and the
owner kept it hidden as a choice. D-036's paragraph says so.

**`verify-period` is fixed as of 2026-09-06, by the date field rather than by a
better guard.** What follows is the diagnosis that led there; it is history now.

**Diagnosed before the fix:** All five are the D-037 day-swipe checks, cascading from `two days
to move between — 2 pills`. The suite makes its second day by editing an entry's
hour to `23`, expecting `withHourMinute` to read that as *last night* and file it
on yesterday. That only happens past `FUTURE_TOLERANCE_MS`, which is **six
hours** (`src/log/time.ts:40`) — so hour 23 backdates only when the clock reads
earlier than about 17:00. The suite's guard is `getHours() < 21`, which is the
wrong number: **run in the morning it passes, run in the evening five checks
fail.**

**The app is right and the tolerance is deliberate** — it stops a small forward
nudge from yanking an entry back a day. Proven not to be this session's doing by
building `f3bca01` in a worktree and getting the same five, and probed directly:
at 18:40 the edit saved as `23:40` today, which is exactly what a six-hour
tolerance is for. **Left alone because nobody asked** — the fix is the guard's
number, not the app.

**The target reads as a ceiling now, in words as well as in reasoning.** D-036's target section gains the floor-and-ceiling argument — why
*hungry* and the target wake time are the two ends of one range rather than two
answers to one question, and why the ceiling must stay flat. It exists because a
proposal to give the target the mascot's breast / formula split has now been
reached for twice, on the grounds that the card "contradicts itself" for 75
minutes after a breast feed. That 75 minutes is the window, and the entry says
so.

**The wording followed it.** `wake ~15:00 · in 1h 15m` is an appointment;
`by 15:00 · 1h 15m left` is a ceiling. `src/derive.ts` (`targetText`) and the
`.wakeline` span in `src/log/LogScreen.tsx`, plus two reworded checks in
`verify-s3`. Past the ceiling it says `1h 10m past` — not `over` or `late`,
which carry a verdict, and not `ago`, which described the clock time rather than
the room. `verify-hero` asserts geometry and not text, so it needed no change
and passes: the line renders `by 20:53 · 3h 00m left` on one row, ending 322px
against a 337px limit. The new wording is **shorter** than what it replaced.

**The sheet is one tile per thing** — D-038. Milk no longer repeats, because
the milk card already holds both parts of a split feed and has its own `+` for
the second. Weight, temperature and supplement came out of `other` and each has
a bubble and a tile, the way sleep did; what is left behind `other` is `spit up`
and `something else`, neither of which carries a value. The end-feed control is
a **drawn bottle** — Material Symbols has no baby bottle, so it joins
`EndSleepIcon` as the second hand-drawn glyph — in **lavender**, not the rose
that read as an alert.

**The day view swipes between days now, and not into a row** — D-037, amending
D-025. Editing and deleting are the home screen's alone; the read-back spends
the horizontal gesture on stepping to the day before or after. Left is older,
right is newer, only over days that have entries, and inert on `all days`, a
picked period and the insights mode. `usePageSwipe` shares `SwipeRow`'s gesture
rules — native listeners, a 10px axis decision, `touch-action: pan-y`.

**Two pages move with it.** The day being read and the day being dragged toward
sit side by side on a track that follows the thumb one-to-one — the first pass
slid only the outgoing page and played a separate slide-in after it, which read
as two movements rather than one. At either end of the log there is no page to
mount and the track barely gives. Getting there needed `.day` to stop being
shrink-to-fit (`#root` is a column flex container, and `margin: 0 auto` cancels
the stretch), a filter on the bubbling `transitionend`, and a timeout fallback
because `prefers-reduced-motion` removes the transition that lands the page.
D-037 has all three.

**`0005` is applied — checked 2026-09-06 against the live database**, where
`grams` and `celsius` both resolve and a made-up column name errors, so the
probe means something. Nothing further is needed, and the second phone drains on
its next foreground. What follows is why it existed; it is history now, not a
to-do. `0004` dropped `event.grams` and `event.celsius` ahead of the deploy
that stops naming them, on the assumption that both phones would update. The
second phone did not, and showed a **red sync dot on a working network** — the
app paints `offline` and `error` the same colour, so a failing upsert is
indistinguishable from a dead network at a glance. That phone is failing every
push and holding its writes in the outbox.

**It was the only repair that reaches a device nobody can touch:** the server starts accepting the
old build's rows again and that phone drains on its next foreground, unattended.
A deploy would fix only the phones that took it. Nothing is lost meanwhile — the
outbox is durable.

**The rule changed with it — D-039. The schema is additive-only now.** No
column is ever dropped or narrowed again, because "after every phone has
updated" is not an observable moment when the service worker updates lazily,
there is no forced update, and one of the phones belongs to the other parent.

**Weight and temperature are US units.** `0003` adds `event.pounds` and
`event.fahrenheit`, and **it is already applied** — confirmed against the live
database, where selecting the two columns returns rows and a made-up column name
errors. Nothing writes `grams` or `celsius` any more; the old columns stay so a
phone on older code keeps syncing through the rollout. D-036 carries the
reasoning, including why the column is `pounds` rather than the `ounces` first
named.

**There was never any weight or temperature data.** The database held 88 feeds,
78 diapers, 13 sleeps and one `other` when this landed. A `weight` chip on the
iOS Simulator's home screen was mistaken for a real row and reported as one; it
lived only in that simulator's IndexedDB and had never synced. Checked before
saying so is the rule that was skipped.

**Everything through the mascot's source split is pushed** (`e7ddf40`).

**D-036 is pushed, in two halves** — `020b3ce` and the commits after it.

1. **The secondary fields** — `src/log/drafts.ts` (`OtherDraft`'s four fields,
   `kgToGrams`, `gramsToKg`), `src/log/OtherBlock.tsx`, `src/log/log.css`,
   `src/day/cells.ts` (`otherLabel`, now shared), `src/log/LogScreen.tsx`'s
   recent list, twenty-four checks in `verify-s6`, six in `verify-s7`, and a
   **new browser suite, `verify-other`**, wired into `npm run verify`.
2. **The target wake time** — `src/derive.ts` (`targetWake`, `targetText`), the
   `.wakeline` on the card, its CSS, fourteen checks in `verify-s3` and six in
   `verify-hero`.

**Also pushed, and nobody asked for it:** a fix in `verify-period`.
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

### 2026-09-07 (latest) — three more charts, and a palette that was computed

**The report gains diapers a day, milk by source, and a poop-colour tally**
(D-049). The owner picked three from a longer list; *feeds by hour* was offered
and declined, as were cards for the four types with no data.

**Chosen against the live database rather than the schema.** 99 feeds, 89
diapers, 31 recorded colours — and zero weights, zero spit-ups, one supplement,
two temperatures. A chart with no rows is worse than no chart.

**They describe and do not assess.** D-032's four counted rules are still four.
The colour tally is the sharp case: a count, in frequency order, with nothing
said about any colour and a caption saying so.

**"Not marked" is a band, not a discard.** More than half the log's feeds carry
no source, so charting only the sourced ones would make the picture a claim
about the baby rather than about what was written down. Hatched rather than
hued, because an absence should not compete for identity, and the millilitres
are said outright in the caption.

**The palette was computed, and the obvious answer was wrong.** Reusing the
`*Ink` tokens the app already assigns to these meanings fails: mint against
yellow measures ΔE 14.5 against a floor of 15 and reads grey at chroma 0.09;
`--muted` is chroma 0.02 at 2.78:1. Four new tokens were snapped to passing
steps and validated per surface — **dark is its own selection, not a flip.**

**And two details are load-bearing.** The wet/dirty pair passes at CVD ΔE 7.9,
the floor band, legal only with secondary encoding — so the counting legend, the
value above each bar and the 2px gap between segments are what make it right for
a protanopic reader, not decoration. **The tally bar is neutral because
rendering it showed a green bar beside a row labelled *yellow*.** No validator
would have caught that; looking at it did.

### 2026-09-07 — two rough edges in the sheet

**The end's shortcuts are minutes back from now** (D-048). `+2 h`, `+3 h` and
`+4 h` are gone — nothing ever used them, since a feed is minutes and a sleep
gets its end from the bar — and `5 / 10 / 15 min ago` sit beside `now`,
`+30 min` and `+1 h`. That is the commonest correction there is: the feed
finished a few minutes ago and you are logging it now.

**They are bounded, or they would rebuild the bug just fixed.** On a start of
*now*, five minutes ago is behind it, and `resolveEnd` would read that as
crossing midnight — a 23h 55m entry, which is D-047 all over again. `endAgo`
clamps to the start, and caps at start + 1 day so a pill cannot reach a value
the date arrows refuse.

**And the bubbles pair up again.** `supplement` is five pixels wider than half a
row at 390, and a flex item cannot shrink below its own text unless told it may
— so it took a line of its own and left `temp` alone above it. `min-width: 0`
plus an ellipsis on the label means the word gives rather than the grid. It now
reads whole down to 375 and only shortens at 360 and below. Measured at six
widths.

**The lesson was in the measuring, not the fixing.** A probe read
`querySelector('span')` inside a bubble and got the Material Symbols span rather
than the label — so it reported the word clipped when it was not, and the CSS
written from that reading was clipping the *icon*. It surfaced only because a
second check disagreed with the first. **A check that reads the wrong element
reports the wrong thing confidently.**

### 2026-09-07 — the end time stops opening a day out

**Adding an end time prefilled a moment 23h 59m long** (D-047). The owner hit it
in use and read it correctly: it should open at the start.

**The fault was seconds.** `start` is `new Date()` and carries them; every
typed, stepped or offset time zeroes them. So on a moment logged now, the end
candidate `16:01:00` was seconds *before* a start of `16:01:37` — and
`resolveEnd`, whose whole job is *an end before its start crossed midnight*,
filed it tomorrow. `resolveEnd` and `endNow` compare minute to minute now.

**And the prefill itself changed**, which is the owner's call. It called
`endNow` — the clock time on the start's day — which D-036 chose over a guessed
half hour. For a moment logged as it happens those are the same instant; for a
backdated one they are not, and a feed entered at 08:00 for 04:10 opened its end
at 08:00. It opens as a copy of the start now, with `+30 min`, `+1 h` and `now`
one tap away. The `now` pill still means now, and reads sixteen hours on a
backdated start where that is the truth.

**The first fix was wrong, and the suites caught it.** Truncating seconds at the
source cured the symptom and crashed `verify-feed` and `verify-sleep`. **Stored
instants need their seconds** — they order two moments logged in the same
minute, and `ongoingFeed` and `ongoingSleep` both ask which is latest. A feed
and the diaper logged twenty seconds later became simultaneous, so a running
feed stopped being detectable. `toMinute` is for comparing, never for storing.
