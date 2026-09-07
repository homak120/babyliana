# Decisions

Read this before relitigating anything. Each entry records what was decided and
why, so the reasoning survives being picked up cold at 1am three weeks from now.

Format: decision, then rationale, then what would reverse it.

When a decision is reversed, **rewrite the entry to state what is now true** and
say plainly that it supersedes the old one. Do not leave a stale entry standing
next to reality — a decision log that disagrees with the world stops being a
reference and becomes a source of false blockers.

---

## D-001 — PWA, not a native iOS app

Installed to the home screen via Safari. No App Store, no Apple Developer
Program, no $99/year, no signing, no 7-day certificate expiry.

**Why.** Free sideloading alternatives all inherit Apple's free-tier ceiling: a
7-day certificate, a 3-app cap, and no push. Automating the refresh (SideStore)
means putting a VPN profile and a sideloading client on a phone, where the
failure mode is an icon that no longer opens — discovered mid-feed. A PWA has no
expiry, no cap, no maintenance, and costs nothing.

**Cost accepted.** No Apple Watch, no Live Activities, no lock-screen widgets.

**Reversal condition.** Only if the app proves too slow to beat paper at 3am
*and* the gap is specifically speed of entry. That is a new project — Swift
rewrite, a Mac, $99/year — not a continuation. Any other shortfall is a PWA
problem to fix in the PWA.

---

## D-002 — Supabase for sync, IndexedDB for local

**Why.** The free tier covers this workload by three orders of magnitude.
Postgres suits this event log with row-level security. Realtime gives
live cross-device updates without building a socket layer.

IndexedDB holds a complete local replica so writes never wait on the network.

**Considered.** CloudKit — free, no third party, better privacy — but the iCloud
entitlement requires the paid developer account, which D-001 rules out. Firebase
— does not pause, better offline out of the box, but per-read/write billing and
a worse fit for an event log.

**Reversal condition.** The event log is plain rows, so the backend stays
swappable. A migration is an export and a replay, not a rewrite.

---

## D-003 — Mutable rows, last write wins

Timeslots and events are **updated in place and deleted outright.** No
correction events, no tombstones, no revision history. This supersedes the
earlier append-only decision, which is dead.

**Why the reversal.** The append-only design was justified by the paper log's
strikethroughs — but a strikethrough exists because *you cannot erase ink*. It
is a limitation of the pen, not something the user wants, in exactly the way
`04:?` was (D-018). The app has no such limitation, so reproducing the
workaround was solving the pen's problem instead of the user's.

The one genuine benefit was conflict-free offline merge: append-only plus client
UUIDs makes merging two devices a concatenation. That guards against both
parents editing the same row while both are offline, before either syncs. For
two people that is vanishingly rare, and last-write-wins on `updated_at` is an
adequate answer when it happens. The realistic case is one person fixing their
own typo seconds after making it.

**Cost accepted.** No audit trail. Nobody wants a revision history for a baby
log at 4am, and `updated_at` leaves the door open to showing "edited" later if
it ever matters.

**Hard delete, not soft.** Deleting a timeslot removes it and its events. This
works because reconcile is a full refresh — at roughly thirty events a day the
whole log is small enough to re-fetch on resume, so a deleted row is noticed by
its absence. A `deleted_at` column would be solving a problem this app does not
have.

**What this dissolves.** Q-010 existed entirely to settle `corrects` and
`deleted` semantics under append-only. Those fields are gone, so the question is
retired rather than answered, and Phase 6 is no longer blocked from writing
correction and deletion code.

**Reversal condition.** If the app is ever used beyond this one household
(Phase 12), or genuinely concurrent editing becomes common, revisit.

---

## D-004 — Shared baby ID, no accounts

No email, no password, no login. The baby's id is the only token: whoever has it
logs to her. A second device joins by being given that id.

**Supersedes the earlier "household ID" framing.** A household was an abstract
container with nothing in it. A baby has a name, so the app can show "Liana"
instead of hard-coding her name in the UI, and a sibling later is a second row
rather than a second concept. See D-026.

**Why.** Magic links require email and can expire, and a logged-out state at 3am
is exactly the failure that sends someone back to the pen. Less "correct",
dramatically better for the actual users.

**Security property, stated plainly.** The baby ID is a bearer token.
Possession is full access, there is nothing to revoke, and no second factor.
That is the right trade for two parents and one baby, but it has consequences:
keep the ID out of URLs, where it would reach browser history, referrers, and
any analytics.

**Reversal condition.** If the app is ever used by families beyond this one
(Phase 12), identity needs revisiting — and this is the property that forces it.

---

## D-005 — First release is a surprise

The second parent does not see the POC, the prototype, or the MVP. She sees a
finished thing.

**Why.** The owner's choice, and he is a co-parent doing his own night shifts —
legitimate primary research, not a proxy for someone else.

**Consequence.** Polish moves *before* reveal. A bare-bones version presented as
a gift reads as unfinished rather than pragmatic. Phase 7 (visual identity)
therefore precedes Phase 9 (reveal).

**Risk accepted.** This binds the gift to the product. If she keeps using paper,
both fail at once. Mitigated by the single-user viability requirement and the
solo run.

---

## D-006 — Coverage first, not minimum surface

Support every event type the log contains, plus the ones likely to matter, at
launch. Do not ship two types and add the rest later.

**Why.** If the app doesn't cover something, the paper stays on the table. Once
both systems are in use, the app has lost. Breadth beats minimalism when the
competitor accepts anything.

**Reversal condition.** None. This overrides the usual MVP instinct deliberately.
See `.specify/memory/coverage-requirement.md`.

---

## D-007 — UI hierarchy decided from the prototype, not from reasoning

Which controls are primary, how the night surface is laid out, what the screen
leads with — all decided by tapping a clickable prototype, not by argument.

**Why.** No amount of upfront reasoning beats trying it. Claude Design produces
the prototype in Phase 2; the decision closes there with real information.

**Consequence.** The spec carries a marked hole rather than a guessed answer.

---

## D-008 — Public repository

Public from the start, at `github.com/homak120/babyliana`. Owner's decision,
confirmed 2026-09-01 with the repository contents known.

**Why.** The owner's call. Privacy is a setting that can be applied whenever he
wants it, and the earlier default of private was costing more in friction than
it was buying.

**Cost accepted.** The repo holds photographs of the paper log — one real
infant's feed volumes, diaper record, and dated handwritten notes — and will
hold the Phase 7 mascot art, which may be based on the baby (Q-003). All of it
is world-readable. Turning the repo private later removes future access, not
past access.

**Reversal condition.** Owner flips it whenever he likes; that is a settings
change, not a project decision, and needs no discussion here. Revisit properly
before Phase 12, where other families' children's data would be involved and
the calculus is not the owner's alone to make.

**Agents: do not treat public visibility as a defect.** Do not flag it, do not
block a commit or a push on it, and do not propose making it private. This entry
supersedes the earlier "Private repository" decision, which is dead.

---

## D-009 — Scope is the newborn phase, and expires

v1 targets bottle feeds of 30–60mL every 2–3 hours and early poop-colour
progression.

**Why.** The observed data shape has a short shelf life. Feeds consolidate around
6 weeks; by 3 months the interesting variable is sleep. An app that takes a month
to build ships for a baby who no longer exists. Speed matters for aim, not just
convenience.

**Consequence.** Do not design for the 12-month version. Revisit in three months
with better information.

---

## D-010 — Extensible model, opinionated surface

All event types exist in the schema. Not all appear on the primary logging
screen.

**Why.** An open type registry costs nothing and honours "everything optional".
But a dropdown of ten types at 3am costs a tap, a scroll, a read, and a
selection — and the pen wins. Feed and diaper are what the log shows being used
constantly; everything else has never been recorded.

**Interaction with D-006.** Coverage is about the schema and about reachability.
Ranking is about the surface. Both hold: everything is supported, not everything
is featured.

**Reversal condition.** Promotion from secondary to primary is decided by
observed use in Phase 8, not by design now. Sleep in particular is built but not
featured — if it gets logged during the solo run, promote it.

---

## D-011 — Spec is a track, not a phase

Each build slice carries its own spec artifact in `.specify/memory/`, produced
immediately before it, at the fidelity that slice deserves.

**Why.** A single "spec handoff" phase implies specs are produced once in a batch
and then executed — the waterfall shape this workflow exists to avoid. The
infrastructure spike gets a paragraph. The MVP gets the full package.

---

## D-012 — Spike infrastructure is kept, spike code is discarded

The repo, pipeline, Supabase project, and deploy config from Phase 3 are
permanent. The application code is deleted before the Phase 6 build begins.

**Why.** Otherwise the throwaway counter page quietly becomes the foundation and
the event model gets shaped by an evening's hacking.

---

## D-013 — Sleep is supported but not featured at launch

**Why.** Seven days of paper log contain zero sleep entries. Featuring it would
be inventing a requirement the user does not have. But it is the thing paper
handles worst and the pain moves there around 8–12 weeks, so the type exists.

**The type is cheap; the reader is not.** Every other event is an instant. Sleep
is an interval, with `ended_at` or open-ended. Intervals break three things that
are otherwise trivial: "time since last X", the duplicate-detection window, and
day-boundary attribution when a sleep crosses midnight (D-015). Adding the type
to the registry costs nothing. Handling it correctly in the derived views does.
Either accept that knowingly, or leave the type out until Q-006 promotes it.

**Amended 2026-09-05 by D-029: sleep is featured now.** Not because Q-006 closed
— the solo run has not happened — but because the third design delivery put it on
the primary surface, and the interval cost this decision priced was paid rather
than avoided. What stands is the reasoning: the paper log still contains zero
sleep entries, so this remains a type the design chose rather than one the
baseline demanded. If the solo run says nobody reaches for it, that is a real
finding and not a contradiction.

