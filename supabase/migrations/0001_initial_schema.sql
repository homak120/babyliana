-- BabyLiana — initial schema
--
-- Run this once in the Supabase SQL Editor. Safe to re-run: everything is
-- IF NOT EXISTS / IF EXISTS.
--
-- Keep this file. A paused free-tier project is eventually deleted and the free
-- tier keeps no backups (see .specify/memory/technical-constraints.md), so
-- rebuilding is "run this migration, replay the JSON export". This file and the
-- export are the two halves of the disaster-recovery plan.
--
-- Model: .specify/memory/event-model.md § Schema (Postgres)
-- Decisions: D-003 mutable rows · D-019 timeslot is the unit · D-020 optional
-- period and the `other` type · D-022 one baby, hard-coded id, no pairing


-- ---------------------------------------------------------------------------
-- 1. Retire the spike (D-012)
--
-- The infrastructure is kept; the spike's application code and table are not.
-- Otherwise the throwaway counter quietly becomes the foundation.
-- ---------------------------------------------------------------------------

drop table if exists public.spike_taps;


-- ---------------------------------------------------------------------------
-- 2. Tables
--
-- Four, all singular. The baby is the root: this is a log about her, and every
-- moment belongs to one.
--
-- `device` deliberately does NOT reference a baby. A phone belongs to a parent,
-- not to a child — if a sibling ever arrives the same two phones log for both.
-- The baby lives on the moment, which is what is actually about her.
-- ---------------------------------------------------------------------------

create table if not exists public.baby (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No default on id below this line, deliberately. These rows are always written
-- by a client that generated its own UUID, which is what makes replay
-- idempotent. A server-side default would quietly mint an id the client does
-- not know, producing a row it cannot match on retry — a duplicate instead of a
-- loud not-null error.

create table if not exists public.device (
  id         uuid primary key,
  name       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeslot (
  id          uuid primary key,
  baby_id     uuid not null references public.baby(id)   on delete restrict,
  logged_by   uuid not null references public.device(id) on delete restrict,
  occurred_at timestamptz not null,
  ended_at    timestamptz,
  recorded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  note        text,
  constraint period_is_forward
    check (ended_at is null or ended_at >= occurred_at)
);

create table if not exists public.event (
  id            uuid primary key,
  timeslot_id   uuid not null references public.timeslot(id) on delete cascade,
  type          text not null check (type in (
                  'feed', 'diaper', 'sleep', 'weight',
                  'temperature', 'supplement', 'spit_up', 'other'
                )),
  note          text,
  recorded_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- feed. A split feed is two rows in one timeslot, not one row with two
  -- halves (D-019). `source` is never null on a feed row — 'unknown' is a real
  -- answer for the log's unlabelled `30 + 30`.
  volume_ml     integer check (volume_ml is null or volume_ml >= 0),
  source        text check (
                  source is null or source in ('breast_milk', 'formula', 'unknown')
                ),

  -- diaper. One row per change; both flags may be true at once.
  pee               boolean,
  poop              boolean,
  poop_colour       text check (
                      poop_colour is null or poop_colour in
                      ('yellow', 'green', 'brown', 'dark', 'other')
                    ),
  poop_consistency  text check (
                      poop_consistency is null or poop_consistency in
                      ('liquid', 'soft', 'seedy', 'firm', 'other')
                    ),

  -- weight / temperature. Positivity only, deliberately no range check: a bound
  -- shaped like a normal body-temperature range is a step toward the
  -- normal-range judgement CLAUDE.md rules out, and catching typos is not worth
  -- that.
  grams         integer check (grams is null or grams > 0),
  celsius       numeric(3,1),

  -- supplement. `amount` is text: "1 drop" and "0.5ml" are both real answers
  -- and share no unit.
  supplement_name  text,
  amount           text,

  -- spit_up. Unstructured on purpose; Q-006 has not confirmed this type is
  -- used at all.
  severity      text

  -- Sleep has no ended_at of its own — the duration is the timeslot's period
  -- (D-020). Two places to express one fact is how a duration ends up right in
  -- one view and wrong in another.
  --
  -- `other` has no columns at all. Type plus note, plus a period if it needs
  -- one. It is the escape hatch that makes the app as accepting as paper.
);


-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists event_timeslot_id_idx
  on public.event (timeslot_id);
create index if not exists timeslot_baby_occurred_idx
  on public.timeslot (baby_id, occurred_at desc);


-- ---------------------------------------------------------------------------
-- 4. Row-level security
--
-- These restrict what the `anon` ROLE may do. They cannot restrict rows to one
-- baby: with no Supabase Auth there is no identity to check baby_id against,
-- and the anon key is public (D-008 makes the repo public, so the key in the
-- bundle is genuinely public).
--
-- Today that is moot — one baby, two phones, one deployment. It stops being
-- moot if anyone outside this family ever uses it, which is Phase 12 and which
-- D-004 already names as the reason identity needs revisiting.
--
-- One policy per table: `for all` already covers select, insert, update and
-- delete.
-- ---------------------------------------------------------------------------

alter table public.baby     enable row level security;
alter table public.device   enable row level security;
alter table public.timeslot enable row level security;
alter table public.event    enable row level security;

drop policy if exists "anon full access" on public.baby;
drop policy if exists "anon full access" on public.device;
drop policy if exists "anon full access" on public.timeslot;
drop policy if exists "anon full access" on public.event;

create policy "anon full access" on public.baby
  for all to anon using (true) with check (true);
create policy "anon full access" on public.device
  for all to anon using (true) with check (true);
create policy "anon full access" on public.timeslot
  for all to anon using (true) with check (true);
create policy "anon full access" on public.event
  for all to anon using (true) with check (true);


-- ---------------------------------------------------------------------------
-- 5. Data API grants
--
-- Required. Projects created since 2026-05-30 need these stated explicitly.
-- Without them the tables return empty results or a 401 from the browser while
-- every tutorial written before mid-2026 insists it should have worked. This
-- cost the spike an evening; see .specify/memory/spike-spec.md.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon;
grant select, insert, update, delete on public.baby     to anon;
grant select, insert, update, delete on public.device   to anon;
grant select, insert, update, delete on public.timeslot to anon;
grant select, insert, update, delete on public.event    to anon;


-- ---------------------------------------------------------------------------
-- 6. Realtime
--
-- Opt-in per table. Without this everything else works and only live updates
-- are silently dead.
--
-- Note: realtime can lag behind this statement by tens of seconds. If a
-- subscription reports SUBSCRIBED and delivers nothing, wait and retry before
-- changing anything — the spike lost two attempts to exactly that.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['baby', 'device', 'timeslot', 'event'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
