# BabyLiana

A newborn activity tracker for two parents, replacing a paper log.

**Working title.** Naming is deliberately deferred to Phase 7 (visual identity).
Expect to rename. Keep the name out of anything expensive to change.

## What this is

A PWA — a web app installed to the iPhone home screen — that records feeds and
diaper changes and syncs live between both parents' phones. It exists to replace
a paper log currently kept at the bedside.

Not an App Store app. No Apple Developer account. No native code. Running cost: $0.

## Status

Phases 0 and 1 are complete. Everything else is open.

## Where things are

| Path | What it holds |
| --- | --- |
| `docs/plan.md` | Phase plan, current version |
| `docs/decisions.md` | Decisions with rationale. Read before relitigating anything |
| `docs/tasks.md` | Task list, by phase, with owner |
| `docs/open-questions.md` | Deliberately unanswered. Do not guess these |
| `.specify/memory/` | Spec artifacts agents read |
| `CLAUDE.md` | Agent orientation |

## The one thing to understand first

The user this is being built for is currently succeeding with a pen and a sheet
of lined paper. That system works. It never crashes, needs no login, and is
readable at a glance in the dark.

Any version of this app that is slower or narrower than the paper loses, and the
paper comes back to the bedside. See `.specify/memory/coverage-requirement.md`.
