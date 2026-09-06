-- Drop the metric weight and temperature columns superseded by 0003.
--
-- ---------------------------------------------------------------------------
-- DO NOT RUN THIS UNTIL BOTH PHONES ARE ON CODE THAT DOES NOT SEND THEM.
-- ---------------------------------------------------------------------------
--
-- This is the reverse of 0003 and so is the ordering. Adding a column is safe
-- to do early, because a client that has never heard of it carries on working.
-- **Dropping one is only safe late.** Sync pushes whole rows, so any phone
-- still running code that names `grams` fails its upsert the moment the column
-- is gone, and the outbox stops draining quietly — push returns false and the
-- reconcile is skipped while writes are pending. That phone then looks like it
-- is working and is silently not syncing.
--
-- The order that is safe:
--
--   1. Deploy the version that stops sending `grams` and `celsius`. That is the
--      commit carrying this file — it removes the two fields from the event row
--      builder in `src/moments.ts` and from `LogEvent` in `src/types.ts`.
--   2. Open the app on **both** phones and let the service worker update. It
--      updates lazily (`registerType: 'prompt'`, applied when the app becomes
--      visible and nothing is being entered — `src/updates.ts`), so this is not
--      instant and cannot be assumed.
--   3. Only then run this file.
--
-- Between 1 and 3 the columns simply sit there unread, which costs nothing.
-- There is no deadline.
--
-- **Nothing is lost.** These columns have never held a value: at the time 0003
-- landed the database held 88 feeds, 78 diapers, 13 sleeps and one `other`, and
-- not a single weight or temperature. The query that says so, if you want to
-- check again before running this:
--
--   select count(*) from event where grams is not null or celsius is not null;
--
-- It must return 0. If it does not, stop — a value in here is a real reading
-- that nothing in the app can display any more, and it wants converting into
-- `pounds` / `fahrenheit` first rather than dropping.

do $$
begin
  if exists (select 1 from event where grams is not null or celsius is not null) then
    raise exception
      'event.grams / event.celsius still hold values; convert them to pounds / fahrenheit before dropping';
  end if;
end $$;

alter table event
  drop column if exists grams,
  drop column if exists celsius;