---

## D-014 — Milk in millilitres, `B` = breast milk, `F` = formula

Confirmed by the owner. Volume stored in mL throughout; display units are a
presentation concern.

---

## D-015 — Day boundary at midnight local

**Why.** Matches how the paper log groups dates. A "night" boundary (e.g. 4am)
was considered and rejected as diverging from the existing mental model.

**Reversal condition.** If daily totals feel wrong in use, revisit. Cheap to
change — it is a display concern, not a storage one.

---

---

## D-016 — Vercel for hosting

`technical-constraints.md` said "Vercel or Cloudflare Pages" and left it open.
Closed: **Vercel.**

**Why.** One-click GitHub integration and no configuration for a Vite/React app.
Cloudflare Pages' advantage is bandwidth, which two parents logging roughly
thirty events a day will never approach.

**Reversal condition.** Cheap. The app is a static bundle with no server-side
code, so moving hosts is a repoint, not a migration. Revisit only if Vercel's
free tier changes shape.

---

## D-017 — Styling system deferred until the design prototype lands

The spike uses plain CSS. The real styling decision — Tailwind, CSS modules,
something else — is not made yet.

**Why.** Claude Design is producing the Phase 2 prototype now, and what it hands
back changes the answer. Deciding before seeing it risks redoing the work. The
spike's CSS is deleted under D-012 regardless, so nothing is lost by waiting.

**Closed by:** Phase 4 or 5, with the prototype in hand.

---

## D-018 — No time precision marker. A time is a time

The app does not record, store, or display whether a time was tapped live or
typed from memory. There is no `exact` / `approximate` / `unknown` distinction,
no `?`, and no `~`. Every event carries an ordinary timestamp.

**Why.** `04:?` in the paper log is not a notation the user wants — it is what
you write when you are reconstructing a 4am feed at breakfast with a pen and no
better option. The app removes the cause. Logging is a button that stamps the
current time, so the overwhelmingly common case is an exact time at zero cost,
and the remaining retroactive case is served by making time *adjustment* fast
rather than by making imprecision expressible.

**The owner's test, and it is the right one:** if a human cannot read a mark and
immediately know what it means, it does not belong in the app. `?` fails that.
So does a tilde, which is why the marker was dropped entirely rather than
softened into a symbol.

**Cost accepted, stated plainly.** A time typed from memory and a time tapped
live are indistinguishable forever, including to the other parent reading
remotely and to any future export. This is knowingly given up. Where paper is
honest about its own uncertainty, the app is not.

**What replaces it** is entry speed, not notation — see
`.specify/memory/design/phase-2-brief.md` § Entering and adjusting the time.
Default to now; quick relative offsets; a picker; direct numeric entry.

**What this does *not* touch.** `?` in the Milk column is a different fact and
survives unchanged: a feed happened and the volume was not known. The app cannot
infer a volume the way it can infer a time, and blank versus unknown volume
remains a real distinction — see `.specify/memory/paper-log-baseline.md`
§ Blank is not unknown.

**Consequence for the coverage test.** The acceptance test becomes *every fact
is represented*, not *every glyph is reproduced*. One row of the photographed
log will not render identically. That is a deliberate loosening, recorded here
so it is not later mistaken for a bug.

**Reversal condition.** If the retroactive case turns out to be common in the
solo run (Phase 8) and guessed times start polluting the derived arithmetic,
revisit — but reintroduce it as a *word*, never a symbol.

---

## D-019 — A timeslot is the unit, not an event

Two tables. A `timeslot` is one moment someone logged something; `event` rows
hang off it. `21:09` might carry a diaper change and two bottles — one timeslot,
three events.

**Why.** It mirrors the source of truth. `paper-log-baseline.md` says it
outright: *"a row is a moment, not an event."* The paper's unit is the line, and
a schema that flattens everything into independent events throws that structure
away and then has to reconstruct it for the day view.

**Consequence for feeds.** A split feed is two events, not one event carrying a
`components[]` array. `25(B) + 45(F)` is two rows under one timeslot. This drops
the nested array and its arbitrary two-item cap, and `30 + 30` — the unlabelled
split that appears in the real log — falls out naturally as two rows with an
unknown source.

**Consequence for diapers.** Still one event, with `pee` and `poop` as separate
booleans, because a single change may contain both.

**Invariant.** A timeslot always has at least one event; the UI writes nothing
if nothing was entered. Deleting a timeslot deletes its events.

**Reversal condition.** None anticipated. If it ever proved wrong, flattening
timeslots into events is a mechanical migration.

---

## D-020 — A timeslot may be a period, and `other` is a real type

`timeslot.ended_at` is optional. Null is a point in time — the overwhelmingly
common case. Set, and the timeslot is a period that every event in it shares.

**Why on the timeslot rather than the event.** Sleep was the driving case and
already had an `ended_at` of its own, but putting duration one level up makes it
generic: any type can have one, including `other`, and a single period can cover
several events logged together. `ended_at` is therefore removed from the sleep
event — two ways to express one fact is how a duration ends up correct in one
view and wrong in another.

**Cost accepted.** Events cannot carry their own time inside a period. "The
diaper change happened at 21:05 within a 21:00–23:30 sleep" is not expressible;
that would be two timeslots.

**`other` as a first-class type.** No columns of its own — type plus `note`,
plus a period if it needs one. Together with the note on every row and the
optional period, this is what makes the app as accepting as a pen, which is the
whole of `coverage-requirement.md`'s last item and the one that lets the list
survive contact with reality.

**Open, and deliberately not decided here.** Whether a period can be opened now
and closed later, or must be entered complete, is an entry-flow question for
Phase 2 (Q-007). The schema supports either.

---

## D-021 — The Phase 2 layout, resolved

Decided by the owner in the Claude Design session, by building and trying the
prototype rather than by argument — which is what D-007 required. The artifact
is at `.specify/memory/design/handoff/`, and its shipped defaults are the
decision. This closes Q-001, Q-002, Q-007 and Q-009.

**Two screens carry the product.** *Log* (home) and *day* (read-back).
Everything else is a sheet over them.

**The screen leads with elapsed time since the last feed** — `Xh MMm`, 64px,
tabular. Q-002. Three leads were built to compare (elapsed / elapsed + volume /
mascot-first); elapsed is the shipped default, confirming the provisional answer
in `product-definition.md`. The other two survive as alternatives, not as
undecided.

**One sheet is one moment.** Q-007. It opens with *no type selected* and three
equal bubbles — `+ milk`, `+ diaper`, `+ other` — each adding a removable block.
Save is disabled until at least one block exists, which is what enforces
"a timeslot always has at least one event" at the point of entry. The prototype
hard-codes this flow rather than exposing it as a variant.

**Feed and diaper are the primary surface; everything else is behind `other`.**
Q-001, and D-010 upheld: sleep, weight, temperature, supplement and spit-up are
rows inside the `other` block, with the note carrying the detail.

**The day view is a table by default**, matching the paper page — five columns,
with the date printed only on the first row of a day and inherited below it.
Q-009. Cards and timeline are kept as a user preference, not as open questions.

**Time entry is steppers, offset pills, and direct numeric entry.** Hold-to-
repeat accelerates after ~1.5s. No natural-language parsing, per the brief —
it fails silently and the person using it is tired. This is what D-018 meant by
answering `04:?` with speed instead of notation.

**Theme switches by clock, not by a setting.** Night surface overnight, day
surface in daylight.

**The mascot's state is derived, never set** — settled / awake / hungry /
sleeping, plus a one-off *logged* flash. Descriptive only, and she never nags,
which is the tone rule holding.

**Reversal condition.** Phase 8 is the real test. If something here does not
survive actual 3am use, it changes — that is what the solo run is for. Until
then it is settled and should not be relitigated from the spec.

**Not decided here.** Q-003 (is the mascot the baby or a creature) and Q-008
(the final name) remain Phase 7 owner decisions. The handoff answers both
implicitly — it calls Liana "the app's own character" while naming her after the
baby, and puts "BabyLiana" in the icon and copy — but neither was Design's to
settle.

---

## D-022 — No pairing flow for MVP; one baby row

One `baby` row is inserted for Liana and her id is hard-coded in the client.
There is no join screen, no QR code, no invite. Both phones use the same id.

**Why.** Two parents, one baby. A join flow is infrastructure for a problem that
does not exist yet, and the point of the MVP is the shortest path to something
usable at 3am. `.specify/memory/baby-and-devices.md` describes the flow for when
it is needed; it is deferred, not deleted.

**This supersedes D-004's QR code for now.** D-004 has a second device joining by
being given the id. That still holds as the eventual design, and the Phase 2
handoff independently proposed a typed readable code — worth reconciling when
this comes back, since a readable code needs no camera and can be sent to
someone who is not in the room.

**Consequence, stated plainly.** With a hard-coded baby id, a public anon key
and no accounts, the log is readable by anyone who finds the repo. That follows
from D-008 rather than from this decision, and the owner has already accepted
publishing the paper-log photographs. The difference in kind is that this is
live and continuous, and includes whatever goes in the free-text notes.

**Trigger to revisit.** A third device, or anyone outside this family.

---

## D-023 — No duplicate detection in MVP

Two similar entries logged minutes apart are not flagged, surfaced, or merged.

**Why.** It was designed for the append-only model, where merging two offline
devices by union could produce near-identical events. That model is gone (D-003).
Three things argue against building it now: the Phase 2 design — final under
D-021 — has no duplicate-detection UI at all; the non-negotiable is *never
resolve a duplicate silently*, which is satisfied for free by never merging; and
with a paper-shaped day table and swipe-to-edit rows, a human sees two
near-identical rows immediately and deletes one.

Building it means inventing a merge interaction the design does not have, for a
case two people will rarely hit.

