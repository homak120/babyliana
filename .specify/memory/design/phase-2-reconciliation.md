# Phase 2 handoff — reconciliation with the data model

**Revised 2026-09-04 against the second delivery.** The handoff in
`.specify/memory/design/handoff/` was replaced wholesale; `tokens.css` is
byte-identical to the first delivery, so nothing about colour, type, radius or
motion has moved. What changed is listed under *What the second delivery
changed*.

The **visual and interaction design is the deliverable and stands**; the data
shapes in its README are Design's own assumptions and do not.

The handoff says this itself: the HTML is *"design references… not production
code to port line by line"*, to be recreated in the target codebase. `tokens.css`
is the exception and is authoritative.

This note lists what to remap when Phase 6 builds from it.

## Struck outright

**The unknown-minute marker.** D-018 rules out any time-precision marker. Do not
build `minUnknown`.

The first delivery carried it, it was struck, and **the second delivery carries
it again** — now promoted into the `Draft` and `Entry` shapes and into
*Validation* ("an unknown minute is first-class"). That is not Design being
careless: the brief it works from describes the paper log, and the paper log
really does say `04:?`. The answer is still D-018's — a pen does not know the
time and a phone does, so the app removes the cause rather than giving the user
a way to express uncertainty. The README carries a banner saying so. Expect a
third delivery to raise it again; the banner is the cheapest way to stop that
costing a session each time.

## Remap, do not rebuild

| Handoff shape | Actual model |
| --- | --- |
| `parts: Array<{vol, src}>` — a two-part feed inside one record | Two separate `feed` events in one timeslot (D-019) |
| Records that share a timestamp imply a moment | A real `timeslot` row; events carry `timeslot_id` |
| `endH` / `endM` on each record | `ended_at` on the **timeslot**; every event in it shares the period (D-020) |
| `by: string` — the user's name on the record | `logged_by` → `device.id`; the name resolves through the `device` table |
| `qual: string` for poop | `poop_colour` and `poop_consistency`, separate constrained columns |
| `date` plus `h` / `m` as separate fields | `occurred_at timestamptz` |
| "last-write-wins per field" | Row-level last-write-wins on `updated_at` |

**Where this reaches the interaction — and how it was resolved.** The milk card
holds up to two parts: the row reads `30 + 30`, tapping a part moves the
underline to it, and one keypad edits whichever is active. That is the design's
own model and it stands.

An earlier attempt made "add another bottle" spawn a second card, reasoning from
D-019 that a split feed is two events. That was reading a storage decision as an
interaction one. The card is how a split feed is *entered*; two feed rows are
how it is *kept*. `toEntries` turns one card into two entries, and
`blocksFromMoment` collapses them back on edit.

## What is built vs what is still deferred

The handoff says colours, type sizes, radii, spacing and copy are final and
should be matched closely, so gaps are worth naming rather than leaving to be
noticed.

Built and matched: tokens, both themes by clock, the mascot as the handoff's own
CSS composition, the elapsed hero, totals tags, the recent list with day
separators, Material Symbols throughout, the FAB and the add sheet's blocks.

Deferred by slicing, not oversight — each lands where it has something to be:

**As of 2026-09-04 that list is nearly empty.** The tab bar, row avatars, the
time card, swipe to edit and delete on both lists, and the period picker are all
built. What remains:

| Missing | Status | Note |
| --- | --- | --- |
| Mascot artwork | next | The second delivery supplies it; `Mascot.tsx` is still the CSS composition |
| Cards and timeline day views | post-MVP | Alternatives the handoff offers as a user preference, not the default |
| Three home lead variants | post-MVP | D-007 wanted them compared, not all shipped |
| Device id / pairing on welcome | post-MVP | D-022 |

## What the prototype settled that the written spec did not

Driving the prototype's own milk and diaper blocks in a browser answered a
behaviour question the README never states. Its milk block has **no `?` key and
no "unknown" source button**, and says why in its own copy: *"leave it blank and
it saves as ? — a feed happened, volume unknown."*

So blank is the unknown, in both dimensions — a blank volume is the paper's `?`,
and both source toggles off is the unlabelled `30 + 30`. A control for something
the absence already expresses is a control to get wrong at 4am. The `MilkDraft`
no longer carries an `unknown` flag: one representation, not two.

The consequence for saving: a blank milk block is **valid**, where an earlier
version required a number or an explicit `?`. Requiring one would make the app
unable to record something the paper log does about once a day.

The keypad's bottom-left is `+`, not `?` — it adds another bottle, which under
D-019 is exactly what a split feed is.

**One deliberate divergence.** A new diaper block defaults to pee; the prototype
starts with neither selected. The dominant entry across seven days of the real
log is a bare `1`, so defaulting makes the commonest change zero extra taps and
is one tap to undo.

## One interaction rule the model overrides

The handoff says *"tap a type bubble → appends that block; bubble disappears
from the dashed container"*. That was written when a split feed was one block
with two halves. Under D-019 it is two milk blocks in one moment, so the milk
bubble has to stay. Diaper does disappear — one change is one change, and pee
and poop are flags on it rather than two entries. `other` stays, since a moment
might carry a sleep and a weight.

## Delete: the design now has it, and disagrees about the confirmation

The first delivery had no delete at all. The second specifies it, and **agrees
with D-025 on everything except how it is confirmed**:

