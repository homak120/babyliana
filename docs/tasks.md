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

## Phase 2 — Structural design & prototype

- [ ] **CD** Clickable prototype from the paper log photo + event model
- [ ] **CD** Night surface and day surface variants
- [ ] **CD** Palette tested at reduced brightness
- [ ] **H** Try the prototype. Ideally at night, not at a desk
- [ ] **H** Decide button hierarchy and primary readout → closes Q-001, Q-002
- [ ] **CH** Record the resolved decisions in `decisions.md`
- [ ] **H** Commit mockups to `.specify/memory/`

## Phase 3 — Infrastructure spike

- [x] **H** Create the GitHub repo. Public, deliberately — see D-008
- [ ] **H** Create the Supabase project. Do this by hand — you'll be debugging
      it alone at 11pm one day
- [ ] **CC** Vite + React + TypeScript scaffold
- [ ] **H** First deploy by hand (Vercel or Cloudflare Pages)
- [ ] **CC** Wire git push → build → deploy; prove with a trivial change
- [ ] **CC** Throwaway table; reads and writes from the deployed page
- [ ] **CC** Realtime proven across two devices
- [ ] **CC** PWA manifest; Add to Home Screen works
- [ ] **CC** Confirm it opens offline
- [ ] **H** Environment variables and secrets handled properly
- [ ] **H** iOS reality checks — full screen, no address bar, icon rendering,
      survives a day backgrounded, whether Safari evicts IndexedDB
- [ ] **H** Install on your own phone and leave it there
- [ ] **H** Delete spike application code before Phase 6 (D-012)

## Phase 4 — Technical design

- [ ] **CH** Finalise event schema and field types
- [ ] **CH** Sync, merge, and duplicate-detection behaviour
- [ ] **CH** Household ID and QR join flow
- [ ] **CH** Offline strategy, informed by the Safari findings from Phase 3
- [ ] **CH** Export format
- [ ] **H** Review and edit `.specify/memory/event-model.md` to final

## Phase 5 — MVP spec package

- [ ] **CH** Draft the Spec Kit artifacts
- [ ] **H** Edit them. Do not accept wholesale — the spec is where your judgment
      gets encoded
- [ ] **H** Write `CLAUDE.md` and `.github/copilot-instructions.md` to final
- [ ] **CH** Slice the build so each session has a closeable scope

## Phase 6 — Build

- [ ] **CC** Vertical slice: one event type, one device
- [ ] **CC** Same event visible on a second device
- [ ] **CC** JSON export. Early, not late — `technical-constraints.md` makes it
      a non-negotiable before a second person sees the app, and the free tier
      has no backups
- [ ] **CC** Feed events, including the two-component split
- [ ] **CC** Diaper events, including colour and consistency
- [ ] **CC** Backdating with approximate and unknown times
- [ ] **CC** Edit, correct, and delete via correction events
- [ ] **CC** Free-text note on every event
- [ ] **CC** Secondary types behind a "more" affordance
- [ ] **CC** Derived views — time since last feed, daily totals, day list
- [ ] **CC** Household QR join flow
- [ ] **CC** Duplicate detection at read time
- [ ] **CC** Keep the spike page on a route as a smoke test

## Phase 7 — Visual identity & polish

- [ ] **H** Mascot decision: the baby as a character, or a separate creature
- [ ] **CD** Character state exploration — descriptive only, never evaluative
- [ ] **H/CD** Asset production. Consistency across the set is the hard part
- [ ] **CD** App icon and launch experience
- [ ] **CC** Implement the visual identity
- [ ] **H** Naming decision. Replace "BabyLiana" if it isn't the keeper

## Phase 8 — Solo run

- [ ] **H** Use it on your own night shifts, several nights
- [ ] **H** Run the coverage checklist — enter all seven photographed days
- [ ] **H** Note which secondary types you actually reach for
- [ ] **CC** Fix what broke
- [ ] **H** Kill criteria check

## Phase 9 — Reveal

- [ ] **H** All of it

## Phase 10 — Real use

- [ ] **H** Two to three weeks of living with it
- [ ] **H** Notice whether the pen disappears. Don't ask
- [ ] **H** Log friction. Resist fixing live

## Phase 11 — Decision gate

- [ ] **CH** Interpret what happened
- [ ] **H** Decide: continue, shelve, go native, or explore product

## Phase 12 — Product exploration (conditional)

- [ ] **CH** Strategy
- [ ] **H** Everything involving other people's children
