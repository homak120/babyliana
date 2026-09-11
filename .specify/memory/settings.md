# Settings — what is tunable, and where each one lives

Status: **being built** (D-055). The feeding cycle shipped first, alone, in
D-050; `baby.settings` became a generic keyed object in D-052 so the second
setting would cost no migration. This is the second through fifth.

The authority on *how* a shared setting reaches everyone else is
`.specify/memory/event-model.md`; this document is the list and the rules for
adding to it.

## The two axes

Every setting answers two questions before it is built.

**1. Is it a fact about her, or a preference of the device in your hand?**

A fact about her is **shared**: it lives as a key on `baby.settings` and every
device converges on it. How much a bottle usually holds is a fact about her. A
preference of the device is **local**: it lives in `localStorage`, never syncs,
and devices are allowed to disagree forever — the clock format is the worked
example (`timeformat.ts`), and the lead rail is another.

Getting this wrong in the shared direction is the expensive one: it changes what
everyone else sees without them touching it.

**2. Does anyone actually retype it?**

A default only earns a setting if disagreeing with it costs something real and
repeatedly. `newDiaper()` defaults to a pee and always will — the baseline says
a bare `1` dominates, and it is one tap to turn off. That is a default, not a
setting. The bar for promotion is that someone is *correcting the same thing
every day*.

## What is shared

Keys on `baby.settings`, all optional, every reader defaulting. A key nobody has
ever written is absent, and an older build ignores a key it has never heard of
rather than choking on it — that is what makes a new setting free.

| Key | Shape | Default | Reaches |
| --- | --- | --- | --- |
| `cycles` | `Cycle[]` | day 3h / night 4h | the card's ceiling, the next-feeds list |
| `bottle` | `{ volume, source }` | 60 mL formula | the bar's bottle icon |
| `supplement` | `{ name, amount }` | Vitamin D / 1 drop | the supplement block's prefill |
| `prepLeadMinutes` | `number` | 15 | when *make a bottle* goes up |

**`bottle` is one key, not two.** Volume and source are one answer to one
question — what the quick icon means — so they are written together, reconciled
together, and cannot arrive half-applied.

### Why the bottle default matters more than it used to

Before D-053 the bottle opened a sheet, so the default was a *prefill*: visible,
overwritable, and wrong at no cost. Since D-053 it writes straight to the log,
so a wrong default is **a wrong row**, corrected by a swipe-edit after the fact.
The setting is not convenience; it is the thing that stops the one-tap entry
from lying.

## What is local

Neither of these moves into `baby.settings`, and only one of them is on the
settings screen.

| Setting | Home | Where it is edited | Why local |
| --- | --- | --- | --- |
| Clock format | `localStorage`, `timeformat.ts` | settings, *only here* | a preference of the thing in your hand; devices may disagree and that is correct |
| This device's name | the `device` row, via `renameThisDevice` | the status row (D-056) | the name *is* the device; it syncs as a device, not as a setting |

**The name is not a setting, and that is why it is not on this screen.** It was,
briefly, and D-056 took it back to the status row for two reasons. A settings
screen answers questions; it cannot *ask* one, and a device that has never been
named has to be asked — the status-row button labels itself `name this phone`
until there is a name, which is an advertisement on the home screen that a row
four gestures deep cannot be. And a name is typed, so it commits on a save
button, where every control in settings is a tap that cannot be left half-done.

## The screen

One sheet behind the card's `tune` button, titled **settings**. The feeding
cycle is now a section in it rather than the whole of it.

**Every row says whose it is** — *everyone* or *only here*. With one shared
setting that was something you simply knew. With four, changing the bottle
default and having someone else start logging 90 mL is a surprise, and a
surprise in a shared log is worse than a word of chrome.

**A scope label names neither a count nor a kind of hardware.** Two wordings
shipped and were corrected in a day, and both were the same mistake at different
depths:

- *both phones* counted the household. Nothing caps it at two — `device` has no
  limit, and anything entering with the shared baby id mints its own row — so
  the label described this household rather than the rule, and would start lying
  the first time a third one logged a feed.
- *every phone* named the hardware. This is a PWA (D-001): it installs on a
  laptop, a tablet, anything with a browser. The word was describing the owner's
  devices rather than the rule.

So the rule for any future label, and for prose anywhere near a user: **say who,
not how many and not what kind.** A `verify-hero` check asserts both halves.

**And *only here*, not *just you*.** The local side is per *device*, not per
person — the clock format is in `localStorage` — so the same person on a laptop
and a phone gets two answers. *only here* is true of a place; *just you* would
be a claim about a person that the storage does not make.

**No save button.** Every control commits as you touch it: local write, the card
repaints, the push follows. That is the rule the whole app already runs on, and
D-053 removed two confirmation steps for the same reason. The steppers debounce
so holding `+` does not queue twenty pushes. `✕` closes; it never discards,
because there is never anything pending.

## Adding the next one

1. Answer both axes above. If it is local, it does not come here at all.
2. Add the key to `BabySettings` in `types.ts`, optional.
3. Register it in `settings.ts` with its default, its parse and its field-wise
   comparison. **Never compare with `JSON.stringify`** — `jsonb` does not
   preserve key order, so a round-tripped value is the same thing and a
   different string, and a string comparison calls every pull a change (D-052).
4. Read it through `read(key)` at the point of use. Do not thread it through
   props: `cycleFor` is called during render, which is why the cache is
   synchronous.

No migration, and no deploy gate — a new key is not a new column, which is the
whole reason D-052 chose one `jsonb` object over a column per setting.

## Deliberately not settings

- **The insights watch-list thresholds** — 6 wet diapers, 24h since a poop, a
  3h feed gap, 20% under average. D-032 calls these four *fixed* thresholds,
  chosen with the broader rule in front of the owner. Making them tunable is a
  decision to reopen D-032, not a setting to add.
- **Weight units.** D-036 chose pounds. Changing it is relitigating that.
- **The mascot's hold thresholds.** Derived state, and the tone rule in
  `CLAUDE.md` is load-bearing on it.
- **The diaper default and the next-feeds count.** Both fail axis 2 — nobody
  retypes them. D-051 picked four estimates for a stated reason.
- **`SCRUB_MAX`, the milk strip's span.** It fails axis 2 today and will fail
  axis 1 tomorrow: it should be *derived* from the largest feed actually logged
  rather than remembered by a person, because it goes stale as she grows.