**Trigger to revisit.** It happens during the solo run and is actually annoying.

---

## D-024 — Export is a pre-reveal requirement, not an MVP one

The JSON export ships before Phase 9, not before first use.

**Why.** `technical-constraints.md` has always said *"export must work before the
app is shown to a second person"* — which is the reveal, not the first usable
version. It was moved early in the Phase 6 list on an agent's caution rather
than because anything required it, and moved back.

The risk it guards against is real but not yet live: the free tier has no
backups and a paused project is eventually deleted. During the solo run the
paper log still exists as a fallback. The window where export genuinely matters
opens when the pen goes away, which is Phase 10.

**Trigger.** Before Phase 9. Getting a file off an installed iOS PWA is the hard
part, not the JSON shape.

---

## D-025 — Row actions: swipe reveals edit *and* delete

Dragging a row reveals two actions. **Edit** reopens the add sheet pre-filled.
**Delete** removes the moment.

**Amended 2026-09-06: the home screen's recent list only.** It applied to both
lists; the day table no longer swipes at all, on the owner's call — one place to
modify an entry, and it is the screen you are already on when you log one.
The day view spends the horizontal gesture on **moving between days** instead:
one screen, one meaning for a sideways drag, which is worth more than a second
route to the same sheet. Everything below still describes the gesture as it
behaves on the home list.

**Why this is recorded separately.** The Phase 2 handoff — final under D-021 —
has swipe-to-edit as a single action and **no delete affordance anywhere**. This
extends it, on the owner's call. D-021's reversal condition is real use, and the
coverage checklist has required *"an entry deleted after it was recorded"* since
Phase 0; the design simply did not cover it.

**Delete takes the whole moment, and its entries with it.** You swiped a row,
the row is a moment, `on delete cascade` does the rest. Removing only one part
of a moment is done through edit — the sheet already gives every block a `×` —
so both granularities exist without inventing new UI for the rare one.

**Delete is immediate, with an undo toast for a few seconds.** The row vanishes
at once and the actual delete fires when the toast expires.

This matters more here than in most apps. D-003 uses **hard delete** — no
tombstones, no soft delete — so once it is gone there is nothing to restore it
from, and the deletion syncs to the other phone. A confirmation dialog would be
safer but puts a modal in front of someone holding a baby at 4am, which is the
friction that sends people back to the pen. Immediate-with-undo keeps the action
one tap and still survives a mis-swipe.

**Amended 2026-09-03: both lists, not just the day view.** As first written this
said "the day view", and S8 built exactly that. The owner then reported the swipe
as broken four times running — he was swiping the home screen, which is where the
app is actually used and which had no gesture at all. Four fixes were shipped
against the day view, three of them on wrong diagnoses, before anyone noticed the
screens differed. The gesture now lives in one shared component
(`src/swipe/SwipeRow.tsx`) used by both, so the two cannot drift again.

**Reversed on the confirmation, 2026-09-04 (Q-012, closed by the owner).** The
second design delivery specified a bottom confirm sheet naming the entry, and
that is what ships. The undo toast is gone.

The original reasoning here — that a modal in front of someone holding a baby at
4am is the friction that sends people back to the pen — was sound but lost to the
stronger point: D-003 is a **hard delete with no tombstone**, it syncs to the
other phone, and there is nothing to restore from. A confirmation that names the
row back ("9/3 · 21:35 · 60(B) + 73(F)") turns an irreversible action into a
readable one, and costs one tap on an action taken rarely. `keep it` is the
wider of the two buttons, deliberately.

The rest of D-025 stands unchanged: two actions, both lists, delete takes the
whole moment.

**Consequence for the build.** The client holds a deleted moment briefly rather
than deleting straight away, so S8 owns the undo window, not just the delete.

---

## D-026 — The baby is the root, not a household

Four tables: `baby`, `device`, `timeslot`, `event`. A moment belongs to a baby.

**Why the change.** The model previously carried a `household_id` with no table
behind it — deliberately, because a household had nothing to store beyond its
own id. That made it a concept you had to hold in your head without anything to
point at, and it read as confusing rather than minimal.

A baby has a name. That earns a table, and it pays for itself immediately: the
app can display "Liana" instead of hard-coding her name in the UI, which the
Phase 2 handoff already assumed when it said the baby's name "lives in
settings".

**A sibling is a second row, not a second concept.** More likely for this family
than a second household ever was.

**`device` does not reference the baby.** A phone belongs to a parent, not to a
child; if a sibling arrives the same two phones log for both. The baby id lives
on `timeslot`, which is the thing actually about her.

**Table names are singular throughout** — `baby`, `device`, `timeslot`, `event`.
The earlier schema mixed plural `devices` with singular `timeslot`, which is the
kind of inconsistency that costs a moment every time a query is written.

**No `id` default on the client-written tables.** `device`, `timeslot` and
`event` have no `default gen_random_uuid()`. Those rows are always written by a
client that generated its own UUID, which is what makes replay idempotent. A
server-side default would quietly mint an id the client does not know, producing
a row it cannot match on retry — a silent duplicate instead of a loud not-null
error. `baby` keeps its default, since it is created once through the API.

---

## D-027 — The day view gets the prototype's period picker

The date strip only ever holds pills for days that already have entries, so any
day beyond that handful had **no route to it at all**. The Phase 2 prototype
solved this and the app skipped it: a `more` pill closing the strip, opening a
`pick a period` sheet with presets, a month grid, and a from/to range.

Built as the prototype has it, including the details that carry the weight:

- **A dot on every day that has entries.** Choosing a range is guesswork without
  it — the whole point of the screen is finding data you already recorded.
- **Future days are disabled.** There is nothing there and never will be.
- **Tapping backwards flips the ends** rather than rejecting the tap. At 4am a
  rejected tap reads as a broken app.
- **The range wins over the day pills** while it is set, and tapping any pill
  clears it. One selection is in force at a time.

**It also fixed a wrong number.** Totals were computed for a single day, so the
`all days` view showed *today's* totals under an "all days" heading, and a range
could not be totalled at all. `totalsOf` now totals whatever is on screen, and
`totalsFor` is a thin wrapper on it.

**Also in this pass: the tab bar matches the prototype.** The FAB had been raised
28px out of the bar, putting it on a different line from the two tab icons and
floating it over the last row of the day table. The prototype centres all three
and sizes the FAB up instead (72px against 56px), with the bar at 10/18/22px.
Page bottom padding grew to match the taller bar — verified as 33px of clearance
below the last row on both screens, rather than by eye.

---

## D-028 — The tab bar belongs to the two main screens only

It is hidden whenever a full-screen overlay is open: the add/edit sheet, the
period picker, the delete confirm sheet.

**Why this needed deciding rather than patching.** Once the shell became a flex
column (see `docs/status.md`), the bar stopped being a fixed overlay and became a
row at the bottom of the column. A sheet scrolled to its end then put the save
button at 756–812 inside the bar's band of 740–844 — **56px of overlap on a 56px
button** — and an edit could not be saved at all.

Growing the sheet's bottom padding past the bar's height would have hidden the
symptom. The bar navigates between *log* and *day*; a sheet is neither, so it has
no business being on screen at all while one is open. That also removes the whole
question of which paints on top, which is not worth relying on across browsers.

**How.** `src/overlay.ts` is a counted store — every overlay marks itself on
mount and unmarks on unmount, and `App` reads it through `useSyncExternalStore`.
Counted rather than boolean so a confirm sheet opened over a picker cannot leave
the bar hidden when only one of them closes.

---

## D-029 — Sleep is a first-class type, and "still asleep" is a missing end time

The third design delivery promotes sleep out of the `other` list. It gets its own
bubble beside milk and diaper, its own block, and a quick icon in the bar.

**An open sleep is a timeslot with a `sleep` event and no `ended_at`.** The
design stores an end time on the sleep entry itself; our model has always put it
on the **timeslot** (D-020), shared by everything in the moment, so there is
nothing to add. That is also what makes an open-ended sleep expressible without a
flag: no end time means still asleep, the same blank-means-unknown rule the milk
volume already uses.

**Only the latest timeslot counts.** The rule as the owner stated it, and it
matters more than it sounds. Scanning every open sleep instead — which the design
implies — made every sleep recorded before this feature existed read as still
running, and the bar reported a live "30h 58m" against his real log. Anything
logged after a sleep means she woke; the sleep is over whether or not anyone said
so.

**Logging anything else closes it**, stamping the new entry's time as the end.
At 4am you log the feed, not the waking. This too is scoped to the most recent
timeslot: reaching back to stamp an end on an older sleep would be inventing
data.

**That close runs from the save path, not from `logMoment`.** It writes to a row
its caller never named, and burying that in the write primitive meant anything
logging a moment mutated unrelated data — `verify-s2` syncs the live database
first, so **running the test suite could have ended a real sleep in progress.**
It surfaced as an unstable outbox count and was a genuine hazard, not a flaky
test. Primitives write what they are given; product rules belong above them.

**The derived text is not stored.** The design writes `sleeping…` and
`slept 1h 20m` into the entry's note. We compute both from `occurred_at` and
`ended_at` at render time, so the note stays what the user typed and editing a
time cannot leave a stale sentence behind.

**The bar is contextual.** Home carries the quick-add row — feed, diaper, sleep,
then `+` — with the report icon on the right; while a sleep is running the sleep
icon becomes an "end sleep" pill showing the live duration, because offering
"log a sleep" mid-sleep is the wrong verb. The day screen is a read-back and
carries no add actions at all, only a way back.

**Not taken from this delivery:** the day/night mascot variants (the `-2` art set
for the day theme), the bespoke crescent-and-arrow SVG for end-sleep — it uses
Material's `wb_twilight`, matching every other icon in the app — and
`liana-appicon.png`. All are available in the handoff if wanted.

