# BabyLiana — changes since the v2 mascot art

All changes live in `Phone.dc.html` (the app) unless noted.

## 1. Copy

- "liana" → "Liana" everywhere in UI copy (delete confirmation, lock screen, welcome screen, the "Liana is …" state label).
- Parent-name field placeholder: "mona" → "Anya".

## 2. Day / night mascot art

- Home mascot image resolves to `assets/liana-<state>.png` on the night theme and `assets/liana-<state>-2.png` (v2 set) on the day theme.
- States: `awake`, `hungry`, `settled`, `sleeping`; the post-save flash uses the `awake` art.

## 3. Bottom action bar — quick-add row

- Added three quick-log buttons: **feed** (rose, `local_drink`), **diaper** (mint, `water_drop`), **sleep** (peri, `bedtime`), 40px circles.
- The "+" button is now 46px and sits to the **right** of the three quick icons.
- Each quick icon opens the **same "what just happened" sheet** with that type pre-added (`added: ['feed' | 'diaper' | 'sleep']`) — no dedicated per-type screens. The user can add the other types to the same entry.
- Right-hand tab icon changed from `calendar_month` to `assessment` (report).
- Removed the palm/`spa` tab icon.

## 4. Bottom bar is contextual

- **Home:** quick icons + "+" on the left, report icon on the right.
- **Report / day screen:** no add actions at all — a single "← back" pill returning to home.

## 5. Sleep is a first-class event type

- Sleep is a chip in the "what just happened" sheet alongside milk, diaper and other, with its own card block.
- Sleep was **removed** from the "other" type list (`otherTypes`), so it is no longer a free-text other event.

## 6. New sleep state logic

Data model: a sleep entry is stored as `{ kind: 'other', sleep: true, endH, endM, note }`.

- **Open-ended on creation:** saving a sleep sets `endH = endM = null` and `note = 'sleeping…'` (plus `' — <user note>'` if one was typed).
- **Sleeping = any sleep entry with no end time** whose start is at or before now (`ongoingSleep()`). While one exists, Liana's state is `sleeping` — this takes priority over the previous heuristic (night theme + >60 min since last feed), which remains as the fallback when nothing is logged.
- **End sleep control:** while sleeping, the bedtime quick icon is replaced by an "end sleep" pill in the bar showing the live running duration (e.g. "1h 12m"). Its icon is a custom inline SVG — a crescent moon with an arrow rising out of the notch (waking), 2px stroke, `currentColor`, matching the existing icon weight. Tapping it sets `endH/endM` to now and rewrites the note to `slept <duration>`; the save flash fires.
- **Auto-close on the next entry:** when any new entry is saved, any open sleep that started before the new entry's time gets `endH/endM` set to that entry's time and its note rewritten to `slept <duration>`. Skipped for the sleep entry being created in the same save.

## 7. Sleep in the log views

- `rowsForDay()` groups sleep into its own row slot (`r.sleep`), separate from `r.other`; the auto-generated "sleeping…" / "slept …" text is not duplicated into the row notes (only a user-typed note is).
- **Home log row:** a peri chip reading "sleeping…" while open, "slept 1h 20m" once closed; icon `bedtime` while open, `wb_twilight` once closed.
- **Day timeline row:** the same text as a peri line under the milk/diaper lines, and the row dot uses the moon icon on peri fill when the slot is sleep-only.
- Swipe-to-delete on a row now includes the sleep entry in the deleted ids.

## 8. Sleep duration on the top card

- While a sleep is open, the top summary card shows "`<duration>` asleep" under
  the state bubble, with the same end-sleep icon button (30px, `--periFill`/
  `--periInk`, the crescent-and-arrow SVG) beside it. Tapping it ends the sleep
  at now, same as the bar control.

## 9. Lead-view switcher

- A vertical rail of three 32px icon buttons sits immediately left of the top
  card and switches which summary the card leads with:
  `schedule` → **elapsed** (big "since last feed" + state bubble),
  `insights` → **combined** ("2h 10m ago · 120 mL" + time),
  `pets` → **mascot** (state word large, elapsed and last volume beneath).
- The active icon fills with `--accent` on `--onAccent`; inactive are
  `--chip` on `--muted`.
- The selection is runtime state, initialised from the existing `lead` prop,
  so the prop still sets the default view.
- The mascot image in the card is now 88px (art 100px) to make room for the rail.

## 10. Report screen — insights mode

The report screen now has two modes, switched by a pill pair at the top:
**log** (the existing table / cards / timeline views, unchanged) and
**insights**. Insights carries a 3d / 7d range toggle; all figures are derived
from the entries, nothing is stored.

Cards, in order:

1. **Worth a look** — shown only when something triggers. Rules: any complete
   day with fewer than 6 wet diapers; more than 24h since the last poop; any
   day with a feed gap of 5h or more; today's projected intake 20% or more
   under the average.
2. **Milk intake** — average mL/day (complete days only), a per-day bar chart
   (today's bar in `--accent`, earlier days a 42% accent tint), feeds per day,
   average per feed, and a "today / on pace" sub-card: today's mL so far plus
   the day-end projection (`ml / max(0.2, minutesElapsed / 1440)`) with its
   percentage delta against the average.
3. **Daily rhythm** — a days × 24-hour grid, one cell per hour, coloured by the
   hour's dominant event with priority feed > poop > pee > sleep (sleep fills
   every hour it spans). Legend, an 0/6/12/18/23 hour scale, plus typical gap
   between feeds and the longest gap with its date.
4. **Wet / poop** — a pair of half-width cards: average wet diapers per day
   against the 6-a-day hydration mark (figure turns amber when under), and
   time since the last poop with its date, time and description.
5. **Sleep** — average sleep per day, number of sleeps, per-day bars, longest
   single stretch. Falls back to a prompt when nothing is logged.
6. **Growth** — weight entries listed by date; the card is omitted when there
   are none.

New theme tokens, emitted for both day and night: `--dim` (mid-contrast
caption ink), `--flagInk` (deep amber for the watch-list card and the wet
figure), `--roseDeep`, `--mintDeep`. These exist because chart labels and the
warning card need 4.5:1 body-text contrast, which `--muted` and the base
`--*Ink` tones do not reach on their own fills. Chart values, day labels and
heatmap row labels are `--ink` at 11px bold; captions and the hour scale are
`--dim` at 11–12px.
