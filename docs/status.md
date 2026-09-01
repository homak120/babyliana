# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-01

---

## Position

Phases 0 and 1 complete. **No application code exists yet** — the repo is spec
only, one commit.

Task-level state is in `tasks.md`. Phase-level completion is in `plan.md`. This
file is the summary and the next move.

## Next action

**Phase 3 is waiting on you, at a browser.** The scaffold is committed and
builds; the remaining steps need accounts and a phone. Follow
`.specify/memory/spike-spec.md` § Human steps — create the Supabase project, run
the SQL in that file, fill `.env.local` from `.env.example`, import into Vercel,
then install the PWA on your phone and leave it alone. That last step is the
Q-004 test and it runs itself.

**Phase 2 is running, in Claude Design.** The brief is committed at
`.specify/memory/design/phase-2-brief.md` — self-contained, paste-ready, and the
place to edit if the design pass needs re-running.

It has to come back with a clickable prototype, night and day surfaces, a
palette checked dimmed, and comparable *alternatives* rather than one answer —
D-007 says these get decided by tapping. It closes Q-001, Q-002, Q-007, Q-009.
When it lands: screenshots into `.specify/memory/design/`, resolved decisions
into `decisions.md` as a new D-entry, those four questions deleted from
`open-questions.md`.

Phase 3 is independent and can run alongside. Its first steps are human-only —
Supabase project by hand, first deploy by hand, install on the phone — and
getting the PWA installed early is worth doing, because Q-004 is the one thing
here that answers only by leaving it alone.

**No duration estimates.** The owner works with LLM tooling and they have been
wrong every time; see `plan.md` § Two kinds of phase.

## In flight

Nothing. Working tree clean, `main` pushed.

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