---

## D-030 — Two art sets by clock, and a gate before the welcome

**The mascot has a day set and a night set.** Night keeps the girl; day is the
plush, drawn landscape against a soft ground. It is not a recolour but a
different character, and it letterboxes inside the same 108px box on
`object-fit: contain` — which is what the prototype does with it too. The set is
chosen by `themeFor()`, the same clock that picks the palette (D-021), and the
home screen passes its theme in explicitly so the art turns over with everything
else rather than on the next unrelated re-render.

**First run is two pages: a gate, then the name.** The gate asks for a secret
code — "when did you first time to meet me" — and refuses anything else.

**The gate is a doormat, not a lock, and this is worth being plain about.** The
repo is public (D-008) and the built bundle carries the code in plain text, so
anyone who opens dev tools is past it in seconds. What it buys is that a stranger
who stumbles onto the URL cannot type into the real log by accident. That is a
real problem worth solving and this solves it; it is not authentication and
nothing should be built on it as if it were. Data isolation remains the
post-MVP item it always was — one anon key, no RLS separating families.

It does not breach *"never require a login to log an event"*: the gate runs once
per install, before any identity exists, and no event has ever been logged behind
it. The code lives in one named constant in `Welcome.tsx` so changing it is a
one-line edit.

**The gate leads with a photograph of Liana**, `assets/liana-photo.png`, which
was absent from the first drop of this package and arrived in a later one.

It renders **before** the code is entered, so it is what anyone holding the URL
sees — the gate protects the log, not the picture. Raised with the owner and his
call: use it as designed. Worth restating here so a later session does not
"discover" it as a bug and quietly move it behind the gate.

Shipped as WebP with a **JPEG** fallback, not PNG: it is a photograph, and PNG
cost 1.8MB against 258KB for the same picture. Both are excluded from the
offline precache, along with the `-day` set, which the earlier `globIgnores` list
had silently stopped covering as new art was added — it named only the night set
by hand.

**Consequence for the suites.** Seven browser suites bootstrapped by filling the
name field, and all of them stalled on page one at once. `scripts/ui.mts` now
owns that path, so the next change to first-run costs one edit rather than seven.

---

## D-031 — A typed time keeps its own day

Two bugs in `withHourMinute`, both filing entries on the wrong date, both found
because the owner logged a sleep and it landed on the wrong day.

**The day comes from the moment being edited, not from today.** It always
anchored to the current date, so opening a feed from three days ago and nudging
its minute dragged it to today. Silent, and worse the older the entry.

**A time slightly ahead of now no longer falls back a day.** The tolerance was
**one minute**: at 09:40, nudging the minute to 09:42 read as "the future", so it
filed the entry on *yesterday* at 09:42. Any forward correction moved the day.

The rule this protects is real — 23:45 typed at 00:30 means last night — but it
needs a gap, not a hair. Six hours keeps the midnight case (23 hours ahead) and
leaves ordinary correction alone.

**This reverses a decision the tests encoded.** `verify-s5` asserted "a time
later today is read as yesterday — a moment cannot be in the future". Strictly
true, and wrong in practice: at 08:00, reading a typed 09:00 as *yesterday*
09:00 moves it 23 hours to avoid being one hour ahead. A slightly future time is
visible on the screen and takes one tap to fix; a 23-hour error is neither.
The falling-back rule now applies only to a moment being logged today.

---

## D-032 — The insights screen is allowed to assess

The third design handoff's report screen does something the app has never done:
it judges the data. A **worth a look** card fires on four fixed rules, and the
wet-diaper figure turns amber below six a day.

`CLAUDE.md` forbade exactly this — *"Do not generate health advice, normal-range
judgements, or anything that implies a reading is concerning. The app records; it
does not assess"* — and named `docs/plan.md` Phase 7 as its authority. The
conflict was raised before any of it was built. **The owner chose the handoff,
deliberately and with the rule in front of him.** That is the decision; this
entry exists so the next session does not reopen it as an oversight.

**What is now allowed, and only this.** Four rules, all thresholds fixed and
visible in `src/report/insights.ts`:

- a complete day with fewer than 6 wet diapers
- more than 24h since the last poop
- a within-day gap of 3h or more between feeds (was 5h — see the amendment below)
- today projecting 20% or more under the running average

Plus the wet-diaper average rendered against the same 6-a-day mark.

**What is still forbidden, unchanged.** Growth percentiles. Anything comparing
this baby to a population. Advice on what to do about a flag. Any suggestion
that a reading is medically concerning rather than numerically unusual. The
mascot remains descriptive — none of this reaches her, and she does not react to
a flag. The rules count what was logged and say so; they do not diagnose.

**Why the line sits there.** The four rules restate the parent's own data back to
them — "9/6: 4 wet diapers" is a fact they wrote down. What made the original
rule right was the fear of an app that *emotes disapproval at 4am*, and a card
listing counts does not do that where a worried mascot would. The distinction
worth keeping is between surfacing a number and passing judgement on the person.

**Today is never flagged.** Every day-level rule skips the current day, which is
still filling up. Without that, the wet-diaper rule fires every morning on every
day, and a warning that is always on is not a warning.

### What it actually does on the real log

Measured 2026-09-05 by loading the ten transcribed paper-log days behind the
screen. **The card fired six times across seven days**, and the result is worth
knowing before deciding this rule set is finished:

- **Five of the six are the same rule.** The paper log records 3–5 wet nappies
  on most days against a threshold of 6, so on this data the card is close to
  permanently lit — the exact failure the "today is never flagged" rule above was
  written to avoid, arriving by a different route. Whether that reflects the
  baby or reflects what gets written down at 4am is the owner's call and nobody
  else's.
- **The sixth was an artifact of a hole in the record.** *"10h 10m between feeds
  on 8/30"* came from the two unreadable 8/30 afternoon rows sitting commented
  out in `supabase/imports/2026-09-05_paper-log-backfill.sql` § 6. Restore them
  and the gap is about three hours. **A rule firing on a gap in the record is
  indistinguishable on screen from one firing on a gap in the feeding.**

Nothing was changed in response. This is recorded rather than acted on because
the thresholds are the owner's, and because the next person to look at this card
should not have to rediscover it. If it is ever tuned, the cheapest levers are
the threshold itself, or requiring a minimum number of diaper entries before a
day is eligible for the wet rule at all.

### Amended 2026-09-05 — the feed gap moved to 3h

**The gap rule now fires at 180 minutes, not 300.** The owner's call, made
alongside the same move on the mascot's *hungry* state, and the two now sit on
one number: three hours since a feed is what the app treats as long, whether it
is describing this moment on the home screen or counting a past day on the
report.

**This makes the gap rule fire far more often, by design.** A feed every three
hours on the dot flags — the comparison is `>= 180`, matching the mascot — and
newborn feeding at that interval is ordinary, so on a typical day this rule is
now closer to lit than to quiet. That is the same *always-on warning* failure the
measured note above describes for the wet-diaper rule, arriving on a second rule.
It is not an oversight: the owner set the number knowing the mascot uses it. If
it is tuned again, the boundary itself is the lever — `> 180` would exempt the
exact three-hour rhythm and change the character of the rule considerably.

**The count of rules is unchanged.** Still four, still fixed, still no fifth.

---

## D-033 — A running feed is a missing end time, exactly like a sleep

The third handoff's §11 gives feeds the live tracking sleep already has: while
one is running the bar's bottle becomes an "end feed" pill with the duration on
it, the top card carries a `<duration> feeding` line, Liana's state is
**feeding**, and `fed 25 min` reads back on the row once it is over.

**It stores nothing new.** An open feed is a timeslot with a feed event and no
`ended_at` — the same rule, the same field, as D-029's open sleep.

**The design implies otherwise and is not followed.** The prototype keeps a
`feeding: true` flag on the entry, and a first pass here added a matching
`event.in_progress` column with a migration behind it. That was wrong, and the
owner rejected it: **the timeslot already carries the end time for every type
(D-020).** A second field expressing the same fact in different words is exactly
what D-020 removed from sleep, and re-adding it for feeds would have reintroduced
the failure mode that decision exists to prevent — a duration that is right in
one view and wrong in another. Claude Design's prototype is a source for the
*interaction*, not for the data model; where the two disagree, the model wins.

**The asymmetry that remains is in the auto-close, not the state.** Logging
anything else ends a running **sleep**, stamping the new entry's time as its end
— at 4am you log the feed, not the waking, so the next entry is the best evidence
there is. A running **feed** is not closed that way. The next diaper says nothing
about when the bottle finished, and writing that time in would invent a duration
nobody observed, into a model with hard deletes and no revision history (D-003)
to recover it from. The feed simply stops being the latest moment and stops
reading as running. No write, so nothing to be wrong later.

**The bar swaps the bottle, exactly as it swaps the moon.** While a feed has no
end time the quick-feed icon becomes the handoff's pill — `timer_off` on
`--roseFill`/`--roseDeep`, 40px, carrying the running duration — and tapping it
stamps the end. An unfinished feed's useful verb is "end it", not "log another".

**The consequence, stated because it is not small.** Since the state is derived,
an ordinary feed logged after the fact also reads as running, so the quick bottle
is unavailable until it is closed or something else is logged; a second feed goes
through the `+` button, which reaches every type. This was tried the other way
first — bottle always present, ending only on the card — and the owner chose the
swap. It is the design's behaviour, and closing the feed is the thing it is
asking for. `verify-feed` covers both halves: the pill replaces the bottle, and
the `+` button still reaches milk while one is open.

**So the only thing that ever ends a feed is a person saying so** — the bar pill,
the card button, or an end time typed into the time card. `endOpenPeriod` handles
all four of those controls and does not care which type it is closing, because stamping
`ended_at` is the same write either way; `closeOpenSleep` stays narrow and is
what the save path calls.

