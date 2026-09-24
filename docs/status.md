# Status

**The only file that records where the project is.** Every other document
describes what the project *is* — stable, low-churn. This one is the position,
and it changes every session.

If you are picking this up cold, read this first and trust it over any status
claim elsewhere. If something here contradicts another document, this wins on
*position* and the other document wins on *substance*.

Keep it under a screen. Update it before you finish.

Last updated: 2026-09-24 (the page summary is bubbles; `Q-014` and `Q-015` are open and waiting)

---

## Position

**The app is built, deployed, in daily use by the owner, and syncing real data
between two phones.** Phases 0-6 are done bar three items; Phase 7 was largely
delivered by the second design handoff. **769 checks pass across twenty-four
suites** — `verify-day-summary` is the new one.

**The multi-tenant work is merged to `main` and deploying.** `52b1fb8`, a
`--no-ff` merge of all nineteen commits of `product-ready-enhancement`, pushed
2026-09-24 with `npm run verify` green on `main` itself. `main` had not moved
since `302ce22`, so the merge was clean.

**This is the cutover, and it is not finished when the deploy is.** The phones
update lazily through the service worker, so each one flips at a moment nobody
chooses. Until both have flipped, one phone may still be on the old build writing
to `public` while the other writes to `app`. The remaining steps are in *Next
action* and none of them are code.

**Rolling back is one command:** `git revert -m 1 52b1fb8`. `public` is untouched
and still current, so the old build picks up exactly where it left off. That is
the whole reason `public` keeps its anon key and its `using (true)` policies
until stage 5.

**Both origins now build the same thing.** `https://babyliana.vercel.app` is
`main`; `https://babylianav2.vercel.app` is `product-ready-enhancement`, which is
merged, so the two agree until the branch moves again. One Supabase project sits
under both — deliberate, since a second would have turned stage 3's copy into an
export and an import across two endpoints instead of one statement across two
schemas.

**The scope that branch carried: multi-tenancy (D-057, Q-013 closed).** Many
accounts per baby, many babies per account, **open signup**, and **sign in to
join a baby — never to log an event**. That supersedes D-022's one hard-coded
baby and rewrites the *Identity* section of `technical-constraints.md`; the
non-negotiable about logging survives, narrowed to onboarding.

**The gate on it was RLS, and that gate is now shut in `app`.** Stage 2 is done
and shipped: the client runs entirely on the `app` schema, sign-in is email OTP,
onboarding is four steps, `device` is `caregiver` throughout, and the hard-coded
baby id is gone. `public` still has one anon key and a `using (true)` policy on everything —
unchanged on purpose, because it is the rollback — and it closes at stage 5.
**Stage 3 has run.** `app` holds the full log — 510 timeslots and 594 events as
of 2026-09-24, matching `public` exactly. `0008` is forward-only and idempotent,
so re-running it is how a delta is picked up; there is no delete step and D-061
explains at some cost why. `docs/tasks.md` § Phase 12 is the list, in dependency
order.

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

**`public` is current through `0006`, and `0007` and `0008` are applied.** It created a
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
  a weight. The source chart's bars are tappable — a day opens its own
  breakdown, in millilitres and whole percent (D-062). The range is `3d 7d 15d
  30d`, any month that has entries, or all of it (D-063). Under each page's tag
  row sit grouped bubbles for everything the tags do not carry — the source
  split, the widest gap, the poop colours, sleep, and the secondary types with
  a note count — each in the colour its kind already has.
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

- **D-063** — the insights range became a shape rather than a number: `3d 7d
  15d 30d`, the months that have entries, then `all` behind `more`. A month is a
  calendar month, not `slice(-30)`. Past ten days the bars thin and the
  wet-diaper flag rolls up — D-032's rule printed differently, not a new one.
  And the read-back's page now summarises what it holds, which is where the
  captured-but-invisible data (weight, temperature, supplements, notes) first
  shows up outside the table.
- **D-062** — the report's *by source* card became tappable. A day's bar opens
  its own breakdown — total, feed count, and each source's millilitres and whole
  percent, rounded so the shares add to 100. The first thing built on this
  repo since the cutover, and it touches nothing the cutover touches.
