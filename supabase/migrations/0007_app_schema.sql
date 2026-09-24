-- BabyLiana — the `app` schema: multi-tenancy, built beside production
--
-- Run this once in the Supabase SQL Editor. Safe to re-run: everything is
-- IF NOT EXISTS / OR REPLACE, and the policies are dropped before they are
-- created.
--
-- ---------------------------------------------------------------------------
-- THIS MIGRATION DOES NOT TOUCH `public`.
-- ---------------------------------------------------------------------------
--
-- Not a column, not a policy, not a grant. The two phones in daily use keep
-- running against `public` exactly as they do today, and nothing below can
-- affect them. That is the whole design: every earlier plan for this work
-- altered the live schema and therefore had a window in which the phone that
-- cannot be reached on demand would stall its outbox — the failure `0004`
-- caused and `0005` had to undo.
--
-- A separate schema has no such window. If this file is wrong, drop the schema
-- and run it again; that freedom does not exist on `public`.
--
-- Decisions: D-057 multi-tenant, many-to-many, open signup · D-026 a caregiver
-- does not reference a baby · D-039 additive only · D-003 mutable rows ·
-- D-019 timeslot is the unit · D-020 optional period and the `other` type
--
-- ---------------------------------------------------------------------------
-- WHAT ELSE STAGE 1 NEEDS
-- ---------------------------------------------------------------------------
--
-- Running this file is about half of it. The rest is not SQL:
--
--   1. Settings → API → Exposed schemas: add `app`. Without this PostgREST
--      cannot see the schema and every query 404s.
--   2. Authentication → Sign In/Providers → Email: enabled, and
--      "Email OTP expiration" set to 900 (15 minutes). Leave "Allow new users
--      to sign up" ON — D-057 chose open signup.
--   3. Authentication → Emails → Magic Link template: replace
--      {{ .ConfirmationURL }} with {{ .Token }}. Out of the box Supabase mails
--      a clickable link, not a code. Until this is edited no code is ever sent,
--      and no client change fixes it. **Do item 4 first** — the editor is locked
--      until custom SMTP is configured.
--
--      A link is not an acceptable fallback, and the reason is the device rather
--      than the taste. A magic link creates the session in whichever browser
--      opened the email: read the mail on a laptop and the session lands on the
--      laptop while the phone stays signed out. On iOS it is worse — a link in
--      Mail opens Safari, and an installed home-screen PWA has its own storage
--      container, so the session can miss the app on the same device. A six-digit
--      code is read anywhere and typed into the device in your hand, which is the
--      only flow that survives a shared household inbox.
--   4. Authentication → SMTP Settings: a real provider. **This is required, and
--      it gates item 3 rather than following it.** Supabase locks email template
--      editing on the free tier while the built-in sender is in use — the button
--      reads "Set up SMTP" and offers Pro as the alternative. Configure any
--      custom SMTP and the same template screen unlocks, at no cost.
--
--      It does NOT need a domain. Brevo, Mailjet, Postmark and SendGrid all
--      verify a single address by emailing it a confirmation link, which skips
--      SPF/DKIM entirely; a Gmail app password skips the signup too. A real
--      domain becomes worth it before open signup, for deliverability — a
--      single-sender From address does not align with the sending domain and
--      some mail lands in spam.
--
--      Recorded because an earlier revision of this header called SMTP optional
--      for stage 1 and said the built-in sender was enough to prove a code
--      arrives. It is not: with the built-in sender the template cannot be
--      edited, so the code is never a code.
--   5. Authentication → URL Configuration. There are two Vercel origins and
--      they are not interchangeable:
--
--        https://babyliana.vercel.app    `main` — what the two phones run
--        https://babylianav2.vercel.app  this branch — where the migration is built
--
--      **Site URL goes to the v2 origin** while this work is in progress, with
--      both listed under Redirect URLs. Pointing it at staging costs production
--      nothing: `main` never calls signInWithOtp, so it never reads this
--      setting. **Flip it back at cutover** — that is a stage 5 item.
--
--      A numeric OTP never redirects, so this does not gate the flow either
--      way. It bites later if it is left on localhost — or on v2.
--
-- All four of the above are **project-wide**. There is no staging-only value for
-- any of them, because there is one Supabase project. That is deliberate; see
-- below.
--
-- ---------------------------------------------------------------------------
-- WHAT THE v2 ORIGIN IS NOT
-- ---------------------------------------------------------------------------
--
-- It is not isolation. It is a second front end over the same Supabase project,
-- and until stage 2 points the client at this schema it reads and writes
-- `public` with the same key and the same hard-coded baby id as production.
--
-- Verified 2026-09-14 by fetching both bundles: they inline the same project
-- URL, the same publishable key, and the same BABY_ID, and differ by 55 bytes —
-- the welcome heading. **A tap on v2 today lands in the real log.** Treat it as
-- production until stage 2 lands.
--
-- One project is the right call anyway. A second project for staging would turn
-- stage 3's copy from `public` into one SQL statement across two schemas into an
-- export and an import across two endpoints. **The schema boundary is the
-- isolation; the origin never was.**
--
-- `auth.users` needs nothing. It exists in every Supabase project from day one;
-- the foreign keys below just work.
--
-- Stage 1 is done when a real six-digit code arrives in a real inbox — before a
-- line of client code exists — and `verify-s2`, pointed at `app`, passes.