**What this costs, stated plainly.** A feed logged the ordinary way — after the
fact, with no end time — reads as running until something else is logged. On a
log where the pen is picked up afterwards that will happen often. It is
cosmetic: nothing is stored, the elapsed hero already reads 0m at that instant
for the same reason, and the state clears itself. The alternative cost was a
column, and the owner judged this the cheaper of the two.

**Reversal condition.** If the transient "feeding" state proves annoying in real
use, the fix is in `ongoingFeed` alone — a bound on how long a feed may read as
running, derived from the data rather than stored beside it.

---

## D-034 — The milk column reads in words, not the paper's codes

`45 mL formula`, `25 mL breast + 45 mL formula`, `30 mL + 30 mL`, `? mL`. The
`(B)` / `(F)` short codes the paper uses are gone, from the day table, the home
row, the delete confirmation and the day-summary chips — §12 of the third
handoff.

**Why it is worth recording.** The read-back was a transcription: `milkCell`
copied the paper's own notation so the acceptance test could be "hold the phone
next to the photograph and compare". Spelling it out ends that. What the codes
carried is all still there — which source, and that a split feed is two volumes
— and the fact the app must never lose (an empty cell and a `?` mean different
things) is untouched.

**What it costs, stated so nobody rediscovers it.** The day table's milk column
is about 140px and a split feed now wraps to two lines in it. The prototype's own
table wraps the same way at the same width, so this is the design's choice rather
than a porting mistake.

**And where it was too long to use.** The top card's combined and mascot leads
have a one-line figure slot that `25 mL breast + 45 mL formula` overflows, so
those two take a new `milkTotal` — one figure, `70 mL`, or `90 + ? mL` where a
part was unknown. Carrying the unknown rather than dropping it keeps `90 + ?`
distinct from `90`, which is the same distinction the column exists to preserve.

---

## D-035 — The mascot's clock depends on what the last feed was

Breast milk empties faster than formula, so *"three hours since a feed"* means
two different things depending on the feed. The mascot's thresholds now split by
source:

| Last feed | awake | hungry |
| --- | --- | --- |
| Breast milk | 90 min | 105 min |
| Everything else | 120 min | 150 min |

The owner set every number here. **Both hungry lines moved on 2026-09-06**, from
120 and 180 to 105 and 150; the awake pair is unchanged. What that does is
shorten the awake band on breast to fifteen minutes, so after breast milk she
passes through *awake* quickly and spends most of the gap reading *hungry*.

One consequence worth having written down: the two clocks are now far enough
apart that the same elapsed number can land two states apart. At 105 minutes
breast is already hungry while formula has not yet reached awake.

**"Everything else" is the conservative default, and it is deliberately wide.**
Formula, a feed with no source recorded, a moment with no feed in it at all, and
— the case worth naming — a **mixed feed**. `25 mL breast + 45 mL formula`
(D-034) is one moment carrying two feed events, and it reads as *other*: only a
moment whose every feed part is breast milk gets the faster clock. Erring toward
the longer hold means the app is late to say hungry rather than early, which is
the right way round for a state a parent may act on.

`feedKind` in `src/derive.ts` is the whole rule, and it takes the same moment the
card already uses for the last feed — nothing new is stored, and nothing new is
asked of the person logging. A feed logged without a source needs no more than
it ever did; it simply sits in the slower row.

**What did not change.** The night override still outranks both clocks: night
theme plus a gap over an hour reads as *sleeping* whatever the source, so this is
a daylight distinction. The states themselves are untouched, and so is the tone
rule — *hungry* remains descriptive, and she still does not nag.

**The insights feed-gap flag did not follow this split.** It stays at a flat 3h
(D-032, as amended). That rule counts a past day's largest gap without asking
what was in the bottle, and giving it a source would mean deciding what a day of
mixed feeding is measured against — a question nobody has asked yet.

---

## D-036 — Three of the secondary types take a value; the target is a flat number

Two owner calls from the same session, unrelated except that both are numbers he
had in his head and the app did not.

### The fields

`weight`, `temperature` and `supplement` now have inputs. They used to be five
identical rows behind `other`, with the answer "pick one, write the rest in the
note" — which was right when nothing could be counted and wrong once he wanted
to record a weight.

- **Weight is typed as a decimal number of pounds; temperature is °F.**
  Amended 2026-09-06 — see below. It shipped as kg into the schema's `grams`
  and °C, which was the model's unit rather than the user's.
- **Temperature is one field.**
- **Supplement asks two things** — what, and how much — both free text, because
  "1 drop" and "0.5 mL" are both real answers and neither is a number. **Both
  arrive filled in with `Vitamin D` / `1 drop`** (2026-09-06): it is the one
  supplement this app is used for, the same two words and the same dose every
  time, so typing them is pure cost. A suggestion, not a claim — `preset` marks
  it and focusing a field selects what is in it, so the first character typed
  replaces the whole thing rather than landing inside "Vitamin D". Reopening a
  stored supplement never sets that flag; there the value is a record, and a
  tap in the field must not wipe it.
- **Weight and temperature get no prefill**, deliberately. There is no number
  that is right more often than any other, and one saved by accident is a false
  reading rather than a mild annoyance. The quick bottle's 60 mL survives the
  same test because a volume typed over costs one digit; a body temperature
  nobody noticed was wrong costs more.
- **`spit up` and `something else` still carry nothing.** Neither has a value to
  capture; their detail is the moment's note, exactly as before.

**Blank is allowed and means what it means everywhere else here.** A picked type
with no number saves, and reads back as the bare word — the same rule the milk
volume's `?` has always had (D-018). Requiring a value would make the app unable
to record a weighing where nobody caught the number, which is a thing that
happens.

**Every field is held as a string until save.** `3.` is a legal thing to be
halfway through typing and a number-typed input eats the decimal point as fast
as it is entered — a failure that passes every unit test and is unusable in the
hand. `verify-other` types a decimal into a real browser for that reason.

**This is Q-006 being answered by decision rather than by the solo run**, which
is the second time that has happened (sleep was the first, D-029). Recorded
plainly: three of the four remaining types got an input because the owner asked
for one, not because observed use asked for it. `spit up` is still open, and the
question still closes the way it says.

**The read-back lives in one place.** `otherLabel` in `src/day/cells.ts` is what
both the day table and the home screen's recent list print. The list had its own
inline copy that printed the bare type name, so a weight read `weight` there and
`weight 3.4 kg` in the table — the same split that once hid an end time from
this list until `timeCell` replaced its local formatter.

### Amended 2026-09-06 — weight and temperature are US units

The app is used in the US. A scale reads pounds and a thermometer reads
Fahrenheit, and converting in your head at 4am is exactly the cost this app
exists to remove. Migration **`0003`** adds `event.pounds` and
`event.fahrenheit`.

**The columns store what is typed; no conversion at the edges.** The other way —
keep `grams`/`celsius` and convert on save and display — needs no migration, and
was rejected because it rounds: 98.7°F stores as 37.1°C and reads back as
98.8°F. A recorded reading that changes when you look at it is the failure D-020
exists to prevent, one fact being right in one view and wrong in another.

**`pounds`, not `ounces`.** The owner's first answer named ounces, on the
assumption of two boxes — `7` and `4`. He then chose a **single decimal field**
instead, and pounds is what makes that lossless: `7.25` in, `7.25` stored, `7.25`
back when the entry is reopened, and `7 lb 4 oz` on the row. Whole ounces as the
stored unit would round a typed `7.3` to 117 oz and hand back `7.3125`.

**The lb + oz form is display only.** `poundsToLbOz` rounds to whole ounces —
a scale says 4 oz, not 4.0 — carries sixteen into the pound rather than printing
`7 lb 16 oz`, and drops the ounces entirely on an exact pound.

**`fahrenheit` is `numeric(4,1)`**, not the `(3,1)` the celsius column used.
That caps at 99.9, so the old column could not have held an ordinary 100.4
reading even renamed.

**The migration is additive and the old columns stay.** Two phones run this app
and the service worker updates lazily, so during a rollout one of them is still
on code that writes `grams`. Dropping it would break that phone's sync until it
happened to update. Nothing reads or writes the pair after this; dropping them
is a separate, later, deliberate step. A weight written before `0003` would
therefore read back as the bare word `weight` rather than a number in the wrong
unit. **No such row exists**: the database held 88 feeds, 78 diapers, 13 sleeps
and one `other` when this was written, and not a single weight or temperature.
The old columns are being kept for the rollout, not for data.

**This blocks a deploy, which is what `supabase/README.md` warned about and this
is the first time it has come true.** Sync pushes whole rows, so the migration
has to run in the SQL Editor *before* the code that writes these columns is
deployed. `verify-s2` and `verify-s8` are red until it does, by design.

### The target for the next feed

The top card carries a **target wake time**: the last feed plus three hours, or
plus four when that feed landed between 22:00 and 06:00.

**Flat, and deliberately not the mascot's breast / formula split (D-035).** The
owner chose that with the split in front of him. The two answer different
questions — the target is what he is aiming at, the mascot's *hungry* is a
description of the baby — and they are allowed to disagree on the same card.

**Sharpened 2026-09-06 — the target is a ceiling, not an appointment.** *Answer
different questions* was as far as this entry went, and it is too loose to
defend the flat number. The owner's own framing is tighter: the two numbers are
the ends of one range.

| | What it is | Direction |
| --- | --- | --- |
| The mascot's *hungry* | earliest — she is ready | a **floor** |
| The target wake time | latest — do not go past | a **ceiling** |

Hungry is not an instruction to feed her now. A baby sleeping deeply can be left
a while longer, and the target is what says how much longer. Between the floor
and the ceiling is the parent's judgement; the card's job is to show where the
two ends are, not to close the gap.

