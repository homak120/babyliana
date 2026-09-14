# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-14

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0-6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. **694 checks pass across twenty-one
suites**, and everything through D-056 is committed and pushed to `main`.

**Work has moved onto a branch, and this is the first one the repo has had.**
`product-ready-enhancement`, cut from `302ce22` on 2026-09-11. Every commit
before it landed on `main` directly, so nothing here assumes a branch: `main` is
still what is deployed and what the phones run, and a branch that is not merged
changes nothing on them.

**The branch has an origin of its own now.** `https://babylianav2.vercel.app`
builds `product-ready-enhancement`; `https://babyliana.vercel.app` builds `main`
and is what the two phones run. Both are public; only the second was ever
announced. **It is a staging front end, not a staging environment** — one
Supabase project underneath, and until stage 2 points the client at `app`, v2
reads and writes `public` with the same key and the same hard-coded baby id.
A tap on v2 lands in the real log.

**The branch has a scope now: multi-tenancy (D-057, Q-013 closed).** Many
accounts per baby, many babies per account, **open signup**, and **sign in to
join a baby — never to log an event**. That supersedes D-022's one hard-coded
baby and rewrites the *Identity* section of `technical-constraints.md`; the
non-negotiable about logging survives, narrowed to onboarding.

**The gate on it is RLS.** Today one anon key, one hard-coded baby id and a gate
code in a public bundle separate nobody from anybody — fine while the only data
is this family's (D-008), a breach the moment a stranger signs up. `docs/tasks.md`
§ Phase 12 is the list, in dependency order.

**Phase 12 is running ahead of Phases 8-11**, which are the solo run and the gate
that was meant to authorise it. Owner's call, recorded so a later session does not
read it as slippage. **The coverage run still outranks it** — see *Next action*.

**`public` is current through `0006` and every one of those is applied. `0007`
is written and has not been run.** It creates a second schema, `app`, and
touches nothing in `public` — see *In flight*. `supabase/README.md` is the
record of what exists and when each one ran — trust it over this file for
migration state. Two rules sit around it. **Additive
only** (D-039): no column is ever dropped or narrowed again, because "after
every phone has updated" is not an observable moment when the service worker
updates lazily, there is no forced update, and one of the phones belongs to the
other parent. And **a schema change must reach Supabase before the code that
writes it is pushed**, because sync upserts whole rows — a client naming a
column the database does not have stalls its outbox, silently.

### What exists

Local-first writes to IndexedDB that never block on the network, and
push-then-reconcile sync with Supabase.

- **Home** — mascot artwork by derived state, a top card with three leads
  (elapsed / next feeds / mascot) chosen from a rail beside it, a prep-timer
  pill, totals, and the recent list with swipe-to-edit-and-delete behind a
  confirm sheet. The status row carries the clock, who is logging, the sync
  state, and the button that names this device.
- **Report** — the paper-shaped day table with a scrolling date rail and a
  period picker, plus an insights mode: milk intake, daily rhythm, wet and poop,
  diapers a day, milk by source, poop colours, sleep, and growth when there is
  a weight.
- **The add sheet** — one moment, with milk, diaper, sleep, weight, temperature,
  supplement and other, a free-text note on every one of them, and a time card
  carrying its own date, an optional end with its own date, and offsets both
  ways.
- **The bar** — a bottle and a bedtime button that write straight to the log, a
  diaper that opens the sheet, and `+` for everything else. Each of the first
  two becomes an *end* pill while its period is running.
- **First run** — a photograph gate, name entry, and a second gate code that
  hands a reinstalled phone its old identity back rather than minting a new one.
- **Settings** — five sections behind the card's `tune` button: the quick
  bottle's volume and source, the supplement prefill, the prep-prompt lead, the
  feeding cycle, and this device's clock format. Each row says whether
  it reaches *everyone* or stays *only here* — who, not how many and not what
  kind.
- Two mascot sets and a theme switched by the clock; 12- and 24-hour times, per
  phone.

**An offline-capable PWA at 24 entries / 1311.58 KiB precached.** The app icon
is the v2 art as of 2026-09-06 — the whole `public/` set replaced, full-bleed on
white. The 512 is 435 KB where the old one was 243, which is most of why the
precache sits where it does; the 1024 is excluded, being needed only at install.

### What changed most recently

Newest first, and **this is an index, not a record** — `docs/decisions.md`
carries the reasoning for every one of these, and for everything older.

- **D-056** — the device-name editor goes back to the status row, reversing
  half of D-055. The clock format stays in settings. A settings screen answers
  questions and cannot ask one: the button labels itself *name this phone* until
  there is a name, and a name is typed, so it commits on a save button rather
  than on blur.
