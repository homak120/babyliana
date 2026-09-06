-- Weight and temperature move to US units.
--
-- The schema shipped `grams` and `celsius` because that is what the model was
-- written in. The app is used in the US, where a scale reads pounds and a
-- thermometer reads Fahrenheit, and converting in your head at 4am is exactly
-- the kind of cost this app exists to remove.
--
-- **Additive, deliberately.** The old columns stay. Two phones run this app and
-- the service worker updates lazily, so during a rollout one of them is still
-- on code that writes `grams` — dropping it would break that phone's sync until
-- it happened to update. Nothing reads or writes the old pair after this, and
-- dropping them is a separate, later, deliberate step once the owner is sure.
--
-- `pounds`, not `ounces`: the input is a decimal number of pounds and the row
-- reads back as `7 lb 4 oz`. Storing exactly what was typed means a weight
-- reopened for editing shows the number that was entered, and re-saving it
-- cannot drift — the same reason D-020 keeps one fact in one place.

alter table event
  -- Positivity only, deliberately no range check. A bound shaped like a normal
  -- birth-weight range is a step toward the normal-range judgement CLAUDE.md
  -- rules out, and catching typos is not worth that. Same rule the old `grams`
  -- column carried.
  add column if not exists pounds numeric(5,2) check (pounds is null or pounds > 0),
  -- numeric(4,1) rather than the old celsius column's numeric(3,1), which caps
  -- at 99.9 and could not hold an ordinary 100.4 reading.
  add column if not exists fahrenheit numeric(4,1) check (fahrenheit is null or fahrenheit > 0);

comment on column event.pounds is
  'Weight in pounds, as typed. Displayed as lb + oz. Supersedes grams.';
comment on column event.fahrenheit is
  'Temperature in degrees Fahrenheit. Supersedes celsius.';
comment on column event.grams is
  'Superseded by pounds (0003). Kept so a phone on older code keeps syncing; nothing reads it.';
comment on column event.celsius is
  'Superseded by fahrenheit (0003). Kept so a phone on older code keeps syncing; nothing reads it.';