**Which is why the ceiling must not follow the source.** If it moved with the
floor, the room between them would be a fixed width and the target would have
stopped saying anything the mascot did not already say. Held flat, that room
varies — which is the whole of its value:

| Last feed | Floor (*hungry*) | Ceiling (target) | Room to wait |
| --- | --- | --- | --- |
| Breast milk | +1h 45m | +3h | **75 min** |
| Everything else | +2h 30m | +3h | **30 min** |

After breast milk she signals earlier, so there is more room to let her sleep;
after formula she signals later, so there is less. That difference is *produced*
by the ceiling staying still. **Splitting the target would flatten it.**

**So the overlap is not a bug, and an agent will read it as one.** From 1h 45m
after a breast feed the card draws Liana hungry while the wake line still says
`in 1h 15m`, and that looks like one card making two claims. It is not — it is
the window, and it is the answer to the only question being asked at that
moment: how long can I leave her? A proposal to close that gap by giving the
target a breast / formula split has already been reached for twice on those
grounds. It is wrong for the reason above, and this paragraph exists to stop a
third.

**The tone rule is untouched by the reframing.** A ceiling is a thing that can
be passed, and the line still only says how far past it is — no alarm, no
colour change, no view about it (CLAUDE.md). *Do not go past* is the model the
number is built on, not a sentence the app is allowed to say.

**The wording followed, the same day.** The line read `wake ~15:00 · in 1h 15m`,
which is an appointment: a thing scheduled to happen at 15:00, counted down to.
It now reads `by 15:00 · 1h 15m left`. Same instant, same number, and the only
change is which question it answers — *how long can I leave her* rather than
*when does she wake*. `wake ~` was also a small untruth in its own right: the
app has no idea when she wakes, and the tilde was carrying that.

**Past the ceiling it says `1h 10m past`** — not `over`, not `late`, not `ago`.
`ago` belonged to the appointment reading and describes the clock time rather
than the room; `over` and `late` both carry a verdict, which is the line the
mascot is already held to. `past` is the distance and nothing else.

**The window is judged on the last feed's own clock time, not on the target it
produces.** A feed knows which side of ten o'clock it happened on the moment it
is logged, so the answer never changes underneath a card already showing it.
Deriving it from the target would make a 21:00 feed's target depend on the
target: +3h lands at midnight, which is inside the window, which would argue
for +4h.

**It is hidden while a feed is running.** The reason changed under it and the
behaviour did not. It counted from where a feed *ends*, so during one the line
would have ticked and been wrong the moment the feed closed — that was a
constraint. Since D-040 it counts from the start, so the target is known and
settled from the feed's first second and could be shown throughout. **The owner
kept it hidden anyway:** while she is on it the running-feed line is the point,
and the ceiling is not yet the question being asked. A choice now, not a
limitation.

**It sits outside the three leads**, under whichever one is showing, because the
rail chooses which summary the card leads with and this is wanted under all of
them. Descriptive as everything else on that card: the clock time and how far
off it is, with no view about it — past the target it still only says how far
past.

### Amended 2026-09-06 — a bottle prompt under the target

A second line, **make a bottle**, appears fifteen minutes before the target and
sits under the wake time. Fifteen is roughly what warming one takes, which is
the point: knowing the feed is due is not the same as having the bottle ready
when it is.

**It does not clear at the target — it clears when a feed is logged.** A prompt
that vanished exactly when the feed came due would go at the moment it is most
wanted. And nothing clears it explicitly: the target is derived from the last
feed, so logging one pushes the target hours out and the line falls away on the
same render. No flag, no stored state, the same rule the open feed and the open
sleep already follow (D-033).

**Its own row rather than folded into the wake line.** The two are independent
facts, and the card already stacks lines this way for a running feed and an open
sleep. It takes `local_drink`, the app's milk icon everywhere else, and the rose
accent that goes with it — the wake line keeps amber.

**Display only.** It is a reminder, not a record: there is nothing to tap,
nothing to dismiss, and the app never learns whether a bottle was made. That is
what keeps it on the right side of the tone rule — it names a task at a time,
and has no opinion about whether anyone did it.

**Where it is silent.** With no target at all, which includes while a feed is
running — the same condition that hides the wake line.

---

## D-037 — The day view swipes between days, not into a row

The read-back's horizontal gesture used to reveal edit and delete on a row
(D-025). It now moves the whole page to the day before or after, and the row
actions are gone from that screen entirely.

**One screen, one meaning for a sideways drag.** Two gestures on one axis, on
one page, is how a swipe meant for the page opens a row instead. Modifying an
entry lives on the home screen alone now — which is the screen you are already
on when you log one, so the second route was reaching for the rarer case.

**Only days that have entries.** `stepDay` walks `daysWithEntries`, so a swipe
skips the gaps and never lands on an empty table. It is the same set the date
pills offer, which means the gesture and the pills cannot disagree about what
exists.

**Left is older, right is newer**, and neither end wraps. A log has a first day
and a most recent one; looping past either would be a lie about the data.
`daysWithEntries` is newest-first, so *older* is `+1` — the inversion is why
`stepDay` is a named function in `period.ts` rather than an index sum inside the
component, where `days[here + 1]` reads as the opposite of what it does.

**Inert where stepping has no meaning.** `all days`, a picked period, and the
insights mode are deliberately not one day, so the listeners are not attached at
all rather than attached and ignored.

**Two pages on a track, dragged as a pair.** It shipped with no movement at all
— the argument was that a day change is instant, so a transform would animate
something about to be replaced — and the owner asked for movement the same day.
He is right about what it buys: a gesture with no feedback is one you cannot
tell you have started, and the threshold is invisible.

**The first attempt at it was half the effect and looked it.** It slid only the
outgoing page, damped, and then played a separate slide-in on the replacement.
The owner's words: *"I don't see the animation which making it looks like
targeted page to be moving in."* Two movements where there should be one. What
it does now is what every phone does between pages: the day you are reading and
the day you are dragging toward sit side by side on a track, and the track moves
**one-to-one with the thumb**.

What moves is the day being read — the label, the totals, the table. The mode
pills and the date strip are chrome and hold still. **At either end of the log
there is no page to mount**, so the track barely gives (0.12, capped at 18px)
and the edge of the log is something you feel rather than read. Letting go short
of the threshold glides back; past it, the track finishes its travel and the
neighbour becomes the current page with no second animation.

**Three things that had to be got right, each of which was silently wrong
first:**

- **`.day` was shrink-to-fit.** `#root` is a column flex container, and an auto
  cross-axis margin cancels the default stretch — so `margin: 0 auto` alone left
  the screen's width determined by its longest table row. Harmless with one page
  on screen; fatal with two, because `flex: 0 0 100%` then resolves against a
  width the pages themselves set. `width: 100%` fixes it, and the day table is
  full-width now where it used to be as wide as its content.
- **`transitionend` bubbles.** A pill or a row finishing its own transition
  inside the page settled the track early, mid-slide. It is filtered on
  `e.target === e.currentTarget` and `propertyName === 'transform'`.
- **`prefers-reduced-motion` removes the transition, so `transitionend` never
  fires** — and the landing is what changes the day, so with less motion asked
  for the day would never change at all. A 400ms timeout lands it either way,
  and `verify-period` runs a swipe under `reducedMotion: 'reduce'` because that
  failure is silent and total.

**Adding it broke the gesture, in a way worth recording.** Callers pass inline
arrows for `onPrev`/`onNext`, which are new objects every render. That was
harmless while the hook rendered nothing — but reporting the live offset
re-renders on every `touchmove`, so an effect keyed on those callbacks tore
itself down and re-attached mid-drag, losing the gesture's start point. The
swipe then did nothing at all. They live in a ref now and the effect depends on
neither. `verify-period` caught it, which is the only reason it is a footnote
rather than a bug report from a phone.

**What it does share with `SwipeRow` is the gesture rules**, which took four
attempts to get right on iOS: native listeners rather than React's, because
React attaches `touchmove` passively and the handler must call
`preventDefault`; the axis decided on 10px of accumulated travel rather than the
first pixel, because a thumb arcs and a first-pixel lock reads a real finger as
a scroll while passing every machine-straight test; and `touch-action: pan-y` on
the page so iOS does not claim the drag for its own back-navigation first.

**The date strip keeps its own drags.** It scrolls sideways, and reaching `more`
means dragging it. It carries `data-noswipe` and the hook ignores any touch that
starts inside it.

---

## D-038 — One tile per thing, and a bottle that looks like a bottle

Three changes to *what just happened*, all the owner's, all the same shape: the
sheet should say one thing per tile.

### One milk tile

The milk bubble used to repeat. The reading was that D-019's split feed is two
milk blocks in one moment — but the milk card holds **two parts and has its own
`+`** for the second, so one tile already captures the whole feed. A second tile
was a second way to say the same thing, and the one that made the moment harder
to read back.

Nothing else repeats either, except `other`: a moment can carry a spit-up and a
something-else at once and neither has a tile of its own.

### Weight, temperature and supplement each get a tile

They were three of five rows behind `other`, which meant three taps to reach a
thing that captures a value. Sleep left that list for the same reason (D-029),
and this is the same move on the same argument.

What is left behind `other` is the escape hatch proper — `spit up` and
`something else` — neither of which has a value to capture. `OtherDraft` is back
to carrying just the kind; the three that carry fields have drafts of their own,
which is what made `blockIsEmpty` honest: **only milk, diaper and `other` can
say nothing.** The rest say everything by being there, exactly as sleep does.

One component with three configurations, not three files. They differ only in
what they ask for. The single-field tiles do not print a field name — the header
already says `weight`, and repeating it 40px below is the same word twice — and
supplement does, because `what` and `how much` are the only thing telling its
two boxes apart.

