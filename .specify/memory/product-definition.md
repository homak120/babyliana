# Product definition (Phase 1)

## What it is

A shared newborn activity log for a household of two parents, replacing a paper
log kept at the bedside.

## Users

- **Both parents are primary users.** Neither is a proxy for the other. Both do
  night shifts, both feed, both change diapers.
- The household model supports N devices from the start. Two today; a
  grandparent or helper may join later without a schema change.
- Every event records which device created it. Not for accountability — because
  "did I log that or did you" is a real 3am question.

## The problem being solved

Paper works but cannot do two things:

1. **Remote visibility.** One parent cannot see what the other recorded without
   physically holding the page.
2. **Arithmetic.** Time since last feed, total volume today, diaper counts —
   all currently done in the head, at night, by scanning rows.

Everything else paper does well. The app's job is to add those two things
without losing anything paper already provides.

## The primary readout

**Time since last feed.**

This is the number both parents compute mentally at 3am and the one paper makes
them scan for. It is the default answer the screen gives before anything is read.

Provisional. Alternatives to be evaluated against the Phase 2 prototype rather
than fixed here — see `docs/open-questions.md` Q-002.

## Scope: newborn phase

v1 targets the current stage: bottle feeds of 30–60mL every 2–3 hours, and the
early poop-colour progression.

This deliberately expires. Feeds consolidate around 6 weeks; by 3 months the
interesting variable becomes sleep rather than milk. Do not design for the
12-month version now. Better information will exist in three months, and the
append-only event model makes extending cheap.

## Single-user viability

The app must be genuinely useful to one parent alone.

The first release is a surprise (see `docs/decisions.md` D-005), which binds the gift
to the product. If the second user keeps using paper, the first user must still
be left with something worth using. This is a hard requirement on the design,
not an aspiration.

## Success criteria

1. The pen leaves the nightstand and does not come back.
2. Every entry in the photographed log can be represented — see
   `coverage-requirement.md`.
3. Logging a feed takes less time than writing a row.
4. It works with no signal, in the dark, one-handed.

## Kill criteria

Written in advance, on purpose. This is being built during a newborn's first
months, and a project like this can quietly become an obligation.

Stop, or shelve, if any of these is true:

- It is not usable by the end of Phase 8 (solo run) and the build has already
  consumed more than the agreed time budget.
- Building it is measurably costing sleep or time with the baby.
- After Phase 10, the pen is still in use for anything, and the gap is not
  fixable in one further session.
- It has stopped being enjoyable and become an obligation.

Shelving is a legitimate outcome. The repo will still be there in six months,
and so will the append-only log.
