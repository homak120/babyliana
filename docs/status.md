# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-15 (a second baby is reachable — D-060)

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0-6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. **719 checks pass across twenty-three
suites** — `verify-baby` is the new one — and everything through D-056 is
committed and pushed to `main`.

**Work has moved onto a branch, and this is the first one the repo has had.**
`product-ready-enhancement`, cut from `302ce22` on 2026-09-11. Every commit
before it landed on `main` directly, so nothing here assumes a branch: `main` is
still what is deployed and what the phones run, and a branch that is not merged
changes nothing on them.

**The branch has an origin of its own now.** `https://babylianav2.vercel.app`
builds `product-ready-enhancement`; `https://babyliana.vercel.app` builds `main`
and is what the two phones run. Both are public; only the second was ever
announced. **It is a staging front end, not a staging environment** — one
Supabase project sits under both origins, and that is deliberate: a second
project would turn stage 3's copy into an export and an import across two
endpoints instead of one statement across two schemas.

**Since stage 2 the two origins are genuinely separated, by schema rather than by
project.** v2 reads and writes `app`; `main` still reads and writes `public`. Up
until the schema flip v2 was a second front door onto the real log — it is not
any more, and a tap on it now lands in test data.

**The branch has a scope now: multi-tenancy (D-057, Q-013 closed).** Many
accounts per baby, many babies per account, **open signup**, and **sign in to
join a baby — never to log an event**. That supersedes D-022's one hard-coded
baby and rewrites the *Identity* section of `technical-constraints.md`; the
non-negotiable about logging survives, narrowed to onboarding.

**The gate on it was RLS, and that gate is now shut in `app`.** Stage 2 is done:
the client runs entirely on the `app` schema, sign-in is email OTP, onboarding is
four steps, `device` is `caregiver` throughout, and the hard-coded baby id is
gone. `public` still has one anon key and a `using (true)` policy on everything —
unchanged on purpose, because it is the rollback — and it closes at stage 5.
**Stage 3, copying the real log into `app`, is next and is the first
irreversible step.** `docs/tasks.md` § Phase 12 is the list, in dependency order.

**A second baby is reachable from the app as of D-060**, which is the first
feature to use what D-057's schema made possible rather than only migrating onto
it. The status row names the baby being logged for and is the way to the others;
the picker is shared with onboarding rather than copied. Three things the switch
had to get right are in D-060 — local rows outliving the id, a pull landing after
the id moved, and `baby.settings` following the install across. It refuses while
offline or with writes pending rather than holding a half-finished swap.

**Phase 12 is running ahead of Phases 8-11**, which are the solo run and the gate
that was meant to authorise it. Owner's call, recorded so a later session does not
read it as slippage. **The coverage run still outranks it** — see *Next action*.

**`public` is current through `0006`, and `0007` is applied.** It created a
second schema, `app`, and touched nothing in `public`. **Stage 1 is complete as
of 2026-09-14** — the migration ran, the six dashboard settings are configured,
and `npm run auth-check` passes end to end: a real code reaches a real inbox,
`create_baby` works, RLS scopes rows to one household, and **an unauthenticated
client reads nothing at all from `app`**. That last one is the fourth
non-negotiable actually enforced for the first time; `public` still fails it by
design and closes at stage 5. `supabase/README.md` is the
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
  state, the name of the baby being logged for — which is also the way to the
  household's other babies (D-060) — and the button that names this device.
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
- **First run** — email, a six-digit code, which baby, and which caregiver. A
  household with one baby is not asked to pick it; a reinstalled phone takes its
  old caregiver back rather than minting a second one. The photograph gate and
  both codes are gone (D-059).
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

- **D-060** — the household's other babies get a door and a label. The baby's
  name goes in the status row and opens a sheet holding the same picker
  onboarding uses; the event pull is scoped through the timeslot, which with one
  baby was the same set and with two was not. The switch flushes, moves the id,
  empties local state and pulls, in that order, and refuses while offline or with
  writes pending — D-058 is about never blocking a write, and this is not one.
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

