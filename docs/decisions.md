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
Postgres suits an append-only event log with row-level security. Realtime gives
live cross-device updates without building a socket layer.

IndexedDB holds a complete local replica so writes never wait on the network.

**Considered.** CloudKit — free, no third party, better privacy — but the iCloud
entitlement requires the paid developer account, which D-001 rules out. Firebase
— does not pause, better offline out of the box, but per-read/write billing and
a worse fit for an event log.

**Reversal condition.** The append-only design makes the backend swappable. A
migration is an export and a replay, not a rewrite.

---

## D-003 — Append-only event log

Immutable events. Edits are correction events. Deletes are tombstones.

**Why.** Not architectural taste — the paper log already contains strikethroughs,
a retroactively inserted row, and unknown times. Corrections and out-of-order
entry are real usage. It also makes offline merge a union rather than a conflict
resolution, and makes the backend replaceable.

**Reversal condition.** None anticipated. This is load-bearing.

---

## D-004 — Shared household ID, no accounts

No email, no password, no login. An ID generated on the first device; a second
device joins by QR code.

**Why.** Magic links require email and can expire, and a logged-out state at 3am
is exactly the failure that sends someone back to the pen. Less "correct",
dramatically better for the actual users.

**Security property, stated plainly.** The household ID is a bearer token.
Possession is full access, there is nothing to revoke, and no second factor.
That is the right trade for two parents and one baby, but it has consequences:
keep the ID out of URLs, where it would reach browser history, referrers, and
any analytics. A QR code shown on a screen is fine.

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
