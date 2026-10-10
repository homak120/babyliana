-- A love note from Liana: a playful push in her voice, to whoever holds the
-- phone, by their caregiver name — twice a day per device, in random windows
-- when the mascot reads *awake* (D-070). `.specify/memory/love-note.md`.
--
-- Rides on the feed alert's machinery (0010): the same tables, the same minute
-- cron, the same edge function. Nothing new is scheduled.
--
-- **Additive, and it must run before the deploy that writes it.** The phones
-- upsert `feed_alert` and `push_subscription` with these new columns named; a
-- database without them refuses the whole upsert, and the *feed alert* stops
-- updating with it. Neither table is on the outbox, so the log keeps syncing —
-- but run this first.
--
-- Safe to re-run.


-- ---------------------------------------------------------------------------
-- 1. When she will be awake — published by the phones beside the feed alert
--
-- From `awakeWindow` in `src/derive.ts`: the mascot's own thresholds, daytime
-- only, null while a feed or a sleep is running. The server does not derive it,
-- for the reason 0010 gives for `fire_at`.
-- ---------------------------------------------------------------------------

alter table app.feed_alert add column if not exists awake_from  timestamptz;
alter table app.feed_alert add column if not exists awake_until timestamptz;


-- ---------------------------------------------------------------------------
-- 2. Per device: who is holding it, where it is, and what it has had today
--
-- `caregiver_id` is how a note says "Mom" on one phone and "Dad" on the other.
-- `tz` is the phone's IANA zone, because "twice a day" needs a day boundary and
-- the database's is UTC. `love` is the device's own switch.
--
-- The last three are the server's bookkeeping and the phones never send them:
-- which awake window it last decided for, which local day it is counting, and
-- how many it has sent on that day.
-- ---------------------------------------------------------------------------

alter table app.push_subscription add column if not exists caregiver_id uuid
  references app.caregiver(id) on delete set null;
alter table app.push_subscription add column if not exists tz          text;
alter table app.push_subscription add column if not exists love        boolean not null default true;
alter table app.push_subscription add column if not exists love_window timestamptz;
alter table app.push_subscription add column if not exists love_day    date;
alter table app.push_subscription add column if not exists love_count  integer not null default 0;


-- ---------------------------------------------------------------------------
-- 3. Deciding, once per awake window per device
--
-- The first minute a window is open, each device in it gets one roll. It wins
-- with probability *notes left today ÷ windows left today*, where windows left
-- is the daylight remaining (to 20:00 local, `themeFor`'s boundary) over a
-- three-hour feed. That spreads two notes across the day rather than spending
-- both on the morning, and it caps at two — once two have gone, the odds are
-- zero. A device that loses the roll waits for the next window.
--
-- `love_window` is what makes it once: marked whether the roll wins or not, so
-- the next minute inside the same window does not roll again.
--
-- A device with no caregiver name, or a zone Postgres does not know, is skipped
-- rather than guessed at — a note that says "Hi, null" is worse than none.
--
-- Not callable by clients, for the reason 0010 § 3 gives.
-- ---------------------------------------------------------------------------

create or replace function app.claim_love_notes()
returns table (endpoint text, caregiver_name text, baby_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  local_now  timestamp;
  today      date;
  sent_today integer;
  windows    integer;
  won        boolean;
begin
  for r in
    select s.endpoint, s.tz, s.love_day, s.love_count,
           fa.awake_from, c.name as caregiver_name, b.name as baby_name
      from app.push_subscription s
      join app.feed_alert fa on fa.baby_id = s.baby_id
      join app.baby b        on b.id = s.baby_id
      join app.caregiver c   on c.id = s.caregiver_id
     where s.love
       and fa.awake_from <= now()
       and fa.awake_until > now()
       and s.love_window is distinct from fa.awake_from
       and coalesce(c.name, '') <> ''
       and s.tz in (select name from pg_catalog.pg_timezone_names)
     for update of s
  loop
    local_now  := now() at time zone r.tz;
    today      := local_now::date;
    sent_today := case when r.love_day = today then r.love_count else 0 end;
    windows    := greatest(1, ceil(
                    extract(epoch from (today + time '20:00' - local_now)) / (3 * 3600)
                  )::integer);
    won        := sent_today < 2 and random() < (2 - sent_today)::float / windows;

    update app.push_subscription
       set love_window = r.awake_from,
           love_day    = today,
           love_count  = sent_today + (case when won then 1 else 0 end)
     where app.push_subscription.endpoint = r.endpoint;

    if won then
      endpoint       := r.endpoint;
      caregiver_name := r.caregiver_name;
      baby_name      := r.baby_name;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function app.claim_love_notes() from public, anon, authenticated;
grant execute on function app.claim_love_notes() to service_role;
grant select on app.push_subscription to service_role;

notify pgrst, 'reload schema';
