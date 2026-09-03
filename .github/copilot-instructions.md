# BabyLiana — Copilot instructions

Full orientation is in `CLAUDE.md` at the repo root. Read it, plus
`.specify/memory/paper-log-baseline.md`, before contributing.

## Summary

PWA replacing a paper newborn log. React + TypeScript + Vite, IndexedDB local
replica, Supabase sync. Not native, not becoming native.

## Hard rules

- Never block a write on the network. Local first, background sync.
- Corrections are plain updates; deletes are real deletes (D-003).
- Never require a login. Shared household ID, no accounts.
- Never resolve a duplicate silently.
- Every event type has a free-text note field.
- Setting a time by hand is a core flow. There is no precision marker and no
  `?` for time — it defaults to now and must be fast to adjust (D-018).

## Do not

- Add growth percentiles, normal-range judgements, or health assessment. The app
  records; it does not assess.
- Make mascot or UI states evaluative. Descriptive only.
- Guess anything listed in `docs/open-questions.md`.