-- ---------------------------------------------------------------------------
-- 1. The schema
--
-- `anon` is deliberately absent from every grant in this file. That omission is
-- the isolation: there is no anonymous policy to drop later, because there was
-- never an anonymous door. Compare `public`, where `0001` granted all four
-- verbs to `anon` and gave every table a `using (true)` policy — which is why
-- anyone holding the key from the public bundle can read every row there.
-- ---------------------------------------------------------------------------

create schema if not exists app;

grant usage on schema app to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Tables
--
-- Five, all singular, same as `public` plus two. The baby is still the root.
--
-- `caregiver` is `public.device` under the name it has always deserved. That
-- table never held phones: `src/device-id.ts` explains its recovery flow as
-- stopping a reinstalled phone from minting "a second device for a parent who
-- already has one", and its rows are called "Dad" and "Mum". The concept
-- drifted in `0001` and only the name stayed put. It is not renamed in
-- `public` — renaming a live table is exactly the risk this schema exists to
-- avoid — so the correction is made here, once, for free.
--
-- It still does NOT reference a baby (D-026). A caregiver belongs to a
-- household, not to a child; if a sibling arrives the same two parents log for
-- both. That independence is also why it is the only table needing `user_id`:
-- every other table can reach a household through `baby_id`, and this one has
-- no path at all.
--
-- Every table carries `updated_by`: free text, null by default, for tagging
-- rows touched by a manual script. **The app never writes it.** That is the
-- whole point — a non-null value means exactly "a human ran something", which
-- only stays a reliable signal if nothing else ever sets it. The copy script in
-- stage 3 will set it.
-- ---------------------------------------------------------------------------

create table if not exists app.baby (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,

  -- One object keyed by setting name — `{"cycles": [...]}` — so a new setting
  -- is a new key and never a new migration (D-052). NULL means nothing has been
  -- set and every reader falls back to its own default.
  settings   jsonb
);

-- No default on `id` below this line, deliberately. These rows are always
-- written by a client that generated its own UUID, which is what makes replay
-- idempotent. A server-side default would quietly mint an id the client does
-- not know, producing a row it cannot match on retry — a duplicate instead of a
-- loud not-null error.
--
-- `app.baby` keeps its default because `app.create_baby()` below inserts
-- without one. The copy script still supplies explicit ids, which a default
-- does not interfere with.