**0. Stage 3 — the data migration — is the next migration step, and it is the
first irreversible one.** 325 timeslots and 395 events in `public`, written by
two phones over weeks and not recreatable from the paper. Everything up to here
could be undone by changing nothing. This cannot.

Three things need the owner's answer before the copy script is written, and none
are guessable:

- **Which caregiver each `public.device` becomes.** The copy maps old device ids
  onto `app.caregiver` rows, and only he knows which is which.
- **Which baby id survives.** Every `public.timeslot` points at
  `94c55231-…`; `app.baby` holds a different id from testing.
  **Recommended: keep the original**, so the copy is a straight insert and a row
  in `app` is the same row as its twin in `public`.
- **What happens to the test rows** currently in `app`.

One consequence of D-060 to carry into the copy: **`app.event` has no `baby_id`
and reaches a baby only through its timeslot.** A copy script that filters
timeslots and not events will move the wrong rows, the same way the pull did
before it was scoped.

Two things to do first, in this order: **the JSON export of `public`** (item 2
below — it is the only thing standing between a bad `delete` and 395
unrecoverable events), and **hardening `verify-s2`/`verify-s8` to provision their
own baby**. Those two write and delete rows in whatever baby the household has,
which is harmless against today's test data and is not once the real log is
there.

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

## Stage 2 is done, and verified against the real thing

**Onboarding works end to end on the deployed staging app.** Driven through
`scripts/inspect-onboarding.mts`, which seeds a real session and reports what the
network actually did rather than what a stub agreed to:

```
200  GET  /auth/v1/user                           session valid
200  GET  /rest/v1/baby                           empty -> "who are we logging for?"
200  POST /rest/v1/rpc/create_baby                Liana
200  GET  /rest/v1/caregiver                      empty -> "what should we call you?"
201  POST /rest/v1/caregiver?columns=...user_id   Dad
200  GET  timeslot / event / baby                 the log opens, cloud_done
```

**`verify-s2` and `verify-s8` are green**, which they had not been since the
schema flip. They are the two that hit the live database, and `verify-s2`'s first
assertion — *caregiver reached the server* — is exactly the one that would have
caught the `user_id` bug before a person ever saw it.

**Then it was tested on two real devices, which found things no suite could.**
New-user onboarding, a returning user on a second device, household scoping
across both, and realtime between them. All pass.

**The one that matters: a moment logged through the sheet never left the phone.**
`App` mounted `AddSheet` with an `onSaved` that refreshed the list and bumped a
counter and did not call `sync`. The write reached IndexedDB, the screen
repainted correctly, and it sat in the outbox — no push, so no realtime event, so
the other device learned nothing. The bar's quick buttons were fine because they
go through `afterWrite`, which is why it presented as *only the bar works*.

**It was invisible to every automated check, and that is the lesson.** A local
write repaints identically whether or not it reached the server; the only
observable difference is on the other phone, later. `verify-other` covers it now
by asserting a request actually went out, and that test was confirmed to fail on
the old code before being kept. `recordPushes` in `scripts/ui.mts` is a helper
rather than an inline stub because this is a class of bug, not one instance.

**Three call sites mount that sheet and only one drifted.** The other two, both
in `LogScreen`, called `sync`. The fix is to share `afterWrite` rather than
hand-roll two thirds of it, so a fourth cannot drift the same way.

**Five bugs in two days, and three were in test tooling, not the app.**
`enterApp` typing a gate code that no longer exists; the no-session guard scoped
so it broke six offline suites; and `verify-auth` calling `signOut()` in its
`finally`, revoking the session it had just saved so every restore failed with
`session_not_found` — which reads like an app bug and is not. Add to those two
checks that encoded *"nothing exists yet"* as if it were a rule: `verify-s2`'s
hard-coded baby id, and `verify-auth` asserting the household sees exactly one
baby. Both were correct until the system had real data in it, which is when a
test is supposed to start being useful. **The harness gets the least scrutiny and
has produced the most false alarms.**

