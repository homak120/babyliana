# Handoff: BabyLiana — baby log (iOS/Android phone app)

> **Amended after delivery, 2026-09-03.** The unknown-minute marker described in
> the original handoff has been struck from this document. D-018 in
> `docs/decisions.md` rules out any time-precision marker — no `exact` /
> `approximate` / `unknown`, no `?`, no `~` — because a phone knows the time and
> the paper log's `04:?` is a workaround for a pen that does not. The app answers
> that case with fast time *adjustment* instead, which this design already does
> well via the steppers and offset pills.
>
> The prototype HTML still carries dormant `minUnknown` scaffolding. It is
> unreachable — nothing sets it and no seeded row uses it — and has been left
> as delivered rather than edited. **Do not build it.**
>
> Other divergences between this handoff and the current data model are listed
> in `.specify/memory/design/phase-2-reconciliation.md`. They are remapping
> work for Phase 6, not design problems.

## Overview

BabyLiana replaces a paper feeding log kept by two parents. It records what a
baby did and when: milk (volume, breast/formula), diaper (pee, poop, colour,
consistency), and a small set of "other" events, each with an optional free
note. Entry has to survive being done one-handed at 3am, so the whole
add-flow is one sheet with big targets and no required fields beyond a time.

Two screens carry the product: **log** (mascot + time since last feed +
most-recent list) and **day** (the paper page, read back as a table). A
**welcome** screen runs once on first launch. Everything else is a sheet over
those.

The tone is soft and lowercase; the mascot (Liana) is the app's own character
and reports state descriptively — *settled · awake · hungry · sleeping* — plus a
one-off *logged* flash after a save. She never nags.

## About the design files

The files in `prototype/` are **design references written in HTML**. They show
intended look, copy and behaviour; they are not production code to port line by
line. The task is to **recreate these designs in the target codebase's own
environment** — React Native, SwiftUI, Flutter, Compose, whatever the app is —
using its established navigation, state and component patterns. If no codebase
exists yet, pick the framework that fits the product (a two-parent phone app
with local-first storage and sync) and implement the designs there.

`tokens.css` is the exception: the colour, type, radius and motion values in it
are the real specification and should be transcribed into the target's theming
system verbatim.

## Fidelity

**High-fidelity.** Colours, type sizes, radii, spacing, copy and interaction
behaviour are final and should be matched closely. The two themes (day/night)
are both final. Layout is specified at 390 × 844 (iPhone 14/15 logical size);
see *Responsive behaviour*.

---

## Screens / views

### 1. Welcome (first launch only)

**Purpose** — capture the logging user's own name and show this device's id so
the other parent can pair to the same baby. Nothing else is asked; the baby's
name is fixed ("Liana" in this design) and lives in settings.

**Layout** — full-bleed over the app, `--bg` ground with the `--sky` gradient
occupying the top 260px. Content column padded `64px 26px 26px`, flush left,
single flex column; the primary action is pinned to the bottom by a flexible
spacer.

Top to bottom:

| Element | Spec |
| --- | --- |
| Mascot | 76 × 74px, `lianaBreathe 7s ease-in-out infinite`, eyes blink on `lianaBlink 5.5s`. Margin-bottom 22px. |
| Kicker | "welcome" — 13px / 700, `letter-spacing: 0.14em`, uppercase, `--muted` |
| Headline | "what should we call you?" — 30px / 900, `line-height: 1.2`, breaks after "we", margins `6px 0 8px` |
| Sub | "your name marks every entry you log, so liana's other grown-ups know who did what." — 14px, `--muted`, margin-bottom 26px |
| Field label | "your name" — 11px, `--periInk`, margin-bottom 8px |
| Name input | height 60px, `2px solid --chip` border, radius 22px, `--card` fill, 22px / 700 text, padding `0 18px`, placeholder "mona" |
| Device id block | radius 18px, `--chip` fill, padding `12px 14px`, margin-top 14px. Row: `smartphone` icon 19px `--muted`; then label "DEVICE ID" (10px, `letter-spacing: 0.1em`, uppercase, `--muted`) over the id itself (15px / 700, tabular-nums, `letter-spacing: 0.06em`, `--ink`). Sample value `LNA-7QD4-8213`. |
| Helper | "share this id with the other grown-ups so all your phones log to the same baby." — 12px, `--muted`, margin-top 10px |
| Primary | `.btn-primary`, `arrow_forward` icon + "start logging". Disabled (opacity 0.45) until the trimmed name is non-empty. |