- **D-055** — the `tune` sheet becomes a settings screen. Three new keys on
  `baby.settings` (bottle, supplement, prep lead), no migration — which is
  D-052 paying off. `settings.ts` is now a registry so the *next* setting costs
  an entry rather than a bespoke hydrate/isDefault/same trio, and `parse`
  returning null for junk stops a corrupt row resetting the other phone. No
  save button: every control commits on the tap.
- **D-054** — the home list's feed chip counts in seconds while the feed is
  open, in rose, with its own *end* button — the mirror of the sleep chip. It
  said nothing at all before, which stopped being defensible when D-053 made
  every quick bottle an open feed. No resume: reopening a sleep is the undo for
  a stir, and a feed has no equivalent.
- **D-053** — the bottle and the bedtime button write straight to the log, one
  tap and no sheet, so `+` is now the only route that asks for a volume. The
  home list's sleep chip counts in seconds while it runs and carries an *end*
  button, then a *resume* once it is over, which reopens that same sleep rather
  than starting a new one. The report's day strip becomes `all days` and `more`
  pinned around a scrolling rail that follows a page swipe as well as a tap.
- **D-052** — `baby.settings jsonb`, one object keyed by setting name, with the
  feeding cycle as the first key, so the two phones agree on the rhythm instead
  of each holding its own opinion of it.
- **D-050, D-051** — the status card as the handoff draws it: a prep pill, four
  estimated next feeds each naming the window that produced it, and the feeding
  windows editable behind a `tune` button — the app's first settings screen.
- **D-049** — three more charts on the report, on a series palette that was
  computed and validated rather than eyeballed.
- **D-039** — additive-only schema, written after a dropped column silently
  stopped the second phone syncing while it showed *offline*. The most expensive
  lesson on this list.

**What is left is mostly not code.** Two build items remain — export and a
settings screen — and the rest is the owner's judgement. See *Next action*.

## Next action

**1. The coverage run. This is the gate and it is the owner's.** Enter the
photographed days from `.specify/memory/paper-log/` into the app on the phone,
against the checklist in `coverage-requirement.md`. **Ten days, not seven** — the
photographs run 8/26–9/4, three days past what the baseline covers. Not in a
script — the point is thumbs, at speed, in the dark. If something cannot be
entered, that finding outranks any further polish. It is the single biggest open
item in the project.

**2. One build item left, `CC`:**

- **JSON export** — `technical-constraints.md` requires it before a second
  person sees the app, so it is a Phase 9 gate rather than a first-use one.
  Getting a file off an installed iOS PWA is the hard part, not the format.
- ~~A settings screen~~ — **done, D-055.** Export now has somewhere to live,
  which was half the reason it was on this list.

**3. Three owner decisions, none blocking.** Q-013 is closed — D-057. Q-003 (mascot identity and the rights caution), Q-008
(the final name, which gets dearer with every asset carrying it), Q-006 (which
of the *remaining* secondary types earned promotion — sleep already went, by
design in D-029 rather than by the solo run; weight, temperature, supplements
and spit-up are still answered by use, not by thinking).

**4. Q-004 runs itself.** Whether Safari evicts IndexedDB on a backgrounded
phone. The clock is running; nobody needs to do anything.

## How to work on this

Read `CLAUDE.md` first, then this file. Beyond that:

- **`npm run verify`** is the gate: typecheck, **ten** data-layer suites
  (`verify-s1`…`s9` plus `insights`), a build, then **eleven** browser suites
  against it — `swipe`, `period`, `hero`, `milk`, `period-row`, `overlay`,
  `sleep`, `feed`, `welcome`, `report`, `other`. Twenty-one in total. The browser
  eleven serve their own build and touch no database, so they are the cheap ones
  to run on a UI change. Two of the data-layer suites — `s2` and `s8` — hit the **live**
  database and delete only ids they created in that run; never widen one to a
  filter. **Those two are the ones that go red when the schema and the app
  disagree** — which is how a stray column got caught on 2026-09-05 before it
  reached the database.
- **`scripts/ios/`** drives the iOS Simulator with real touch, and
  `measure-screenshot.mts` measures a screenshot the owner sends. Both exist
  because this project has repeatedly shipped fixes that passed on desktop and
  did nothing on a phone. Read `scripts/ios/README.md` before using them.
- **When a design detail and the handoff prose disagree, the prototype wins.**
  The README said the elapsed hero was 64px and the mascot 108px; the prototype
  draws 44px in a 100×96 slot. Following the prose broke the layout twice.

## In flight

**Nothing is uncommitted.** `product-ready-enhancement` is four commits ahead of
`main` and pushed; the working tree is clean. `main` at `302ce22` is what is
deployed to the phones.