**The app's own two were `caregiver.user_id` and the blocked IndexedDB upgrade**,
plus the sheet not syncing. All three needed either a real phone or a real
server; none were reachable from a stub.

## In flight

**D-060, uncommitted.** The second-baby work: `BabyPicker.tsx` (new, lifted out
of `Welcome`), `verify-baby.mts` (new, wired into `npm run verify`), and edits to
`sync.ts`, `settings.ts`, `LogScreen.tsx`, `Welcome.tsx`, `log.css`,
`decisions.md` and `event-model.md`. 719 checks pass. Each of the three fixes was
confirmed to fail the suite with the fix backed out, which is the only reason to
trust a check written the same hour as the code it covers.

Otherwise the tree is clean. `product-ready-enhancement` is fifteen commits ahead
of `main` and pushed. `main` at `302ce22` is what the two phones run and has not
moved since this branch was cut.

**What is deployed where.** `https://babylianav2.vercel.app` builds this branch
and is where all of the above was tested; `https://babyliana.vercel.app` builds
`main`. Both public, only the second announced.

**One credential lives outside git.** `.auth-session.json`, gitignored, holding a
real refresh token for the household account. `npm run auth-check` writes it and
`verify-s2`/`verify-s8` restore it, because `app` answers nothing without a
session and an OTP needs a human with an inbox. Deleting it stops those two
suites and breaks nothing else.

This section records **what is sitting uncommitted and why**, so a cold session
can read `git status` and know what it is looking at. It is not a changelog:
once work is committed its entry comes out, and `docs/decisions.md` carries the
reasoning from then on.

## A cutover hazard, found by testing

**`DB_VERSION` 2 → 3 blocks on any connection still holding version 2**, and
IndexedDB's answer to that is to wait forever — no error, no rejection. Found the
first time a real person walked the new first run: the button greyed out and
stayed that way, with nothing in the console.

**It will recur at stage 4, on the phones, and cannot be prevented from here.**
The `blocking` handler releases a held connection, but only from the side running
the *new* code — and at cutover the thing holding version 2 is the old build,
which does not have it. An installed PWA sitting backgrounded is enough.

What exists instead is a way through: the open races a five-second timeout, the
failure is broadcast once, and `App` renders a screen naming the cause with a
reload button. So the outcome is "close your other tabs" rather than an app that
stops. **Tell both parents to fully close the app once on cutover day**; it costs
a sentence and saves the one support call nobody can answer at 4am.

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

### 2026-09-15 (latest) — a second baby gets a door

Asked what tells you which baby you are logging for, and whether a second one can
be created and switched to. The answer was: nothing, and no. The schema had
supported it since D-057 — `baby_member` is a real many-to-many join, `create_baby`
works for any household, `fetchBabies` deliberately does not filter — and the
picker already existed inside `Welcome.tsx`. What was missing was a door.
`forgetBaby()` had been sitting there since stage 2 with a docstring naming this
exact case, uncalled.

Built it: the name in the status row, the picker lifted into `BabyPicker.tsx` and
shared with onboarding, the event pull scoped through the timeslot, and
`switchBaby` in `sync.ts`. D-060 has the reasoning.

**The interesting part was that the one-line version is wrong three times over**,
and all three surfaced from writing the suite rather than from writing the code.
Local rows outlive the id, so the order has to be flush, move, empty, pull — and
emptying before the pull rather than trusting it is what keeps a dropped signal
from rendering one child's feeds under another child's name. A pull already in
flight can land after the id moves, so `pull()` re-reads it before writing. And
`baby.settings` is per baby, so a cached value the new row does not carry reads
to `unsynced()` as a local change and gets **pushed onto the new baby's row** —
no error, both phones agreeing on the wrong answer. That one was proved: with the
fix backed out the suite fails with `POST baby`.

Continues a pattern worth watching. The previous entry recorded that checks had
twice encoded "nothing exists yet" as if it were a rule. This is the same shape
one layer up: the unscoped `event` pull, and a `Welcome` that could only ever be
reached once, were both correct right until the data stopped being singular.

