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
- [ ] **H** iOS reality checks. **Full screen, no address bar and icon rendering
      are all confirmed** — the owner runs the installed PWA daily and the icon
      was replaced from the second handoff. What is still open is only the
      long-clock half: surviving a day backgrounded, and whether Safari evicts
      IndexedDB. That is Q-004 and it runs itself
- [x] **H** Install on your own phone and leave it there — installed; the
      "leave it" half is the Q-004 clock, now running

## Phase 4 — Technical design

- [x] **CH** Finalise event schema and field types — three tables, full
      Postgres DDL in `.specify/memory/event-model.md` § Schema (Postgres)
- [ ] **CH** Sync and merge behaviour — mostly written already in
      `.specify/memory/event-model.md`; confirm it and move on. Realtime is a
      latency optimisation, not a sync mechanism: no replay, so anything written
      while a phone was backgrounded is missed until the next reconcile
- [x] **CH** Confirm the `other` type list — settled in S6: the six schema types
      exactly, none with fields of its own. The design's answer, "pick one, write
      the rest in the note", is also the honest one while Q-006 is open
- [ ] **CH** Offline strategy. **No longer blocked on Q-004** — reconcile is a
      full refresh, so eviction is survivable by design: lose the cache,
      re-fetch. Q-004 now confirms rather than gates
- [ ] **H** Review and edit `.specify/memory/event-model.md` to final

## Phase 5 — MVP spec package

The artifacts already exist — `event-model.md`, `spike-spec.md`, the design
handoff and its reconciliation note. D-011 made spec a track, not a phase, and
the track has been running. What is left is the slicing.

- [x] **CH** Slice the build so each session has a closeable scope —
      `.specify/memory/build-slices.md`
- [ ] **H** Skim the artifacts once as a set, for contradictions between them

## Phase 6 — Build

Sliced in `.specify/memory/build-slices.md` — ten slices, each ending with the
app still working and something new demonstrable, each with a concrete "done
when". Read that first; this list is the checklist view of the same thing.

- [x] **S0** Clear the decks — migration applied, Liana inserted and her id
      hard-coded in `src/config.ts`, spike replaced by a read-only smoke test
- [x] **S1** Log a moment locally — IndexedDB, the write path, the add sheet
      skeleton, the milk block. `npm run verify` covers the done-when
- [x] **S2** Make it shared — push then reconcile, realtime on top. Verified
      against the live database, including the stale-after-backgrounding bug
- [x] **S3** The home screen — elapsed hero, totals, recent list, mascot,
      day separators, theme by clock, tokens.css wired
- [x] **S4** Diapers — pee/poop, optional colour and consistency revealed only
      when poop is on. New blocks default to pee, per the real log
- [x] **S5** Time entry — steppers with hold-to-repeat, offset pills, direct
      numeric entry, optional end time. Backdating and periods both work
- [x] **S6** Notes and the `other` type — the escape hatch
- [x] **S7** The day view — the paper-shaped table, date printed once per day,
      date strip, and the tab bar now that there are two screens
- [x] **S8** Edit and delete — swipe reveals both, on the home list as well as
      the day table; delete takes the whole moment behind a confirm sheet that
      names it (D-025 as amended, Q-012). Plain updates, real deletes (D-003)
- [x] **S9** Ready for the solo run — name entry (skippable), theme by clock,
      update strategy. **Offline and deploy checks are yours, on the phone**
- [x] **CC** Post-slice work from the second design handoff: the period picker
      and its `more` pill (D-027), totals recalculated over whatever period is on
      screen, the tab bar matched to the prototype, the app shell rebuilt as a
      flex column, and the mascot artwork wired in

- [ ] **H** Run the coverage checklist: enter all seven photographed days. This
      is the gate into Phase 7, not a formality. **It is the single biggest
      open item in the project** — everything else on this list is either the
      owner's judgement or small

### Before reveal, not before MVP

- [ ] **CC** JSON export of the baby, timeslots, events and devices.
      `technical-constraints.md` requires it before a second person sees the
      app — that is Phase 9, not first use. Getting a file off an installed iOS
      PWA is the hard part, not the format
- [ ] **CD/CC** Settings screen — the design does not have one, and export needs
      somewhere to live

## Post-MVP — deliberately deferred

Not "later" as in forgotten. Deferred because the fastest path to a usable
first version does not go through them, and each has a named trigger.

- [ ] **Pairing and the join flow.** D-022. Trigger: a third device, or anyone
      outside this family. Design note already written at
      `.specify/memory/baby-and-devices.md`
- [ ] **Duplicate detection.** Cut from MVP — see D-023. Trigger: it actually
      happens during the solo run and is annoying
- [ ] **Data isolation.** One public anon key, and RLS cannot separate one
      family's rows from another's. Trigger: Phase 12, or a second family

## Phase 7 — Visual identity & polish

**Mostly delivered by the second design handoff (2026-09-04).** What is left is
the owner's judgement, not production work.

- [ ] **H** Mascot decision: the baby as a character, or a separate creature.
      Q-003. The art now exists and the app ships it, so this is no longer
      blocking anything — but the rights caution in Q-003 stands and is the
      owner's call, not an agent's
- [x] **CD** Character state exploration — four states delivered as artwork
      (settled, awake, hungry, sleeping), with the *logged* flash reusing awake.
      Descriptive throughout; nothing evaluative
- [x] **H/CD** Asset production — a consistent set supplied and shipped as WebP
      with PNG fallbacks
- [x] **CD** App icon — replaced from the second handoff. The icon is the plush,
      not the character. Launch experience still open
- [x] **CC** Implement the visual identity — artwork wired to derived state,
      icons rebuilt, hero geometry matched to the prototype
- [ ] **H** Naming decision. Replace "BabyLiana" if it isn't the keeper. Q-008,
      and it gets more expensive with every asset that carries the name

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
