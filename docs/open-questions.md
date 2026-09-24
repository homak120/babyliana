# Open questions

Deliberately unanswered. **Do not guess these.** Each is marked with what will
close it. Guessing an answer here and building on it is worse than the hole.

---

### Q-003 — Is the mascot the baby, or a separate creature?

This determines whether the app is a personal keepsake with a tracking function,
or a product with a personal skin. Both are legitimate. They are different apps.

**Closed by:** Phase 7, owner's decision.

**Note:** if the product path stays open, the art must be original in style.
Anything recognisably derived from an existing IP becomes a problem the moment
money is involved.

**2026-09-04.** The second design delivery ships supplied artwork for all four
states plus the welcome and the app icon, and says *"ensure the client holds the
rights to them"*. That answers the mechanical half of this question — there is
per-state art, so a flat image no longer costs the states — and leaves the half
that was always the owner's. The caution above stands unchanged and needs no
further flagging.

---

### Q-004 — Does Safari evict IndexedDB, and on what timeline?

Load-bearing. If local data can vanish, the local replica is not a disaster
recovery plan and the export becomes mandatory rather than prudent.

**Closed by:** Phase 3 spike — install it and leave it alone for a week.

---

### Q-006 — Which secondary event types get promoted?

Weight, temperature, supplements and spit-up exist in the registry. Some may
deserve the primary surface.

**Closed by:** Phase 8 solo run — observed use, not prediction (D-013).

**2026-09-05 — sleep left this list without waiting for the answer.** The third
design delivery promoted it, and D-029 accepted: its own bubble, its own block, a
quick icon in the bar. So one type was decided by design rather than by observed
use, which is exactly what this question was written to avoid. Recorded plainly
rather than tidied away — the paper log still contains zero sleep entries, and if
the solo run finds nobody reaches for it, that is a finding about the promotion.
The four types above are untouched by this and still close the way the question
says.

**2026-09-06 — three more were answered by decision, not by use.** D-036 gives
`weight`, `temperature` and `supplement` real inputs: kg into the schema's
grams, °C, and a what/how-much pair. That is the owner asking for them, not
observed use asking for them, and it is the second time this question has been
overtaken — recorded rather than tidied away, for the same reason as the sleep
note above. **`spit up` is the one still open**, and it still closes the way this
question says.

---

### Q-008 — Final name

"BabyLiana" is a working title. Keep it out of anything expensive to change.

**Closed by:** Phase 7.

---

### Q-014 — What should the daily rhythm actually show?

**Raised 2026-09-24 by the owner, from use:** the heatmap looks right and is not
useful. Nobody has said what they would do differently after reading it.

**Why it is not useful, measured rather than guessed.** Three things in how it
is built work against it:

1. **One cell, one kind.** Each hour shows a single thing, priority
   feed > poop > pee > sleep. Sleep is last, and sleep is the only one of the
   four that occupies hours rather than instants — so the longest block of the
   day is the one most often painted over. An hour with a feed in it and three
   hours of sleep through it reads as "feed".
2. **Hour buckets, not times.** A feed at 23:05 and one at 23:50 are the same
   cell. Two feeds 40 minutes apart look identical to one feed.
3. **No magnitude.** One feed in an hour and three feeds in an hour are the
   same colour.

**Candidates, cheapest first. Not decisions — the owner picks.**

- **A. Split the row into two lanes.** A sleep lane drawn as a continuous bar
  from real start to real end, and an event lane of tick marks for feeds and
  changes. This removes the priority rule that hides sleep, and it is the
  single change that fixes the biggest untruth in the chart.
- **B. Position by minute, not by hour.** Each mark at `minutes / 1440` across
  the row. Kills buckets 2 and 3 together: two close feeds become two marks.
- **C. Shade the night.** One band behind 19:00–07:00. The question being asked
  of this chart at 4am is a question about nights, and nothing on it currently
  says which hours those are.
- **D. An average-day row.** One extra row under the days: per hour, how often a
  feed falls in that hour across the span. This is the row that answers "what is
  his rhythm" — the per-day rows show what happened, not what usually happens.
- **E. A sentence under the grid.** "longest stretch without a feed: 4h 10m,
  from 23:40 on 9/22." A chart that illustrates a sentence is read; a chart that
  has to be decoded is admired.
- **F. Tap a row for that day**, the way the source chart works since D-062 —
  either its own breakdown, or straight to that day in the log.

A + B + C + D is a redraw of the card and is the recommendation. E is nearly
free and could go first on its own.

**Closed by:** the owner picking from the above, or saying the card should go.
**Constraint that survives whatever is picked:** descriptive, never evaluative
(CLAUDE.md), and no fifth watch-list rule (D-032).

---

### Q-015 — Which captured-but-unused data earns a place on the insights screen?

**Raised 2026-09-24 by the owner.** The app captures more than it reports.
**Measured, not guessed: the report reads none of `pounds`, `fahrenheit`,
`supplement_name`, `severity`, `poop_consistency` or `logged_by`.**

**One of these is a defect rather than a gap.** The growth card matches a digit
in a weight event's free-text **note** and never reads `pounds` — so a weight
typed into the weight field, which is what D-036 built, does not appear on the
growth card at all. It predates the column. Whatever else is picked, this is
worth fixing on its own.

**Candidates, best first by what they would answer.**

1. **Growth from `pounds`.** A real line over time, in `lb oz`, with the change
   since the first reading. **No percentiles and no population comparison** —
   CLAUDE.md, and that rule is not up for revisiting.
2. **The notes, gathered.** Every free-text note in the span, newest first. The
   note is the escape hatch that makes the app as accepting as paper — and it is
   currently write-only: once it scrolls past, nothing ever shows it again.
3. **Day and night, split.** Feeds, volume and sleep inside 19:00–07:00 against
   the rest. The single most-asked question about a newborn, and every field it
   needs is already stored. Overlaps Q-014 C.
4. **How long a feed takes.** `ended_at` has been on feeds since D-053 and
   nothing reports it. Average, longest, shortest.
5. **Temperature, plotted.** Every reading with its date. **Printed, never
   compared** — no thresholds, no colour for "high", not the word fever. The app
   records; it does not diagnose.
6. **Who logged what.** `logged_by` is on every timeslot and unused. A count per
   caregiver, or by hour band. Descriptive only — a figure that could read as a
   scoreboard between two tired parents is the one thing this must not become.
7. **Supplements, counted.** "vitamin D on 6 of 7 days" — a count, deliberately
   not an adherence figure, and not a streak that can be broken.
8. **Poop consistency beside colour.** The tally card already exists and the
   field is already recorded; this is one more set of rows in it.
9. **Spit-ups, counted.** Per day, by severity. A count and nothing more —
   anything relating them to feeds is a claim about digestion.

**Closed by:** the owner picking which of these get built, in what order.

---