**Behaviour** — tapping *start logging* stores the name and dismisses the
screen permanently; the app lands on **log**. The device id is generated once
per install and displayed, not editable. Format in the design is
`LNA-XXXX-NNNN` (uppercase, tabular). A real implementation should show
whatever pairing id the sync backend issues, in the same shape, and provide a
copy affordance (the design does not yet have one — see *Open questions*).

### 2. Log (home)

**Purpose** — answer "when did she last eat, and how long ago" in one glance,
and get to the add-sheet in one tap.

**Layout** — status row (own clock + parent avatars + sync state), then the
hero block (mascot 100 × 96px beside the elapsed figure), then today's totals
as tags, then "most recent first" list, then the tab bar.

- Hero: the elapsed time since the last feed, `Xh MMm`, 64px / 900,
  tabular-nums, with the label above it in 11–12px `--muted`. The lead can be
  configured three ways (see *Variants*): elapsed only, elapsed + volume, or
  mascot-first.
- Mascot state tag: `stateFill` / `stateInk` pill with the state's icon —
  settled `spa` / mint, awake `visibility` / lavender, hungry `local_drink` /
  rose, sleeping `bedtime` / lavender, logged `auto_awesome` / amber.
- Totals row: rose "N feeds", lavender "N mL", yellow "N pee", mint "N poop",
  plus a `--chip` "unmarked N" tag when volumes are unknown.
- Recent list: rows of `time · type chips · who`, newest first, 15px,
  tabular-nums, 1px `--hair` rule between rows, day separators between days
  (`.day-sep` — 11px / 700 uppercase, `letter-spacing: 0.12em`, `--periInk`,
  with a 1px rule at 28% opacity filling the remaining width). The separator is
  deliberately styled unlike the time values so the eye can find day
  boundaries.

### 3. Day (read-back)

**Purpose** — hold the phone next to the paper page and see the same thing.

**Layout** — date strip, period totals, then the log.

- **Date strip**: horizontally scrolling pills, 40px tall, radius 20px,
  `today MM/DD` first then recent days; the selected pill takes
  `--lavFill` / `--lavInk`. A trailing `more` pill with a `calendar_month` icon
  opens the period picker.
- **Totals**: same four tags as home, recalculated for the selected period.
- **Table** (default view): `grid-template-columns: 38px 84px 1fr 70px 16px` —
  date · time · milk · pee/poop · who. Column head row is 10px `--muted` on
  `--card`. Rows are 15px tabular-nums on `--bg` with a 1px `--hair` bottom
  rule, padding `9px 18px`.
  - date cell prints only on the first row of a day (12px, `--muted`); other
    rows inherit it, exactly like the paper page.
  - time prints `HH:MM`, or `HH:MM–HH:MM` for a period.
  - milk prints `45`, `30 + 30` for a two-part feed, `45(B)` when a source is
    marked; an entirely unknown volume prints `?` in `--accent` at weight 900.
  - pee/poop prints `pee`, `poop (olive)`, or `pee · poop` when both were
    logged at the same minute.
  - who is a 16px circle with the initial, `--parentM` / `--parentA`.
  - notes render as a second line under the row, indented 130px, 12px,
    `--periInk`, prefixed with an `edit_note` icon.
- **Row edit**: drag a row left to reveal an 88px `--accent` "edit" action
  (`transform: translateX(dx)`, dx clamped to −88…0, snaps open past −40px).
  Tapping it opens the add-sheet pre-filled for that entry.