| | D-025 (built) | Second delivery |
| --- | --- | --- |
| Actions revealed | edit + delete | edit + delete — same |
| Which lists | both, since the D-025 amendment | "the day views AND the home list" — same |
| Scope of a delete | the whole moment | "every record in that row" — same |
| Travel | −176…0 | −176…0 — same |
| Snap threshold | −40px | −60px |
| Confirmation | immediate, undo toast | bottom confirm sheet naming the entry |

The convergence is worth noting: two independent passes reached the same shape.
The confirmation is a real disagreement and is **Q-012**, unresolved. D-025's
reasoning was that a modal in front of someone holding a baby at 4am is the
friction that sends people back to the pen; the design's is that a hard delete
with no tombstone (D-003) deserves a deliberate confirmation. Both are sound.
Until it closes, the built behaviour stands.

## Fidelity gaps against what is built

Found by reading the second delivery against the CSS, 2026-09-04. All small, none
urgent, listed so they are not rediscovered one at a time.

| Spec | Built | Note |
| --- | --- | --- |
| Day table `38px 84px 1fr 70px 16px` | `34px 62px 1fr 108px 18px` | **Do not blindly adopt.** The pee/poop column was widened to 108px deliberately — 70px cannot hold "poop (brown soft)" without wrapping to three lines. Take the other four, keep ours here, or shorten the copy. |
| ~~Row note indented 130px~~ | done | The day rows already had it as `padding-left`; only the home list was short at `4rem`. Fixed 2026-09-04. |
| ~~Snap open past −60px~~ | done 2026-09-04 | |
| ~~Home mascot 108px wide~~ | done 2026-09-04 | Artwork landed |
| ~~Period presets: today, …~~ | done 2026-09-04 | |
| ~~Apply reads "apply · 7 days"~~ | done 2026-09-04 | |
| ~~Range ends square their inner edges~~ | done 2026-09-04 | |

Matched and confirmed: `--lavFill`/`--lavInk` on the selected date pill, the
`more` pill with `calendar_month`, 44px cells over a 4px `--mint` dot, disabled
future days, the tab bar's 72/56 geometry, and the mascot state thresholds in
`derive.ts` — which are identical to the spec, gap <120 settled, 120–240 awake,
≥240 hungry, night + >60 sleeping, 1.5s logged.

## Pairing needs rethinking against D-004

The welcome screen shows a **device id** (`LNA-7QD4-8213`) and tells the user to
share it so all phones log to the same baby. In the model the *baby* id is the
shared token and the device id identifies a device — two different things, which
the design conflates.

The handoff names this itself in its open questions: no copy affordance, and no
pairing flow beyond the id. `.specify/memory/baby-and-devices.md` has the
intended shape — one screen, two paths. All of it is post-MVP under D-022.

The design's instinct is right and better than the model on one point: a short
readable code like `LNA-7QD4-8213` beats a raw UUID on screen, which is exactly
what D-018's readability rule would ask for. Worth keeping that idea and
attaching it to the baby id.

## What the second delivery changed

Only four things. Everything else, `tokens.css` included, is as before.

1. **The mascot is now supplied artwork, not CSS shapes.** Four transparent PNGs
   — `liana-settled`, `-awake`, `-hungry`, `-sleeping` — rendered 108px wide in
   the home header and swapped by derived state, with the *logged* flash reusing
   `-awake`. `liana-home.png` at 88×88 is the welcome mascot. The app icons are
   the same artwork on the cream ground with 7% padding.

   This retires `src/log/Mascot.tsx`'s CSS composition and settles a question
   the first delivery left open: **there is per-state art, so the states survive
   the switch to a flat image.** That was the blocker when the art was first
   raised, and it is gone.

   The first delivery said *"do not re-derive her from any existing character"*.
   The second says *"ensure the client holds the rights to them"* — the art is
   the owner's to supply and the rights question is his, stated once here and
   not re-litigated. Q-003 carries the same caution for the product path.

2. **Delete exists**, with the confirm-sheet disagreement above.

3. **Row actions apply to the home list too**, which the D-025 amendment had
   already concluded independently.

4. **The unknown minute came back.** Struck again.

## Decisions the design made that are not Design's to make

Neither is a problem. Both need the owner to confirm rather than inherit.

**Q-003 — is the mascot the baby, or a separate creature?** The handoff calls
Liana "the app's own character", a creature with a vine sprout — but names her
after the baby. That is both answers at once. Q-003 is a Phase 7 owner decision.

**Q-008 — the name.** "BabyLiana" is now in the app icon, the mascot's name and
the copy throughout. Q-008 defers naming precisely to keep it out of anything
expensive to change; this made a rename more expensive. Not fatal — the icon is
a placeholder until Phase 7 anyway — but the cost went up.

## What the handoff settles well

Recorded so it is not relitigated:

- **Q-002** — three lead variants built for comparison, not one asserted answer,
  which is what D-007 asked for
- **Q-009** — the day table prints the date only on the first row of a day,
  matching the paper page; two alternative read-backs offered
- **Q-001** — sheet opens with no type selected; milk, diaper and other as three
  equal bubbles; secondary types behind "other". Matches D-010
- **Q-007** — the sheet *is* a moment, even though the brief never described one
- Volumes are arbitrary integers via keypad, not presets — which the non-round
  volumes in the real log require
- `?` for unknown volume is first-class, matching a nullable `volume_ml`
