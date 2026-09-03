# BabyLiana — Project plan

**Living document.** Phases 0 and 8–10 will change what is believed here. Edit
it as you learn. It is not a contract to execute.

This file holds the *shape* of the work and which phases are finished. It does
not hold the current position or the next move — those are in `status.md`.

## Framing

Two users, both parents, both primary. The first release is a surprise, so it
must feel finished at reveal. Platform is settled: PWA, $0, no App Store.

## Cross-cutting: specification track

Spec is a track, not a phase (D-011). Each build slice gets its own artifact in
`.specify/memory/`, written immediately before it, at the fidelity that slice
deserves. Design mockups land there too — visual specs are what agent handoffs
most often lack.

---

## Phase 0 — Baseline & silent research ✅ COMPLETE

Paper log photographed and analysed. See
`.specify/memory/paper-log-baseline.md`.

Ongoing, passive: keep noting your own 3am friction and what she asks you.
Append to the baseline document as it accumulates. This does not block anything.

## Phase 1 — Product definition ✅ COMPLETE

See `.specify/memory/product-definition.md` and `.specify/memory/event-model.md`.
Success and kill criteria written.

---

## Phase 2 — Structural design & prototype

Claude Design. Owns the layout decision outright (D-007).

- Clickable prototype, working from the paper log photo and the event model
- Night surface and day surface, both
- Palette tested dimmed, not only at full brightness
- Try it. Decide button hierarchy and primary readout by tapping, not arguing
- Mockups and the resolved decisions into `.specify/memory/`

Exit: Q-001 and Q-002 in `open-questions.md` are closed.

## Phase 3 — Infrastructure spike (walking skeleton)

Independent of Phase 2 — run them in either order, or both at once. The one
reason to get the spike deployed early is Q-004: it only answers by installing
the PWA and leaving it untouched, so the sooner it is on a phone the sooner
there is an answer. Nothing else waits on it.

Goal: a page reachable from a public URL on two devices, writing to a real
database, updating live. A button and a counter. No baby data, no design.

If the pipeline does not go green quickly, the stack is wrong, and that is cheap
information.

Boundary: infrastructure is kept, application code is deleted (D-012).

## Phase 4 — Technical design

Finalise `.specify/memory/event-model.md` on proven ground, informed by what the
spike revealed about Safari, IndexedDB persistence, and realtime latency.

The spike ran offline with no local layer at all, and the result is written up
in `.specify/memory/spike-spec.md` § What offline actually does. It is the
clearest statement of why the local replica is non-negotiable: a tired parent
who gets an error on a tap reaches for the pen.

Sync must also **reconcile on resume**. Realtime has no replay, and iOS suspends
the socket whenever the app is backgrounded — which is its normal state between
uses. The spike demonstrated the consequence: a phone sat at 20 while the
database held 23, with the subscription showing green. Treat realtime as a
latency optimisation over a reconcile, never as the sync mechanism itself.

Sync must also tolerate **version skew**: two parents, two devices, one running
older code. An installed PWA only picks up a new build on a fresh navigation, so
this is the normal state after any deploy, not an edge case. Append-only and
additive fields make most of it safe — an old client ignores what it does not
know. The exception is anything that changes the *meaning* of existing events,
which is precisely what Q-010 settles for corrections and tombstones. Decide
those semantics so a stale device reads them the same way, or the two phones
disagree about what has been deleted and neither shows an error.

## Phase 5 — MVP spec package

Full Spec Kit artifacts. Sliced so each Claude Code session has a closeable
scope. Drafted with assistance, edited by hand — the spec is where judgment gets
encoded.

## Phase 6 — Build

Thin vertical slice first: one event type, one device, then visible on a second.
Then breadth to satisfy the coverage checklist. Keep the spike page on a route
as a smoke test.

## Phase 7 — Visual identity & polish

Before reveal, because a gift cannot look like a prototype (D-005).

- Mascot: the baby as a character, or a separate creature
- Character states descriptive, never evaluative — sleepy, awake, hungry; never
  sad, worried, or scolding. Postpartum anxiety is real and an app that emotes
  disapproval at 4am lands very differently than intended
- Asset production. Consistency across the set is the hard part
- App icon, launch experience, the small things that make it feel made
- Naming decision lives here

## Phase 8 — Solo run

Real 3am shifts. Runs until you have used it on enough of your own night shifts
to know what breaks — that is a condition, not a duration, and no tooling
substitutes for it.

- Run the coverage checklist: enter all seven photographed days
- Fix what breaks before anyone else sees it
- Note which secondary types you actually reach for — this decides promotion
- Kill criteria check

## Phase 9 — Reveal

- Calm moment, not mid-feed
- Framed as a gift on top of her system, never as a fix for it. She invented a
  working system while recovering from childbirth
- Let her try it unwatched
- Second device onboarding must be trivial — QR code, no account, no login

## Phase 10 — Real use

Runs until the pen's fate is clear. A condition, not a duration.

- Paper stays available, and that is fine
- The pen disappearing is the signal. Don't ask, notice
- Collect friction, resist adding features

## Phase 11 — Decision gate

Two independent questions. Do not let them collapse into one.

**Did it beat paper?** If partly, name the gap. Only if the gap is specifically
speed of entry at 3am is native worth considering, and that is a fresh project
with its own cost. Any other gap is a PWA problem.

**Is there a product here?** Unrelated to the native question. A product can stay
a PWA; going native can be purely for your own family.

**If the answer is shelve: export first.** A shelved project stops generating
database activity, which pauses the Supabase project and eventually deletes it.
Take a JSON export before walking away.

## Phase 12 — Product exploration (conditional)

Opens only if Phase 10 held and Phase 11 says yes. Second-family testing before
anything public. Naming, art originality, and handling other people's children's
data all become real questions at that point.

---

## Two kinds of phase

**Build phases** — 2 through 7. Bounded by effort, and the owner is working with
LLM tooling, so they move fast. **Do not put duration estimates on these.** They
have been wrong every time they were attempted here, and they generate
confusion rather than planning value. Track them by what is done, not by how
long they should take.

**Observation phases** — 8 and 10. These are not slow because they are hard;
they are gated on real nights happening and on a second person forming a habit.
No tooling substitutes for that. They end on a condition — enough shifts logged,
the pen's fate clear — not on a date.

The only thing in the project with genuine unavoidable elapsed time is Q-004,
which needs the PWA installed and left alone. Deploy the spike early and it
answers itself while other work continues.
