# Design brief — structural design & prototype

Self-contained. Paste into Claude Design as-is; it assumes no other context.

---

## What you are designing

A phone web app — a PWA installed to an iPhone home screen — that replaces a
paper newborn log kept at the bedside. Two parents share it. Both do night
shifts, both feed, both change diapers. Neither is a proxy for the other.

It is used **one-handed, in the dark, often at 3am, by someone exhausted.**

## The competitor is a pen

The user is currently succeeding with a pen and lined paper. Paper never
crashes, needs no login, works one-handed in the dark, and accepts any mark — a
strikethrough, a question mark, a value squeezed into a margin, a note nobody
planned a column for.

Judge every choice against that. An app that is slower or narrower than the
paper loses, and the pen comes back to the bedside.

**Hard rule: every mark on the paper page must have a home in the app.** If any
mark does not, both systems stay in use, and the app has failed regardless of
how good the parts it does cover are.

## The paper log, exactly as it is

Four hand-ruled columns, roughly eight rows a day:

```
Date | Time | Milk | Pee/Poop
```

A legend at the top of the last column defines `1` = pee, `2` = poop.

- **Date** is written once on the day's first row and inherited by the rows
  below. A blank line separates days.
- **Time** is 24-hour, `HH:MM`.
- **Milk** is millilitres. Range 5–60, typically 30–60.

### Notation actually in use

Every one of these appears in seven days of the real log. None is an edge case.

| Written | Meaning |
| --- | --- |
| `60` | A feed of 60 mL |
| `25(B) + 45(F)` | One feed, part breast milk, part formula, separate volumes |
| `30 + 30` | Two portions in one feed, source not given |
| `?` | A feed happened; the volume is not known |
| `04:?` | The time is not known. Happens about once a day, mostly overnight |
| `1` | A pee |
| `2` | A poop |
| `2 (G→Y liquid)` | A poop with colour and consistency. `G` green, `Y` yellow |
| `2 (Dark)`, `2 (olive)`, `2 (small Y)` | More of the same, free-form |

Also present, and load-bearing:

- **Volumes are not round.** Real values include `31`, `41`, `43`, `46`, `57`. A
  preset picker of 30/45/60, or a stepper in fives, cannot express the data.
  Arbitrary entry must be the primary path, not a "custom" option behind presets.
- **Blank and `?` are different facts.** An empty Milk cell means no feed
  happened at that moment — the row exists for the diaper. A `?` means a feed
  happened and the volume is unknown. Same in the diaper column. They must never
  render the same.
- **Corrections strike a value, not a row.** The milk figure is struck and
  rewritten while the time and diaper entry on that row stand. The user corrects
  the field that was wrong and expects the rest to survive.
- **Entries go in out of order.** One day reads `12:40`, then `4:10`, then
  `07:00` — something logged hours late and inserted after later rows.
- **A row is a moment, not an event.** Some rows carry milk only, some diaper
  only, some both. The app must not force one event type per interaction.

Sleep is not tracked at all. Nothing else is tracked — no weight, temperature,
medication, or mood. All feeds are by bottle, so there is no side and no
duration to capture.

## The data shape behind it

Every entry carries: when it happened, a precision marker (**exact /
approximate / unknown**), and an optional **free-text note**. The note is on
every type without exception — it is the escape hatch that makes the app as
accepting as paper.

**Feed** — up to two components, each a volume plus an optional source
(breast milk / formula / unknown). Volume may be empty.

**Diaper** — pee yes/no, poop yes/no, both may be true at once; poop colour
(yellow / green / brown / dark / other) and consistency (liquid / soft / seedy /
firm / other).

**Secondary types exist but are not featured**: sleep, weight, temperature,
supplement, spit-up. They must be reachable, but a dropdown of ten types at 3am
costs a tap, a scroll, a read and a selection — and the pen wins. Feed and
diaper are the only two with evidence of constant use.

## What the app adds that paper cannot

Only two things. Everything else paper already does well.

1. **Remote visibility** — one parent seeing what the other recorded, without
   holding the page.
2. **Arithmetic** — time since last feed, volume today by source, diaper counts,
   time since last poop. All currently done in the head, at night, by scanning
   rows.

## What to produce

A **clickable prototype**, covering:

- A **night surface** and a **day surface**. Both, not one.
- A palette that has been checked **dimmed**, not only at full brightness.
- Enough interaction that the layout can be judged by tapping it.

## Four decisions this has to settle

These are deliberately open. Do **not** pick one answer and present it — build
the alternatives so they can be compared by tapping. That is the whole point of
the prototype.

**1. What is on the primary logging surface?** Which controls are large and
permanent, and what sits behind a secondary affordance. Every event type must
stay reachable. It must be operable one-handed, in the dark, without reading
carefully.

**2. What does the screen lead with?** Candidates worth building:

- Time since last feed (the number both parents currently compute in their heads)
- Last feed volume and source
- A combined line — "3h 40m ago · 60 mL (F)"
- A mascot state instead of a number

**3. Does entry need a "row" concept?** The paper's unit is a moment: one line
often carries both a feed and a diaper. Storage keeps them as two events, but
the entry flow may want a single "log what just happened" that creates both at
once. Show both flows.

**4. How faithful should the day view be to the paper page?** Reading back
matters as much as writing. The paper page is genuinely good at this — four
columns, date inherited down the rows, days separated by a blank line, about
eight rows. The acceptance test is entering seven real days and comparing
against a photograph of the page, so the read-back view has to support that
comparison. Blank and `?` must stay visually distinct here.

## Tone — this one matters

Used by parents of a newborn, often at 4am, often exhausted.

- If there is a mascot, its states must be **descriptive, never evaluative**.
  Sleepy, awake, hungry. **Never** sad, worried, disappointed, or scolding. An
  app that appears to disapprove of a late feed lands very differently than
  intended. Postpartum anxiety is real.
- **No health advice, no normal-range judgements**, nothing implying a reading
  is concerning. The app records; it does not assess.
- No growth percentiles, no "is this normal". Out of scope on purpose.

## Constraints

- iPhone, portrait, one thumb. Assume the other arm is holding a baby.
- Dark room. The screen is the only light source and should not be a torch.
- Cold start to logged entry should beat writing a row by hand.
- Works fully offline; nothing waits on a network.
- No login, no account. Shared household, joined by QR code.

## What to hand back

- The clickable prototype
- Screenshots of the night and day surfaces
- Which option you would pick for each of the four decisions, and why — as a
  recommendation to be tested by tapping, not as a settled answer
