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
- [x] **S6** Notes and the `other` type — the escape hatch. **Extended 2026-09-06
      (D-036):** weight, temperature and supplement carry their own inputs; the
      other two still write into the note
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
- [x] **CC** Post-slice work from the *third* design delivery: sleep promoted to a
      first-class type with its own bubble and block, an open sleep expressed as
      a missing end time, a contextual tab bar whose sleep icon becomes a live
      "end sleep" pill (D-029), two mascot sets switched by clock, and a
      photograph gate before the welcome
- [x] **CC** The rest of the third design delivery's card work: the lead-view
      switcher (a three-icon rail that swaps the top card between elapsed,
      combined and mascot), an open sleep's running duration and a second
      end-sleep button on the card itself, and the hand-drawn crescent-and-arrow
      icon both end-sleep controls now carry
- [x] **CC** A typed time keeps its own day (D-031) — `withHourMinute` anchored
      to today rather than to the moment being edited, so editing an older entry
      dragged it forward; and a one-minute future tolerance filed a time nudged
      two minutes ahead a day early
- [x] **CC** The third delivery's **insights screen** — a log/insights pill pair
      on the report screen, a 3d/7d range, and six cards: milk intake with
      per-day bars and a day-end projection, a days × 24h rhythm heatmap, wet and
      poop as half-cards, sleep, and growth. All derived at render time; nothing
      new is stored. `verify-insights` covers the arithmetic, `verify-report`
      renders it
- [x] **H/CC** **D-032** — the watch-list card asserts things about the baby,
      which `CLAUDE.md` forbade. Raised as a conflict before building; the owner
      chose the handoff. `CLAUDE.md` and `docs/plan.md` Phase 7 amended so the
      rule and the shipped code agree

- [ ] **H** Run the coverage checklist: enter all **ten** photographed days —
      8/26 to 9/4, three of them past what the baseline writes up. This is the
      gate into Phase 7, not a formality. **It is the single biggest open item in
      the project** — everything else on this list is either the owner's
      judgement or small
- [x] **CC** Transcribe the photographed days and backfill them into Supabase —
      `supabase/imports/2026-09-05_paper-log-backfill.sql`, 80 timeslots and 144
      events, executed end to end against a throwaway database. **Explicitly not
      a substitute for the line above**: it proves the schema holds the data, not
      that the app can capture it with thumbs at 4am

### Before reveal, not before MVP

- [ ] **CC** JSON export of the baby, timeslots, events and devices.
      `technical-constraints.md` requires it before a second person sees the
      app — that is Phase 9, not first use. Getting a file off an installed iOS
      PWA is the hard part, not the format
- [x] **CD/CC** Settings screen — D-055. The `tune` sheet is now five sections:
      quick bottle, supplement preset, prep prompt, feeding cycle, and this
      device. The clock-format toggle came off the status row into it; the name
      button went with it and came back (D-056), because a device that has never
      been named has to be asked rather than wait to be found. Every row says
      whether it reaches everyone or stays only here.
      **Export still has nowhere to live** — it is the next thing to land in it

## Post-MVP — deliberately deferred

Not "later" as in forgotten. Deferred because the fastest path to a usable
first version does not go through them, and each has a named trigger.

- [ ] **Pairing and the join flow.** D-022. **Trigger fired 2026-09-11** —
      D-057 chose multi-tenancy, so this is Phase 12 below. The design note at
      `.specify/memory/baby-and-devices.md` is live again, with its token shape
      corrected to a join table
- [ ] **Duplicate detection.** Cut from MVP — see D-023. Trigger: it actually
      happens during the solo run and is annoying. Still deferred
- [ ] **Data isolation.** One public anon key, and RLS cannot separate one
      family's rows from another's. **Trigger fired** — D-057 makes it the gate
      on anyone outside this family signing up. Phase 12 below

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
      with PNG fallbacks, two sets deep (day and night, switched by clock), plus
      the welcome gate photograph
- [x] **CD** App icon — replaced from the second handoff. The icon is the plush,
      not the character. Launch experience still open
- [x] **CC** Implement the visual identity — artwork wired to derived state,
      icons rebuilt, hero geometry matched to the prototype
- [x] **CC** Feeds run live, and milk in words — the third handoff's §11 and
      §12. Derived from the timeslot's end time, no new column (D-033);
      `(B)`/`(F)` retired (D-034)
- [ ] **H** Naming decision. Replace "BabyLiana" if it isn't the keeper. Q-008,
      and it gets more expensive with every asset that carries the name

## Phase 8 — Solo run

- [ ] **H** Use it on your own night shifts, until you know what breaks
- [ ] **H** Run the coverage checklist — enter all ten photographed days
- [ ] **H** Note which secondary types you actually reach for. Q-006, now
      covering weight, temperature, supplements and spit-up — sleep left the list
      early, by design in D-029 rather than by observed use
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

## Phase 12 — Product exploration

**No longer conditional, and started early.** D-057 answers Q-013: product ready
means multi-tenant — many accounts per baby, many babies per account, open
signup, sign in to join and never to log. Work happens on
`product-ready-enhancement`.

**Sequence warning, not a task.** This runs ahead of Phases 8-11, which are the
solo run and the gate that was meant to authorise it. The **coverage run**
(`docs/status.md` § *Next action*) still outranks everything here: it is the last
thing that can show the app cannot record the real paper log, and anything built
over that finding gets built twice.

- [x] **CH** Strategy — what "product ready" means. D-057
- [ ] **CC** **Ownership schema.** `baby_member` as a join table — many accounts
      per baby, many babies per account. Additive only (D-039), so this has to be
      right the first time, and it must reach Supabase **before** any client code
      naming it is pushed, or the outbox stalls silently
- [ ] **CC** **Accounts.** Supabase Auth, open signup. The rule it must not
      break: onboarding once per install, then the log opens offline and
      indefinitely — an expired token never blocks a write
- [ ] **CC** **RLS per baby**, through the join table, plus the explicit Data API
      grants the spike learned the hard way (`.specify/memory/spike-spec.md`).
      This is the gate: until it exists, nobody outside this family can sign up
- [ ] **CC** **Onboarding: create a baby, or join one by code.** Replaces the
      hard-coded baby id and the gate. A readable typed code, not a QR — no
      camera, and it can be sent to someone who is not in the room
- [ ] **CC** **Migrate Liana's rows into the new shape.** This is live data on two
      phones in daily use, not a fixture. It cannot be recreated from the paper
- [ ] **CC** **Retire the pilot scaffolding.** The hard-coded baby id,
      `SECRET_CODE` and `RECOVERY_CODE` in `Welcome.tsx`, the gate fill in
      `scripts/ui.mts` that eleven browser suites depend on, and `SpikePage` with
      its printed device UUID
- [ ] **CC** **JSON export.** Already the pre-reveal requirement (D-024); with
      open signup the second person is a stranger, so it is a prerequisite
- [ ] **CC** **Delete my data.** A family that signs up can take their baby's
      data out and remove it. On this list only because signup is open
- [ ] **CH** **Re-size the free tier and write the privacy posture.**
      `technical-constraints.md` sizes Supabase against one family; open signup
      has no ceiling by design
- [ ] **H** Everything involving other people's children