### A bottle that looks like a bottle

The end-feed control wore `timer_off`, then `local_drink` — a paper cup with a
straw, which the owner read as a milk *cup*. Material Symbols has bar glasses
and a coffee cup and **no baby bottle**, so it is drawn, like `EndSleepIcon`
before it and for the same reason. Same contract: 2px stroke, `currentColor`,
so it inherits whatever its button sets.

**And it is lavender now, not rose.** Rose is the app's milk colour and at
button size on a cream card it reads as an alert — the owner's word for it was
red. Lavender is still in the milk family (it is the breast tag) and sits
quietly beside the periwinkle end-sleep button rather than shouting past it.

Weight and temperature take amber, supplement keeps lavender. Seven bubbles with
seven colours would have made a row that no longer reads at a glance, so the
three that came out of `other` share its half of the palette.

---

## D-039 — The schema is additive-only; a column is never dropped

**Supersedes the ordering rule in `supabase/README.md`**, which said dropping a
column was safe as long as it happened *after* every phone was on code that had
stopped naming it. That rule is sound and unenforceable, and `0004` is the proof.

`0004` dropped `event.grams` and `event.celsius` — dead since `0003` replaced
them with `pounds` and `fahrenheit`, never having held a single value. It ran
before the deploy rather than after it, which the commit and the README both
recorded as a known window that would close as each phone updated.

It did not close. Later the same day the owner found the second phone showing a
red sync dot, on a working network, and **could not reach that device to update
it.**

**Why the ordering was never enough.** It assumes every client can be brought
forward on demand. Nothing here can bring one forward:

- the service worker updates lazily and only when the app is visible and not
  mid-entry (`registerType: 'prompt'` in `vite.config.ts`; the add sheet holds
  the update open — `src/updates.ts`),
- there is no forced update, no kill switch, and no login to gate one behind
  (a login is a non-negotiable *no* — `CLAUDE.md`), and
- the second phone belongs to the other parent. "Open the app so it updates" is
  a message that may be read in the morning.

So "after both phones are on the new build" is not a step. It is a hope with no
observable moment, and a drop run against it is a coin toss whose losing side is
a phone that quietly stops syncing.

**What it costs when it loses.** Sync pushes whole rows, so a client naming a
column that no longer exists fails every upsert. `push()` returns false, and
because the outbox is now non-empty the reconcile is skipped — by design, so the
wholesale replace cannot erase unpushed writes (`src/sync.ts`). The phone shows
red and holds everything locally. Nothing is lost, the outbox is durable, but a
3am feed logged on that phone is invisible to the other parent, which is the one
job two-device sync has.

**And the red is ambiguous, which is the part that cost the diagnosis.**
`.sync.offline` and `.sync.error` are the same colour, so a schema mismatch is
indistinguishable from a dead network at a glance. The owner reasonably read it
as being offline, and was not.

**The rule.** Additive only. Never drop a column, never narrow a type, never add
a constraint an older row could fail. A superseded column is left in place,
nullable, commented dead, and forgotten. Two nulls on a table projected at 5 MB
a year, against a 500 MB free tier, is not a cost worth a phone's sync.

**Why the fix was a migration and not a deploy.** `0005` restores both columns.
It is the only repair that works on a device nobody can touch: the server starts
accepting the old build's rows again, and that phone drains its outbox on its
next foreground with nobody doing anything to it. A deploy would have fixed only
the phones that took it — the ones that were never broken.

**Reversal condition.** A client that can be proven current — a version check
the server can see, or a client that refuses to sync until it has updated.
Neither exists, and neither is worth building to reclaim a nullable column.

---

## D-040 — The last feed is when it started, not when it finished

`lastFeedAt` returned `ended_at` where a feed had one. It now returns
`occurred_at` always. Three things move with it, because all three read that one
function: the **elapsed hero**, the **mascot's thresholds** (D-035), and the
**target wake time** (D-036).

**Feeding is counted start to start.** *Every three hours* means three hours
between the beginnings of two feeds, not three hours of empty stomach between
the end of one and the start of the next. The old rule made a long feed buy
itself extra time without anyone deciding to give it: a 40-minute feed pushed
the hero, the mascot and the ceiling 40 minutes further out than a 5-minute one
that started at the same moment.

**It replaces the opposite reasoning, which was written down and was wrong.**
`lastFeedAt` used to say that "what a tired parent means by *since the last
feed* is since she finished, not since she started". That is a fair description
of a stomach and a poor description of a schedule, and the target is a schedule
— a ceiling (D-036). The two questions had been collapsed into one function and
answered in the stomach's favour.

**The app already disagreed with itself about this.** The insights screen has
always measured its feed gaps from `occurred_at` (`report/insights.ts`), so a
gap the report called 3h the home screen could call 2h 20m for the same two
feeds. The home screen was the odd one out, and it is the one that moved.

**What visibly changes.** For an instant feed — no end time, which is most of
them — nothing at all. Where a feed has a duration, the hero's figure grows by
that duration, the mascot reaches *awake* and *hungry* that much earlier, and
the ceiling lands that much sooner. The overnight window is now judged on the
hour the feed **began**.

**`lastFeedMoment` orders by the same field.** It sorted by `ended_at` where
there was one, which can pick a different moment than the new `lastFeedAt`
reads: a top-up logged at 12:30 inside a breast feed running 12:00–13:00 is the
more recent feed by start and the older one by end. The later start wins, and
`verify-s3` pins that case.

**What did not change.** `ended_at` keeps every other job it has — the open-feed
and open-sleep states (D-033), the feed duration on the row, the day table's
`20:57–21:20`. This is only about which instant "the last feed" names.

---

## D-041 — A clock-format toggle in the status row, and one formatter behind it

An icon beside the status row's clock switches every time in the app between
`21:09` and `9:09 PM`. **24-hour is the default** and stays it: the paper log is
written in 24-hour, and the day table is read side by side with photographs of
it.

**It reaches everything, because there is only one formatter.** `hhmm` in
`day/cells.ts` was already the single time formatter — the home list once had
its own and drifted — so teaching that one function the format switches the
status clock, the target's `by 15:00`, the last-feed line, the home list and
the day table together. Nothing else needed to know.

**`format` is a parameter with a default, not a read inside the function.**
`hhmm(iso)` uses the preference; `hhmm(iso, '12h')` does not. That is what lets
`verify-s7` check midnight, noon and the padding without setting a preference
behind the module and hoping the next suite resets it.

**It is a preference of the phone in your hand.** localStorage, never synced,
never on the server — the same place and the same reasoning as the lead rail
and the device id (`event-model.md` § Where each fact lives). Two phones may
disagree about the format and neither is wrong.

**The cache exists because `hhmm` is called once per row.** A day table is long,
so the stored value is read once and held in the module rather than hit per
cell. `setTimeFormat` updates the cache before it writes, so the re-render that
follows already sees the new value.

**And it has to survive Node.** `cells.ts` is imported by the data-layer suites,
which have no `localStorage` at all, so the accessor is guarded rather than
assumed. Without that, adding a preference to the formatter would have taken
`verify-s7` down with it.

**The state is held in the component as well as in storage**, for the same
reason the lead rail is: `LogScreen` is remounted by `key={saved}` on every
save, so what React state buys is the re-render that repaints every clock at
once. `verify-period-row` logs a moment after toggling and checks the format is
still 12-hour on the other side of the remount.

### The two places it could have broken, both measured

- **The day table's time column is a fixed 62px.** `6:23 PM–6:53 PM` is four
  characters longer than `18:23–18:53` — but that column already wrapped the
  24-hour period onto two lines, and the 12-hour one wraps onto the same two.
  42px in both, no page overflow, so the paper-shaped table keeps its shape.
- **The wake line is the narrowest thing on the top card.** At 12-hour it ends
  exactly on the card's inner edge — 337 against a 337 limit — which is as tight
  as it goes without crossing. It cannot overflow: `.wakeline` wraps rather than
  truncates, so a longer case (`by 12:26 AM · 4h 00m left`) takes a second line
  instead of pushing the page sideways. Both are checked in `verify-hero`.

**Midnight and noon are the cases the arithmetic gets wrong.** `0` and `12` both
read as 12, on opposite sides of the meridiem, and a bare `h % 12` prints `0:05
AM`. Six checks in `verify-s7` pin the boundaries: `12:05 AM`, `12:00 PM`,
`11:59 AM`, `11:59 PM`. The hour is padded at 24-hour and not at 12-hour —
`09:05` against `9:05 AM` — because that is how each is written.

**This is the second control living in the status row because there is no
settings screen.** The name button was the first, and its comment says the same
thing. Neither is an argument against the settings screen; both are what it will
hold when it exists.

---

## D-042 — A second gate code that hands a phone its old identity back

Typing `01202012` at the gate, instead of the secret code, skips the name page
and lists the devices already on the server. Picking one makes this phone *be*
that device — the stored id is the one that was chosen, not a fresh UUID.

**The problem it solves is a duplicate parent.** `createThisDevice` mints a new
id and a new row every time the welcome runs, and the welcome runs whenever
localStorage is empty — a reinstall, a cleared site, a new phone. The parent
types their name again and gets a *second* device with the same name, so
`logged_by` now points at a stranger and the avatars on the home screen stop
meaning what they meant. Nothing in the app could undo that.

**The list has to come from the server, because the local database is empty.**
That is the whole situation this page exists for. `fetchDevices` reads
`device` directly rather than going through `pull()`, which calls `replaceAll`
and would wipe local data for a screen that is only offering a choice. It needs
no identity of its own: `device` is not scoped by `baby_id`, so the read works
before this phone is anybody.

