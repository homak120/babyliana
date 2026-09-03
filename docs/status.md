# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-02

---

## Position

Phases 0 and 1 complete. Phase 2 is out with Claude Design. Phase 3's scaffold
is committed and builds — a Vite + React + TypeScript PWA shell that runs
locally without Supabase; its remaining steps need a browser and a phone.

Task-level state is in `tasks.md`. Phase-level completion is in `plan.md`. This
file is the summary and the next move.

## Next action

**Phase 3 is waiting on you, at a browser.** The scaffold is committed and
builds; the remaining steps need accounts and a phone. Follow
`.specify/memory/spike-spec.md` § Human steps — create the Supabase project, run
the SQL in that file, fill `.env.local` from `.env.example`, import into Vercel,
then install the PWA on your phone and leave it alone. That last step is the
Q-004 test and it runs itself.

**Phase 2 is complete.** The owner tried the prototype in the Claude Design
session and fed decisions back into it, so the handoff at
`.specify/memory/design/handoff/` is final, not a proposal. Q-001, Q-002, Q-007
and Q-009 are closed; the decisions are recorded in D-021.

**Before building from it, read
`.specify/memory/design/phase-2-reconciliation.md`.** The handoff came from a
brief predating D-019 and D-020, so its data shapes are Design's assumptions and
need remapping. Its unknown-minute marker was struck as a D-018 conflict.

**Phase 4 is the live thread.** Schema is finalised; sync, the QR join, export
and the offline strategy remain — the last of those still waiting on Q-004.

**No duration estimates.** The owner works with LLM tooling and they have been
wrong every time; see `plan.md` § Two kinds of phase.

## In flight

**D-018 uncommitted.** Nine documents changed, no code. The time precision
marker is gone — no `exact/approximate/unknown`, no `?` for time, no `~`.
`docs/decisions.md` D-018 holds the reasoning; the other eight are consistency
edits so nothing still says `04:?`. Volume `?` is untouched and still required.

**The Phase 2 brief is one of the nine, and Phase 2 is currently out with
Claude Design against the old version.** The running pass may come back with a
time-precision control in it. That is not a failure of the design pass —
disregard that part and use the new § Entering and adjusting the time, or
re-run the brief if the prototype leans on it heavily.

When something *is* pending, name it here — a cold session needs to know what is
sitting uncommitted and why. Uncommitted work is a normal end state, not a
defect to tidy away: the owner reviews diffs before they enter history. See
`CLAUDE.md` § Never commit without being asked.

## Open threads

Noticed, not blocking, no owner yet.

- **Unresolved marks on the paper log.** Several `1`s in the Pee/Poop column
  appear underlined, and one 9/1 milk cell may be a ditto mark rather than a
  number. Both may just be handwriting crossing the ruled line. Deliberately not
  recorded in the baseline as fact. Needs human eyes on the original page — the
  coverage rule is *every mark has a home*, so if an underline means something,
  the model is missing a dimension.
- **No Spec Kit scaffold.** `.specify/memory/` follows the convention but there
  is no `constitution.md`, no scripts, no templates. The non-negotiables in
  `CLAUDE.md` are effectively the constitution. If Phase 5 intends to run real
  Spec Kit commands, the scaffold has to exist first.

## Session log

Newest first. **Three entries maximum** — delete the oldest when adding a
fourth. This is orientation, not history. `git log` is the history.

### 2026-09-02 — D-018, time precision removed

The owner's call, and the reasoning is worth keeping: `04:?` is what you write
when a pen has no idea what time it is. A phone does, so the app removes the
cause rather than giving the user a way to express uncertainty. His test for the
notation was "if a human cannot read a mark and immediately know what it means,
it does not belong" — which is also why the marker was dropped outright rather
than softened to a `~`.

What was knowingly given up: a time typed from memory and a time tapped live are
now indistinguishable, forever, including in exports. Recorded in D-018 so it is
not later read as an oversight.

What replaces it is entry speed, written into the Phase 2 brief as a new
§ Entering and adjusting the time — default to now, quick offsets, picker,
numeric entry. Ranking is left to the prototype under D-007. Natural-language
time parsing is explicitly ruled out; it fails silently on a tired user.

The coverage test loosened from *every glyph reproduced* to *every fact
represented*, which is the one real cost and is stated in
`coverage-requirement.md` rather than left implicit.

`paper-log-baseline.md` § Unknown values was **not** rewritten — it records what
the paper actually says, and editing evidence to match a decision would destroy
the ability to re-derive later. It carries a pointer to D-018 instead.

### 2026-09-01 — analysis pass, no code

Read the full document set and both paper-log photographs. Findings landed as:

- Three additions to `paper-log-baseline.md` (non-round volumes, blank-vs-`?`,
  field-level corrections).
- Q-009 and Q-010 in `open-questions.md`.
- Notes on D-004 and D-013 in `decisions.md`.
- Duplicate-detection edge case in `event-model.md`.
- JSON export moved earlier in Phase 6 of `tasks.md`, to match the
  non-negotiable in `technical-constraints.md` that says to build it early.
- This file, plus a restructured `CLAUDE.md`.
- Paper-log photographs moved out of `.specify/memory/design/` into
  `.specify/memory/paper-log/`. They are Phase 0 inputs and were making the
  untouched Phase 2 output folder look populated — which it did, misleadingly.
  `design/` is now empty but for a README that says so plainly.

A Q-011 was raised and then withdrawn the same day. It claimed the build
schedule collided with D-009's expiry; the arithmetic was wrong, and the whole
framing was unwanted. Do not re-raise it.

Duration estimates were then stripped from `plan.md`, `tasks.md` and this file
at the owner's instruction — they were noise, not planning. `plan.md` § Two
kinds of phase and the rule in `CLAUDE.md` § Working style now prevent them
coming back.

Phase 2 was briefed out to Claude Design; the brief is committed under
`.specify/memory/design/`.

Phase 3 scaffold built: Vite 8, React 19, TypeScript 6, `vite-plugin-pwa`,
`@supabase/supabase-js`, plain CSS. Spec at `.specify/memory/spike-spec.md`
including the throwaway table's SQL. Hosting closed as Vercel (D-016); styling
deliberately left open until the prototype lands (D-017). Placeholder icons are
placeholders — real ones are Phase 7.

D-008 was rewritten from private to public. The repo had been public since it
was created; the owner confirmed that is intentional and is the starting point.
The old entry was the stale side of that, and it cost a session a blocked push
before it got fixed. Do not re-raise it.
