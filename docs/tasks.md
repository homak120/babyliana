# Tasks

Owner legend:

| Tag | Meaning |
| --- | --- |
| **H** | Human only. Not delegable |
| **CD** | Claude Design |
| **CC** | Claude Code |
| **CH** | Conversational — thinking, not building. Any chat surface, including a Claude Code session in discussion mode |

Human-only tasks stay in this list even though nothing can do them. Separating
them is how Phase 0 quietly never happens.

---

## Phase 0 — Baseline ✅

- [x] **H** Photograph the paper log
- [x] **CH** Extract schema, notation, and behavioural findings
- [x] **CH** Derive the coverage checklist
- [ ] **H** *Ongoing:* append your own 3am friction to the baseline doc

## Phase 1 — Product definition ✅

- [x] **CH** Event model draft
- [x] **CH** Success and kill criteria
- [x] **CH** Multi-user and scope decisions

---

## Phase 2 — Structural design & prototype ✅

- [x] **CD** Clickable prototype from the paper log photo + event model
- [x] **CD** Night surface and day surface variants
- [x] **CD** Palette tested at reduced brightness — night theme in tokens.css
- [x] **H** Try the prototype — done in the Claude Design session, with
      feedback fed back into the handoff
- [x] **H** Decide button hierarchy and primary readout → Q-001, Q-002 closed
- [x] **CH** Record the resolved decisions in `decisions.md` — D-021
- [x] **H** Commit mockups to `.specify/memory/design/handoff/`

## Phase 3 — Infrastructure spike

- [x] **H** Create the GitHub repo. Public, deliberately — see D-008
- [x] **H** Create the Supabase project — ref `fhqbgnlzqnpzqbhjkxda`, US East
- [x] **CC** Vite + React + TypeScript scaffold — builds, lints, PWA manifest
      and service worker generated
- [x] **H** First deploy by hand — Vercel, https://babyliana.vercel.app
- [x] **CC** Wire git push → build → deploy — proven: commit 781680d changed the
      bundle hash and the deployed site picked it up in ~20s, no manual step
- [x] **CC** Throwaway table; reads and writes from the deployed page — tap on
      the deployed origin wrote row 6; verified from a second client
- [x] **CC** Realtime proven across two devices
- [x] **CC** PWA manifest; Add to Home Screen works — installed on iPhone
- [x] **CC** Confirm it opens offline — opens from cache; shows 0 and a failed
      tap, which is correct with no local layer. See spike-spec.md
- [x] **H** Environment variables and secrets handled properly — .env.local
      gitignored, .env.example holds placeholders only, Vercel vars set before
      first build, and the public bundle confirmed to carry no secret material
- [ ] **H** iOS reality checks — full screen, no address bar, icon rendering,
      survives a day backgrounded, whether Safari evicts IndexedDB
- [x] **H** Install on your own phone and leave it there — installed; the
      "leave it" half is the Q-004 clock, now running

## Phase 4 — Technical design

- [x] **CH** Finalise event schema and field types — three tables, full
      Postgres DDL in `.specify/memory/event-model.md` § Schema (Postgres)
- [ ] **CH** Sync and merge behaviour — mostly written already in
      `.specify/memory/event-model.md`; confirm it and move on. Realtime is a
      latency optimisation, not a sync mechanism: no replay, so anything written
      while a phone was backgrounded is missed until the next reconcile
- [ ] **CH** Confirm the `other` type list. The design calls it a placeholder
      and the schema names five secondary types; they have to agree before the
      build. Nothing else tracks this
- [ ] **CH** Offline strategy. **No longer blocked on Q-004** — reconcile is a
      full refresh, so eviction is survivable by design: lose the cache,
      re-fetch. Q-004 now confirms rather than gates
- [ ] **H** Review and edit `.specify/memory/event-model.md` to final

## Phase 5 — MVP spec package

The artifacts already exist — `event-model.md`, `spike-spec.md`, the design
handoff and its reconciliation note. D-011 made spec a track, not a phase, and
the track has been running. What is left is the slicing.

