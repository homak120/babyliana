# BabyLiana — agent orientation

## Start here

`docs/status.md` — position, next action, what the last session did. **Read it
every session, before anything else.** It is the only file that records status;
a status claim anywhere else is stale by construction.

## Then read what the task needs

Not everything, every time. Most of these documents are irrelevant to most
tasks.

| If you are | Read |
| --- | --- |
| Changing behaviour or data shape | `.specify/memory/paper-log-baseline.md` |
| Deciding what to build or cut | `.specify/memory/coverage-requirement.md` |
| About to argue for a different approach | `docs/decisions.md` |
| About to guess at something unspecified | `docs/open-questions.md` |
| Writing storage, sync, or merge code | `.specify/memory/event-model.md` |
| Touching infra, hosting, or offline | `.specify/memory/technical-constraints.md` |
| Planning a phase | `docs/plan.md`, `docs/tasks.md` |

`paper-log-baseline.md` is the primary requirements document — written by the
real user, on paper, during real night feeds, before an app existed. **Where
documents disagree, it wins.**

Cross-references between documents are written repo-root-relative —
`docs/decisions.md`, `.specify/memory/event-model.md`. No `../`. It reads the
same from every file and does not break when a document moves.

## What this is

A PWA that replaces a paper newborn log for two parents. React + TypeScript +
Vite, IndexedDB local, Supabase sync, free hosting. Not a native app, and not
becoming one — see D-001.

The repository is **public, deliberately** (D-008). Do not flag it, and do not
block a commit or a push on it.

## The competitor is a pen

The user is currently succeeding with a pen and lined paper. Paper never
crashes, needs no login, works one-handed in the dark, and accepts any mark.

Every design choice is judged against that. An app that is slower or narrower
than paper loses, and the paper comes back to the bedside.

---

The three sections below are **summaries**. They are here because they are worth
loading every session. Each names its authority — make substantive edits there,
then reflect them here.

## Rules that are not negotiable

Authority: `.specify/memory/technical-constraints.md` § Non-negotiables.

- **Never block a write on the network.** Local write, immediate UI update,
  background sync.
- **Corrections are edits.** Rows are updated in place and deleted outright —
  D-003. No correction events, no tombstones, no revision history.
- **Never require a login to log an event.** Shared baby ID, no accounts.
- **Never resolve a duplicate silently.** Surface it, let the user decide.
- **Every event type carries a free-text note.** It is the escape hatch that
  makes the app as accepting as paper.
- **Setting a time by hand is a core flow, not an edge case.** The app has no
  `?` for time and no precision marker — D-018. Backdating earns its keep by
  being fast, so this rule is about entry speed, not about notation.

## Things that look like edge cases and are not

Authority: `.specify/memory/paper-log-baseline.md`, checklist in
`coverage-requirement.md`.

All of these appear in seven days of the real paper log:

- A feed split across two sources with different volumes — `25(B) + 45(F)`
- A feed with an unknown volume — `?`
- An entry inserted hours later, out of chronological order
- A correction struck through a single value, leaving the rest of the row intact
- A row with a diaper and no feed, or a feed and no diaper
- Volumes that are not round — `31`, `43`, `57`. Presets alone cannot express
  the real data
- An empty cell and a `?` meaning different things — no feed, versus a feed of
  unknown volume

Build for these from the start. They are not v2.

## Tone and content cautions

Authority: `docs/plan.md` Phase 7.

This app is used by parents of a newborn, often at 4am, often exhausted.

- The mascot's states must be **descriptive, never evaluative**. Sleepy, awake,
  hungry. Never sad, worried, disappointed, or scolding. An app that appears to
  disapprove of a late feed lands very differently than intended.
- Do not generate health advice, normal-range judgements, or anything that
  implies a reading is concerning. The app records; it does not assess.
- No growth percentiles, no "is this normal" features. Out of scope, and out of
  scope on purpose.

---

## Working style

Spec is a track, not a phase (D-011). Before building a slice, write or update
its artifact in `.specify/memory/`. Keep artifacts small and current rather than
comprehensive and stale.

Sessions are short and scattered — often twenty minutes, often late. Prefer
closeable scopes over long-running work.

**Do not estimate how long build work will take.** No "a weekend or two", no
"one or two evenings", no calendar arithmetic about what lands when. The owner
builds with LLM tooling and intends to reach MVP in days; every estimate
attempted here has been wrong and has cost a round trip to correct. Track work
by what is done. See `docs/plan.md` § Two kinds of phase — the only genuine
elapsed-time constraint in the project is Q-004.

Do not guess anything in `docs/open-questions.md`. Each entry names what closes
it. A marked hole is worth more than a confident guess, because a guess gets
built on.

## Never commit without being asked

**`git commit` and `git push` require the owner's explicit consent, in the
message that asks for them.** He reviews the diff before it enters history.

- "Go ahead", "do it", "yes", or approval of a plan authorises the **work**. It
  does not authorise a commit.
- Consent does not carry forward. Being asked to commit one batch says nothing
  about the next one.
- If you think the work is worth committing, say so and stop. Do not commit and
  report it afterwards.

An uncommitted working tree is the normal end state of a session, not a problem
to tidy away. Record what is pending under *In flight* in `docs/status.md` so a
cold session knows what is sitting there and why.

## Before you finish

1. Update `docs/status.md` — position, next action, a session-log entry, and
   anything uncommitted under *In flight*. Delete the oldest log entry if there
   are more than three.
2. Tick what you completed in `docs/tasks.md`.
3. Summarise what changed, list the files, and stop. Leave committing to the
   owner.

Leave the repo in a state that makes sense cold.