- Two alternative read-backs exist and are worth keeping as a user preference:
  **cards** (one rounded card per day, one line per moment) and **timeline**
  (a vertical rail with the hour on the left).

### 4. Add / edit sheet

**Purpose** — log a moment. A moment may carry several types at once (a feed
*and* a diaper change at the same time).

Opens full-screen over the app from the `+` button, `--bg` ground, radius 38px,
title row (`21px / 900` + icon tinted per type) with a 36px close button.

**Time card** (always present, first):

- Start time: `− [HH] +  :  − [MM] +`. Steppers are 42px circles, `--chip`.
  The numbers are text inputs — 32px / 900, tabular-nums, no box, a 3px
  underline that turns `--accent` when that field is the active one. Typing
  directly is allowed (2 digits, numeric keyboard).
- Press-and-hold on a stepper repeats every 110ms, and accelerates to 5-unit
  steps after ~1.5s (14 ticks).
- Start shortcuts: a row of pills — `now`, then minute offsets back from now
  (`5`, `10`, `15`, `20`, `30`, `45`, `60`), collapsed by default with a `…`
  toggle that expands the rest.
- End time is optional: a `+ end time — optional` pill sits below the
  shortcuts. Adding it reveals a second row above a 1px `--hair` rule: the same
  steppers at 32px / 24px type, its own `×` to drop the end time again, and its
  own shortcuts offset from the start time (`+30 min`, `+1 h`, `+2 h`, `+3 h`,
  `+4 h`).
- With both times set, the card shows the duration in words (`25 min`,
  `1h 05m`) next to the end shortcuts.

**Type blocks** — the sheet opens with **no type selected**. A dashed
`2px --chip` container offers three equal bubbles: `+ milk`, `+ diaper`,
`+ other`. Each adds its block; each block has a `×` to remove it. Blocks:

- **milk** (`--roseInk` header, `local_drink`): the volume as a 47px / 900
  figure with a 3px underline, a `breast` / `formula` pair of 46px toggles
  (`--lilacFill` / `--amberFill` when on), a 40px drag strip
  (`--scrubFill`, "drag to adjust"), and a 3-column keypad of 58px keys
  (1–9, backspace, 0, and a "?" for unknown). A feed can have two parts —
  selecting a part moves the underline to it, and the row reads `30 + 30`.
- **diaper** (`--mintInk` header, `water_drop`): two 78px toggles, `pee`
  (`--yellowFill` / `--yellowInk` when on) and `poop` (`--mintFill` /
  `--mintInk`). Choosing poop reveals optional `colour` swatch pills and
  optional `consistency` pills.
- **other** (`--lavInk` header, `more_horiz`): a stack of 56px full-width rows
  for the low-frequency events, with the note field carrying the detail. Copy:
  "kept off the main screen on purpose. pick one, write the rest in the note."

**Note card** — always last: an `edit_note` label in `--periInk` and a 46px
`--periFill` input, placeholder "spat some up / half asleep / …".

**Save** — `.btn-primary` with `check_circle` and the label "save"; **disabled
while no type block exists**. On save the sheet closes, the app returns to
**log**, and the mascot plays `lianaPop 0.6s` with the *logged* tag for 1.5s.

### 5. Period picker

Opens from the `more` pill. Title "pick a period" with `calendar_month` in
`--lavInk`, 44px close button.

- Preset pills (44px): today, last 7 days, last 14 days, this month.
- Month calendar in a `--card` panel, radius 28px: `‹ month title ›` (40px
  circle buttons), 7-column weekday head (10px `--muted`), then 44px day cells
  in a 7-column grid with 2px gaps. Each cell is the number over a 4px dot —
  the dot is `--mint` when that day has data, transparent otherwise. Future
  days are disabled.
- Tapping one day selects a single day; tapping a second selects the range
  (the ends take `--accent`, days between take `--roseFill`; the radius is
  squared on the inner edges to read as one bar). Hint text under the grid
  explains the current selection.
- Apply button carries the resulting label ("apply · 7 days"), disabled until
  a selection exists. Totals and the table then recalculate for that period,
  and the date strip shows the period on the `more` pill.

