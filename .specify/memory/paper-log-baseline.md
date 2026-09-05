# Paper log baseline (Phase 0)

Source: photographs of the actual bedside log, 2026-08-26 through 2026-09-01,
held in `.specify/memory/paper-log/`. This is the primary requirements document.
It was written by the real user, during real night feeds, without knowing an app
was coming.

Where this document and any other document disagree, this one wins.

**Scope note, 2026-09-05.** The photographs in `.specify/memory/paper-log/` run
to **2026-09-04** — three days past what is written up below. Those days were
read and transcribed for the backfill script
(`supabase/imports/2026-09-05_paper-log-backfill.sql`) and carry at least one
thing this document never saw: `Nasal` written in the Pee/Poop column on 9/3,
which is neither a feed nor a diaper. Four marks across 8/30, 8/31 and 9/1 are
genuinely unreadable and were left as holes rather than guesses — `docs/status.md`
§ Open threads lists them.

**This document has deliberately not been widened from that transcription.** It
is the authority because the real user wrote it from the page; a transcription
promoted into it would quietly make the transcription the authority instead.
Extending it is a re-read of the photographs, and it is the owner's. Until then,
read the sections below as covering 8/26–9/1 and no further.

## Structure as written

Four columns, hand-ruled:

```
Date | Time | Milk | Pee/Poop
```

A legend at the top of the Pee/Poop column defines `1` = pee, `2` = poop.

- **Date** is written once, on the first row of the day, and inherited by the
  rows below it. Days are separated by a blank line.
- **Time** is 24-hour, `HH:MM`.
- **Milk** is a number in millilitres. Observed range 5–60, typically 30–60, and
  not rounded — see below.
- **Pee/Poop** is `1`, `2`, or `2` with a parenthetical annotation.

Roughly 8 rows per day.

## Notation actually used

### Milk source split

A single feed may be part expressed breast milk, part formula, with separate
volumes:

```
25(B) + 45(F)
60(F) + 15(B)
20(B) + 45(F)
30(B) + 30(F)
5(B)
```

`B` = breast milk. `F` = formula. Order varies; the larger component is not
consistently written first.

### Unlabelled split

```
30 + 30
```

Two portions in one feed with no source given.

### Volumes are not round

Observed values include `31`, `41`, `43`, `46`, `57`. The log records what the
bottle actually read, not a tidy figure.

A preset picker — `30` / `45` / `60` — or a stepper in fives cannot express
these. Arbitrary integer entry is the primary path, not a "custom" option behind
the presets.

### Poop annotations

Free-text colour and consistency, appended in parentheses:

```
2 (Dark)      2 (olive)     2 (yellow)
2 (G→Y liquid)    2 (G)     2 (small Y)     2 (Y)
```

`G` = green, `Y` = yellow. This tracks the meconium → transitional → yellow
progression of the first weeks. It is the annotation a paediatrician asks about
most in weeks 1–4.

### Unknown values

```
04:?    13:?    19:?    02:?     (time not known)
?                                 (volume not known)
```

Unknown times appear roughly once per day, mostly overnight.

> **The app does not reproduce `04:?` — see `docs/decisions.md` D-018.** The
> observation above stands as a record of the paper; the decision is that a
> button which stamps the current time removes the cause, so the app makes the
> time fast to set instead of making imprecision storable. The `?` for
> *volume* is unaffected and still has to be expressible.

### Blank is not unknown

An empty Milk cell and a `?` in the Milk cell are different facts:

- **Blank** — no feed happened at this moment. The row exists for the diaper.
- **`?`** — a feed happened; the volume was not known.

The same holds in the Pee/Poop column. Blank means no diaper, not a diaper
someone failed to record.

A careless renderer collapses both into one empty cell. The day view must keep
them apart, or the coverage test passes on entry and fails on read-back.

### Corrections

Struck-through marks appear on at least two days, and they generally operate on
**values, not rows**:

- 8/31, `07:00` — the milk value is struck and rewritten beside it. The time and
  the diaper entry on that row stand.
- 8/29, `22:30` — the strike lands on the time.
- 8/31, `4:10` — a struck fragment inside a two-component feed cell, and a
  struck value on the line below it.

The correction is scoped to the field that was wrong; the rest of the row
survives. Storage may supersede the whole event (see `event-model.md`), but the
*interaction* is field-level and has to behave that way.

### Out-of-order entry

On 8/31 the sequence written is `12:40`, then `4:10`, then `07:00`. An event was
logged retroactively and inserted after later rows.

## Behavioural findings

**A row is a moment, not an event.** Some rows carry milk only, some diaper
only, some both. The user logs when they are present and records whatever
happened. The app must not force one event type per interaction.

**Sleep is not tracked at all.** Zero sleep entries across seven days.

**Nothing else is tracked.** No weight, temperature, medication, supplements,
mood, or notes beyond the poop annotations.

**All feeds are by bottle.** There is a volume on every feed. No direct
breastfeeding is recorded, so there is no side and no duration to capture.

## What this implies for the build

These are derived from the log, not chosen:

1. Backdating is a core flow, not an edge case. `04:?` proves the pen was often
   picked up long after the event. The app answers this with entry speed — a
   default of now, quick offsets, a picker — and not with a `?`. See
   `docs/decisions.md` D-018.
2. Out-of-order insertion must work. It already happens on paper.
3. Editing and correcting entries must work. Strikethroughs already happen.
4. A feed carries up to two volumes with sources. One number is not enough.
5. Poop needs colour and consistency. It is already being recorded by hand.
6. Every entry needs a free-text escape hatch. Paper has one by nature; the app
   must supply one deliberately.
7. Sleep is a type to support, not a type to feature. See `docs/decisions.md`
   D-013 — the specific decision, not D-010, which this line cited for its first
   week. **Overtaken 2026-09-05 by D-029:** sleep is featured now, on its own
   bubble and block, by the design's choice rather than by anything on this page.
   The finding above is unchanged and still true — zero sleep entries in seven
   days — and the promotion is therefore an addition to the paper, not a reading
   of it.
8. Volume entry must accept any integer. Presets and steppers are an accelerator
   layered on top, never the only path.
9. Blank and unknown are distinct in both storage and display. "No feed" and "a
   feed of unknown volume" must not render the same.
10. Correction is a field-level interaction, whatever the storage does
    underneath.
