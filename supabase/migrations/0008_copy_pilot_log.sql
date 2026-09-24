-- BabyLiana — stage 3: copy the pilot log from `public` into `app`
--
-- Run it in the Supabase SQL Editor as often as you like. **Forward-only and
-- idempotent**: every insert is `on conflict (id) do nothing`, there is no
-- `delete` anywhere in it, and a run that finds nothing new changes nothing.
-- Re-running it is how a delta is picked up — see RUNNING IT AGAIN and D-061.
--
-- ---------------------------------------------------------------------------
-- THIS IS THE FIRST IRREVERSIBLE STEP, AND IT ONLY READS `public`
-- ---------------------------------------------------------------------------
--
-- Hundreds of timeslots and events written by two phones over weeks of real
-- nights. They cannot be recreated from the paper. Nothing below writes to
-- `public` — not a row, not a column — so the two phones running `main` carry on
-- untouched whatever happens here.
--
-- There is a rollback, and it is **a supervised one-off, never a routine step**:
-- `delete from app.timeslot where updated_by = 'migration-0008'`. Run it only
-- when you have decided to discard the copy, with nothing else in flight, and
-- read the schema name twice. It is not part of re-running this file, and an
-- earlier revision of this header that said otherwise cost 99 rows. D-061.
--
-- **Take the JSON export first.** It is the only thing standing between a
-- mistyped `delete` and 395 unrecoverable events, and it is a Phase 12 item in
-- its own right (`docs/tasks.md`).
--
-- Decisions: D-060 a second baby is reachable · D-057 multi-tenant · D-039
-- additive only · D-003 mutable rows, no tombstones · D-019 timeslot is the unit
--
-- ---------------------------------------------------------------------------
-- WHY NO ID IS REWRITTEN
-- ---------------------------------------------------------------------------
--
-- `app` already holds the household: one `auth.users`, one `baby` (Liana, under
-- a different UUID from her twin in `public`), the `baby_member` row that grants
-- access to her, and two caregivers. Those ids stay exactly as they are, and the
-- copy remaps onto them.
--
-- The tempting alternative — rewrite `app`'s ids to match `public`'s so the copy
-- is a straight insert — buys nothing and costs a great deal. Nothing on a pilot
-- phone survives the update holding either id: `caregiver-id.ts` reads only
-- `babyliana.caregiver_id` and the old build wrote `babyliana.device_id`, which
-- nothing copies across; the baby id was a compile-time constant in the deleted
-- `config.ts`. And `0007` grants to `authenticated` only, with `anon`
-- deliberately absent, so a phone that has never had a session reads nothing
-- from `app` regardless. **Every pilot phone runs the new onboarding at cutover
-- whatever these ids are** — email, code, pick Liana, tap your own name — and
-- the caregiver step exists precisely to adopt whichever id the server has.
--
-- Meanwhile rewriting `app.baby.id` would have to carry `baby_member` and
-- `timeslot` with it (neither FK declares `on update`, so both default to
-- `NO ACTION`), and getting it wrong breaks the membership row that is the only
-- thing making Liana reachable by anyone, including the person running this.
--
-- **Timeslot and event ids are kept**, which is what makes the file re-runnable
-- at all — `on conflict (id) do nothing` needs a stable id to recognise a row it
-- has already copied. It also makes a row in `app` verifiably the same row as
-- its twin in `public`, which is what let the recovery on 2026-09-24 match the
-- two sides up.
--
-- ---------------------------------------------------------------------------
-- THE CAREGIVER MAPPING IS BY NAME, NOT BY PASTED UUID
-- ---------------------------------------------------------------------------
--
-- `public.device` holds two rows and `app.caregiver` holds the same two people
-- under the name the table always deserved. Joining on the name rather than on
-- two UUIDs transcribed by hand removes the one error nobody would notice: a
-- mistyped id does not fail, it attributes every entry to the wrong parent.
--
-- The guard below refuses to run unless every device referenced by a timeslot
-- matches exactly one caregiver. If "Mum" and "Mom" disagree, fix the row — do
-- not loosen the join.
--
-- ---------------------------------------------------------------------------
-- RUNNING IT AGAIN: FORWARD ONLY, AND THERE IS NO DELETE STEP
-- ---------------------------------------------------------------------------
--
-- The phones stay on `main` until they update, so `public` keeps growing after
-- the first copy. **Just run this file again.** It inserts what is missing and
-- touches nothing else. Run it as often as you like.
--
-- **There is deliberately no `delete` anywhere in the migration path, and an
-- earlier revision of this header got that wrong.** It instructed the reader to
-- `delete from app.timeslot ...` before each re-run, on the argument that
-- wholesale replacement is what `db.replaceAll` does and therefore correct by
-- construction. On 2026-09-24 that instruction cost 99 rows of real data: the
-- delete was aimed at `app` and landed on `public`, whose tables carry the same
-- five names one schema over.
--
-- The lesson is not "be careful with the schema prefix". **A procedure whose
-- safe operation depends on a tired person never mis-selecting a schema, at
-- 4am, as routine maintenance, is not a safe procedure** — and this one was run
-- routinely by design. Forward-only insert cannot remove a row no matter where
-- it is pointed. That property is worth more than the completeness it gives up.
-- D-061.
--
-- The 99 rows came back because this file had run a few hours earlier and
-- `app.event` still held them. **The copy is the backup**, which is the second
-- reason not to overwrite it on a schedule.
--
-- ---------------------------------------------------------------------------
-- WHAT FORWARD-ONLY DOES NOT DO, AND WHY THAT IS NOW A REPORT
-- ---------------------------------------------------------------------------
--
-- Three things happen in `public` between runs, and inserting handles two:
--
--   New moments      inserted.
--   Edited moments   D-003 updates in place and keeps the id, so `on conflict
--                    do nothing` skips it and `app` keeps the older version.
--   Deleted moments  D-003 leaves no tombstone, so the row stays in `app`.
--
-- The last two mean `app` can drift from `public`, and section 7 now **reports**
-- that drift instead of failing on it. A row present in `app` and absent from
-- `public` is far more likely to be a moment somebody deleted in the app than a
-- fault, and the right response is a person looking at it — the same rule the
-- app itself follows for duplicates: surface it, never resolve it silently.
--
-- It still fails hard on the one condition that is unambiguously broken: a row
-- in `public` that did **not** reach `app` after this ran.
--
-- Reconcile the drift once, by hand, at cutover — with both lists in front of
-- you and nothing else writing. That is one supervised decision instead of a
-- destructive statement typed on a schedule.
--
-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN IT
-- ---------------------------------------------------------------------------
--
-- This answers all three guards without writing anything. Every row should read
-- `ok`; anything else is what the migration would refuse on, named in advance:
--
--   select 'babies in app'      as check,
--          count(*)::text       as value,
--          case when count(*) = 1 then 'ok' else 'expected 1' end as verdict
--   from app.baby
--   union all
--   select 'babies in public.timeslot', count(distinct baby_id)::text,
--          case when count(distinct baby_id) = 1 then 'ok' else 'expected 1' end
--   from public.timeslot
--   union all
--   select 'devices without exactly one caregiver of the same name',
--          count(*)::text, case when count(*) = 0 then 'ok' else 'fix the names' end
--   from (select distinct logged_by from public.timeslot) t
--   join public.device d on d.id = t.logged_by
--   cross join lateral (
--     select count(*) as n from app.caregiver c
--     where lower(trim(c.name)) = lower(trim(d.name))
--   ) m
--   where m.n <> 1
--   union all
--   select 'events still holding grams/celsius', count(*)::text,
--          case when count(*) = 0 then 'ok' else 'convert them first' end
--   from public.event where grams is not null or celsius is not null;
--
-- And to see the two name lists side by side, which is what a mismatch means:
--
--   select 'public.device' as side, id, name from public.device
--   union all
--   select 'app.caregiver', id, name from app.caregiver
--   order by name;