---

## Interactions & behaviour

| Trigger | Result |
| --- | --- |
| `+` (72px FAB) | opens the add-sheet with no type selected, time = now |
| tap a type bubble | appends that block; bubble disappears from the dashed container |
| `×` on a block | removes it; save disables again if it was the last one |
| hold a stepper | repeat every 110ms; ×5 acceleration after 14 ticks |
| tap a shortcut pill | sets start time to now − N minutes (or end time to start + N) |
| type into a time field | 2-digit numeric entry; the field's underline turns `--accent` while active |
| `+ end time` / `×` | adds / removes the end time; duration line appears with it |
| save | writes one record per type at the same timestamp; returns to log; mascot flashes *logged* for 1.5s |
| drag a row left | reveals the 88px edit action; snaps open past −40px, otherwise springs back |
| tap `edit` | reopens the sheet pre-filled with that record |
| tap a date pill | filters the day view to that day |
| `more` | opens the period picker |
| tab bar `pets` / `calendar_month` | switches log / day |

**Same-minute multi-type saves are separate records.** A pee and a poop logged
together become two records sharing a timestamp, which is what makes them show
as two chips side by side in the read-back and lets either be corrected alone.

**Mascot state** is derived, never set: gap since last feed < 120min →
*settled*; 120–240min → *awake*; ≥ 240min → *hungry*; night theme with gap >
60min → *sleeping*; 1.5s after a save → *logged*. She animates
`lianaBreathe` continuously (5s when sleeping, 7s otherwise), blinks on
`lianaBlink 5.5s`, and shows drifting `z` marks while sleeping.

**Theme** switches by clock, not by a setting: night surface overnight, day
surface in daylight. The prototype exposes it as a control only so both can be
reviewed.

**Empty states** — "nothing logged in this period." at 14px `--muted`, padding
`28px 22px`. Elapsed hero reads "—" when there is no feed yet.

**Validation** — nothing is required except a type. An unknown volume is a
first-class value (`?`). An unknown *minute* is not — see the amendment note at
the top. Volumes are integers in mL.

**Responsive behaviour** — the design is a single phone column; it should scale
by stretching the content column and keeping every control at its specified
height. Nothing in it needs a tablet layout. Minimum tap target is 40px; the
primary actions are 56–72px.

## State management

Per-install / account:

- `userName: string` — from welcome, marks every record (initial in the avatar).
- `deviceId: string` — generated once, shown on welcome for pairing.
- `firstRunComplete: boolean`.

Session / screen:

- `screen: 'log' | 'day'`
- `sheet: null | 'add' | 'edit'`, `draft: Draft | null`
- `selectedPeriod: { from: ISODate, to: ISODate }`
- `swipe: { rowKey, dx }` — open row action
- `justSaved: boolean` — drives the *logged* flash for 1.5s

Draft shape (what the sheet edits):

```ts
type Draft = {
  id: string | null;               // set when editing
  h: number; m: number;            // start time
  endH: number | null; endM: number | null;
  added: Array<'feed' | 'diaper' | 'other'>;
  parts: Array<{ vol: number | null; src: 'B' | 'F' | null }>;  // milk, 1–2 parts
  active: number;                  // which part the keypad edits
  pee: boolean; poop: boolean;
  color: string | null; cons: string | null;   // poop qualifiers
  other: string | null;            // chosen other-event type
  note: string;
  activeField: 'h' | 'm' | 'eh' | 'em';
}
```

Persisted record shape:

```ts
type Entry = {
  id: string;
  kind: 'feed' | 'diaper' | 'other';
  date: ISODate;                  // local day
  h: number; m: number;
  endH: number | null; endM: number | null;
  parts: Array<{ vol: number | null; src: 'B' | 'F' | null }>;  // feed only
  pee: boolean; poop: boolean; qual: string;                    // diaper only
  note: string;
  by: string;                     // the userName that logged it
  updatedAt: number;              // for sync conflict resolution
}
```

