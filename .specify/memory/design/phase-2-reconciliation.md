# Phase 2 handoff — reconciliation with the data model

The Claude Design handoff in `.specify/memory/design/handoff/` was
produced from a brief that predates D-019 and D-020. The **visual and
interaction design is the deliverable and stands**; the data shapes in its
README are Design's own assumptions and do not.

The handoff says this itself: the HTML is *"design references… not production
code to port line by line"*, to be recreated in the target codebase. `tokens.css`
is the exception and is authoritative.

This note lists what to remap when Phase 6 builds from it.

## Struck outright

**The unknown-minute marker.** D-018 rules out any time-precision marker. The
handoff README has been amended; the prototype's `minUnknown` scaffolding is
dormant and unreachable and was left as delivered. Do not build it.

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

**The one place this reaches the interaction, not just storage.** The milk block
lets you select between two parts of one feed, so the row reads `30 + 30`. Under
D-019 that is two feed entries in the same moment, so the affordance is closer to
*add another bottle* than *edit the second half*. Everything else is invisible to
the user.

## What is built vs what is still deferred

The handoff says colours, type sizes, radii, spacing and copy are final and
should be matched closely, so gaps are worth naming rather than leaving to be
noticed.

Built and matched: tokens, both themes by clock, the mascot as the handoff's own
CSS composition, the elapsed hero, totals tags, the recent list with day
separators, Material Symbols throughout, the FAB and the add sheet's blocks.

Deferred by slicing, not oversight — each lands where it has something to be:

| Missing | Lands in | Why not sooner |
| --- | --- | --- |
| Tab bar (log / day) | S7 | Nothing to navigate to until the day view exists |
| `who` on each row, parent avatars | S9 | Needs device names, which the welcome screen sets |
| The time card in the sheet | S5 | Its own slice, and the one that decides whether this beats the pen |
| Row swipe to edit / delete | S8 | |
| Period picker, cards and timeline day views | post-MVP | Alternatives the handoff offers, not the default |

## Delete is missing from the design

The handoff specifies swipe-to-edit as a single 88px action and does not mention
delete anywhere. The coverage checklist has required *"an entry deleted after it
was recorded"* since Phase 0, so this is a gap rather than a decision.

D-025 settles it: the swipe reveals **two** actions, delete takes the whole
moment, and it is immediate with an undo toast rather than a confirm dialog.
Build to D-025, not to the handoff, on this one point.

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
