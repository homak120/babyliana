-- BabyLiana — paper log backfill, 2026-08-26 → 2026-09-04
--
-- One-off data import, NOT a migration. Nothing here changes the schema; if it
-- is ever run twice the guard below stops it. Kept in the repo because the
-- transcription is the valuable part — the SQL around it is mechanical.
--
-- Source: two photographs of the bedside notebook (IMG_0726, IMG_0727),
-- transcribed 2026-09-05. Covers the seven days already described in
-- .specify/memory/paper-log-baseline.md plus three that postdate it (9/2, 9/3,
-- 9/4).
--
-- Model: .specify/memory/event-model.md · D-003 mutable rows · D-019 timeslot
-- is the unit · D-022 hard-coded baby id
--
--
-- BEFORE YOU RUN THIS — read docs/status.md § Next action
-- =======================================================
-- The coverage run is the project's gate and it is explicitly *not* a script:
-- "Enter all seven photographed days into the app on the phone... Not in a
-- script — the point is thumbs, at speed, in the dark. If something cannot be
-- entered, that finding outranks any further polish."
--
-- This file cannot tell you whether the app can *capture* this data. It only
-- proves the schema can *hold* it — which it can, and which is a weaker claim.
-- Running this instead of doing the coverage run loses the gate; running it
-- after, into a separate project or a reset database, does not.
--
--
-- ROLLBACK — the last block in this file. Every row written here carries
-- updated_by = 'paper-log-import', which is what that column is for and which
-- the app never sets, so the filter is exact.


-- ---------------------------------------------------------------------------
-- 0. Timezone
--
-- Times below are local wall-clock as written on paper. occurred_at is
-- timestamptz, so they need a zone to become instants. Change this one string
-- if the log was not kept in Eastern time — it is the only place it appears.
-- ---------------------------------------------------------------------------

\set log_tz 'America/New_York'
-- Supabase SQL Editor does not support \set. If you are pasting into the
-- editor rather than running through psql, delete the line above and replace
-- :'log_tz' with the literal 'America/New_York' — two occurrences, one in
-- section 4 and one in the read-back query in section 5.


-- ---------------------------------------------------------------------------
-- 1. Guards
--
-- Both failures are worth being loud about. A missing baby row means the wrong
-- database; existing import rows mean this already ran.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from public.baby where id = '94c55231-e3dd-46d0-8567-fa8d0b90d809'
  ) then
    raise exception
      'baby 94c55231-e3dd-46d0-8567-fa8d0b90d809 not found — wrong project, or the baby row was never created';
  end if;

  if exists (select 1 from public.timeslot where updated_by = 'paper-log-import') then
    raise exception
      'paper-log-import rows already present — run the rollback block at the end of this file first';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. The importing device
--
-- timeslot.logged_by is not-null and on delete restrict, so these rows need a
-- device and that device can never be deleted afterwards. A dedicated one is
-- more honest than borrowing a phone's id: these moments were logged on paper,
-- not by either handset, and the day view will say so.
-- ---------------------------------------------------------------------------