Two smaller things went along with it — `someone new` was a one-way door out of
the picker, and `NamePrompt` had one family's baby name hard-coded in a
multi-tenant app.

Left uncommitted for review.

### 2026-09-15 — two devices found what no suite could

**Stage 2 is complete and tested for real.** New-user onboarding, a returning
user on a second device, household scoping across both, realtime between them.
`npm run verify` is green end to end — 699 checks, exit 0, including `verify-s2`
and `verify-s8`.

**A moment logged through the sheet never left the phone.** `App` mounted
`AddSheet` with an `onSaved` that refreshed the list and never called `sync`, so
the write reached IndexedDB, repainted correctly, and sat in the outbox. No push,
no realtime event, nothing on the other device. The bar's quick buttons went
through `afterWrite`, which does sync — hence *only the bar works*.

**No automated check could have seen it.** A local write repaints identically
whether or not it reached the server; the only difference is on the other phone,
later. It took two devices and someone noticing that one path behaved differently
from another. `verify-other` covers it now, and the test was confirmed to fail on
the old code before being kept.

**The harness is the least-scrutinised part of this project and the loudest.**
Of five bugs in two days, three were in test tooling: `enterApp` typing a gate
code that no longer exists, the no-session guard scoped so it broke six offline
suites, and `verify-auth` calling `signOut()` in its `finally` — revoking the
session it had just saved, so every restore failed with `session_not_found`,
which reads exactly like an app bug.

**Two checks encoded "nothing exists yet" as though it were a rule** —
`verify-s2`'s hard-coded baby id, and `verify-auth` asserting the household sees
exactly one baby. Both were correct until the system had real data in it, which
is precisely when a test starts being worth having. Worth watching for a third.

**Supabase rotates refresh tokens**, so `.auth-session.json` was good for one
restore and then failed. `restoreSession` and the inspector write the replacement
back now.

### 2026-09-14 — stage 1 is done, and it was mostly not SQL

**`npm run auth-check` passes end to end.** Real code, real inbox, real session,
and the last check is the one that matters: **an unauthenticated client reads
nothing at all from `app`**. D-057's gate is enforced rather than asserted.
`public` fails the same check by design and closes at stage 5.

**Running `0007` was one of seven things, and the other six were dashboard
settings.** That distinction cost a round trip — "the migration" and "stage 1"
were used interchangeably, and the owner reasonably read a finished migration as
a finished stage. `supabase/README.md` now records all six, because none of them
live in this repo and a rebuild from empty needs them.

**Custom SMTP turned out to be required, not optional.** Supabase locks email
template editing on the free tier while its built-in sender is in use — the
button offers Pro as the alternative. Any outside SMTP unlocks it at no cost.
An earlier revision of `0007`'s header called SMTP parked and said the built-in
sender was enough; it is not, because the template cannot be edited and so the
code is never a code.

**It did not need a domain.** Brevo verifies a single address by emailing it a
link. The cost is deliverability — a `gmail.com` From cannot be DKIM-aligned, so
mail can land in spam. A domain becomes worth it before open signup.

**Two templates, not one.** A new address gets *Confirm signup*; an existing one
gets *Magic Link*. The first sign-in is always a new address, so editing only
*Magic Link* leaves the first test arriving as a link with everything else
perfect — and nothing in the dashboard or the API says which was used.

**A magic link is not a fallback for the code**, for a device reason rather than
a taste one. It creates the session in whichever browser opened the email, so
mail read on a laptop signs the laptop in. On iOS a link opens Safari, and an
installed PWA has its own storage container, so it can miss the app on the same
device.

**`src/auth.ts` landed, deliberately additive.** No existing file changed. The
schema flip is its own step.

**One process note worth keeping.** `verify-auth` first asked "code or link?"
and *then* asked for the code; the first person to run it pasted the code into
the first question and was told the template was broken when it was working.
Ask for the thing you want and name the failure as the escape hatch — then the
natural answer cannot be the wrong one.
