# BabyLiana — agent orientation

## Read first

1. `.specify/memory/paper-log-baseline.md` — the real requirements, written by
   the real user on paper before an app existed. Where documents disagree, this
   one wins.
2. `.specify/memory/coverage-requirement.md` — the acceptance test.
3. `docs/decisions.md` — settled decisions with rationale.
4. `docs/open-questions.md` — deliberately unanswered. Do not guess these.

## What this is

A PWA that replaces a paper newborn log for two parents. React + TypeScript +
Vite, IndexedDB local, Supabase sync, free hosting. Not a native app, and not
becoming one — see D-001.

## The competitor is a pen

The user is currently succeeding with a pen and lined paper. Paper never
crashes, needs no login, works one-handed in the dark, and accepts any mark.

Every design choice is judged against that. An app that is slower or narrower
than paper loses, and the paper comes back to the bedside.

## Rules that are not negotiable

- **Never block a write on the network.** Local write, immediate UI update,
  background sync.
- **Never mutate an event.** Corrections are new events. Deletions are
  tombstones.
- **Never require a login to log an event.** Shared household ID, no accounts.
- **Never resolve a duplicate silently.** Surface it, let the user decide.
- **Every event type carries a free-text note.** It is the escape hatch that
  makes the app as accepting as paper.
- **Approximate and unknown times are first-class.** The paper log uses `?`
  about once a day.

## Things that look like edge cases and are not

All of these appear in seven days of the real paper log:

- A feed split across two sources with different volumes — `25(B) + 45(F)`
- A feed with an unknown volume — `?`
- An entry with an unknown time — `04:?`
- An entry inserted hours later, out of chronological order
- A struck-through correction
- A row with a diaper and no feed, or a feed and no diaper

Build for these from the start. They are not v2.

## Tone and content cautions

This app is used by parents of a newborn, often at 4am, often exhausted.

- The mascot's states must be **descriptive, never evaluative**. Sleepy, awake,
  hungry. Never sad, worried, disappointed, or scolding. An app that appears to
  disapprove of a late feed lands very differently than intended.
- Do not generate health advice, normal-range judgements, or anything that
  implies a reading is concerning. The app records; it does not assess.
- No growth percentiles, no "is this normal" features. Out of scope, and out of
  scope on purpose.

## Working style

Spec is a track, not a phase. Before building a slice, write or update its
artifact in `.specify/memory/`. Keep artifacts small and current rather than
comprehensive and stale.

Sessions are short and scattered — often twenty minutes, often late. Prefer
closeable scopes over long-running work. Leave the repo in a state that makes
sense cold.

## Current status

Phases 0 and 1 complete. Phase 2 (design prototype) and Phase 3 (infrastructure
spike) are the next moves and are independent of each other.
