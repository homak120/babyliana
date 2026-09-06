-- Put back the metric columns 0004 dropped, and stop dropping columns.
--
-- ---------------------------------------------------------------------------
-- RUN THIS NOW. It unblocks a phone that is currently not syncing.
-- ---------------------------------------------------------------------------
--
-- 0004 dropped `event.grams` and `event.celsius` before the code that stops
-- naming them had reached both phones. Sync pushes whole rows, so the phone
-- still on the old build fails every upsert against a column that no longer
-- exists: push returns false, the reconcile is skipped while the outbox is
-- non-empty, and the sync dot goes red — the same red the app uses for being
-- offline, so it reads as a network problem and is not one.
--
-- The correct fix is this one and not a deploy, because **the stuck phone
-- cannot be reached.** Restoring the columns makes its upserts valid again from
-- the server side alone. It retries on every foreground (`visibilitychange` in
-- `src/sync.ts`), so its outbox drains the next time the app is opened, with
-- nobody doing anything to it.
--
-- Nothing is lost either way — the outbox is durable, which is why this is a
-- delay and not a data loss.
--
-- **These two columns are now permanent.** Nothing in the app reads or writes
-- them; two nullable columns on a table projected at 5 MB a year cost nothing
-- to keep, and dropping one costs a phone's sync. See D-039: the schema is
-- additive-only while any client is out of reach, which with a lazily-updating
-- service worker and no forced update is always.
--
-- Restored to the shapes `0001` declared — integer with the positive check, and
-- `numeric(3,1)`, not the `numeric(4,1)` that `fahrenheit` needed for a
-- three-digit reading. Faithful rather than tidied, because the point is to
-- accept exactly what the old build sends. In practice it only ever sends null:
-- the pre-0004 row builder hard-coded `grams: null, celsius: null`, so the
-- check cannot fire and the precision cannot be exceeded.
--
-- Additive and `if not exists`, so it is safe to re-run.

alter table event
  add column if not exists grams integer,
  add column if not exists celsius numeric(3, 1);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event'::regclass and conname = 'event_grams_check'
  ) then
    alter table event
      add constraint event_grams_check check (grams is null or grams > 0);
  end if;
end $$;

comment on column event.grams is
  'Dead. Superseded by pounds (0003), dropped by 0004, restored by 0005 so a client on pre-0004 code can still upsert. Never read, never written, never drop again — D-039.';
comment on column event.celsius is
  'Dead. Superseded by fahrenheit (0003), dropped by 0004, restored by 0005 so a client on pre-0004 code can still upsert. Never read, never written, never drop again — D-039.';

-- PostgREST rejects an unknown column from its cached schema, not from the
-- table, so the cache is what has to learn about this. Supabase reloads it on
-- DDL via an event trigger; this is belt and braces, and harmless if it already
-- happened.
notify pgrst, 'reload schema';
