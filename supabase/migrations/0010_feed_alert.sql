-- The feed alert: the card's *make milk* prompt, pushed to a phone (D-069).
--
-- Two tables, one function the edge function calls, and the minute cron that
-- calls it. `.specify/memory/feed-alert.md` is the spec; this is its storage.
--
-- **Additive.** Nothing existing is altered. Neither table goes through the
-- outbox, so a client that knows about them and a database that does not fails
-- one best-effort call and logs it — it does not stall sync. Run this before
-- the deploy anyway.
--
-- **Before the cron at the bottom does anything, two Vault secrets have to
-- exist** — the function's URL and the shared secret it checks. They are
-- per-project and the secret is a secret, so neither is in this public repo.
-- `supabase/README.md` § The feed alert has the two statements to run. Until
-- they exist the job fires every minute and posts to nowhere, which is noise in
-- `cron.job_run_details` and nothing else.
--
-- Safe to re-run.


-- ---------------------------------------------------------------------------
-- 1. When the next alert is due, per baby
--
-- Written by the phones, after every successful sync, from the same functions
-- the card uses. The server never derives a target itself: the cycle windows are
-- clock-of-day in the phone's timezone, and a second copy of D-036 in SQL is a
-- second copy to drift.
--
-- `fire_at` null means nothing is pending — no feed yet, or one running.
--
-- `sent_for` is the server's: the `fire_at` it last sent. The phones upsert the
-- other columns by name, and a PostgREST upsert sets only the columns it was
-- given, so they never touch it. An alert is due exactly when `fire_at` has
-- arrived and differs from `sent_for` — which is what makes a moved target a
-- new alert and an unchanged one not.
-- ---------------------------------------------------------------------------

create table if not exists app.feed_alert (
  baby_id    uuid primary key references app.baby(id) on delete cascade,
  fire_at    timestamptz,
  target_at  timestamptz,
  sent_for   timestamptz,
  updated_at timestamptz not null default now()
);

alter table app.feed_alert enable row level security;

drop policy if exists "member writes feed alert" on app.feed_alert;
create policy "member writes feed alert" on app.feed_alert
  for all to authenticated
  using (app.is_member_of(baby_id))
  with check (app.is_member_of(baby_id));


-- ---------------------------------------------------------------------------
-- 2. Where to send it
--
-- One row per installed app that has turned the switch on. The endpoint is the
-- push service's address for that install and is unique by construction, so it
-- is the key — a re-subscribe on the same install is an update, not a second
-- row.
--
-- `baby_id` is which log this install is on. Switching babies (D-060) moves it,
-- so a phone is alerted for the baby it is looking at and no other.
--
-- `clock` is the install's time format (D-041). The notification prints a time,
-- and every time in this app follows the phone's format; the service worker
-- cannot read localStorage to find out, so the row carries it.
--
-- `user_id` defaults to the caller, so the client never sends it. Scoped by both
-- household and baby: a row nobody else in the world can read.
-- ---------------------------------------------------------------------------

create table if not exists app.push_subscription (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baby_id    uuid not null references app.baby(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  clock      text check (clock is null or clock in ('12h', '24h')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscription_baby_idx
  on app.push_subscription (baby_id);

alter table app.push_subscription enable row level security;

drop policy if exists "own push subscription" on app.push_subscription;
create policy "own push subscription" on app.push_subscription
  for all to authenticated
  using (user_id = auth.uid() and app.is_member_of(baby_id))
  with check (user_id = auth.uid() and app.is_member_of(baby_id));

-- `alter default privileges` in 0007 already covers these; stated anyway, for
-- the reason 0007 § 7 gives — the symptom of a missing grant is an evening.
grant select, insert, update, delete on app.feed_alert        to authenticated;
grant select, insert, update, delete on app.push_subscription to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Claiming what is due — the edge function's one call
--
-- Marks and returns in one statement, so two overlapping runs cannot both send
-- the same alert: the second finds `sent_for` already equal to `fire_at`.
--
-- **Thirty minutes is the staleness cut-off.** A backdated feed can put
-- `fire_at` hours in the past, and a cron that was not running can leave one
-- behind; a prompt about a bottle that was due an hour ago is noise on someone
-- else's lock screen. Older ones are skipped without being marked, which is
-- harmless — they can never come back inside the window.
--
-- Claimed then sent, so a push that fails is not retried. Best-effort is the
-- spec's word for it.
--
-- Not callable by clients. 0007's default privileges grant execute on every new
-- routine in `app` to `authenticated`, so the revoke has to come after.
-- ---------------------------------------------------------------------------

create or replace function app.claim_feed_alerts()
returns table (baby_id uuid, baby_name text, target_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  update app.feed_alert fa
     set sent_for = fa.fire_at
    from app.baby b
   where b.id = fa.baby_id
     and fa.fire_at <= now()
     and fa.fire_at >  now() - interval '30 minutes'
     and fa.sent_for is distinct from fa.fire_at
  returning fa.baby_id, b.name, fa.target_at;
$$;

revoke all on function app.claim_feed_alerts() from public, anon, authenticated;

-- The edge function connects as `service_role`, which bypasses RLS but not
-- grants — and nothing in 0007 granted it the schema.
grant usage on schema app to service_role;
grant execute on function app.claim_feed_alerts() to service_role;
grant select, delete on app.push_subscription to service_role;


-- ---------------------------------------------------------------------------
-- 4. Every minute
--
-- `pg_cron` is free-tier and inside the database, so there is no outside
-- scheduler to keep alive. GitHub's schedule (D-066) runs late by up to tens of
-- minutes, which is fine for a heartbeat and useless for a bottle; Vercel's free
-- cron is daily.
--
-- The URL and the secret come out of Vault at run time. Re-running this file
-- replaces the job by name rather than adding a second one.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'feed-alert',
  '* * * * *',
  $job$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'feed_alert_url'),
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'feed_alert_secret')
      ),
      body    := '{}'::jsonb
    );
  $job$
);

notify pgrst, 'reload schema';