- **D-061** — the migration is forward-only. The delete-and-recopy recipe in
  `0008`'s header cost 99 events of real data when the delete landed on `public`
  instead of `app`: the two schemas carry the same five table names. Almost all
  of it came back because `0008` had run hours earlier and `app` was holding the
  rows — the copy was the backup. Drift is now reported rather than resolved,
  because a forward-only copy cannot tell a deleted moment from an uncopied one
  and guessing is what lost the data.
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

**0. Finish the cutover. All six are the owner's, none are code**, and they are
in this order for a reason.

1. **Run `0008` now**, before any phone flips, so nothing logged on the old
   build is stranded. Forward-only, no preparation, safe to repeat.
2. **Supabase → Authentication → URL Configuration → Site URL back to
   `https://babyliana.vercel.app`.** It has pointed at the v2 origin since
   stage 1 (`0007` § 5). A numeric OTP never redirects so it does not gate
   sign-in, but leaving it is the stage 5 item that bites later.
3. **Fully close the app on both phones before reopening.** Swipe it away;
   backgrounding is not enough. See *A cutover hazard* below — this is the one
   thing that can actually stop the app dead, and closing first avoids it.
4. **Each phone onboards once:** email → six-digit code → pick Liana → tap your
   own name. **The code lands in the household inbox**, so the second parent
   needs it relayed unless they can read that mailbox. Nothing carries across
   from the old install, which is why `0008` remaps ids rather than rewriting
   them.
5. **Run `0008` again once both phones are confirmed on the new build.** The
   service worker updates lazily, so there is a real window in which one phone
   is still writing to `public`. This sweeps it.
6. **Leave `public` alone.** It is the rollback until the new build has been
   trusted for a few real nights, and it closes at stage 5.

**Still owed from the incident:** the moment at `2026-09-24 01:45:00+00` — a
43-minute period logged by Dad — exists in both databases with no entry attached.
Only two things carry a period (D-020), so it was a sleep or a feed. Easiest now
to re-enter it directly in the new app, since `app` is what the phones write to
from here.

**The JSON export is the most overdue item in the project** (item 2 below). The
recovery on 2026-09-24 worked because a second copy happened to exist in another
schema of the same Supabase project. That is not a backup, and the free tier
keeps none.

**1. The coverage run. This is the gate and it is the owner's.** Enter the
photographed days from `.specify/memory/paper-log/` into the app on the phone,
against the checklist in `coverage-requirement.md`. **Ten days, not seven** — the
photographs run 8/26–9/4, three days past what the baseline covers. Not in a
script — the point is thumbs, at speed, in the dark. If something cannot be
entered, that finding outranks any further polish. It is the single biggest open
item in the project.

**2. Two questions are waiting on the owner and nothing should be guessed at
them** — `Q-014`, what the daily rhythm should show, and `Q-015`, which of the
captured-but-unused fields earn a place on the insights screen. Both carry
candidate answers written out in `docs/open-questions.md`; picking from them is
the owner's. **One item inside `Q-015` is a defect and not a preference:** the
growth card reads a digit in a weight's free-text note and never reads
`pounds`, so a weight entered the way D-036 built it does not show up there.

**3. One build item left, `CC`:**

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

**Nothing uncommitted.** The page summary's bubble rework is `2e78735` on
`main`, pushed. No migration, nothing new stored — the third service-worker
update of the cutover, and like the other two it does not move `DB_VERSION`.

**`0008` has been applied**, and `supabase/README.md` records it. Re-running it
is the routine way to pick up new rows from `public`; it is forward-only and
removes nothing.

**What is deployed where.** Both origins now build the same code, since the
branch is merged. `https://babyliana.vercel.app` is `main` and is what the phones
run; `https://babylianav2.vercel.app` is the branch and stays useful as a place
to put the next thing before it reaches anyone.

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

**This is live as of 2026-09-24 — the merge is deploying, so the next time
either phone opens the app is when it happens.** It cannot be prevented from
here.
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

### 2026-09-24 (latest) — the report reaches past a week, and a page says what it holds

