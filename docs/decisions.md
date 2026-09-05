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

Dragging a row **in either list — the home screen's recent list or the day
table** — reveals two actions. **Edit** reopens the add
sheet pre-filled. **Delete** removes the moment.

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
