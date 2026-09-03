-- BabyLiana — seed the one household and its devices
--
-- Run this ONCE, after 0001. Running it again creates a SECOND household, which
-- is not what you want — the app hard-codes a single id (D-022).
--
-- Edit the two device names below before running. They are what the app shows
-- instead of a UUID when it answers "did I log that, or did you" — so use
-- whatever reads right at 4am, not a formal label.
--
-- The result pane will show the household_id. Hand that back so it can be
-- hard-coded in the client.

insert into public.devices (household_id, name)
select h.id, d.name
from   (select gen_random_uuid() as id) h
cross  join (values
         ('Dad'),          -- <- edit
         ('Mum')           -- <- edit
       ) as d(name)
returning device_id, household_id, name;