**What is in flight is configuration, not code — stage 1 is being applied by
hand.** `0007` is committed and **not yet run**, and the four dashboard settings
its header lists are not yet set. Nothing in stage 1 can affect the phones.

`0007` creates a **second schema, `app`** — `baby`, `caregiver`, `baby_member`,
`timeslot`, `event` — with RLS and policies written at creation, `is_member_of`,
`create_baby`, grants to `authenticated` only, and realtime. **It does not touch
`public`: not a column, not a policy, not a grant.** So it can be run whenever,
and the two phones cannot notice. If it is wrong, drop the schema and run it
again.

That is the point of the approach, taken on 2026-09-13. Every earlier plan
altered `public` — a rename, a compatibility view, a staged policy drop — and
each had a window where the phone that cannot be reached would stall its outbox.
A parallel schema has no such window, and leaves `public` intact as the rollback.

**D-058 and D-059 landed this session** — the offline rule stops being a design
argument, and the gate code is replaced by the login rather than kept beside it.

**Two things are still decided and not written down in `decisions.md`:** the
household account model (one `auth.users` row per household, many caregivers
under it, sign in with a shared inbox and pick who you are) and the parallel
schema itself. Both supersede parts of how D-057 was expected to land. A cold
session should read this section and then write that decision record before
building on either.

This section records **what is sitting uncommitted and why**, so a cold session
can read `git status` and know what it is looking at. It is not a changelog:
once work is committed its entry comes out, and `docs/decisions.md` carries the
reasoning from then on.

## Open threads

Noticed, not blocking, no owner yet.

- **Unresolved marks on the paper log.** Several `1`s in the Pee/Poop column
  appear underlined, and one 9/1 milk cell may be a ditto mark rather than a
  number. Both may just be handwriting crossing the ruled line. Deliberately not
  recorded in the baseline as fact. Needs human eyes on the original page — the
  coverage rule is *every mark has a home*, so if an underline means something,
  the model is missing a dimension.

  **Sharpened 2026-09-05 by re-reading the photographs at full resolution.** The
  9/1 `00:22` cell reads as `80` to me; if it is instead a ditto it inherits
  `30(B)+30(F)` from the row above and becomes two feed rows, not one — a
  materially different entry either way. Two more: on 8/30 the two afternoon
  hours are overwritten and unreadable (`1?:?`, twice), so two moments cannot be
  placed at all; and 8/31 `12:40` is written above `04:10`, which is either the
  out-of-order insertion the baseline already describes or a slipped leading
  digit. All four are left as holes in the backfill script rather than guessed.

- **The paper log runs three days past the baseline.** `paper-log-baseline.md`
  covers 8/26–9/1; the photographs also carry 9/2, 9/3 and 9/4. Those days
  introduce at least one thing the baseline never saw — `Nasal` written in the
  Pee/Poop column on 9/3, which is neither a feed nor a diaper and lands on
  `other`.

  **The baseline now says so, in a dated note at its head, and nothing more.**
  Extending its tables is a re-read of the photographs against the authority
  document, not a doc edit, and it is the owner's — an agent widening the primary
  requirements document from its own transcription would make the transcription
  the authority. The note names the gap so a cold reader cannot mistake the
  document for complete.
- **No Spec Kit scaffold.** `.specify/memory/` follows the convention but there
  is no `constitution.md`, no scripts, no templates. The non-negotiables in
  `CLAUDE.md` are effectively the constitution. If Phase 5 intends to run real
  Spec Kit commands, the scaffold has to exist first.

## Session log

Newest first. **Three entries maximum** — delete the oldest when adding a
fourth. This is orientation, not history. `git log` is the history.

### 2026-09-14 (latest) — the offline rule stops being an argument

**D-058. Local-first comes out of the design conversation and stays in the
code.** The invariants are unchanged and nothing in `src/` moves. What changed
is that they are no longer a test every proposal has to pass: no agent
challenges a design with "but what about offline at 4am", and no work is
justified by an offline scenario this deployment has not actually hit.

**The owner raised it because it had cost three conversations in a row** — the
login flow, the session cache, and the bootstrap order — and in all three the
proposal was already correct. The invocation produced a round trip and no design
change, while the thing that actually gates the project is getting a
multi-tenant version out. A real report of a parent unable to log reopens it; a
hypothetical does not.

**The session answer, recorded so it is not re-derived:** a session cached in
`localStorage` and refreshed in the background satisfies "never require a login
to log an event". That is the whole of it. One implementation note survives —
don't `await` a network auth call before first paint — and it is a note, not a
constraint.