- [ ] **CH** Slice the build so each session has a closeable scope
- [ ] **H** Skim the artifacts once as a set, for contradictions between them

## Phase 6 — Build

- [ ] **H** Delete the spike application code first — src/App.tsx, src/App.css,
      and the spike_taps table (D-012). Moved here from Phase 3: it gates the
      start of this phase, it is not a Phase 3 exit condition
- [ ] **CC** Vertical slice: one event type, one device
- [ ] **CC** Same event visible on a second device
- [ ] **CC** Seed one household and hard-code its id. No pairing flow for MVP —
      two phones, one baby, one household. See D-022
- [ ] **CC** Feed events, including the two-component split
- [ ] **CC** Diaper events, including colour and consistency
- [ ] **CC** Time entry: defaults to now, quick offsets, picker, numeric entry
      (D-018 — no precision marker, so this has to be fast instead)
- [ ] **CC** Edit, correct, and delete via correction events
- [ ] **CC** Free-text note on every event
- [ ] **CC** Secondary types behind a "more" affordance
- [ ] **CC** Derived views — time since last feed, daily totals, day list
- [ ] **CC** Reconcile on resume — on `visibilitychange` to visible, re-fetch
      from the server and merge by id. Without it a backgrounded phone shows a
      confidently wrong count, which breaks "did she already feed her"
- [ ] **CC** Update strategy — check for a new service worker when the app
      becomes visible, and reload silently only when no entry is in progress.
      Never a modal. Depends on the local layer: a reload is only free once the
      write has already landed in IndexedDB. Same `visibilitychange` hook as
      reconcile-on-resume, so build them together
- [ ] **CC** Keep the spike page on a route as a smoke test

### Before reveal, not before MVP

- [ ] **CC** JSON export of timeslots, events and devices.
      `technical-constraints.md` requires it before a second person sees the
      app — that is Phase 9, not first use. Getting a file off an installed iOS
      PWA is the hard part, not the format
- [ ] **CD/CC** Settings screen — the design does not have one, and export needs
      somewhere to live

## Post-MVP — deliberately deferred

Not "later" as in forgotten. Deferred because the fastest path to a usable
first version does not go through them, and each has a named trigger.

- [ ] **Pairing and the QR join flow.** D-022. Trigger: a third device, or
      anyone outside this household. Design note already written at
      `.specify/memory/household-devices.md`
- [ ] **Duplicate detection.** Cut from MVP — see D-023. Trigger: it actually
      happens during the solo run and is annoying
- [ ] **Household isolation.** Today one household shares one public anon key
      and RLS cannot separate tenants. Trigger: Phase 12, or a second family

## Phase 7 — Visual identity & polish

- [ ] **H** Mascot decision: the baby as a character, or a separate creature
- [ ] **CD** Character state exploration — descriptive only, never evaluative
- [ ] **H/CD** Asset production. Consistency across the set is the hard part
- [ ] **CD** App icon and launch experience
- [ ] **CC** Implement the visual identity
- [ ] **H** Naming decision. Replace "BabyLiana" if it isn't the keeper

## Phase 8 — Solo run

- [ ] **H** Use it on your own night shifts, until you know what breaks
- [ ] **H** Run the coverage checklist — enter all seven photographed days
- [ ] **H** Note which secondary types you actually reach for
- [ ] **CC** Fix what broke
- [ ] **H** Kill criteria check

## Phase 9 — Reveal

- [ ] **H** All of it

## Phase 10 — Real use

- [ ] **H** Live with it until the pen's fate is clear
- [ ] **H** Notice whether the pen disappears. Don't ask
- [ ] **H** Log friction. Resist fixing live

## Phase 11 — Decision gate

- [ ] **CH** Interpret what happened
- [ ] **H** Decide: continue, shelve, go native, or explore product

## Phase 12 — Product exploration (conditional)

- [ ] **CH** Strategy
- [ ] **H** Everything involving other people's children