Two things, one complaint: the app was showing less than it had. D-063.

**Then a third pass, on how it looked.** The summary shipped as a paragraph in a
screen made of tags, so it became bubbles — every fact in the colour its kind
already has, which is the tag row's vocabulary and not a second one. Two things
fell out of that rather than out of the redraw: it stopped repeating the total
and the feed count, which are tags four points above it, and it dropped the type
word from each secondary bubble once the icon was carrying it. A page whose every
fact is already in the tag row now produces no block at all.

**The insights range is a shape now, not a number.** `Span` became a union —
`{days: n}`, `{month: ym}`, `all` — behind a strip of pills: `3d 7d 15d 30d`,
the months that have entries, then `more` for the rest and `all`. A calendar
month is not `slice(-30)`, which would take August one day short every time.
Months are offered from the log rather than generated, so a pill never opens an
empty screen.

At 30 days the bars are six points wide, so the per-bar value comes off and the
date labels thin to one in six, anchored to the most recent day. The wet-diaper
flag rolls up past three days — **the same D-032 rule, printed differently, not
a fifth rule and not a moved threshold.**

**The read-back's page now summarises what it holds:** milk with its source
split in words and the widest gap inside the day, diapers with their colours,
sleep, and a line for weight, temperature, supplements, spit-ups and how many
notes were written. All of it was already stored and invisible until the table
was scrolled. It is handed one day, every day, or a picked period by the same
component, so a gap is only claimed within a single day — across a range the
widest gap is the night, every time.

`src/day/summary.ts` is new, with `verify-day-summary` as its own suite,
registered in `package.json`.

**Two questions came in the same message and are now `Q-014` and `Q-015`**, both
waiting on the owner and neither guessed at: what the daily rhythm should show,
given that it looks right and nobody acts on it, and which captured-but-unused
data earns a place on the insights screen. The second was measured rather than
guessed — **the report reads none of `pounds`, `fahrenheit`, `supplement_name`,
`severity`, `poop_consistency` or `logged_by`** — and it turned up a defect on
the way: the growth card matches a digit in the free-text *note* and never looks
at `pounds`, so a weight typed into the weight field does not appear on it at
all.

### 2026-09-24 — the source chart answers for one day

The report's *by source* card had a stacked bar and no numbers, which meant a
ruler and the legend to read a share off it. Its bars are buttons now: tapping a
day swaps the range caption for that day's breakdown — the date, the total in
millilitres, how many feeds it took, and a row per source with millilitres and a
whole-percent share. Tapping again puts the caption back. D-062.

The part worth remembering is the rounding. Rounding each band alone turns
37.5 / 28.1 / 34.4 into 102%, so the leftover goes to the largest remainders,
ties to the larger band and then to chart order. `verify-insights` checks the
sum on a mixed day and on thirds, which is the case that cannot come out even.

A `?` feed — a feed with no volume — is now counted on `DayStat` and named in the
panel's head, because a day of 8 feeds and 410 mL where one had no volume is not
a 410 mL day and the bands cannot say so.

Nothing stored, no migration, no schema change. `npm run verify` green.

### 2026-09-24 — merged to main; the cutover is under way

`product-ready-enhancement` merged into `main` as `52b1fb8`, `--no-ff` so the
cutover is a single commit to revert. Nineteen commits, no conflicts, `main`
unmoved since `302ce22`. `npm run verify` run on `main` after the merge rather
than trusting the branch's own green: 719 checks, exit 0.

**The deploy is not the cutover.** The service worker updates lazily, so each
phone flips at a moment nobody chooses, and until both have there is a real
window with one phone writing to `public` and the other to `app`. That is why
`0008` gets run twice — once before any phone flips and once after both have —
and why `public` keeps its anon key and its `using (true)` policies until
stage 5. Rolling back is `git revert -m 1 52b1fb8`; the old build finds `public`
exactly where it left it.

The six remaining steps are in *Next action* and none of them are code. The one
that can actually stop the app is closing it fully on both phones first — an
installed PWA holding IndexedDB version 2 blocks the upgrade to 3, and
IndexedDB's answer to that is to wait forever.