**`null` and `[]` are different answers.** Could-not-fetch shows an error and a
retry; an empty list says there is nothing to come back to. Collapsing them
would tell an offline parent that their device does not exist.

**Picking is straight through, with no confirmation.** The owner chose that with
the consequence stated: if the other phone still holds the id, both phones then
write as the same device and their entries become indistinguishable. That is the
recovery case working — the old phone is usually the one that is gone — and
anyone who reaches this page typed an eight-digit code to get here. A confirm
step was offered and declined.

**The chosen row is written to the local database before the app opens**, so the
first render already knows the name. Waiting for the next sync would show a
nameless phone for a second or two on the screen whose whole point was choosing
who you are.

**It is a different door, not a higher privilege.** `RECOVERY_CODE` sits beside
`SECRET_CODE` in the same file and ships in the same public bundle, in plain
text, with the same D-030 caveat: a doormat, not a lock. It grants nothing the
other code does not — both end in the same app, with the same access to the same
log.

**There is a way back.** A failed fetch on a page with no tab bar would otherwise
be a dead end escapable only by closing the app, so `back` returns to the gate
and clears the code.

**Measured, and worth knowing: the failure takes about seven seconds to
appear.** `verify-welcome` waits for it rather than sleeping a fixed time, and
records 6.8s from an aborted request to the error on screen — the client does
not give up when the request does. Until then the page says *looking for your
phones*. Not fixed, because nobody has asked and this is a flow used once; the
lever, if it is ever wanted, is a timeout around `fetchDevices`.

---

## D-043 — The time card carries a date, and the midnight guess becomes a default

The add sheet had an hour and a minute and no date. Which *day* an entry landed
on was inferred: a time landing more than six hours ahead of now was read as
yesterday (`FUTURE_TOLERANCE_MS`, D-018's follow-on). There is now a date row
above the clock — `‹ today ›` — and the inference only fills it in.

**Two problems, and the second is the one that blocks the project.**

1. **Around midnight the guess is invisible and can be wrong.** 23:45 typed at
   00:30 means last night, and the app was right about that — but nothing on
   screen said which day it had chosen, on exactly the entries the paper log is
   mostly made of.
2. **A day before yesterday could not be reached at all.** The inference reaches
   back one day and no further, so the coverage run — entering the ten
   photographed paper days, the project's gate — was not possible through the
   UI. That is not polish; it was standing in front of the gate.

**The inference is kept, demoted.** It still decides the day when nobody has
said, which keeps the 4am flow at zero extra taps and keeps 23:45-at-00:30
landing correctly without thought. The moment the date row is touched, `pinned`
goes true and `atHourMinute` replaces `withHourMinute`: an explicit date is an
answer, and a rule that moved the entry afterwards would be overruling the
person who gave it.

**One date per moment, not two.** The end stays a *time*, and `resolveEnd` rolls
it onto the next day when it lands before the start — which is what makes a
23:00→07:00 sleep work. A second date field would have asked for input nobody
has and broken the case it was meant to serve. `onDay` shifts the end by the
same number of days as the start rather than re-anchoring it, so a period that
crosses midnight keeps its length when the day moves; `verify-s5` pins the
eight-hour sleep through a step.

**Steppers, not a calendar.** `‹ ›` chevrons reusing the same `useHold` the hour
and minute have, so ten days back is a hold rather than ten taps. The
`PeriodPicker` calendar was the alternative and reaches 8/26 in one tap; it is
already built, so it stays the cheap upgrade if the coverage run finds the hold
slow. Starting with the steppers keeps the sheet one idiom.

**Forward of today is refused.** The old inference made a future date almost
unreachable by accident; a date row must not be what reintroduces it, so the
later-day chevron is disabled at today. The *time* steppers are unchanged and
can still land a few hours ahead, which is the existing, visible, fixable case
`FUTURE_TOLERANCE_MS` already describes.

**It also removes a test that could only pass in the morning.**
`verify-period` needed two days with entries and had no way to make one except
by abusing the midnight rule — set the hour to 23 and hope. That only works
while 23:00 is more than six hours ahead, so the section was guarded by
`getHours() < 21`, which is the wrong number: between 17:00 and 21:00 the guard
let it run in a window where the trick could not work, and five checks failed
every evening. The suite now steps the date row and the guard is gone. **The
suite reaching for the app's clock logic instead of stating a day was the actual
fault**, and the fix for it was a missing feature rather than a better number.

---

## D-044 — The end carries its own date, and a held chevron lets go

D-043 gave the moment a date. The end had none: it was anchored to the start's
day and rolled forward by `resolveEnd` when it landed before it. The end now has
its own date row, worded exactly like the start's.

**The data was already right; the screen was not.** A feed at 23:30 with an hour
on it has always been stored as `9/6 23:30 → 9/7 01:30` — `resolveEnd` is what
makes a 23:00→07:00 sleep work, and it predates all of this. What was missing is
that nothing said so. The sheet showed two steppers and the day table printed
`23:30–01:30`, so the app's answer to *which day* was invisible in exactly the
way the start's was before D-043.

**The app still works it out; the owner can now overrule it.** The quick
shortcuts are unchanged — `+1 h` on a 23:30 start still lands on the next day
with nobody thinking about it. Touching the end's date row sets `endPinned`, and
from then on the end keeps the day it is on: changing `00:30` to `23:45` means
`23:45 on that day`, not a re-anchor to the start. That is the whole point of a
date field, applied to the end as well as the start.

**One date per moment for grouping, two for entry.** The owner's rule: *the feed
belongs to the start time's date*. So the day table, the date strip and the
insights all still file a moment by `occurred_at`, and a period crossing midnight
needs no marker there — it belongs to the day it began. The second date is for
saying what happened, not for deciding where it is filed.

**An impossible period is refused where it can be explained.** `0001`'s
constraint is `ended_at is null or ended_at >= occurred_at`, and an editable end
date makes it reachable: put the end on the start's day and set an earlier time.
The earlier-day chevron stops at the start's day, and if the time still lands
before the start the save button reads **the end is before the start** — the
prototype's own "a disabled button that says why" pattern, rather than a failed
upsert with nothing on screen.

### The bug underneath it — a hold that outlived its button

Stepping the end date back one day made the end time impossible to change at
all. Not a display problem: every edit was applied and then silently reverted
about a tenth of a second later.

**`useHold` starts an interval on `pointerdown` and clears it on `pointerup`,
which never arrived.** The earlier-end-day chevron disables itself the moment it
reaches the start's day — that is the guard above — so React removed its
handlers mid-press. The interval outlived the press and re-applied its stale
step every 110ms, overwriting whatever was done next.

**The release is now heard on the window**, added on `pointerdown` and removed
in `stop`, so a button that vanishes or disables itself under the finger still
ends its own hold. The button-level handlers stay for the ordinary case.

**This was already shipped.** D-043's later-day chevron disables itself on
reaching today, which is the same shape, so the leak went out with it. It was
found only because the end date made the consequence visible — the start row's
version re-applied a step that had already been taken, which looks like nothing
at all.

**Found by instrumenting, not by reading.** Four passes of reasoning about
`wrapHour`, `clampHour` and React's controlled inputs all pointed at the wrong
place; a `console.log` with a stack trace in the parent's `onChange` named
`onStep` as the caller in one run. The code was innocent everywhere it was
being read.

---

## D-045 — The bottle prompt moves, and becomes a count when you tap it

`make a bottle` was a static lavender line. It is now light blue, it moves, and
tapping it turns it into a count of how long the bottle has been standing.

**Why it moves.** The line exists to be noticed by someone who is not looking at
the phone. A slow breath on the icon, 1.8s, not a flash — the tone rule holds
for movement as much as for words, and nothing on this card is allowed to nag.
Once counting, the motion *changes* rather than stops: a rock, like a bottle
being shaken, so the two states are told apart without reading. Both are off
under `prefers-reduced-motion`.

**Its own light blue, `--blueFill` / `--blueInk`.** Rose reads as an alert
(D-038), lavender is the end-feed bottle, periwinkle is sleep. This is the only
line on the card that asks for something, so it earns a colour. `#1f6f9c` gives
5.51:1 on `--card`, above the `--lavInk` it replaces; the night `#8cc6ea` gives
8.74:1.

**It counts up, and claims nothing.** `making milk · 4m 10s` — how long since
you started, not how long until it is cool. A countdown was offered and
declined, and it would have meant the app asserting a cool-down time for a
bottle it knows nothing about. Seconds while they are the thing moving, minutes
once they are not.

**Nothing is stored in the database.** The tap is a note to yourself about a
bottle, not an event in the baby's log — there is no moment to attach it to and
nothing the other phone needs. It sits in localStorage with the lead rail and
the clock format (`event-model.md` § Where each fact lives). It is in
localStorage rather than component state because this screen is remounted by
`key={saved}` on every save.

**No cancel, by the owner's decision.** Logging the feed is the cancel. The line
clears exactly when the prompt does — `prepping` goes false when a feed pushes
the target hours out (D-036) — so the count needs no rule of its own about
feeds, and there is no second gesture to learn.

**`PrepLine` is a component so the one-second tick is confined to it.** The card
above is content with `now` every 30s and should not re-render every second to
move one line's digits.

### The bug this uncovered — empty is not the same as unread

The count was wiped by *any* save, and by opening the app.

`LogScreen` starts with `moments = []` and fills it asynchronously, so the first
render after every remount has no moments — which produces no target, which
makes `prepping` false, which is indistinguishable from *a feed has just been
logged*. Everything else on the screen was happy to render the empty array for a
frame. This line acts on it, and cleared a running count.

**`loaded` now says which it is**, set when `getMoments` first resolves, and the
clearing effect waits for it. The general shape is worth remembering: a
component that *acts* on absent data needs to know whether the data is absent or
merely not here yet, and an empty array cannot tell it.