create table if not exists app.caregiver (
  id         uuid primary key,
  name       text,

  -- Which household this person belongs to. Nullable so a row can exist before
  -- it is claimed, and `set null` rather than `cascade` because deleting a
  -- household must not delete a caregiver that `timeslot.logged_by` still
  -- references — that FK is `on delete restrict` and would block the deletion
  -- outright.
  user_id    uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Which household may see which baby. A join table, not a column: many accounts
-- per baby and many babies per account (D-057). The pair *is* the fact, so the
-- composite PK gives the uniqueness constraint and the lookup index at once,
-- and there is no surrogate id to carry around.
--
-- Both sides cascade. Deleting a household drops its memberships without
-- dropping a baby another household still uses; deleting a baby drops its
-- memberships. Neither cascade reaches a timeslot — deliberately, so a removed
-- account leaves the log intact for whoever else is on it.
create table if not exists app.baby_member (
  baby_id    uuid not null references app.baby(id)   on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (baby_id, user_id)
);

create table if not exists app.timeslot (
  id          uuid primary key,
  baby_id     uuid not null references app.baby(id)      on delete restrict,
  logged_by   uuid not null references app.caregiver(id) on delete restrict,
  occurred_at timestamptz not null,
  ended_at    timestamptz,
  recorded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text,
  note        text,
  constraint period_is_forward
    check (ended_at is null or ended_at >= occurred_at)
);

create table if not exists app.event (
  id            uuid primary key,
  timeslot_id   uuid not null references app.timeslot(id) on delete cascade,
  type          text not null check (type in (
                  'feed', 'diaper', 'sleep', 'weight',
                  'temperature', 'supplement', 'spit_up', 'other'
                )),
  note          text,
  recorded_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text,

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

  -- weight / temperature. US units only.
  --
  -- **`grams` and `celsius` are deliberately absent**, and this is the only
  -- chance to leave them out. In `public` they are dead columns kept alive
  -- forever: `0003` superseded them, `0004` dropped them, `0005` had to put
  -- them back when a phone stopped syncing, and D-039 froze them in place
  -- because a dropped column costs a phone's sync and a dead one costs two
  -- bytes of null. A table created fresh inherits none of that. From this row
  -- onward D-039 applies to `app` too — nothing here is ever dropped or
  -- narrowed again.
  --
  -- Positivity only, no range check: a bound shaped like a normal
  -- body-temperature or birth-weight range is a step toward the normal-range
  -- judgement CLAUDE.md rules out, and catching typos is not worth that.
  --
  -- `pounds`, not `ounces`: the input is a decimal number of pounds and the row
  -- reads back as `7 lb 4 oz`. Storing exactly what was typed means a weight
  -- reopened for editing shows the number that was entered, and re-saving it
  -- cannot drift. numeric(4,1) on fahrenheit, not (3,1), which caps at 99.9 and
  -- could not hold an ordinary 100.4 reading.
  pounds        numeric(5,2) check (pounds is null or pounds > 0),
  fahrenheit    numeric(4,1) check (fahrenheit is null or fahrenheit > 0),

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
--
-- The first two are carried across from `0001`. They are not optional here:
-- the event policy in section 5 subqueries `timeslot` on `timeslot_id`, and the
-- timeslot policy filters on `baby_id`. Without them every row read pays for a
-- sequential scan inside RLS.
-- ---------------------------------------------------------------------------

create index if not exists event_timeslot_id_idx
  on app.event (timeslot_id);
create index if not exists timeslot_baby_occurred_idx
  on app.timeslot (baby_id, occurred_at desc);

-- The composite PK already indexes (baby_id, user_id). This covers the other
-- direction — "which babies does this household have" — which is the question
-- the app asks on every launch.
create index if not exists baby_member_user_idx
  on app.baby_member (user_id);

create index if not exists caregiver_user_idx
  on app.caregiver (user_id);


-- ---------------------------------------------------------------------------
-- 4. Membership, as a function
--
-- Every policy below needs the same question answered: does the signed-in
-- household have this baby? Asking it inline is not an option.
--
-- **A policy on `baby_member` that reads `baby_member` recurses infinitely**,
-- and Postgres does not say so at `create policy` time — it says so at query
-- time, once there is data. `security definer` runs the function as its owner,
-- outside RLS, which breaks the loop.
--
-- `set search_path = ''` is required, not decorative: a security definer
-- function with a mutable search_path can be hijacked by a caller who creates a
-- same-named object in a schema that resolves first. Every reference inside is
-- therefore schema-qualified.
-- ---------------------------------------------------------------------------

create or replace function app.is_member_of(target uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from app.baby_member
    where baby_id = target and user_id = auth.uid()
  );
$$;


-- ---------------------------------------------------------------------------
-- 5. Row-level security
--
-- Unlike `0001`, these restrict rows to one household — there is an identity to
-- check against now, which is the whole of D-057.
--
-- Policies are created here, before any row exists. There is no moment at which
-- this schema is open and no later migration that closes it.
--
-- `for all` covers select, insert, update and delete. Where `with check` is
-- omitted Postgres reuses the `using` expression for it.
-- ---------------------------------------------------------------------------

alter table app.baby        enable row level security;
alter table app.caregiver   enable row level security;
alter table app.baby_member enable row level security;
alter table app.timeslot    enable row level security;
alter table app.event       enable row level security;

drop policy if exists "member reads baby"          on app.baby;
drop policy if exists "household reads caregivers" on app.caregiver;
drop policy if exists "read own membership"        on app.baby_member;
drop policy if exists "member reads timeslot"      on app.timeslot;
drop policy if exists "member reads event"         on app.event;

create policy "member reads baby" on app.baby
  for all to authenticated
  using (app.is_member_of(id))
  with check (app.is_member_of(id));

-- `with check` is what stops a client inserting a row against a baby_id it does
-- not belong to. Without it reads are isolated and writes are not, which is the
-- quieter half of the same hole.
create policy "member reads timeslot" on app.timeslot
  for all to authenticated
  using (app.is_member_of(baby_id))
  with check (app.is_member_of(baby_id));

-- Two hops: an event reaches a household only through its timeslot.
create policy "member reads event" on app.event
  for all to authenticated
  using (exists (
    select 1 from app.timeslot t
    where t.id = event.timeslot_id and app.is_member_of(t.baby_id)
  ));

-- A plain column check — no recursion, no function needed.
--
-- Note what this does not do: it scopes caregivers to their own household, so
-- if a second household ever joins the same baby, its members would not see the
-- first household's names and `timeslot.logged_by` would resolve to nothing on
-- their screen. Correct today, wrong the day it happens. It widens to a
-- subquery through `baby_member` then; no column changes.
create policy "household reads caregivers" on app.caregiver
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Read your own memberships. There is no insert policy, deliberately: writing a
-- membership row is the join flow, which nothing needs while one household
-- shares one inbox. `create_baby` below writes the only row that exists, and it
-- does so outside RLS.
create policy "read own membership" on app.baby_member
  for select to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 6. Creating a baby
--
-- `with check (is_member_of(id))` fails on the very first insert: the
-- membership row cannot exist yet, because the baby it points at is the row
-- being created. Chicken and egg, and it surfaces at runtime rather than here.
--
-- So creating a baby is one atomic operation that writes both rows outside RLS.
-- It is also where the onboarding step belongs anyway — a baby with no member
-- is unreachable by anyone, including the person who just made it.
-- ---------------------------------------------------------------------------

create or replace function app.create_baby(baby_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into app.baby (name) values (baby_name) returning id into new_id;
  insert into app.baby_member (baby_id, user_id) values (new_id, auth.uid());

  return new_id;
end $$;


-- ---------------------------------------------------------------------------
-- 7. Data API grants
--
-- Required, and stated explicitly: projects created since 2026-05-30 need them
-- or the tables return empty results or a 401 from the browser while every
-- tutorial written before mid-2026 insists it should have worked. This cost the
-- spike an evening; see .specify/memory/spike-spec.md.
--
-- `alter default privileges` is the part that is easy to miss. Without it the
-- next table added to this schema is silently unreachable, and the symptom is
-- identical to the one above — which makes it a second evening.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema app to authenticated;
grant execute on all routines in schema app to authenticated;

alter default privileges in schema app
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
  grant execute on routines to authenticated;


-- ---------------------------------------------------------------------------
-- 8. Realtime
--
-- Opt-in per table, and it does NOT carry over from `public`. `0001` added the
-- public tables to this publication; these are different tables and need their
-- own entry. Without it everything else works and only live updates between the
-- two phones are silently dead.
--
-- Realtime can lag behind this statement by tens of seconds. If a subscription
-- reports SUBSCRIBED and delivers nothing, wait and retry before changing
-- anything — the spike lost two attempts to exactly that.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['timeslot', 'event'] loop
    begin
      execute format('alter publication supabase_realtime add table app.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 9. Tell PostgREST
--
-- PostgREST rejects an unknown table from its cached schema, not from the
-- database, so the cache is what has to learn about all of this. Supabase
-- reloads it on DDL via an event trigger; this is belt and braces, and harmless
-- if it already happened.
--
-- It does NOT substitute for adding `app` to Exposed schemas in the dashboard.
-- That is a PostgREST config setting, not a cache, and nothing in SQL sets it.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