**D-059. The gate code goes when the login lands.** `SECRET_CODE` was standing
in for authentication that did not exist, and D-030 already called it a doormat.
The household email plus an expiring OTP is the same idea done properly — not in
the bundle, not per deployment. `RECOVERY_CODE` goes too; the caregiver picker
behind it becomes an ordinary onboarding step.

**The stage 2 bootstrap is agreed**, owner's design: session → baby (cached in
`localStorage`, auto-selected when there is only one) → caregiver (the existing
`babyliana.device_id`, renamed) → log. It needs **no change to `0007`**:
`create_baby()` covers first run, and a second parent signing in with the
household email already has the `baby_member` row. Three of its four pieces
exist in the code already under older names.

### 2026-09-14 — stage 1 starts, and staging gets its own front door

**The branch is deployed at `https://babylianav2.vercel.app`**, built from
`product-ready-enhancement`, public but unannounced. Production stays on
`https://babyliana.vercel.app` off `main`. The owner set this up so the
migration has somewhere to live that the phones never see.

**What it is not is a staging environment, and the distinction matters.** One
Supabase project sits under both origins. Verified by fetching the two bundles:
identical project URL, identical publishable key, identical `BABY_ID`, 55 bytes
apart — the welcome heading. So v2 is a second front door onto the real log
until stage 2 switches the client to `app`. Do not hand it to anyone as a
sandbox, and do not tap the bottle button on it.

**One project is deliberate, not an oversight.** A separate project for staging
would turn stage 3's copy into an export and an import across two endpoints
instead of one SQL statement across two schemas. The schema boundary is the
isolation.

**Site URL goes to v2 for now, with both origins in Redirect URLs, and flips
back at cutover.** Safe because `main` never calls `signInWithOtp` and so never
reads the setting. All four auth settings are project-wide; there is no
staging-only value for any of them. `0007`'s header carries this.

**One correction to the stage-1 done-when.** The header said it ends with
`verify-s2` pointed at `app`. That is not reachable from configuration:
`verify-s2` uses the anon key, the `device` table and the hard-coded `BABY_ID`,
so repointing it is stage 2 client work. Stage 1's real gate is an object count
in the SQL Editor plus a six-digit code arriving in a real inbox.

**Custom SMTP is parked, with a reason.** It needs a domain whose DNS the owner
controls, and `*.vercel.app` is not one. The built-in sender proves a code
arrives; SMTP becomes the gate on *opening signup*, not on building it.

### 2026-09-13 — the new schema is built beside the old one

**Multi-tenancy stops being a change to `public` and becomes a second schema.**
`0007` is written and unrun. It creates `app` with five tables, policies at
creation time, and no `anon` grant anywhere — that omission *is* the isolation,
so there is no later migration that closes a door.

**This replaced three progressively worse plans, and the reason each failed is
the same one.** Renaming `device` in place breaks a client still calling it. A
compatibility view fixes reads and not writes — PostgREST upserts with
`ON CONFLICT`, and a view has no unique index to infer. Dropping the `anon`
policies is a one-way door with no rollback. All three assumed every phone can
be brought forward on demand, and D-039 already established that none can.

**`device` was never a device.** `src/device-id.ts` explains its recovery flow
as stopping a reinstalled phone from minting "a second device for a parent who
already has one" — a second *parent*. It is `app.caregiver` now, renamed for
free in a table nothing is running against yet.

**The account is the household, not the person.** One `auth.users` row holding a
shared inbox; Dad and Mum both sign in with it and pick who they are. That makes
`caregiver` 1:N with the account, which deletes the `profile` table an earlier
draft had proposed — 1:1 could never have held two parents. It also deletes
`RECOVERY_CODE` outright: a reinstalled phone signs in and picks itself, which
is the screen `Welcome.tsx` already has behind that code.

**`app.event` does not create `grams` and `celsius`.** Dead in `public` since
`0003`, dropped by `0004`, restored by `0005` when a phone stopped syncing, and
frozen by D-039 ever since. A fresh table inherits none of it, and this was the
only chance.

**Three things surfaced that only fail at runtime**, all handled in the file: an
RLS policy on `baby_member` that reads `baby_member` recurses infinitely;
`with check (is_member_of(id))` deadlocks on the first baby insert, because the
membership row cannot exist yet — hence `create_baby`; and `alter default
privileges` is what stops the *next* table in the schema being silently
unreachable.

**Not everything in stage 1 is SQL.** Exposed schemas, the OTP expiry, the
`{{ .Token }}` template edit and custom SMTP are dashboard work, and the SMTP
domain verification is DNS, so it is the only item with a wait in it. The file's
header carries the list. Stage 1 is done when a real code reaches a real inbox
and `verify-s2` passes against `app`.
