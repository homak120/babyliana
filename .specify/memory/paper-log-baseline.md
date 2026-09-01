# Paper log baseline (Phase 0)

Source: photographs of the actual bedside log, 2026-08-26 through 2026-09-01.
This is the primary requirements document. It was written by the real user,
during real night feeds, without knowing an app was coming.

Where this document and any other document disagree, this one wins.

## Structure as written

Four columns, hand-ruled:

```
Date | Time | Milk | Pee/Poop
```

A legend at the top of the Pee/Poop column defines `1` = pee, `2` = poop.

- **Date** is written once, on the first row of the day, and inherited by the
  rows below it. Days are separated by a blank line.
- **Time** is 24-hour, `HH:MM`.
- **Milk** is a number in millilitres. Observed range 5–60, typically 30–60.
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

### Corrections

Struck-through entries appear on at least two days.

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

1. Backdating is a core flow, not an edge case. `04:?` proves exact times are
   often unavailable at logging time.
2. Out-of-order insertion must work. It already happens on paper.
3. Editing and correcting entries must work. Strikethroughs already happen.
4. A feed carries up to two volumes with sources. One number is not enough.
5. Poop needs colour and consistency. It is already being recorded by hand.
6. Every entry needs a free-text escape hatch. Paper has one by nature; the app
   must supply one deliberately.
7. Sleep is a type to support, not a type to feature. See `decisions.md` D-010.