do $$
declare
  app_baby  uuid;
  pub_baby  uuid;
  n         integer;
  unmapped  text;
  want_ts   integer;
  want_ev   integer;
  got_ts    integer;
  got_ev    integer;
begin
  -- -------------------------------------------------------------------------
  -- 1. Resolve the two babies, and refuse if either is ambiguous
  --
  -- Not hard-coded, deliberately. A UUID typed into a migration is a silent
  -- wrong answer when it is stale; a query that finds nothing is a loud one.
  -- -------------------------------------------------------------------------

  select count(*) into n from app.baby;
  if n <> 1 then
    raise exception
      'expected exactly one baby in app, found %. Name the id by hand if a second is deliberate', n;
  end if;
  select id into app_baby from app.baby;

  select count(distinct baby_id) into n from public.timeslot;
  if n <> 1 then
    raise exception
      'public.timeslot references % distinct babies; this file assumes one', n;
  end if;
  select distinct baby_id into pub_baby from public.timeslot;

  -- -------------------------------------------------------------------------
  -- 2. Every device referenced by a timeslot maps to exactly one caregiver
  --
  -- Reported by name and id, and with the match count, so a failure says which
  -- row to fix rather than only that something is wrong. Zero matches is a
  -- spelling difference; two is a duplicate caregiver left over from testing,
  -- and that one would silently double every timeslot it touched.
  -- -------------------------------------------------------------------------

  select string_agg(format('%s (%s) → %s caregiver match(es)', d.name, d.id, m.n), '; ')
  into unmapped
  from (select distinct logged_by from public.timeslot) t
  join public.device d on d.id = t.logged_by
  cross join lateral (
    select count(*) as n from app.caregiver c
    where lower(trim(c.name)) = lower(trim(d.name))
  ) m
  where m.n <> 1;

  if unmapped is not null then
    raise exception 'caregiver names do not map one-to-one: %', unmapped;
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Nothing is left in the columns `app.event` does not have
  --
  -- `grams` and `celsius` are dead in `public` — superseded by 0003, dropped by
  -- 0004, restored by 0005 when a phone stopped syncing, and frozen by D-039.
  -- `app.event` was created without them (0007 § 2), which is the one chance to
  -- leave them out. A non-null value here is the single thing this copy would
  -- drop without saying so, so it refuses instead.
  -- -------------------------------------------------------------------------

  select count(*) into n from public.event where grams is not null or celsius is not null;
  if n > 0 then
    raise exception
      '% event row(s) still hold grams/celsius; convert them to pounds/fahrenheit first', n;
  end if;

  -- -------------------------------------------------------------------------
  -- 4. The timeslots
  --
  -- Identical column lists on both sides, so only two values move: `baby_id`
  -- onto Liana's row in `app`, and `logged_by` onto the caregiver of the same
  -- name. `recorded_at` and `updated_at` are carried across untouched — when a
  -- moment was written is part of the record, and `now()` would rewrite the
  -- whole log as having happened this afternoon.
  --
  -- `updated_by` is stamped. The app writes null to this column on every
  -- timeslot and event it creates, so a non-null value means exactly "a script
  -- did this" — which is what makes the rollback a one-line delete and what
  -- lets the count check below tell copied rows from real ones.
  -- -------------------------------------------------------------------------

  insert into app.timeslot (
    id, baby_id, logged_by, occurred_at, ended_at, recorded_at, updated_at, updated_by, note
  )
  select
    t.id, app_baby, c.id, t.occurred_at, t.ended_at, t.recorded_at, t.updated_at,
    'migration-0008', t.note
  from public.timeslot t
  join public.device d on d.id = t.logged_by
  join app.caregiver c on lower(trim(c.name)) = lower(trim(d.name))
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------------
  -- 5. The events
  --
  -- **Columns enumerated, never `select *`** — the two schemas differ by exactly
  -- `grams` and `celsius`, and a star would fail on the column count rather than
  -- do anything useful.
  --
  -- Joined through `app.timeslot` rather than `public.timeslot`, so an event can
  -- only land if its parent did. The two tables stay consistent even if step 4
  -- somehow moved fewer rows than expected — which step 6 then refuses anyway.
  -- -------------------------------------------------------------------------

  insert into app.event (
    id, timeslot_id, type, note, recorded_at, updated_at, updated_by,
    volume_ml, source, pee, poop, poop_colour, poop_consistency,
    pounds, fahrenheit, supplement_name, amount, severity
  )
  select
    e.id, e.timeslot_id, e.type, e.note, e.recorded_at, e.updated_at, 'migration-0008',
    e.volume_ml, e.source, e.pee, e.poop, e.poop_colour, e.poop_consistency,
    e.pounds, e.fahrenheit, e.supplement_name, e.amount, e.severity
  from public.event e
  join app.timeslot t on t.id = e.timeslot_id
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------------
  -- 6. The shared settings
  --
  -- The feeding cycle, the quick bottle's volume and source, the supplement
  -- prefill and the prep lead (D-052, D-055). They are a fact about the baby
  -- rather than about a phone, and leaving them behind would hand the pilot
  -- phones a tuned log under default rhythms — the seam this whole stage exists
  -- to avoid.
  --
  -- Only when `public` has something to give. It overwrites whatever testing
  -- left on `app.baby`, which is the intent; delete this statement if you would
  -- rather keep the test values.
  -- -------------------------------------------------------------------------

  update app.baby b
  set settings = pb.settings, updated_at = now(), updated_by = 'migration-0008'
  from public.baby pb
  where b.id = app_baby and pb.id = pub_baby and pb.settings is not null;

  -- -------------------------------------------------------------------------
  -- 7. Fail on a short copy; report drift rather than failing on it
  --
  -- **The two directions are not the same kind of event, and treating them alike
  -- is what made the earlier version of this file dangerous.**
  --
  -- A row in `public` that did not reach `app` is unambiguously broken — the
  -- name join dropped it, or an insert was refused — and nothing should proceed
  -- on a partial copy, so that raises and rolls the whole block back.
  --
  -- A row in `app` that is no longer in `public` is almost certainly a moment
  -- somebody deleted in the app. D-003 leaves no tombstone, so a forward-only
  -- copy cannot know the difference between "deleted" and "not yet copied" — and
  -- guessing is how a hundred rows of real data go missing. It is reported, in
  -- full, for a person to look at. The app follows the same rule for duplicates:
  -- surface it, never resolve it silently.
  -- -------------------------------------------------------------------------

  select count(*) into want_ts from public.timeslot t
    where not exists (select 1 from app.timeslot a where a.id = t.id);
  select count(*) into want_ev from public.event e
    where not exists (select 1 from app.event a where a.id = e.id);

  if want_ts > 0 or want_ev > 0 then
    raise exception
      'copy is incomplete: % timeslot(s) and % event(s) in public did not reach app — rolled back. '
      || 'Check the caregiver name mapping in section 2.', want_ts, want_ev;
  end if;

  select count(*) into got_ts from app.timeslot a
    where not exists (select 1 from public.timeslot t where t.id = a.id);
  select count(*) into got_ev from app.event a
    where not exists (select 1 from public.event e where e.id = a.id);

  if got_ts > 0 or got_ev > 0 then
    raise notice
      'DRIFT: app holds % timeslot(s) and % event(s) that public does not. '
      || 'Most likely moments deleted in the old app since an earlier run. '
      || 'Nothing has been removed. Review them before cutover:', got_ts, got_ev;
    raise notice
      '  select * from app.timeslot a where not exists '
      || '(select 1 from public.timeslot t where t.id = a.id);';
  end if;

  select count(*) into got_ts from app.timeslot where updated_by = 'migration-0008';
  select count(*) into got_ev from app.event    where updated_by = 'migration-0008';

  raise notice 'copied % timeslot(s) and % event(s) onto baby %', got_ts, got_ev, app_baby;
