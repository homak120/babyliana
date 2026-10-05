-- A heartbeat, so the free tier never sees seven idle days.
--
-- Supabase pauses a free project after a week without activity, and a paused
-- project is eventually deleted with no backup (see supabase/README.md). Two
-- phones logging every few hours keep it awake in practice; this covers the
-- week nobody opens the app. `.github/workflows/supabase-keep-alive.yml` calls
-- `keep_alive_ping()` twice a week.
--
-- **The table takes no writes from a client, only the function does.** The anon
-- key is in a public bundle, so a table anon can insert into is a table anyone
-- can fill with any timestamp they like. The function takes no arguments and
-- writes one row stamped by the database, so the most a stranger can do with it
-- is what the workflow already does.
--
-- It prunes as it goes — rows older than 90 days — so the table stays a few
-- dozen rows forever and nobody has to remember it exists.
--
-- In `public`, not `app`: `anon` is deliberately absent from every grant in
-- `app` (0007), and this is the one thing that has to work without a session.
-- Touches nothing else. Safe to re-run.

create table if not exists public.keep_alive (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

alter table public.keep_alive enable row level security;

-- Supabase's default privileges grant every new `public` table to anon and
-- authenticated. Take that back: no policies and no grants means the table is
-- reachable only through the function below.
revoke all on public.keep_alive from anon, authenticated;

-- `security definer` so it can write a table its caller cannot.
-- `set search_path = ''` for the same reason as in 0007: a definer function with
-- a mutable search_path can be hijacked.
create or replace function public.keep_alive_ping()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamped timestamptz;
begin
  insert into public.keep_alive default values returning pinged_at into stamped;
  delete from public.keep_alive where pinged_at < now() - interval '90 days';
  return stamped;
end;
$$;

revoke all on function public.keep_alive_ping() from public;
grant execute on function public.keep_alive_ping() to anon;