**Data requirements** — local-first. Both parents' phones write offline and
reconcile; records are immutable in identity and last-write-wins per field on
`updatedAt`. Totals (feeds, mL, pee, poop) are computed client-side per
selected period, never stored. The status row's "2m" is the last successful
sync age.

## Design tokens

All in `tokens.css`, both themes. Summary of what matters:

- **Ground / ink** day `#fdf7f2` / `#4b403a`, night `#171426` / `#cbbedb`.
- **Accent** day `#ef7f96`, night `#c07690`; on-accent `#fff8fa` / `#fdeef4`.
- **Per-type colours** milk rose `#ffe1e8`/`#c2506c`, breast lilac
  `#efe7fb`/`#7a5aa8`, formula amber `#ffeeda`/`#b06a1e`, pee yellow
  `#fff3d6`/`#a97f16`, poop mint `#dff2e8`/`#3f8a6b`, note periwinkle
  `#e9edfa`/`#5d72b8`, volume lavender `#f0e5fb`/`#7a5aa8`.
- **Type** Zen Maru Gothic 400/500/700/900. Sizes used: 10, 11, 12, 13, 14, 15,
  16, 17, 19, 21, 22, 24, 30, 32, 47, 64. All numbers are `tabular-nums`.
- **Radii** phone 38, card 24–28, pill 999, input 18–22.
- **Shadows** card `0 6px 16px var(--soft)`, cta `0 8px 18px var(--roseShadow)`.
- **Spacing** screen gutter 18px (22px on header rows), card padding 12–16px,
  gaps 4–10px. Never space siblings with margins where a flex `gap` will do.

## Assets

- `assets/app-icon-1024.png`, `-512`, `-180` — the app icon: Liana's head with
  her vine sprout and blue bib on the app's pink-lilac gradient. Drawn for this
  project; free to use, resize or re-export. Generate the remaining platform
  sizes from the 1024.
- **Icons**: Material Symbols Rounded (opsz 24, wght 500, FILL 1). Names used:
  `pets`, `calendar_month`, `add`, `remove`, `close`, `check_circle`,
  `chevron_left`, `chevron_right`, `schedule`, `line_end_arrow`, `local_drink`,
  `water_drop`, `water_full`, `cookie`, `favorite`, `more_horiz`, `edit`,
  `edit_note`, `spa`, `visibility`, `bedtime`, `auto_awesome`, `wb_sunny`,
  `cloud_done`, `drag_indicator`, `smartphone`, `arrow_forward`,
  `unfold_more`, `unfold_less`. Substitute the platform's own rounded set if
  Material Symbols is not available, keeping the weight light.
- **Fonts**: Zen Maru Gothic (Google Fonts, OFL) — bundle it; it carries the
  product's tone and there is no acceptable system substitute.
- The mascot in the prototype is drawn in CSS. If the app wants a richer
  Liana, commission the illustration; do not re-derive her from any existing
  character.

## Files

In `prototype/` (open `BabyLiana.dc.html` in a browser — it is the design doc
with every screen and variant side by side; `Phone.dc.html` is the interactive
phone itself and can be opened alone):

- `BabyLiana.dc.html` — the annotated design doc: welcome (turn 4), the live
  prototype, night palette across the three home leads, and the three day
  read-backs.
- `Phone.dc.html` — all screens, both themes, the full add-sheet, the period
  picker, seeded with a realistic three days of data.
- `support.js`, `image-slot.js` — the runtime the prototypes need. Not part of
  the product.

Configurable knobs on `Phone.dc.html` (useful for reviewing states):
`firstRun` (show welcome), `theme` (day/night), `lead`
(elapsed/combined/mascot), `dayView` (table/cards/timeline).

## Open questions for implementation

1. The device id has no copy/share affordance yet — worth adding a copy button
   and a "join with an id" path on the welcome screen.
2. Pairing flow beyond the id (invite, accept, both-phones-logging) is not
   designed.
3. Settings screen (baby name, theme override, units, export) is not designed.
4. "Other" event types are a placeholder list; confirm the real set before
   building.