end $$;


-- ---------------------------------------------------------------------------
-- Afterwards
-- ---------------------------------------------------------------------------
--
-- Spot-check before trusting the counts. They prove arity, not correctness —
-- the wrong parent on every row would still count 325:
--
--   select t.occurred_at, c.name, e.type, e.volume_ml, e.source
--   from app.timeslot t
--   join app.caregiver c on c.id = t.logged_by
--   left join app.event e on e.timeslot_id = t.id
--   order by t.occurred_at desc
--   limit 20;
--
-- Both parents should appear, and the newest rows should be the feeds you
-- remember from the last night logged on `main`.
--
-- To pick up rows logged on `main` since the last run: **run this file again.**
-- That is the whole procedure. No delete, no preparation, any number of times.
--
-- To discard the copy entirely — a deliberate decision, not a maintenance step:
--
--   delete from app.timeslot where updated_by = 'migration-0008';
--
-- That leaves the household — the account, the baby, the membership and both
-- caregivers — exactly as it was before this file ran. **Read the schema name
-- twice before running it.** `public` has tables of all the same names, and on
-- 2026-09-24 that statement was aimed at `app` and landed on `public`. D-061.
--
-- **`public` closes at stage 5, not here.** It keeps its one anon key and its
-- `using (true)` policy on every table until the phones are on the new build,
-- because until then it is the rollback.