insert into public.device (id, name, created_at, updated_at, updated_by)
values (
  '6817e81c-9899-4394-8f8e-a1a949e2d562',
  'Paper log',
  now(), now(), 'paper-log-import'
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 3. The transcription
--
-- Four staging tables, shaped so they can be read against the photographs
-- line by line. `k` is date+time and is the join key; it has no meaning after
-- this script.
--
-- Conventions:
--   · a bare volume with no (B)/(F) marker  → source 'unknown' (never null on
--     a feed row — event-model.md is explicit about this)
--   · a split feed                          → two feed rows, one timeslot
--   · a colour outside the fixed list       → poop_colour 'other' + the word
--                                             in the event note
--   · a struck-through row on paper         → not imported at all (D-003: a
--                                             strikethrough is a delete, and
--                                             there are no tombstones)
-- ---------------------------------------------------------------------------

create temp table import_slot (
  k    text primary key,
  id   uuid not null default gen_random_uuid(),
  at   timestamp not null,
  note text
);

create temp table import_feed (
  k    text not null,
  ml   integer,
  src  text not null,
  note text
);

create temp table import_diaper (
  k           text not null,
  pee         boolean not null,
  poop        boolean not null,
  colour      text,
  consistency text,
  note        text
);

create temp table import_other (
  k    text not null,
  note text not null
);


-- 3a. Moments ---------------------------------------------------------------

insert into import_slot (k, at, note) values
-- 8/26
('0826-1510', '2026-08-26 15:10', null),
('0826-1826', '2026-08-26 18:26', null),
('0826-2030', '2026-08-26 20:30', null),
('0826-2127', '2026-08-26 21:27', null),
-- 8/27
('0827-0139', '2026-08-27 01:39', null),
('0827-0430', '2026-08-27 04:30', null),
('0827-0550', '2026-08-27 05:50', null),
('0827-0820', '2026-08-27 08:20', null),
('0827-1139', '2026-08-27 11:39', null),
('0827-1417', '2026-08-27 14:17', null),
('0827-1440', '2026-08-27 14:40', null),
('0827-1745', '2026-08-27 17:45', null),
('0827-2024', '2026-08-27 20:24', null),
('0827-2101', '2026-08-27 21:01', null),
-- 8/28
('0828-0010', '2026-08-28 00:10', null),
('0828-0220', '2026-08-28 02:20', null),
('0828-0332', '2026-08-28 03:32', null),
('0828-0400', '2026-08-28 04:00', 'Paper reads 04:? — minutes not recorded, rounded to the hour on import.'),
('0828-0732', '2026-08-28 07:32', null),
('0828-0930', '2026-08-28 09:30', null),
('0828-1300', '2026-08-28 13:00', null),
('0828-1700', '2026-08-28 17:00', null),
('0828-2111', '2026-08-28 21:11', null),
('0828-2139', '2026-08-28 21:39', null),
-- 8/29
('0829-0100', '2026-08-29 01:00', null),
('0829-0430', '2026-08-29 04:30', null),
('0829-0630', '2026-08-29 06:30', null),
('0829-1105', '2026-08-29 11:05', null),
('0829-1243', '2026-08-29 12:43', null),
('0829-1607', '2026-08-29 16:07', null),
('0829-1910', '2026-08-29 19:10', null),
('0829-2100', '2026-08-29 21:00', null),
('0829-2230', '2026-08-29 22:30', 'Time struck through and rewritten on paper.'),
-- 8/30  (two afternoon rows are NOT here — see section 6)
('0830-0200', '2026-08-30 02:00', 'Paper reads 02:? — minutes not recorded, rounded to the hour on import.'),
('0830-0320', '2026-08-30 03:20', null),
('0830-0530', '2026-08-30 05:30', null),
('0830-0900', '2026-08-30 09:00', null),
('0830-1200', '2026-08-30 12:00', null),
('0830-2210', '2026-08-30 22:10', null),
-- 8/31
('0831-0410', '2026-08-31 04:10', null),
('0831-0700', '2026-08-31 07:00', null),
('0831-0811', '2026-08-31 08:11', null),
('0831-1001', '2026-08-31 10:01', null),
('0831-1240', '2026-08-31 12:40', 'Written as the first row of the day, above 04:10 — out of chronological order on paper. The minutes digit is corrected in place.'),
('0831-1300', '2026-08-31 13:00', null),
('0831-1600', '2026-08-31 16:00', null),
('0831-1900', '2026-08-31 19:00', null),
-- 9/1
('0901-0022', '2026-09-01 00:22', null),
('0901-0430', '2026-09-01 04:30', null),
('0901-0628', '2026-09-01 06:28', null),
('0901-0820', '2026-09-01 08:20', null),
('0901-1140', '2026-09-01 11:40', null),
('0901-1500', '2026-09-01 15:00', null),
('0901-1829', '2026-09-01 18:29', null),
('0901-2200', '2026-09-01 22:00', 'Paper reads "22:" with no minutes — rounded to the hour on import.'),
-- 9/2
('0902-0000', '2026-09-02 00:00', null),
('0902-0130', '2026-09-02 01:30', null),
('0902-0300', '2026-09-02 03:00', null),
('0902-0600', '2026-09-02 06:00', null),
('0902-0930', '2026-09-02 09:30', null),
('0902-1250', '2026-09-02 12:50', null),
('0902-1600', '2026-09-02 16:00', null),
('0902-1740', '2026-09-02 17:40', null),
('0902-1915', '2026-09-02 19:15', null),
('0902-2205', '2026-09-02 22:05', null),
-- 9/3
('0903-0201', '2026-09-03 02:01', null),
('0903-0700', '2026-09-03 07:00', null),
('0903-1020', '2026-09-03 10:20', null),
('0903-1230', '2026-09-03 12:30', null),
('0903-1520', '2026-09-03 15:20', null),
('0903-1825', '2026-09-03 18:25', null),
('0903-1920', '2026-09-03 19:20', null),
('0903-2235', '2026-09-03 22:35', null),
-- 9/4
('0904-0325', '2026-09-04 03:25', null),
('0904-0520', '2026-09-04 05:20', null);


-- 3b. Feeds -----------------------------------------------------------------

insert into import_feed (k, ml, src, note) values
('0826-1510', 35, 'unknown', null),
('0826-1826', 35, 'unknown', null),
('0826-2127', 31, 'unknown', null),

('0827-0139', 43, 'unknown', null),
('0827-0430', 50, 'unknown', null),
('0827-0550', 41, 'unknown', null),
('0827-0820', 46, 'unknown', null),
('0827-1139', 40, 'unknown', null),
('0827-1440', 50, 'unknown', null),
('0827-1745', 60, 'unknown', null),
('0827-2101', 55, 'unknown', null),

('0828-0010', 60, 'unknown', null),
('0828-0220', 55, 'unknown', null),
('0828-0400', 60, 'unknown', null),
('0828-0732', 60, 'unknown', 'Volume written as "?" on paper — a feed of unknown size. Defaulted to 60 mL on import; this is the only imputed volume in the set.'),
('0828-0930', 60, 'unknown', null),
('0828-1300', 50, 'unknown', null),
('0828-1700', 60, 'unknown', null),
('0828-2139', 30, 'unknown', null),

('0829-0100', 60, 'unknown', null),
('0829-0430', 60, 'unknown', null),
('0829-0630', 30, 'unknown', null),   -- unlabelled split: 30 + 30
('0829-0630', 30, 'unknown', null),
('0829-1105', 10, 'unknown', null),
('0829-1243', 57, 'unknown', null),
('0829-1607', 60, 'unknown', null),
('0829-1910', 25, 'breast_milk', null),   -- 25(B) + 45(F)
('0829-1910', 45, 'formula', null),
('0829-2230', 60, 'unknown', null),

('0830-0200', 60, 'formula', null),       -- 60(F) + 15(B)
('0830-0200', 15, 'breast_milk', null),
('0830-0320',  5, 'breast_milk', null),
('0830-0530', 60, 'unknown', null),
('0830-0900', 60, 'unknown', null),
('0830-1200', 60, 'unknown', null),
('0830-2210', 60, 'unknown', null),

('0831-0410', 20, 'breast_milk', null),   -- 20(B) + 40(F)
('0831-0410', 40, 'formula', null),
('0831-0700', 60, 'unknown', 'Volume struck through and rewritten beside it on paper.'),
('0831-1001', 60, 'unknown', null),
('0831-1240', 60, 'unknown', null),
('0831-1300', 60, 'unknown', null),
('0831-1600', 55, 'unknown', null),
('0831-1900', 30, 'breast_milk', null),   -- 30(B) + 30(F)
('0831-1900', 30, 'formula', null),

('0901-0022', 80, 'unknown', 'UNCONFIRMED. Reads 80, written faster than the surrounding numbers, and it would be the only 80 in the log. docs/status.md § Open threads raises a third reading: a ditto mark, which here would inherit 30(B)+30(F) from the 19:00 row above it and make this two feed rows, not one. Needs eyes on the original page.'),
('0901-0430', 60, 'unknown', null),
('0901-0628', 30, 'unknown', null),
('0901-0820', 60, 'unknown', null),
('0901-1140', 60, 'unknown', null),
('0901-1500', 60, 'breast_milk', null),
('0901-1829', 60, 'unknown', null),
('0901-2200', 60, 'unknown', null),

('0902-0130', 60, 'unknown', null),
('0902-0600', 30, 'breast_milk', null),   -- 30(B) + 30(F)
('0902-0600', 30, 'formula', null),
('0902-0930', 60, 'unknown', null),
('0902-1250', 60, 'unknown', null),
('0902-1600', 60, 'breast_milk', null),
('0902-1915', 60, 'unknown', null),
('0902-2205', 60, 'unknown', null),

('0903-0201', 60, 'unknown', null),
('0903-0700', 60, 'unknown', null),
('0903-1020', 60, 'breast_milk', null),
('0903-1230', 60, 'unknown', null),
('0903-1520', 60, 'breast_milk', null),
('0903-1920', 30, 'breast_milk', null),   -- 30(B) + 30(F)
('0903-1920', 30, 'formula', null),
('0903-2235', 60, 'unknown', null),

('0904-0325', 60, 'breast_milk', null),
('0904-0520', 60, 'unknown', null);


-- 3c. Diapers ---------------------------------------------------------------
--
-- One row per change; pee and poop are both explicit booleans, matching what
-- DiaperBlock writes. `1+2` on paper is one change with both true.

insert into import_diaper (k, pee, poop, colour, consistency, note) values
('0826-1510', true,  false, null,     null,     null),
('0826-2030', false, true,  null,     null,     null),
('0826-2127', false, true,  'dark',   null,     null),

('0827-0550', true,  false, null,     null,     null),
('0827-0820', false, true,  'other',  null,     'olive'),
('0827-1139', false, true,  'yellow', null,     null),
('0827-1417', true,  false, null,     null,     null),
('0827-1440', false, true,  'other',  'liquid', 'G→Y — green turning to yellow, recorded as it changed.'),
('0827-1745', true,  false, null,     null,     null),
('0827-2024', true,  false, null,     null,     null),

('0828-0010', false, true,  'yellow', null,     null),
('0828-0220', true,  false, null,     null,     null),
('0828-0332', true,  false, null,     null,     null),
('0828-0400', true,  false, null,     null,     null),
('0828-0732', true,  false, null,     null,     null),
('0828-1300', true,  false, null,     null,     null),
('0828-1700', false, true,  null,     null,     null),
('0828-2111', true,  false, null,     null,     null),

('0829-0100', true,  false, null,     null,     null),
('0829-0430', true,  false, null,     null,     null),
('0829-0630', true,  false, null,     null,     null),
('0829-1105', true,  false, null,     null,     null),
('0829-1607', true,  false, null,     null,     null),
('0829-1910', true,  false, null,     null,     null),
('0829-2100', true,  false, null,     null,     null),

('0830-1200', true,  false, null,     null,     null),
('0830-2210', true,  false, null,     null,     null),

('0831-0410', false, true,  'green',  null,     null),
('0831-0700', true,  false, null,     null,     null),
('0831-0811', false, true,  'yellow', null,     null),
('0831-1001', true,  false, null,     null,     null),
('0831-1240', true,  false, null,     null,     null),
('0831-1300', true,  false, null,     null,     null),
('0831-1600', true,  false, null,     null,     null),
('0831-1900', false, true,  'yellow', null,     'small'),

('0901-0022', true,  false, null,     null,     null),
('0901-0430', false, true,  'green',  null,     null),
('0901-0628', true,  false, null,     null,     null),
('0901-1140', true,  false, null,     null,     null),
('0901-1500', true,  false, null,     null,     null),
('0901-1829', true,  false, null,     null,     null),
('0901-2200', true,  false, null,     null,     null),

('0902-0000', true,  false, null,     null,     null),
('0902-0130', true,  false, null,     null,     null),
('0902-0300', false, true,  'green',  null,     null),
('0902-0600', true,  true,  null,     null,     null),   -- 1 + 2
('0902-0930', false, true,  'green',  null,     null),
('0902-1250', true,  true,  'yellow', null,     null),   -- 1 + 2(Y)
('0902-1600', false, true,  'green',  null,     null),
('0902-1740', true,  false, null,     null,     null),
('0902-2205', false, true,  'green',  null,     null),

('0903-0201', true,  false, null,     null,     null),
('0903-0700', true,  false, null,     null,     null),
('0903-1020', false, true,  'green',  null,     null),
('0903-1230', true,  false, null,     null,     null),
('0903-1520', false, true,  null,     null,     'Paper reads 2×2 — two poops in this moment, so two changes.'),
('0903-1520', false, true,  null,     null,     'Paper reads 2×2 — two poops in this moment, so two changes.'),
('0903-1920', false, true,  null,     null,     null),

('0904-0325', false, true,  null,     null,     'little'),
('0904-0520', false, true,  'yellow', null,     null);


-- 3d. Everything else -------------------------------------------------------
--
-- The escape hatch earning its keep on the first real page: "Nasal" is written
-- in the Pee/Poop column, which is not a diaper and not a feed.

insert into import_other (k, note) values
('0903-1825', 'Nasal aspiration.');


-- ---------------------------------------------------------------------------
-- 4. Write
--
-- Timeslot first, then events keyed off it. recorded_at is now() and honestly
-- so — these rows are first written today. occurred_at carries the paper time.
-- ---------------------------------------------------------------------------

insert into public.timeslot
  (id, baby_id, logged_by, occurred_at, ended_at, recorded_at, updated_at, updated_by, note)
select
  s.id,
  '94c55231-e3dd-46d0-8567-fa8d0b90d809',
  '6817e81c-9899-4394-8f8e-a1a949e2d562',
  s.at at time zone :'log_tz',
  null,
  now(), now(), 'paper-log-import',
  s.note
from import_slot s;

insert into public.event
  (id, timeslot_id, type, note, recorded_at, updated_at, updated_by, volume_ml, source)
select gen_random_uuid(), s.id, 'feed', f.note, now(), now(), 'paper-log-import', f.ml, f.src
from import_feed f join import_slot s using (k);

insert into public.event
  (id, timeslot_id, type, note, recorded_at, updated_at, updated_by,
   pee, poop, poop_colour, poop_consistency)
select gen_random_uuid(), s.id, 'diaper', d.note, now(), now(), 'paper-log-import',
       d.pee, d.poop, d.colour, d.consistency
from import_diaper d join import_slot s using (k);

insert into public.event
  (id, timeslot_id, type, note, recorded_at, updated_at, updated_by)
select gen_random_uuid(), s.id, 'other', o.note, now(), now(), 'paper-log-import'
from import_other o join import_slot s using (k);


-- ---------------------------------------------------------------------------
-- 5. Assertions
--
-- The one invariant the schema cannot express: a timeslot always has at least
-- one event (D-019). A typo in a join key above would produce exactly that
-- orphan, silently.
-- ---------------------------------------------------------------------------

do $$
declare orphans integer;
begin
  select count(*) into orphans
  from public.timeslot t
  where t.updated_by = 'paper-log-import'
    and not exists (select 1 from public.event e where e.timeslot_id = t.id);

  if orphans > 0 then
    raise exception 'ok, so % imported timeslot(s) have no events — a join key is wrong', orphans;
  end if;
end $$;

-- Read this back against the transcription before trusting it.
select
  (t.occurred_at at time zone :'log_tz')::date              as day,
  count(distinct t.id)                                       as moments,
  count(*) filter (where e.type = 'feed')                    as feeds,
  sum(e.volume_ml) filter (where e.type = 'feed')            as ml,
  count(*) filter (where e.type = 'diaper' and e.pee)        as pee,
  count(*) filter (where e.type = 'diaper' and e.poop)       as poop,
  count(*) filter (where e.type = 'other')                   as other
from public.timeslot t
join public.event e on e.timeslot_id = t.id
where t.updated_by = 'paper-log-import'
group by 1
order by 1;

-- Expected totals — 75 moments, 71 feeds, 3523 mL, 39 pee, 23 poop, 1 other:
--
--   day         moments feeds    ml  pee poop other
--   2026-08-26        4     3   101    1    2     0
--   2026-08-27       10     8   385    4    3     0
--   2026-08-28       10     8   435    6    2     0
--   2026-08-29        9    10   437    7    0     0
--   2026-08-30        6     7   320    2    0     0
--   2026-08-31        8     9   415    5    3     0
--   2026-09-01        8     8   470    6    1     0
--   2026-09-02       10     8   420    5    6     0
--   2026-09-03        8     8   420    3    4     1
--   2026-09-04        2     2   120    0    2     0
--
-- 8/29 and 8/30 really do have no poop at all — that is the page, not a
-- dropped row. 8/30 is short two moments; see section 6.

drop table import_slot, import_feed, import_diaper, import_other;


-- ---------------------------------------------------------------------------
-- 6. NOT IMPORTED — two rows on 8/30 whose hour cannot be read
--
-- Between 12:00 and 22:10 the page has two more feeds, each 60 mL with a pee.
-- Both times are written `1?:?` — the leading hour digit is overwritten and
-- the minutes are absent. The minutes rule ("round to the hour provided")
-- cannot apply, because the hour is the part that is unreadable.
--
-- The candidates are 13:00 / 15:00 for the first and 17:00 / 19:00 for the
-- second. The surrounding rhythm across the other nine days is roughly
-- three-hourly, which fits 15:00 and 19:00 and would leave a five-hour
-- afternoon gap otherwise — but that is a pattern argument, not a reading of
-- the page, and a marked hole is worth more than a confident guess.
--
-- Look at the original page, pick the times, uncomment, and run this block on
-- its own. Everything above will already be committed.
-- ---------------------------------------------------------------------------

-- with s as (
--   insert into public.timeslot
--     (id, baby_id, logged_by, occurred_at, recorded_at, updated_at, updated_by, note)
--   values
--     (gen_random_uuid(),
--      '94c55231-e3dd-46d0-8567-fa8d0b90d809',
--      '6817e81c-9899-4394-8f8e-a1a949e2d562',
--      timestamp '2026-08-30 15:00' at time zone 'America/New_York',   -- <-- 13:00 or 15:00
--      now(), now(), 'paper-log-import',
--      'Hour digit overwritten on paper and minutes absent; time chosen by reading the original page.'),
--     (gen_random_uuid(),
--      '94c55231-e3dd-46d0-8567-fa8d0b90d809',
--      '6817e81c-9899-4394-8f8e-a1a949e2d562',
--      timestamp '2026-08-30 19:00' at time zone 'America/New_York',   -- <-- 17:00 or 19:00
--      now(), now(), 'paper-log-import',
--      'Hour digit overwritten on paper and minutes absent; time chosen by reading the original page.')
--   returning id
-- )
-- insert into public.event
--   (id, timeslot_id, type, recorded_at, updated_at, updated_by,
--    volume_ml, source, pee, poop)
-- select gen_random_uuid(), s.id, v.type, now(), now(), 'paper-log-import',
--        v.ml, v.src, v.pee, v.poop
-- from s
-- cross join (values
--   ('feed',   60,  'unknown', null::boolean, null::boolean),
--   ('diaper', null, null,     true,          false)
-- ) as v(type, ml, src, pee, poop);


-- ---------------------------------------------------------------------------
-- 7. ROLLBACK
--
-- Events cascade from timeslot, so deleting the timeslots is enough for the
-- log itself. The device is left in place: on delete restrict would block it
-- anyway while rows exist, and once they are gone it is one harmless row that
-- keeps the import's provenance readable.
-- ---------------------------------------------------------------------------

-- delete from public.timeslot where updated_by = 'paper-log-import';
-- delete from public.device   where updated_by = 'paper-log-import';
